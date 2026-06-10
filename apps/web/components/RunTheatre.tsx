"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Phase, AgentResult } from "@/lib/useAgentStream";
import type { VendorInput, ArgCard } from "@/components/NegotiationForceGraph";

// Three.js / WebGL — load only in the browser.
const NegotiationForceGraph = dynamic(() => import("@/components/NegotiationForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-2xl border border-border bg-[#F6F4EF] text-text-muted">
      Loading 3D graph…
    </div>
  ),
});

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

const STAGES = [
  { key: "understand", short: "Understand", hint: "Parsing intent, budget & constraints" },
  { key: "search", short: "Search", hint: "Exa neural search across the live web" },
  { key: "pitch", short: "Pitch", hint: "Vendor agents draft competing offers" },
  { key: "negotiate", short: "Negotiate", hint: "Buyer agent challenges every pitch" },
  { key: "review", short: "Review", hint: "Auditing against your spending contract" },
  { key: "settle", short: "Settle", hint: "Verdict & Stripe payment" },
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

const SEARCH_TICKER = [
  "Querying Exa neural search across the live web…",
  "Reading menus, price lists & order pages…",
  "Cross-referencing independent reviews…",
  "Extracting vendor names, items & prices…",
  "Filtering to in-budget, in-area options…",
];

export default function RunTheatre({ phase, vendors, winner, result, intent }: Props) {
  const current = stageIndex(phase);
  const done = !!result;
  const ranking = result?.ranking ?? [];
  const winnerName = winner ?? result?.vendor;

  // Build the 3D graph's vendor list: real ranking (with winner) once done,
  // otherwise the discovered vendor names.
  const graphVendors: VendorInput[] =
    done && ranking.length > 0
      ? ranking.map((r, i) => ({
          id: `v${i}`,
          name: r.vendor,
          state: r.vendor === winnerName ? "winner" : "dim",
        }))
      : vendors.map((name, i) => ({ id: `v${i}`, name, state: "relevant" as const }));

  const winnerId = done ? graphVendors.find((v) => v.name === winnerName)?.id : undefined;
  const activeMode: "none" | "all" | "winner" = done
    ? "winner"
    : phase === "deciding" || phase === "verifying"
    ? "all"
    : "none";

  // Replay the real negotiation transcript onto the side card stacks once it arrives.
  const [cards, setCards] = useState<ArgCard[]>([]);
  useEffect(() => {
    const rounds = result?.negotiation ?? [];
    if (rounds.length === 0) {
      setCards([]);
      return;
    }
    setCards([]);
    const turns = rounds.flatMap((r) => r.entries.map((e) => ({ speaker: e.speaker, text: e.message })));
    const timers = turns.map((turn, i) =>
      setTimeout(() => {
        const side = /buyer|your agent/i.test(turn.speaker) ? "left" : "right";
        setCards((prev) => [...prev, { id: i, side, speaker: turn.speaker, text: turn.text }]);
      }, i * 1500)
    );
    return () => timers.forEach(clearTimeout);
  }, [result]);

  const showGraph = done || phase === "pitching" || phase === "deciding" || phase === "verifying";

  return (
    <div className="space-y-5">
      <StageStrip current={current} done={done} />

      {phase === "broadcasting" && !done ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <SearchScene vendors={vendors} intent={intent} />
        </div>
      ) : showGraph ? (
        <NegotiationForceGraph vendors={graphVendors} activeMode={activeMode} winnerId={winnerId} cards={cards} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <SearchScene vendors={vendors} intent={intent} />
        </div>
      )}

      {done && <ResultDetails result={result!} winnerName={winnerName} />}
    </div>
  );
}

// ── Horizontal stage strip ───────────────────────────────────────────────────
function StageStrip({ current, done }: { current: number; done: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
      <div className="flex">
        {STAGES.map((s, i) => {
          const state = done || i < current ? "done" : i === current ? "active" : "pending";
          return (
            <div key={s.key} className="relative flex flex-1 flex-col items-center" title={s.hint}>
              {i < STAGES.length - 1 && (
                <span
                  className={`absolute left-1/2 top-[13px] h-0.5 w-full ${
                    done || i < current ? "bg-accent-blue" : "bg-border"
                  }`}
                />
              )}
              <span className="relative z-10 flex h-[27px] w-[27px] items-center justify-center">
                {state === "active" && <span className="tk-ring absolute inset-0 rounded-full bg-accent-blue-subtle" />}
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
              <span
                className={`mt-2 text-center text-[0.78rem] font-medium ${
                  state === "pending" ? "text-text-muted" : "text-text-primary"
                }`}
              >
                {s.short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Search scene ─────────────────────────────────────────────────────────────
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
      <SceneHeader kicker="Discovery" title="Scanning the open web" sub={`Finding the best matches to “${intent}”.`} />
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
            <div key={i} className="tk-shimmer h-2.5 rounded-full" style={{ width: `${72 - i * 14}%` }} />
          ))}
        </div>
        <p className="mt-4 font-mono text-[0.76rem] text-text-muted">{count.toLocaleString()} sources analysed</p>
      </div>
      <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {vendors.length > 0 ? "Candidates found" : "Surfacing candidates…"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {vendors.length === 0
          ? [0, 1, 2, 3].map((i) => <div key={i} className="tk-shimmer h-8 w-28 rounded-full" />)
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

// ── Result details: ranking + collapsible transcript + governance ────────────
function isBuyer(speaker: string): boolean {
  return /buyer|your agent/i.test(speaker);
}

function ResultDetails({ result, winnerName }: { result: AgentResult; winnerName?: string }) {
  const transcript = result.negotiation ?? [];
  const rules = (result.checkedRules as Rule[] | undefined) ?? [];
  const ranking =
    result.ranking && result.ranking.length > 0
      ? [...result.ranking].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      : [];
  const turnCount = transcript.reduce((s, r) => s + r.entries.length, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <SceneHeader kicker="Negotiation complete" title="The final ranking" sub="How each vendor scored after the full negotiation." />

      {ranking.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {ranking.map((r, i) => {
            const isWinner = r.vendor === winnerName || (i === 0 && !winnerName);
            return (
              <div
                key={r.vendor + i}
                className={`tk-rise rounded-xl border p-3.5 shadow-sm ${
                  isWinner ? "border-accent-blue bg-accent-blue-subtle" : "border-border bg-surface"
                }`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[0.78rem] text-text-muted">#{i + 1}</span>
                    {isWinner && (
                      <span className="rounded-full bg-accent-blue px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-text-inverse">
                        Picked
                      </span>
                    )}
                    <span className="text-[0.92rem] font-semibold text-text-primary">{r.vendor}</span>
                    <span className="text-[0.8rem] text-text-muted">
                      {r.item} · SGD {Number(r.price).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-mono text-[0.92rem] font-semibold tabular-nums text-text-primary">{r.score ?? "—"}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div className="tk-bar h-full rounded-full bg-accent-blue" style={{ width: `${Math.max(0, Math.min(100, r.score ?? 0))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full transcript — tucked away so it doesn't dominate. */}
      {transcript.length > 0 && (
        <details className="group mt-5 rounded-xl border border-border-subtle bg-surface-raised/30">
          <summary className="cursor-pointer select-none px-4 py-3 text-[0.86rem] font-medium text-text-primary">
            Read the full transcript
            <span className="ml-2 font-normal text-text-muted">({turnCount} exchanges across {transcript.length} rounds)</span>
          </summary>
          <div className="space-y-5 px-4 pb-5">
            {transcript.map((round, ri) => (
              <div key={ri}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="rounded-full bg-accent-blue-subtle px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-accent-blue">
                    {round.round}
                  </span>
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>
                <div className="space-y-2">
                  {round.entries.map((e, ei) => {
                    const buyer = isBuyer(e.speaker);
                    return (
                      <div key={ei} className={`flex ${buyer ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-[0.84rem] leading-relaxed ${
                            buyer
                              ? "rounded-tl-sm border-accent-purple-subtle bg-accent-purple-subtle text-text-primary"
                              : "rounded-tr-sm border-border bg-surface text-text-secondary"
                          }`}
                        >
                          <span className={`mb-0.5 block text-[0.66rem] font-semibold uppercase tracking-wide ${buyer ? "text-accent-purple" : "text-accent-blue"}`}>
                            {buyer ? "🛡 " : "🍽 "}{e.speaker}
                          </span>
                          <span className="whitespace-pre-wrap">{e.message}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Governance audit */}
      {rules.length > 0 && (
        <>
          <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Governance audit</p>
          <div className="mt-3 space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-text-inverse ${r.passed ? "bg-accept" : "bg-block"}`}>
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

// ── Shared ───────────────────────────────────────────────────────────────────
function SceneHeader({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-blue">{kicker}</p>
      <h3 className="font-serif mt-1 text-[1.55rem] font-semibold leading-tight text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-xl text-[0.92rem] text-text-secondary">{sub}</p>
    </div>
  );
}
