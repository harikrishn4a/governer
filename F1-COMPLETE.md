# F1 + F2 + B5 — COMPLETE

Design foundations adopted across the web app and the contract picker rebuilt as a
true persistent sidebar. All work verified by a clean `next build` and a dev-server
smoke test.

## F1 — Design foundations (color + type + dark default)

The token *definitions* already landed in commit `db8506a8` (CSS variables in
`globals.css`, Tailwind tokens in `tailwind.config.ts`, fonts via `next/font` in
`layout.tsx`). This session completed the adoption + hardening:

- **Color system** — CSS variables and Tailwind tokens are the single source of truth
  (`--bg`, `--surface*`, `--text-*`, `--accent-*`, semantic `accept/block/review`,
  `node-*`). Verified wired in `tailwind.config.ts`.
- **Fonts** — Sora (`font-display`), IBM Plex Sans (default `font-sans`), IBM Plex Mono
  (`font-mono`) loaded via `next/font/google`. Applied visibly:
  - `font-display` → page titles (`text-display-xl`), section headings, vendor names,
    big budget numbers.
  - default sans → all UI/body/labels.
  - `font-mono` → prices (`SGD …`), Stripe PaymentIntent ids, transaction ids, budget
    figures, contract caps — the three families read as distinct.
- **Dark theme default** — `color-scheme: dark`; `html` *and* `body` background set to
  `var(--bg)` (added `html` rule this session to kill any white flash / overscroll
  gutter). No white/light surfaces remain in the layout.

## F2 — Kill ad-hoc green/red/amber (+ all raw palette classes)

Every ad-hoc Tailwind palette class in `app/page.tsx` and `app/dashboard/page.tsx`
(and the new `components/Sidebar.tsx`) was replaced with semantic tokens per the
DESIGN-SYSTEM.md §5 migration map:

- `green-*` → `accept` · `red-*` → `block` · `amber-*`/`yellow-*` → `review`
- `slate-*`/`white` neutrals → `bg`/`surface`/`surface-raised`/`border*`/`text-*`
- `slate-900` primary buttons/active states → `accent-blue` + `text-inverse`
- `blue-500` links → `accent-blue` / `accent-blue-hover`
- winner pitch card `purple-400` → `accent-purple`; `LLM_COLORS` map → semantic/accent
  tints (decorative categorical tags, still text+name, never color-only).

Verification grep (run from `apps/web`) returns **zero** matches:

```
grep -rEn "(bg|text|border|ring|from|to|via|fill|stroke)-(green|red|amber|yellow|emerald|slate|purple|blue|gray|zinc|neutral)-[0-9]|bg-white|text-white" app/ components/
# → no output
```

(The only remaining literal color is `bg-black/50` on modal overlays — an intentional
scrim opacity, not a palette token.)

## B5 — True persistent sidebar (`components/Sidebar.tsx`)

Extracted the old mode toggle + contract `<select>` dropdown into a real left-rail
component, wired into `app/page.tsx` as a persistent flex column.

Structure (top → bottom):
- **Wordmark + version** — `AgentBid` in `font-display` extrabold + `v0.1` mono tag.
- **Mode toggle** — `Find | Auction` pills. Auction is greyed/disabled with a
  `title="Auction mode — coming soon"` tooltip and a `soon` badge.
- **Contracts section** — `Contracts` overline header + `+` button.
  - Contract **cards** (clickable, *not* a dropdown): name (bold), `SGD cap · period`
    (small mono), active/inactive dot. Selected card → `border-accent-blue` +
    `ring-accent-blue` + `bg-accent-blue-subtle`.
  - `+` inline-expands the **new-contract form**: name, cap, period, risk threshold,
    tag inputs for category constraints + vendor blocklist, Save/Cancel. Saves via
    `POST /api/contracts`, then reloads the list.
- **Budget meter** (bottom): contract name, large remaining balance in `font-display`,
  thin progress bar that goes **green → amber at 70% → red at 90%**, and
  `X of Y SGD used <period>`. Fetches real spend from `GET /api/contracts/[id]/budget`
  (the live endpoint backing the dashboard; refreshes after each procurement/override).

**Wiring:** `contractId` and `mode` live in `page.tsx` state; the Sidebar receives them
+ setters, so the selected contract flows straight into the `/api/procure` submission.
A `budgetRefreshKey` is bumped on procurement/override to refresh the meter.

## Validation

- [x] All ad-hoc color references replaced with semantic tokens (grep clean).
- [x] Font pairing applied visibly — display vs ui vs mono are distinct.
- [x] Sidebar renders with a contract **list** (cards), not a dropdown.
- [x] Contract selection works and is passed to search (`contractId` → `/api/procure`).
- [x] Budget meter shows real spend (`/api/contracts/[id]/budget`) with the
      green/amber/red threshold bar.
- [x] New contract form saves via `POST /api/contracts`.
- [x] `next build` compiles successfully; types + lint pass; `/` and `/dashboard`
      both render (HTTP 200) with the new sidebar markers in SSR output.

## Commands

```bash
cd apps/web
npm run build                  # ✓ Compiled successfully, 10/10 pages
npm run dev                    # smoke-tested: /, /dashboard → 200, sidebar renders
```
