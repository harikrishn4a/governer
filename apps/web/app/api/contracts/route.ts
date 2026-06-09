import { NextRequest, NextResponse } from "next/server";
import { getAllContracts, createContract } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const contracts = await getAllContracts();
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contract = await createContract(body);
  return NextResponse.json(contract, { status: 201 });
}
