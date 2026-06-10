import { isGatewayEnabled, llmCallJSON } from "../lib/llm";
import { logger } from "../lib/logger";
import type { PaymentIntent, UserIntent, SupplierPitch } from "./types";

function supplierLlms() {
  const preferClaude = isGatewayEnabled() || Boolean(process.env.ANTHROPIC_API_KEY);
  return [
    { id: preferClaude ? "claude-sonnet-4-5" : "gpt-4o", label: preferClaude ? "Claude Sonnet" : "GPT-4o" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o", label: "GPT-4o" }, // Gemini placeholder — swap when GOOGLE_GENERATIVE_AI_API_KEY added
  ];
}

function buildSystemPrompt(option: PaymentIntent, intent: UserIntent, llmLabel: string): string {
  const budget = intent.budget ? `${intent.budget} SGD` : "unspecified";
  const constraints = intent.constraints?.length ? intent.constraints.join(", ") : "none";

  return `You are the exclusive sales agent for ${option.vendor}. You are competing in a live procurement tender.

The buyer's intent: "${intent.raw}"
The buyer's constraints: ${constraints}
The tender budget: ${budget}

Your product:
- Item: ${option.item}
- Price: ${option.price} SGD
- Details: ${option.description}
- Order URL: ${option.order_url}

Make the strongest possible case that your product is the best fit for this buyer.
Be specific. Cite price value, quality, location convenience, and fit to constraints.
Be persuasive but factual. Keep your pitch under 200 words.

Return a JSON object with:
{
  "pitch": "your full argument (under 200 words)",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "fitScore": <0-100, your honest assessment of fit>
}`;
}

export async function runSupplierAgent(
  option: PaymentIntent,
  intent: UserIntent,
  supplierIndex: number
): Promise<SupplierPitch> {
  const llms = supplierLlms();
  const llm = llms[supplierIndex % llms.length];

  logger.info(`supplier[${supplierIndex}]:start`, {
    vendor: option.vendor,
    item: option.item,
    price: `SGD ${option.price}`,
    llm: llm.id,
  });

  const result = await llmCallJSON<{ pitch: string; keyPoints: string[]; fitScore: number }>({
    model: llm.id,
    system: buildSystemPrompt(option, intent, llm.label),
    messages: [
      {
        role: "user",
        content: `Advocate for ${option.vendor} — ${option.item} at ${option.price} SGD.`,
      },
    ],
    maxTokens: 1024,
  });

  const fitScore = Math.min(100, Math.max(0, result.fitScore ?? 50));

  logger.info(`supplier[${supplierIndex}]:complete`, {
    vendor: option.vendor,
    item: option.item,
    fitScore,
    llm: llm.id,
    pitch: result.pitch?.slice(0, 150) + (result.pitch?.length > 150 ? "…" : ""),
    keyPoints: result.keyPoints ?? [],
  });

  return {
    vendorId: option.id,
    vendor: option.vendor,
    item: option.item,
    price: option.price,
    pitch: result.pitch,
    keyPoints: result.keyPoints ?? [],
    fitScore,
    llmUsed: llm.id,
  };
}

export async function runSupplierAgents(
  options: PaymentIntent[],
  intent: UserIntent
): Promise<SupplierPitch[]> {
  const candidates = options.slice(0, 3);

  logger.section("PHASE 3 — SUPPLIER PITCH AGENTS");
  logger.info("supplier:fan-out — launching parallel pitch agents", {
    agentCount: candidates.length,
    vendors: candidates.map((o, i) => {
      const llms = supplierLlms();
      return { index: i, vendor: o.vendor, item: o.item, price: `SGD ${o.price}`, llm: llms[i % llms.length].id };
    }),
  });

  const pitches = await Promise.all(
    candidates.map((opt, i) => runSupplierAgent(opt, intent, i))
  );

  const sorted = [...pitches].sort((a, b) => b.fitScore - a.fitScore);
  logger.info("supplier:fan-out-complete — all pitches received", {
    pitches: sorted.map((p, i) => ({
      rank: i + 1,
      vendor: p.vendor,
      item: p.item,
      fitScore: p.fitScore,
      llm: p.llmUsed,
    })),
  });

  return pitches;
}
