import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/app/lib/openai";
import { getAllBusinesses, Business } from "@/app/lib/store";
import { searchReviews, searchMenu, fetchFoodpandaMenu, searchSpecificItem } from "@/app/lib/exa";

async function parseMenuWithAI(businessName: string, rawMenu: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a menu compiler. The text below contains menu data for "${businessName}" scraped from MULTIPLE websites (foodpanda, deliveroo, blogs, etc.), separated by "=====".

Your job: MERGE all sources into ONE complete, deduplicated menu. Rules:
- Include EVERY unique menu item found across ALL sources — do not drop items
- Organize by category (e.g. Burritos, Bowls, Kebabs, Quesadillas, Sides, Drinks, Add-ons)
- For each item show: name and price in SGD (S$X.XX)
- If the same item appears in multiple sources with different prices, use the most common/recent one
- If an item has no price, still list it but mark price as "N/A"
- Be exhaustive — a real menu has 30-70+ items. Extract them all.
- Only output the clean menu, no commentary. If truly no menu data exists, say "Menu data unavailable."`,
      },
      { role: "user", content: rawMenu.slice(0, 12000) },
    ],
  });
  return response.choices[0].message.content || "Menu data unavailable.";
}

async function businessAgentPitch(business: Business, userQuery: string, competitors: string[], menuData: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an aggressive AI negotiation agent for "${business.name}". 

YOUR FULL KNOWLEDGE:
${business.knowledge}

YOUR ACTUAL MENU WITH PRICES:
${menuData}

CONVERSATION CONTEXT:
${business.conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

Customer wants: "${userQuery}"
Competitors: ${competitors.join(", ")}

Make a DEEP, SPECIFIC pitch. Reference ACTUAL menu items and REAL prices from your menu above. Address the customer's needs point-by-point. Be aggressive and confident. 4-5 paragraphs.`,
      },
      { role: "user", content: `Why should I choose ${business.name} for: ${userQuery}?` },
    ],
  });
  return response.choices[0].message.content || "";
}

async function userAgentChallenge(
  userQuery: string,
  pitches: { name: string; pitch: string }[],
  webReviews: { name: string; reviews: string }[]
): Promise<string> {
  const pitchSummary = pitches.map((p) => `## ${p.name}\n${p.pitch}`).join("\n\n---\n\n");
  const reviewSummary = webReviews.map((r) => `## ${r.name} (Web Reviews)\n${r.reviews}`).join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the user's skeptical AI agent. The user wants: "${userQuery}"

You've heard the pitches AND you've researched real reviews online. Your job is to challenge each restaurant with tough, specific questions and objections. Point out:
- Claims that seem exaggerated vs what reviews actually say
- Weaknesses you found in reviews
- Specific concerns based on the user's needs
- Price/value concerns

Ask 2-3 hard questions to EACH restaurant. Be adversarial — you're protecting the user's interests.`,
      },
      { role: "user", content: `Pitches:\n${pitchSummary}\n\nReal web reviews I found:\n${reviewSummary}\n\nChallenge each restaurant.` },
    ],
  });
  return response.choices[0].message.content || "";
}

async function businessAgentCounter(
  business: Business,
  challenge: string,
  webReviews: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the AI agent for "${business.name}". The user's agent has challenged you with tough questions and objections. Real web reviews have also been cited.

YOUR KNOWLEDGE:
${business.knowledge}

WEB REVIEWS ABOUT YOU:
${webReviews}

Defend your restaurant. Address each objection directly. Acknowledge valid criticisms but spin them positively. Use specific facts. Be honest but persuasive. Counter every point.`,
      },
      { role: "user", content: challenge },
    ],
  });
  return response.choices[0].message.content || "";
}

async function userAgentVerdict(
  userQuery: string,
  fullNegotiation: { name: string; pitch: string; counter: string }[],
  webReviews: { name: string; reviews: string }[],
  challenge: string,
  menus: { name: string; menu: string }[]
): Promise<{ verdict: string; scores: { name: string; overall: number; price: number; match: number; reviews: number; negotiation: number }[] }> {
  const summary = fullNegotiation
    .map((n) => `## ${n.name}\n**Pitch:** ${n.pitch}\n\n**Response to challenges:** ${n.counter}`)
    .join("\n\n---\n\n");
  const reviewSummary = webReviews.map((r) => `## ${r.name}\n${r.reviews}`).join("\n\n");
  const menuSummary = menus.map((m) => `## ${m.name}\n${m.menu}`).join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the user's AI agent making the FINAL decision. The user wants: "${userQuery}"

You must output TWO sections:

SECTION 1 - SCORES (JSON):
Score each restaurant 0-100 on these criteria based on all evidence:
- price: How well does pricing match the user's budget/value expectations?
- match: How relevant is the menu/cuisine to what the user specifically asked for?
- reviews: What do real reviews say about quality and consistency?
- negotiation: How convincing and specific were the restaurant's arguments?
- overall: Weighted average (match 35%, price 25%, reviews 25%, negotiation 15%)

Output EXACTLY this JSON format on its own line:
SCORES_JSON:{"scores":[{"name":"...","overall":N,"price":N,"match":N,"reviews":N,"negotiation":N}]}

SECTION 2 - VERDICT:
After the JSON line, write your final verdict explaining:
1. Winner and why
2. Key trade-offs between options
3. Confidence level (%)`,
      },
      { role: "user", content: `Challenges:\n${challenge}\n\nNegotiation:\n${summary}\n\nReviews:\n${reviewSummary}\n\nMenus:\n${menuSummary}\n\nScore and decide.` },
    ],
  });

  const raw = response.choices[0].message.content || "";

  // Extract scores JSON
  let scores: { name: string; overall: number; price: number; match: number; reviews: number; negotiation: number }[] = [];
  const jsonMatch = raw.match(/SCORES_JSON:(\{.*\})/);
  if (jsonMatch) {
    try {
      scores = JSON.parse(jsonMatch[1]).scores;
    } catch { /* ignore parse errors */ }
  }

  const verdict = raw.replace(/SCORES_JSON:\{.*\}/, "").trim();
  return { verdict, scores };
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  const businesses = getAllBusinesses();
  if (businesses.length === 0) {
    return NextResponse.json({ error: "No businesses registered yet." }, { status: 404 });
  }

  const allNames = businesses.map((b) => b.name);

  // Step 1: Fetch web reviews + raw menus in parallel
  const [webReviews, rawMenus] = await Promise.all([
    Promise.all(
      businesses.map(async (b) => ({
        name: b.name,
        reviews: await searchReviews(b.name),
      }))
    ),
    Promise.all(
      businesses.map(async (b) => {
        let raw = "";
        // Try foodpanda API first (best structured data)
        if (b.foodpandaCode) {
          raw = await fetchFoodpandaMenu(b.foodpandaCode);
        }
        // Fallback to Exa web search
        if (!raw || raw.length < 50) {
          raw = await searchMenu(b.name);
        }
        return { name: b.name, raw, fromApi: !!b.foodpandaCode && raw.length > 50 };
      })
    ),
  ]);

  // Step 2: AI parses only Exa-scraped menus (foodpanda data is already clean)
  const menus = await Promise.all(
    rawMenus.map(async (rm) => ({
      name: rm.name,
      menu: rm.fromApi ? rm.raw : await parseMenuWithAI(rm.name, rm.raw),
    }))
  );

  // Step 3: Each business agent pitches using real menu data (parallel)
  const pitches = await Promise.all(
    businesses.map(async (b) => {
      const menuData = menus.find((m) => m.name === b.name)?.menu || "";
      return {
        name: b.name,
        pitch: await businessAgentPitch(b, query, allNames.filter((n) => n !== b.name), menuData),
      };
    })
  );

  // Step 4: User agent challenges all restaurants
  const challenge = await userAgentChallenge(query, pitches, webReviews);

  // Step 5: Each business agent counters (parallel)
  const counters = await Promise.all(
    businesses.map(async (b) => {
      const myReviews = webReviews.find((r) => r.name === b.name)?.reviews || "";
      const counter = await businessAgentCounter(b, challenge, myReviews);
      return { name: b.name, pitch: pitches.find((p) => p.name === b.name)!.pitch, counter };
    })
  );

  // Step 6: User agent scores and makes final decision
  const { verdict, scores } = await userAgentVerdict(query, counters, webReviews, challenge, menus);

  // Step 7: Targeted Exa lookup for the specific item the user wants
  const itemSearch = await Promise.all(
    businesses.map(async (b) => ({
      name: b.name,
      results: await searchSpecificItem(b.name, query),
    }))
  );

  return NextResponse.json({
    rounds: [
      { label: "🎯 Initial Pitches", entries: pitches.map((p) => ({ name: p.name, content: p.pitch })) },
      { label: "🔍 Your Agent's Challenge (informed by web reviews)", entries: [{ name: "Your Agent", content: challenge }] },
      { label: "⚔️ Restaurant Responses", entries: counters.map((c) => ({ name: c.name, content: c.counter })) },
    ],
    scores,
    itemSearch,
    menus,
    webReviews,
    verdict,
  });
}
