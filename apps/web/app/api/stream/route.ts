import { NextRequest } from "next/server";
import { subscribe, getEvents, type StoredEvent } from "@/lib/stream-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function isGovernanceComplete(e: StoredEvent): boolean {
  return e.type === "agent:complete" && e.agent === "governance";
}

// GET /api/stream?txId=... — Server-Sent Events for one transaction.
// Replays events so far (reconnection-safe), streams new ones, heartbeats every
// 15s, and closes once governance:complete fires.
export async function GET(req: NextRequest) {
  const txId = new URL(req.url).searchParams.get("txId");
  if (!txId) {
    return new Response("txId query param is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe: (() => void) | undefined;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (e: StoredEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          cleanup();
        }
      };

      // 1) Replay everything so far (covers late joiners / reconnects).
      const history = getEvents(txId);
      for (const e of history) send(e);

      // 2) If it already finished, flush and close immediately.
      if (history.some(isGovernanceComplete)) {
        cleanup();
        return;
      }

      // 3) Subscribe to future events; close when governance completes.
      unsubscribe = subscribe(txId, (e) => {
        send(e);
        if (isGovernanceComplete(e)) cleanup();
      });

      // 4) Heartbeat keeps proxies/load balancers from dropping the connection.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      // 5) Client disconnected.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
