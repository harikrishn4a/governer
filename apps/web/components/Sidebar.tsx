"use client";
import { useEffect, useState } from "react";
import Wordmark from "./Wordmark";
import ContractForm from "./ContractForm";
import { PERIOD_USED_LABEL, periodLabel } from "@/lib/labels";

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
  const usedLabel = budget ? PERIOD_USED_LABEL[budget.budgetPeriod] ?? budget.budgetPeriod : "";

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
          {budget.spent.toFixed(2)} of {budget.budgetCap.toFixed(2)} SGD used {usedLabel}
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
        <Wordmark />
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
            disabled
            title="Auction mode — coming soon"
            className="flex-1 text-label font-medium py-1.5 rounded-full border border-border-subtle text-text-muted opacity-50 cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            Auction
            <span className="text-overline uppercase font-mono text-text-muted">soon</span>
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
          <div className="mt-2">
            <ContractForm
              onSaved={async () => {
                setShowForm(false);
                await onContractsChanged();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
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
                    SGD {c.budget_cap} · {periodLabel(c.budget_period)}
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
