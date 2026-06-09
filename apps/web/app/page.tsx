"use client";
import { useState, useRef, useEffect } from "react";

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

interface Contract {
  id: string;
  name: string;
  budget_cap: number;
  budget_period: string;
  category_constraints: string[];
  vendor_blocklist: string[];
  vendor_allowlist: string[];
  risk_threshold: string;
  active: boolean;
}

type ProcureMode = "find" | "auction";

const DEMO_PHASES = [
  "Parsing your purchase intent…",
  "Broadcasting search to vendors…",
  "Discovering options with Exa…",
  "5 options received — suppliers pitching…",
  "Assessing offers and finding your best fit…",
  "Verifying contract rules…",
];

const LLM_COLORS: Record<string, string> = {
  "gpt-4o": "bg-emerald-100 text-emerald-800",
  "claude-sonnet-4-5": "bg-purple-100 text-purple-800",
  "gemini-1.5-flash": "bg-blue-100 text-blue-800",
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
  const intentRef = useRef<HTMLTextAreaElement>(null);

  const selectedContract = contracts.find(c => c.id === contractId);

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (!loading) {
      setPhaseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setPhaseIndex(i => Math.min(i + 1, DEMO_PHASES.length - 1));
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Procurement Agent</h1>
        <p className="text-slate-500 text-sm">Search, negotiate, and govern purchases under your spending contracts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sidebar: mode + contract */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Mode</p>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("find")}
                className={`flex-1 text-sm py-2 font-medium ${mode === "find" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Find
              </button>
              <button
                type="button"
                onClick={() => setMode("auction")}
                className={`flex-1 text-sm py-2 font-medium ${mode === "auction" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Auction
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {mode === "find"
                ? "Exa discovery → supplier pitches → negotiation API → governance"
                : "Flight auction demo — not yet implemented"}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Spending contract</p>
            {contractsLoading ? (
              <p className="text-sm text-slate-400">Loading contracts…</p>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-slate-500">
                No contracts yet.{" "}
                <a href="/dashboard" className="text-blue-500 hover:underline">Create one</a>
              </p>
            ) : (
              <select
                value={contractId}
                onChange={e => setContractId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (SGD {c.budget_cap}/{c.budget_period})
                  </option>
                ))}
              </select>
            )}
            {selectedContract && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                <p><span className="font-medium">Budget:</span> SGD {selectedContract.budget_cap} / {selectedContract.budget_period}</p>
                <p><span className="font-medium">Risk:</span> {selectedContract.risk_threshold}</p>
                {selectedContract.category_constraints.length > 0 && (
                  <p><span className="font-medium">Categories:</span> {selectedContract.category_constraints.join(", ")}</p>
                )}
                {selectedContract.vendor_blocklist.length > 0 && (
                  <p><span className="font-medium">Blocked:</span> {selectedContract.vendor_blocklist.join(", ")}</p>
                )}
              </div>
            )}
            <a href="/dashboard" className="inline-block mt-3 text-xs text-blue-500 hover:underline">Manage contracts →</a>
          </div>
        </div>

        {/* Main: search + results */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <textarea
                ref={intentRef}
                value={intent}
                onChange={e => setIntent(e.target.value)}
                placeholder={mode === "find" ? FIND_PLACEHOLDER : AUCTION_PLACEHOLDER}
                rows={3}
                className="w-full text-slate-800 text-base placeholder-slate-400 border-none outline-none resize-none"
              />
              <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading || !intent.trim() || !contractId || mode === "auction"}
                  className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
          )}

          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Live progress</p>
              <ul className="space-y-3">
                {DEMO_PHASES.map((phase, i) => {
                  const done = i < phaseIndex;
                  const active = i === phaseIndex;
                  return (
                    <li key={phase} className="flex items-center gap-3 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        done ? "bg-green-100 text-green-600" :
                        active ? "bg-slate-900 text-white animate-pulse" :
                        "bg-slate-100 text-slate-400"
                      }`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={active ? "text-slate-900 font-medium" : done ? "text-slate-500" : "text-slate-400"}>
                        {phase}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {selectedContract && (
                <p className="text-xs text-slate-400 mt-4 border-t border-slate-100 pt-3">
                  Running under contract: <span className="font-medium text-slate-600">{selectedContract.name}</span>
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Contract context */}
              {(result.contractName || selectedContract) && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contract</p>
                  <p className="font-semibold text-slate-800">{result.contractName ?? selectedContract?.name}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Budget cap: SGD {result.contractBudgetCap ?? selectedContract?.budget_cap} / {result.contractBudgetPeriod ?? selectedContract?.budget_period}
                  </p>
                  {selectedContract && selectedContract.category_constraints.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">Rules: {selectedContract.category_constraints.join(", ")}</p>
                  )}
                </div>
              )}

              {/* Decision banner */}
              <div className={`rounded-xl border-2 p-5 ${
                overrideSuccess ? "bg-yellow-50 border-yellow-400" :
                result.decision === "ACCEPT" ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                    overrideSuccess ? "bg-yellow-200 text-yellow-800" :
                    result.decision === "ACCEPT" ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
                  }`}>
                    {overrideSuccess ? "OVERRIDE — APPROVED" : result.decision}
                  </span>
                  {result.stripePaymentIntentId && (
                    <span className="text-xs text-slate-400 font-mono">{result.stripePaymentIntentId}</span>
                  )}
                </div>
                <p className="font-semibold text-slate-900 text-lg">{result.vendor} — {result.item}</p>
                <p className="text-slate-600 text-sm mt-1">SGD {Number(result.price).toFixed(2)}</p>
                <p className="text-slate-600 text-sm mt-2">{result.rationale}</p>
                {result.decision === "BLOCK" && !overrideSuccess && (
                  <button
                    onClick={() => setShowBlockReview(true)}
                    className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg font-medium"
                  >
                    Request manual review
                  </button>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Why this is the best value</p>
                <p className="text-slate-700 text-sm">{result.procurementRationale}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Governance rules</p>
                <div className="space-y-2">
                  {result.checkedRules.map((r, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 text-sm ${r.passed ? "text-green-500" : "text-red-500"}`}>
                        {r.passed ? "✓" : "✗"}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-700">{r.rule}</span>
                        <span className="text-xs text-slate-400 ml-2">{r.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {result.pitches && result.pitches.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Supplier pitches</p>
                  <div className="grid gap-3">
                    {result.pitches.map((pitch, i) => (
                      <div
                        key={i}
                        className={`bg-white border rounded-xl p-4 ${
                          pitch.vendor.toLowerCase() === result.vendor.toLowerCase()
                            ? "border-purple-400 shadow-md"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{pitch.vendor}</span>
                            {pitch.vendor.toLowerCase() === result.vendor.toLowerCase() && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Winner</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${LLM_COLORS[pitch.llmUsed] || "bg-slate-100 text-slate-600"}`}>
                              {pitch.llmUsed}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">SGD {pitch.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm mb-2">{pitch.pitch}</p>
                        <ul className="space-y-0.5">
                          {pitch.keyPoints.map((kp, j) => (
                            <li key={j} className="text-xs text-slate-500 flex items-start gap-1">
                              <span className="text-slate-300 mt-0.5">•</span>
                              {kp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showBlockReview && result?.decision === "BLOCK" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBlockReview(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Blocked by governance</h3>
            <p className="text-sm text-slate-600 mb-4">{result.vendor} — {result.item} · SGD {Number(result.price).toFixed(2)}</p>
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">{result.rationale}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Failed rules</p>
            <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
              {result.checkedRules.filter(r => !r.passed).map((r, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-red-600">{r.rule}</span>
                  <p className="text-slate-500 text-xs mt-0.5">{r.detail}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setShowBlockReview(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                Close
              </button>
              <button
                onClick={async () => { setShowBlockReview(false); await handleOverride(); }}
                disabled={overrideLoading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
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
