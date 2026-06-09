import { llmCallJSON } from "../lib/llm";
import { logger } from "../lib/logger";
import { runDiscovery } from "./discovery";
import type { UserIntent, PaymentIntent } from "./types";

const INTENT_PARSE_SYSTEM = `You are a procurement intake agent. Parse a user's natural language purchase intent into structured fields.

Extract:
- category: the type of purchase (e.g. "food", "electronics", "clothing", "groceries")
- location: specific place or area mentioned (e.g. "Marina Bay Sands", "Orchard Road")
- budget: numeric budget in SGD (extract from phrases like "under $30", "below 25 dollars", "less than SGD 50")
- currency: "SGD" (always SGD for this system)
- constraints: array of any requirements (e.g. ["halal", "vegetarian", "delivery only"])

Return JSON: { "category": "...", "location": "...", "budget": 30, "currency": "SGD", "constraints": [] }
All fields are optional except currency. Return null for fields not mentioned.`;

async function parseIntent(raw: string): Promise<UserIntent> {
  logger.info("procurement:parse-intent", { raw });

  const parsed = await llmCallJSON<{
    category?: string;
    location?: string;
    budget?: number | null;
    currency?: string;
    constraints?: string[];
  }>({
    system: INTENT_PARSE_SYSTEM,
    messages: [{ role: "user", content: raw }],
    maxTokens: 512,
  });

  const intent: UserIntent = {
    raw,
    category: parsed.category ?? undefined,
    location: parsed.location ?? undefined,
    budget: parsed.budget ?? undefined,
    currency: parsed.currency ?? "SGD",
    constraints: parsed.constraints ?? [],
  };

  logger.info("procurement:intent-parsed", {
    category: intent.category,
    location: intent.location,
    budget: intent.budget,
    constraints: intent.constraints,
  });
  return intent;
}

export async function runProcurement(rawInput: string): Promise<PaymentIntent[]> {
  logger.info("procurement:start", { input: rawInput });

  const intent = await parseIntent(rawInput);
  const options = await runDiscovery(intent);

  logger.info("procurement:complete", { count: options.length });
  return options;
}
