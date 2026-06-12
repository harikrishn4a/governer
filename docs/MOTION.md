# AgentBid — Motion System

Grounded in Design for Hackers motion principles. **Rule of the system: every
animation communicates a state change.** If removing it loses no information, it's
decorative — cut it.

- **Only `transform` + `opacity` animate** (GPU-composited → 60fps; never `width`,
  `height`, `top`, `padding`).
- **Easing is exponential, never bounce/elastic.** Entries decelerate (`out-expo`),
  exits accelerate (`in-expo`).
- **Durations follow 100 / 300 / 500** (micro / standard / complex).
- **`prefers-reduced-motion` is respected** globally (`globals.css`); state stays
  legible via color, not movement.

Tokens: timing/easing = CSS vars in `apps/web/app/globals.css`; keyframes +
`animate-*` / `duration-*` / `ease-*` utilities = `apps/web/tailwind.config.ts`.

---

## 1. Tokens

| CSS var | Value | Meaning |
|---|---|---|
| `--motion-micro` | 100ms | hover / press feedback |
| `--motion-standard` | 300ms | node entrance, state swaps, panels |
| `--motion-complex` | 500ms | column rise, orchestration |
| `--motion-log-line` | 200ms | one log line in |
| `--motion-result-card` | 360ms | result card reveal |
| `--motion-hero-exit` | 240ms | idle hero leaving |
| `--ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | entries |
| `--ease-in-expo` | `cubic-bezier(.7,0,.84,0)` | exits |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | toggles, pulses |
| `--stagger-vendor` | 150ms | between vendor nodes |
| `--stagger-log` | 80ms | between log lines |
| `--pulse-broadcast` | 1500ms | broadcast heartbeat cycle |
| `--pulse-active` | 800ms | pitching vendor cycle |

---

## 2. Animation catalog

| Name (utility) | Keyframe | Duration | Easing | Trigger | Communicates |
|---|---|---|---|---|---|
| `animate-hero-exit` | `hero-exit` (fade + ↑16px) | 240ms | in-expo | Search submitted | Idle hero is leaving |
| `animate-col-rise` | `col-rise` (fade + ↑24px) | 500ms | out-expo | Entering active layout | Graph + log columns arriving |
| `animate-vendor-in` | `vendor-in` (fade + scale .6→1) | 300ms | out-expo | Vendor discovered | A new option exists; stagger shows order |
| `animate-heartbeat` | `heartbeat` (scale 1↔1.06) | 1500ms loop | in-out | Broadcast node live | System is searching |
| `animate-glow` | `glow` (opacity/scale on glow layer) | 1500ms loop | in-out | Broadcast node live | Pairs with heartbeat |
| `animate-ping-ring` | `ping-ring` (scale .8→2.2, fade out) | 1500ms loop | out-expo | Broadcast node (optional) | Outward radar broadcast |
| `animate-heartbeat-fast` | `heartbeat` | 800ms loop | in-out | Vendor actively pitching | This vendor is working now |
| `animate-glow-fast` | `glow-bright` (brighter) | 800ms loop | in-out | Vendor actively pitching | Heightened activity |
| `animate-log-in` | `log-in` (fade + slideX 16px) | 200ms | out-expo | New log line mounts | A new event happened |
| `animate-card-reveal` | `card-reveal` (fade + scale .95→1) | 360ms | out-expo | Governance completes | The decision is ready |

---

## 3. Idle → Active transition (orchestrated)

Goal: search bar travels **center → top**, columns rise from below. The position
change is done with **FLIP** (animate `transform`, not layout) so it stays composited.

**Beat sheet (total ≈ 700ms, each part within budget):**

| t (ms) | Element | Motion |
|---|---|---|
| 0 | Idle hero text (headline/subtitle) | `hero-exit` — fade + ↑, 240ms in-expo (exit first) |
| 0 | Search bar | FLIP translate center→top, 500ms out-expo |
| 200 | Node-graph column (left) | `col-rise`, 500ms out-expo |
| 320 | Log-feed column (right) | `col-rise`, 500ms out-expo (≈120ms after graph → eye goes L→R) |

**FLIP for the search bar** (Web Animations API — can't be pure CSS because the
layout box moves):

```ts
function flipSearchBar(el: HTMLElement, prevRect: DOMRect) {
  const next = el.getBoundingClientRect();           // Last
  const dx = prevRect.left - next.left;
  const dy = prevRect.top  - next.top;               // Invert
  const sx = prevRect.width / next.width;
  if (prefersReducedMotion()) return;
  el.animate(                                        // Play
    [{ transform: `translate(${dx}px, ${dy}px) scaleX(${sx})` },
     { transform: "none" }],
    { duration: 500, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "both" }
  );
}
// 1. read prevRect (First) BEFORE the state flips
// 2. flip React state idle→active (DOM reflows to pinned-top layout)
// 3. in useLayoutEffect, call flipSearchBar(el, prevRect)
```

Columns just mount with `animate-col-rise` + a `style={{ animationDelay }}` of 200ms /
320ms. Under reduced-motion, FLIP is skipped (instant) and the global guard zeroes the
column animations — the active layout simply appears.

---

## 4. Node graph state machine

Each node is `relative`; its glow is a `.node-glow` child (blurred disc) whose
**opacity/scale** animate — not `box-shadow`.

| Node state | Classes | Notes |
|---|---|---|
| **broadcast** (origin) | core `animate-heartbeat`; glow `animate-glow` (bg `--node-broadcast`); optional ring `animate-ping-ring` | Slow 1.5s heartbeat |
| **vendor** (discovered) | `animate-vendor-in` with `style={{'--i': index}}` under `.stagger-vendors` | 150ms cascade by index |
| **vendor pitching** (active) | swap to `animate-heartbeat-fast` + glow `animate-glow-fast` | 800ms — visibly faster + brighter |
| **winner** | remove pulse; `transition-colors duration-standard ease-smooth` to `--node-winner` (green); glow layer set to **steady** high opacity (no animation) | "Sustained glow" = static, not pulsing — signals resolution |
| **loser** | `opacity-30 transition-[opacity] duration-standard ease-smooth`; stop pulse | Recedes; pairs with `--node-loser` dim color |

Winner color change + losers fading is the core "what happened" signal — keep it even
under reduced-motion (it's color/opacity end-state, applied instantly).

```tsx
<div className="relative">
  <span className="node-glow animate-glow" style={{ background: "var(--node-broadcast)" }} />
  <span className="animate-heartbeat …node core…" />
</div>
```

---

## 5. Log feed

Each line, on mount: `animate-log-in` (slide in from right + fade, 200ms out-expo).
For a batch arriving together, stagger 80ms by index:

```tsx
{lines.map((l, i) => (
  <li key={l.id} className="animate-log-in" style={{ animationDelay: `${i * 80}ms` }}>
    <span className="font-mono text-mono-sm text-text-muted">{l.ts}</span> {l.msg}
  </li>
))}
```

For a true live stream (one line at a time), no delay is needed — arrival *is* the
stagger. Pin scroll to bottom; new line animates in, older lines hold.

---

## 6. Result card

When governance returns, the result card mounts with `animate-card-reveal`
(scale .95→1 + fade, 360ms out-expo) — arrives with authority, no bounce. If it
replaces the active layout, let the columns settle first (it reads as the conclusion).

---

## 7. Interaction states (the motion ↔ 8-state map)

The animations above are the *system's* state feedback. Per-control states still apply:

- **hover** (100ms, micro): buttons darken/lift — `transition-colors duration-micro`.
- **active/press**: `active:scale-[0.97]` 100ms — tactile confirm.
- **focus**: never remove rings — `focus-visible:outline-2 outline-offset-2
  outline-accent-blue` (≥3:1 contrast on dark surfaces ✓).
- **disabled**: `disabled:opacity-40` + explain why (the page already gates submit on
  intent/contract).
- **loading**: the node graph + log feed *are* the loading state (richer than a
  spinner) — prefer this over the old fake phase ticker.
- **error**: block decision / API error — `bg-block-subtle` + `text-block-text`,
  no motion needed beyond the card reveal.
- **success**: winner glow + `card-reveal` = the success signal.

---

## 8. Verification checklist

- [ ] Only `transform`/`opacity` animate (glow = opacity/scale on `.node-glow`, not
      `box-shadow`; winner uses `background-color` transition — paint only, small node,
      acceptable).
- [ ] No `cubic-bezier` overshoots y=1 (no bounce/elastic).
- [ ] Durations in 100–500ms (loops excepted: 800/1500ms pulses are intentional).
- [ ] DevTools Performance shows no Layout/Paint storms during idle→active or graph play.
- [ ] OS reduced-motion ON: transitions instant, winner/loser still legible by color.
- [ ] Keyboard: Tab reaches search + buttons; `:focus-visible` ring visible on dark bg.
- [ ] Desktop-only: layout assumes ≥1024px two-column; no mobile breakpoints required,
      but cap content width and let the 55/45 split hold via `grid-cols-[55fr_45fr]`.
