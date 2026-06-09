"use client";

import { useState } from "react";
import type { AgentResult } from "@/lib/useAgentStream";

export interface SupplierPitch {
  vendorId: string;
  vendor: string;
  item: string;
  price: number;
  pitch: string;
  keyPoints: string[];
  fitScore: number;
  llmUsed: string;
}

interface ResultCardProps {
  result: AgentResult;
  pitches: SupplierPitch[];
  overrideSuccess: boolean;
  onRequestReview: () => void;
  /** Fallbacks when the result doesn't echo the contract budget. */
  budgetCap?: number;
  budgetPeriod?: string;
}

// Categorical model tags — decorative, paired with the model name (never the sole
// carrier of meaning). Reuses semantic/accent tokens per DESIGN-SYSTEM.md.
const LLM_COLORS: Record<string, string> = {
  "gpt-4o": "bg-accept-subtle text-accept-text",
  "claude-sonnet-4-5": "bg-accent-purple-subtle text-accent-purple",
  "gemini-1.5-flash": "bg-accent-blue-subtle text-accent-blue",
};

function money(n: number, currency = "SGD"): string {
  const v = Math.round((n + Number.EPSILON) * 100) / 100;
  return `${currency} ${Number.isInteger(v) ? v.toString() : v.toFixed(2)}`;
}

// One consistent section-label treatment (F3) — replaces the ~12× ad-hoc
// `text-xs font-semibold uppercase tracking-wider`.
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-overline uppercase text-text-muted">{children}</p>;
}

/* Stripe PaymentIntent: subordinate machine data — truncated to 12 chars, mono,
 * muted, with a copy-to-clipboard affordance (F5). */
function StripePI({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = id.length > 12 ? `${id.slice(0, 12)}…` : id;

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (insecure context) — nothing to do */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy payment intent · ${id}`}
      className="group flex items-center gap-1.5 font-mono text-mono-sm tabular-nums text-text-muted transition-colors duration-micro hover:text-text-secondary"
    >
      <span>{short}</span>
      <span className="text-caption text-text-muted group-hover:text-accent-blue">
        {copied ? "✓ copied" : "⧉ copy"}
      </span>
    </button>
  );
}

export default function ResultCard({
  result,
  pitches,
  overrideSuccess,
  onRequestReview,
  budgetCap,
  budgetPeriod,
}: ResultCardProps) {
  const currency = result.currency ?? "SGD";
  const price = Number(result.price);
  const accepted = result.decision === "ACCEPT";

  // Decision tone drives the card edge + badge color.
  const tone = overrideSuccess
    ? { border: "border-review-border", badgeBg: "bg-review-subtle", badgeText: "text-review-text", label: "Override · Approved" }
    : accepted
      ? { border: "border-accept-border", badgeBg: "bg-accept-subtle", badgeText: "text-accept-text", label: "✓ Accepted" }
      : { border: "border-block-border", badgeBg: "bg-block-subtle", badgeText: "text-block-text", label: "✗ Blocked" };

  // Advantage pills — derived highlights, rendered as callouts not plain text (F5).
  const cap = result.contractBudgetCap ?? budgetCap;
  const period = result.contractBudgetPeriod ?? budgetPeriod;
  const pills: Array<{ icon: string; text: string; tone: "good" | "warn" }> = [];
  if (cap != null && Number.isFinite(price)) {
    const diff = cap - price;
    pills.push(
      diff >= 0
        ? { icon: "💰", text: `${money(Math.round(diff), currency)} under budget`, tone: "good" }
        : { icon: "⚠️", text: `${money(Math.round(-diff), currency)} over budget`, tone: "warn" }
    );
  }
  const priciest = pitches.reduce((m, p) => Math.max(m, Number(p.price) || 0), 0);
  if (priciest > price) {
    pills.push({ icon: "📉", text: `${money(priciest - price, currency)} below the priciest bid`, tone: "good" });
  }

  return (
    <div className={`rounded-2xl border ${tone.border} bg-surface p-6 shadow-md`}>
      {/* Header — decision badge + subordinate Stripe PI */}
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-overline uppercase ${tone.badgeBg} ${tone.badgeText}`}>
          {tone.label}
        </span>
        {result.stripePaymentIntentId && <StripePI id={result.stripePaymentIntentId} />}
      </div>

      {/* Vendor — the single most dominant element on screen (F3/F5) */}
      <h2 className="mt-4 font-display text-display-2xl leading-none text-text-primary">{result.vendor}</h2>
      <p className="mt-1 font-display text-display-md font-light text-text-secondary">{result.item}</p>

      {/* Price — prominent, display font, large; currency recedes (weight contrast) */}
      <p className="mt-4 font-display tabular-nums text-text-primary">
        <span className="text-display-md font-light text-text-muted">{currency} </span>
        <span className="text-display-xl">{price.toFixed(2)}</span>
      </p>

      {/* Advantage callout pills */}
      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pills.map((p, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label ${
                p.tone === "good"
                  ? "bg-accept-subtle text-accept-text"
                  : "bg-block-subtle text-block-text"
              }`}
            >
              <span aria-hidden>{p.icon}</span>
              {p.text}
            </span>
          ))}
        </div>
      )}

      {/* Decision rationale */}
      {result.rationale && <p className="mt-4 text-body text-text-secondary">{result.rationale}</p>}

      {result.decision === "BLOCK" && !overrideSuccess && (
        <button
          type="button"
          onClick={onRequestReview}
          className="mt-4 rounded-lg bg-review px-4 py-2 text-label text-text-inverse transition hover:brightness-110 active:scale-[0.97]"
        >
          Request manual review
        </button>
      )}

      {/* Why best value */}
      {result.procurementRationale && (
        <section className="mt-6 border-t border-border-subtle pt-5">
          <Label>Why this is the best value</Label>
          <p className="text-body text-text-secondary">{result.procurementRationale}</p>
        </section>
      )}

      {/* Governance rules */}
      {result.checkedRules?.length > 0 && (
        <section className="mt-6 border-t border-border-subtle pt-5">
          <Label>Governance rules</Label>
          <div className="space-y-2">
            {result.checkedRules.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-label ${r.passed ? "text-accept-text" : "text-block-text"}`}>
                  {r.passed ? "✓" : "✗"}
                </span>
                <p className="text-label text-text-secondary">
                  {r.rule}
                  <span className="ml-2 font-normal text-caption text-text-muted">{r.detail}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Supplier pitches */}
      {pitches.length > 0 && (
        <section className="mt-6 border-t border-border-subtle pt-5">
          <Label>Supplier pitches</Label>
          <div className="space-y-2">
            {pitches.map((p, i) => {
              const isWinner = p.vendor.toLowerCase() === result.vendor.toLowerCase();
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${
                    isWinner ? "border-accent-purple bg-surface-raised" : "border-border-subtle bg-surface"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-label text-text-primary">{p.vendor}</span>
                      {isWinner && (
                        <span className="rounded-full bg-accent-purple-subtle px-2 py-0.5 text-caption text-accent-purple">
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-caption ${LLM_COLORS[p.llmUsed] ?? "bg-surface-raised text-text-muted"}`}>
                        {p.llmUsed}
                      </span>
                      <span className="font-mono text-mono-sm tabular-nums text-text-secondary">{money(p.price, currency)}</span>
                    </div>
                  </div>
                  <p className="text-body text-text-secondary">{p.pitch}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Metadata — clearly subordinate: mono, muted, tabular */}
      <footer className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-border-subtle pt-4 font-mono text-mono-sm text-text-muted">
        {result.contractName && (
          <span>
            contract: {result.contractName}
            {cap != null && period ? ` · ${money(cap, currency)}/${period}` : ""}
          </span>
        )}
        {result.transactionId && <span className="tabular-nums">tx: {result.transactionId.slice(0, 8)}…</span>}
      </footer>
    </div>
  );
}
