import { NextRequest, NextResponse } from "next/server";
import { getTransaction } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (shouldProxyToEc2()) return proxyToEc2(req, `/api/transactions/${params.id}`);
  const tx = await getTransaction(params.id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}
