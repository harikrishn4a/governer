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

function defaultModel(): string {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (process.env.ANTHROPIC_API_KEY) return "claude-sonnet-4-5";
  if (process.env.OPENAI_API_KEY) return "gpt-4o";
  throw new Error(
    "No LLM key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"
  );
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

export async function llmCall(opts: LLMCallOptions): Promise<string> {
  const model = opts.model ?? defaultModel();

  logger.debug("llm call", { model, systemLen: opts.system.length });

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

export async function llmCallJSON<T>(opts: LLMCallOptions): Promise<T> {
  const system = opts.system + "\n\nReturn ONLY valid JSON. No markdown fences. No preamble.";
  const raw = await llmCall({ ...opts, system });

  try {
    return JSON.parse(raw) as T;
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
    return JSON.parse(corrected) as T;
  }
}
