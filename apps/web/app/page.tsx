"use client";
import { useState, useRef, useEffect } from "react";
import Sidebar, { type Contract, type ProcureMode } from "@/components/Sidebar";

interface CheckedRule {
  rule: string;
  passed: boolean;
  detail: string;
}

interface SupplierPitch {
  vendorId: string;
  vendor: string;
  item: string;
  price: number;
  pitch: string;
  keyPoints: string[];
  fitScore: number;
  llmUsed: string;
}

interface ProcureResult {
  transactionId: string;
  decision: "ACCEPT" | "BLOCK";
  vendor: string;
  item: string;
  price: number;
  rationale: string;
  checkedRules: CheckedRule[];
  stripePaymentIntentId?: string;
  procurementRationale: string;
  contractId?: string;
  contractName?: string;
  contractBudgetCap?: number;
  contractBudgetPeriod?: string;
  pitches: SupplierPitch[];
  options: Array<{ id: string; vendor: string; item: string; price: number; link: string }>;
  requiresHumanReview?: boolean;
}

const DEMO_PHASES = [
  "Parsing your purchase intent…",
  "Broadcasting search to vendors…",
  "Discovering options with Exa…",
  "5 options received — suppliers pitching…",
  "Assessing offers and finding your best fit…",
  "Verifying contract rules…",
];

// Categorical model tags — reuse semantic/accent tokens as decorative labels
// (text + name carry meaning, never color alone). See DESIGN-SYSTEM.md §5.
const LLM_COLORS: Record<string, string> = {
  "gpt-4o": "bg-accept-subtle text-accept-text",
  "claude-sonnet-4-5": "bg-accent-purple-subtle text-accent-purple",
  "gemini-1.5-flash": "bg-accent-blue-subtle text-accent-blue",
};

const FIND_PLACEHOLDER = "e.g. find me a good burger near Marina Bay Sands under $30";
const AUCTION_PLACEHOLDER = "e.g. find cheapest SIN → TYO flight next Friday (coming soon)";

export default function ProcurePage() {
  const [intent, setIntent] = useState("");
  const [contractId, setContractId] = useState("");
  const [mode, setMode] = useState<ProcureMode>("find");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [result, setResult] = useState<ProcureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [showBlockReview, setShowBlockReview] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);
  const intentRef = useRef<HTMLTextAreaElement>(null);

  const selectedContract = contracts.find((c) => c.id === contractId);

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (!loading) {
      setPhaseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setPhaseIndex((i) => Math.min(i + 1, DEMO_PHASES.length - 1));
    }, 28000);
    return () => clearInterval(interval);
  }, [loading]);

  async function loadContracts() {
    setContractsLoading(true);
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        const active = (Array.isArray(data) ? data : []).filter((c: Contract) => c.active);
        setContracts(active);
        if (!contractId && active.length > 0) {
          const food = active.find((c: Contract) => c.name.toLowerCase().includes("food"));
          setContractId(food?.id ?? active[0].id);
        }
      }
    } catch {}
    setContractsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent.trim()) return;
    if (!contractId) {
      setError("Select a spending contract before running the agent.");
      return;
    }
    if (mode === "auction") {
      setError("Auction mode is not implemented yet. Switch to Find mode for the burger demo.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setOverrideSuccess(false);
    setPhaseIndex(0);

    try {
      const res = await fetch("/api/procure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), contractId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Procurement failed");
      setResult(data);
      setBudgetRefreshKey((k) => k + 1); // refresh sidebar budget meter
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride() {
    if (!result?.transactionId) return;
    setOverrideLoading(true);
    try {
      const res = await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: result.transactionId, approvedBy: "demo-user" }),
      });
      if (!res.ok) throw new Error("Override failed");
      setOverrideSuccess(true);
      setBudgetRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <div className="flex items-stretch min-h-[calc(100vh-53px)]">
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        contracts={contracts}
        contractsLoading={contractsLoading}
        contractId={contractId}
        onSelectContract={setContractId}
        onContractsChanged={loadContracts}
        budgetRefreshKey={budgetRefreshKey}
      />

      {/* Main: search + results */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-6">
            <h1 className="font-display text-display-xl text-text-primary mb-1">Procurement Agent</h1>
            <p className="text-body text-text-secondary">
              Search, negotiate, and govern purchases under your spending contracts
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <div className="bg-surface rounded-xl border border-border shadow-md p-4">
              <textarea
                ref={intentRef}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder={mode === "find" ? FIND_PLACEHOLDER : AUCTION_PLACEHOLDER}
                rows={3}
                className="w-full bg-transparent text-body-lg text-text-primary placeholder-text-muted border-none outline-none resize-none"
              />
              <div className="flex items-center justify-end mt-3 pt-3 border-t border-border-subtle">
                <button
                  type="submit"
                  disabled={loading || !intent.trim() || !contractId || mode === "auction"}
                  className="bg-accent-blue text-text-inverse px-5 py-2 rounded-lg text-label font-medium hover:bg-accent-blue-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-micro"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {loading ? "Running agents…" : mode === "find" ? "Find & procure" : "Run auction"}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mb-6 bg-block-subtle border border-block-border rounded-lg p-4 text-block-text text-body">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-surface border border-border rounded-xl p-6">
              <p className="text-overline uppercase text-text-muted mb-4">Live progress</p>
              <ul className="space-y-3">
                {DEMO_PHASES.map((phase, i) => {
                  const done = i < phaseIndex;
                  const active = i === phaseIndex;
                  return (
                    <li key={phase} className="flex items-center gap-3 text-body">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-caption ${
                          done
                            ? "bg-accept-subtle text-accept-text"
                            : active
                            ? "bg-accent-blue text-text-inverse animate-pulse"
                            : "bg-surface-raised text-text-muted"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span
                        className={
                          active
                            ? "text-text-primary font-medium"
                            : done
                            ? "text-text-secondary"
                            : "text-text-muted"
                        }
                      >
                        {phase}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {selectedContract && (
                <p className="text-caption text-text-muted mt-4 border-t border-border-subtle pt-3">
                  Running under contract:{" "}
                  <span className="font-medium text-text-secondary">{selectedContract.name}</span>
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Decision banner — the dominant element */}
              <div
                className={`rounded-xl border p-5 animate-card-reveal ${
                  overrideSuccess
                    ? "bg-review-subtle border-review-border"
                    : result.decision === "ACCEPT"
                    ? "bg-accept-subtle border-accept-border"
                    : "bg-block-subtle border-block-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-overline uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                      overrideSuccess
                        ? "bg-review text-text-inverse"
                        : result.decision === "ACCEPT"
                        ? "bg-accept text-text-inverse"
                        : "bg-block text-text-inverse"
                    }`}
                  >
                    {overrideSuccess ? "OVERRIDE — APPROVED" : result.decision}
                  </span>
                  {result.stripePaymentIntentId && (
                    <span className="text-mono-sm text-text-muted font-mono">
                      {result.stripePaymentIntentId}
                    </span>
                  )}
                </div>
                <p className="font-display text-display-md text-text-primary">
                  {result.vendor} — {result.item}
                </p>
                <p className="text-body text-text-secondary mt-1 font-mono">
                  SGD {Number(result.price).toFixed(2)}
                </p>
                <p className="text-body text-text-secondary mt-2">{result.rationale}</p>
                {result.decision === "BLOCK" && !overrideSuccess && (
                  <button
                    onClick={() => setShowBlockReview(true)}
                    className="mt-3 bg-review text-text-inverse text-label px-4 py-2 rounded-lg font-medium hover:brightness-110 transition-[filter] duration-micro"
                  >
                    Request manual review
                  </button>
                )}
              </div>

              {/* Contract context */}
              {(result.contractName || selectedContract) && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-overline uppercase text-text-muted mb-2">Contract</p>
                  <p className="text-label font-semibold text-text-primary">
                    {result.contractName ?? selectedContract?.name}
                  </p>
                  <p className="text-caption text-text-muted mt-1 font-mono">
                    Budget cap: SGD {result.contractBudgetCap ?? selectedContract?.budget_cap} /{" "}
                    {result.contractBudgetPeriod ?? selectedContract?.budget_period}
                  </p>
                  {selectedContract && selectedContract.category_constraints.length > 0 && (
                    <p className="text-caption text-text-muted mt-1">
                      Rules: {selectedContract.category_constraints.join(", ")}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-overline uppercase text-text-muted mb-1">
                  Why this is the best value
                </p>
                <p className="text-body text-text-secondary">{result.procurementRationale}</p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-overline uppercase text-text-muted mb-3">Governance rules</p>
                <div className="space-y-2">
                  {result.checkedRules.map((r, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 text-body ${r.passed ? "text-accept-text" : "text-block-text"}`}>
                        {r.passed ? "✓" : "✗"}
                      </span>
                      <div>
                        <span className="text-label font-medium text-text-secondary">{r.rule}</span>
                        <span className="text-caption text-text-muted ml-2">{r.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {result.pitches && result.pitches.length > 0 && (
                <div>
                  <p className="text-overline uppercase text-text-muted mb-3">Supplier pitches</p>
                  <div className="grid gap-3">
                    {result.pitches.map((pitch, i) => {
                      const winner = pitch.vendor.toLowerCase() === result.vendor.toLowerCase();
                      return (
                        <div
                          key={i}
                          className={`bg-surface border rounded-xl p-4 ${
                            winner ? "border-accent-purple shadow-md" : "border-border-subtle"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-label font-semibold text-text-primary">
                                {pitch.vendor}
                              </span>
                              {winner && (
                                <span className="text-caption bg-accent-purple-subtle text-accent-purple px-2 py-0.5 rounded-full font-medium">
                                  Winner
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-caption px-2 py-0.5 rounded font-medium ${
                                  LLM_COLORS[pitch.llmUsed] || "bg-surface-raised text-text-secondary"
                                }`}
                              >
                                {pitch.llmUsed}
                              </span>
                              <span className="text-label font-semibold text-text-secondary font-mono">
                                SGD {pitch.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <p className="text-body text-text-secondary mb-2">{pitch.pitch}</p>
                          <ul className="space-y-0.5">
                            {pitch.keyPoints.map((kp, j) => (
                              <li key={j} className="text-caption text-text-muted flex items-start gap-1">
                                <span className="text-text-muted mt-0.5">•</span>
                                {kp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showBlockReview && result?.decision === "BLOCK" && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBlockReview(false)}
        >
          <div
            className="bg-surface-raised border border-border rounded-2xl max-w-lg w-full p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-display-md text-text-primary mb-1">Blocked by governance</h3>
            <p className="text-body text-text-secondary mb-4 font-mono">
              {result.vendor} — {result.item} · SGD {Number(result.price).toFixed(2)}
            </p>
            <p className="text-body text-block-text bg-block-subtle border border-block-border rounded-lg p-3 mb-4">
              {result.rationale}
            </p>
            <p className="text-overline uppercase text-text-muted mb-2">Failed rules</p>
            <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
              {result.checkedRules
                .filter((r) => !r.passed)
                .map((r, i) => (
                  <li key={i} className="text-body">
                    <span className="font-medium text-block-text">{r.rule}</span>
                    <p className="text-caption text-text-muted mt-0.5">{r.detail}</p>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBlockReview(false)}
                className="flex-1 border border-border text-text-secondary py-2 rounded-lg text-label hover:bg-surface"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setShowBlockReview(false);
                  await handleOverride();
                }}
                disabled={overrideLoading}
                className="flex-1 bg-review text-text-inverse py-2 rounded-lg text-label font-medium hover:brightness-110 disabled:opacity-50 transition-[filter] duration-micro"
              >
                {overrideLoading ? "Approving…" : "Override & execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
