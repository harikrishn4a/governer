import { generateText } from "ai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logger } from "./logger";

let anthropic: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function gatewayApiKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
}

/** True when LLM calls route through Vercel AI Gateway (preferred). */
export function isGatewayEnabled(): boolean {
  return Boolean(gatewayApiKey());
}

function directAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function directOpenaiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isLlmConfigured(): boolean {
  return isGatewayEnabled() || directAnthropicAvailable() || directOpenaiAvailable();
}

export function llmRoute(): "vercel-ai-gateway" | "direct" {
  return isGatewayEnabled() ? "vercel-ai-gateway" : "direct";
}

export function defaultModel(): string {
  if (process.env.LLM_DEFAULT_MODEL) return process.env.LLM_DEFAULT_MODEL;
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (isGatewayEnabled() || directAnthropicAvailable()) return "claude-sonnet-4-5";
  if (directOpenaiAvailable()) return "gpt-4o";
  throw new Error(
    "No LLM configured. Set AI_GATEWAY_API_KEY (Vercel AI Gateway) or ANTHROPIC_API_KEY / OPENAI_API_KEY in .env"
  );
}

/** Bare id → gateway model string (provider/model). */
export function toGatewayModel(model: string): string {
  if (model.includes("/")) return model;
  if (model.startsWith("claude")) return `anthropic/${model}`;
  if (model.startsWith("gpt")) return `openai/${model}`;
  if (model.startsWith("gemini")) return `google/${model}`;
  return model;
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  model?: string;
  system: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

async function llmCallViaGateway(opts: LLMCallOptions, model: string): Promise<string> {
  const gatewayModel = toGatewayModel(model);
  logger.debug("llm call (gateway)", { model: gatewayModel, systemLen: opts.system.length });

  const { text } = await generateText({
    model: gatewayModel,
    system: opts.system,
    messages: opts.messages,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxTokens ?? 4096,
  });

  if (!text) throw new Error("AI Gateway returned empty response");
  return text;
}

async function llmCallDirect(opts: LLMCallOptions, model: string): Promise<string> {
  logger.debug("llm call (direct)", { model, systemLen: opts.system.length });

  if (model.startsWith("claude")) {
    if (!anthropic) throw new Error("ANTHROPIC_API_KEY not set");
    const response = await anthropic.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: opts.messages,
      temperature: opts.temperature,
    });
    const content = response.content[0];
    if (content.type !== "text") throw new Error(`Unexpected content type: ${content.type}`);
    return content.text;
  }

  if (model.startsWith("gpt")) {
    if (!openaiClient) throw new Error("OPENAI_API_KEY not set");
    const response = await openaiClient.chat.completions.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned empty response");
    return text;
  }

  throw new Error(`Unsupported model: ${model}`);
}

export async function llmCall(opts: LLMCallOptions): Promise<string> {
  const model = opts.model ?? defaultModel();
  if (isGatewayEnabled()) return llmCallViaGateway(opts, model);
  return llmCallDirect(opts, model);
}

// Models sometimes wrap JSON in ```fences``` or preamble despite instructions —
// strip fences / slice to the outermost JSON value before parsing.
function coerceJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const objStart = s.indexOf("{");
    const arrStart = s.indexOf("[");
    const start = [objStart, arrStart].filter((i) => i !== -1).sort((a, b) => a - b)[0];
    if (start !== undefined) {
      const open = s[start];
      const close = open === "{" ? "}" : "]";
      const end = s.lastIndexOf(close);
      if (end > start) s = s.slice(start, end + 1);
    }
  }
  return s;
}

export async function llmCallJSON<T>(opts: LLMCallOptions): Promise<T> {
  const system = opts.system + "\n\nReturn ONLY valid JSON. No markdown fences. No preamble.";
  const raw = await llmCall({ ...opts, system });

  try {
    return JSON.parse(coerceJson(raw)) as T;
  } catch {
    logger.warn("JSON parse failed on first attempt, retrying with correction");
    const corrected = await llmCall({
      ...opts,
      system,
      messages: [
        ...opts.messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content: "Your response was not valid JSON. Return ONLY the JSON object, nothing else.",
        },
      ],
    });
    return JSON.parse(coerceJson(corrected)) as T;
  }
}
