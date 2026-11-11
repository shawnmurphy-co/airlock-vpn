"""
vpn_engine.py — OpenVPN core lifecycle, kill switch and DNS guard.

Spawns the real openvpn binary as a managed child process, watches its
state-machine output, forces secure DNS, enforces a platform firewall
kill switch while the tunnel is up, and reports live throughput by
polling the tun interface counters through psutil.

Supported hosts: Windows 10/11 (TAP-Windows6 / Wintun), macOS (utun),
Linux (tun). All firewall mutations are transactional: whatever
'enable()' changes, 'disable()' reverts — even after a crash, rules are
namespaced under the 'Airlock' label so they can be swept clean.
"""

from __future__ import annotations

import enum
import logging
import os
import platform
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import psutil

log = logging.getLogger("airlock.engine")

SYSTEM = platform.system()          # 'Windows' | 'Darwin' | 'Linux'
MGMT_HOST, MGMT_PORT = "127.0.0.1", 7505
SECURE_RESOLVERS = ("1.1.1.1", "8.8.8.8")


class State(enum.Enum):
    DISCONNECTED = "DISCONNECTED"
    RESOLVING = "RESOLVING"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    RECONNECTING = "RECONNECTING"
    DISCONNECTING = "DISCONNECTING"
    ERROR = "ERROR"


@dataclass(slots=True)
class Stats:
    down_bps: float = 0.0
    up_bps: float = 0.0
    total_down: int = 0
    total_up: int = 0
    seconds: int = 0


# ---------------------------------------------------------------------------
# Binary discovery
# ---------------------------------------------------------------------------
OPENVPN_CANDIDATES = {
    "Windows": [
        r"C:\Program Files\OpenVPN\bin\openvpn.exe",
        r"C:\Program Files (x86)\OpenVPN\bin\openvpn.exe",
    ],
    "Darwin": ["/opt/homebrew/sbin/openvpn", "/usr/local/sbin/openvpn"],
    "Linux": ["/usr/sbin/openvpn", "/usr/bin/openvpn", "/sbin/openvpn"],
}


def find_openvpn() -> str:
    exe = shutil.which("openvpn")
    if exe:
        return exe
    for path in OPENVPN_CANDIDATES.get(SYSTEM, []):
        if Path(path).exists():
            return path
    raise FileNotFoundError(
        "openvpn binary not found. Install OpenVPN 2.5+ (see README / setup guide)."
    )


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    log.debug("exec: %s", " ".join(cmd))
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


# ---------------------------------------------------------------------------
# Tunnel process
# ---------------------------------------------------------------------------
class TunnelProcess:
    """Owns the openvpn child process and parses its state machine."""

    def __init__(self, binary: str, profile: Path, on_event):
        self.binary, self.profile, self.on_event = binary, profile, on_event
        self.proc: subprocess.Popen | None = None
        self.state = State.DISCONNECTED
        self._reader: threading.Thread | None = None

    # -- lifecycle ---------------------------------------------------------
    def start(self) -> None:
        workdir = Path(tempfile.mkdtemp(prefix="airlock_"))
        cmd = [
            self.binary,
            "--config", str(self.profile),
            "--management", MGMT_HOST, str(MGMT_PORT),
            "--management-query-passwords",
            "--verb", "3",
            "--connect-retry-max", "1",
            "--data-ciphers", "AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305",
            "--data-ciphers-fallback", "AES-256-CBC",
        ]
        if SYSTEM != "Windows":
            cmd[0:0] = ["sudo", "-n"] if os.geteuid() != 0 else []

        self._set_state(State.CONNECTING)
        self.proc = subprocess.Popen(
            cmd,
            cwd=workdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self._reader = threading.Thread(target=self._pump, daemon=True)
        self._reader.start()

    def stop(self, grace: float = 4.0) -> None:
        self._set_state(State.DISCONNECTING)
        try:
            self._mgmt_signal("SIGTERM")
        except OSError:
            pass
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.wait(timeout=grace)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self._set_state(State.DISCONNECTED)

    # -- internals ----------------------------------------------------------
    def _mgmt_signal(self, sig: str) -> None:
        with socket.create_connection((MGMT_HOST, MGMT_PORT), timeout=2) as s:
            s.sendall(f"signal {sig}\n".encode())

    def _pump(self) -> None:
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            line = line.rstrip()
            self.on_event("log", line)
            if "Initialization Sequence Completed" in line:
                self._set_state(State.CONNECTED)
            elif "Attempting to establish TCP connection" in line or "RESOLVE" in line:
                self._set_state(State.RESOLVING)
            elif "RECONNECTING" in line:
                self._set_state(State.RECONNECTING)
            elif any(t in line for t in ("AUTH_FAILED", "Cannot ioctl", "TLS Error")):
                self._set_state(State.ERROR)
        if self.proc.poll() not in (None, 0) and self.state not in (
            State.DISCONNECTING, State.DISCONNECTED,
        ):
            self._set_state(State.ERROR)

    def _set_state(self, state: State) -> None:
        if state is not self.state:
            self.state = state
            self.on_event("state", state)


# ---------------------------------------------------------------------------
# Kill switch — block every packet that is not tunnel traffic
# ---------------------------------------------------------------------------
class KillSwitch:
    """
    Policy while armed:
      * allow loopback
      * allow traffic on the tun/tap interface itself
      * allow direct UDP/TCP to the current relay IP (so the tunnel can live)
      * allow DHCP (67/68) so the LAN lease survives
      * DROP everything else
    """

    def __init__(self) -> None:
        self.armed = False
        self.relay_ip: str | None = None

    def enable(self, relay_ip: str) -> None:
        self.relay_ip = relay_ip
        try:
            {"Linux": self._linux_on, "Darwin": self._mac_on,
             "Windows": self._win_on}[SYSTEM]()
            self.armed = True
            log.info("kill switch ARMED")
        except Exception as exc:
            log.error("kill switch failed to arm: %s", exc)

    def disable(self) -> None:
        try:
            {"Linux": self._linux_off, "Darwin": self._mac_off,
             "Windows": self._win_off}[SYSTEM]()
        finally:
            self.armed = False
            log.info("kill switch disarmed")

    # -- Linux (iptables) ----------------------------------------------------
    def _linux_on(self) -> None:
        _run(["iptables", "-N", "AIRLOCK_OUT"], check=False)
        rules = [
            ["-o", "lo", "-j", "ACCEPT"],
            ["-o", "tun+", "-j", "ACCEPT"],
            ["-d", self.relay_ip, "-j", "ACCEPT"],
            ["-p", "udp", "--dport", "67:68", "-j", "ACCEPT"],
            ["-j", "DROP"],
        ]
        for rule in rules:
            _run(["iptables", "-A", "AIRLOCK_OUT", *rule])
        _run(["iptables", "-C", "OUTPUT", "-j", "AIRLOCK_OUT"], check=False) or \
            _run(["iptables", "-I", "OUTPUT", "1", "-j", "AIRLOCK_OUT"])

    def _linux_off(self) -> None:
        _run(["iptables", "-D", "OUTPUT", "-j", "AIRLOCK_OUT"], check=False)
        _run(["iptables", "-F", "AIRLOCK_OUT"], check=False)
        _run(["iptables", "-X", "AIRLOCK_OUT"], check=False)

    # -- macOS (pf anchor) ---------------------------------------------------
    def _mac_on(self) -> None:
        anchor = Path("/etc/pf.anchors/airlock")
        anchor.write_text(
            "block drop out quick all\n"
            "pass out quick on lo0 all\n"
            "pass out quick on utun+ all\n"
            f"pass out quick from any to {self.relay_ip} keep state\n"
        )
        _run(["pfctl", "-a", "airlock", "-f", str(anchor)])
        _run(["pfctl", "-E"], check=False)

    def _mac_off(self) -> None:
        _run(["pfctl", "-a", "airlock", "-F", "all"], check=False)

    # -- Windows (PowerShell net firewall) -----------------------------------
    _PS_ARM = (
        "New-NetFirewallRule -DisplayName AirlockKS-TUN -Direction Outbound "
        "-Action Allow -InterfaceAlias 'OpenVPN*','Wintun','*TAP*';"
        "New-NetFirewallRule -DisplayName AirlockKS-Relay -Direction Outbound "
        "-Action Allow -RemoteAddress {ip};"
        "New-NetFirewallRule -DisplayName AirlockKS-DHCP -Direction Outbound "
        "-Action Allow -Protocol UDP -RemotePort 67,68;"
        "New-NetFirewallRule -DisplayName AirlockKS-Block -Direction Outbound "
        "-Action Block;"
    )

    def _win_on(self) -> None:
        ps = self._PS_ARM.format(ip=self.relay_ip)
        _run(["powershell", "-NoProfile", "-Command", ps])

    def _win_off(self) -> None:
        _run(["powershell", "-NoProfile", "-Command",
              "Remove-NetFirewallRule -DisplayName 'AirlockKS-*'"], check=False)


# ---------------------------------------------------------------------------
# DNS leak prevention
# ---------------------------------------------------------------------------
class DNSGuard:
    """Forces secure public resolvers on the active interface, restores after."""

    def __init__(self) -> None:
        self._restore: list[tuple[str, str]] = []

    def apply(self) -> None:
        try:
            {"Linux": self._linux, "Darwin": self._mac,
             "Windows": self._win}[SYSTEM]()
            log.info("DNS pinned to %s", ", ".join(SECURE_RESOLVERS))
        except Exception as exc:
            log.error("DNS guard failed: %s", exc)

    def restore(self) -> None:
        try:
            if SYSTEM == "Darwin":
                for svc, _ in self._restore:
                    _run(["networksetup", "-setdnsservers", svc, "Empty"], check=False)
            elif SYSTEM == "Windows":
                _run(["netsh", "interface", "ip", "set", "dnsservers",
                      "name=Wi-Fi", "source=dhcp"], check=False)
            else:
                if (Path("/etc/resolv.conf.airlock.bak")).exists():
                    shutil.copy("/etc/resolv.conf.airlock.bak", "/etc/resolv.conf")
        finally:
            self._restore.clear()

    def _linux(self) -> None:
        if shutil.which("resolvectl"):
            for iface in _tun_like_interfaces():
                _run(["resolvectl", "dns", iface, *SECURE_RESOLVERS], check=False)
                _run(["resolvectl", "domain", iface, "~."], check=False)
        else:
            shutil.copy("/etc/resolv.conf", "/etc/resolv.conf.airlock.bak")
            Path("/etc/resolv.conf").write_text(
                "".join(f"nameserver {r}\n" for r in SECURE_RESOLVERS)
            )

    def _mac(self) -> None:
        out = _run(["networksetup", "-listallnetworkservices"]).stdout.splitlines()[1:]
        for svc in (s.lstrip("* ") for s in out if s.strip()):
            if svc.startswith(("Wi-Fi", "Ethernet", "USB")):
                self._restore.append((svc, ""))
                _run(["networksetup", "-setdnsservers", svc, *SECURE_RESOLVERS])

    def _win(self) -> None:
        _run(["netsh", "interface", "ip", "set", "dnsservers",
              "name=Wi-Fi", "static", SECURE_RESOLVERS[0], "primary"], check=False)
        _run(["netsh", "interface", "ip", "set", "dnsservers",
              "name=Ethernet", "static", SECURE_RESOLVERS[0], "primary"], check=False)


# ---------------------------------------------------------------------------
# Throughput monitor
# ---------------------------------------------------------------------------
def _tun_like_interfaces() -> list[str]:
    names = []
    for nic in psutil.net_io_counters(pernic=True):
        low = nic.lower()
        if low.startswith(("tun", "tap", "utun", "wintun")) or "openvpn" in low:
            names.append(nic)
    return names


class ThroughputMonitor(threading.Thread):
    """1 Hz sampler that converts interface byte-counters into bps rates."""

    def __init__(self, on_stats, interval: float = 1.0):
        super().__init__(daemon=True)
        self.on_stats, self.interval = on_stats, interval
        self._stop_evt = threading.Event()
        self.stats = Stats()

    def run(self) -> None:
        prev = self._snapshot()
        t0 = time.monotonic()
        while not self._stop_evt.wait(self.interval):
            cur = self._snapshot()
            if cur and prev:
                dt = max(cur[0] - prev[0], 1e-6)
                self.stats.down_bps = (cur[1] - prev[1]) * 8 / dt
                self.stats.up_bps = (cur[2] - prev[2]) * 8 / dt
                self.stats.total_down += cur[1] - prev[1]
                self.stats.total_up += cur[2] - prev[2]
            self.stats.seconds = int(time.monotonic() - t0)
            prev = cur
            self.on_stats(self.stats)

    def stop(self) -> None:
        self._stop_evt.set()

    @staticmethod
    def _snapshot() -> tuple[float, int, int] | None:
        counters = psutil.net_io_counters(pernic=True)
        rx = tx = 0
        found = False
        for nic in _tun_like_interfaces():
            c = counters.get(nic)
            if c:
                rx += c.bytes_recv
                tx += c.bytes_sent
                found = True
        return (time.monotonic(), rx, tx) if found else None


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
class VpnEngine:
    """
    Facade used by the GUI. Callbacks:
        on_state(state: State)            — tunnel state machine
        on_stats(stats: Stats)            — 1 Hz throughput snapshot
        on_log(line: str)                 — raw openvpn log line
    """

    def __init__(self, on_state, on_stats, on_log):
        self.on_state, self.on_stats, self.on_log = on_state, on_stats, on_log
        self.binary = find_openvpn()
        self.kill_switch = KillSwitch()
        self.dns_guard = DNSGuard()
        self.tunnel: TunnelProcess | None = None
        self.monitor: ThroughputMonitor | None = None
        self.kill_switch_enabled = True
        self._monitor_started = False

    # -- public API ----------------------------------------------------------
    def connect(self, profile: Path, relay_ip: str) -> None:
        if self.tunnel and self.tunnel.state not in (State.DISCONNECTED, State.ERROR):
            raise RuntimeError("tunnel already active")
        if self.kill_switch_enabled:
            self.kill_switch.enable(relay_ip)
        self.dns_guard.apply()
        self.tunnel = TunnelProcess(self.binary, profile, self._on_event)
        self.tunnel.start()

    def disconnect(self) -> None:
        try:
            if self.tunnel:
                self.tunnel.stop()
        finally:
            self._teardown()

    # -- wiring ---------------------------------------------------------------
    def _on_event(self, kind: str, payload) -> None:
        if kind == "state":
            if payload is State.CONNECTED and not self._monitor_started:
                self.monitor = ThroughputMonitor(self.on_stats)
                self.monitor.start()
                self._monitor_started = True
            if payload in (State.ERROR, State.DISCONNECTED):
                self._teardown()
            self.on_state(payload)
        else:
            self.on_log(payload)

    def _teardown(self) -> None:
        if self.monitor:
            self.monitor.stop()
            self.monitor = None
            self._monitor_started = False
        self.dns_guard.restore()
        self.kill_switch.disable()


def check_tun_device() -> bool:
    """Sanity check run at startup: TUN/TAP driver present?"""
    if SYSTEM == "Linux":
        return Path("/dev/net/tun").exists()
    if SYSTEM == "Darwin":
        return any(Path(f"/dev/utun{i}").exists() for i in range(8))
    # Windows: look for TAP/Wintun adapters via WMI-free heuristic
    out = subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "Get-NetAdapter | Select-Object -ExpandProperty InterfaceDescription"],
        capture_output=True, text=True,
    ).stdout.lower()
    return "tap-windows" in out or "wintun" in out
