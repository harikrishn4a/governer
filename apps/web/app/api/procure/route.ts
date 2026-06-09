import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { intent, contractId } = body as { intent?: string; contractId?: string };

  if (!intent?.trim()) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 });
  }

  const agentsUrl = process.env.AGENTS_BASE_URL ?? "http://localhost:4000";

  const res = await fetch(`${agentsUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: intent.trim(), contractId }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? "Agent pipeline failed" }, { status: res.status });
  }

  return NextResponse.json(data);
}
