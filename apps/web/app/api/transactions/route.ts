import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const transactions = await getAllTransactions();
    return NextResponse.json(transactions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/transactions]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
