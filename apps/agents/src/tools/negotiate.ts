import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import type {
  UserIntent,
  PaymentIntent,
  WinnerPaymentIntent,
  NegotiationRound,
} from "../agents/types";

const NEGOTIATE_URL = "http://44.248.228.50:3000/api/negotiate";

interface NegotiationResult {
  supplier_name: string;
  supplier_location: string;
  total_cost: number;
  currency: string;
  item_name: string;
  item_description: string;
  score: number;
  within_budget: boolean;
  reasoning: string;
  order_url: string;
  agent_source?: string;
}

interface NegotiationResponse {
  results: NegotiationResult[];
  verdict: string;
  conversation?: NegotiationRound[];
}

function mapResult(r: NegotiationResult): PaymentIntent {
  return {
    id: randomUUID(),
    vendor: r.supplier_name,
    item: r.item_name,
    description: r.item_description ?? "",
    price: r.total_cost,
    currency: r.currency ?? "SGD",
    link: r.order_url ?? "",
    order_url: r.order_url ?? "",
    why_pick: r.reasoning,
    metadata: { negotiation_score: String(r.score), agent_source: r.agent_source ?? "unknown" },
  };
}

async function callOnce(payload: object, attempt: number): Promise<NegotiationResponse> {
  logger.info("negotiate:http-request", {
    attempt,
    url: NEGOTIATE_URL,
    method: "POST",
    payloadKeys: Object.keys(payload),
  });

  const res = await fetch(NEGOTIATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });

  logger.info("negotiate:http-response", {
    attempt,
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Negotiation API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<NegotiationResponse>;
}

export async function callNegotiationAPI(
  userIntent: UserIntent,
  options: PaymentIntent[]
): Promise<WinnerPaymentIntent> {
  const payload = {
    itemDescription: userIntent.raw,
    price: userIntent.budget ?? 999,
    options: { options },
  };

  logger.info("negotiate:start", {
    url: NEGOTIATE_URL,
    itemDescription: userIntent.raw,
    budget: `SGD ${payload.price}`,
    optionCount: options.length,
    options: options.map(o => ({ vendor: o.vendor, item: o.item, price: `SGD ${o.price}` })),
  });

  const t0 = Date.now();
  let data: NegotiationResponse;

  try {
    data = await callOnce(payload, 1);
  } catch (firstErr) {
    logger.warn("negotiate:attempt-1-failed — retrying", {
      error: String(firstErr),
      retryIn: "0ms",
    });
    data = await callOnce(payload, 2); // throws on second failure → caller falls back
  }

  const elapsedMs = Date.now() - t0;

  if (!data.results || data.results.length === 0) {
    throw new Error("Negotiation API returned no results");
  }

  logger.info("negotiate:response-received", {
    elapsedMs,
    resultCount: data.results.length,
    verdict: data.verdict,
  });

  // Log the full ranked list
  logger.info("negotiate:full-ranking", {
    ranking: data.results.map((r, i) => ({
      rank: i + 1,
      vendor: r.supplier_name,
      item: r.item_name,
      price: `SGD ${r.total_cost}`,
      score: r.score,
      withinBudget: r.within_budget,
      location: r.supplier_location,
    })),
  });

  const winner = data.results[0];

  logger.info("negotiate:winner-selected", {
    rank: 1,
    vendor: winner.supplier_name,
    item: winner.item_name,
    price: `SGD ${winner.total_cost}`,
    score: winner.score,
    withinBudget: winner.within_budget,
    location: winner.supplier_location,
    reasoning: winner.reasoning,
    orderUrl: winner.order_url,
  });

  return {
    ...mapResult(winner),
    procurementRationale: data.verdict ?? winner.reasoning,
    score: winner.score,
    withinBudget: winner.within_budget,
    rankedAlternatives: data.results.slice(1).map(mapResult),
    // Surface the real transcript + the full ranked scoreboard for the UI.
    conversation: Array.isArray(data.conversation) ? data.conversation : [],
    ranking: data.results.map((r) => ({
      vendor: r.supplier_name,
      item: r.item_name,
      price: r.total_cost,
      score: r.score,
      withinBudget: r.within_budget,
      reasoning: r.reasoning ?? "",
    })),
  };
}
