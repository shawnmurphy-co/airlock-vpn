import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown, FileUp, Globe, Power, ShieldAlert, ShieldCheck,
  ArrowDownToLine, ArrowUpFromLine, Timer, Zap, RefreshCcw,
} from "lucide-react";
import { REGIONS, Region, jitter, fmtDuration, fmtMbps } from "../data/regions";
import SectionHeading from "./SectionHeading";

type SimState = "idle" | "connecting" | "connected" | "dropped";

interface LogLine {
  id: number;
  t: string;
  msg: string;
  tone: "dim" | "ok" | "warn" | "err";
}

const now = () => new Date().toTimeString().slice(0, 8);
let logId = 0;

/* ------------------------------------------------------------------ */
/* bandwidth chart                                                     */
/* ------------------------------------------------------------------ */
function BandwidthChart({ data, max }: { data: number[]; max: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(34,50,46,0.5)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (data.length < 2) return;

    const peak = Math.max(max * 1.15, 12);
    const step = w / (60 - 1);
    const pts = data.map((v, i) => [w - (data.length - 1 - i) * step, h - (v / peak) * (h - 6)] as const);

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(60,232,165,0.28)");
    grad.addColorStop(1, "rgba(60,232,165,0)");
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "#3ce8a5";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // head dot
    const [hx, hy] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#6ff0c0";
    ctx.fill();
  }, [data, max]);

  return <canvas ref={ref} className="w-full h-20" />;
}

/* ------------------------------------------------------------------ */
/* main simulator                                                      */
/* ------------------------------------------------------------------ */
export default function Simulator() {
  const [sim, setSim] = useState<SimState>("idle");
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const [open, setOpen] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>(() =>
    Object.fromEntries(REGIONS.map((r) => [r.code, r.basePing]))
  );
  const [kill, setKill] = useState(true);
  const [leaked, setLeaked] = useState(false);
  const [down, setDown] = useState(0);
  const [up, setUp] = useState(0);
  const [sec, setSec] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([
    { id: logId++, t: now(), msg: "airlock core simulation ready — press connect", tone: "dim" },
  ]);

  const timers = useRef<number[]>([]);
  const samples = useRef<number[]>([]);
  const running = useRef(false);
  const ping = pings[region.code] ?? region.basePing;

  const log = useCallback((msg: string, tone: LogLine["tone"] = "dim") => {
    setLogs((l) => [...l.slice(-60), { id: logId++, t: now(), msg, tone }]);
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
    running.current = false;
  };

  /* live latency refresh while idle */
  useEffect(() => {
    const id = window.setInterval(() => {
      setPings(Object.fromEntries(REGIONS.map((r) => [r.code, jitter(r.basePing)])));
    }, 3800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => clearTimers(), []);

  const startTicker = useCallback(() => {
    running.current = true;
    const id = window.setInterval(() => {
      setDown((d) => {
        const next = Math.max(18, Math.min(110, (d || 62) + (Math.random() - 0.48) * 16));
        samples.current = [...samples.current.slice(-59), next];
        return next;
      });
      setUp((u) => Math.max(6, Math.min(38, (u || 18) + (Math.random() - 0.5) * 6)));
      setSec((s) => s + 1);
    }, 1000);
    timers.current.push(id);
  }, []);

  const connect = () => {
    if (sim !== "idle") return;
    setLeaked(false);
    setSim("connecting");
    setSec(0);
    samples.current = [];
    const seq: [number, string, LogLine["tone"]][] = [
      [0, `server_fetcher → best relay for ${region.code}: ${region.relaySample}`, "dim"],
      [700, `tcp probe ${region.exitSample}:443 … ${ping} ms`, "dim"],
      [1300, "profile written → ~/.airlock/airlock_" + region.code + ".ovpn", "dim"],
      [1900, "spawning openvpn [daemon] --config … --verb 3", "dim"],
      [2600, "TLS handshake OK (AES-256-GCM) — pushed routes applied", "dim"],
      [3200, "dns guard: resolvers pinned to 1.1.1.1 / 8.8.8.8", "ok"],
      [3200, kill ? "kill switch: OUTPUT policy armed (tun + relay only)" : "kill switch disabled", kill ? "ok" : "warn"],
      [3600, "Initialization Sequence Completed — tunnel up", "ok"],
    ];
    seq.forEach(([d, m, t]) =>
      timers.current.push(window.setTimeout(() => log(m, t), d))
    );
    timers.current.push(
      window.setTimeout(() => {
        setSim("connected");
        startTicker();
      }, 3700)
    );
  };

  const disconnect = useCallback(
    (naturalDrop = false) => {
      clearTimers();
      setDown(0);
      setUp(0);
      if (naturalDrop && kill) {
        setSim("dropped");
        log("tun0 carrier lost — unexpected drop", "err");
        log("KILL SWITCH ENGAGED: all non-tunneled traffic blocked", "err");
        log("auto-recovery: re-establishing tunnel…", "warn");
        timers.current.push(
          window.setTimeout(() => {
            setSim("connecting");
            log("TLS handshake OK (AES-256-GCM) — pushed routes applied", "dim");
          }, 1800)
        );
        timers.current.push(
          window.setTimeout(() => {
            setSim("connected");
            log("Initialization Sequence Completed — tunnel restored", "ok");
            startTicker();
          }, 3200)
        );
      } else if (naturalDrop) {
        setSim("dropped");
        setLeaked(true);
        log("tun0 carrier lost — unexpected drop", "err");
        log("WARNING: kill switch off — traffic is LEAKED in cleartext", "err");
        timers.current.push(
          window.setTimeout(() => {
            setSim("idle");
            setLeaked(false);
            log("back to cleartext. enable the kill switch.", "warn");
          }, 2600)
        );
      } else {
        setSim("idle");
        log("user requested disconnect — SIGTERM via management port", "dim");
        log("dns restored, firewall rules swept, tunnel closed", "dim");
      }
    },
    [kill, log, startTicker]
  );

  const onRing = () => {
    if (sim === "idle") connect();
    else if (sim === "connected") disconnect(false);
  };

  const ringColor =
    sim === "connected" ? "#3ce8a5" : sim === "dropped" ? "#ff5d6c" : sim === "connecting" ? "#ffc86b" : "#33413c";
  const statusLabel =
    sim === "idle" ? "DISCONNECTED" : sim === "connecting" ? (leaked ? "RECONNECTING" : "CONNECTING") : sim === "connected" ? "CONNECTED" : "LINK LOST";

  return (
    <section id="demo" className="relative py-24 md:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_45%,rgba(60,232,165,0.07),transparent_70%)]" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <SectionHeading
          index="01"
          eyebrow="Interactive demo"
          title="The client, live in your browser."
          body="Every pixel of the PySide6 desktop app rebuilt here as a working simulation — the same state machine, the same modules, the same twelve regions. Press the ring."
        />

        <div className="grid lg:grid-cols-[460px_1fr] gap-10 items-start">
          {/* ---------- the app window ---------- */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[430px]"
          >
            <div
              className="absolute -inset-8 rounded-[40px] blur-3xl transition-colors duration-700"
              style={{
                background:
                  sim === "connected"
                    ? "rgba(60,232,165,0.10)"
                    : sim === "dropped"
                    ? "rgba(255,93,108,0.10)"
                    : "rgba(60,232,165,0.04)",
              }}
            />
            <div className="relative rounded-3xl border border-edge bg-panel/90 backdrop-blur-xl overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]">
              {/* title bar */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-edge">
                <span className="w-3 h-3 rounded-full bg-[#2a3a34]" />
                <span className="w-3 h-3 rounded-full bg-[#2a3a34]" />
                <span className="w-3 h-3 rounded-full bg-[#2a3a34]" />
                <span className="ml-3 font-mono text-[10px] tracking-[0.3em] text-faint">
                  AIRLOCK VPN — 1.0.0
                </span>
                <span className="ml-auto font-mono text-[10px] text-faint">admin</span>
              </div>

              <div className="px-7 pt-8 pb-6 flex flex-col items-center">
                {/* connect ring */}
                <button
                  onClick={onRing}
                  aria-label="connect"
                  className="relative w-48 h-48 rounded-full outline-none group"
                >
                  {sim === "connected" && (
                    <span className="absolute inset-0 rounded-full pulse-ring" />
                  )}
                  <svg viewBox="0 0 192 192" className="w-full h-full">
                    <circle cx="96" cy="96" r="86" fill="none" stroke="#16211e" strokeWidth="3" />
                    {sim === "connecting" ? (
                      <g className="origin-center animate-spin-slower" style={{ transformOrigin: "96px 96px" }}>
                        <circle
                          cx="96" cy="96" r="90" fill="none" stroke={ringColor}
                          strokeWidth="4" strokeLinecap="round" strokeDasharray="160 406"
                        />
                      </g>
                    ) : (
                      <circle
                        cx="96" cy="96" r="90" fill="none" stroke={ringColor}
                        strokeWidth="4" strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    )}
                  </svg>
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="flex flex-col items-center gap-1.5">
                      <Power
                        size={26}
                        strokeWidth={2.4}
                        style={{ color: sim === "idle" ? "#e8f1ee" : ringColor }}
                        className="transition-colors duration-300 group-hover:scale-110"
                      />
                      <span className="font-mono text-[10px] tracking-[0.3em] text-faint">
                        {sim === "idle" ? "CONNECT" : sim === "connected" ? "DISCONNECT" : sim === "connecting" ? "…" : "RESET"}
                      </span>
                    </span>
                  </span>
                </button>

                {/* status */}
                <div className="mt-6 text-center">
                  <div
                    className="font-mono text-[12px] font-semibold tracking-[0.3em] transition-colors duration-300"
                    style={{ color: sim === "idle" ? "#8ca39b" : ringColor }}
                  >
                    {statusLabel}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-faint">
                    {sim === "connected"
                      ? `${region.exitSample} · ${region.relaySample}`
                      : sim === "dropped"
                      ? "firewall: OUTPUT policy DROP"
                      : "no tunnel — cleartext route"}
                  </div>
                </div>

                {/* region select */}
                <div className="relative w-full mt-7">
                  <button
                    onClick={() => setOpen((o) => !o)}
                    disabled={sim === "connecting" || sim === "connected"}
                    className="w-full flex items-center gap-3 rounded-xl border border-edge2 bg-panel2 px-4 py-3.5 disabled:opacity-60 hover:border-mint/50 transition-colors"
                  >
                    <span className="w-8 h-6 grid place-items-center rounded border border-edge2 bg-panel font-mono text-[10px] text-mint">
                      {region.code}
                    </span>
                    <span className="text-sm text-ink">{region.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-mint">{ping} ms</span>
                    <ChevronDown
                      size={15}
                      className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                      <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto code-scroll rounded-xl border border-edge2 bg-panel2 shadow-2xl">
                        {REGIONS.map((r) => (
                          <button
                            key={r.code}
                            onClick={() => {
                              setRegion(r);
                              setOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-mint/10 transition-colors ${
                              r.code === region.code ? "bg-mint/5" : ""
                            }`}
                          >
                            <span className="w-8 h-6 grid place-items-center rounded border border-edge2 bg-panel font-mono text-[10px] text-mint">
                              {r.code}
                            </span>
                            <span className="text-[13px] text-ink">{r.name}</span>
                            <span className="ml-auto font-mono text-[11px] text-dim">
                              {pings[r.code]} ms
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* stats */}
                <div className="w-full grid grid-cols-3 gap-3 mt-5">
                  {[
                    { icon: ArrowDownToLine, label: "DOWN", value: `${fmtMbps(down)} Mbps` },
                    { icon: ArrowUpFromLine, label: "UP", value: `${fmtMbps(up)} Mbps` },
                    { icon: Timer, label: "SESSION", value: fmtDuration(sec) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-edge bg-panel2/70 px-3 py-3">
                      <div className="flex items-center gap-1.5 text-faint">
                        <s.icon size={11} />
                        <span className="font-mono text-[9px] tracking-[0.2em]">{s.label}</span>
                      </div>
                      <div className="mt-1.5 font-mono text-[13px] font-semibold text-ink tabular-nums">
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* chart */}
                <div className="w-full mt-4 rounded-xl border border-edge bg-panel2/50 p-3">
                  <BandwidthChart data={samples.current} max={110} />
                </div>

                {/* toggles + drop simulation */}
                <div className="w-full flex items-center justify-between mt-5">
                  <button
                    onClick={() => setKill((k) => !k)}
                    className="flex items-center gap-2.5 group"
                  >
                    <span
                      className={`w-9 h-5 rounded-full border transition-colors relative ${
                        kill ? "bg-mint/15 border-mint/60" : "bg-panel2 border-edge2"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
                          kill ? "left-[18px] bg-mint" : "left-0.5 bg-faint"
                        }`}
                      />
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-dim group-hover:text-ink transition-colors">
                      {kill ? <ShieldCheck size={12} className="text-mint" /> : <ShieldAlert size={12} className="text-danger" />}
                      KILL SWITCH {kill ? "ON" : "OFF"}
                    </span>
                  </button>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-dim">
                    <Globe size={12} className="text-mint" />
                    DNS GUARD 1.1.1.1
                  </span>
                </div>

                {/* log console */}
                <div className="w-full mt-5 rounded-xl border border-edge bg-[#060a0b] p-3.5 h-36 overflow-auto code-scroll font-mono text-[10px] leading-[1.8]">
                  {logs.map((l) => (
                    <div key={l.id} className="flex gap-2">
                      <span className="text-faint shrink-0">[{l.t}]</span>
                      <span
                        className={
                          l.tone === "ok"
                            ? "text-mint"
                            : l.tone === "err"
                            ? "text-danger"
                            : l.tone === "warn"
                            ? "text-amber"
                            : "text-dim"
                        }
                      >
                        {l.msg}
                      </span>
                    </div>
                  ))}
                  <span className="text-mint blink-caret">▊</span>
                </div>

                <button className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-faint hover:text-mint border border-dashed border-edge2 hover:border-mint/60 rounded-lg px-4 py-2.5 transition-colors">
                  <FileUp size={12} />
                  IMPORT .OVPN / .CONF
                </button>
              </div>
            </div>

            {/* leaked banner */}
            {sim === "dropped" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.2em] rounded-full px-5 py-2.5 border ${
                  kill
                    ? "text-mint border-mint/40 bg-[#08130f]"
                    : "text-danger border-danger/40 bg-[#170a0c]"
                }`}
              >
                {kill ? "KILL SWITCH: TRAFFIC BLOCKED — RECOVERING" : "WARNING: LEAKING IN CLEARTEXT"}
              </motion.div>
            )}
          </motion.div>

          {/* ---------- side panel ---------- */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4 lg:pt-4"
          >
            <div className="rounded-2xl border border-edge bg-panel p-7">
              <h3 className="text-lg font-medium mb-1.5">Try the failure path</h3>
              <p className="text-dim text-sm leading-relaxed mb-5">
                Kill the relay mid-session and watch policy decide your fate. With the
                kill switch armed, every packet outside the tunnel is dropped instantly.
                Disarm it and you leak.
              </p>
              <button
                onClick={() => sim === "connected" && disconnect(true)}
                disabled={sim !== "connected"}
                className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase rounded-full border border-amber/40 text-amber px-5 py-3 hover:bg-amber/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Zap size={13} />
                Simulate tunnel drop
              </button>
            </div>

            <div className="rounded-2xl border border-edge bg-panel p-7">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCcw size={13} className="text-mint" />
                <span className="font-mono text-[10px] tracking-[0.25em] text-faint uppercase">
                  Live region latency — vpngate index
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => setRegion(r)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                      r.code === region.code
                        ? "border-mint/50 bg-mint/5"
                        : "border-edge bg-panel2 hover:border-edge2"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-mint">{r.code}</span>
                    <span className="font-mono text-[10px] text-dim tabular-nums">
                      {pings[r.code]}ms
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-faint text-[11px] font-mono leading-relaxed">
                server_fetcher.py probes each region&apos;s top relays over TCP:443 and
                ranks the bucket by measured_ms.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
