"""
export_ovpn.py — export ready-to-import .ovpn profiles for phones.

Use this to get profiles for the official OpenVPN Connect app
(iOS / Android / Windows / macOS). Writes one .ovpn file per target
region into ./phone_profiles/ using the live VPN Gate index.

Usage:
    python export_ovpn.py            # all 12 regions
    python export_ovpn.py JP DE      # only the regions you list
"""

import sys
from pathlib import Path

from server_fetcher import TARGET_REGIONS, refresh_region_map, probe_best, build_ovpn_config


def main(codes: list[str]) -> int:
    wanted = [c.upper() for c in codes] or list(TARGET_REGIONS)
    unknown = [c for c in wanted if c not in TARGET_REGIONS]
    if unknown:
        print(f"Unknown region code(s): {', '.join(unknown)}")
        print(f"Valid codes: {', '.join(TARGET_REGIONS)}")
        return 1

    out_dir = Path("phone_profiles")
    out_dir.mkdir(exist_ok=True)

    print("Fetching live VPN Gate index...")
    buckets = refresh_region_map()

    written = 0
    for code in wanted:
        node = probe_best(buckets.get(code, []))
        if node is None:
            print(f"  {code}  {TARGET_REGIONS[code]:<15} no live relay right now")
            continue
        cfg = build_ovpn_config(node)
        path = out_dir / f"{code}-{TARGET_REGIONS[code].replace(' ', '')}-{node.ip.replace('.', '-')}.ovpn"
        path.write_text(cfg, encoding="utf-8")
        written += 1
        print(f"  {code}  {TARGET_REGIONS[code]:<15} {node.effective_ping:6.0f} ms  -> {path.name}")

    print(f"\nDone: {written} profile(s) in ./{out_dir}/")
    print("Login when prompted: username = vpn   password = vpn")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
