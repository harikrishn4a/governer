import { NextRequest, NextResponse } from "next/server";
import { updateContract, deleteContract } from "@/lib/db";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (shouldProxyToEc2()) return proxyToEc2(req, `/api/contracts/${params.id}`);
  try {
    const body = await req.json();
    const updated = await updateContract(params.id, body);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PATCH /api/contracts/:id]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (shouldProxyToEc2()) return proxyToEc2(req, `/api/contracts/${params.id}`);
  try {
    const { archived } = await deleteContract(params.id);
    return NextResponse.json({ ok: true, archived });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/contracts/:id]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
