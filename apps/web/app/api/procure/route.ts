import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Kicks off the agent pipeline and returns a transactionId immediately. The
// pipeline's progress and final result arrive over SSE (GET /api/stream?txId=).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { intent, contractId, mode } = body as {
    intent?: string;
    contractId?: string;
    mode?: "find" | "auction";
  };

  if (!intent?.trim()) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 });
  }
  if (!contractId?.trim()) {
    return NextResponse.json({ error: "contractId is required — select a spending contract" }, { status: 400 });
  }
  if (mode === "auction") {
    return NextResponse.json(
      { error: "Auction mode is not implemented yet. Switch to Find mode for the burger demo." },
      { status: 501 }
    );
  }

  // One id used end-to-end: the SSE channel key AND the DB transaction id.
  const transactionId = randomUUID();
  const agentsUrl = process.env.AGENTS_BASE_URL ?? "http://localhost:4000";

  // Fire-and-forget: the agents /run only responds after the full pipeline, but
  // we don't await it — events stream back via /api/stream/ingest meanwhile.
  // (Works on a persistent Node server / local dev; a serverless host would need
  // waitUntil() to keep the request alive — noted in B1-COMPLETE.md.)
  fetch(`${agentsUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txId: transactionId, intent: intent.trim(), contractId: contractId.trim(), mode: mode ?? "find" }),
    signal: AbortSignal.timeout(120_000),
  }).catch((err) => {
    console.error("[procure] agents /run dispatch failed", transactionId, String(err));
  });

  return NextResponse.json({ transactionId });
}
