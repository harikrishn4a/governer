"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exaAgentDiscover = exaAgentDiscover;
exports.exaAgentWithRetry = exaAgentWithRetry;
exports.exaSearch = exaSearch;
exports.exaSearchAndContents = exaSearchAndContents;
exports.exaGetContents = exaGetContents;
const exa_js_1 = __importStar(require("exa-js"));
const logger_1 = require("../lib/logger");
const exa = new exa_js_1.default(process.env.EXA_API_KEY);
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
function extractJsonFromText(text) {
    const objStart = text.indexOf("{");
    const objEnd = text.lastIndexOf("}");
    if (objStart !== -1 && objEnd > objStart) {
        try {
            return JSON.parse(text.slice(objStart, objEnd + 1));
        }
        catch { /* fall through to array */ }
    }
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd > arrStart) {
        try {
            return JSON.parse(text.slice(arrStart, arrEnd + 1));
        }
        catch { /* nothing */ }
    }
    return null;
}
function isTransientError(err) {
    if (err === null || (typeof err !== "object" && typeof err !== "string"))
        return false;
    const e = err;
    const msg = (e.message ?? String(err)).toLowerCase();
    const isParseError = msg.includes("json") ||
        msg.includes("parse") ||
        msg.includes("unexpected token") ||
        msg.includes("position");
    const isServerError = typeof e.status === "number" && e.status >= 500;
    return isParseError || isServerError;
}
// Single attempt — throws on any failure so the retry wrapper can act on it.
async function exaAgentDiscover(task) {
    logger_1.logger.info("exa:agent — starting agent run", { task: task.slice(0, 100) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (await exa.beta.agent.runs.create({
        betas: [exa_js_1.AGENT_BETA_HEADER],
        query: task,
        outputSchema: DISCOVERY_OUTPUT_SCHEMA,
        effort: "high",
    }));
    logger_1.logger.info("exa:agent — run created, polling", { runId: run.id, status: run.status });
    let finalRun;
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
        finalRun = run;
    }
    else {
        finalRun = (await exa.beta.agent.runs.pollUntilFinished(run.id, {
            betas: [exa_js_1.AGENT_BETA_HEADER],
            pollInterval: 3000,
            timeoutMs: 300000,
        }));
    }
    logger_1.logger.info("exa:agent — run finished", {
        runId: finalRun.id,
        status: finalRun.status,
        stopReason: finalRun.stopReason ?? undefined,
        cost: finalRun.costDollars?.total,
    });
    if (finalRun.status !== "completed") {
        throw new Error(`Exa Agent run ended with status: ${finalRun.status}`);
    }
    // Primary: use structured output field
    let options = null;
    try {
        const structured = finalRun.output?.structured;
        options = structured?.options ?? null;
    }
    catch (parseErr) {
        logger_1.logger.warn("exa:agent — structured field parse failed, trying text fallback", {
            error: String(parseErr),
        });
    }
    // Secondary: extract JSON from the text field if structured was empty or threw
    if (!options || options.length === 0) {
        const text = finalRun.output?.text;
        if (text) {
            logger_1.logger.info("exa:agent — attempting text field JSON extraction");
            const extracted = extractJsonFromText(text);
            if (extracted) {
                const asObj = extracted;
                options = asObj.options ?? (Array.isArray(extracted) ? extracted : null);
            }
        }
    }
    if (!options || options.length === 0) {
        throw new Error("Exa Agent completed but returned no structured options");
    }
    // Dedup check — throws so exaAgentWithRetry retries the entire run
    const seen = new Set();
    const dupes = [];
    for (const opt of options) {
        const key = opt.vendor.trim().toLowerCase();
        if (seen.has(key))
            dupes.push(opt.vendor);
        else
            seen.add(key);
    }
    if (dupes.length > 0) {
        throw new Error(`Duplicate vendors in Exa Agent results (will retry): ${dupes.join(", ")}`);
    }
    return options;
}
// Retry wrapper — up to maxRetries attempts with 2s delay on transient errors.
// Returns null only after all attempts are exhausted (signals caller to use fallback).
async function exaAgentWithRetry(task, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await exaAgentDiscover(task);
            logger_1.logger.info("exa:agent — success", { attempt, count: result.length });
            return result;
        }
        catch (err) {
            const transient = isTransientError(err);
            if (transient && attempt < maxRetries) {
                logger_1.logger.warn(`exa:agent — attempt ${attempt}/${maxRetries} failed (transient), retrying in 2s`, { error: String(err) });
                await new Promise((r) => setTimeout(r, 2000));
                continue;
            }
            logger_1.logger.warn(`exa:agent — attempt ${attempt}/${maxRetries} failed (${transient ? "exhausted" : "non-transient"}), giving up`, { error: String(err) });
            return null;
        }
    }
    return null;
}
async function exaSearch(query, numResults = 5) {
    logger_1.logger.debug("exa:search", { query, numResults });
    return exa.search(query, {
        numResults,
        type: "neural",
        useAutoprompt: true,
    });
}
async function exaSearchAndContents(query, numResults = 8) {
    logger_1.logger.debug("exa:searchAndContents", { query, numResults });
    return exa.searchAndContents(query, {
        numResults,
        type: "neural",
        useAutoprompt: true,
        text: { maxCharacters: 1500 },
        highlights: { numSentences: 4, highlightsPerUrl: 3 },
    });
}
async function exaGetContents(urls) {
    logger_1.logger.debug("exa:getContents", { count: urls.length });
    return exa.getContents(urls, {
        text: { maxCharacters: 1000 },
        highlights: { numSentences: 3, highlightsPerUrl: 2 },
    });
}
