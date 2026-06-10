import { NextRequest, NextResponse } from "next/server";
import { chatText } from "@/lib/llm";
import { getBusiness, upsertBusiness, Business } from "@/app/lib/store";
import { proxyToEc2, shouldProxyToEc2 } from "@/lib/ec2-proxy";

const SYSTEM_PROMPT = `You are an AI agent that learns about a business. Your goal is to fully understand:
- What they sell and their specialties
- Pricing range and location
- Values and differentiators vs competitors

Ask ONE focused follow-up question at a time. After 2–3 exchanges, if you have enough to pitch and negotiate on their behalf, respond with EXACTLY this prefix on its own line:
[READY]
followed by a short summary. Do not keep asking if the owner already gave solid answers.`;

const MAX_HISTORY = 12;

export async function POST(req: NextRequest) {
  if (shouldProxyToEc2()) return proxyToEc2(req, "/api/business/chat");

  const { businessId, businessName, message } = await req.json();

  let business: Business = getBusiness(businessId) || {
    id: businessId,
    name: businessName || "Unnamed Business",
    knowledge: "",
    isReady: false,
    conversationHistory: [],
  };

  business.conversationHistory.push({ role: "user", content: message });

  const reply = await chatText({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...business.conversationHistory.slice(-MAX_HISTORY),
    ],
    maxOutputTokens: 400,
    temperature: 0.5,
  });
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
