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
    } else if (e.type === "agent:start" && e.agent === "governance") {
      phase = "verifying";
    } else if (isGovComplete(e)) {
      phase = "complete";
    }
  }

  return { phase, vendors, winner };
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
  const logs = useMemo(() => deriveLogs(events), [events]);
  const result = useMemo(() => {
    const e = events.find(isGovComplete);
    return e ? (e.data as AgentResult) : undefined;
  }, [events]);
  const isComplete = useMemo(
    () => events.some((e) => isGovComplete(e) || e.type === "error"),
    [events]
  );

  return { events, graphState, logs, result, isComplete };
}
