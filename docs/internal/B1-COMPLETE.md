# B1 — Real Agent Event Stream (SSE)

Replaces the blocking `/api/procure` and the fake 28s "live progress" ticker with a
real Server-Sent Events pipeline driven by genuine agent phase events.

**Status: complete & validated** (SSE plumbing proven end-to-end at runtime; agent-side
emit typechecked — full pipeline e2e needs Exa/LLM/Stripe/DB live).

---

## Architecture

```
browser ──POST /api/procure──▶ web (generates txId, returns it immediately)
   │                              │
   │                              └──fire-and-forget POST /run {txId}──▶ agents
   │                                                                       │
   │                                              pipeline runs, emitting per phase
   │                                                                       │
   │                          web  ◀──POST /api/stream/ingest {txId,event}─┘
   │                           │   (stream-store.emit → notify subscribers)
   └──GET /api/stream?txId=───▶│
        (EventSource)          └── replays history + streams live, closes on
                                   governance:complete; heartbeat every 15s
```

**One id end-to-end:** `/api/procure` generates a UUID and uses it as both the SSE
channel key *and* the DB transaction id (`saveTransaction` now injects it). So the
`result.transactionId` the UI gets from `governance:complete` is the real DB row —
override/lookup work unchanged.

---

## Files

**New**
- `apps/agents/src/lib/event-bus.ts` — `createEmitter(txId)` → POSTs each event to
  `{WEB_URL}/api/stream/ingest`. Awaited (preserves order), failures swallowed.
- `apps/web/lib/stream-store.ts` — in-memory pub/sub keyed by txId (`emit`, `subscribe`,
  `getEvents`). Parked on `globalThis` (survives HMR, shared across route handlers).
  Monotonic `seq` per event for client de-dup; idle streams pruned after 10 min.
- `apps/web/app/api/stream/ingest/route.ts` — POST; agents → store. No auth (internal).
- `apps/web/app/api/stream/route.ts` — GET SSE; replay + live + 15s heartbeat + close
  on `governance:complete`; cleans up on client abort.
- `apps/web/lib/useAgentStream.ts` — React hook (`"use client"`).

**Changed**
- `apps/agents/src/index.ts` — `/run` accepts `txId`, builds an emitter, emits
  `governance` start/complete + `error`, injects `txId` as the DB id.
- `apps/agents/src/agents/procurement.ts` — `runFullProcurement(raw, onEvent?)` emits
  procurement:start, discovery:complete, supplier_*:start, procurement:complete.
- `apps/agents/src/tools/db.ts` — `saveTransaction` honors an explicit `id`
  (`COALESCE($1::uuid, gen_random_uuid())`).
- `apps/web/app/api/procure/route.ts` — async: generate txId, fire-and-forget `/run`,
  return `{ transactionId }` immediately.
- `apps/agents/.env.example` / root `.env` — added `WEB_URL` (default `http://localhost:3000`).

---

## Event contract

Ingest / SSE payload (stored events also carry `seq: number`):

```ts
{ txId: string, type: AgentEventType, agent: string, data?: unknown, timestamp: string }
```

Emitted sequence (find mode):

| # | type | agent | data |
|---|------|-------|------|
| 1 | `agent:start` | `procurement` | — |
| 2 | `agent:complete` | `discovery` | `{ count, vendors: string[] }` |
| 3..N | `agent:start` | `supplier_0..N` | `{ vendor, item }` (top 3 candidates) |
| — | `agent:complete` | `procurement` | `{ vendor, item, price, rationale }` |
| — | `agent:start` | `governance` | — |
| — | `agent:complete` | `governance` | full result (decision, checkedRules, stripePI, contract, pitches, options, transactionId) |
| (err) | `error` | `pipeline` | `{ message }` |

## `useAgentStream(transactionId)` → `{ events, graphState, logs, result, isComplete }`

- **graphState.phase**: `idle → broadcasting` (procurement:start / discovery:complete)
  `→ pitching` (first supplier) `→ deciding` (procurement:complete, sets `winner`)
  `→ verifying` (governance:start) `→ complete` (governance:complete, sets `result`).
  `vendors` from discovery:complete.
- **logs**: human strings — "Generating broadcast…", "5 options received", "Vendors are
  pitching their offers" (first supplier only; extras de-duped), "Recommended: V — I
  (P SGD)", "Verifying contract rules…", "✓/✗ Transaction accepted/blocked".
- **result**: the `governance:complete` data (`AgentResult`).
- **isComplete**: true on governance:complete or error.
- De-dupes replays by `seq`; closes the EventSource on completion.

---

## Validation (runtime)

Run against the live web dev server (`apps/web`, :3000). Stream/ingest/procure need
no DB or API keys.

- **A — replay + close:** seeded 2 events, `GET /api/stream?txId=` replayed both and
  self-closed in **94ms** (close-on-`governance:complete`). ✓
- **B — live push:** subscribed first, then emitted the full 6-event sequence (0.4s
  apart); all arrived in real time over SSE, stream closed on governance:complete. ✓
- **C — async procure:** `POST /api/procure` returned `{ transactionId }` in **84ms**
  (no pipeline wait). ✓
- Hook derivation traced over B's events → `phase:"complete"`, `vendors:[3]`,
  `winner:"Acme"`, 6 log lines, `result` populated, `isComplete:true`. ✓
- `tsc --noEmit` clean for both `apps/agents` and `apps/web`. ✓

To run the full pipeline e2e: `npm run dev` in both apps with `.env` populated
(Exa/OpenAI/Stripe/DATABASE_URL), `POST /api/procure`, watch `/api/stream?txId=`.

---

## Deviations / notes

1. **Fire-and-forget needs a persistent server.** On a long-running Node server (local
   dev, the hackathon target) the dropped `fetch` promise to `/run` keeps running. A
   serverless host (Vercel) would freeze the function after the response — there it
   needs `ctx.waitUntil()` or a queue. Noted inline in `procure/route.ts`.
2. **In-memory store is process-local.** Fine for one Node server; multi-instance would
   need Redis pub/sub or similar. (`globalThis` only fixes HMR/route-module sharing.)
3. **`/run` still returns its full JSON** at the end (now unused by the web, kept as a
   fallback for direct callers / `test-e2e`).
4. **Supplier events are starts only** (no per-supplier complete) — that's all the
   graph/log derivation needs; suppliers run in parallel so starts emit up front.
5. **page.tsx not rewired.** The hook is built and validated, but swapping the fake
   ticker for the graph + live feed is B2/B3/B4 (out of B1 scope).
