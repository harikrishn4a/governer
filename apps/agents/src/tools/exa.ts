import Exa, { AGENT_BETA_HEADER } from "exa-js";
import { logger } from "../lib/logger";

const exa = new Exa(process.env.EXA_API_KEY!);

export interface DiscoveryOption {
  vendor: string;
  item: string;
  price: number;
  order_url: string;
  description: string;
  why_pick: string;
}

const DISCOVERY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    options: {
      type: "array",
      description: "Exactly 5 purchasing options, each from a COMPLETELY DIFFERENT restaurant or vendor. No two items may share the same vendor. If you find multiple items at the same venue, pick only the best one and find a different vendor for the remaining slots.",
      items: {
        type: "object",
        properties: {
          vendor: {
            type: "string",
            description: "Restaurant or vendor name",
          },
          item: {
            type: "string",
            description: "Specific menu item or product name",
          },
          price: {
            type: "number",
            description: "Price in SGD as a decimal number (e.g. 18.5)",
          },
          order_url: {
            type: "string",
            description: "URL to order or view the item (delivery platform or restaurant website)",
          },
          description: {
            type: "string",
            description: "Brief description of the item",
          },
          why_pick: {
            type: "string",
            description: "One sentence on why this option fits the buyer's intent",
          },
        },
        required: ["vendor", "item", "price", "order_url", "description", "why_pick"],
      },
      minItems: 5,
      maxItems: 5,
    },
  },
  required: ["options"],
};

type AgentRunShape = {
  id: string;
  status: string;
  stopReason?: string | null;
  output?: { structured?: unknown; text?: string | null } | null;
  error?: unknown;
  costDollars?: { total?: number };
};

function extractJsonFromText(text: string): unknown | null {
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd + 1));
    } catch { /* fall through to array */ }
  }
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(text.slice(arrStart, arrEnd + 1));
    } catch { /* nothing */ }
  }
  return null;
}

function isTransientError(err: unknown): boolean {
  if (err === null || (typeof err !== "object" && typeof err !== "string")) return false;
  const e = err as { message?: string; status?: number };
  const msg = (e.message ?? String(err)).toLowerCase();
  const isParseError =
    msg.includes("json") ||
    msg.includes("parse") ||
    msg.includes("unexpected token") ||
    msg.includes("position");
  const isServerError = typeof e.status === "number" && e.status >= 500;
  return isParseError || isServerError;
}

// Single attempt — throws on any failure so the retry wrapper can act on it.
export async function exaAgentDiscover(task: string): Promise<DiscoveryOption[]> {
  logger.info("exa:agent — starting agent run", { task: task.slice(0, 100) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (await exa.beta.agent.runs.create({
    betas: [AGENT_BETA_HEADER],
    query: task,
    outputSchema: DISCOVERY_OUTPUT_SCHEMA,
    effort: "high",
  })) as unknown as AgentRunShape;

  logger.info("exa:agent — run created, polling", { runId: run.id, status: run.status });

  let finalRun: AgentRunShape;

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    finalRun = run;
  } else {
    finalRun = (await exa.beta.agent.runs.pollUntilFinished(run.id, {
      betas: [AGENT_BETA_HEADER],
      pollInterval: 3000,
      timeoutMs: 300000,
    })) as unknown as AgentRunShape;
  }

  logger.info("exa:agent — run finished", {
    runId: finalRun.id,
    status: finalRun.status,
    stopReason: finalRun.stopReason ?? undefined,
    cost: finalRun.costDollars?.total,
  });

  if (finalRun.status !== "completed") {
    throw new Error(`Exa Agent run ended with status: ${finalRun.status}`);
  }

  // Primary: use structured output field
  let options: DiscoveryOption[] | null = null;

  try {
    const structured = finalRun.output?.structured as { options?: DiscoveryOption[] } | undefined;
    options = structured?.options ?? null;
  } catch (parseErr) {
    logger.warn("exa:agent — structured field parse failed, trying text fallback", {
      error: String(parseErr),
    });
  }

  // Secondary: extract JSON from the text field if structured was empty or threw
  if (!options || options.length === 0) {
    const text = finalRun.output?.text;
    if (text) {
      logger.info("exa:agent — attempting text field JSON extraction");
      const extracted = extractJsonFromText(text);
      if (extracted) {
        const asObj = extracted as { options?: DiscoveryOption[] };
        options = asObj.options ?? (Array.isArray(extracted) ? (extracted as DiscoveryOption[]) : null);
      }
    }
  }

  if (!options || options.length === 0) {
    throw new Error("Exa Agent completed but returned no structured options");
  }

  // Dedup check — throws so exaAgentWithRetry retries the entire run
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const opt of options) {
    const key = opt.vendor.trim().toLowerCase();
    if (seen.has(key)) dupes.push(opt.vendor);
    else seen.add(key);
  }
  if (dupes.length > 0) {
    throw new Error(
      `Duplicate vendors in Exa Agent results (will retry): ${dupes.join(", ")}`
    );
  }

  return options;
}

// Retry wrapper — up to maxRetries attempts with 2s delay on transient errors.
// Returns null only after all attempts are exhausted (signals caller to use fallback).
export async function exaAgentWithRetry(
  task: string,
  maxRetries = 3
): Promise<DiscoveryOption[] | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await exaAgentDiscover(task);
      logger.info("exa:agent — success", { attempt, count: result.length });
      return result;
    } catch (err) {
      const transient = isTransientError(err);
      if (transient && attempt < maxRetries) {
        logger.warn(
          `exa:agent — attempt ${attempt}/${maxRetries} failed (transient), retrying in 2s`,
          { error: String(err) }
        );
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      logger.warn(
        `exa:agent — attempt ${attempt}/${maxRetries} failed (${transient ? "exhausted" : "non-transient"}), giving up`,
        { error: String(err) }
      );
      return null;
    }
  }
  return null;
}

export async function exaSearch(query: string, numResults = 5) {
  logger.debug("exa:search", { query, numResults });
  return exa.search(query, {
    numResults,
    type: "neural",
    useAutoprompt: true,
  });
}

export async function exaSearchAndContents(query: string, numResults = 8) {
  logger.debug("exa:searchAndContents", { query, numResults });
  return exa.searchAndContents(query, {
    numResults,
    type: "neural",
    useAutoprompt: true,
    text: { maxCharacters: 1500 },
    highlights: { numSentences: 4, highlightsPerUrl: 3 },
  });
}

export async function exaGetContents(urls: string[]) {
  logger.debug("exa:getContents", { count: urls.length });
  return exa.getContents(urls, {
    text: { maxCharacters: 1000 },
    highlights: { numSentences: 3, highlightsPerUrl: 2 },
  });
}
