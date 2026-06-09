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
  user_intent: string;
  winner_vendor: string;
  winner_item: string;
  winner_price: number;
  governance_decision: string;
  stripe_payment_intent_id?: string;
  requires_human_review: boolean;
  overridden_by?: string;
  created_at: string;
  full_result?: {
    checkedRules?: Array<{ rule: string; passed: boolean; detail: string }>;
    rationale?: string;
  };
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
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {values.map(v => (
          <span key={v} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-slate-400 hover:text-red-500">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Type and press Enter"
          className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
        <button onClick={addTag} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">Add</button>
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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cr, tr] = await Promise.all([
        fetch("/api/contracts").then(r => r.json()),
        fetch("/api/transactions").then(r => r.json()),
      ]);
      setContracts(cr);
      setTransactions(tr);
    } catch {}
    setLoading(false);
  }

  async function saveContract() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetch(`/api/contracts/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
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

  function editContract(c: Contract) {
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

  const filteredTx = transactions.filter(t =>
    filterDecision === "ALL" || t.governance_decision === filterDecision
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Governance Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Contracts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Spending Contracts</h2>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setFormData({ ...BLANK_CONTRACT }); }}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700"
            >
              + New
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">{editingId ? "Edit contract" : "New contract"}</p>
              {error && <p className="text-xs text-red-500">{error}</p>}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Budget cap (SGD)</label>
                  <input type="number" value={formData.budget_cap}
                    onChange={e => setFormData(f => ({ ...f, budget_cap: parseFloat(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Period</label>
                  <select value={formData.budget_period}
                    onChange={e => setFormData(f => ({ ...f, budget_period: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300">
                    <option value="per_transaction">Per transaction</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Risk threshold</label>
                <select value={formData.risk_threshold}
                  onChange={e => setFormData(f => ({ ...f, risk_threshold: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300">
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
                  className="flex-1 bg-slate-900 text-white text-sm py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm py-1.5 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contracts.map(c => (
              <div key={c.id} className={`bg-white border rounded-xl p-3 ${c.active ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">SGD {c.budget_cap} / {c.budget_period} · {c.risk_threshold} risk</p>
                {c.category_constraints?.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{c.category_constraints.join(", ")}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => editContract(c)} className="text-xs text-blue-500 hover:underline">Edit</button>
                  {c.active && (
                    <button onClick={() => deactivateContract(c.id)} className="text-xs text-red-400 hover:underline">Deactivate</button>
                  )}
                </div>
              </div>
            ))}
            {contracts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No contracts yet</p>
            )}
          </div>
        </div>

        {/* Right: Transactions */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Transaction Log</h2>
            <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none">
              <option value="ALL">All</option>
              <option value="ACCEPT">ACCEPT</option>
              <option value="BLOCK">BLOCK</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredTx.map(tx => (
              <div key={tx.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      tx.overridden_by ? "bg-yellow-100 text-yellow-700" :
                      tx.governance_decision === "ACCEPT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {tx.overridden_by ? "OVERRIDE" : tx.governance_decision}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{tx.winner_vendor} — {tx.winner_item}</p>
                      <p className="text-xs text-slate-400">{tx.user_intent}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">SGD {Number(tx.winner_price).toFixed(2)}</p>
                    <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {expandedTx === tx.id && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {tx.stripe_payment_intent_id && (
                      <p className="text-xs text-slate-400 font-mono">Stripe: {tx.stripe_payment_intent_id}</p>
                    )}
                    {tx.full_result?.checkedRules && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Governance rules</p>
                        <div className="space-y-1.5">
                          {tx.full_result.checkedRules.map((r, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`text-sm ${r.passed ? "text-green-500" : "text-red-500"}`}>{r.passed ? "✓" : "✗"}</span>
                              <div>
                                <span className="text-xs font-medium text-slate-700">{r.rule}</span>
                                <span className="text-xs text-slate-400 ml-1">{r.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {tx.governance_decision === "BLOCK" && !tx.overridden_by && (
                      <button
                        onClick={() => overrideTx(tx.id)}
                        disabled={overrideLoading === tx.id}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
                      >
                        {overrideLoading === tx.id ? "Approving…" : "Override and approve"}
                      </button>
                    )}
                    {tx.overridden_by && (
                      <p className="text-xs text-yellow-600">Overridden by {tx.overridden_by}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filteredTx.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl py-12 text-center">
                <p className="text-slate-400 text-sm">No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
