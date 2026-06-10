import { NextRequest, NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/transactions");
  try {
    const transactions = await getAllTransactions();
    return NextResponse.json(transactions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/transactions]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
