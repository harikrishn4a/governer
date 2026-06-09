import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  const agentsUrl = process.env.AGENTS_BASE_URL ?? "http://localhost:4000";

  const res = await fetch(`${agentsUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: intent.trim(), contractId: contractId.trim(), mode: mode ?? "find" }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.detail ?? data.error ?? "Agent pipeline failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
