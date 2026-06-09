import { v4 as uuidv4 } from "uuid";
import { llmCall, llmCallJSON } from "../lib/llm";
import { logger } from "../lib/logger";
import {
  exaAgentWithRetry,
  exaSearchAndContents,
  type DiscoveryOption,
} from "../tools/exa";
import type { UserIntent, PaymentIntent } from "./types";

const QUERY_AUGMENT_SYSTEM = `You are a procurement intake agent. Your job is to restate a user's purchase intent as a clear, factual query.

Rules:
- Restate exactly what the user wants to buy, where, and for how much
- Specify that the response must include: vendor name, item name, exact price in SGD, and a direct URL to order or view the item
- Do NOT name any delivery platform, marketplace, or search source — Exa decides where to look
- Do NOT add instructions about how to search — only describe the purchase

IMPORTANT: Each option must be from a DIFFERENT vendor/restaurant. Never return two options from the same place. If you only find one good option at a venue, move on to the next vendor.

Return ONLY the restated query as plain text. No explanations.`;

const FALLBACK_PARSE_SYSTEM = `You are extracting structured purchasing options from web search results.

Given content from restaurant/delivery/shopping pages and a user's purchase intent, extract concrete options to buy.

For each option extract:
- vendor: the restaurant or store name
- item: the specific product or menu item
- price: price in SGD as a decimal number (e.g. 18.5) — estimate if not explicit
- order_url: the best URL to order or view the item
- description: 1-2 sentence description of the item
- why_pick: one sentence on why this option fits the buyer's intent

Return exactly this JSON shape:
{
  "options": [
    { "vendor": "...", "item": "...", "price": 18.5, "order_url": "...", "description": "...", "why_pick": "..." }
  ]
}

Return 3–5 options. Only include options where price is determinable (exact or a reasonable estimate).
If a URL is a search result page rather than a product page, use the most specific URL available.`;

async function augmentQuery(intent: UserIntent): Promise<string> {
  const locationHint = intent.location ? ` near ${intent.location}` : "";
  const budgetHint = intent.budget ? ` under SGD ${intent.budget}` : "";
  const constraintHint =
    intent.constraints && intent.constraints.length > 0
      ? ` (constraints: ${intent.constraints.join(", ")})`
      : "";

  const contextualRaw = `${intent.raw}${locationHint}${budgetHint}${constraintHint}`;

  logger.info("discovery:augment — sending to LLM", { contextualRaw });

  const augmented = await llmCall({
    system: QUERY_AUGMENT_SYSTEM,
    messages: [{ role: "user", content: contextualRaw }],
    maxTokens: 200,
  });

  const base = augmented.trim();
  const withVariety = `${base} Return exactly 5 options, each from a DIFFERENT restaurant or vendor. Do not list multiple items from the same restaurant.`;

  logger.info("discovery:augment — augmented query ready", { augmentedQuery: withVariety });
  return withVariety;
}

async function fallbackDiscover(
  augmentedQuery: string,
  intent: UserIntent
): Promise<DiscoveryOption[]> {
  logger.info("discovery:fallback — using searchAndContents + LLM parsing");

  const results = await exaSearchAndContents(augmentedQuery, 8);

  if (!results.results || results.results.length === 0) {
    throw new Error("Exa returned no results for query: " + augmentedQuery);
  }

  logger.info("discovery:fallback — Exa returned raw pages", {
    count: results.results.length,
    urls: results.results.map(r => r.url),
  });

  const contentBlocks = results.results
    .map((r, i) => {
      const text = r.text ?? "";
      const highlights = (r.highlights ?? []).join(" … ");
      return `[Source ${i + 1}] ${r.title ?? ""}\nURL: ${r.url}\n${highlights}\n${text.slice(0, 800)}`;
    })
    .join("\n\n---\n\n");

  logger.info("discovery:fallback — parsing with LLM", { sourceCount: results.results.length });

  const parsed = await llmCallJSON<{ options: DiscoveryOption[] }>({
    system: FALLBACK_PARSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `User intent: "${intent.raw}"\n\nSearch results:\n\n${contentBlocks}`,
      },
    ],
    maxTokens: 2048,
  });

  if (!parsed.options || parsed.options.length === 0) {
    throw new Error("LLM returned no options from Exa content");
  }

  logger.info("discovery:fallback — parsed options", {
    count: parsed.options.length,
    options: parsed.options.map(o => ({ vendor: o.vendor, item: o.item, price: `SGD ${o.price}` })),
  });

  return parsed.options;
}

function toPaymentIntent(opt: DiscoveryOption): PaymentIntent {
  return {
    id: uuidv4(),
    vendor: opt.vendor,
    item: opt.item,
    description: opt.description,
    price: opt.price,
    currency: "SGD",
    link: opt.order_url,
    order_url: opt.order_url,
    why_pick: opt.why_pick,
    metadata: {},
  };
}

export async function runDiscovery(intent: UserIntent): Promise<PaymentIntent[]> {
  logger.section("PHASE 2 — EXA DISCOVERY");
  logger.info("discovery:start", { raw: intent.raw });

  const augmentedQuery = await augmentQuery(intent);

  logger.info("discovery:exa-agent — launching (up to 3 retries on transient errors)");
  const agentOptions = await exaAgentWithRetry(augmentedQuery);

  let options: DiscoveryOption[];
  let path: "agent" | "fallback";

  if (agentOptions && agentOptions.length >= 3) {
    path = "agent";
    options = agentOptions;
  } else {
    path = "fallback";
    logger.warn("discovery — all Exa Agent attempts failed, falling back to searchAndContents + LLM");
    options = await fallbackDiscover(augmentedQuery, intent);
  }

  logger.info("discovery:path-used", { path, count: options.length });

  const paymentIntents = options.map(toPaymentIntent);

  logger.info("discovery:options-discovered", {
    count: paymentIntents.length,
    options: paymentIntents.map((o, i) => ({
      rank: i + 1,
      vendor: o.vendor,
      item: o.item,
      price: `SGD ${o.price}`,
      url: o.order_url,
    })),
  });

  return paymentIntents;
}
