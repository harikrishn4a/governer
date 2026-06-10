import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/app/lib/openai";
import { getBusiness, upsertBusiness, Business } from "@/app/lib/store";

const SYSTEM_PROMPT = `You are an AI agent that learns about a restaurant business. Your goal is to fully understand:
- What type of cuisine they serve
- Their specialties, unique dishes, and ingredients
- Their values (organic, vegan, local sourcing, etc.)
- Pricing range
- Location and ambiance
- What makes them unique vs competitors

Ask focused follow-up questions ONE AT A TIME until you're confident you deeply understand the business.
When you feel you have comprehensive knowledge, respond with EXACTLY this prefix on its own line:
[READY]
followed by a summary of what you've learned. Only say [READY] when you truly have enough info to argue on behalf of this restaurant.`;

export async function POST(req: NextRequest) {
  const { businessId, businessName, message } = await req.json();

  let business: Business = getBusiness(businessId) || {
    id: businessId,
    name: businessName || "Unnamed Restaurant",
    knowledge: "",
    isReady: false,
    conversationHistory: [],
  };

  business.conversationHistory.push({ role: "user", content: message });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...business.conversationHistory,
    ],
  });

  const reply = response.choices[0].message.content || "";
  business.conversationHistory.push({ role: "assistant", content: reply });

  if (reply.includes("[READY]")) {
    business.isReady = true;
    business.knowledge = reply.replace("[READY]", "").trim();
  }

  upsertBusiness(business);

  return NextResponse.json({
    reply,
    isReady: business.isReady,
  });
}
