import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
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

  // One id used end-to-end: the SSE channel key AND the DB transaction id.
  const transactionId = randomUUID();
  const agentsUrl = process.env.AGENTS_BASE_URL ?? "http://localhost:4000";

  // Dispatch agents /run in the background; waitUntil keeps the work alive on Vercel serverless.
  waitUntil(
    fetch(`${agentsUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txId: transactionId,
        intent: intent.trim(),
        contractId: contractId.trim(),
        mode: mode ?? "find",
      }),
      // Auction worst case (anchor discovery + 2 bidding rounds + judge +
      // governance) can exceed find mode's envelope — allow 180s.
      signal: AbortSignal.timeout(180_000),
    }).catch((err) => {
      console.error("[procure] agents /run dispatch failed", transactionId, String(err));
    })
  );

  return NextResponse.json({ transactionId });
}
