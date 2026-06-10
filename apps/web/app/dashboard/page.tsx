"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import Dialog from "@/components/Dialog";
import ContractForm, { type ContractFormValues } from "@/components/ContractForm";
import { periodLabel, decisionLabel } from "@/lib/labels";

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
  created_at: string;
}

interface Transaction {
  id: string;
  contract_id: string;
  user_intent: string;
  winner_vendor: string;
  winner_item: string;
  winner_price: number;
  governance_decision: string;
  stripe_payment_intent_id?: string;
  requires_human_review: boolean;
  overridden_by?: string;
  created_at: string;
  rationale?: string;
  full_result?: {
    checkedRules?: Array<{ rule: string; passed: boolean; detail: string }>;
    rationale?: string;
    decision?: { rationale?: string; checkedRules?: Array<{ rule: string; passed: boolean; detail: string }> };
  };
}

interface BudgetSummary {
  contractId: string;
  name: string;
  budgetCap: number;
  budgetPeriod: string;
  spent: number;
  remaining: number;
  percentUsed: number;
}

function toFormValues(c: Contract): ContractFormValues {
  return {
    name: c.name,
    budget_cap: c.budget_cap,
    budget_period: c.budget_period,
    category_constraints: c.category_constraints || [],
    vendor_blocklist: c.vendor_blocklist || [],
    vendor_allowlist: c.vendor_allowlist || [],
    risk_threshold: c.risk_threshold,
    active: c.active,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* Skeleton mirrors the loaded layout (budget card + two columns) so the page
 * doesn't jump when data lands. Pulse only — no spinner chrome. */
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      <div className="h-44 rounded-2xl bg-surface" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <div className="h-6 w-44 rounded bg-surface" />
          <div className="h-20 rounded-xl bg-surface" />
          <div className="h-20 rounded-xl bg-surface" />
        </div>
        <div className="lg:col-span-3 space-y-2">
          <div className="h-6 w-40 rounded bg-surface" />
          <div className="h-16 rounded-xl bg-surface" />
          <div className="h-16 rounded-xl bg-surface" />
          <div className="h-16 rounded-xl bg-surface" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [reviewTx, setReviewTx] = useState<Transaction | null>(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selectedContractId) loadBudget(selectedContractId);
  }, [selectedContractId, transactions]);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [cr, tr] = await Promise.all([
        fetch("/api/contracts").then(r => { if (!r.ok) throw new Error(`contracts ${r.status}`); return r.json(); }),
        fetch("/api/transactions").then(r => { if (!r.ok) throw new Error(`transactions ${r.status}`); return r.json(); }),
      ]);
      const contractList = Array.isArray(cr) ? cr : [];
      setContracts(contractList);
      setTransactions(Array.isArray(tr) ? tr : []);
      if (!selectedContractId && contractList.length > 0) {
        const food = contractList.find((c: Contract) => c.name.toLowerCase().includes("food"));
        setSelectedContractId(food?.id ?? contractList[0].id);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }

  async function loadBudget(contractId: string) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/budget`);
      if (res.ok) setBudget(await res.json());
    } catch {}
  }

  async function deactivateContract(c: Contract) {
    if (!window.confirm(`Deactivate "${c.name.trim()}"? It will stop accepting new procurements.`)) return;
    await fetch(`/api/contracts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    await loadAll();
  }

  function editContract(c: Contract) {
    setEditing(c);
    setShowForm(true);
  }

  async function overrideTx(txId: string) {
    setOverrideLoading(txId);
    try {
      await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, approvedBy: "dashboard-user" }),
      });
      await loadAll();
    } catch {}
    setOverrideLoading(null);
  }

  const selectedContract = contracts.find(c => c.id === selectedContractId);

  const filteredTx = transactions.filter(t => {
    if (selectedContractId && t.contract_id !== selectedContractId) return false;
    return filterDecision === "ALL" || t.governance_decision === filterDecision;
  });

  function getFailedRules(tx: Transaction) {
    const rules = tx.full_result?.checkedRules ?? tx.full_result?.decision?.checkedRules ?? [];
    return rules.filter(r => !r.passed);
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      {/* One wordmark, one route out — mirrors the procure page header. */}
      <header className="flex items-center justify-between mb-10">
        <Wordmark />
        <Link
          href="/"
          className="text-label text-text-muted transition-colors duration-micro hover:text-text-secondary"
        >
          New procurement →
        </Link>
      </header>

      <h1 className="font-display text-display-xl text-text-primary mb-8">Governance Dashboard</h1>

      {loadError && (
        <div className="mb-6 bg-block-subtle border border-block-border text-block-text text-body rounded-lg px-4 py-3 flex items-center justify-between">
          <span>Could not load data: {loadError}</span>
          <button onClick={loadAll} className="text-caption underline ml-4">Retry</button>
        </div>
      )}

      {loading ? <DashboardSkeleton /> : (
      <>
      {budget && selectedContract && (
        <div className="mb-8 bg-surface border border-border rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-overline uppercase text-text-muted">Budget</p>
              {/* The numbers are the point of this card — the contract name labels them. */}
              <p className="text-label font-semibold text-text-primary mt-1">{selectedContract.name.trim()}</p>
              <p className="text-caption text-text-secondary mt-0.5 font-mono">
                SGD {budget.budgetCap.toFixed(2)} / {periodLabel(budget.budgetPeriod)}
              </p>
            </div>
            <select
              value={selectedContractId}
              onChange={e => setSelectedContractId(e.target.value)}
              className="text-label bg-surface-raised border border-border rounded-lg px-3 py-2 text-text-secondary"
            >
              {contracts.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name.trim()}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Spent</p>
              <p className="font-display text-display-lg text-text-primary tabular-nums">SGD {budget.spent.toFixed(2)}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Remaining</p>
              <p className="font-display text-display-lg text-accept-text tabular-nums">SGD {budget.remaining.toFixed(2)}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Used</p>
              <p className="font-display text-display-lg text-text-primary tabular-nums">{budget.percentUsed.toFixed(0)}%</p>
            </div>
          </div>
          <div className="h-3 bg-surface-raised rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-standard ease-smooth ${budget.percentUsed > 90 ? "bg-block" : budget.percentUsed > 70 ? "bg-review" : "bg-accept"}`}
              style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
            />
          </div>
          {selectedContract.category_constraints?.length > 0 && (
            <p className="text-caption text-text-muted mt-3">
              Rules: {selectedContract.category_constraints.join(", ")}
              {selectedContract.vendor_blocklist?.length > 0 && ` · Blocked: ${selectedContract.vendor_blocklist.join(", ")}`}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Contracts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-display-md text-text-primary">Spending Contracts</h2>
            <button
              onClick={() => { setShowForm(true); setEditing(null); }}
              className="text-label bg-accent-blue text-text-inverse px-3 py-1.5 rounded-lg hover:bg-accent-blue-hover transition-colors duration-micro"
            >
              + New
            </button>
          </div>

          {showForm && (
            <ContractForm
              key={editing?.id ?? "new"}
              initial={editing ? toFormValues(editing) : undefined}
              contractId={editing?.id}
              onSaved={async () => {
                setShowForm(false);
                setEditing(null);
                await loadAll();
              }}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          )}

          <div className="space-y-2">
            {contracts.map(c => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedContractId(c.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedContractId(c.id);
                  }
                }}
                className={`bg-surface border rounded-xl p-3 cursor-pointer transition-colors duration-micro focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue ${
                  c.id === selectedContractId ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue-subtle" :
                  c.active ? "border-border-subtle hover:border-border" : "border-border-subtle opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-label font-semibold text-text-primary">{c.name}</span>
                  <span className={`text-caption px-2 py-0.5 rounded-full ${c.active ? "bg-accept-subtle text-accept-text" : "bg-surface-raised text-text-muted"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-caption text-text-muted font-mono">SGD {c.budget_cap} / {periodLabel(c.budget_period)} · {c.risk_threshold} risk</p>
                {c.category_constraints?.length > 0 && (
                  <p className="text-caption text-text-muted mt-0.5">{c.category_constraints.join(", ")}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={e => { e.stopPropagation(); editContract(c); }}
                    className="text-caption text-accent-blue hover:text-accent-blue-hover"
                  >
                    Edit
                  </button>
                  {c.active && (
                    <button
                      onClick={e => { e.stopPropagation(); deactivateContract(c); }}
                      className="text-caption text-block-text hover:underline"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
            {contracts.length === 0 && !showForm && (
              <div className="bg-surface border border-border rounded-xl py-8 text-center">
                <p className="text-body text-text-muted mb-2">No contracts yet</p>
                <button
                  onClick={() => { setShowForm(true); setEditing(null); }}
                  className="text-label text-accent-blue hover:text-accent-blue-hover"
                >
                  Create your first contract →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Transactions */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-display-md text-text-primary">Transaction Log</h2>
            <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)}
              className="text-caption bg-surface-raised border border-border rounded px-2 py-1 text-text-secondary focus:outline-none">
              <option value="ALL">All decisions</option>
              <option value="ACCEPT">Accepted</option>
              <option value="BLOCK">Blocked</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredTx.map(tx => (
              <div key={tx.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-raised"
                  onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-caption font-semibold px-2 py-0.5 rounded ${
                      tx.overridden_by ? "bg-review-subtle text-review-text" :
                      tx.governance_decision === "ACCEPT" ? "bg-accept-subtle text-accept-text" : "bg-block-subtle text-block-text"
                    }`}>
                      {tx.overridden_by ? "Override" : decisionLabel(tx.governance_decision)}
                    </span>
                    <div>
                      <p className="text-label font-medium text-text-primary">{tx.winner_vendor} — {tx.winner_item}</p>
                      <p className="text-caption text-text-muted">{tx.user_intent}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-label font-semibold text-text-secondary font-mono">SGD {Number(tx.winner_price).toFixed(2)}</p>
                    <p className="text-caption text-text-muted">{formatDate(tx.created_at)}</p>
                  </div>
                </div>

                {expandedTx === tx.id && (
                  <div className="px-4 pb-4 border-t border-border-subtle pt-3 space-y-3">
                    {tx.stripe_payment_intent_id && (
                      <p className="text-mono-sm text-text-muted font-mono">Stripe: {tx.stripe_payment_intent_id}</p>
                    )}
                    {(tx.full_result?.checkedRules ?? tx.full_result?.decision?.checkedRules) && (
                      <div>
                        <p className="text-overline uppercase text-text-muted mb-2">Governance rules</p>
                        <div className="space-y-1.5">
                          {(tx.full_result?.checkedRules ?? tx.full_result?.decision?.checkedRules ?? []).map((r, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`text-body ${r.passed ? "text-accept-text" : "text-block-text"}`}>{r.passed ? "✓" : "✗"}</span>
                              <div>
                                <span className="text-caption font-medium text-text-secondary">{r.rule}</span>
                                <span className="text-caption text-text-muted ml-1">{r.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {tx.governance_decision === "BLOCK" && !tx.overridden_by && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReviewTx(tx)}
                          className="text-caption border border-border text-text-secondary px-3 py-1.5 rounded-lg hover:bg-surface-raised"
                        >
                          Review block
                        </button>
                        <button
                          onClick={() => overrideTx(tx.id)}
                          disabled={overrideLoading === tx.id}
                          className="text-caption bg-review text-text-inverse px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity duration-micro"
                        >
                          {overrideLoading === tx.id ? "Approving…" : "Override and approve"}
                        </button>
                      </div>
                    )}
                    {tx.overridden_by && (
                      <p className="text-caption text-review-text">Overridden by {tx.overridden_by}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filteredTx.length === 0 && (
              <div className="bg-surface border border-border rounded-xl py-12 text-center">
                <p className="text-body text-text-muted mb-2">No transactions for this contract yet</p>
                <Link href="/" className="text-label text-accent-blue hover:text-accent-blue-hover">
                  Run your first procurement →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {reviewTx && (
        <Dialog onClose={() => setReviewTx(null)} ariaLabel="Transaction blocked — review">
          <h3 className="font-display text-display-md text-text-primary mb-1">Transaction blocked</h3>
          <p className="text-body text-text-secondary mb-4 font-mono">{reviewTx.winner_vendor} — {reviewTx.winner_item} · SGD {Number(reviewTx.winner_price).toFixed(2)}</p>
          <p className="text-body text-block-text bg-block-subtle border border-block-border rounded-lg p-3 mb-4">
            {reviewTx.rationale ?? reviewTx.full_result?.rationale ?? reviewTx.full_result?.decision?.rationale ?? "Governance rules failed."}
          </p>
          <p className="text-overline uppercase text-text-muted mb-2">Failed rules</p>
          <ul className="space-y-2 mb-6">
            {getFailedRules(reviewTx).map((r, i) => (
              <li key={i} className="text-body text-text-secondary">
                <span className="font-medium text-block-text">{r.rule}</span>
                <span className="text-text-muted ml-2">{r.detail.slice(0, 150)}</span>
              </li>
            ))}
            {getFailedRules(reviewTx).length === 0 && (
              <li className="text-body text-text-muted">See governance rules above for details.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <button onClick={() => setReviewTx(null)} className="flex-1 border border-border text-text-secondary py-2 rounded-lg text-label hover:bg-surface">
              Close
            </button>
            <button
              onClick={async () => { await overrideTx(reviewTx.id); setReviewTx(null); }}
              disabled={overrideLoading === reviewTx.id}
              className="flex-1 bg-review text-text-inverse py-2 rounded-lg text-label font-medium hover:opacity-90 transition-opacity duration-micro"
            >
              {overrideLoading === reviewTx.id ? "Approving…" : "Override & execute"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
