"""
server_fetcher.py — Dynamic free server infrastructure engine.

Downloads the public VPN Gate relay index (CSV), parses every active
node, filters them down to the 12 supported target regions, measures
TCP latency and picks the fastest candidate per region.

Data source : http://www.vpngate.net/api/iphone/
Project     : VPN Gate Academic Experiment, University of Tsukuba
License     : relay list is public; this module is MIT licensed.

No account, no API key, no tracking. Cache is kept in-memory and on
disk so the client keeps working when the index is briefly offline.
"""

from __future__ import annotations

import base64
import csv
import json
import logging
import socket
import ssl
import time
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path

log = logging.getLogger("airlock.fetcher")

VPN_GATE_API = "http://www.vpngate.net/api/iphone/"
CACHE_FILE = Path.home() / ".airlock" / "relay_cache.json"
CACHE_TTL_SECONDS = 15 * 60

# --------------------------------------------------------------------------
# Target region routing filter — the ONLY regions this client will ever map.
# --------------------------------------------------------------------------
TARGET_REGIONS: dict[str, str] = {
    "US": "United States",
    "CA": "Canada",
    "AU": "Australia",
    "BR": "Brazil",
    "KR": "South Korea",
    "VN": "Vietnam",
    "JP": "Japan",
    "GB": "United Kingdom",
    "DE": "Germany",
    "FR": "France",
    "IN": "India",
    "CN": "China",
}


@dataclass(slots=True)
class RelayNode:
    """One parsed VPN Gate relay entry."""

    host_name: str
    ip: str
    score: int
    ping_ms: int            # as reported by the index (icmp at source)
    speed_bps: int
    country_long: str
    country_short: str
    sessions: int
    uptime_s: int
    config_b64: str
    measured_ms: float | None = field(default=None)  # our own TCP probe

    @property
    def region_supported(self) -> bool:
        return self.country_short in TARGET_REGIONS

    @property
    def effective_ping(self) -> float:
        return self.measured_ms if self.measured_ms is not None else float(self.ping_ms)

    def to_json(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------
def fetch_index(timeout: float = 12.0) -> str:
    """Download the raw CSV index with hard timeouts and a strict UA."""
    req = urllib.request.Request(
        VPN_GATE_API,
        headers={"User-Agent": "AirlockVPN/1.0 (+open-source client)"},
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # index is plain HTTP; treat as untrusted text
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as res:
        return res.read().decode("utf-8", errors="replace")


def parse_index(raw: str) -> list[RelayNode]:
    """
    Parse the VPN Gate CSV.

    Layout:
        line 0 : '*vpn_servers'
        line 1 : '#HostName,IP,Score,Ping,Speed,...' (column header)
        line N : data rows, terminated by a lone '*'
    """
    nodes: list[RelayNode] = []
    reader = csv.reader(
        line for line in raw.splitlines()
        if line and not line.startswith(("*", "#"))
    )
    for row in reader:
        if len(row) < 15:
            continue
        try:
            nodes.append(
                RelayNode(
                    host_name=row[0].strip(),
                    ip=row[1].strip(),
                    score=int(row[2] or 0),
                    ping_ms=int(float(row[3])) if row[3] not in ("", "-") else 9999,
                    speed_bps=int(float(row[4] or 0)),
                    country_long=row[5].strip(),
                    country_short=row[6].strip().upper(),
                    sessions=int(row[7] or 0),
                    uptime_s=int(row[8] or 0),
                    config_b64=row[14].strip(),
                )
            )
        except (ValueError, IndexError):
            continue  # tolerate malformed rows from volunteer operators
    return nodes


def filter_target_regions(nodes: list[RelayNode]) -> dict[str, list[RelayNode]]:
    """
    Routing filter: bucket ONLY the 12 supported regions.
    Every other country present in the public index is discarded here,
    so the UI can never offer an out-of-scope exit.
    """
    buckets: dict[str, list[RelayNode]] = {code: [] for code in TARGET_REGIONS}
    for node in nodes:
        if node.region_supported:
            buckets[node.country_short].append(node)
    for code in buckets:
        buckets[code].sort(key=lambda n: (n.effective_ping, -n.speed_bps))
    return buckets


# --------------------------------------------------------------------------
# Latency probing
# --------------------------------------------------------------------------
def tcp_ping(host: str, port: int = 443, timeout: float = 2.0) -> float | None:
    """
    ICMP ping needs raw sockets (root). A TCP connect to the relay's
    SSL-VPN port is a portable approximation that works unprivileged.
    Returns milliseconds or None when unreachable.
    """
    start = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return (time.perf_counter() - start) * 1000.0
    except OSError:
        return None


def probe_best(nodes: list[RelayNode], sample: int = 6) -> RelayNode | None:
    """Probe the top {sample} candidates of a region and keep the fastest."""
    best: RelayNode | None = None
    for node in nodes[:sample]:
        ms = tcp_ping(node.ip)
        if ms is None:
            continue
        node.measured_ms = round(ms, 1)
        if best is None or node.measured_ms < (best.measured_ms or 1e9):
            best = node
    return best or (nodes[0] if nodes else None)


# --------------------------------------------------------------------------
# Config materialisation
# --------------------------------------------------------------------------
def build_ovpn_config(node: RelayNode) -> str:
    """Decode the base64 OpenVPN profile shipped inside the CSV row."""
    pad = "=" * (-len(node.config_b64) % 4)
    return base64.b64decode(node.config_b64 + pad).decode("utf-8", "replace")


def write_profile(node: RelayNode, directory: Path) -> Path:
    """
    Write a ready-to-spawn .ovpn profile plus the credential file the
    public relays expect (user 'vpn' / password 'vpn').
    """
    directory.mkdir(parents=True, exist_ok=True)
    cfg = build_ovpn_config(node)

    creds = directory / "airlock_auth.txt"
    creds.write_text("vpn\nvpn\n", encoding="utf-8")
    # Point auth-user-pass at our credential file when the profile asks
    # interactively, so the core never blocks waiting for stdin.
    if "auth-user-pass" in cfg and str(creds) not in cfg:
        cfg = cfg.replace("auth-user-pass", f"auth-user-pass {creds}", 1)

    profile = directory / f"airlock_{node.country_short}_{node.ip.replace('.', '-')}.ovpn"
    profile.write_text(cfg, encoding="utf-8")
    return profile


# --------------------------------------------------------------------------
# Disk cache — keeps the client usable when the index hiccups
# --------------------------------------------------------------------------
def save_cache(buckets: dict[str, list[RelayNode]]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {c: [n.to_json() for n in ns[:8]] for c, ns in buckets.items()}
        CACHE_FILE.write_text(json.dumps({"ts": time.time(), "buckets": payload}))
    except OSError as exc:
        log.warning("cache write failed: %s", exc)


def load_cache(max_age: int = CACHE_TTL_SECONDS * 8) -> dict[str, list[RelayNode]] | None:
    try:
        data = json.loads(CACHE_FILE.read_text())
        if time.time() - data["ts"] > max_age:
            return None
        return {c: [RelayNode(**n) for n in ns] for c, ns in data["buckets"].items()}
    except (OSError, ValueError, KeyError, TypeError):
        return None


def refresh_region_map() -> dict[str, list[RelayNode]]:
    """Full pipeline: fetch -> parse -> filter -> cache. Cached fallback."""
    try:
        buckets = filter_target_regions(parse_index(fetch_index()))
        save_cache(buckets)
        return buckets
    except Exception as exc:  # network offline, index down, DNS blocked...
        log.error("index fetch failed (%s); falling back to disk cache", exc)
        cached = load_cache()
        if cached:
            return cached
        raise
