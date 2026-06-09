> **AgentBid** — Sprint contract for the current active feature.

# TASK.md — Sprint Contract

## Feature
- ID: feat-demo-flow
- Title: Demo flow wiring — contract-tagged procurement + find/auction mode shell

## Scope — what will change
- `docker-compose.yml` — postgres on host port 5433 (avoids Postgres.app conflict on 5432)
- `governer/.env` — `DATABASE_URL` uses port 5433
- `apps/agents/src/index.ts` — accept `mode` (find|auction), return contract metadata in `/run` response; auction returns 501
- `apps/web/app/api/procure/route.ts` — require `contractId`, pass `mode`, surface agent `detail` errors
- `apps/web/app/page.tsx` — mode toggle, contract sidebar, required contract selection, user-facing phase log (no graph), contract context in results
- `apps/agents/.env.example` — document port 5433

## Exclusions — what will NOT change
- No graph/bubble negotiation visualization
- No SSE live event stream (still blocking POST)
- No auction/flight search implementation
- No dashboard budget-spent widget (deferred)

## Verification standard
- Docker postgres healthy on `localhost:5433`
- `npm run test:phase5-db -- <food-spending-contract-id>` → PASSED
- `GET /api/contracts/[id]/budget` → spent/remaining JSON
- Dashboard shows budget panel + contract-filtered transactions
- Find mode full UI run: food spending + burger intent → BLOCK or ACCEPT + row in dashboard
- Auction mode: returns clear "not implemented" message

## Invariants — must remain true throughout
- `npx tsc --noEmit` (agents + web) → 0 errors
- `docker compose config` validates
