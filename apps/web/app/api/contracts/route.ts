import { NextRequest, NextResponse } from "next/server";
import { getAllContracts, createContract } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/contracts");
  try {
    const contracts = await getAllContracts();
    return NextResponse.json(contracts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/contracts]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/contracts");
  try {
    const body = await req.json();

    if (body.flexibility_rules) {
      const rules = body.flexibility_rules;
      if (!rules.price || !rules.vendor || !rules.intent || !Array.isArray(rules.custom)) {
        return NextResponse.json(
          { error: "flexibilityRules must include price, vendor, intent, and custom fields" },
          { status: 400 }
        );
      }
    }

    const contract = await createContract(body);
    return NextResponse.json(contract, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/contracts]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
