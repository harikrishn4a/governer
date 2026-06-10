"use client";

import { useEffect, useState } from "react";
import Sidebar, { type Contract, type ProcureMode } from "@/components/Sidebar";
import RunTheatre from "@/components/RunTheatre";
import AuctionTheatre from "@/components/AuctionTheatre";
import { useAgentStream } from "@/lib/useAgentStream";

const EXAMPLES = [
  "A big halal burrito in the Marina Bay area under $15",
  "Single-origin office coffee beans, 2kg, under $90",
  "A standing desk converter under $250",
];

const AUCTION_EXAMPLES = [
  "Affordable, comfortable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD",
  "Direct flight to Bangkok this weekend, 1 adult, economy, under $350 SGD",
  "Catering for a 20-person office lunch on Friday under $400",
];

export default function ProcurePage() {
  const [intent, setIntent] = useState("");
  const [contractId, setContractId] = useState("");
  const [mode, setMode] = useState<ProcureMode>("find");
  // Mode captured at submit time — the sidebar toggle could change mid-run.
  const [runMode, setRunMode] = useState<ProcureMode>("find");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [showBlockReview, setShowBlockReview] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  const { graphState, auctionState, result, isComplete } = useAgentStream(transactionId);
  const selectedContract = contracts.find((c) => c.id === contractId);

  const active = transactionId !== null;
  const running = active && !isComplete;

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (isComplete && result) setBudgetRefreshKey((k) => k + 1);
  }, [isComplete, result]);

  async function loadContracts() {
    setContractsLoading(true);
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).filter((c: Contract) => c.active);
        setContracts(list);
        if (!contractId && list.length > 0) {
          const food = list.find((c: Contract) => c.name.toLowerCase().includes("food"));
          setContractId(food?.id ?? list[0].id);
        }
      }
    } catch {
      /* contracts are optional for the idle hero to render */
    }
    setContractsLoading(false);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!intent.trim()) return;
    if (!contractId) {
      setError("Select a spending contract before running the agents.");
      return;
    }
    setError(null);
    setOverrideSuccess(false);
    setShowBlockReview(false);
    setTransactionId(null);
    setRunMode(mode);

    try {
      const res = await fetch("/api/procure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), contractId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start procurement");
      setTransactionId(data.transactionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
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

  function reset() {
    setTransactionId(null);
    setError(null);
    setOverrideSuccess(false);
    setShowBlockReview(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-53px)] items-stretch bg-bg">
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

      <main className="relative flex-1 overflow-y-auto">
        {!active ? (
          /* ── Idle hero ──────────────────────────────────────────────── */
          <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16">
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
              Agentic procurement
            </p>
            <h1 className="font-serif mt-3 text-[2.7rem] font-semibold leading-[1.08] tracking-tight text-text-primary sm:text-[3.1rem]">
              {mode === "auction" ? (
                <>Vendors bid.<br />Your agent decides.</>
              ) : (
                <>Procurement, negotiated<br />by a team of AI agents.</>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-text-secondary">
              {mode === "auction"
                ? "Describe what you need. Your tender is broadcast to vendor agents who bid, counter-bid and pitch across live rounds — anchored to real prices Exa finds — before governance verifies and Stripe settles."
                : "Describe what you need. Agents search the open web, run an adversarial supplier negotiation, enforce your spending contract, and settle payment — while you watch every step."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm transition-colors focus-within:border-accent-blue">
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="What would you like to procure?"
                  rows={2}
                  className="w-full resize-none bg-transparent px-2 pt-1 text-[1.02rem] text-text-primary outline-none placeholder:text-text-muted"
                />
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-subtle px-1 pt-3">
                  <span className="text-[0.8rem] text-text-muted">
                    {selectedContract ? (
                      <>Contract: <span className="text-text-secondary">{selectedContract.name.trim()}</span></>
                    ) : (
                      "Select a contract in the sidebar"
                    )}
                  </span>
                  <button
                    type="submit"
                    disabled={!intent.trim() || !contractId}
                    className="rounded-lg bg-accent-blue px-5 py-2 text-[0.9rem] font-medium text-text-inverse transition hover:bg-accent-blue-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Run agents →
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-lg border border-block-border bg-block-subtle px-4 py-3 text-[0.88rem] text-block-text">
                  {error}
                </div>
              )}
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              {(mode === "auction" ? AUCTION_EXAMPLES : EXAMPLES).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setIntent(ex)}
                  className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[0.82rem] text-text-secondary transition-colors hover:border-accent-blue hover:text-text-primary"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Active run ─────────────────────────────────────────────── */
          <div className="mx-auto max-w-5xl px-6 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {running ? "Agents at work" : "Run complete"}
                </p>
                <p className="font-serif mt-1 text-[1.35rem] font-semibold leading-snug text-text-primary">
                  “{intent}”
                </p>
              </div>
              <button
                onClick={reset}
                className="shrink-0 rounded-lg border border-border bg-surface px-4 py-2 text-[0.85rem] font-medium text-text-secondary transition hover:border-accent-blue hover:text-text-primary"
              >
                New request
              </button>
            </div>

            {runMode === "auction" ? (
              <AuctionTheatre auction={auctionState} result={result} intent={intent} />
            ) : (
              <RunTheatre
                phase={graphState.phase}
                vendors={graphState.vendors}
                winner={graphState.winner ?? result?.vendor}
                result={result}
                intent={intent}
              />
            )}

            {result && (
              <VerdictBar
                result={result}
                overrideSuccess={overrideSuccess}
                onRequestReview={() => setShowBlockReview(true)}
              />
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-block-border bg-block-subtle px-4 py-3 text-[0.88rem] text-block-text">
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Block review / override modal ──────────────────────────────── */}
      {showBlockReview && result?.decision === "BLOCK" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/30 p-4 backdrop-blur-sm"
          onClick={() => setShowBlockReview(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-[1.4rem] font-semibold text-text-primary">Blocked by governance</h3>
            <p className="mt-1 text-[0.9rem] text-text-secondary">
              {result.vendor} — {result.item} · SGD {Number(result.price).toFixed(2)}
            </p>
            <p className="mt-4 rounded-lg border border-block-border bg-block-subtle p-3 text-[0.88rem] text-block-text">
              {result.rationale}
            </p>
            <p className="mb-2 mt-4 text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">
              Failed rules
            </p>
            <ul className="mb-6 max-h-48 space-y-2 overflow-y-auto">
              {result.checkedRules
                .filter((r) => !r.passed)
                .map((r, i) => (
                  <li key={i} className="text-[0.86rem]">
                    <span className="font-medium text-block-text">{r.rule}</span>
                    <p className="mt-0.5 text-[0.8rem] text-text-muted">{r.detail}</p>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBlockReview(false)}
                className="flex-1 rounded-lg border border-border py-2 text-[0.88rem] font-medium text-text-secondary transition-colors hover:bg-surface-raised"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setShowBlockReview(false);
                  await handleOverride();
                }}
                disabled={overrideLoading}
                className="flex-1 rounded-lg bg-review py-2 text-[0.88rem] font-medium text-text-inverse transition hover:brightness-105 disabled:opacity-50"
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

// ── Final verdict bar ────────────────────────────────────────────────────────
function VerdictBar({
  result,
  overrideSuccess,
  onRequestReview,
}: {
  result: import("@/lib/useAgentStream").AgentResult;
  overrideSuccess: boolean;
  onRequestReview: () => void;
}) {
  const accepted = result.decision === "ACCEPT";
  const settled = accepted || overrideSuccess;

  return (
    <div
      className={`mt-6 rounded-2xl border p-6 shadow-sm ${
        settled ? "border-accept-border bg-accept-subtle" : "border-review-border bg-review-subtle"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-wide text-text-inverse ${
              settled ? "bg-accept" : "bg-review"
            }`}
          >
            {settled ? "✓ Payment settled" : "⏸ Held for review"}
          </span>
          <p className="font-serif mt-3 text-[1.5rem] font-semibold leading-tight text-text-primary">
            {result.vendor}
          </p>
          <p className="mt-0.5 text-[0.92rem] text-text-secondary">
            {result.item} · <span className="font-mono">SGD {Number(result.price).toFixed(2)}</span>
            {result.contractName && <> · {result.contractName}</>}
          </p>
          <p className="mt-3 max-w-2xl text-[0.9rem] leading-relaxed text-text-secondary">
            {result.rationale}
          </p>
          {result.stripePaymentIntentId && (
            <p className="mt-3 font-mono text-[0.76rem] text-text-muted">
              Stripe · {result.stripePaymentIntentId}
            </p>
          )}
        </div>

        {!accepted && !overrideSuccess && (
          <button
            onClick={onRequestReview}
            className="shrink-0 rounded-lg bg-review px-5 py-2.5 text-[0.88rem] font-medium text-text-inverse transition hover:brightness-105"
          >
            Review & override
          </button>
        )}
        {overrideSuccess && (
          <span className="shrink-0 self-center rounded-lg border border-accept-border bg-accept-subtle px-4 py-2 text-[0.85rem] font-medium text-accept-text">
            ✓ Overridden & executed
          </span>
        )}
      </div>
    </div>
  );
}
