"use client";
import { useState } from "react";

interface Entry { name: string; content: string; }
interface Round { label: string; entries: Entry[]; }
interface WebReview { name: string; reviews: string; }
interface Menu { name: string; menu: string; }
interface Score { name: string; overall: number; price: number; match: number; reviews: number; negotiation: number; }
interface ItemSearch { name: string; results: string; }

export default function UserPortal() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [itemSearch, setItemSearch] = useState<ItemSearch[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [webReviews, setWebReviews] = useState<WebReview[]>([]);
  const [verdict, setVerdict] = useState("");
  const [error, setError] = useState("");

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setRounds([]); setScores([]); setItemSearch([]); setMenus([]); setWebReviews([]); setVerdict(""); setError("");

    const res = await fetch("/api/user/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
    } else {
      setRounds(data.rounds);
      setScores(data.scores || []);
      setItemSearch(data.itemSearch || []);
      setMenus(data.menus || []);
      setWebReviews(data.webReviews);
      setVerdict(data.verdict);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-[calc(100vh-53px)] bg-bg px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-7">
        <header>
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
            Buyer side
          </p>
          <h1 className="font-serif mt-2 text-[2.4rem] font-semibold leading-tight tracking-tight text-text-primary">
            Find your spot, by negotiation.
          </h1>
          <p className="mt-3 max-w-xl text-[1rem] leading-relaxed text-text-secondary">
            Describe what you want. Each restaurant&apos;s AI agent pitches, your agent
            challenges them on real web reviews, and they defend their case.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm transition-colors focus-within:border-accent-blue">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-transparent px-3 py-2 text-[1rem] text-text-primary outline-none placeholder:text-text-muted"
              placeholder="e.g. a vegan bowl with big portions under $15…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && search()}
              disabled={loading}
            />
            <button
              onClick={search}
              disabled={loading}
              className="rounded-lg bg-accent-blue px-5 py-2 text-[0.9rem] font-medium text-text-inverse transition hover:bg-accent-blue-hover disabled:opacity-50"
            >
              {loading ? "Negotiating…" : "Search"}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-block-border bg-block-subtle px-4 py-3 text-[0.9rem] text-block-text">
            {error}
          </p>
        )}

        {loading && (
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="tk-breathe absolute inline-flex h-full w-full rounded-full bg-accent-blue" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-blue" />
              </span>
              <span className="text-[0.92rem] font-medium text-text-primary">Searching web reviews…</span>
            </div>
            <p className="pl-5 text-[0.88rem] text-text-secondary">Agents are pitching, getting challenged, and defending…</p>
            <div className="mt-3 space-y-2">
              <div className="tk-shimmer h-2.5 w-3/4 rounded-full" />
              <div className="tk-shimmer h-2.5 w-2/3 rounded-full" />
              <div className="tk-shimmer h-2.5 w-1/2 rounded-full" />
            </div>
          </div>
        )}

        {rounds.map((round, ri) => (
          <div key={ri} className="space-y-3">
            <h2 className="font-serif text-[1.4rem] font-semibold text-text-primary">{round.label}</h2>
            {round.entries.map((entry, ei) => (
              <div key={ei} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-[1rem] font-semibold text-accent-blue">{entry.name}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-text-secondary">{entry.content}</p>
              </div>
            ))}
          </div>
        ))}

        {scores.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-serif text-[1.4rem] font-semibold text-text-primary">Suitability scores</h2>
            <div className="grid gap-3">
              {scores.sort((a, b) => b.overall - a.overall).map((s, i) => (
                <div key={i} className={`rounded-2xl border p-5 shadow-sm ${i === 0 ? "border-accent-blue bg-accent-blue-subtle" : "border-border bg-surface"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[1rem] font-semibold text-text-primary">
                      {i === 0 && <span className="mr-2 rounded-full bg-accent-blue px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-text-inverse">Top</span>}
                      {s.name}
                    </h3>
                    <span className={`font-mono text-[1.4rem] font-semibold tabular-nums ${s.overall >= 75 ? "text-accept-text" : s.overall >= 50 ? "text-review-text" : "text-block-text"}`}>{s.overall}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-[0.8rem]">
                    {[
                      { label: "Menu Match", value: s.match },
                      { label: "Price/Value", value: s.price },
                      { label: "Reviews", value: s.reviews },
                      { label: "Negotiation", value: s.negotiation },
                    ].map((c) => (
                      <div key={c.label} className="text-center">
                        <div className="text-[0.72rem] text-text-muted">{c.label}</div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
                          <div className="tk-bar h-full rounded-full bg-accent-blue" style={{ width: `${c.value}%` }} />
                        </div>
                        <div className="mt-1 font-mono text-text-secondary">{c.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {verdict && (
          <div className="rounded-2xl border border-accept-border bg-accept-subtle p-6 shadow-sm">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-wide text-accept-text">Final verdict</h2>
            <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-text-primary">{verdict}</p>
          </div>
        )}

        {(itemSearch.length > 0 || menus.length > 0 || webReviews.length > 0) && (
          <div className="space-y-3">
            {itemSearch.length > 0 && (
              <Collapsible title={`Targeted lookup: “${query}”`}>
                {itemSearch.map((s, i) => <Section key={i} name={s.name} body={s.results} />)}
              </Collapsible>
            )}
            {menus.length > 0 && (
              <Collapsible title="Menus">
                {menus.map((m, i) => <Section key={i} name={m.name} body={m.menu} />)}
              </Collapsible>
            )}
            {webReviews.length > 0 && (
              <Collapsible title="Web reviews found">
                {webReviews.map((r, i) => <Section key={i} name={r.name} body={r.reviews} />)}
              </Collapsible>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-surface shadow-sm">
      <summary className="cursor-pointer select-none px-5 py-3.5 text-[0.95rem] font-medium text-text-primary">
        {title}
      </summary>
      <div className="space-y-3 px-5 pb-5">{children}</div>
    </details>
  );
}

function Section({ name, body }: { name: string; body: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
      <h3 className="text-[0.9rem] font-semibold text-text-primary">{name}</h3>
      <p className="mt-1.5 whitespace-pre-wrap text-[0.84rem] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}
