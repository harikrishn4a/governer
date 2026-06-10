# SESSION-HANDOFF.md

## Last session
- **Date:** 2026-06-10
- **Focus:** Design audit remediation (feat-008) — shell unification, shared form/dialog primitives, dashboard repair, conversion fixes

## What changed (feat-008)
- **New shared components:** `Wordmark.tsx` (one brand treatment, once per page), `Dialog.tsx` (role=dialog, Escape, focus trap), `ContractForm.tsx` (single-source contract create/edit + TagInput), `lib/labels.ts` (humanized enums)
- **`layout.tsx`:** global top nav deleted — sidebar is the shell on `/`, dashboard has its own header
- **`page.tsx`:** example intent chips, disabled-CTA hint ("Select a contract…"), Next `Link`, `lg:` responsive active grid, dead auction error branch removed, block-review modal → Dialog
- **`dashboard/page.tsx`:** rewritten — Wordmark header + "New procurement →", skeleton loading, budget stats now the visual heroes, `sm:` responsive stat grid, keyboard-accessible contract cards, stopPropagation + `confirm()` on Deactivate, empty-state CTAs, `dateStyle: medium` dates, review modal → Dialog
- **`Sidebar.tsx`:** local TagInput/NewContractForm deleted in favor of `ContractForm`; period labels from `lib/labels`
- **`AgentLog.tsx`:** auto-scroll only when reader is at the bottom
- **`ResultCard.tsx`:** emojis removed, over-budget pill = review/amber, opacity hovers, `break-words` vendor

## Verified this session
```bash
cd apps/web && npx tsc --noEmit   # 0 errors
cd apps/web && npx next build     # / 9.74kB, /dashboard 5.61kB, both compile
```
(Behavioral demo not re-run this session — DB/agents not started. Run the demo flow below before the next UI change.)

## Database
```env
DATABASE_URL=postgresql://agentbid:agentbid@localhost:5433/agentbid
```
Docker postgres on **5433** (Postgres.app uses 5432). Restart **both** dev servers after `.env` changes.

## Demo flow (find mode)
1. `docker compose up -d postgres`
2. `cd apps/agents && npm run dev`
3. `cd apps/web && npm run dev`
4. `/` → Find mode → select **food spending** → burger intent (or click an example chip) → Procure (~3 min)
5. `/dashboard` → budget panel + transactions filtered by contract → Review block → Override

## Contract tagging
`contractId` required in UI and API. Pipeline loads contract in phase 5a, saves transaction under that contract.

## food spending contract rules (demo notes)
- Category: **Healthy** → burgers often **BLOCK** (good for override demo)
- Blocklist: Black Tap
- Budget: SGD 100 / weekly

## Useful scripts / APIs
- `npm run test:phase5-db -- <contractId>` — fast phase 5+ test (skips 3-min discovery)
- `GET /api/contracts/[id]/budget` — spent / remaining / percent used

## Still deferred
- SSE true live backend logs
- Auction / flight search mode
- Mobile sidebar strategy (DESIGN-SYSTEM.md declares desktop-only)
- NodeGraph 9px vendor labels; result card should take over the log column on completion

## Next agent should
1. Run the full find-mode burger demo end-to-end from the UI to confirm feat-008 changes behave (chips, dialog, override flow)
2. Create **flight bookings** contract for future auction mode
3. Implement SSE event stream OR auction flight search
