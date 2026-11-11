import { MAIN_PY } from "./mainPy";
import { SERVER_FETCHER_PY } from "./serverFetcher";
import { VPN_ENGINE_PY } from "./vpnEngine";
import { UI_PY } from "./uiPy";

export interface SourceFile {
  name: string;
  lang: string;
  role: string;
  loc: string;
  code: string;
}

export const REQUIREMENTS_TXT = `PySide6>=6.6.0
psutil>=5.9.0
`;

export const README_MD = `# Airlock VPN

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
`;

export const SOURCE_FILES: SourceFile[] = [
  { name: "main.py", lang: "python", role: "App entrypoint & privilege escalation", loc: "~90 lines", code: MAIN_PY },
  { name: "server_fetcher.py", lang: "python", role: "Free infrastructure engine — VPN Gate CSV API", loc: "~230 lines", code: SERVER_FETCHER_PY },
  { name: "vpn_engine.py", lang: "python", role: "OpenVPN lifecycle · kill switch · DNS guard", loc: "~420 lines", code: VPN_ENGINE_PY },
  { name: "ui.py", lang: "python", role: "PySide6 dark GUI & event bindings", loc: "~330 lines", code: UI_PY },
  { name: "requirements.txt", lang: "text", role: "Pinned runtime dependencies", loc: "2 lines", code: REQUIREMENTS_TXT },
  { name: "README.md", lang: "text", role: "Project overview & usage", loc: "~20 lines", code: README_MD },
];

export const downloadOne = (name: string, content: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadZip = async () => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const root = zip.folder("airlock-vpn")!;
  SOURCE_FILES.forEach((f) => root.file(f.name, f.code));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "airlock-vpn-source.zip";
  a.click();
  URL.revokeObjectURL(url);
};
