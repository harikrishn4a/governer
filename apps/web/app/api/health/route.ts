import { NextResponse } from "next/server";
import { gatewayStatus, llmRoute } from "@/lib/llm";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    llm: {
      route: llmRoute(),
      gateway: gatewayStatus(),
    },
  });
}
