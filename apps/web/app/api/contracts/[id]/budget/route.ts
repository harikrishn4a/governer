import { NextRequest, NextResponse } from "next/server";
import { getContractById, getContractSpend } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (shouldProxyToEc2()) return proxyToEc2(req, `/api/contracts/${params.id}/budget`);
  try {
    const contract = await getContractById(params.id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const cap = parseFloat(contract.budget_cap);
    const spent = await getContractSpend(params.id, contract.budget_period);
    const remaining = Math.max(0, cap - spent);

    return NextResponse.json({
      contractId: contract.id,
      name: contract.name,
      budgetCap: cap,
      budgetPeriod: contract.budget_period,
      spent,
      remaining,
      percentUsed: cap > 0 ? Math.min(100, (spent / cap) * 100) : 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
