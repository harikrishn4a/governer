# GAP-ANALYSIS.md — AgentBid Frontend (`apps/web`)

Audit of the existing frontend against the target spec, with a theory-backed design
review (Design for Hackers / AI-tells). Generated 2026-06-10.

> **Scoping note:** AGENTS.md describes a `components/` directory, an `api/stream`
> SSE route, and `lib/stream-store.ts`. **None of these exist.** The entire UI lives
> in two page files (`app/page.tsx`, `app/dashboard/page.tsx`). `/api/procure` is a
> single **blocking** POST that proxies to the agents server and returns the full
> result at once. The "Live progress" list in `page.tsx` is a **fake timed ticker**
> (`DEMO_PHASES` advancing every 28s via `setInterval`), not real agent events.
> Any "live log feed" or "animated node graph" that is supposed to reflect real
> agent activity therefore requires **backend streaming work first**, not just a UI.

---

## 1. Surface-by-Surface Audit

### Sidebar — contract list, mode toggle, budget meter, new contract form
**Status: PARTIAL**

| Spec element | State | Notes |
|---|---|---|
| Mode toggle (Find/Auction) | ✅ Built | `page.tsx:184–206`. Works; Auction is intentionally stubbed. |
| Contract list | ⚠️ Partial | It's a `<select>` dropdown (`page.tsx:218–229`), not a browsable list. |
| Budget meter | ❌ Missing | No budget meter on the main page. Only the dashboard has one. |
| New contract form | ❌ Missing | Main page only links to `/dashboard`. The form lives there. |

Also: this isn't a true persistent sidebar. It's a `lg:col-span-1` grid column that
stacks under the main content on mobile and disappears conceptually as a "nav rail."

### Main (idle) — centered search bar
**Status: PARTIAL**

There is a search `<textarea>` (`page.tsx:248–274`), but there is **no distinct idle
state**. The input sits in the right grid column at all times under an `h1`/subtitle.
There's no centered hero, no "empty canvas → focus the search" moment. Idle and active
share the same cramped two-thirds column.

### Main (active) — two-column: animated node graph (left) + live log feed (right)
**Status: NO**

- **Animated node graph: does not exist.** Nothing renders vendors/agents as nodes.
- **Live log feed: does not exist as specified.** What's there is the fake
  `DEMO_PHASES` checklist (`page.tsx:280–309`) — six hardcoded strings on a 28s timer.
  It is not driven by real events, and there is no two-column active layout.
- The unused `.agent-event-enter` keyframe in `globals.css:16–23` is a leftover hint
  that a real feed was once intended.

### Result — ACCEPT/BLOCK card with rationale, advantage, Stripe PI
**Status: YES (most complete surface)**

- Decision banner with ACCEPT/BLOCK + override state — `page.tsx:328–354` ✅
- Rationale ✅, "Why this is the best value" / advantage ✅ (`page.tsx:356–359`)
- Stripe PaymentIntent id ✅ (`page.tsx:339–341`)
- Bonus: governance rules list + supplier pitch cards with LLM badges.
- Design nits below (hierarchy, color, the dead Tailwind semantic palette).

### Override modal — checkedRules list, override button
**Status: YES**

- Block-review modal with failed-rules list + "Override & execute" — `page.tsx:424–453` ✅
- A second, richer override modal also exists on the dashboard — `dashboard/page.tsx:490–524` ✅
- Logic is duplicated across two files (extraction candidate).

### Dashboard — transaction log table, budget arc, contract rules panel
**Status: PARTIAL**

| Spec element | State | Notes |
|---|---|---|
| Transaction log | ⚠️ Partial | Built as a list of expandable cards (`dashboard/page.tsx:411–487`), **not a table**. No columnar scan. |
| Budget arc | ⚠️ Partial | It's a **linear progress bar** + three stat tiles (`dashboard/page.tsx:241–288`), not a radial arc. |
| Contract rules panel | ✅ Built | Contract list + create/edit form with tag inputs (`dashboard/page.tsx:290–397`) ✅ |

---

## 2. Design Review (CHECKER mode — by severity)

| # | Severity | Problem | Principle violated | Fix |
|---|---|---|---|---|
| D1 | **Critical** | No stated aesthetic direction — defaults to generic "clean/modern" slate-on-white. | AI-tells: absence of direction is the root tell; Ch 1 (design = purpose+medium+aesthetics). | Pick a 2–3 word direction (e.g. "industrial control panel," "financial-grade governance"). Drive every later choice from it. → `/brand` |
| D2 | **Critical** | "Live progress" is fake (hardcoded 28s ticker). For a hackathon demo judged on Exa/Stripe, presenting fake real-time activity is a credibility risk. | Ch 1: visual design must not contradict information design / build false credibility. | Wire a real SSE event stream from the agents pipeline; render genuine events. (Backend + frontend — see Build #1.) |
| D3 | **Critical** | The marquee "animated node graph" — the demo's visual centerpiece — does not exist. | Ch 6: no dominant element / no spectacle to anchor the eye; spec's wow-factor is absent. | Build the node-graph component (Build #2). |
| D4 | **Major** | Default system font stack (`-apple-system, …` in `globals.css:13`); no typographic decision. | AI-tells (font default = no decision); Ch 3 (typeface must match medium + mood). | Choose an intentional pairing (e.g. a geometric/grotesk display + a readable body or mono for data). → `/fonts` |
| D5 | **Major** | "Everything in a card": near-every block is `bg-white rounded-xl border-slate-200 p-4`. No dominance, no varied presentation, uniform padding. | AI-tells (card-grid tell); Ch 6 (dominance/variety); Ch 7 (white space hierarchy). | Mixed presentation: a dominant result, lists/callouts for secondary info; vary spacing to group. → `/flow` for layout rhythm |
| D6 | **Major** | Tailwind defines semantic `accept/block/review` colors (`tailwind.config.ts:11–16`) but the UI never uses them — every status is ad-hoc `green-*/red-*/amber-*`. Dead system; inconsistent palette. | Ch 9 (palette should follow one identifiable system); Ch 8 (functional color consistency). | Adopt the semantic tokens everywhere, or delete them and define a real palette. → `/color` |
| D7 | **Major** | Flat hierarchy: the label `text-xs font-semibold text-slate-400 uppercase tracking-wider` is repeated ~12× across both pages; every section header has identical weight, so nothing dominates. | Ch 7 (hierarchy via white space → weight → size, not one repeated treatment). | Establish a type scale; let the result/decision dominate; demote metadata. → `/fonts` + `/color` |
| D8 | **Minor** | Budget shown as a flat linear bar; spec wants an arc. Linear bar reads as "loading," not "gauge." | Ch 6 (a gauge/arc is a stronger dominant motif than a thin bar). | Replace with an SVG radial arc. |
| D9 | **Minor** | Transaction log is card-stack, not a table; harder to scan many rows. Also no borders is fine, but no column alignment either. | Ch 7 (alignment guides the eye; tabular data wants columns). | Render as a real table with aligned columns; keep expand-on-click. |
| D10 | **Minor** | Straight quotes / ad-hoc separators in copy; no smart-quote or typographic polish. | Ch 3 / Appendix (typographic characters). | Low priority; pass during a typography sweep. |

**Note on what's already right:** status is never color-only — ACCEPT/BLOCK always
pairs color with a text label and ✓/✗ glyphs (`page.tsx:364–375`), so the colorblind-
safety critical check **passes**. Keep that when restyling.

---

## 3. Build From Scratch (prioritised)

| # | Item | Files to touch | Sessions | Why this order |
|---|---|---|---|---|
| B1 | **Real agent event stream (SSE).** Add `app/api/stream/route.ts` + `lib/stream-store.ts`; have the agents pipeline emit phase/vendor/decision events; convert `/api/procure` to kick off + stream. Frontend `EventSource` hook. | `apps/web/app/api/stream/route.ts` (new), `apps/web/lib/stream-store.ts` (new), `apps/web/app/api/procure/route.ts`, `apps/agents/src/index.ts`, `apps/web/app/page.tsx` | 2 | Unblocks B2 + B3 and removes the fake-ticker credibility risk (D2). Highest leverage. |
| B2 | **Animated node graph** (main-active left). Vendors/agents as nodes, edges lighting up as events arrive. SVG or lightweight lib. | `apps/web/components/NodeGraph.tsx` (new), `apps/web/app/page.tsx` | 2 | The demo centerpiece (D3). Depends on B1 for real data. |
| B3 | **Live log feed** (main-active right) + two-column active layout. Real events with enter animation (reuse `.agent-event-enter`). | `apps/web/components/AgentLog.tsx` (new), `apps/web/app/page.tsx` | 1 | Pairs with B2; depends on B1. |
| B4 | **Centered idle search hero** + idle/active state machine. | `apps/web/app/page.tsx` | 1 | Cheap, high visual payoff; sets up the active layout transition. |
| B5 | **True persistent sidebar:** contract *list* (not dropdown), inline budget meter, inline new-contract form. | `apps/web/app/page.tsx`, extract `apps/web/components/Sidebar.tsx`, `components/ContractForm.tsx` (new) | 2 | Closes the biggest spec gap on the main view. Reuses dashboard form logic. |
| B6 | **Budget arc** (radial gauge) — dashboard, and reused in sidebar meter. | `apps/web/components/BudgetArc.tsx` (new), `apps/web/app/dashboard/page.tsx` | 1 | D8; reusable in B5. |
| B7 | **Transaction log table.** | `apps/web/app/dashboard/page.tsx` | 1 | D9. |

## 4. Fix / Extend (existing surfaces)

| # | Item | Files | Sessions |
|---|---|---|---|
| F1 | Adopt design foundations: aesthetic direction, real font pairing, color system. (D1, D4) | `globals.css`, `tailwind.config.ts`, `layout.tsx` | 1–2 |
| F2 | Wire semantic `accept/block/review` tokens everywhere; kill ad-hoc green/red/amber. (D6) | `tailwind.config.ts`, `app/page.tsx`, `app/dashboard/page.tsx` | 0.5 |
| F3 | Establish type scale + hierarchy; stop repeating the uppercase-label treatment; make the decision/result dominant. (D5, D7) | both page files, `globals.css` | 1 |
| F4 | Extract duplicated override-modal + contract-form logic into shared components. | `components/` (new), both page files | 1 |
| F5 | Result card polish: clearer "advantage" labeling, typographic cleanup. (D10) | `app/page.tsx` | 0.5 |
| F6 | Update `AGENTS.md` so it stops describing components/SSE/stream-store that don't exist (doc drift). | `AGENTS.md` | 0.25 |

## 5. Suggested totals

- **Build from scratch:** ~10 sessions (B1–B7)
- **Fix/extend:** ~4 sessions (F1–F6)
- **Critical path for a compelling demo:** B1 → B2 → B3 → B4 (≈6 sessions) plus F1
  (foundations) — this is what turns the "fake ticker" into the spec's real
  graph + live feed.

## 6. Recommended next commands

- `/brand` — set the aesthetic direction (D1) before anything visual.
- `/fonts` — replace the system-font default; build a type scale (D4, D7).
- `/color` — turn the dead `accept/block/review` tokens into a real palette (D6).
- `/flow` — layout rhythm, the active-state transition, node-graph/feed motion (D5, B2–B4).
