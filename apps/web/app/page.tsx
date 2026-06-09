"use client";

import { useEffect, useState } from "react";
import NodeGraph from "@/components/NodeGraph";
import AgentLog from "@/components/AgentLog";
import ResultCard, { type SupplierPitch } from "@/components/ResultCard";
import { useAgentStream } from "@/lib/useAgentStream";

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

export default function ProcurePage() {
  const [intent, setIntent] = useState("");
  const [contractId, setContractId] = useState("");
  const [mode, setMode] = useState<ProcureMode>("find");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [showBlockReview, setShowBlockReview] = useState(false);

  const { graphState, logs, result, isComplete } = useAgentStream(transactionId);
  const selectedContract = contracts.find((c) => c.id === contractId);

  // A search is in flight or done once we have a transaction id → switch to the
  // two-column active layout (idle hero animates up to the top).
  const active = transactionId !== null;
  const running = active && !isComplete;

  useEffect(() => {
    loadContracts();
  }, []);

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
    if (mode === "auction") {
      setError("Auction mode is coming soon — switch to Find for the live demo.");
      return;
    }

    setError(null);
    setOverrideSuccess(false);
    setShowBlockReview(false);
    setTransactionId(null);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOverrideLoading(false);
    }
  }

  const pitches = (result?.pitches ?? []) as SupplierPitch[];

  return (
    <main className="relative min-h-screen overflow-hidden px-8 pb-20">
      {/* Wordmark */}
      <header className="relative z-10 flex items-center justify-between py-5">
        <span className="font-display text-display-md text-text-primary">
          Agent<span className="text-accent-blue">Bid</span>
        </span>
        <a href="/dashboard" className="text-label text-text-muted transition-colors duration-micro hover:text-text-secondary">
          Dashboard →
        </a>
      </header>

      {/* Ambient mock graph behind the idle hero — also proves NodeGraph renders
          from mock state with no active search. */}
      {!active && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
          <div className="w-[720px] max-w-[82vw] opacity-[0.14]">
            <NodeGraph mockMode />
          </div>
        </div>
      )}

      {/* Search zone — travels from centered (idle) to the top (active). */}
      <section
        className="relative z-10 mx-auto max-w-3xl transition-transform duration-[400ms] ease-out-expo will-change-transform"
        style={{ transform: active ? "translateY(0)" : "translateY(30vh)" }}
      >
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-md transition-colors duration-micro focus-within:border-accent-blue">
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
              className="w-full resize-none bg-transparent text-body-lg text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
              <div className="flex items-center gap-3">
                {/* Mode toggle */}
                <div className="flex overflow-hidden rounded-lg border border-border">
                  {(["find", "auction"] as ProcureMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`px-3 py-1.5 text-label capitalize transition-colors duration-micro ${
                        mode === m
                          ? "bg-accent-blue text-text-inverse"
                          : "bg-surface-raised text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Contract selector */}
                {contractsLoading ? (
                  <span className="text-caption text-text-muted">Loading contracts…</span>
                ) : contracts.length === 0 ? (
                  <a href="/dashboard" className="text-label text-accent-blue hover:text-accent-blue-hover">
                    Create a contract →
                  </a>
                ) : (
                  <select
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-label text-text-secondary outline-none transition-colors duration-micro focus:border-accent-blue"
                  >
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · SGD {c.budget_cap}/{c.budget_period}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={running || !intent.trim() || !contractId || mode === "auction"}
                className="flex items-center gap-2 rounded-lg bg-accent-blue px-5 py-2 text-label text-text-inverse transition hover:bg-accent-blue-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {running ? "Running…" : "Procure"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-block-border bg-block-subtle px-4 py-3 text-body text-block-text">
              {error}
            </div>
          )}
        </form>

        {!active && (
          <p className="mt-5 text-center text-caption text-text-muted">
            Express a purchase intent — agents discover options, run an adversarial supplier pitch, and enforce your
            spending contract.
          </p>
        )}
      </section>

      {/* Active layout: node graph (left) + live feed / result (right). The grid
          is viewport-bounded so the feed fills available space and scrolls; when
          the result card mounts it claims space below and the feed flex-shrinks —
          a smooth height transition rather than a jump. */}
      {active && (
        <section className="relative z-10 mx-auto mt-10 grid max-w-6xl grid-cols-[55fr_45fr] gap-6 lg:h-[calc(100vh-210px)] lg:min-h-[520px]">
          {/* Left — node graph */}
          <div className="animate-col-rise self-start" style={{ animationDelay: "200ms" }}>
            <NodeGraph graphState={graphState} contractName={selectedContract?.name} />
          </div>

          {/* Right — live agent feed + result card */}
          <div className="animate-col-rise flex min-h-0 flex-col gap-4" style={{ animationDelay: "320ms" }}>
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border-subtle bg-surface p-4">
              <AgentLog logs={logs} />
            </div>

            {result && (
              <div className="scroll-custom animate-card-reveal max-h-[62%] shrink-0 overflow-y-auto">
                <ResultCard
                  result={result}
                  pitches={pitches}
                  overrideSuccess={overrideSuccess}
                  onRequestReview={() => setShowBlockReview(true)}
                  budgetCap={selectedContract?.budget_cap}
                  budgetPeriod={selectedContract?.budget_period}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Block-review override modal */}
      {showBlockReview && result?.decision === "BLOCK" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowBlockReview(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-display-md text-text-primary">Blocked by governance</h3>
            <p className="mt-1 text-body text-text-secondary">
              {result.vendor} — {result.item} · SGD {Number(result.price).toFixed(2)}
            </p>
            <p className="mt-4 rounded-lg border border-block-border bg-block-subtle p-3 text-body text-block-text">
              {result.rationale}
            </p>
            <p className="mt-4 mb-2 text-overline uppercase text-text-muted">Failed rules</p>
            <ul className="mb-6 max-h-48 space-y-2 overflow-y-auto">
              {result.checkedRules
                .filter((r) => !r.passed)
                .map((r, i) => (
                  <li key={i} className="text-body">
                    <span className="text-label text-block-text">{r.rule}</span>
                    <p className="mt-0.5 text-caption text-text-muted">{r.detail}</p>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBlockReview(false)}
                className="flex-1 rounded-lg border border-border py-2 text-label text-text-secondary transition-colors duration-micro hover:bg-surface-raised"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setShowBlockReview(false);
                  await handleOverride();
                }}
                disabled={overrideLoading}
                className="flex-1 rounded-lg bg-review py-2 text-label text-text-inverse transition hover:brightness-110 disabled:opacity-50"
              >
                {overrideLoading ? "Approving…" : "Override & execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
