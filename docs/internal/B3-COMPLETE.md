# B3 + F3 + F5 — Live Log Feed + Type Hierarchy + Result Card Polish

Promotes the B2 right column from its lightweight inline placeholder (a flat
`logs: string[]` list + a flat-hierarchy result block) to a real **live log feed
component** and a **typographically dominant result card**, and applies the
DESIGN-SYSTEM type scale across both.

**Status: complete & validated** — `tsc --noEmit` clean, `next build` passes, and
the full mock agent sequence streams end-to-end through `/api/stream` (the data path
the new components consume).

---

## Files

**New**
- `apps/web/components/AgentLog.tsx` — B3 live log feed.
- `apps/web/components/ResultCard.tsx` — F3/F5 result card (exports `SupplierPitch`).

**Changed**
- `apps/web/lib/useAgentStream.ts` — `logs` is now `LogEntry[]`
  (`{ id, message, timestamp, status }`) via a new `deriveLogs()`, replacing the
  bare `string[]`. New exported `LogEntry` type.
- `apps/web/app/page.tsx` — right column now renders `<AgentLog>` + `<ResultCard>`;
  dropped the inline feed list, the inline decision banner / rules / pitch markup,
  and the now-unused `LLM_COLORS` + local `SupplierPitch`. Active grid is
  viewport-bounded so the feed fills/scrolls and the card transitions in below.
- `apps/web/app/globals.css` — added `.scroll-custom` (thin, cool, recessive
  scrollbar) for the feed pane.

---

## B3 — `components/AgentLog.tsx`

`props: { logs: LogEntry[] }`

- **Vertical feed, newest at bottom.** Each line: a **status dot** (left) · message
  in the **ui font** (`font-sans text-body`, center) · **HH:MM:SS** in the **mono
  font, muted** (`font-mono text-mono-sm text-text-muted`, right).
- **Status dot** (carries the lifecycle redundantly with text):
  - `pending` → pulsing — a solid `accent-blue` dot under an `animate-ping-ring`
    broadcast ring (transform/opacity only).
  - `complete` → solid `accept` (green) dot.
  - `error` → solid `block` (red) dot.
  - `useAgentStream.deriveLogs()` marks the **newest line `pending`** until the
    stream terminates; `error`/`BLOCK` decisions → `error`; everything else
    `complete`. So the feed always shows exactly one pulsing "current action".
- **Entrance:** each `<li>` uses `animate-log-in` (slide in from right + fade,
  200ms `out-expo`, MOTION.md §5). A batch staggers **80ms** (`--stagger-log`)
  via a per-line `animationDelay` computed from the count delta — a single live
  arrival animates immediately (its arrival *is* the stagger), only genuinely-new
  lines in a batch stagger, and already-mounted lines never re-animate.
- **Auto-scroll:** an end sentinel is `scrollIntoView`'d on every `logs.length`
  change → the feed pins to the newest line.
- **Max height:** the feed `<ol>` is `flex-1 min-h-0 overflow-y-auto` inside the
  viewport-bounded right column, so it fills available space and scrolls with the
  `.scroll-custom` styled scrollbar. When the result card mounts below, the feed
  flex-shrinks — a smooth height change, not a jump.

## F3 — Type hierarchy

The repeated ad-hoc `text-xs font-semibold uppercase tracking-wider` is gone.
One consistent **section label** treatment — `text-overline uppercase text-text-muted`
(the type-scale eyebrow token) — is used everywhere (a single `Label` helper inside
ResultCard, and inline in AgentLog/page). The result now carries a real hierarchy:

| Level | Treatment |
|---|---|
| **Vendor (dominant)** | `font-display text-display-2xl` (Sora 800, 44px) — the largest thing on screen when a result shows |
| Item (subordinate to vendor) | `font-display text-display-md font-light` — the Sora 800↔300 weight-contrast move |
| **Price (prominent)** | `font-display text-display-xl` (34px) with the `SGD` unit in `text-display-md font-light text-text-muted` |
| Section labels | `text-overline` uppercase muted |
| Body / rationale | `text-body text-text-secondary` |
| Metadata (tx id, contract, Stripe PI) | `font-mono text-mono-sm text-text-muted` — clearly subordinate |

## F5 — Result card polish

- **Vendor dominates**, price is prominent (see table above).
- **Advantage** is a **callout pill**, not plain text: `💰 SGD 7 under budget`
  (derived from `contractBudgetCap − price`; `⚠️ … over budget` when negative),
  plus an optional `📉 SGD N below the priciest bid` from the supplier pitches.
- **Stripe PI** is truncated to the first 12 chars + `…` with a **copy-to-clipboard**
  button (`navigator.clipboard`, transient "✓ copied" state).
- Decision badge tints the card edge (accept/block/review); rationale, "why best
  value", governance rules, supplier pitches, and a mono metadata footer follow as
  clearly-ranked sections.

---

## Validation

- `npx tsc --noEmit` — clean. ✓
- `npm run build` — passes; `/` prerenders static (no SSR crash). ✓
- **Stream data path** (`next start`, mock events POSTed to `/api/stream/ingest`,
  no DB/keys): the 6-event find sequence replayed over `/api/stream?txId=` and
  self-closed on `governance:complete`. Derivation over it →
  6 log lines (last `complete`/accepted; pre-governance lines would be `pending`),
  advantage pill **"💰 SGD 7 under budget"** (cap 30 − price 23), Stripe PI
  `pi_3QabcDEF…` + copy. ✓
- Motion budget: feed entrance + pulse animate `transform`/`opacity` only; reduced
  motion is zeroed by the global guard (status stays legible by dot color + text).

To watch it live: run `apps/web` + `apps/agents` with `.env` populated, submit a
Find-mode intent, and watch lines stream into the feed and the card reveal below.

---

## Deviations / notes

1. **`logs` shape changed** from `string[]` to `LogEntry[]`. `page.tsx` is the only
   consumer; updated. The human-string mapping (`toLog`) is unchanged — `deriveLogs`
   just wraps each line with an id (event `seq`), the event timestamp, and a status.
2. **Pitches live inside `ResultCard`** as a subordinate section (rather than a
   separate block) so the whole result is one scrollable card in the bounded column.
3. The block-review **override modal** still lives in `page.tsx`; `ResultCard`'s
   "Request manual review" button calls back into it (`onRequestReview`).
