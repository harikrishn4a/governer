import { NextRequest, NextResponse } from "next/server";
import { getBusiness, upsertBusiness } from "@/app/lib/store";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

function extractVendorCode(input: string): string {
  const trimmed = input.trim();
  // Match foodpanda URL patterns: /restaurant/CODE/... or /chain/CODE/...
  const match = trimmed.match(/\/(?:restaurant|chain)\/([a-z0-9]+)/i);
  if (match) return match[1];
  // Otherwise treat as raw code (strip any query string, hash, slashes or whitespace)
  return trimmed.split(/[?#/\s]/)[0];
}

export async function POST(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/business/menu");

  const { businessId, foodpandaCode } = await req.json();
  const business = getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  business.foodpandaCode = extractVendorCode(foodpandaCode);
  upsertBusiness(business);
  return NextResponse.json({ success: true, code: business.foodpandaCode });
}
