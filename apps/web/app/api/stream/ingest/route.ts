import { NextRequest, NextResponse } from "next/server";
import { emit, type StreamEvent } from "@/lib/stream-store";

export const runtime = "nodejs";

// Internal endpoint: the agents worker POSTs one agent event here per phase.
// No auth (process-local, internal traffic only) — see B1-COMPLETE.md.
export async function POST(req: NextRequest) {
  let body: { txId?: string; type?: string; agent?: string; data?: unknown; timestamp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { txId, type, agent, data, timestamp } = body;
  if (!txId || !type || !agent) {
    return NextResponse.json({ error: "txId, type and agent are required" }, { status: 400 });
  }

  const event: StreamEvent = {
    type,
    agent,
    data,
    timestamp: timestamp ?? new Date().toISOString(),
  };
  const stored = emit(txId, event);

  return NextResponse.json({ ok: true, seq: stored.seq });
}
