"use client";
import { useEffect, useState } from "react";

export interface FlexibilityRules {
  price: { hardCap: boolean; overspendTolerancePct: number };
  vendor: { strictAllowlist: boolean; blockUnverified: boolean };
  intent: { strictMatch: boolean; allowUpgrades: boolean };
  custom: string[];
}

// Shared contract shape. Exported so app/page.tsx can reuse it.
export interface Contract {
  id: string;
  name: string;
  budget_cap: number;
  budget_period: string;
  category_constraints: string[];
  vendor_blocklist: string[];
  vendor_allowlist: string[];
  risk_threshold: string;
  flexibility_rules?: FlexibilityRules;
  active: boolean;
}

export type ProcureMode = "find" | "auction";

interface BudgetSummary {
  contractId: string;
  name: string;
  budgetCap: number;
  budgetPeriod: string;
  spent: number;
  remaining: number;
  percentUsed: number;
}

interface SidebarProps {
  mode: ProcureMode;
  onModeChange: (mode: ProcureMode) => void;
  contracts: Contract[];
  contractsLoading: boolean;
  contractId: string;
  onSelectContract: (id: string) => void;
  /** Called after a new contract is saved so the parent can reload the list. */
  onContractsChanged: () => void | Promise<void>;
  /** Refresh signal — bump to refetch the budget meter (e.g. after a procurement). */
  budgetRefreshKey?: number;
}

const PERIOD_LABEL: Record<string, string> = {
  per_transaction: "per transaction",
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

// ---- Inline tag input (constraints / blocklist) ----------------------------
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
  }
  return (
    <div>
      <label className="block text-overline uppercase text-text-muted mb-1">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="bg-surface-raised text-text-secondary text-caption px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-text-muted hover:text-block-text"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-caption text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
        />
        <button
          type="button"
          onClick={addTag}
          className="text-caption bg-surface-raised border border-border text-text-secondary hover:text-text-primary px-2 py-1 rounded"
        >
          Add
        </button>
      </div>
    </div>
  );
}

const DEFAULT_FLEXIBILITY_RULES = {
  price: { hardCap: false, overspendTolerancePct: 10 },
  vendor: { strictAllowlist: false, blockUnverified: true },
  intent: { strictMatch: false, allowUpgrades: true },
  custom: [] as string[],
};

const BLANK_CONTRACT = {
  name: "",
  budget_cap: 100,
  budget_period: "monthly",
  category_constraints: [] as string[],
  vendor_blocklist: [] as string[],
  vendor_allowlist: [] as string[],
  risk_threshold: "medium",
  flexibility_rules: DEFAULT_FLEXIBILITY_RULES,
  active: true,
};

// ---- New-contract inline form ----------------------------------------------
function NewContractForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK_CONTRACT });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flexibilityExpanded, setFlexibilityExpanded] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `Save failed (${r.status})`);
      }
      await onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  const inputCls =
    "w-full bg-surface-raised border border-border rounded px-2 py-1 text-label text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue";

  return (
    <div className="mt-2 rounded-lg border border-accent-blue-subtle bg-surface-raised/60 p-3 space-y-3 animate-col-rise">
      <p className="text-overline uppercase text-text-muted">New contract</p>
      {error && <p className="text-caption text-block-text">{error}</p>}

      <div>
        <label className="block text-overline uppercase text-text-muted mb-1">Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Food &amp; dining"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-overline uppercase text-text-muted mb-1">Cap (SGD)</label>
          <input
            type="number"
            value={form.budget_cap}
            onChange={(e) => setForm((f) => ({ ...f, budget_cap: parseFloat(e.target.value) }))}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className="block text-overline uppercase text-text-muted mb-1">Period</label>
          <select
            value={form.budget_period}
            onChange={(e) => setForm((f) => ({ ...f, budget_period: e.target.value }))}
            className={inputCls}
          >
            <option value="per_transaction">Per transaction</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div className="border border-border rounded-lg p-2.5">
        <button
          type="button"
          onClick={() => setFlexibilityExpanded(!flexibilityExpanded)}
          className="w-full flex items-center justify-between text-caption font-semibold text-text-primary hover:text-accent-blue transition-colors"
        >
          <span>Advanced rules</span>
          <span className={`transition-transform ${flexibilityExpanded ? "rotate-180" : ""}`}>▼</span>
        </button>

        {flexibilityExpanded && (
          <div className="mt-2 space-y-2 pt-2 border-t border-border-subtle text-caption">
            <div className="space-y-1.5">
              <p className="text-overline uppercase text-text-muted">Price</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.flexibility_rules?.price.hardCap ?? false}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    flexibility_rules: {
                      ...f.flexibility_rules!,
                      price: { ...f.flexibility_rules!.price, hardCap: e.target.checked }
                    }
                  }))}
                  className="w-3 h-3 rounded"
                />
                <span className="text-caption text-text-secondary">Hard cap (never exceed)</span>
              </label>
              {!(form.flexibility_rules?.price.hardCap ?? false) && (
                <div className="ml-5">
                  <p className="text-text-secondary mb-0.5">Tolerance: {form.flexibility_rules?.price.overspendTolerancePct ?? 10}%</p>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="5"
                    value={form.flexibility_rules?.price.overspendTolerancePct ?? 10}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      flexibility_rules: {
                        ...f.flexibility_rules!,
                        price: { ...f.flexibility_rules!.price, overspendTolerancePct: parseInt(e.target.value) }
                      }
                    }))}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-border-subtle">
              <p className="text-overline uppercase text-text-muted">Vendor</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.flexibility_rules?.vendor.blockUnverified ?? true}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    flexibility_rules: {
                      ...f.flexibility_rules!,
                      vendor: { ...f.flexibility_rules!.vendor, blockUnverified: e.target.checked }
                    }
                  }))}
                  className="w-3 h-3 rounded"
                />
                <span className="text-caption text-text-secondary">Block unverified</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.flexibility_rules?.vendor.strictAllowlist ?? false}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    flexibility_rules: {
                      ...f.flexibility_rules!,
                      vendor: { ...f.flexibility_rules!.vendor, strictAllowlist: e.target.checked }
                    }
                  }))}
                  className="w-3 h-3 rounded"
                />
                <span className="text-caption text-text-secondary">Strict allowlist</span>
              </label>
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-border-subtle">
              <p className="text-overline uppercase text-text-muted">Intent</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.flexibility_rules?.intent.strictMatch ?? false}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    flexibility_rules: {
                      ...f.flexibility_rules!,
                      intent: { ...f.flexibility_rules!.intent, strictMatch: e.target.checked }
                    }
                  }))}
                  className="w-3 h-3 rounded"
                />
                <span className="text-caption text-text-secondary">Strict match</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.flexibility_rules?.intent.allowUpgrades ?? true}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    flexibility_rules: {
                      ...f.flexibility_rules!,
                      intent: { ...f.flexibility_rules!.intent, allowUpgrades: e.target.checked }
                    }
                  }))}
                  className="w-3 h-3 rounded"
                />
                <span className="text-caption text-text-secondary">Allow upgrades</span>
              </label>
            </div>
          </div>
        )}
      </div>

      <TagInput
        label="Category constraints"
        values={form.category_constraints}
        onChange={(v) => setForm((f) => ({ ...f, category_constraints: v }))}
        placeholder="e.g. food, transport"
      />
      <TagInput
        label="Vendor blocklist"
        values={form.vendor_blocklist}
        onChange={(v) => setForm((f) => ({ ...f, vendor_blocklist: v }))}
        placeholder="Type and press Enter"
      />

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="flex-1 bg-accent-blue text-text-inverse text-label font-medium py-1.5 rounded-lg hover:bg-accent-blue-hover disabled:opacity-40 transition-colors duration-micro"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-border text-text-secondary text-label py-1.5 rounded-lg hover:bg-surface-raised"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Budget meter ----------------------------------------------------------
function BudgetMeter({
  contractId,
  refreshKey,
}: {
  contractId: string;
  refreshKey?: number;
}) {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contractId) {
      setBudget(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contracts/${contractId}/budget`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setBudget(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId, refreshKey]);

  if (!contractId) return null;

  const pct = budget ? budget.percentUsed : 0;
  // Healthy green → amber at 70% → red at 90%.
  const barColor = pct >= 90 ? "bg-block" : pct >= 70 ? "bg-review" : "bg-accept";
  const periodLabel = budget ? PERIOD_LABEL[budget.budgetPeriod] ?? budget.budgetPeriod : "";

  return (
    <div className="border-t border-border-subtle px-4 py-4">
      <p className="text-overline uppercase text-text-muted mb-1">
        {budget ? budget.name.trim() : "Budget"}
      </p>
      <p className="font-display text-display-lg font-semibold text-text-primary tabular-nums">
        {budget ? (
          <>
            <span className="text-label font-mono text-text-muted align-middle mr-1">SGD</span>
            {budget.remaining.toFixed(2)}
          </>
        ) : loading ? (
          "—"
        ) : (
          "—"
        )}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-standard ease-smooth ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {budget && (
        <p className="mt-1.5 text-caption text-text-secondary font-mono">
          {budget.spent.toFixed(2)} of {budget.budgetCap.toFixed(2)} SGD used {periodLabel}
        </p>
      )}
    </div>
  );
}

// ---- Sidebar ---------------------------------------------------------------
export default function Sidebar({
  mode,
  onModeChange,
  contracts,
  contractsLoading,
  contractId,
  onSelectContract,
  onContractsChanged,
  budgetRefreshKey,
}: SidebarProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <aside className="flex flex-col w-72 shrink-0 self-stretch border-r border-border bg-surface">
      {/* Wordmark + version */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border-subtle">
        <span className="font-display text-display-md font-extrabold tracking-tight text-text-primary">
          AgentBid
        </span>
        <span className="text-overline uppercase font-mono text-text-muted border border-border-subtle rounded px-1.5 py-0.5">
          v0.1
        </span>
      </div>

      {/* Mode toggle */}
      <div className="px-4 pt-4">
        <p className="text-overline uppercase text-text-muted mb-2">Mode</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange("find")}
            className={`flex-1 text-label font-medium py-1.5 rounded-full border transition-colors duration-micro ${
              mode === "find"
                ? "bg-accent-blue text-text-inverse border-accent-blue"
                : "border-border text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => onModeChange("auction")}
            title="Auction mode — vendors bid for your tender"
            className={`flex-1 text-label font-medium py-1.5 rounded-full border transition-colors duration-micro ${
              mode === "auction"
                ? "bg-accent-blue text-text-inverse border-accent-blue"
                : "border-border text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            Auction
          </button>
        </div>
      </div>

      {/* Contracts section */}
      <div className="px-4 pt-5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-overline uppercase text-text-muted">Contracts</p>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            title="New contract"
            className={`w-5 h-5 flex items-center justify-center rounded border text-label leading-none transition-colors duration-micro ${
              showForm
                ? "border-accent-blue text-accent-blue bg-accent-blue-subtle"
                : "border-border text-text-secondary hover:text-text-primary hover:border-accent-blue"
            }`}
          >
            +
          </button>
        </div>

        {showForm && (
          <NewContractForm
            onSaved={async () => {
              setShowForm(false);
              await onContractsChanged();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="space-y-1.5 mt-2">
          {contractsLoading ? (
            <p className="text-caption text-text-muted py-2">Loading contracts…</p>
          ) : contracts.length === 0 ? (
            <p className="text-caption text-text-muted py-2">
              No contracts yet. Press + to create one.
            </p>
          ) : (
            contracts.map((c) => {
              const selected = c.id === contractId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectContract(c.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors duration-micro ${
                    selected
                      ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue-subtle"
                      : "border-border-subtle hover:border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label font-semibold text-text-primary truncate">
                      {c.name.trim()}
                    </span>
                    <span
                      className={`shrink-0 w-2 h-2 rounded-full ${
                        c.active ? "bg-accept" : "bg-node-loser"
                      }`}
                      title={c.active ? "Active" : "Inactive"}
                    />
                  </div>
                  <p className="text-caption text-text-muted mt-0.5 font-mono">
                    SGD {c.budget_cap} · {c.budget_period}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Budget meter */}
      <BudgetMeter contractId={contractId} refreshKey={budgetRefreshKey} />
    </aside>
  );
}
