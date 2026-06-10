# Session Handoff

## Last session (2026-06-10): feat-009 Auction mode — COMPLETE & PASSING

### What was built
- **Auction pipeline** (`apps/agents/src/agents/auction.ts`): tender broadcast → live Exa price anchors → 2 bidding rounds (sealed → best & final with competitor board) → LLM judge (weighted: 30% price, 35% fit, 20% value-adds, 15% credibility, code tie-break) → `WinnerPaymentIntent` → shared governance/Stripe/DB tail.
- **Flight demo path**: 5 pre-built bidder profiles in `vendors/flight-vendors.ts` (Traveloka / Skyscanner / Trip.com / Scoot / AirAsia), prompt-only bidding policies, anchors via Exa `searchAndContents` + `includeDomains` (NEVER the slow Exa Agent API). Unpriced vendors are skipped (`bidder:skipped` event); <2 real anchors aborts loudly.
- **Generic path**: any other category — `runDiscovery` options become bidders with Exa+LLM researched profiles (`vendors/generic-vendor.ts`).
- **Frontend**: `AuctionTheatre.tsx` (tender / bid board / judge / review / recap), `useAgentStream` AuctionState derivation + auction log lines, Sidebar auction toggle enabled, both 501 guards removed, procure dispatch timeout 180s, mode captured at submit time.
- **Fixes along the way**: `llmCallJSON` now strips markdown fences (`coerceJson`); governance INTENT_MATCH prompt includes today's date (was failing "tomorrow" flights); anchor itemSummary composed from tender travel details with "(tomorrow)" relative label.

### Evidence
- `npm run test:auction` → 33/33 checks PASS
- `npm run test:auction-e2e` → PASS with LIVE fares (Traveloka 74.40, Skyscanner 84, Trip.com 96, AirAsia 77; Scoot skipped); ACCEPT → Stripe PI succeeded; cap-150 BLOCK → held → override confirmed
- Server-level `POST /run mode=auction` → ACCEPT Traveloka SGD 74.40, DB row `full_result.mode=auction`, audit event, full SSE auction vocabulary on stream replay
- Generic catering auction → 5 researched bidders, judge ranked, BLOCK on SGD 100 default cap (correct)
- Find-mode regression: burger demo unchanged end-to-end; `test:discovery` PASSING; tsc 0 errors both apps; web build PASSING

## How to demo
1. `docker compose up -d` then `cd apps/agents && npm run dev` and `cd apps/web && npm run dev`
2. Browser → toggle **Auction** → run example: "Affordable, comfortable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD"
3. Watch: tender scene with live published fares → bid board across 2 rounds → judge ranking → governance → verdict bar with Stripe PI
4. For a BLOCK demo: create a contract with cap SGD 50 in the sidebar first
5. **Warm-up**: run the exact demo intent once ~10 min before presenting (Exa fare discovery is the flaky part; Scoot often has no extractable fare)

## Still deferred
- feat-007: AWS ECS + RDS deploy; SSE Redis for serverless; `waitUntil()` on Vercel
- Visual browser pass of AuctionTheatre scenes was verified via SSE data shape, not screenshots — do one UI run before the demo

## Next agent should
1. Do one full browser run in Auction mode and polish any scene visuals
2. Consider a "Travel" demo contract (cap SGD 300, per_transaction) seeded via sidebar
3. Then feat-007 AWS deploy if time permits
