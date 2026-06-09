import { NextRequest, NextResponse } from "next/server";
import { updateContract } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = await updateContract(params.id, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await updateContract(params.id, { active: false });
  return NextResponse.json({ ok: true });
}
