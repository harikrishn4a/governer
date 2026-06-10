import { NextRequest, NextResponse } from "next/server";
import { importCatalog, type RawItem } from "@/app/lib/import";
import { openai } from "@/app/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Review {
  needsInfo: boolean;
  question: string;
}

// Ask the model to flag items whose description is missing / too thin / too vague
// to answer a buyer's specific questions, and propose ONE question to the owner.
async function reviewItems(items: RawItem[]): Promise<Review[]> {
  if (items.length === 0) return [];
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are auditing a seller's imported catalog before it goes live. For EACH item decide whether its description is good enough for a buyer's AI agent to answer specific questions about it.\n` +
            `Mark needsInfo=true when the description is empty, very short, or vague — i.e. it omits the details buyers ask about: for FOOD that's key ingredients / allergens / dietary info / portion; for PRODUCTS that's material / dimensions / key specs / what's included.\n` +
            `When needsInfo=true, write ONE short, specific question to ask the owner that would fix it (e.g. "What are the main ingredients and is it halal?" or "What material and dimensions is this chair?"). When the description is already solid, needsInfo=false and question="".\n` +
            `Return JSON {"reviews":[{"needsInfo":boolean,"question":string}]} with EXACTLY one entry per item, in the same order.`,
        },
        {
          role: "user",
          content: JSON.stringify(items.map((i) => ({ name: i.name, description: i.description ?? "" }))),
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    const reviews: Review[] = Array.isArray(parsed.reviews) ? parsed.reviews : [];
    // align to items length
    return items.map((_, i) => ({
      needsInfo: !!reviews[i]?.needsInfo,
      question: typeof reviews[i]?.question === "string" ? reviews[i].question : "",
    }));
  } catch {
    // Fallback heuristic: flag short/empty descriptions.
    return items.map((i) => {
      const thin = !i.description || i.description.trim().length < 40;
      return { needsInfo: thin, question: thin ? `Add more detail about "${i.name}" — key ingredients/specs buyers ask about.` : "" };
    });
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "Paste a Shopify store or foodpanda link." }, { status: 400 });

  const result = await importCatalog(url);
  if (result.items.length === 0) {
    return NextResponse.json(
      {
        error:
          "Couldn't read a catalog from that link. Use a foodpanda restaurant link, or a Shopify store URL (its /products.json must be public).",
      },
      { status: 422 }
    );
  }

  const reviews = await reviewItems(result.items);
  const items = result.items.map((it, i) => ({
    id: i,
    name: it.name,
    price: it.price,
    description: it.description ?? "",
    tags: it.tags ?? [],
    needsInfo: reviews[i]?.needsInfo ?? false,
    question: reviews[i]?.question ?? "",
  }));

  return NextResponse.json({ source: result.source, count: items.length, items });
}
