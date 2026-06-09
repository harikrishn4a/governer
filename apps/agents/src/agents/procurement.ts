import { llmCallJSON } from "../lib/llm";
import { logger } from "../lib/logger";
import { runDiscovery } from "./discovery";
import { runSupplierAgents } from "./supplier";
import { callNegotiationAPI } from "../tools/negotiate";
import type { UserIntent, PaymentIntent, SupplierPitch, WinnerPaymentIntent, AgentEvent } from "./types";

// Optional sink for live agent events. Pipeline progress must never depend on it.
type OnEvent = (e: AgentEvent) => Promise<void> | void;

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
  logger.section("PHASE 1 — INTENT PARSING");
  logger.info("intent:parse — raw input received", { raw });

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

  logger.info("intent:parse — structured output", {
    category: intent.category ?? "(none)",
    location: intent.location ?? "(none)",
    budget: intent.budget != null ? `SGD ${intent.budget}` : "(none)",
    currency: intent.currency,
    constraints: intent.constraints?.length ? intent.constraints : "(none)",
  });

  return intent;
}

// Fallback: pick the supplier pitch with the highest fitScore when negotiation API is unavailable.
function pickWinnerFallback(
  pitches: SupplierPitch[],
  options: PaymentIntent[]
): WinnerPaymentIntent {
  const sorted = [...pitches].sort((a, b) => b.fitScore - a.fitScore);
  const best = sorted[0];
  const winnerIntent = options.find((o) => o.id === best.vendorId);

  if (!winnerIntent) {
    throw new Error(`pick_winner fallback: no PaymentIntent for vendorId ${best.vendorId}`);
  }

  const ranked = sorted
    .slice(1)
    .map((p) => options.find((o) => o.id === p.vendorId))
    .filter((o): o is PaymentIntent => o !== undefined);

  logger.warn("negotiation:fallback — using highest fitScore from supplier pitches", {
    winner: best.vendor,
    item: best.item,
    fitScore: best.fitScore,
    reason: "negotiation API unreachable",
  });

  return {
    ...winnerIntent,
    procurementRationale: `[FALLBACK] Selected ${best.vendor} — ${best.item} based on highest supplier fit score (${best.fitScore}/100). ${best.pitch.slice(0, 200)}`,
    score: best.fitScore,
    withinBudget: true,
    rankedAlternatives: ranked,
  };
}

export async function runProcurement(rawInput: string): Promise<PaymentIntent[]> {
  logger.info("procurement:start", { input: rawInput });
  const intent = await parseIntent(rawInput);
  const options = await runDiscovery(intent);
  logger.info("procurement:complete", { count: options.length });
  return options;
}

export async function runFullProcurement(rawInput: string, onEvent?: OnEvent): Promise<{
  intent: UserIntent;
  options: PaymentIntent[];
  pitches: SupplierPitch[];
  winner: WinnerPaymentIntent;
}> {
  logger.section("AGENTBID PROCUREMENT PIPELINE — START");
  logger.info("pipeline:start", { input: rawInput, timestamp: new Date().toISOString() });

  // Emit a live event without ever throwing into the pipeline.
  const emit = async (type: AgentEvent["type"], agent: string, data?: unknown) => {
    try {
      await onEvent?.({ type, agent, data, timestamp: new Date().toISOString() });
    } catch {
      /* telemetry must never break the pipeline */
    }
  };

  await emit("agent:start", "procurement");

  const intent = await parseIntent(rawInput);

  const options = await runDiscovery(intent);
  await emit("agent:complete", "discovery", {
    count: options.length,
    vendors: options.map((o) => o.vendor),
  });

  // Supplier agents pitch on the top candidates (mirrors runSupplierAgents' slice).
  const candidates = options.slice(0, 3);
  for (let i = 0; i < candidates.length; i++) {
    await emit("agent:start", `supplier_${i}`, {
      vendor: candidates[i].vendor,
      item: candidates[i].item,
    });
  }

  const pitches = await runSupplierAgents(options, intent);

  // ── Winner selection via negotiation API ──────────────────────────────────
  logger.section("PHASE 4 — WINNER SELECTION (NEGOTIATION API)");

  let winner: WinnerPaymentIntent;
  try {
    winner = await callNegotiationAPI(intent, options);

    logger.info("winner:selected — via negotiation API", {
      vendor: winner.vendor,
      item: winner.item,
      price: `SGD ${winner.price}`,
      score: winner.score,
      withinBudget: winner.withinBudget,
    });
    logger.info("winner:verdict", { verdict: winner.procurementRationale });

    if (winner.rankedAlternatives.length > 0) {
      logger.info("winner:ranked-alternatives", {
        alternatives: winner.rankedAlternatives.map((a, i) => ({
          rank: i + 2,
          vendor: a.vendor,
          item: a.item,
          price: `SGD ${a.price}`,
          score: a.metadata?.negotiation_score ?? "—",
        })),
      });
    }
  } catch (err) {
    logger.warn("winner:negotiation-api-failed", {
      error: String(err),
      action: "falling back to highest fitScore from supplier pitches",
    });
    winner = pickWinnerFallback(pitches, options);
  }

  logger.section("PIPELINE COMPLETE");
  logger.info("pipeline:complete", {
    winner: winner.vendor,
    item: winner.item,
    price: `SGD ${winner.price}`,
    score: winner.score,
    withinBudget: winner.withinBudget,
    selectionMethod: winner.procurementRationale.startsWith("[FALLBACK]") ? "fitScore-fallback" : "negotiation-api",
  });

  await emit("agent:complete", "procurement", {
    vendor: winner.vendor,
    item: winner.item,
    price: winner.price,
    rationale: winner.procurementRationale,
  });

  return { intent, options, pitches, winner };
}
