import { NextRequest, NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/transactions");

  try {
    const contractId = new URL(req.url).searchParams.get("contractId") ?? undefined;
    const transactions = await getAllTransactions(contractId);
    return NextResponse.json(transactions, { headers: NO_STORE });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/transactions]", msg);
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE });
  }
}
