import { fetchFoodpandaMenu } from "@/app/lib/exa";
import { openai } from "@/app/lib/openai";

export interface RawItem {
  name: string;
  price?: number;
  description?: string;
  tags?: string[];
}

export interface ImportResult {
  source: "foodpanda" | "shopify" | "unknown";
  items: RawItem[];
}

const MAX_ITEMS = 24;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Pull a foodpanda vendor code out of a URL or accept a bare code.
function extractFoodpandaCode(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/\/(?:restaurant|chain)\/([a-z0-9]+)/i);
  if (m) return m[1];
  if (/foodpanda/i.test(trimmed)) return null; // a foodpanda URL with no code → not importable
  if (/^[a-z0-9]{4,8}$/i.test(trimmed)) return trimmed; // bare vendor code
  return null;
}

function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Most Shopify stores expose a public, no-auth catalog at /products.json.
async function fetchShopify(url: string): Promise<RawItem[] | null> {
  let origin: string;
  try {
    origin = new URL(url.startsWith("http") ? url : `https://${url}`).origin;
  } catch {
    return null;
  }
  try {
    const res = await fetch(`${origin}/products.json?limit=250`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { products?: ShopifyProduct[] };
    if (!Array.isArray(json.products) || json.products.length === 0) return null;
    return json.products.slice(0, MAX_ITEMS).map((p) => {
      const tagList = Array.isArray(p.tags)
        ? p.tags
        : typeof p.tags === "string"
        ? p.tags.split(",").map((t) => t.trim())
        : [];
      return {
        name: p.title,
        price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : undefined,
        description: stripHtml(p.body_html || "").slice(0, 400),
        tags: [p.product_type, ...tagList].filter((t): t is string => !!t).slice(0, 5),
      };
    });
  } catch {
    return null;
  }
}

interface ShopifyProduct {
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  variants?: { price?: string }[];
}

// The foodpanda helper returns formatted markdown; turn it into structured items.
async function parseFoodpandaItems(rawMenu: string): Promise<RawItem[]> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Extract menu items from the text into JSON of shape {"items":[{"name":string,"price":number,"description":string}]}. Prices are in SGD as numbers. Include a short description if present. Return at most 24 items, no commentary.',
      },
      { role: "user", content: rawMenu.slice(0, 9000) },
    ],
  });
  try {
    const j = JSON.parse(res.choices[0].message.content || "{}");
    return Array.isArray(j.items) ? (j.items as RawItem[]).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export async function importCatalog(url: string): Promise<ImportResult> {
  const code = extractFoodpandaCode(url);
  if (code) {
    const raw = await fetchFoodpandaMenu(code);
    if (raw && raw.length > 50) {
      const items = await parseFoodpandaItems(raw);
      if (items.length) return { source: "foodpanda", items };
    }
  }
  const shop = await fetchShopify(url);
  if (shop && shop.length) return { source: "shopify", items: shop };
  return { source: "unknown", items: [] };
}
