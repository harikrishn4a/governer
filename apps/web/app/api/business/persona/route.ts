import { NextRequest, NextResponse } from "next/server";
import { getBusiness, upsertBusiness, AgentPersona } from "@/app/lib/store";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

export async function POST(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/business/persona");

  let body: { businessId?: string; persona?: AgentPersona };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { businessId, persona } = body;
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const business = getBusiness(businessId);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Sanitise / whitelist the incoming persona fields.
  const clean: AgentPersona = {
    tone: typeof persona?.tone === "string" ? persona.tone : undefined,
    languageStyle: typeof persona?.languageStyle === "string" ? persona.languageStyle : undefined,
    dietary: asStringArray(persona?.dietary),
    languages: asStringArray(persona?.languages),
    emphasis: asStringArray(persona?.emphasis),
    tagline: typeof persona?.tagline === "string" ? persona.tagline.slice(0, 200) : undefined,
    notes: typeof persona?.notes === "string" ? persona.notes.slice(0, 1000) : undefined,
  };

  business.persona = clean;
  upsertBusiness(business);

  return NextResponse.json({ success: true, persona: clean });
}
