# B2 + B4 — Node Graph + Idle Hero + Layout Transition

Replaces the cramped two-thirds-column layout and the fake `DEMO_PHASES` ticker with
a real idle→active state machine: a centered idle search hero that animates to the top
on submit, revealing a two-column active layout whose left side is the animated
node-graph centerpiece driven by genuine `useAgentStream` events.

**Status: complete & validated** (`tsc --noEmit` clean, `next build` passes, idle hero
+ mock graph render server-side). Full agent pipeline e2e still needs Exa/LLM/Stripe/DB
live — the graph/feed are wired to the B1 stream and render real phase events when they
arrive.

---

## Files

**New**
- `apps/web/components/NodeGraph.tsx` — the node-graph component (B2).

**Changed**
- `apps/web/app/page.tsx` — full rewrite: idle hero, center→top transition, two-column
  active layout, wired to `useAgentStream` (B4 + the graph/feed wiring). Dropped the
  fake `DEMO_PHASES` ticker and the blocking-fetch result handling.
- `apps/web/app/globals.css` — added `.edge-dashed` / `.edge-draw` keyframes for the
  graph connections (the only additions; all other motion/color tokens already existed).

---

## B4 — Idle hero + layout transition

- **Idle:** full-viewport layout, `AgentBid` wordmark top-left (small), the search
  textarea centered vertically with the subtle placeholder *"What would you like to
  procure?"*. Mode toggle (Find/Auction) + contract selector sit in the search card's
  footer, below the textarea. A subtitle and an **ambient mock node-graph** (opacity
  ~0.14, `mockMode`) fill the canvas.
- **On submit:** `POST /api/procure` returns `{ transactionId }` immediately (B1 async).
  Setting `transactionId` flips `active`, and the search section's
  `transform: translateY(30vh) → translateY(0)` transitions over **400ms** with
  `--ease-out-expo` (the easing from MOTION.md) — the bar travels center→top. The
  two-column layout mounts below with `animate-col-rise` staggered 200ms (graph) /
  320ms (feed), so the eye reads left→right.
- The transition animates **`transform` only** (GPU-composited); reduced-motion zeroes
  it via the global guard and the layout simply appears.

## B2 — `components/NodeGraph.tsx`

`props: { graphState?, contractName?, mockMode? }`

- **Hybrid render:** positioned `<div>` nodes (so they reuse the `.node-glow` +
  `animate-heartbeat`/`glow` utilities from MOTION.md verbatim) over an `<svg>` edge
  layer. Both share a `600×450` coordinate space and the container holds a `4:3` aspect
  ratio, so DOM nodes and SVG lines stay aligned at any width — **no layout shift** when
  vendors appear (nodes are absolutely positioned).
- **Nodes:** BROADCAST 64px left-center (blue, label "Broadcast"); VENDOR 48px center
  column evenly spaced, name truncated to 12 chars inside the circle, staggered
  entrance (`animate-vendor-in`, 150ms × index); CONTRACT 56px right-center (purple,
  label = `contractName`).
- **Edges:** broadcast→vendor dashed with animated `stroke-dashoffset` (`.edge-dashed`);
  vendor→contract solid, drawn in via `pathLength="1"` + `.edge-draw` (length-normalized
  dashoffset 1→0) when the decision starts.
- **Phase machine** (`idle → broadcasting → pitching → deciding → verifying → complete`):
  idle = broadcast only, slow pulse; broadcasting = vendors fade in staggered + dashed
  lines flow; pitching = vendor cores swap to `animate-heartbeat-fast` + `glow-fast`;
  deciding = all vendor→contract lines draw simultaneously; verifying = contract node
  pulses; complete = winner core transitions to `--node-winner` green with a **steady**
  glow, losers fade to `opacity-30`.
- **Colors** are all CSS variables (`--node-*`, via `color-mix`) — no hardcoded hex.
- **`mockMode`** ignores `graphState` and cycles every phase every **2s** with five mock
  vendors; the component also renders fine from a default idle state when `graphState`
  is omitted.

---

## Validation

- `npx tsc --noEmit` — clean (web app). ✓
- `npm run build` — passes; `/` prerenders as static content (no SSR crash). ✓
- Idle render (served HTML): wordmark `AgentBid`, placeholder "What would you like to
  procure?", `Broadcast` node label present; **0 vendor nodes / 0 contract node** at
  idle — confirming "nothing renders except the broadcast node" at idle. ✓
- Tailwind compiles all new arbitrary classes (`duration-[400ms]`, `aspect-[4/3]`,
  `text-[9px]`, `opacity-[0.14]`). ✓
- Motion budget: only `transform`/`opacity` animate for nodes + the layout shift;
  edge `stroke-dashoffset` is the spec-required "drawing" signal on a handful of short
  lines; reduced-motion zeroes all of it (winner/loser stay legible by color/opacity).

To see the full graph play with real data: run `apps/web` + `apps/agents` with `.env`
populated, submit a Find-mode intent, and watch the left column animate through the
phases as B1 events stream in.

---

## Deviations / notes

1. **Layout shift uses a CSS `transform` transition, not the WAA FLIP** from MOTION.md §3.
   The task brief specified "CSS transitions … 400ms"; a `translateY(30vh)→0` transition
   on the search section achieves the center→top travel with one composited property and
   no JS measurement. Easing matches (`--ease-out-expo`).
2. **All vendors pulse during `pitching`.** The B1 stream emits supplier *starts* in
   parallel with no per-vendor "active" signal, so every vendor core gets
   `heartbeat-fast` in the pitching phase (they are all pitching at once) rather than
   highlighting a single one.
3. **B3 (dedicated `AgentLog` component) not built** — out of scope. The right column
   carries a lightweight inline live feed (`logs` from the hook, `animate-log-in`) plus
   the result card so the two-column layout is complete.
4. **Result now comes from the stream** (`governance:complete`), not a blocking fetch —
   the old `/api/procure` result handling and `DEMO_PHASES` ticker are gone.
