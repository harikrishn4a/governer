"use client";
import { useState, useRef } from "react";

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
  pitches: SupplierPitch[];
  options: Array<{ id: string; vendor: string; item: string; price: number; link: string }>;
  requiresHumanReview?: boolean;
}

interface Contract {
  id: string;
  name: string;
  budget_cap: number;
  budget_period: string;
  active: boolean;
}

const LLM_COLORS: Record<string, string> = {
  "gpt-4o": "bg-emerald-100 text-emerald-800",
  "claude-sonnet-4-5": "bg-purple-100 text-purple-800",
  "gemini-1.5-flash": "bg-blue-100 text-blue-800",
};

export default function ProcurePage() {
  const [intent, setIntent] = useState("");
  const [contractId, setContractId] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const intentRef = useRef<HTMLTextAreaElement>(null);

  async function loadContracts() {
    if (contractsLoaded) return;
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.filter((c: Contract) => c.active));
        setContractsLoaded(true);
      }
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setOverrideSuccess(false);
    try {
      const res = await fetch("/api/procure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), contractId: contractId || undefined }),
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

  const winningPitch = result?.pitches?.find(p =>
    p.vendor.toLowerCase() === result.vendor.toLowerCase()
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Procurement Agent</h1>
        <p className="text-slate-500 text-sm">Express your purchase intent in natural language</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <textarea
            ref={intentRef}
            value={intent}
            onChange={e => setIntent(e.target.value)}
            onFocus={loadContracts}
            placeholder="e.g. find me a good burger near Marina Bay Sands under $30"
            rows={3}
            className="w-full text-slate-800 text-base placeholder-slate-400 border-none outline-none resize-none"
          />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            {contractsLoaded && contracts.length > 0 && (
              <select
                value={contractId}
                onChange={e => setContractId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Default contract</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (${c.budget_cap}/{c.budget_period})
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={loading || !intent.trim()}
              className="ml-auto bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? "Running agents…" : "Procure"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex gap-1">
              {["bg-purple-400", "bg-blue-400", "bg-orange-400", "bg-teal-400"].map((c, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${c} animate-bounce`} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
          <p className="text-slate-500 text-sm">Discovery → Suppliers → Procurement → Governance</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
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
            <p className="text-slate-600 text-sm mt-1">SGD {result.price.toFixed(2)}</p>
            <p className="text-slate-600 text-sm mt-2">{result.rationale}</p>
            {result.decision === "BLOCK" && !overrideSuccess && (
              <button
                onClick={handleOverride}
                disabled={overrideLoading}
                className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {overrideLoading ? "Approving…" : "Override and approve"}
              </button>
            )}
          </div>

          {/* Procurement rationale */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Procurement rationale</p>
            <p className="text-slate-700 text-sm">{result.procurementRationale}</p>
          </div>

          {/* Governance rules */}
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

          {/* Supplier pitches */}
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
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Fit score</span><span>{pitch.fitScore}/100</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div
                          className="h-1.5 bg-purple-400 rounded-full"
                          style={{ width: `${pitch.fitScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All options from discovery */}
          {result.options && result.options.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">All discovered options</p>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {result.options.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{opt.vendor}</span>
                      <span className="text-xs text-slate-400 ml-2">{opt.item}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">SGD {opt.price.toFixed(2)}</span>
                      {opt.link && (
                        <a href={opt.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          source
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
