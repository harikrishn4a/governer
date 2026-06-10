"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase, AgentResult } from "@/lib/useAgentStream";

// Real supplier pitch shape carried on the governance:complete event.
interface Pitch {
  vendor: string;
  item: string;
  price: number;
  pitch: string;
  keyPoints: string[];
  fitScore: number;
}

interface Rule {
  rule: string;
  passed: boolean;
  detail: string;
}

interface Props {
  phase: Phase;
  vendors: string[];
  winner?: string;
  result?: AgentResult;
  intent: string;
}

// ── Stage definitions ───────────────────────────────────────────────────────
const STAGES = [
  { key: "understand", label: "Understanding the request", hint: "Parsing intent, budget & constraints" },
  { key: "search", label: "Searching the open web", hint: "Exa neural search across live sources" },
  { key: "pitch", label: "Suppliers make their case", hint: "Vendor agents draft competing offers" },
  { key: "negotiate", label: "Agents negotiate", hint: "Buyer agent challenges every pitch" },
  { key: "review", label: "Governance review", hint: "Auditing against your spending contract" },
  { key: "settle", label: "Decision & settlement", hint: "Verdict and Stripe payment" },
] as const;

function stageIndex(phase: Phase): number {
  switch (phase) {
    case "broadcasting": return 1;
    case "pitching": return 2;
    case "deciding": return 3;
    case "verifying": return 4;
    case "complete": return 5;
    default: return 0;
  }
}

// Rotating activity lines that make the long Exa discovery feel like active work.
const SEARCH_TICKER = [
  "Querying Exa neural search across the live web…",
  "Reading menus, price lists & order pages…",
  "Cross-referencing independent reviews…",
  "Extracting vendor names, items & prices…",
  "Filtering to in-budget, in-area options…",
  "De-duplicating vendors & ranking candidates…",
];

const NEGOTIATION_BEATS = [
  { who: "buyer", line: "Justify this price against what the reviews actually say." },
  { who: "vendor", line: "Portion size and freshness lead the category — here's why." },
  { who: "buyer", line: "Two competitors undercut you. What's the real value?" },
  { who: "vendor", line: "Quality and location convenience close the gap." },
  { who: "buyer", line: "Does this genuinely match the request, or is it a stretch?" },
  { who: "vendor", line: "Direct match on intent — and we're under budget." },
];

export default function RunTheatre({ phase, vendors, winner, result, intent }: Props) {
  const current = stageIndex(phase);
  const done = !!result;
  const pitches = (result?.pitches as Pitch[] | undefined) ?? [];
  const rules = (result?.checkedRules as Rule[] | undefined) ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      {/* ── Pipeline rail ────────────────────────────────────────────────── */}
      <StageRail current={current} done={done} />

      {/* ── Active scene / result ────────────────────────────────────────── */}
      <div className="min-h-[440px] rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {done ? (
          <ResultRecap pitches={pitches} rules={rules} result={result!} winner={winner} />
        ) : phase === "broadcasting" ? (
          <SearchScene vendors={vendors} intent={intent} />
        ) : phase === "pitching" ? (
          <PitchScene vendors={vendors} />
        ) : phase === "deciding" ? (
          <NegotiationScene vendors={vendors} />
        ) : phase === "verifying" ? (
          <ReviewScene winner={winner} />
        ) : (
          <SearchScene vendors={vendors} intent={intent} />
        )}
      </div>
    </div>
  );
}

// ── Pipeline rail ────────────────────────────────────────────────────────────
function StageRail({ current, done }: { current: number; done: boolean }) {
  const activeIdx = done ? STAGES.length : current;
  const fillPct = (Math.min(activeIdx, STAGES.length - 1) / (STAGES.length - 1)) * 100;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Agent pipeline
      </p>
      <div className="relative">
        {/* connector track + fill */}
        <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
        <div
          className="tk-railfill absolute left-[13px] top-2 w-px bg-accent-blue"
          style={{ height: `calc((100% - 16px) * ${fillPct} / 100)` }}
        />
        <ul className="space-y-5">
          {STAGES.map((s, i) => {
            const state = done || i < current ? "done" : i === current ? "active" : "pending";
            return (
              <li key={s.key} className="relative flex gap-3.5">
                <span className="relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center">
                  {state === "active" && (
                    <span className="tk-ring absolute inset-0 rounded-full bg-accent-blue-subtle" />
                  )}
                  <span
                    className={`flex h-[27px] w-[27px] items-center justify-center rounded-full border text-[0.72rem] font-semibold ${
                      state === "done"
                        ? "border-accent-blue bg-accent-blue text-text-inverse"
                        : state === "active"
                        ? "border-accent-blue bg-surface text-accent-blue"
                        : "border-border bg-surface text-text-muted"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                </span>
                <div className="pt-0.5">
                  <p
                    className={`text-[0.9rem] font-medium leading-tight ${
                      state === "pending" ? "text-text-muted" : "text-text-primary"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[0.78rem] leading-snug text-text-muted">{s.hint}</p>
                  {state === "active" && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[0.72rem] font-medium text-accent-blue">
                      <span className="tk-dot inline-block h-1 w-1 rounded-full bg-accent-blue" />
                      <span className="tk-dot inline-block h-1 w-1 rounded-full bg-accent-blue" />
                      <span className="tk-dot inline-block h-1 w-1 rounded-full bg-accent-blue" />
                      working
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── Scene: searching ─────────────────────────────────────────────────────────
function SearchScene({ vendors, intent }: { vendors: string[]; intent: string }) {
  const [tick, setTick] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => c + Math.floor(3 + Math.random() * 9)), 700);
    return () => clearInterval(t);
  }, []);

  const line = SEARCH_TICKER[tick % SEARCH_TICKER.length];

  return (
    <div>
      <SceneHeader
        kicker="Discovery"
        title="Scanning the open web"
        sub={`Looking for the best matches to “${intent}”.`}
      />

      {/* live activity panel */}
      <div className="tk-scan mt-6 rounded-xl border border-border-subtle bg-surface-raised/60 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="tk-breathe absolute inline-flex h-full w-full rounded-full bg-accent-blue" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-blue" />
          </span>
          <span className="text-[0.92rem] font-medium text-text-primary">{line}</span>
        </div>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="tk-shimmer h-2.5 rounded-full" style={{ width: `${72 - i * 14}%` }} />
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[0.76rem] text-text-muted">
          {count.toLocaleString()} sources analysed
        </p>
      </div>

      {/* discovered vendors stream in */}
      <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {vendors.length > 0 ? "Candidates found" : "Surfacing candidates…"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {vendors.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="tk-shimmer h-8 w-28 rounded-full" />
            ))
          : vendors.map((v, i) => (
              <span
                key={v + i}
                className="tk-pop inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[0.85rem] font-medium text-text-primary shadow-sm"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-node-vendor" />
                {v}
              </span>
            ))}
      </div>
    </div>
  );
}

// ── Scene: suppliers pitching ────────────────────────────────────────────────
function PitchScene({ vendors }: { vendors: string[] }) {
  const top = (vendors.length ? vendors : ["Vendor A", "Vendor B", "Vendor C"]).slice(0, 3);
  return (
    <div>
      <SceneHeader
        kicker="The floor is open"
        title="Suppliers make their case"
        sub="Each vendor's agent drafts a competing pitch grounded in real menu & price data."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {top.map((v, i) => (
          <div
            key={v + i}
            className="tk-rise rounded-xl border border-border bg-surface p-4 shadow-sm"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue-subtle text-[0.8rem] font-semibold text-accent-blue">
                {v.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate text-[0.9rem] font-semibold text-text-primary">{v}</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-text-muted">
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="ml-1 text-[0.78rem]">preparing pitch…</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="tk-shimmer h-2 w-full rounded-full" />
              <div className="tk-shimmer h-2 w-4/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scene: negotiation ───────────────────────────────────────────────────────
function NegotiationScene({ vendors }: { vendors: string[] }) {
  const [beat, setBeat] = useState(0);
  const [round, setRound] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setBeat((b) => {
        const nb = b + 1;
        if (nb % NEGOTIATION_BEATS.length === 0) setRound((r) => Math.min(r + 1, 3));
        return nb;
      });
    }, 1700);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [beat]);

  const shown = NEGOTIATION_BEATS.slice(0, (beat % NEGOTIATION_BEATS.length) + 1);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <SceneHeader
          kicker="Negotiation"
          title="Agents go head-to-head"
          sub="Your buyer agent pressure-tests every vendor on price, value and fit."
        />
        <span className="shrink-0 rounded-full border border-accent-blue-subtle bg-accent-blue-subtle px-3 py-1 text-[0.74rem] font-semibold text-accent-blue">
          Round {round} / 3
        </span>
      </div>

      <div
        ref={scrollRef}
        className="scroll-custom mt-6 max-h-[300px] space-y-3 overflow-y-auto pr-1"
      >
        {shown.map((b, i) => (
          <div
            key={i}
            className={`tk-rise flex ${b.who === "buyer" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[78%] rounded-2xl border px-4 py-2.5 text-[0.86rem] leading-snug shadow-sm ${
                b.who === "buyer"
                  ? "rounded-tl-sm border-accent-purple-subtle bg-accent-purple-subtle text-text-primary"
                  : "rounded-tr-sm border-border bg-surface text-text-secondary"
              }`}
            >
              <span
                className={`mb-0.5 block text-[0.68rem] font-semibold uppercase tracking-wide ${
                  b.who === "buyer" ? "text-accent-purple" : "text-text-muted"
                }`}
              >
                {b.who === "buyer" ? "Buyer agent" : "Vendor agent"}
              </span>
              {b.line}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 pl-1 text-text-muted">
          <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
          <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
          <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
        </div>
      </div>

      {vendors.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {vendors.slice(0, 5).map((v, i) => (
            <span
              key={v + i}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[0.78rem] text-text-secondary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-node-vendor" />
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scene: governance review ─────────────────────────────────────────────────
function ReviewScene({ winner }: { winner?: string }) {
  const ITEMS = ["Intent match", "Budget cap", "Vendor blocklist", "Vendor legitimacy"];
  return (
    <div>
      <SceneHeader
        kicker="Governance"
        title="Auditing the winner"
        sub={winner ? `Checking ${winner} against your spending contract.` : "Checking the pick against your spending contract."}
      />
      <div className="mt-6 space-y-2.5">
        {ITEMS.map((label, i) => (
          <div
            key={label}
            className="tk-rise flex items-center justify-between rounded-xl border border-border-subtle bg-surface-raised/50 px-4 py-3"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <span className="text-[0.88rem] font-medium text-text-primary">{label}</span>
            <span className="flex items-center gap-1.5 text-[0.78rem] text-text-muted">
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-review" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-review" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-review" />
              checking
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Result recap (real pitch scores + governance audit) ──────────────────────
function ResultRecap({
  pitches,
  rules,
  result,
  winner,
}: {
  pitches: Pitch[];
  rules: Rule[];
  result: AgentResult;
  winner?: string;
}) {
  const sorted = [...pitches].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  const winnerName = winner ?? result.vendor;

  return (
    <div>
      <SceneHeader
        kicker="Negotiation complete"
        title="How the agents scored it"
        sub="Each vendor's pitch, ranked by how well it satisfied your request."
      />

      {sorted.length > 0 && (
        <div className="mt-6 space-y-3">
          {sorted.map((p, i) => {
            const isWinner = p.vendor === winnerName || (i === 0 && !winnerName);
            return (
              <div
                key={p.vendor + i}
                className={`tk-rise rounded-xl border p-4 shadow-sm ${
                  isWinner ? "border-accent-blue bg-accent-blue-subtle" : "border-border bg-surface"
                }`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {isWinner && (
                      <span className="rounded-full bg-accent-blue px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-text-inverse">
                        Winner
                      </span>
                    )}
                    <span className="text-[0.95rem] font-semibold text-text-primary">{p.vendor}</span>
                    <span className="text-[0.82rem] text-text-muted">
                      {p.item} · SGD {Number(p.price).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-mono text-[0.95rem] font-semibold tabular-nums text-text-primary">
                    {p.fitScore ?? "—"}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="tk-bar h-full rounded-full bg-accent-blue"
                    style={{ width: `${Math.max(0, Math.min(100, p.fitScore ?? 0))}%` }}
                  />
                </div>
                {p.keyPoints?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.keyPoints.slice(0, 3).map((k, ki) => (
                      <span
                        key={ki}
                        className="rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[0.74rem] text-text-secondary"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rules.length > 0 && (
        <>
          <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Governance audit
          </p>
          <div className="mt-3 space-y-2">
            {rules.map((r, i) => (
              <div
                key={i}
                className="tk-rise flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-2.5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-text-inverse ${
                    r.passed ? "bg-accept" : "bg-block"
                  }`}
                >
                  {r.passed ? "✓" : "✕"}
                </span>
                <div>
                  <p className="text-[0.84rem] font-medium text-text-primary">{r.rule}</p>
                  <p className="text-[0.78rem] leading-snug text-text-muted">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared scene header ──────────────────────────────────────────────────────
function SceneHeader({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-blue">{kicker}</p>
      <h3 className="font-serif mt-1 text-[1.55rem] font-semibold leading-tight text-text-primary">
        {title}
      </h3>
      <p className="mt-1.5 max-w-xl text-[0.92rem] text-text-secondary">{sub}</p>
    </div>
  );
}
