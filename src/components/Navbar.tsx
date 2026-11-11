import { useEffect, useState } from "react";
import { Code2, LockKeyhole } from "lucide-react";

const LINKS = [
  { label: "The App", href: "#demo" },
  { label: "Security", href: "#security" },
  { label: "Architecture", href: "#architecture" },
  { label: "Source", href: "#source" },
  { label: "Install", href: "#install" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-void/80 backdrop-blur-xl border-b border-edge"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="w-8 h-8 rounded-lg border border-edge2 bg-panel grid place-items-center group-hover:border-mint/60 transition-colors">
            <LockKeyhole size={15} className="text-mint" strokeWidth={2.2} />
          </span>
          <span className="font-mono text-[13px] tracking-[0.3em] text-ink">
            AIRLOCK<span className="text-mint">.</span>VPN
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-dim hover:text-mint transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href="#source"
          className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase border border-edge2 hover:border-mint/70 hover:text-mint text-dim rounded-full px-4 py-2 transition-colors"
        >
          <Code2 size={13} />
          <span className="hidden sm:inline">Source</span>
        </a>
      </div>
    </header>
  );
}
