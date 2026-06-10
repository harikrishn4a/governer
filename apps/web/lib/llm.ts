import { generateText } from "ai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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

export function isGatewayEnabled(): boolean {
  return Boolean(gatewayApiKey());
}

export function llmRoute(): "vercel-ai-gateway" | "direct" {
  return isGatewayEnabled() ? "vercel-ai-gateway" : "direct";
}

export function gatewayStatus(): "configured" | "oidc" | "missing" {
  if (process.env.AI_GATEWAY_API_KEY) return "configured";
  if (process.env.VERCEL_OIDC_TOKEN) return "oidc";
  return "missing";
}

export function toGatewayModel(model: string): string {
  if (model.includes("/")) return model;
  if (model.startsWith("claude")) return `anthropic/${model}`;
  if (model.startsWith("gpt")) return `openai/${model}`;
  if (model.startsWith("gemini")) return `google/${model}`;
  return model;
}

function splitMessages(messages: ChatMessage[]): {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conv = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: conv,
  };
}

async function chatTextDirect(
  model: string,
  system: string | undefined,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxOutputTokens: number
): Promise<string> {
  if (model.startsWith("claude")) {
    if (!anthropic) throw new Error("ANTHROPIC_API_KEY not set");
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxOutputTokens,
      system: system ?? "",
      messages,
    });
    const content = response.content[0];
    if (content.type !== "text") throw new Error(`Unexpected content type: ${content.type}`);
    return content.text;
  }

  if (model.startsWith("gpt")) {
    if (!openaiClient) throw new Error("OPENAI_API_KEY not set");
    const response = await openaiClient.chat.completions.create({
      model,
      max_tokens: maxOutputTokens,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned empty response");
    return text;
  }

  throw new Error(`Unsupported model: ${model}`);
}

export async function chatText(opts: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const model = opts.model ?? "gpt-4o-mini";
  const maxOutputTokens = opts.maxOutputTokens ?? 4096;
  const { system, messages } = splitMessages(opts.messages);

  if (isGatewayEnabled()) {
    const { text } = await generateText({
      model: toGatewayModel(model),
      system,
      messages,
      temperature: opts.temperature,
      maxOutputTokens,
    });
    if (!text) throw new Error("AI Gateway returned empty response");
    return text;
  }

  return chatTextDirect(model, system, messages, maxOutputTokens);
}

export async function chatJSON<T>(opts: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<T> {
  const jsonMessages: ChatMessage[] = opts.messages.map((m) =>
    m.role === "system"
      ? {
          role: "system",
          content: m.content + "\n\nReturn ONLY valid JSON. No markdown fences. No preamble.",
        }
      : m
  );

  const raw = await chatText({ ...opts, messages: jsonMessages });

  try {
    return JSON.parse(raw) as T;
  } catch {
    const corrected = await chatText({
      ...opts,
      messages: [
        ...jsonMessages,
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
