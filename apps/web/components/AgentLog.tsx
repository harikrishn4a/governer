"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/useAgentStream";

/** ISO timestamp → HH:MM:SS (24h), the terminal-style clock for each line. */
function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

/* The status dot — pending pulses (broadcast ring), complete is a solid green
 * dot, error is a solid red dot. Pulse uses transform/opacity only (MOTION.md). */
function StatusDot({ status }: { status: LogEntry["status"] }) {
  if (status === "error") {
    return <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-block" aria-label="error" />;
  }
  if (status === "pending") {
    return (
      <span className="relative mt-[7px] block h-2 w-2 shrink-0" aria-label="in progress">
        <span className="absolute inset-0 rounded-full bg-accent-blue/70 animate-ping-ring" />
        <span className="absolute inset-0 rounded-full bg-accent-blue animate-heartbeat" />
      </span>
    );
  }
  return <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-accept" aria-label="done" />;
}

/**
 * B3 — live agent log feed. Vertical feed, newest at the bottom, auto-scrolling
 * as lines arrive. Each line: status dot · message (ui font) · HH:MM:SS (mono,
 * muted). New lines slide in from the right + fade (MOTION.md `log-in`); a batch
 * staggers 80ms, a single live arrival animates immediately.
 */
export default function AgentLog({ logs }: { logs: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  // The render reads the previously-committed count so only *newly added* lines
  // stagger; the effect then records the new count for the next arrival.
  const baseCount = prevCount.current;
  useEffect(() => {
    prevCount.current = logs.length;
  });

  // Pin scroll to the newest line.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-3 shrink-0 text-overline uppercase text-text-muted">Agent activity</p>

      {logs.length === 0 ? (
        <p className="text-caption text-text-muted">Waiting for agents…</p>
      ) : (
        <ol className="scroll-custom min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {logs.map((log, i) => {
            const delay = Math.max(0, i - baseCount) * 80; // 80ms stagger for new batch
            return (
              <li
                key={log.id}
                className="animate-log-in flex items-start gap-3"
                style={{ animationDelay: `${delay}ms` }}
              >
                <StatusDot status={log.status} />
                <span className="min-w-0 flex-1 break-words font-sans text-body leading-snug text-text-secondary">
                  {log.message}
                </span>
                <time className="shrink-0 pt-px font-mono text-mono-sm tabular-nums text-text-muted">
                  {formatClock(log.timestamp)}
                </time>
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
      )}
    </div>
  );
}
