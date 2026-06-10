"use client";
import { useState, useEffect } from "react";

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

const BLANK_CONTRACT = {
  name: "",
  budget_cap: 100,
  budget_period: "per_transaction",
  category_constraints: [] as string[],
  vendor_blocklist: [] as string[],
  vendor_allowlist: [] as string[],
  risk_threshold: "medium",
  active: true,
};

function TagInput({ label, values, onChange }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  }
  return (
    <div>
      <label className="block text-overline uppercase text-text-muted mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {values.map(v => (
          <span key={v} className="bg-surface-raised text-text-secondary text-caption px-2 py-0.5 rounded-full flex items-center gap-1">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-text-muted hover:text-block-text">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Type and press Enter"
          className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-caption text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
        />
        <button onClick={addTag} className="text-caption bg-surface-raised border border-border text-text-secondary hover:text-text-primary px-2 py-1 rounded">Add</button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...BLANK_CONTRACT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [reviewTx, setReviewTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  async function saveContract() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const r = await fetch(`/api/contracts/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `Save failed (${r.status})`); }
      } else {
        const r = await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `Save failed (${r.status})`); }
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...BLANK_CONTRACT });
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  async function deactivateContract(id: string) {
    await fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    await loadAll();
  }

  async function deleteContractHandler(id: string) {
    try {
      await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (selectedContractId === id) {
        setSelectedContractId("");
        setBudget(null);
      }
      await loadAll();
    } catch {}
    setDeleteConfirm(null);
  }

  function editContract(c: Contract) {
    setError(null);
    setFormData({
      name: c.name,
      budget_cap: c.budget_cap,
      budget_period: c.budget_period,
      category_constraints: c.category_constraints || [],
      vendor_blocklist: c.vendor_blocklist || [],
      vendor_allowlist: c.vendor_allowlist || [],
      risk_threshold: c.risk_threshold,
      active: c.active,
    });
    setEditingId(c.id);
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

  const inputCls = "w-full bg-surface-raised border border-border rounded px-2 py-1 text-label text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue";

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-muted">Loading…</div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-display text-display-xl text-text-primary mb-8">Governance Dashboard</h1>

      {loadError && (
        <div className="mb-6 bg-block-subtle border border-block-border text-block-text text-body rounded-lg px-4 py-3 flex items-center justify-between">
          <span>Could not load data: {loadError}</span>
          <button onClick={loadAll} className="text-caption underline ml-4">Retry</button>
        </div>
      )}

      {budget && selectedContract && (
        <div className="mb-8 bg-surface border border-border rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-overline uppercase text-text-muted">Budget</p>
              <h2 className="font-display text-display-lg text-text-primary mt-1">{selectedContract.name.trim()}</h2>
              <p className="text-body text-text-secondary mt-1 font-mono">
                SGD {budget.budgetCap.toFixed(2)} / {budget.budgetPeriod}
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
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Spent</p>
              <p className="font-display text-display-md text-text-primary tabular-nums">SGD {budget.spent.toFixed(2)}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Remaining</p>
              <p className="font-display text-display-md text-accept-text tabular-nums">SGD {budget.remaining.toFixed(2)}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-overline uppercase text-text-muted">Used</p>
              <p className="font-display text-display-md text-text-primary tabular-nums">{budget.percentUsed.toFixed(0)}%</p>
            </div>
          </div>
          <div className="h-3 bg-surface-raised rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-standard ease-smooth ${budget.percentUsed > 90 ? "bg-block" : budget.percentUsed > 70 ? "bg-review" : "bg-accept"}`}
              style={{ width: `${budget.percentUsed}%` }}
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
              onClick={() => { setShowForm(true); setEditingId(null); setFormData({ ...BLANK_CONTRACT }); setError(null); }}
              className="text-label bg-accent-blue text-text-inverse px-3 py-1.5 rounded-lg hover:bg-accent-blue-hover transition-colors duration-micro"
            >
              + New
            </button>
          </div>

          {showForm && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <p className="text-label font-semibold text-text-primary">{editingId ? "Edit contract" : "New contract"}</p>
              {error && <p className="text-caption text-block-text">{error}</p>}

              <div>
                <label className="block text-overline uppercase text-text-muted mb-1">Name</label>
                <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-overline uppercase text-text-muted mb-1">Budget cap (SGD)</label>
                  <input type="number" value={formData.budget_cap}
                    onChange={e => setFormData(f => ({ ...f, budget_cap: parseFloat(e.target.value) }))}
                    className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-overline uppercase text-text-muted mb-1">Period</label>
                  <select value={formData.budget_period}
                    onChange={e => setFormData(f => ({ ...f, budget_period: e.target.value }))}
                    className={inputCls}>
                    <option value="per_transaction">Per transaction</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-overline uppercase text-text-muted mb-1">Risk threshold</label>
                <select value={formData.risk_threshold}
                  onChange={e => setFormData(f => ({ ...f, risk_threshold: e.target.value }))}
                  className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="strict">Strict</option>
                </select>
              </div>

              <TagInput label="Category constraints" values={formData.category_constraints}
                onChange={v => setFormData(f => ({ ...f, category_constraints: v }))} />
              <TagInput label="Vendor blocklist" values={formData.vendor_blocklist}
                onChange={v => setFormData(f => ({ ...f, vendor_blocklist: v }))} />
              <TagInput label="Vendor allowlist (empty = all)" values={formData.vendor_allowlist}
                onChange={v => setFormData(f => ({ ...f, vendor_allowlist: v }))} />

              <div className="flex gap-2 pt-1">
                <button onClick={saveContract} disabled={saving || !formData.name}
                  className="flex-1 bg-accent-blue text-text-inverse text-label py-1.5 rounded-lg hover:bg-accent-blue-hover disabled:opacity-40 transition-colors duration-micro">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-border text-text-secondary text-label py-1.5 rounded-lg hover:bg-surface-raised">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contracts.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedContractId(c.id)}
                className={`bg-surface border rounded-xl p-3 cursor-pointer transition-colors duration-micro ${
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
                <p className="text-caption text-text-muted font-mono">SGD {c.budget_cap} / {c.budget_period} · {c.risk_threshold} risk</p>
                {c.category_constraints?.length > 0 && (
                  <p className="text-caption text-text-muted mt-0.5">{c.category_constraints.join(", ")}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => editContract(c)} className="text-caption text-accent-blue hover:text-accent-blue-hover">Edit</button>
                  {c.active && (
                    <button onClick={() => deactivateContract(c.id)} className="text-caption text-block-text hover:underline">Deactivate</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id); }} className="text-caption text-block-text hover:underline">Delete</button>
                </div>
              </div>
            ))}
            {contracts.length === 0 && (
              <p className="text-caption text-text-muted text-center py-4">No contracts yet</p>
            )}
          </div>
        </div>

        {/* Right: Transactions */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-display-md text-text-primary">Transaction Log</h2>
            <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)}
              className="text-caption bg-surface-raised border border-border rounded px-2 py-1 text-text-secondary focus:outline-none">
              <option value="ALL">All</option>
              <option value="ACCEPT">ACCEPT</option>
              <option value="BLOCK">BLOCK</option>
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
                    <span className={`text-caption font-bold px-2 py-0.5 rounded ${
                      tx.overridden_by ? "bg-review-subtle text-review-text" :
                      tx.governance_decision === "ACCEPT" ? "bg-accept-subtle text-accept-text" : "bg-block-subtle text-block-text"
                    }`}>
                      {tx.overridden_by ? "OVERRIDE" : tx.governance_decision}
                    </span>
                    <div>
                      <p className="text-label font-medium text-text-primary">{tx.winner_vendor} — {tx.winner_item}</p>
                      <p className="text-caption text-text-muted">{tx.user_intent}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-label font-semibold text-text-secondary font-mono">SGD {Number(tx.winner_price).toFixed(2)}</p>
                    <p className="text-caption text-text-muted">{new Date(tx.created_at).toLocaleString()}</p>
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
                          className="text-caption bg-review text-text-inverse px-3 py-1.5 rounded-lg hover:brightness-110 transition-[filter] duration-micro"
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
                <p className="text-body text-text-muted">No transactions for this contract yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReviewTx(null)}>
          <div className="bg-surface-raised border border-border rounded-2xl max-w-lg w-full p-6 shadow-lg" onClick={e => e.stopPropagation()}>
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
                className="flex-1 bg-review text-text-inverse py-2 rounded-lg text-label font-medium hover:brightness-110 transition-[filter] duration-micro"
              >
                {overrideLoading === reviewTx.id ? "Approving…" : "Override & execute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface-raised border border-border rounded-2xl max-w-lg w-full p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-display-md text-text-primary mb-1">Delete contract?</h3>
            <p className="text-body text-text-secondary mb-4">
              This will permanently delete the contract "{contracts.find(c => c.id === deleteConfirm)?.name}". This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-border text-text-secondary py-2 rounded-lg text-label hover:bg-surface">
                Cancel
              </button>
              <button
                onClick={() => deleteContractHandler(deleteConfirm)}
                className="flex-1 bg-block text-text-inverse py-2 rounded-lg text-label font-medium hover:brightness-110 transition-[filter] duration-micro"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
