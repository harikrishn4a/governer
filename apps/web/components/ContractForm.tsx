"use client";

import { useState } from "react";

/**
 * The single source for contract create/edit (design audit P2). Previously the
 * Sidebar and the dashboard each carried their own copy of this form and they
 * had already diverged (different default period, dashboard-only allowlist).
 * Both pages now render this component, so a contract behaves identically no
 * matter where it was created.
 */

export interface ContractFormValues {
  name: string;
  budget_cap: number;
  budget_period: string;
  category_constraints: string[];
  vendor_blocklist: string[];
  vendor_allowlist: string[];
  risk_threshold: string;
  active: boolean;
}

export const BLANK_CONTRACT: ContractFormValues = {
  name: "",
  budget_cap: 100,
  budget_period: "monthly",
  category_constraints: [],
  vendor_blocklist: [],
  vendor_allowlist: [],
  risk_threshold: "medium",
  active: true,
};

const inputCls =
  "w-full bg-surface-raised border border-border rounded px-2 py-1 text-label text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue";

export function TagInput({
  label,
  values,
  onChange,
  placeholder = "Type and press Enter",
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
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
                aria-label={`Remove ${v}`}
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

export default function ContractForm({
  initial,
  contractId,
  onSaved,
  onCancel,
}: {
  /** Prefill for edit mode; omit to create a new contract. */
  initial?: ContractFormValues;
  /** When set, the form PATCHes this contract instead of POSTing a new one. */
  contractId?: string | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ContractFormValues>({ ...(initial ?? BLANK_CONTRACT) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(contractId);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(editing ? `/api/contracts/${contractId}` : "/api/contracts", {
        method: editing ? "PATCH" : "POST",
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

  return (
    <div className="rounded-lg border border-accent-blue-subtle bg-surface-raised/60 p-3 space-y-3 animate-col-rise">
      <p className="text-overline uppercase text-text-muted">
        {editing ? "Edit contract" : "New contract"}
      </p>
      {error && <p className="text-caption text-block-text">{error}</p>}

      <div>
        <label className="block text-overline uppercase text-text-muted mb-1">Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Food & dining"
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

      <div>
        <label className="block text-overline uppercase text-text-muted mb-1">Risk threshold</label>
        <select
          value={form.risk_threshold}
          onChange={(e) => setForm((f) => ({ ...f, risk_threshold: e.target.value }))}
          className={inputCls}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="strict">Strict</option>
        </select>
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
      />
      <TagInput
        label="Vendor allowlist (empty = all)"
        values={form.vendor_allowlist}
        onChange={(v) => setForm((f) => ({ ...f, vendor_allowlist: v }))}
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
