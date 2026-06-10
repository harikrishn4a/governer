"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredEvent } from "@/lib/stream-store";

export type Phase =
  | "idle"
  | "broadcasting"
  | "pitching"
  | "deciding"
  | "verifying"
  | "complete";

export interface GraphState {
  phase: Phase;
  vendors: string[];
  winner?: string;
}

// One line in the live agent feed (consumed by components/AgentLog.tsx).
export interface LogEntry {
  id: string;
  message: string;
  timestamp: string; // ISO — AgentLog formats to HH:MM:SS
  status: "pending" | "complete" | "error";
}

// ── Auction mode ─────────────────────────────────────────────────────────────

export type AuctionPhase = "idle" | "tender" | "bidding" | "judging" | "verifying" | "complete";

export interface AnchorView {
  vendor: string;
  publishedPrice: number;
  itemSummary: string;
  sourceUrl?: string;
}

export interface BidView {
  vendor: string;
  round: number;
  price: number;
  previousPrice?: number; // round-1 price once a round-2 counter-bid lands
  valueAdds: string[];
  pitch: string;
  canImprove: boolean;
  conditions?: string;
  carriedForward?: boolean;
}

export interface AuctionState {
  phase: AuctionPhase;
  round: number;
  vendors: string[];
  anchors: AnchorView[];
  skipped: Array<{ vendor: string; reason: string }>;
  bids: Record<string, BidView>; // latest bid per vendor
  bidHistory: BidView[];
  ranking?: Array<{ vendor: string; score: number; price: number; reasoning: string }>;
  verdict?: string;
  winner?: string;
}

// Shape of the governance:complete event's `data` — the full result for the UI.
export interface AgentResult {
  transactionId: string;
  decision: "ACCEPT" | "BLOCK";
  vendor: string;
  item: string;
  price: number;
  currency: string;
  rationale: string;
  checkedRules: Array<{ rule: string; passed: boolean; detail: string }>;
  requiresHumanReview: boolean;
  stripePaymentIntentId?: string | null;
  procurementRationale: string;
  contractId?: string;
  contractName?: string;
  contractBudgetCap?: number;
  contractBudgetPeriod?: string;
  pitches?: unknown[];
  options?: unknown[];
  // Real negotiation transcript + ranked scoreboard from the negotiation API.
  negotiation?: Array<{ round: string; entries: Array<{ speaker: string; message: string }> }>;
  ranking?: Array<{ vendor: string; item: string; price: number; score: number; withinBudget: boolean; reasoning: string }>;
  // Auction mode extras (present when the run was an auction).
  mode?: "find" | "auction";
  auction?: {
    anchors: Array<{ vendor: string; publishedPrice: number; itemSummary: string; sourceUrl: string }>;
    skipped: Array<{ vendor: string; reason: string }>;
    bidders: Array<{ slug: string; name: string; source: "prebuilt" | "researched" }>;
    rounds: Array<{ round: number; kind: string; bids: Array<{ vendor: string; price: number; valueAdds: string[]; pitch: string; conditions?: string }> }>;
    evaluation: { ranking: Array<{ vendor: string; item: string; price: number; score: number; withinBudget: boolean; reasoning: string }>; verdict: string };
  };
}

function isGovComplete(e: StoredEvent): boolean {
  return e.type === "agent:complete" && e.agent === "governance";
}

function deriveGraph(events: StoredEvent[]): GraphState {
  let phase: Phase = "idle";
  let vendors: string[] = [];
  let winner: string | undefined;

  for (const e of events) {
    const d = (e.data ?? {}) as { vendors?: string[]; vendor?: string };
    if (e.type === "agent:start" && e.agent === "procurement") {
      phase = "broadcasting";
    } else if (e.type === "agent:complete" && e.agent === "discovery") {
      phase = "broadcasting";
      if (Array.isArray(d.vendors)) vendors = d.vendors;
    } else if (e.type === "agent:start" && e.agent.startsWith("supplier")) {
      if (phase === "broadcasting") phase = "pitching";
    } else if (e.type === "agent:complete" && e.agent === "procurement") {
      phase = "deciding";
      winner = d.vendor;
    } else if (e.type === "agent:start" && e.agent === "auction") {
      phase = "broadcasting";
    } else if (e.type === "agent:complete" && e.agent === "tender") {
      phase = "broadcasting";
      if (Array.isArray(d.vendors)) vendors = d.vendors;
    } else if (e.type === "auction:round_start") {
      phase = "pitching";
    } else if (e.type === "agent:start" && e.agent === "auction_judge") {
      phase = "deciding";
    } else if (e.type === "agent:complete" && e.agent === "auction_judge") {
      phase = "deciding";
      const dj = (e.data ?? {}) as { winner?: string };
      if (dj.winner) winner = dj.winner;
    } else if (e.type === "agent:start" && e.agent === "governance") {
      phase = "verifying";
    } else if (isGovComplete(e)) {
      phase = "complete";
    }
  }

  return { phase, vendors, winner };
}

function deriveAuction(events: StoredEvent[]): AuctionState {
  const state: AuctionState = {
    phase: "idle",
    round: 0,
    vendors: [],
    anchors: [],
    skipped: [],
    bids: {},
    bidHistory: [],
  };

  for (const e of events) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    if (e.type === "agent:start" && e.agent === "auction") {
      state.phase = "tender";
    } else if (e.type === "agent:complete" && e.agent === "tender") {
      state.phase = "tender";
      if (Array.isArray(d.vendors)) state.vendors = d.vendors as string[];
    } else if (e.type === "auction:anchor") {
      state.anchors.push({
        vendor: String(d.vendor ?? ""),
        publishedPrice: Number(d.publishedPrice ?? 0),
        itemSummary: String(d.itemSummary ?? ""),
        sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : undefined,
      });
    } else if (e.type === "bidder:skipped") {
      state.skipped.push({ vendor: String(d.vendor ?? ""), reason: String(d.reason ?? "") });
    } else if (e.type === "auction:round_start") {
      state.phase = "bidding";
      state.round = Number(d.round ?? state.round);
    } else if (e.type === "auction:bid") {
      const prior = state.bids[String(d.vendor ?? "")];
      const bid: BidView = {
        vendor: String(d.vendor ?? ""),
        round: Number(d.round ?? state.round),
        price: Number(d.price ?? 0),
        previousPrice: prior && prior.round < Number(d.round ?? 0) ? prior.price : prior?.previousPrice,
        valueAdds: Array.isArray(d.valueAdds) ? (d.valueAdds as string[]) : [],
        pitch: String(d.pitch ?? ""),
        canImprove: Boolean(d.canImprove),
        conditions: typeof d.conditions === "string" && d.conditions ? d.conditions : undefined,
        carriedForward: Boolean(d.carriedForward),
      };
      state.bids[bid.vendor] = bid;
      state.bidHistory.push(bid);
    } else if (e.type === "agent:start" && e.agent === "auction_judge") {
      state.phase = "judging";
    } else if (e.type === "agent:complete" && e.agent === "auction_judge") {
      state.phase = "judging";
      if (typeof d.winner === "string") state.winner = d.winner;
      if (typeof d.verdict === "string") state.verdict = d.verdict;
      if (Array.isArray(d.ranking)) {
        state.ranking = (d.ranking as Array<{ vendor?: string; score?: number; price?: number; reasoning?: string }>).map((r) => ({
          vendor: r.vendor ?? "",
          score: r.score ?? 0,
          price: r.price ?? 0,
          reasoning: r.reasoning ?? "",
        }));
      }
    } else if (e.type === "agent:start" && e.agent === "governance") {
      state.phase = "verifying";
    } else if (isGovComplete(e)) {
      state.phase = "complete";
    }
  }

  return state;
}

function toLog(e: StoredEvent): string | null {
  const d = (e.data ?? {}) as {
    count?: number;
    vendor?: string;
    item?: string;
    price?: number;
    decision?: string;
    message?: string;
  };
  if (e.type === "agent:start" && e.agent === "procurement") return "Generating broadcast…";
  if (e.type === "agent:complete" && e.agent === "discovery") return `${d.count ?? "Several"} options received`;
  if (e.type === "agent:start" && e.agent === "supplier_0") return "Vendors are pitching their offers";
  if (e.type === "agent:start" && e.agent.startsWith("supplier")) return null; // dedupe extra suppliers
  if (e.type === "agent:complete" && e.agent === "procurement")
    return `Recommended: ${d.vendor} — ${d.item} (${d.price} SGD)`;
  if (e.type === "agent:start" && e.agent === "governance") return "Verifying contract rules…";
  if (isGovComplete(e)) return d.decision === "ACCEPT" ? "✓ Transaction accepted" : "✗ Transaction blocked";
  if (e.type === "error") return `⚠ ${d.message ?? "Pipeline error"}`;

  // ── Auction mode lines ──
  const a = (e.data ?? {}) as {
    vendors?: string[];
    vendor?: string;
    publishedPrice?: number;
    reason?: string;
    round?: number;
    kind?: string;
    price?: number;
    conditions?: string;
    winner?: string;
    carriedForward?: boolean;
  };
  if (e.type === "agent:start" && e.agent === "auction") return "Drafting tender broadcast…";
  if (e.type === "agent:complete" && e.agent === "tender")
    return `Tender broadcast to ${a.vendors?.length ?? "several"} vendors`;
  if (e.type === "auction:anchor")
    return `${a.vendor} published fare: SGD ${a.publishedPrice}`;
  if (e.type === "bidder:skipped") return `${a.vendor} skipped — ${a.reason}`;
  if (e.type === "auction:round_start")
    return a.kind === "sealed" ? `Round ${a.round} — sealed bids` : `Round ${a.round} — best & final offers`;
  if (e.type === "auction:bid") {
    if (a.carriedForward) return `${a.vendor} holds at SGD ${a.price}`;
    const urgency = a.conditions ? ` (${a.conditions})` : "";
    return a.round && a.round > 1
      ? `${a.vendor} counters: SGD ${a.price}${urgency}`
      : `${a.vendor} bids SGD ${a.price}`;
  }
  if (e.type === "auction:round_complete") return null;
  if (e.type === "agent:start" && e.agent === "auction_judge") return "Judge evaluating final bids…";
  if (e.type === "agent:complete" && e.agent === "auction_judge")
    return a.winner ? `Judge: ${a.winner} wins the tender` : "Judge has ranked the bids";
  return null;
}

/**
 * Maps the raw event stream to feed lines with a lifecycle status:
 *  - error / blocked decision → "error" (red dot)
 *  - the most recent line     → "pending" (pulsing dot) until the stream terminates
 *  - everything earlier        → "complete" (solid dot)
 */
function deriveLogs(events: StoredEvent[]): LogEntry[] {
  const terminal = events.some((e) => isGovComplete(e) || e.type === "error");
  const out: LogEntry[] = [];

  for (const e of events) {
    const message = toLog(e);
    if (message === null) continue;
    const d = (e.data ?? {}) as { decision?: string };
    const isError = e.type === "error" || (isGovComplete(e) && d.decision === "BLOCK");
    out.push({
      id: String(e.seq ?? `${e.agent}-${e.timestamp}`),
      message,
      timestamp: e.timestamp,
      status: isError ? "error" : "complete",
    });
  }

  // Newest line keeps pulsing until governance completes (or errors).
  const last = out[out.length - 1];
  if (!terminal && last && last.status === "complete") {
    out[out.length - 1] = { ...last, status: "pending" };
  }
  return out;
}

/**
 * Subscribes to /api/stream?txId= for the given transaction and derives UI state
 * from the agent events. Closes the stream on governance:complete.
 */
export function useAgentStream(transactionId: string | null | undefined) {
  const [events, setEvents] = useState<StoredEvent[]>([]);

  useEffect(() => {
    if (!transactionId) return;
    setEvents([]);
    const seen = new Set<number>();
    const es = new EventSource(`/api/stream?txId=${encodeURIComponent(transactionId)}`);

    es.onmessage = (msg) => {
      let e: StoredEvent;
      try {
        e = JSON.parse(msg.data) as StoredEvent;
      } catch {
        return;
      }
      if (typeof e.seq === "number") {
        if (seen.has(e.seq)) return; // de-dupe replays / reconnects
        seen.add(e.seq);
      }
      setEvents((prev) => [...prev, e]);
      if (isGovComplete(e)) es.close();
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; nothing to do here.
      // Once we've closed on completion, the browser won't reconnect.
    };

    return () => es.close();
  }, [transactionId]);

  const graphState = useMemo(() => deriveGraph(events), [events]);
  const auctionState = useMemo(() => deriveAuction(events), [events]);
  const logs = useMemo(() => deriveLogs(events), [events]);
  const result = useMemo(() => {
    const e = events.find(isGovComplete);
    return e ? (e.data as AgentResult) : undefined;
  }, [events]);
  const isComplete = useMemo(
    () => events.some((e) => isGovComplete(e) || e.type === "error"),
    [events]
  );

  return { events, graphState, auctionState, logs, result, isComplete };
}
