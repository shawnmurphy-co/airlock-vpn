# Using Airlock relays on your phone

The Airlock desktop app (PySide6) runs on Windows, macOS and Linux only.
On iPhone and Android, use the official **OpenVPN Connect** app with the
same free VPN Gate relays. Airlock's `server_fetcher.py` finds them and
`export_ovpn.py` converts them into profiles your phone can import.

## 1. Export profiles (on any computer with Python 3.10+)

    pip install -r requirements.txt
    python export_ovpn.py            # all 12 regions
    python export_ovpn.py JP GB      # only Japan and UK

This creates a `phone_profiles/` folder with one `.ovpn` file per region.

## 2. Install OpenVPN Connect on your phone

- iPhone: App Store → search "OpenVPN Connect" (by OpenVPN Inc.)
- Android: Google Play → search "OpenVPN Connect" (by OpenVPN Inc.)

## 3. Import a profile

1. Move the `.ovpn` file to your phone (AirDrop, Google Drive, email to yourself, or USB).
2. Open it with OpenVPN Connect (iPhone: tap the file → Share → OpenVPN Connect;
   Android: tap the file → Open with OpenVPN Connect).
3. Tap **Add** to import the profile.
4. When asked for credentials, enter **username `vpn`** and **password `vpn`**.
5. Tap the toggle to connect. Your IP changes to the relay's country.

## 4. Turn on a kill switch (recommended)

- Android: Settings → Network & internet → VPN → gear icon next to OpenVPN Connect
  → turn on **Always-on VPN** and **Block connections without VPN**.
- iPhone: iOS has no built-in per-app kill switch for third-party VPNs. Use
  OpenVPN Connect's connection status to confirm the tunnel is up before
  sensitive use, and enable **Connect on demand** in the profile settings if shown.

## Notes

- Public relays are volunteer-run. If one is slow or offline, re-run
  `export_ovpn.py` to get the current fastest node for that region.
- Profiles expire as relays go offline. Re-export when a connection fails.
- Verify the tunnel by opening a "what is my IP" site: the country should match the region you chose.
- Public relays can see your traffic destinations. Use HTTPS everywhere.
