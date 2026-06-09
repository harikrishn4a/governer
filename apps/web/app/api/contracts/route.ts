import { NextRequest, NextResponse } from "next/server";
import { getAllContracts, createContract } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
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
  try {
    const body = await req.json();
    const contract = await createContract(body);
    return NextResponse.json(contract, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/contracts]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
