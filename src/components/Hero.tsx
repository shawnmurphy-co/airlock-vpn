import { motion } from "framer-motion";
import { ArrowDown, Play, ShieldCheck, Globe2, EyeOff, Coins } from "lucide-react";
import ParticleField from "./ParticleField";
import { REGIONS } from "../data/regions";

const fadeUp = {
  initial: { opacity: 0, y: 34 },
  animate: { opacity: 1, y: 0 },
};

const STATS = [
  { icon: Globe2, value: "12", label: "Locked regions" },
  { icon: ShieldCheck, value: "AES-256", label: "OpenVPN core" },
  { icon: EyeOff, value: "0", label: "Logs · ads · trackers" },
  { icon: Coins, value: "$0", label: "Forever" },
];

function MarqueeRow() {
  const items = [...REGIONS, ...REGIONS];
  return (
    <div className="relative border-y border-edge bg-panel/60 overflow-hidden">
      <div className="animate-marquee flex w-max items-center">
        {items.map((r, i) => (
          <span
            key={`${r.code}-${i}`}
            className="flex items-center gap-3 px-7 py-3.5 font-mono text-[11px] tracking-[0.22em] text-dim whitespace-nowrap"
          >
            <span className="w-7 h-5 grid place-items-center rounded-[3px] border border-edge2 bg-panel2 text-[9px] text-mint">
              {r.code}
            </span>
            {r.name.toUpperCase()}
            <span className="text-edge2">·</span>
            <span className="text-faint">{r.nodeCount} RELAYS</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-void to-transparent" />
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative grain">
      <ParticleField className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(60,232,165,0.09),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-void" />

      <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-40 pb-28 md:pt-48 md:pb-32">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 mb-8"
        >
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.28em] text-mint border border-mint/25 bg-mint/5 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mint pulse-ring" />
            OPEN SOURCE · FREE FOREVER · NO ADS
          </span>
        </motion.div>

        <h1 className="max-w-5xl font-medium tracking-[-0.03em] leading-[0.98] text-[13vw] sm:text-6xl md:text-7xl lg:text-[86px]">
          <motion.span {...fadeUp} transition={{ duration: 0.7, delay: 0.08 }} className="block">
            Twelve borders.
          </motion.span>
          <motion.span
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="block text-transparent bg-clip-text bg-gradient-to-r from-mint via-mint-soft to-mint"
          >
            One button. Zero cost.
          </motion.span>
        </h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-8 max-w-xl text-dim text-[15px] md:text-lg leading-relaxed"
        >
          Airlock is a 100% free, ad-free, open-source VPN client for desktop.
          It rides the public VPN Gate relay network through a hardened OpenVPN
          core — with a firewall kill switch and DNS leak guard, no accounts,
          and no telemetry. Ever.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.42 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="#demo"
            className="group flex items-center gap-3 bg-mint text-void font-mono text-[12px] font-semibold tracking-[0.18em] uppercase rounded-full px-7 py-4 hover:bg-mint-soft transition-colors"
          >
            <Play size={14} className="fill-void" />
            Launch live demo
          </a>
          <a
            href="#source"
            className="group flex items-center gap-3 border border-edge2 text-dim hover:text-mint hover:border-mint/60 font-mono text-[12px] tracking-[0.18em] uppercase rounded-full px-7 py-4 transition-colors"
          >
            Get the source
            <ArrowDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
          </a>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-px bg-edge border border-edge rounded-2xl overflow-hidden"
        >
          {STATS.map((s) => (
            <div key={s.label} className="bg-panel px-6 py-6 flex items-start gap-4">
              <s.icon size={17} className="text-mint mt-1 shrink-0" strokeWidth={1.8} />
              <div>
                <div className="font-mono text-xl md:text-2xl font-semibold text-ink leading-none">
                  {s.value}
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-faint">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <MarqueeRow />
    </section>
  );
}
