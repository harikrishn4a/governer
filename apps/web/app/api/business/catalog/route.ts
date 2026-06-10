import { NextRequest, NextResponse } from "next/server";
import { getBusiness, upsertBusiness, Business, CatalogItem } from "@/app/lib/store";

function asItems(v: unknown): CatalogItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = x as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!name) return null;
      const price =
        typeof o.price === "number" ? o.price : typeof o.price === "string" && o.price.trim() !== "" ? parseFloat(o.price) : undefined;
      const description = typeof o.description === "string" ? o.description.trim() : undefined;
      const tags = Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : undefined;
      return { name, price: Number.isFinite(price) ? price : undefined, description, tags } as CatalogItem;
    })
    .filter((x): x is CatalogItem => x !== null)
    .slice(0, 60);
}

// Render the catalog into the knowledge text the negotiation agents read.
function buildKnowledge(name: string, items: CatalogItem[]): string {
  const lines = items.map((it) => {
    const price = typeof it.price === "number" ? ` — ${it.price.toFixed(2)}` : "";
    const desc = it.description ? `: ${it.description}` : "";
    const tags = it.tags && it.tags.length ? ` [${it.tags.join(", ")}]` : "";
    return `- ${it.name}${price}${desc}${tags}`;
  });
  return `Catalog for ${name} (${items.length} items):\n${lines.join("\n")}`;
}

export async function POST(req: NextRequest) {
  let body: { businessId?: string; businessName?: string; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { businessId, businessName } = body;
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const items = asItems(body.items);
  if (items.length === 0) return NextResponse.json({ error: "No valid catalog items to save." }, { status: 400 });

  const business: Business =
    getBusiness(businessId) || {
      id: businessId,
      name: businessName || "Unnamed Business",
      knowledge: "",
      isReady: false,
      conversationHistory: [],
    };

  if (businessName) business.name = businessName;
  business.catalog = items;
  business.knowledge = buildKnowledge(business.name, items);
  business.isReady = true; // a real catalog is enough to represent the business

  upsertBusiness(business);
  return NextResponse.json({ success: true, count: items.length });
}
