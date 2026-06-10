import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

export async function searchReviews(businessName: string): Promise<string> {
  try {
    const result = await exa.searchAndContents(`${businessName} Singapore restaurant reviews`, {
      numResults: 3,
      text: true,
    });
    return result.results
      .map((r) => `[${r.title}](${r.url})\n${r.text?.slice(0, 500)}`)
      .join("\n\n---\n\n");
  } catch {
    return "No reviews found.";
  }
}

interface FoodpandaOption {
  name: string;
  price: number;
  is_sold_out: boolean;
}

interface FoodpandaTopping {
  name: string;
  options: FoodpandaOption[];
  quantity_minimum: number;
  quantity_maximum: number;
}

interface FoodpandaProduct {
  name: string;
  description: string;
  is_sold_out: boolean;
  product_variations: { price: number; topping_ids: number[] }[];
}

interface FoodpandaCategory {
  name: string;
  products: FoodpandaProduct[];
}

export async function fetchFoodpandaMenu(vendorCode: string): Promise<string> {
  try {
    const url = `https://sg.fd-api.com/api/v5/vendors/${vendorCode}?include=menus&language_id=1&dynamic_pricing=0&opening_type=delivery`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "x-fp-api-key": "volo",
        "Perseus-Client-Id": "foodpanda_sg",
        "Perseus-Session-Id": "menu-fetch",
      },
    });
    if (!response.ok) {
      console.warn(`[foodpanda] vendor "${vendorCode}" returned HTTP ${response.status} — falling back to web search`);
      return "";
    }

    const json = await response.json();
    const menu = json.data?.menus?.[0];
    if (!menu) {
      console.warn(`[foodpanda] vendor "${vendorCode}" had no menu data — falling back to web search`);
      return "";
    }

    const categories: FoodpandaCategory[] = menu.menu_categories || [];
    const toppingsMap: Record<string, FoodpandaTopping> = menu.toppings || {};

    // Build menu with items
    let output = categories.map((cat) => {
      const items = cat.products.filter((p) => !p.is_sold_out).map((p) => {
        const price = p.product_variations[0]?.price;
        const toppingIds = p.product_variations[0]?.topping_ids || [];
        let line = `- ${p.name}: S$${price?.toFixed(2) || "N/A"}`;
        if (p.description) line += ` — ${p.description}`;
        return line;
      }).join("\n");
      return `**${cat.name}**\n${items}`;
    }).join("\n\n");

    // Add available customizations/toppings section
    const toppingGroups = Object.values(toppingsMap);
    const paidToppings = toppingGroups.filter((t) =>
      t.options?.some((o) => o.price > 0 && !o.is_sold_out)
    );
    if (paidToppings.length > 0) {
      output += "\n\n**Add-ons & Customizations (paid)**";
      for (const group of paidToppings.slice(0, 15)) {
        const opts = group.options
          .filter((o) => o.price > 0 && !o.is_sold_out)
          .map((o) => `${o.name} +S$${o.price.toFixed(2)}`)
          .join(", ");
        if (opts) output += `\n- ${group.name}: ${opts}`;
      }
    }

    return output;
  } catch (err) {
    console.warn(`[foodpanda] fetch failed for vendor "${vendorCode}":`, err);
    return "";
  }
}

export async function searchMenu(businessName: string): Promise<string> {
  try {
    // Run multiple targeted searches in parallel to maximize menu coverage
    const queries = [
      `"${businessName}" Singapore menu prices`,
      `${businessName} Singapore foodpanda deliveroo menu price list`,
      `${businessName} Singapore burrito bowl kebab quesadilla salad price`,
    ];

    const allResults = await Promise.all(
      queries.map((q) =>
        exa.searchAndContents(q, { numResults: 4, text: true, livecrawlTimeout: 15000 })
          .then((r) => r.results)
          .catch(() => [])
      )
    );

    // Flatten, dedupe by URL, keep only pages that actually contain prices
    const seen = new Set<string>();
    const priced: { title: string | null; url: string; text?: string }[] = [];
    for (const r of allResults.flat()) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      if (r.text && (r.text.includes("S$") || r.text.match(/\$\s?\d/))) {
        priced.push(r);
      }
    }

    if (priced.length === 0) {
      // fallback: return any results at all
      const any = allResults.flat().slice(0, 2);
      return any.map((r) => `[${r.title}](${r.url})\n${r.text?.slice(0, 1500)}`).join("\n\n---\n\n");
    }

    // Return up to 5 price-containing sources with generous text so AI can compile a full menu
    return priced
      .slice(0, 5)
      .map((r) => `SOURCE: ${r.title} (${r.url})\n${r.text?.slice(0, 2500)}`)
      .join("\n\n=====\n\n");
  } catch {
    return "No menu info found.";
  }
}


export async function searchSpecificItem(businessName: string, item: string): Promise<string> {
  try {
    const result = await exa.searchAndContents(
      `${businessName} Singapore ${item} review price`,
      { numResults: 3, text: true, livecrawlTimeout: 10000 }
    );
    return result.results
      .map((r) => `[${r.title}](${r.url})\n${r.text?.slice(0, 400)}`)
      .join("\n\n---\n\n");
  } catch {
    return "No results found.";
  }
}


// Research a vendor that has no registered agent yet. Pulls general web info
// (about, location, menu, reviews) so we can auto-build a negotiation agent.
export async function searchSupplierInfo(vendorName: string): Promise<string> {
  try {
    const queries = [
      `${vendorName} restaurant about location address`,
      `${vendorName} menu prices`,
      `${vendorName} reviews rating`,
    ];

    const allResults = await Promise.all(
      queries.map((q) =>
        exa
          .searchAndContents(q, { numResults: 3, text: true, livecrawlTimeout: 12000 })
          .then((r) => r.results)
          .catch(() => [])
      )
    );

    const seen = new Set<string>();
    const deduped: { title: string | null; url: string; text?: string }[] = [];
    for (const r of allResults.flat()) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      deduped.push(r);
    }

    if (deduped.length === 0) return "";

    return deduped
      .slice(0, 6)
      .map((r) => `SOURCE: ${r.title} (${r.url})\n${r.text?.slice(0, 2000)}`)
      .join("\n\n=====\n\n");
  } catch {
    return "";
  }
}
