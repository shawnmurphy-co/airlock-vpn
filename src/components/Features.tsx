import { motion } from "framer-motion";
import {
  ShieldCheck, Globe2, Terminal, Radar, FileUp, HeartHandshake,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Firewall Kill Switch",
    tag: "vpn_engine.py › KillSwitch",
    body: "If the tunnel drops, a namespaced firewall policy slams shut in under a second: loopback, the tun interface and the relay IP pass — everything else is dropped. iptables on Linux, pf anchors on macOS, NetFirewall rules on Windows.",
  },
  {
    icon: Globe2,
    title: "DNS Leak Prevention",
    tag: "vpn_engine.py › DNSGuard",
    body: "System resolvers are pinned to 1.1.1.1 and 8.8.8.8 while the session is live, then restored on exit. No ISP resolver ever sees a query. resolvectl, networksetup and netsh adapters ship per-OS.",
  },
  {
    icon: Terminal,
    title: "Managed OpenVPN Core",
    tag: "vpn_engine.py › TunnelProcess",
    body: "The real openvpn binary is spawned elevated with a management socket for graceful SIGTERM control. State events are parsed from the live log stream and surfaced to the UI as they happen.",
  },
  {
    icon: Radar,
    title: "Free Infrastructure Engine",
    tag: "server_fetcher.py",
    body: "No rented VPS fleet. The client pulls the public VPN Gate index (thousands of volunteer relays), filters it to exactly your 12 regions, probes TCP latency per region and ranks the fastest live node.",
  },
  {
    icon: FileUp,
    title: "Static Config Fallback",
    tag: "ui.py › on_import()",
    body: "Any public node unreachable? Import your own .ovpn or .conf profile from disk. The engine synthesizes a relay entry, spawns the same managed core, and the kill switch still covers you.",
  },
  {
    icon: HeartHandshake,
    title: "Zero Cost, Zero Ads",
    tag: "philosophy",
    body: "No accounts, no paywall, no trackers, no analytics SDKs, no upsells. MIT-licensed Python you can read end-to-end. The network is a public academic experiment — ride it respectfully.",
  },
];

export default function Features() {
  return (
    <section id="security" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mb-12 md:mb-16"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="font-mono text-[11px] text-mint tracking-[0.25em]">02</span>
            <span className="h-px w-10 bg-edge2" />
            <span className="font-mono text-[11px] text-faint tracking-[0.25em] uppercase">
              Security model
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.05] max-w-3xl">
            Paranoia, shipped as defaults.
          </h2>
          <p className="mt-5 max-w-xl text-dim leading-relaxed text-[15px]">
            Every control in the spec is real code, mapped one-to-one to the module and
            class that implements it. Click through the source below and audit it yourself.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08 }}
              className="group relative rounded-2xl border border-edge bg-panel p-7 overflow-hidden hover:border-mint/30 transition-colors duration-300"
            >
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-mint/0 blur-3xl group-hover:bg-mint/10 transition-colors duration-500" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl border border-edge2 bg-panel2 grid place-items-center mb-6 group-hover:border-mint/50 transition-colors">
                  <f.icon size={18} className="text-mint" strokeWidth={1.9} />
                </div>
                <h3 className="text-lg font-medium mb-1">{f.title}</h3>
                <div className="font-mono text-[10px] text-faint tracking-[0.12em] mb-4">
                  {f.tag}
                </div>
                <p className="text-dim text-[13.5px] leading-relaxed">{f.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
