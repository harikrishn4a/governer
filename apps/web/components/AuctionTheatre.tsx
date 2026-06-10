"use client";

import dynamic from "next/dynamic";
import type { AuctionState, AgentResult, BidView } from "@/lib/useAgentStream";
import type { VendorInput, ArgCard, NodeState } from "@/components/NegotiationForceGraph";

// Three.js / WebGL — load only in the browser (same as the find-mode graph).
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

// ── Adapt the auction stream into the shared 3D-graph props ───────────────────
// Mirrors the find-mode graph (RunTheatre) but contextualised for the auction:
// vendors/anchors become nodes, the winner lights up, and each bid / counter-bid
// streams in as a floating argument card.
function auctionToGraph(
  auction: AuctionState,
  done: boolean,
  winnerName?: string
): { vendors: VendorInput[]; activeMode: "none" | "all" | "winner"; winnerId?: string; cards: ArgCard[] } {
  const skipped = new Set(auction.skipped.map((s) => s.vendor));
  const names =
    auction.vendors.length > 0
      ? auction.vendors
      : Array.from(new Set([...auction.anchors.map((a) => a.vendor), ...Object.keys(auction.bids)]));

  const vendors: VendorInput[] = names.map((name, i) => {
    let state: NodeState;
    if (skipped.has(name)) state = "pruned";
    else if (done) state = name === winnerName ? "winner" : "dim";
    else state = "relevant";
    return { id: `v${i}`, name, state };
  });

  const winnerId = done ? vendors.find((v) => v.name === winnerName)?.id : undefined;

  const activeMode: "none" | "all" | "winner" = done
    ? "winner"
    : auction.phase === "bidding" || auction.phase === "judging"
    ? "all"
    : "none";

  // Each bid across the rounds becomes a floating card, newest revealed last.
  const cards: ArgCard[] = auction.bidHistory.map((b, i) => ({
    id: i,
    side: i % 2 === 0 ? "left" : "right",
    speaker: b.vendor,
    text: `SGD ${Number(b.price).toFixed(2)} — ${b.pitch}`,
  }));

  return { vendors, activeMode, winnerId, cards };
}

interface Props {
  auction: AuctionState;
  result?: AgentResult;
  intent: string;
}

// ── Stage definitions ───────────────────────────────────────────────────────
const STAGES = [
  { key: "tender", label: "Understanding the tender", hint: "Parsing intent, budget & travel details" },
  { key: "anchors", label: "Discovering real prices", hint: "Exa pulls live published fares per vendor" },
  { key: "bidding", label: "Vendors bid for the tender", hint: "Sealed offers, then open counter-bids" },
  { key: "judge", label: "Judge ranks the bids", hint: "Price, fit, value-adds & credibility" },
  { key: "review", label: "Governance review", hint: "Auditing against your spending contract" },
  { key: "settle", label: "Decision & settlement", hint: "Verdict and Stripe payment" },
] as const;

function stageIndex(phase: AuctionState["phase"]): number {
  switch (phase) {
    case "tender": return 1;
    case "bidding": return 2;
    case "judging": return 3;
    case "verifying": return 4;
    case "complete": return 5;
    default: return 0;
  }
}

export default function AuctionTheatre({ auction, result, intent }: Props) {
  const current = stageIndex(auction.phase);
  const done = !!result;
  const rules = (result?.checkedRules as Rule[] | undefined) ?? [];
  const winnerName = auction.winner ?? result?.vendor;

  // The 3D graph is the centerpiece once vendors are in play — i.e. anytime
  // after the tender broadcast (bidding/judging/verifying) and on completion.
  // The tender phase still shows the live anchor-discovery scene (the auction's
  // equivalent of find-mode's web-search scene).
  const showGraph = done || auction.phase === "bidding" || auction.phase === "judging" || auction.phase === "verifying";
  const graph = auctionToGraph(auction, done, winnerName);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <StageRail current={current} done={done} round={auction.round} />

      <div className="space-y-5">
        {showGraph ? (
          <NegotiationForceGraph
            vendors={graph.vendors}
            activeMode={graph.activeMode}
            winnerId={graph.winnerId}
            cards={graph.cards}
          />
        ) : (
          <div className="min-h-[440px] rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <TenderScene auction={auction} intent={intent} />
          </div>
        )}

        {/* Supporting detail under the graph — the rich auction-specific panels. */}
        {(showGraph || done) && (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            {done ? (
              <AuctionRecap auction={auction} rules={rules} result={result!} />
            ) : auction.phase === "bidding" ? (
              <BidBoardScene auction={auction} />
            ) : auction.phase === "judging" ? (
              <JudgeScene auction={auction} />
            ) : (
              <ReviewScene winner={auction.winner} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline rail (mirrors RunTheatre's, with a live round badge) ────────────
function StageRail({ current, done, round }: { current: number; done: boolean; round: number }) {
  const activeIdx = done ? STAGES.length : current;
  const fillPct = (Math.min(activeIdx, STAGES.length - 1) / (STAGES.length - 1)) * 100;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Auction pipeline
      </p>
      <div className="relative">
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
                    {s.key === "bidding" && state === "active" && round > 0 && (
                      <span className="ml-2 rounded-full bg-accent-blue-subtle px-2 py-0.5 text-[0.66rem] font-semibold text-accent-blue">
                        Round {round} / 2
                      </span>
                    )}
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

// ── Scene: tender broadcast + real price anchors ─────────────────────────────
function TenderScene({ auction, intent }: { auction: AuctionState; intent: string }) {
  return (
    <div>
      <SceneHeader
        kicker="Tender broadcast"
        title="Calling vendors to the table"
        sub={`Broadcasting “${intent}” as a tender — Exa is pulling each vendor's live published price.`}
      />

      <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {auction.anchors.length > 0 ? "Live published fares" : "Discovering published fares…"}
      </p>
      <div className="mt-3 space-y-2.5">
        {auction.anchors.length === 0 &&
          [0, 1, 2].map((i) => <div key={i} className="tk-shimmer h-12 rounded-xl" />)}
        {auction.anchors.map((a, i) => (
          <div
            key={a.vendor + i}
            className="tk-rise flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="text-[0.9rem] font-semibold text-text-primary">{a.vendor}</span>
              <span className="text-[0.8rem] text-text-muted">{a.itemSummary}</span>
            </div>
            <span className="font-mono text-[0.92rem] font-semibold tabular-nums text-text-primary">
              SGD {Number(a.publishedPrice).toFixed(2)}
            </span>
          </div>
        ))}
        {auction.skipped.map((s, i) => (
          <div
            key={s.vendor + i}
            className="tk-rise flex items-center justify-between rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3 opacity-60"
            style={{ animationDelay: `${(auction.anchors.length + i) * 100}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span className="text-[0.9rem] font-medium text-text-muted line-through">{s.vendor}</span>
            </div>
            <span className="text-[0.78rem] text-text-muted">{s.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scene: the bid board (centerpiece) ───────────────────────────────────────
function BidBoardScene({ auction }: { auction: AuctionState }) {
  const bids = Object.values(auction.bids);
  const waiting = auction.vendors.filter((v) => !auction.bids[v]);
  const lowest = bids.length ? Math.min(...bids.map((b) => b.price)) : undefined;
  const sealed = auction.round === 1;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <SceneHeader
          kicker="Live auction"
          title={sealed ? "Sealed bids coming in" : "Best & final offers"}
          sub={
            sealed
              ? "Each vendor bids blind, anchored to its real published price."
              : "The board is open — vendors see every competitor and counter-bid in character."
          }
        />
        <span className="shrink-0 rounded-full border border-accent-blue-subtle bg-accent-blue-subtle px-3 py-1 text-[0.74rem] font-semibold text-accent-blue">
          Round {Math.max(auction.round, 1)} / 2
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {bids.map((b, i) => (
          <BidCard key={b.vendor} bid={b} anchor={anchorFor(auction, b.vendor)} isLowest={b.price === lowest} index={i} />
        ))}
        {waiting.map((v, i) => (
          <div
            key={v}
            className="tk-rise rounded-xl border border-border bg-surface p-4 shadow-sm"
            style={{ animationDelay: `${(bids.length + i) * 100}ms` }}
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
              <span className="ml-1 text-[0.78rem]">drafting bid…</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="tk-shimmer h-2 w-full rounded-full" />
              <div className="tk-shimmer h-2 w-3/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function anchorFor(auction: AuctionState, vendor: string) {
  return auction.anchors.find((a) => a.vendor === vendor);
}

function BidCard({
  bid,
  anchor,
  isLowest,
  index,
}: {
  bid: BidView;
  anchor?: { publishedPrice: number };
  isLowest: boolean;
  index: number;
}) {
  const published = anchor?.publishedPrice;
  const discount =
    published && published > bid.price ? Math.round(((published - bid.price) / published) * 100) : 0;

  return (
    <div
      // key on price so a counter-bid re-triggers the entrance animation
      key={`${bid.vendor}-${bid.price}`}
      className={`tk-pop rounded-xl border p-4 shadow-sm ${
        isLowest ? "border-accent-blue bg-accent-blue-subtle" : "border-border bg-surface"
      }`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[0.92rem] font-semibold text-text-primary">{bid.vendor}</span>
          {isLowest && (
            <span className="shrink-0 rounded-full bg-accent-blue px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-text-inverse">
              Lowest
            </span>
          )}
          {bid.carriedForward && (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.62rem] font-medium text-text-muted">
              holds
            </span>
          )}
        </div>
        {bid.canImprove && (
          <span className="flex shrink-0 items-center gap-1 text-[0.7rem] font-medium text-review-text">
            <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-review" />
            can improve
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[1.45rem] font-bold tabular-nums text-text-primary">
          SGD {Number(bid.price).toFixed(2)}
        </span>
        {bid.previousPrice !== undefined && bid.previousPrice !== bid.price && (
          <span className="font-mono text-[0.82rem] tabular-nums text-text-muted line-through">
            {Number(bid.previousPrice).toFixed(2)}
          </span>
        )}
        {discount > 0 && (
          <span className="rounded-full bg-accept-subtle px-2 py-0.5 text-[0.7rem] font-semibold text-accept-text">
            −{discount}% vs published
          </span>
        )}
      </div>

      {bid.conditions && (
        <p className="mt-2 inline-flex rounded-full border border-review-border bg-review-subtle px-2.5 py-1 text-[0.72rem] font-medium text-review-text">
          ⏳ {bid.conditions}
        </p>
      )}

      <p className="mt-2.5 text-[0.82rem] leading-snug text-text-secondary">{bid.pitch}</p>

      {bid.valueAdds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bid.valueAdds.slice(0, 3).map((v, i) => (
            <span
              key={i}
              className="rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[0.72rem] text-text-secondary"
            >
              {v}
            </span>
          ))}
          {bid.valueAdds.length > 3 && (
            <span className="px-1 py-0.5 text-[0.72rem] text-text-muted">+{bid.valueAdds.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scene: judge ─────────────────────────────────────────────────────────────
function JudgeScene({ auction }: { auction: AuctionState }) {
  const ranking = auction.ranking;

  return (
    <div>
      <SceneHeader
        kicker="Evaluation"
        title="The judge weighs every bid"
        sub="Scoring on price vs budget, fit to your constraints, value-adds, and credibility."
      />

      {!ranking ? (
        <div className="mt-6 space-y-2.5">
          {Object.values(auction.bids).map((b, i) => (
            <div
              key={b.vendor}
              className="tk-rise flex items-center justify-between rounded-xl border border-border-subtle bg-surface-raised/50 px-4 py-3"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="text-[0.88rem] font-medium text-text-primary">{b.vendor}</span>
              <span className="flex items-center gap-1.5 text-[0.78rem] text-text-muted">
                <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-purple" />
                <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-purple" />
                <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-purple" />
                scoring
              </span>
            </div>
          ))}
        </div>
      ) : (
        <RankingList
          ranking={ranking.map((r) => ({ ...r, item: "", withinBudget: true }))}
          winner={auction.winner}
        />
      )}

      {auction.verdict && (
        <p className="mt-5 rounded-xl border border-accent-purple-subtle bg-accent-purple-subtle p-4 text-[0.88rem] leading-relaxed text-text-primary">
          {auction.verdict}
        </p>
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
        title="Auditing the winning bid"
        sub={winner ? `Checking ${winner} against your spending contract.` : "Checking the winning bid against your spending contract."}
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

// ── Recap: ranking, savings, transcript, governance audit ────────────────────
function AuctionRecap({
  auction,
  rules,
  result,
}: {
  auction: AuctionState;
  rules: Rule[];
  result: AgentResult;
}) {
  const ranking = result.auction?.evaluation.ranking ?? result.ranking ?? [];
  const winnerName = auction.winner ?? result.vendor;
  const winnerAnchor =
    result.auction?.anchors.find((a) => a.vendor === winnerName) ?? anchorFor(auction, winnerName ?? "");
  const saved =
    winnerAnchor && winnerAnchor.publishedPrice > result.price
      ? winnerAnchor.publishedPrice - result.price
      : 0;

  return (
    <div>
      <SceneHeader
        kicker="Auction complete"
        title="How the bidding war ended"
        sub="Final bids ranked by the judge — price, fit, value and credibility."
      />

      {saved > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-accept-border bg-accept-subtle px-3.5 py-1.5 text-[0.84rem] font-medium text-accept-text">
          💸 Saved SGD {saved.toFixed(2)} vs {winnerName}&apos;s published fare of SGD{" "}
          {winnerAnchor!.publishedPrice.toFixed(2)}
        </p>
      )}

      {ranking.length > 0 && (
        <div className="mt-6">
          <RankingList ranking={ranking} winner={winnerName} />
        </div>
      )}

      {/* Round-by-round transcript (real bids) */}
      {result.negotiation && result.negotiation.length > 0 && (
        <>
          <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Bidding transcript
          </p>
          <div className="mt-3 space-y-4">
            {result.negotiation.map((round, ri) => (
              <div key={ri}>
                <p className="mb-2 text-[0.78rem] font-semibold text-accent-blue">{round.round}</p>
                <div className="space-y-2">
                  {round.entries.map((e, ei) => (
                    <div
                      key={ei}
                      className="tk-rise rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-2.5"
                      style={{ animationDelay: `${ei * 60}ms` }}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">
                        {e.speaker}
                      </span>
                      <p className="mt-0.5 text-[0.82rem] leading-snug text-text-secondary">{e.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
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

// ── Shared ranking bars ──────────────────────────────────────────────────────
function RankingList({
  ranking,
  winner,
}: {
  ranking: Array<{ vendor: string; item?: string; price: number; score: number; reasoning: string }>;
  winner?: string;
}) {
  const sorted = [...ranking].sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-3">
      {sorted.map((r, i) => {
        const isWinner = r.vendor === winner || (i === 0 && !winner);
        return (
          <div
            key={r.vendor + i}
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
                <span className="text-[0.95rem] font-semibold text-text-primary">{r.vendor}</span>
                <span className="text-[0.82rem] text-text-muted">
                  SGD {Number(r.price).toFixed(2)}
                </span>
              </div>
              <span className="font-mono text-[0.95rem] font-semibold tabular-nums text-text-primary">
                {r.score}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="tk-bar h-full rounded-full bg-accent-blue"
                style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }}
              />
            </div>
            {r.reasoning && (
              <p className="mt-2 text-[0.78rem] leading-snug text-text-muted">{r.reasoning}</p>
            )}
          </div>
        );
      })}
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
