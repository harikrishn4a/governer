import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const transactions = await getAllTransactions();
  return NextResponse.json(transactions);
}
