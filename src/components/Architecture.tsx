import { motion } from "framer-motion";
import { Folder, FileCode2, ArrowRight, Cpu, Network, MousePointerClick, Terminal } from "lucide-react";
import SectionHeading from "./SectionHeading";

const TREE = [
  { depth: 0, name: "airlock-vpn/", dir: true },
  { depth: 1, name: "main.py", note: "entrypoint · elevation via UAC / sudo · QApplication" },
  { depth: 1, name: "server_fetcher.py", note: "VPN Gate CSV API → parse → 12-region filter → TCP probe" },
  { depth: 1, name: "vpn_engine.py", note: "openvpn lifecycle · KillSwitch · DNSGuard · ThroughputMonitor" },
  { depth: 1, name: "ui.py", note: "PySide6 dark GUI · ConnectRing · stats · log console" },
  { depth: 1, name: "requirements.txt", note: "PySide6, psutil" },
  { depth: 1, name: "README.md", note: "setup & build guide" },
];

const FLOW = [
  { icon: MousePointerClick, title: "ui.py", sub: "PySide6 Qt signals" },
  { icon: Cpu, title: "vpn_engine.py", sub: "state machine + firewall" },
  { icon: Terminal, title: "openvpn core", sub: "managed subprocess" },
  { icon: Network, title: "public relay", sub: "VPN Gate · UDP/TCP" },
];

export default function Architecture() {
  return (
    <section id="architecture" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHeading
          index="03"
          eyebrow="Code architecture"
          title="Four modules. Nothing to hide."
          body="A strict one-way dependency chain keeps the codebase auditable: the GUI never touches sockets, the engine never touches widgets, and the fetcher never touches the firewall."
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* file tree */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7 }}
            className="rounded-2xl border border-edge bg-panel overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-edge">
              <Folder size={13} className="text-mint" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-faint uppercase">
                Repository layout
              </span>
            </div>
            <div className="p-5 font-mono text-[12.5px] leading-[2.3]">
              {TREE.map((row) => (
                <div
                  key={row.name}
                  className="flex items-baseline gap-3 hover:bg-white/[0.02] rounded px-2 -mx-2 transition-colors"
                  style={{ paddingLeft: row.depth * 22 + 8 }}
                >
                  {row.dir ? (
                    <Folder size={13} className="text-mint translate-y-0.5 shrink-0" />
                  ) : (
                    <FileCode2 size={13} className="text-faint translate-y-0.5 shrink-0" />
                  )}
                  <span className={row.dir ? "text-mint" : "text-ink"}>{row.name}</span>
                  {row.note && (
                    <span className="hidden md:inline text-[10.5px] text-faint truncate">
                      {row.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* runtime flow */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <div className="rounded-2xl border border-edge bg-panel overflow-hidden flex-1">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-edge">
                <Network size={13} className="text-mint" />
                <span className="font-mono text-[10px] tracking-[0.25em] text-faint uppercase">
                  Runtime path of one click
                </span>
              </div>
              <div className="p-6">
                {FLOW.map((f, i) => (
                  <div key={f.title} className="flex items-stretch gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl border border-edge2 bg-panel2 grid place-items-center shrink-0">
                        <f.icon size={16} className="text-mint" strokeWidth={1.9} />
                      </div>
                      {i < FLOW.length - 1 && (
                        <div className="w-px flex-1 bg-gradient-to-b from-edge2 to-transparent my-1" />
                      )}
                    </div>
                    <div className="pb-7">
                      <div className="font-mono text-[13px] text-ink">{f.title}</div>
                      <div className="text-[12px] text-dim mt-1">{f.sub}</div>
                      <div className="text-[12px] text-faint mt-1.5 leading-relaxed">
                        {i === 0 && "ConnectRing.clicked → engine.connect(profile, relay_ip)"}
                        {i === 1 && "KillSwitch.enable() → DNSGuard.apply() → TunnelProcess.start()"}
                        {i === 2 && "--management 127.0.0.1:7505 · AES-256-GCM · verb 3 stream"}
                        {i === 3 && "udp4 relay chosen by latency probe · keepalive 10/60"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <a
              href="#source"
              className="group flex items-center justify-between rounded-2xl border border-mint/25 bg-mint/5 px-7 py-5 hover:bg-mint/10 transition-colors"
            >
              <div>
                <div className="font-medium text-[15px]">Read every line</div>
                <div className="text-dim text-[12.5px] mt-0.5">
                  The complete source is embedded below — copy or download.
                </div>
              </div>
              <ArrowRight size={18} className="text-mint group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
