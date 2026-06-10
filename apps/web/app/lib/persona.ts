import type { AgentPersona } from "@/app/lib/store";

// ---- Option catalogs (shared by the UI and the prompt builder) ----
// These let a business shape HOW its negotiation agent sells — the brand voice,
// not a caricature of any person or group.

export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly & warm", hint: "Approachable, upbeat, like a favourite local spot." },
  { value: "cheeky", label: "Cheeky & playful", hint: "Witty, a little bold, light humour." },
  { value: "formal", label: "Formal & professional", hint: "Polished, precise, corporate-friendly." },
  { value: "premium", label: "Premium & refined", hint: "Elegant, confident, quality-first." },
  { value: "enthusiastic", label: "Enthusiastic hype", hint: "High energy, excited about the food." },
  { value: "no-nonsense", label: "No-nonsense", hint: "Direct, value-focused, gets to the point." },
] as const;

export const STYLE_OPTIONS = [
  { value: "standard", label: "Standard English", hint: "Clear, neutral English." },
  { value: "singlish", label: "Local Singlish flavour", hint: "A natural Singaporean lilt (lah, can, shiok) — used lightly." },
  { value: "concise", label: "Short & punchy", hint: "Tight sentences, scannable." },
  { value: "storytelling", label: "Storytelling", hint: "Paints a vivid picture of the food and experience." },
] as const;

export const DIETARY_OPTIONS = [
  { value: "halal", label: "Halal-certified" },
  { value: "vegetarian-friendly", label: "Vegetarian-friendly" },
  { value: "vegan-options", label: "Vegan options" },
  { value: "kosher", label: "Kosher" },
  { value: "no-pork-no-lard", label: "No pork / no lard" },
  { value: "gluten-free-options", label: "Gluten-free options" },
  { value: "healthy-clean", label: "Healthy / clean eating" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Malay", label: "Malay" },
  { value: "Mandarin", label: "Mandarin" },
  { value: "Tamil", label: "Tamil" },
  { value: "Hokkien", label: "Hokkien" },
  { value: "Cantonese", label: "Cantonese" },
] as const;

export const EMPHASIS_OPTIONS = [
  { value: "value", label: "Value for money" },
  { value: "quality", label: "Quality / freshness" },
  { value: "speed", label: "Speed / convenience" },
  { value: "authenticity", label: "Authenticity" },
  { value: "health", label: "Health / nutrition" },
  { value: "portion", label: "Generous portions" },
  { value: "variety", label: "Menu variety" },
] as const;

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string
): string {
  return options.find((o) => o.value === value)?.label || value;
}

const TONE_GUIDE: Record<string, string> = {
  friendly: "Be warm, approachable and upbeat, like a friendly neighbourhood favourite.",
  cheeky: "Be playful and witty with light, tasteful humour — confident but never rude.",
  formal: "Be polished, precise and professional; suitable for a corporate audience.",
  premium: "Be elegant and refined; project quality and quiet confidence.",
  enthusiastic: "Be high-energy and genuinely excited about the food.",
  "no-nonsense": "Be direct and value-focused; get straight to the point.",
};

const STYLE_GUIDE: Record<string, string> = {
  standard: "Write in clear, neutral English.",
  singlish: "Use a light, natural Singaporean English lilt (occasional 'lah', 'can', 'shiok') — keep it tasteful and still easy to understand.",
  concise: "Keep sentences short and punchy.",
  storytelling: "Paint a vivid picture of the food and the experience.",
};

// Build the system-prompt fragment that customises a vendor agent's voice.
// Returns "" when no persona is set, so existing behaviour is unchanged.
export function personaToPrompt(persona?: AgentPersona): string {
  if (!persona) return "";
  const lines: string[] = [];

  if (persona.tone) {
    lines.push(`- Tone: ${labelFor(TONE_OPTIONS, persona.tone)}. ${TONE_GUIDE[persona.tone] || ""}`.trim());
  }
  if (persona.languageStyle) {
    lines.push(`- Style: ${labelFor(STYLE_OPTIONS, persona.languageStyle)}. ${STYLE_GUIDE[persona.languageStyle] || ""}`.trim());
  }
  if (persona.dietary?.length) {
    lines.push(
      `- Dietary positioning to highlight when relevant: ${persona.dietary
        .map((d) => labelFor(DIETARY_OPTIONS, d))
        .join(", ")}. Only state these if they are genuinely true for this business.`
    );
  }
  if (persona.languages?.length) {
    lines.push(
      `- Multilingual hospitality: you may open with or sprinkle in a short, natural greeting in ${persona.languages.join(
        ", "
      )}. Keep the main pitch understandable to all.`
    );
  }
  if (persona.emphasis?.length) {
    lines.push(
      `- Lead with these selling points: ${persona.emphasis
        .map((e) => labelFor(EMPHASIS_OPTIONS, e))
        .join(", ")}.`
    );
  }
  if (persona.tagline?.trim()) {
    lines.push(`- Brand tagline you can use: "${persona.tagline.trim()}".`);
  }
  if (persona.notes?.trim()) {
    lines.push(`- Owner's voice notes: ${persona.notes.trim()}`);
  }

  if (lines.length === 0) return "";

  return `\n\nBRAND VOICE & PERSONA (sell in this style, but never fabricate facts or claims):\n${lines.join(
    "\n"
  )}`;
}
