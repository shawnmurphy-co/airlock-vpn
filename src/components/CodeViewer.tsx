import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, FileCode2, Package } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { SOURCE_FILES, downloadOne, downloadZip } from "../data/code";

/* ------------------------------------------------------------------ */
/* tiny python tokenizer                                               */
/* ------------------------------------------------------------------ */
interface Tok {
  text: string;
  cls?: string;
}

const KEYWORDS = new Set([
  "def", "class", "import", "from", "return", "if", "elif", "else", "for",
  "while", "try", "except", "finally", "with", "as", "pass", "raise",
  "lambda", "yield", "global", "nonlocal", "assert", "del", "continue",
  "break", "in", "is", "not", "and", "or", "None", "True", "False",
]);

function tokenizeLine(line: string, state: { triple: string | null }): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const push = (text: string, cls?: string) => text && toks.push({ text, cls });

  while (i < line.length) {
    if (state.triple) {
      const end = line.indexOf(state.triple, i);
      if (end === -1) {
        push(line.slice(i), "str");
        i = line.length;
      } else {
        push(line.slice(i, end + 3), "str");
        i = end + 3;
        state.triple = null;
      }
      continue;
    }
    const rest = line.slice(i);
    const m = rest.match(
      /^(\s+|#.*|@[\w.()]+|'''|"""|f?rb?'(?:\\.|[^'\\])*'|f?rb?"(?:\\.|[^"\\])*"|\d[\d_]*(?:\.\d+)?[eE]?[\d]*|[A-Za-z_]\w*|\\.?|.)/
    );
    if (!m) break;
    const tok = m[0];
    i += tok.length;

    if (tok === "'''" || tok === '"""') {
      state.triple = tok;
      push(tok, "str");
    } else if (tok.startsWith("#")) {
      push(tok, "com");
    } else if (/^\s+$/.test(tok)) {
      push(tok);
    } else if (/^@/.test(tok)) {
      push(tok, "dec");
    } else if (/^(f?rb?)'/.test(tok) || /^(f?rb?)"/.test(tok)) {
      push(tok, "str");
    } else if (/^\d/.test(tok)) {
      push(tok, "num");
    } else if (/^[A-Za-z_]/.test(tok)) {
      push(tok, KEYWORDS.has(tok) ? "kw" : undefined);
    } else {
      push(tok, "pun");
    }
  }
  return toks;
}

function tokenize(src: string): Tok[][] {
  const state = { triple: null as string | null };
  return src.split("\n").map((line) => tokenizeLine(line, state));
}

const CLS: Record<string, string> = {
  kw: "text-[#3ce8a5]",
  str: "text-[#ffc86b]",
  com: "text-[#42615a] italic",
  num: "text-[#c4b5fd]",
  dec: "text-[#7dd3fc]",
  pun: "text-[#5c7269]",
};

/* ------------------------------------------------------------------ */
/* viewer                                                              */
/* ------------------------------------------------------------------ */
export default function CodeViewer() {
  const [active, setActive] = useState(1);
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const file = SOURCE_FILES[active];
  const lines = useMemo(() => tokenize(file.code), [file]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const zip = async () => {
    setZipping(true);
    try {
      await downloadZip();
    } finally {
      setZipping(false);
    }
  };

  return (
    <section id="source" className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_80%_10%,rgba(60,232,165,0.05),transparent_70%)]" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            index="04"
            eyebrow="Complete source"
            title="Copy it. Audit it. Ship it."
            body="The full production codebase, embedded verbatim. Four Python modules plus packaging files — no snippets, no pseudocode."
          />
          <button
            onClick={zip}
            disabled={zipping}
            className="mb-12 md:mb-16 flex items-center gap-2.5 bg-mint text-void font-mono text-[11px] font-semibold tracking-[0.18em] uppercase rounded-full px-6 py-3.5 hover:bg-mint-soft transition-colors disabled:opacity-60"
          >
            <Package size={14} />
            {zipping ? "Packing…" : "Download .zip"}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7 }}
          className="rounded-2xl border border-edge bg-panel overflow-hidden"
        >
          {/* tabs */}
          <div className="flex overflow-x-auto code-scroll border-b border-edge bg-panel2/60">
            {SOURCE_FILES.map((f, i) => (
              <button
                key={f.name}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 px-5 py-4 font-mono text-[12px] whitespace-nowrap border-r border-edge transition-colors ${
                  i === active
                    ? "bg-panel text-mint border-b-2 border-b-mint"
                    : "text-faint hover:text-dim"
                }`}
              >
                <FileCode2 size={13} />
                {f.name}
              </button>
            ))}
          </div>

          {/* meta bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-edge">
            <span className="text-[12px] text-dim">{file.role}</span>
            <span className="font-mono text-[10px] text-faint tracking-widest uppercase">
              {file.loc} · MIT
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-dim hover:text-mint border border-edge2 hover:border-mint/50 rounded-full px-3.5 py-1.5 transition-colors"
              >
                {copied ? <Check size={11} className="text-mint" /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => downloadOne(file.name, file.code)}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-dim hover:text-mint border border-edge2 hover:border-mint/50 rounded-full px-3.5 py-1.5 transition-colors"
              >
                <Download size={11} />
                File
              </button>
            </div>
          </div>

          {/* code */}
          <div className="max-h-[560px] overflow-auto code-scroll">
            <pre className="p-5 font-mono text-[12px] leading-[1.75] min-w-max">
              {lines.map((toks, li) => (
                <div key={li} className="flex">
                  <span className="w-10 shrink-0 text-right pr-5 select-none text-[#2c4038]">
                    {li + 1}
                  </span>
                  <code className="text-[#cfe0d8]">
                    {toks.length
                      ? toks.map((t, ti) => (
                          <span key={ti} className={t.cls ? CLS[t.cls] : undefined}>
                            {t.text}
                          </span>
                        ))
                      : " "}
                  </code>
                </div>
              ))}
            </pre>
          </div>
        </motion.div>

        <p className="mt-5 font-mono text-[11px] text-faint leading-relaxed max-w-2xl">
          Public relays are community-operated servers in the VPN Gate academic
          experiment (Univ. of Tsukuba). Throughput and uptime vary per volunteer
          node — the client always ranks candidates by live TCP latency before connecting.
        </p>
      </div>
    </section>
  );
}
