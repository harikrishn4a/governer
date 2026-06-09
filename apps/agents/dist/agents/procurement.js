"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurement = runProcurement;
exports.runFullProcurement = runFullProcurement;
const llm_1 = require("../lib/llm");
const logger_1 = require("../lib/logger");
const discovery_1 = require("./discovery");
const supplier_1 = require("./supplier");
const negotiate_1 = require("../tools/negotiate");
const INTENT_PARSE_SYSTEM = `You are a procurement intake agent. Parse a user's natural language purchase intent into structured fields.

Extract:
- category: the type of purchase (e.g. "food", "electronics", "clothing", "groceries")
- location: specific place or area mentioned (e.g. "Marina Bay Sands", "Orchard Road")
- budget: numeric budget in SGD (extract from phrases like "under $30", "below 25 dollars", "less than SGD 50")
- currency: "SGD" (always SGD for this system)
- constraints: array of any requirements (e.g. ["halal", "vegetarian", "delivery only"])

Return JSON: { "category": "...", "location": "...", "budget": 30, "currency": "SGD", "constraints": [] }
All fields are optional except currency. Return null for fields not mentioned.`;
async function parseIntent(raw) {
    logger_1.logger.section("PHASE 1 — INTENT PARSING");
    logger_1.logger.info("intent:parse — raw input received", { raw });
    const parsed = await (0, llm_1.llmCallJSON)({
        system: INTENT_PARSE_SYSTEM,
        messages: [{ role: "user", content: raw }],
        maxTokens: 512,
    });
    const intent = {
        raw,
        category: parsed.category ?? undefined,
        location: parsed.location ?? undefined,
        budget: parsed.budget ?? undefined,
        currency: parsed.currency ?? "SGD",
        constraints: parsed.constraints ?? [],
    };
    logger_1.logger.info("intent:parse — structured output", {
        category: intent.category ?? "(none)",
        location: intent.location ?? "(none)",
        budget: intent.budget != null ? `SGD ${intent.budget}` : "(none)",
        currency: intent.currency,
        constraints: intent.constraints?.length ? intent.constraints : "(none)",
    });
    return intent;
}
// Fallback: pick the supplier pitch with the highest fitScore when negotiation API is unavailable.
function pickWinnerFallback(pitches, options) {
    const sorted = [...pitches].sort((a, b) => b.fitScore - a.fitScore);
    const best = sorted[0];
    const winnerIntent = options.find((o) => o.id === best.vendorId);
    if (!winnerIntent) {
        throw new Error(`pick_winner fallback: no PaymentIntent for vendorId ${best.vendorId}`);
    }
    const ranked = sorted
        .slice(1)
        .map((p) => options.find((o) => o.id === p.vendorId))
        .filter((o) => o !== undefined);
    logger_1.logger.warn("negotiation:fallback — using highest fitScore from supplier pitches", {
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
async function runProcurement(rawInput) {
    logger_1.logger.info("procurement:start", { input: rawInput });
    const intent = await parseIntent(rawInput);
    const options = await (0, discovery_1.runDiscovery)(intent);
    logger_1.logger.info("procurement:complete", { count: options.length });
    return options;
}
async function runFullProcurement(rawInput) {
    logger_1.logger.section("AGENTBID PROCUREMENT PIPELINE — START");
    logger_1.logger.info("pipeline:start", { input: rawInput, timestamp: new Date().toISOString() });
    const intent = await parseIntent(rawInput);
    const options = await (0, discovery_1.runDiscovery)(intent);
    const pitches = await (0, supplier_1.runSupplierAgents)(options, intent);
    // ── Winner selection via negotiation API ──────────────────────────────────
    logger_1.logger.section("PHASE 4 — WINNER SELECTION (NEGOTIATION API)");
    let winner;
    try {
        winner = await (0, negotiate_1.callNegotiationAPI)(intent, options);
        logger_1.logger.info("winner:selected — via negotiation API", {
            vendor: winner.vendor,
            item: winner.item,
            price: `SGD ${winner.price}`,
            score: winner.score,
            withinBudget: winner.withinBudget,
        });
        logger_1.logger.info("winner:verdict", { verdict: winner.procurementRationale });
        if (winner.rankedAlternatives.length > 0) {
            logger_1.logger.info("winner:ranked-alternatives", {
                alternatives: winner.rankedAlternatives.map((a, i) => ({
                    rank: i + 2,
                    vendor: a.vendor,
                    item: a.item,
                    price: `SGD ${a.price}`,
                    score: a.metadata?.negotiation_score ?? "—",
                })),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn("winner:negotiation-api-failed", {
            error: String(err),
            action: "falling back to highest fitScore from supplier pitches",
        });
        winner = pickWinnerFallback(pitches, options);
    }
    logger_1.logger.section("PIPELINE COMPLETE");
    logger_1.logger.info("pipeline:complete", {
        winner: winner.vendor,
        item: winner.item,
        price: `SGD ${winner.price}`,
        score: winner.score,
        withinBudget: winner.withinBudget,
        selectionMethod: winner.procurementRationale.startsWith("[FALLBACK]") ? "fitScore-fallback" : "negotiation-api",
    });
    return { intent, options, pitches, winner };
}
