import { logger } from "./logger";
import type { AgentEvent } from "../agents/types";

function ingestTargets(): string[] {
  const urls = [process.env.WEB_URL ?? "http://localhost:3000"];
  const extra = process.env.WEB_URL_EXTRA?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return [...new Set([...urls, ...extra])];
}

export type EmitFn = (e: AgentEvent) => Promise<void>;

/**
 * Returns an emit function bound to a transaction id. Each call POSTs the event
 * to the web app's /api/stream/ingest endpoint, which fans it out over SSE.
 *
 * Failures are logged and swallowed — telemetry must never break the pipeline.
 * Calls are awaited so events arrive in emission order.
 */
export function createEmitter(txId: string): EmitFn {
  return async (event: AgentEvent) => {
    try {
      await Promise.allSettled(
        ingestTargets().map((base) =>
          fetch(`${base}/api/stream/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txId, ...event }),
            signal: AbortSignal.timeout(5000),
          })
        )
      );
    } catch (err) {
      logger.warn("event-bus:ingest-failed", {
        txId,
        type: event.type,
        agent: event.agent,
        error: String(err),
      });
    }
  };
}
