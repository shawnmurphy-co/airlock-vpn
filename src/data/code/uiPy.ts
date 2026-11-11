export const UI_PY = `"""
ui.py — PySide6 dark GUI: one-button connect, 12-region picker with
live latency, throughput readouts, kill-switch & DNS toggles, log pane
and manual .ovpn / .conf import fallback.

Layout:
    ┌────────────── AIRLOCK VPN ──────────────┐
    │            ( connect ring )             │
    │            STATUS · ip · node           │
    │   region combo ............  24 ms      │
    │   ↓ 82.4 Mbps   ↑ 21.0 Mbps   00:04:12  │
    │   [x] Kill switch   [x] DNS leak guard  │
    │   ---- rolling log console ----         │
    └──────────────────────────────────────────┘
"""

from __future__ import annotations

import time
from pathlib import Path

from PySide6.QtCore import Qt, QThread, QTimer, Signal, Slot, QRectF, QPointF
from PySide6.QtGui import QColor, QFont, QPainter, QPen, QAction, QConicalGradient
from PySide6.QtWidgets import (
    QApplication, QCheckBox, QComboBox, QFileDialog, QHBoxLayout, QLabel,
    QMainWindow, QMessageBox, QPlainTextEdit, QPushButton, QVBoxLayout, QWidget,
)

from server_fetcher import (
    TARGET_REGIONS, refresh_region_map, probe_best, write_profile, RelayNode,
)
from vpn_engine import VpnEngine, State, check_tun_device

APP_DIR = Path.home() / ".airlock"

QSS = """
* { font-family: 'Inter', 'Segoe UI', sans-serif; }
QMainWindow, QWidget { background: #0b0f11; color: #e8f1ee; }
QLabel#brand { font-size: 11px; letter-spacing: 4px; color: #4b6258; }
QLabel#status { font-size: 13px; letter-spacing: 2px; font-weight: 600; }
QLabel#sub { color: #6d7f78; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
QLabel.stat-l { color: #4b6258; font-size: 10px; letter-spacing: 2px; }
QLabel.stat-v { font-size: 17px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
QComboBox {
    background: #10171a; border: 1px solid #1e2b27; border-radius: 8px;
    padding: 10px 14px; font-size: 13px; font-family: 'JetBrains Mono', monospace;
}
QComboBox:hover { border-color: #2e443c; }
QComboBox QAbstractItemView {
    background: #10171a; border: 1px solid #1e2b27; color: #e8f1ee;
    selection-background-color: #173126; outline: 0;
}
QCheckBox { color: #8ca39b; spacing: 8px; font-size: 12px; }
QCheckBox::indicator { width: 34px; height: 18px; border-radius: 9px;
    background: #16211e; border: 1px solid #22322e; }
QCheckBox::indicator:checked { background: #143b2c; border-color: #3ce8a5; }
QPlainTextEdit {
    background: #070b0c; border: 1px solid #16211e; border-radius: 8px;
    color: #5fae8c; font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
}
QPushButton#import {
    background: transparent; border: 1px dashed #22322e; border-radius: 8px;
    color: #6d7f78; padding: 8px; font-size: 11px;
}
QPushButton#import:hover { color: #3ce8a5; border-color: #3ce8a5; }
"""

STATE_COLORS = {
    State.DISCONNECTED: "#33413c",
    State.RESOLVING: "#ffc86b",
    State.CONNECTING: "#ffc86b",
    State.CONNECTED: "#3ce8a5",
    State.RECONNECTING: "#ffc86b",
    State.DISCONNECTING: "#ff8d5d",
    State.ERROR: "#ff5d6c",
}


class ConnectRing(QPushButton):
    """The big central button — a painted state ring."""

    def __init__(self) -> None:
        super().__init__("CONNECT")
        self.setFixedSize(196, 196)
        self.setCursor(Qt.PointingHandCursor)
        self.state = State.DISCONNECTED
        self._angle = 0
        self._anim = QTimer(self, timeout=self._tick, interval=28)

    def set_state(self, state: State) -> None:
        self.state = state
        busy = state in (State.CONNECTING, State.RESOLVING,
                         State.RECONNECTING, State.DISCONNECTING)
        self._anim.start() if busy else self._anim.stop()
        self.setText({State.DISCONNECTED: "CONNECT",
                      State.CONNECTED: "DISCONNECT"}.get(state, ""))
        self.update()

    def _tick(self) -> None:
        self._angle = (self._angle + 6) % 360
        self.update()

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        side = min(self.width(), self.height()) - 18
        rect = QRectF((self.width() - side) / 2, (self.height() - side) / 2,
                      side, side)
        color = QColor(STATE_COLORS[self.state])

        pen = QPen(QColor("#1a2622"), 3)
        pen.setCapStyle(Qt.RoundCap)
        p.setPen(pen)
        p.drawEllipse(rect.adjusted(6, 6, -6, -6))

        if self.state in (State.CONNECTING, State.RESOLVING,
                          State.RECONNECTING, State.DISCONNECTING):
            grad = QConicalGradient(rect.center(), -self._angle)
            grad.setColorAt(0, QColor(60, 232, 165, 230))
            grad.setColorAt(0.4, QColor(60, 232, 165, 0))
            grad.setColorAt(1, QColor(60, 232, 165, 0))
            p.setPen(QPen(QColor(grad.stops()[0][1]), 5, cap=Qt.RoundCap))
            p.drawArc(rect.adjusted(2, 2, -2, -2), -self._angle * 16, 110 * 16)
        else:
            pen = QPen(color, 5)
            pen.setCapStyle(Qt.RoundCap)
            p.setPen(pen)
            p.drawArc(rect.adjusted(2, 2, -2, -2), 0, 360 * 16)

        p.setPen(QColor("#e8f1ee") if self.text() else color)
        p.setFont(QFont("Space Grotesk", 12, QFont.DemiBold))
        p.drawText(rect, Qt.AlignCenter, self.text() or "")
        p.end()


class FetchWorker(QThread):
    """Background: fetch index, filter the 12 regions, probe per region."""

    done = Signal(dict)                 # {code: best RelayNode}
    failed = Signal(str)

    def run(self) -> None:
        try:
            buckets = refresh_region_map()
            best = {c: probe_best(ns) for c, ns in buckets.items()}
            self.done.emit({c: n for c, n in best.items() if n})
        except Exception as exc:
            self.failed.emit(str(exc))


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Airlock VPN")
        self.setFixedSize(430, 780)
        self.setStyleSheet(QSS)

        self.region_nodes: dict[str, RelayNode] = {}
        self.kill_armed = True
        self.session_start: float | None = None
        self.engine: VpnEngine | None = None

        self._build()
        self._boot()

    # ------------------------------------------------------------------ UI
    def _build(self) -> None:
        root, lay = QWidget(), QVBoxLayout()
        lay.setContentsMargins(26, 20, 26, 18)
        lay.setSpacing(12)
        root.setLayout(lay)
        self.setCentralWidget(root)

        brand = QLabel("A I R L O C K")
        brand.setObjectName("brand")
        brand.setAlignment(Qt.AlignCenter)
        lay.addWidget(brand)

        self.ring = ConnectRing()
        self.ring.clicked.connect(self.on_connect_clicked)
        lay.addWidget(self.ring, alignment=Qt.AlignCenter)

        self.lbl_status = QLabel("DISCONNECTED")
        self.lbl_status.setObjectName("status")
        self.lbl_status.setAlignment(Qt.AlignCenter)
        self.lbl_sub = QLabel("no tunnel")
        self.lbl_sub.setObjectName("sub")
        self.lbl_sub.setAlignment(Qt.AlignCenter)
        lay.addWidget(self.lbl_status)
        lay.addWidget(self.lbl_sub)

        self.combo = QComboBox()
        self.combo.setPlaceholderText("fetching public relays…")
        lay.addWidget(self.combo)

        stats = QHBoxLayout()
        self.l_down, self.l_up, self.l_time = self._stat(stats, "DOWNLOAD", "0.0 Mbps"), \\
            self._stat(stats, "UPLOAD", "0.0 Mbps"), self._stat(stats, "SESSION", "00:00:00")
        lay.addLayout(stats)

        toggles = QHBoxLayout()
        self.chk_kill = QCheckBox("Kill switch")
        self.chk_kill.setChecked(True)
        self.chk_dns = QCheckBox("DNS leak guard")
        self.chk_dns.setChecked(True)
        self.chk_dns.setEnabled(False)  # always-on policy in 1.x
        toggles.addWidget(self.chk_kill)
        toggles.addStretch(1)
        toggles.addWidget(self.chk_dns)
        lay.addLayout(toggles)

        self.log = QPlainTextEdit(readOnly=True, maximumBlockCount=400)
        lay.addWidget(self.log, stretch=1)

        btn_import = QPushButton("Import custom .ovpn / .conf profile")
        btn_import.setObjectName("import")
        btn_import.clicked.connect(self.on_import)
        lay.addWidget(btn_import)

        self.timer = QTimer(self, timeout=self._tick_session, interval=1000)

    def _stat(self, box: QHBoxLayout, label: str, init: str) -> QLabel:
        wrap, v = QVBoxLayout(), QLabel(init)
        l = QLabel(label)
        l.setObjectName("stat-l")
        v.setObjectName("stat-v")
        wrap.addWidget(l)
        wrap.addWidget(v)
        box.addLayout(wrap)
        box.addStretch(1)
        return v

    # -------------------------------------------------------------- startup
    def _boot(self) -> None:
        if not check_tun_device():
            QMessageBox.warning(
                self, "TUN/TAP driver missing",
                "No tun adapter found. Install OpenVPN + TAP-Windows6 / Wintun "
                "(Windows) or the openvpn package (brew/apt).",
            )
        self._log("airlock core booting — fetching vpngate.net index")
        self.fetcher = FetchWorker()
        self.fetcher.done.connect(self._on_regions)
        self.fetcher.failed.connect(
            lambda e: self._log(f"index fetch failed: {e} (import a profile instead)")
        )
        self.fetcher.start()

    # -------------------------------------------------------------- actions
    @Slot(dict)
    def _on_regions(self, best: dict[str, RelayNode]) -> None:
        self.region_nodes = best
        self.combo.clear()
        for code in TARGET_REGIONS:
            node = best.get(code)
            if node:
                ms = node.effective_ping
                self.combo.addItem(
                    f"{code}  {TARGET_REGIONS[code]:<15} {ms:6.0f} ms", userData=code
                )
            else:
                self.combo.addItem(f"{code}  {TARGET_REGIONS[code]:<15}  no relay")
        self._log(f"index parsed — {len(best)} regions have live relays")

    def on_connect_clicked(self) -> None:
        if self.engine and self.engine.tunnel and self.engine.tunnel.state in (
            State.CONNECTED, State.CONNECTING, State.RESOLVING, State.RECONNECTING,
        ):
            self._log("user requested disconnect")
            self.engine.disconnect()
            return

        code = self.combo.currentData()
        node = self.region_nodes.get(code) if code else self.custom_node
        if not node:
            self._log("no relay selected — import a profile first")
            return
        try:
            profile = write_profile(node, APP_DIR)
            self.engine = VpnEngine(self._on_state, self._on_stats, self._log)
            self.engine.kill_switch_enabled = self.chk_kill.isChecked()
            self.engine.connect(profile, node.ip)
            self._log(f"spawning openvpn → {node.host_name} ({node.ip})")
        except Exception as exc:
            QMessageBox.critical(self, "Tunnel error", str(exc))

    def on_import(self) -> None:
        """Static configuration fallback: user-supplied .ovpn / .conf."""
        path, _ = QFileDialog.getOpenFileName(
            self, "Import profile", str(Path.home()),
            "VPN profiles (*.ovpn *.conf)",
        )
        if not path:
            return
        src = Path(path)
        dst = APP_DIR / "custom_profiles" / src.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        self.custom_profile = dst
        self.custom_node = RelayNode(  # synthesize a node for custom profiles
            host_name=src.stem, ip=self._resolve_remote(src) or "custom",
            score=0, ping_ms=0, speed_bps=0, country_long="Custom",
            country_short="--", sessions=0, uptime_s=0, config_b64="",
        )
        self.combo.insertItem(0, f"★ custom  {src.stem}", userData="__custom__")
        self.combo.setCurrentIndex(0)
        self._log(f"imported {src.name}")

    @staticmethod
    def _resolve_remote(path: Path) -> str | None:
        for line in path.read_text(errors="replace").splitlines():
            parts = line.split()
            if parts[:1] == ["remote"] and len(parts) > 1:
                return parts[1]
        return None

    # ------------------------------------------------------------ signals
    @Slot(State)
    def _on_state(self, state: State) -> None:
        self.ring.set_state(state)
        color = STATE_COLORS[state]
        self.lbl_status.setText(state.value)
        self.lbl_status.setStyleSheet(f"color: {color};")
        if state is State.CONNECTED:
            self.session_start = time.monotonic()
            self.timer.start()
            node = self._current_node()
            if node:
                self.lbl_sub.setText(f"{node.ip} · {node.host_name}")
        if state in (State.DISCONNECTED, State.ERROR):
            self.timer.stop()
            self.l_time.setText("00:00:00")
            self.l_down.setText("0.0 Mbps")
            self.l_up.setText("0.0 Mbps")
            self.lbl_sub.setText("no tunnel" if state is State.DISCONNECTED
                                 else "tunnel error — see log")

    def _on_stats(self, stats) -> None:
        self.l_down.setText(f"{stats.down_bps / 1e6:5.1f} Mbps")
        self.l_up.setText(f"{stats.up_bps / 1e6:5.1f} Mbps")

    def _tick_session(self) -> None:
        if self.session_start:
            sec = int(time.monotonic() - self.session_start)
            self.l_time.setText(time.strftime("%H:%M:%S", time.gmtime(sec)))

    def _current_node(self) -> RelayNode | None:
        code = self.combo.currentData()
        if code == "__custom__":
            return getattr(self, "custom_node", None)
        return self.region_nodes.get(code)

    @Slot(str)
    def _log(self, line: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.log.appendPlainText(f"[{stamp}] {line}")

    def closeEvent(self, event) -> None:
        if self.engine:
            self.engine.disconnect()     # kill switch swept, DNS restored
        super().closeEvent(event)
`;
