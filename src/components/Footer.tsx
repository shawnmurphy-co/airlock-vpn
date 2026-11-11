import { LockKeyhole, Scale, EyeOff, ServerOff } from "lucide-react";
import { REGIONS } from "../data/regions";

export default function Footer() {
  return (
    <footer className="relative border-t border-edge">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-12">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-8 h-8 rounded-lg border border-edge2 bg-panel grid place-items-center">
                <LockKeyhole size={15} className="text-mint" strokeWidth={2.2} />
              </span>
              <span className="font-mono text-[13px] tracking-[0.3em]">
                AIRLOCK<span className="text-mint">.</span>VPN
              </span>
            </div>
            <p className="text-dim text-[13px] leading-relaxed max-w-sm">
              A 100% free, ad-free, open-source VPN client built on the OpenVPN core
              and the public VPN Gate relay network. No accounts, no telemetry, no
              tracking SDKs — the code above is everything it runs.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: Scale, t: "MIT License" },
                { icon: EyeOff, t: "Zero telemetry" },
                { icon: ServerOff, t: "No rented servers" },
              ].map((b) => (
                <span
                  key={b.t}
                  className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-faint border border-edge rounded-full px-3 py-1.5"
                >
                  <b.icon size={11} className="text-mint" />
                  {b.t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-faint mb-5">
              Coverage
            </div>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map((r) => (
                <span key={r.code} className="font-mono text-[11px] text-dim">
                  <span className="text-mint">{r.code}</span> · {r.name.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-faint mb-5">
              Honest fine print
            </div>
            <ul className="space-y-3 text-[12.5px] text-dim leading-relaxed">
              <li>
                Public relays are volunteer-run. Expect variable throughput and the
                occasional dead node — the fetcher re-ranks on every launch.
              </li>
              <li>
                The browser demo above simulates the desktop state machine; it does
                not route your traffic. Install the real client for that.
              </li>
              <li>Respect relay operators and the law of your jurisdiction.</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-7 border-t border-edge flex flex-wrap gap-4 items-center justify-between">
          <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-faint">
            © {new Date().getFullYear()} Airlock VPN contributors
          </span>
          <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-faint">
            Relay index · VPN Gate Academic Experiment, University of Tsukuba
          </span>
        </div>
      </div>
    </footer>
  );
}
