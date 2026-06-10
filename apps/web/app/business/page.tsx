"use client";
import { useState, useRef, useEffect } from "react";
import {
  TONE_OPTIONS,
  STYLE_OPTIONS,
  LANGUAGE_OPTIONS,
  EMPHASIS_OPTIONS,
} from "@/app/lib/persona";

type Persona = {
  tone: string;
  languageStyle: string;
  languages: string[];
  emphasis: string[];
  tagline: string;
  notes: string;
};

const EMPTY_PERSONA: Persona = {
  tone: "friendly",
  languageStyle: "standard",
  languages: [],
  emphasis: [],
  tagline: "",
  notes: "",
};

// shared pill styles
function pill(active: boolean) {
  return `px-3 py-1.5 rounded-full border text-[0.85rem] transition-colors ${
    active
      ? "bg-accent-blue border-accent-blue text-text-inverse"
      : "bg-surface border-border text-text-secondary hover:border-accent-blue hover:text-text-primary"
  }`;
}

interface DraftItem {
  id: number;
  name: string;
  price?: number;
  description: string;
  tags: string[];
  needsInfo: boolean;
  question: string;
}

export default function BusinessPortal() {
  const [businessId] = useState(() => crypto.randomUUID());
  const [businessName, setBusinessName] = useState("");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [menuUrl, setMenuUrl] = useState("");
  const [menuSaved, setMenuSaved] = useState(false);
  const [persona, setPersona] = useState<Persona>(EMPTY_PERSONA);
  const [personaSaved, setPersonaSaved] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSource, setImportSource] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogSaved, setCatalogSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function toggle(field: "languages" | "emphasis", value: string) {
    setPersonaSaved(false);
    setPersona((p) => {
      const has = p[field].includes(value);
      return { ...p, [field]: has ? p[field].filter((v) => v !== value) : [...p[field], value] };
    });
  }

  async function savePersona() {
    const res = await fetch("/api/business/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, persona }),
    });
    if (res.ok) setPersonaSaved(true);
  }

  async function send() {
    if (!input.trim()) return;
    const msg = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);

    const res = await fetch("/api/business/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, businessName, message: msg }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    if (data.isReady) setIsReady(true);
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: `📄 Uploaded: ${file.name}` }]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessId", businessId);
    formData.append("businessName", businessName);

    const res = await fetch("/api/business/upload", { method: "POST", body: formData });
    const data = await res.json();
    setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    if (data.isReady) setIsReady(true);
    setLoading(false);
  }

  async function saveMenuUrl() {
    if (!menuUrl.trim()) return;
    await fetch("/api/business/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, menuUrl, foodpandaCode: menuUrl.trim() }),
    });
    setMenuSaved(true);
  }

  async function runImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    setCatalogSaved(false);
    try {
      const res = await fetch("/api/business/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Import failed.");
        setItems([]);
      } else {
        setItems(data.items as DraftItem[]);
        setImportSource(data.source);
      }
    } catch {
      setImportError("Import failed — check the link and try again.");
    }
    setImporting(false);
  }

  function updateItem<K extends keyof DraftItem>(id: number, field: K, value: DraftItem[K]) {
    setCatalogSaved(false);
    setItems((its) =>
      its.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, [field]: value };
        if (field === "description") next.needsInfo = false; // owner addressed it
        return next;
      })
    );
  }

  function removeItem(id: number) {
    setItems((its) => its.filter((it) => it.id !== id));
  }

  async function saveCatalog() {
    if (items.length === 0) return;
    setCatalogSaving(true);
    const payload = items.map(({ name, price, description, tags }) => ({ name, price, description, tags }));
    const res = await fetch("/api/business/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, businessName, items: payload }),
    });
    if (res.ok) {
      setCatalogSaved(true);
      setIsReady(true);
    }
    setCatalogSaving(false);
  }

  const flagged = items.filter((i) => i.needsInfo).length;

  // ── Start screen ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="flex min-h-[calc(100vh-53px)] items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
            Business side
          </p>
          <h1 className="font-serif mt-2 text-[2rem] font-semibold leading-tight text-text-primary">
            Teach your AI agent.
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-text-secondary">
            Enter your business name to begin. Import your existing Shopify or foodpanda
            catalog, upload a file, or chat — to teach the AI how to represent you.
          </p>
          <input
            className="mt-5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.95rem] text-text-primary outline-none transition-colors focus:border-accent-blue"
            placeholder="Business name…"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && businessName.trim() && setStarted(true)}
          />
          <button
            onClick={() => businessName.trim() && setStarted(true)}
            className="mt-3 w-full rounded-lg bg-accent-blue py-2.5 text-[0.92rem] font-medium text-text-inverse transition hover:bg-accent-blue-hover"
          >
            Start onboarding →
          </button>
        </div>
      </div>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100vh-53px)] flex-col bg-bg">
      <header className="border-b border-border bg-surface/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="font-serif text-[1.2rem] font-semibold text-text-primary">
            {businessName} — onboarding
          </h1>
          {isReady && (
            <span className="rounded-full border border-accept-border bg-accept-subtle px-3 py-1 text-[0.78rem] font-medium text-accept-text">
              ✓ Agent is live
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6">
        {/* Import existing catalog */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-blue">Quick start</p>
          <h2 className="font-serif mt-1 text-[1.3rem] font-semibold text-text-primary">Import your existing catalog</h2>
          <p className="mt-1 text-[0.88rem] leading-relaxed text-text-secondary">
            Already listed somewhere? Paste your <span className="font-medium text-text-primary">Shopify store</span> or{" "}
            <span className="font-medium text-text-primary">foodpanda</span> link — we&apos;ll pull your items so you can review &amp; edit
            instead of typing them all in.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[0.9rem] text-text-primary outline-none focus:border-accent-blue"
              placeholder="https://yourshop.com  ·  or a foodpanda restaurant link"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !importing && runImport()}
              disabled={importing}
            />
            <button
              onClick={runImport}
              disabled={importing || !importUrl.trim()}
              className="rounded-lg bg-accent-blue px-5 py-2 text-[0.88rem] font-medium text-text-inverse transition hover:bg-accent-blue-hover disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
          {importError && <p className="mt-2 text-[0.84rem] text-block-text">{importError}</p>}
          {importSource && items.length > 0 && (
            <p className="mt-2 text-[0.82rem] text-text-muted">
              Pulled {items.length} items from {importSource}. Review them below
              {flagged > 0 && <> — <span className="font-medium text-review-text">{flagged}</span> need a little more detail</>}.
            </p>
          )}
        </div>

        {/* Editable catalog */}
        {items.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-[1.15rem] font-semibold text-text-primary">Your catalog ({items.length})</h3>
              <button
                onClick={saveCatalog}
                disabled={catalogSaving}
                className="rounded-lg bg-accent-blue px-4 py-2 text-[0.85rem] font-medium text-text-inverse transition hover:bg-accent-blue-hover disabled:opacity-50"
              >
                {catalogSaved ? "✓ Saved & live" : catalogSaving ? "Saving…" : "Save catalog & go live"}
              </button>
            </div>
            <p className="mt-1 text-[0.8rem] text-text-muted">
              Items the AI flagged are <span className="font-medium text-review-text">highlighted</span> — add the missing detail and the flag clears.
            </p>
            <div className="scroll-custom mt-3 max-h-[480px] space-y-2.5 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`rounded-lg border p-3 ${it.needsInfo ? "border-review-border bg-review-subtle" : "border-border-subtle bg-surface"}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={it.name}
                      onChange={(e) => updateItem(it.id, "name", e.target.value)}
                      className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.9rem] font-medium text-text-primary outline-none focus:border-accent-blue"
                    />
                    <div className="flex items-center rounded-md border border-border bg-surface px-2">
                      <span className="text-[0.78rem] text-text-muted">$</span>
                      <input
                        type="number"
                        value={it.price ?? ""}
                        onChange={(e) => updateItem(it.id, "price", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-16 bg-transparent py-1.5 text-[0.85rem] text-text-primary outline-none"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(it.id)}
                      title="Remove"
                      className="rounded-md border border-border px-2 py-1.5 text-[0.85rem] text-text-muted hover:border-block-border hover:text-block-text"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={it.description}
                    onChange={(e) => updateItem(it.id, "description", e.target.value)}
                    rows={2}
                    placeholder="Description — the ingredients / specs buyers ask about"
                    className="mt-2 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.84rem] leading-snug text-text-secondary outline-none focus:border-accent-blue"
                  />
                  {it.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {it.tags.map((t, ti) => (
                        <span key={ti} className="rounded-full border border-border-subtle bg-surface-raised/50 px-2 py-0.5 text-[0.72rem] text-text-muted">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {it.needsInfo && it.question && (
                    <p className="mt-2 text-[0.8rem] font-medium text-review-text">💬 {it.question}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* foodpanda link */}
        {isReady && !menuSaved && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
            <input
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[0.88rem] text-text-primary outline-none focus:border-accent-blue"
              placeholder="Paste your foodpanda URL (e.g. https://www.foodpanda.sg/restaurant/k8rq/…)"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
            />
            <button onClick={saveMenuUrl} className="rounded-lg bg-accent-blue px-4 py-2 text-[0.85rem] font-medium text-text-inverse hover:bg-accent-blue-hover">
              Save
            </button>
          </div>
        )}
        {menuSaved && (
          <div className="mt-4 rounded-xl border border-accept-border bg-accept-subtle px-4 py-3 text-[0.85rem] text-accept-text">
            ✓ Foodpanda menu linked — your agent will use real menu data in negotiations.
          </div>
        )}

        {/* persona */}
        {(
          <details className="mt-4 rounded-xl border border-border bg-surface shadow-sm">
            <summary className="cursor-pointer select-none px-5 py-3.5 text-[0.95rem] font-medium text-text-primary">
              🎭 Customise your AI salesman {personaSaved && <span className="ml-1 text-[0.8rem] text-accept-text">✓ saved</span>}
            </summary>
            <div className="space-y-5 px-5 pb-5 text-[0.88rem]">
              <p className="text-text-secondary">Shape how your agent sounds when it pitches and negotiates.</p>

              <PersonaGroup label="Tone">
                {TONE_OPTIONS.map((o) => (
                  <button key={o.value} title={o.hint}
                    onClick={() => { setPersona((p) => ({ ...p, tone: o.value })); setPersonaSaved(false); }}
                    className={pill(persona.tone === o.value)}>{o.label}</button>
                ))}
              </PersonaGroup>

              <PersonaGroup label="Language style">
                {STYLE_OPTIONS.map((o) => (
                  <button key={o.value} title={o.hint}
                    onClick={() => { setPersona((p) => ({ ...p, languageStyle: o.value })); setPersonaSaved(false); }}
                    className={pill(persona.languageStyle === o.value)}>{o.label}</button>
                ))}
              </PersonaGroup>

              <PersonaGroup label="Greeting languages">
                {LANGUAGE_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => toggle("languages", o.value)} className={pill(persona.languages.includes(o.value))}>{o.label}</button>
                ))}
              </PersonaGroup>

              <PersonaGroup label="Lead selling points">
                {EMPHASIS_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => toggle("emphasis", o.value)} className={pill(persona.emphasis.includes(o.value))}>{o.label}</button>
                ))}
              </PersonaGroup>

              <div>
                <label className="mb-1 block font-medium text-text-secondary">Brand tagline (optional)</label>
                <input
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:border-accent-blue"
                  placeholder="e.g. Biggest burritos in the CBD, halal & fresh daily."
                  value={persona.tagline} maxLength={200}
                  onChange={(e) => { setPersona((p) => ({ ...p, tagline: e.target.value })); setPersonaSaved(false); }}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-text-secondary">Extra voice notes (optional)</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:border-accent-blue"
                  rows={2} placeholder="Anything else about how your agent should sound."
                  value={persona.notes} maxLength={1000}
                  onChange={(e) => { setPersona((p) => ({ ...p, notes: e.target.value })); setPersonaSaved(false); }}
                />
              </div>

              <button onClick={savePersona} className="rounded-lg bg-accent-blue px-5 py-2 text-[0.88rem] font-medium text-text-inverse hover:bg-accent-blue-hover">
                {personaSaved ? "✓ Saved" : "Save agent persona"}
              </button>
            </div>
          </details>
        )}

        {/* chat thread */}
        <div className="mt-4 space-y-3 pb-4">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
              <p className="mb-4 text-[0.92rem] text-text-secondary">
                Upload a menu or knowledge file (PDF, .txt, .md) — or just start chatting to teach the AI.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-accent-blue px-6 py-2.5 text-[0.9rem] font-medium text-text-inverse hover:bg-accent-blue-hover"
              >
                📄 Upload menu / knowledge file
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl border px-4 py-2.5 text-[0.9rem] leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "rounded-tr-sm border-accent-blue bg-accent-blue text-text-inverse"
                  : "rounded-tl-sm border-border bg-surface text-text-primary"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 pl-1 text-text-muted">
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
              <span className="tk-dot inline-block h-1.5 w-1.5 rounded-full bg-node-vendor" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-border bg-surface/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="rounded-lg border border-border bg-surface px-4 text-text-secondary transition hover:border-accent-blue hover:text-text-primary disabled:opacity-50"
            title="Upload knowledge file"
          >
            📄
          </button>
          <input
            className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.92rem] text-text-primary outline-none focus:border-accent-blue"
            placeholder="Tell the AI about your business…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && send()}
            disabled={loading}
          />
          <button onClick={send} disabled={loading} className="rounded-lg bg-accent-blue px-6 text-[0.9rem] font-medium text-text-inverse hover:bg-accent-blue-hover disabled:opacity-50">
            Send
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={handleFileUpload} />
      </div>
    </div>
  );
}

function PersonaGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block font-medium text-text-secondary">
        {label} {hint && <span className="font-normal text-text-muted">{hint}</span>}
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
