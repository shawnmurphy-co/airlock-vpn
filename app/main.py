"""
main.py — Airlock VPN application entrypoint.

Free, ad-free, open-source one-click VPN client.
Twelve regions. One button. No accounts, no telemetry, no ads.
"""

from __future__ import annotations

import argparse
import ctypes
import logging
import os
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from ui import MainWindow

APP_NAME = "Airlock VPN"
APP_VERSION = "1.0.0"
MIN_PYTHON = (3, 10)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)


def is_elevated() -> bool:
    """True when running with administrator / root privileges."""
    if os.name == "nt":
        try:
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except OSError:
            return False
    return os.geteuid() == 0


def relaunch_elevated() -> None:
    """
    OpenVPN needs to create routes and manage the tun adapter, which
    requires elevation. Re-exec ourselves:
      Windows → UAC prompt via ShellExecute 'runas'
      macOS / Linux → sudo -E (graphical polkit prompt left to the user)
    """
    if os.name == "nt":
        params = " ".join(f'"{a}"' for a in sys.argv)
        ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, params, None, 1
        )
    else:
        os.execvp("sudo", ["sudo", "-E", sys.executable, *sys.argv])


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="airlock", description=__doc__)
    p.add_argument("--no-elevate", action="store_true",
                   help="skip the administrator relaunch (dev only)")
    p.add_argument("--version", action="store_true", help="print version and exit")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.version:
        print(f"{APP_NAME} {APP_VERSION}")
        return 0
    if sys.version_info < MIN_PYTHON:
        print(f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ required")
        return 1
    if not is_elevated() and not args.no_elevate:
        relaunch_elevated()
        return 0

    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName("airlock")

    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
