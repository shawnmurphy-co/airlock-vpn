# Airlock VPN

A 100% free, ad-free, open-source one-click VPN client for
Windows / macOS / Linux. Twelve target regions powered by the
public VPN Gate relay network, wrapped around the OpenVPN core
with a firewall kill switch and DNS leak prevention.

## Layout
    main.py            entrypoint, elevation, QApplication
    server_fetcher.py  VPN Gate CSV API fetch/parse/filter/probe
    vpn_engine.py      openvpn process lifecycle, kill switch, DNS guard
    ui.py              PySide6 dark GUI

## Run from source
    pip install -r requirements.txt
    python main.py            # relaunches itself elevated

## License
MIT. Relay list courtesy of the VPN Gate Academic Experiment,
University of Tsukuba. Respect local law and relay operators.
