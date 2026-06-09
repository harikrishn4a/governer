import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { transactionId, approvedBy } = body as { transactionId?: string; approvedBy?: string };

  if (!transactionId) {
    return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
  }

  const agentsUrl = process.env.AGENTS_BASE_URL ?? "http://localhost:4000";

  const res = await fetch(`${agentsUrl}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId, approvedBy: approvedBy ?? "web-user" }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? "Override failed" }, { status: res.status });
  }

  return NextResponse.json(data);
}
