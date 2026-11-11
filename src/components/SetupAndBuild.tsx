import { useState } from "react";
import { motion } from "framer-motion";
import { AppWindow, Apple, Terminal, Hammer, Binary, FileCheck2 } from "lucide-react";
import SectionHeading from "./SectionHeading";

interface Step {
  i: string;
  title: string;
  cmd?: string;
  note?: string;
}

const PLATFORMS = [
  {
    id: "win",
    name: "Windows",
    icon: AppWindow,
    prereq: "Windows 10/11 · admin rights required for routing + firewall",
    steps: [
      { i: "01", title: "Install Python 3.10+", cmd: "winget install Python.Python.3.12", note: "tick 'Add python.exe to PATH' if installing from python.org" },
      { i: "02", title: "Install the OpenVPN community client", cmd: "winget install OpenVPNTechnologies.OpenVPN", note: "this ships the TAP-Windows6 / Wintun driver the tunnel needs" },
      { i: "03", title: "Install Python dependencies", cmd: "pip install PySide6 psutil" },
      { i: "04", title: "Run the client", cmd: "python main.py", note: "main.py detects missing rights and re-launches itself through a UAC prompt" },
    ] as Step[],
    build: 'pyinstaller --noconsole --onefile --name AirlockVPN --add-binary "C:/Program Files/OpenVPN/bin/openvpn.exe;drivers" main.py',
    buildNote: "--noconsole hides the terminal; --add-binary bundles the openvpn core + TAP driver helpers inside the .exe",
  },
  {
    id: "mac",
    name: "macOS",
    icon: Apple,
    prereq: "macOS 12+ · Homebrew · admin rights for pf anchors + routes",
    steps: [
      { i: "01", title: "Install toolchain", cmd: "brew install python openvpn" },
      { i: "02", title: "Install Python dependencies", cmd: "python3 -m pip install PySide6 psutil" },
      { i: "03", title: "Run the client", cmd: "sudo -E python3 main.py", note: "utun devices are built into macOS — no driver install needed; the kill switch writes a pf anchor at /etc/pf.anchors/airlock" },
    ] as Step[],
    build: "pyinstaller --windowed --onefile --name AirlockVPN main.py",
    buildNote: "sign the .app bundle (codesign) and notarize for Gatekeeper; keep openvpn on PATH via brew or bundle it with --add-binary",
  },
  {
    id: "linux",
    name: "Linux",
    icon: Terminal,
    prereq: "Debian/Ubuntu/Fedora · /dev/net/tun must exist (modprobe tun)",
    steps: [
      { i: "01", title: "Install toolchain", cmd: "sudo apt install openvpn python3-pip python3-venv" },
      { i: "02", title: "Install Python dependencies", cmd: "python3 -m venv .venv && .venv/bin/pip install PySide6 psutil" },
      { i: "03", title: "Run the client", cmd: "sudo .venv/bin/python main.py", note: "kill switch uses a dedicated AIRLOCK_OUT iptables chain; DNS pinned via resolvectl (or /etc/resolv.conf backup + swap)" },
    ] as Step[],
    build: "pyinstaller --onefile --name airlock-vpn main.py",
    buildNote: "ship a .desktop file with pkexec for the privilege prompt, or grant cap_net_admin to the packaged binary",
  },
];

export default function SetupAndBuild() {
  const [tab, setTab] = useState("win");
  const platform = PLATFORMS.find((p) => p.id === tab)!;

  return (
    <section id="install" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHeading
          index="05"
          eyebrow="Setup · from zero to tunnel"
          title="Installed in four commands."
          body="Pick your platform. The only hard requirements are Python 3.10+, the OpenVPN community package (which carries the TUN/TAP driver) and two pip packages."
        />

        {/* platform tabs */}
        <div className="flex gap-2 mb-8">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              className={`flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors ${
                tab === p.id
                  ? "border-mint/60 bg-mint/10 text-mint"
                  : "border-edge2 text-dim hover:text-ink hover:border-faint"
              }`}
            >
              <p.icon size={14} />
              {p.name}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid lg:grid-cols-2 gap-6"
        >
          {/* steps */}
          <div className="rounded-2xl border border-edge bg-panel overflow-hidden">
            <div className="px-6 py-4 border-b border-edge">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-faint">
                Environment — {platform.name}
              </span>
              <p className="mt-1.5 text-[12px] text-dim">{platform.prereq}</p>
            </div>
            <ol className="divide-y divide-edge">
              {platform.steps.map((s) => (
                <li key={s.i} className="px-6 py-5">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[10px] text-mint tracking-widest">{s.i}</span>
                    <div className="flex-1">
                      <div className="text-[14px] font-medium">{s.title}</div>
                      {s.cmd && (
                        <code className="mt-2.5 block font-mono text-[11.5px] text-mint-soft bg-[#060a0b] border border-edge rounded-lg px-3.5 py-2.5 overflow-x-auto code-scroll whitespace-nowrap">
                          <span className="text-faint select-none">$ </span>
                          {s.cmd}
                        </code>
                      )}
                      {s.note && (
                        <p className="mt-2 text-[12px] text-faint leading-relaxed">{s.note}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* build card */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-edge bg-panel overflow-hidden flex-1">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-edge">
                <Hammer size={13} className="text-mint" />
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-faint">
                  Compile to a standalone binary
                </span>
              </div>
              <div className="p-6">
                <code className="block font-mono text-[11.5px] leading-relaxed text-mint-soft bg-[#060a0b] border border-edge rounded-lg px-4 py-4 overflow-x-auto code-scroll whitespace-pre">
                  {platform.build}
                </code>
                <p className="mt-4 text-[12.5px] text-dim leading-relaxed">
                  {platform.buildNote}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[12px] text-dim">
                  <Binary size={13} className="text-mint shrink-0" />
                  Output lands in <code className="font-mono text-ink">dist/</code> as a
                  single double-clickable artifact.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-edge bg-panel p-6">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck2 size={13} className="text-mint" />
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-faint">
                  Pre-flight checklist
                </span>
              </div>
              <ul className="space-y-2.5 text-[12.5px] text-dim">
                {[
                  "TUN/TAP driver detected (check_tun_device() runs at boot)",
                  "openvpn 2.5+ on PATH or in the platform default location",
                  "Outbound HTTP to vpngate.net reachable for the relay index",
                  "Process running elevated — the client self-prompts otherwise",
                ].map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-mint shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
