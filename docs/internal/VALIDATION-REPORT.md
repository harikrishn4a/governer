# VALIDATION-REPORT.md — AgentBid End-to-End Validation

Generated 2026-06-10. Audit/test only — nothing was built or modified (except this
report and one throwaway test contract row). Servers were restarted from current
source to validate the committed code, not a stale dev process.

**Environment at test time:** Postgres healthy on `:5433` (docker), agents worker on
`:4000`, web (production `next start`) on `:3000`. Agents env: Exa ✓, OpenAI ✓,
Anthropic not set (GPT‑4o active), Stripe ✓, DB ✓.

---

## Build status

- **Web build (`apps/web`: `npm install && npm run build`): PASS**
  - `npm install` succeeded (note: reports `3 vulnerabilities — 2 moderate, 1 critical`
    from `npm audit`; not blocking).
  - `next build` compiled successfully; all 10 routes generated, no type errors.

- **Agents TypeScript (`apps/agents`: `npx tsc --noEmit`): PASS** (exit 0, no type errors)
  - …but **`npm install` FAILS** with `ERESOLVE`:
    ```
    @stripe/agent-toolkit@0.9.0 peer-requires openai@^4.86.1
    project pins openai@^6.42.0  → conflicting peer dependency
    ```
    The existing `node_modules` works (it was installed previously with
    `--legacy-peer-deps`/`--force`), so the running app and `tsc` are fine. **A fresh
    clone cannot `npm install` without `--legacy-peer-deps`.** See blockers.

---

## Server startup

- **Agents worker (`npm run dev`, port 4000): PASS** — booted, `server:ready`, all env
  keys present, `GET /health` → `200 {"status":"ok",…}`.
- **Web server (`npm start`, port 3000): PASS** — `Ready in 178ms`, serves `/` and
  `/dashboard` (both HTTP 200).

---

## API endpoint tests

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | `GET /api/contracts` | 200 array | **PASS** — 200, array of contracts |
| 2 | `POST /api/contracts` (spec body, **camelCase** `budgetCap`) | 201 | **FAIL — 500** `null value in column "budget_cap" … not-null constraint` |
| 2b | `POST /api/contracts` (**snake_case** `budget_cap`, what the UI sends) | 201 | **PASS** — 201 with `id` |
| 3 | `GET /api/contracts` again | new contract appears | **PASS** — count 2→3, "Test Contract (validation)" present |
| 4 | `POST /api/procure` (burger intent) | 200 **immediately** with `transactionId` | **PASS** — 200 in **6.8 ms**, `{transactionId}` returned. SSE refactor confirmed complete. |
| 5 | `GET /api/stream?txId=…` (SSE) | events stream | **PASS** — real events streamed (see below) |
| 6 | `GET /api/stream/ingest` | not GET-able | **PASS — 405** (route is POST‑only; spec guessed 404, 405 is the correct semantic) |
| 7 | `POST /api/stream/ingest` test event | 200 | **PASS** — `200 {ok:true,seq:1}`, event verified in store via replay |

### Endpoint #2 detail — `POST /api/contracts` field-mapping bug
`apps/web/app/api/contracts/route.ts` passes the raw request body straight to
`createContract`, which reads **snake_case** (`data.budget_cap`,
`apps/web/lib/db.ts:62`). The documented API shape (AGENTS.md / the validation spec)
and any camelCase client send `budgetCap` → `data.budget_cap` is `undefined` → NULL →
DB constraint error (500). **The dashboard UI sends snake_case, so the in-app
create-contract flow works.** This is an API-contract inconsistency, not a UI break.

### SSE stream — real agent events (txId `1c5974d1…`)
Pipeline ran with **real** Exa + OpenAI (GPT‑4o) + Stripe + Postgres. 8 events,
correctly ordered, stream closes on `governance:complete`:

```
seq 1  agent:start     procurement
seq 2  agent:complete  discovery     count=5
seq 3  agent:start     supplier_0    Black Tap Craft Burgers & Beer — The All-American Burger
seq 4  agent:start     supplier_1    Dallas Cafe & Bar — Buttermilk Fried Chicken Burger
seq 5  agent:start     supplier_2    Shake Shack — ShackBurger® Single
seq 6  agent:complete  procurement   winner=Shake Shack  price=10.4
seq 7  agent:start     governance
seq 8  agent:complete  governance    decision=ACCEPT  price=10.4  pi=pi_3TgaDwFZSQmHCFOf0NVYLtRB
```
Governance: 4/4 rules passed (BUDGET_CAP, CATEGORY, VENDOR_BLOCKLIST, and a live
VENDOR_LEGITIMACY check that fetched the vendor URL → HTTP 200). **Real Stripe sandbox
PaymentIntent created and confirmed → `succeeded`.** DB row persisted and verified:
```
1c5974d1… | ACCEPT | Shake Shack | 10.40 | succeeded | pi_3TgaDwFZSQmHCFOf0NVYLtRB
```
⚠️ **Pipeline wall-clock: 202 s (~3.4 min)** — dominated by the Exa agent run (~2 min)
plus supplier LLM pitches. `/api/procure` returns instantly, but the user watches the
graph/log for ~3+ minutes before the result card. See blockers.

---

## UI render check

- `GET /` (200): contains `AgentBid` ×5, `placeholder` ×2, `procure` ×3, `search` ×1 —
  critical elements present.
- `GET /dashboard` (200, 6.3 KB): SSR HTML has no literal "contract/budget/transaction"
  text because it is a **`"use client"` component** (data fetched client-side). Renders
  fine in the browser; the grep-on-SSR check is a false negative, **not** a failure.
- **Fonts:** wired via `next/font/google` (Sora / IBM Plex Sans / IBM Plex Mono in
  `layout.tsx`). Family names are hashed/self-hosted, exposed as `var(--font-display)` /
  `--font-ui` / `--font-mono` — so literal "Sora"/"Plex" never appears in served HTML
  (expected for next/font). **PASS.**
- **CSS custom properties:** present. Design tokens live in the global CSS chunk
  `/_next/static/css/6ba00eb833200a8f.css` (`0b0e14`, `var(--bg)`, `--text-primary:`,
  …; 48 token definitions in `globals.css`). **PASS.**

## Light/white background remnants

- **NONE.** `grep -rn "bg-white|bg-slate-50|bg-gray-50" app components` → no matches.

## DEMO_PHASES remnant

- **Still present: NO.** `grep -rn "DEMO_PHASES"` across `apps/web` → no matches. The
  fake timed ticker is gone; the node graph + live log feed are the real loading state.

---

## Component inventory

- [x] `components/NodeGraph.tsx`
- [ ] `components/NodeGraphPlaceholder.tsx` — n/a (real `NodeGraph.tsx` shipped instead)
- [x] `components/AgentLog.tsx`
- [x] `components/Sidebar.tsx`
- [x] `components/ResultCard.tsx`
- [ ] `components/OverrideModal.tsx` — **missing** (override UI still inline in `page.tsx` / `dashboard/page.tsx`; F4 extraction not done)
- [ ] `components/BudgetArc.tsx` — **missing** (B6 not built; budget still a linear bar)
- [x] `lib/useAgentStream.ts`
- [x] `lib/stream-store.ts`
- [x] `app/api/stream/route.ts`
- [x] `app/api/stream/ingest/route.ts`
- [x] `app/api/procure/route.ts`

Plus extras present: `app/api/contracts/[id]/budget`, `app/api/transactions/[id]`,
`app/api/override`.

---

## Critical blockers for demo

Ordered by severity:

1. **Pipeline latency ~202 s (~3.4 min) per procurement run — DEMO RISK (high).**
   The Exa agent run alone is ~2 min. The live demo will sit on the node-graph/log
   screen for 3+ minutes before the ACCEPT card. Mitigate before stage: pre-warm a run,
   cache/record a canonical burger run, shorten the Exa task, or narrate over it. Not a
   hard failure — it does complete and the result is real — but it's the #1 thing that
   can sink a live demo.

2. **`apps/agents` fresh `npm install` fails (ERESOLVE) — blocker for any clean setup.**
   `@stripe/agent-toolkit@0.9.0` peers `openai@^4.86.1`; project pins `openai@^6.42.0`.
   The current machine works (already-installed `node_modules`), but a fresh clone /
   teammate / CI / rebuild fails without `--legacy-peer-deps`. Fix: add
   `--legacy-peer-deps` to the install step, pin `openai@^4`, or bump
   `@stripe/agent-toolkit`.

3. **`POST /api/contracts` rejects camelCase (`budgetCap`) with a 500 — medium.**
   Not a demo-path blocker (the dashboard UI uses snake_case and creates contracts
   fine), but the documented/external API contract is broken and the 500 leaks a raw DB
   constraint message. Fix: normalize body keys in the route (or document snake_case as
   the contract).

Non-blocking notes: `npm audit` reports 1 critical / 2 moderate web vulns;
`apps/agents/dist/` is untracked in git; one throwaway "Test Contract (validation)"
row was left in the DB by this validation.

---

## Ready for demo

**Verdict: READY (with one caveat) — the full agentic flow works end-to-end for real**
(NL intent → Exa discovery of 5 vendors → GPT‑4o supplier pitches → governance ACCEPT →
**confirmed Stripe sandbox PaymentIntent** → DB persist → live SSE to the UI), but the
**~3.4‑minute run time is a real live-demo risk** that should be pre-warmed or
scripted, and the two setup/API issues (#2, #3) should be fixed before relying on a
clean rebuild or the external contracts API.
