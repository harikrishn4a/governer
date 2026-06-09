> **AgentBid** — Sprint contract for the current active feature.

# TASK.md — Sprint Contract

## Feature
- ID: feat-phase3
- Title: Governance agent + Stripe + DB + Web dashboard (Phase 3)

## Scope — what will change
- docker-compose.yml — local postgres service
- db/migrations/001_contracts.sql, 002_transactions.sql, 003_audit_events.sql
- apps/agents/src/agents/supplier.ts — parameterised pitch agent (GPT-4o × 3, Claude if key present)
- apps/agents/src/agents/procurement.ts — fan-out to supplier agents + pick_winner stub
- apps/agents/src/agents/governance.ts — 5-rule governance agent with LLM + DB + HEAD checks
- apps/agents/src/tools/db.ts — pg pool with typed query helpers
- apps/agents/src/tools/stripe.ts — @stripe/agent-toolkit + direct Stripe functions
- apps/agents/src/index.ts — accept contractId, run full pipeline through governance, save to DB
- apps/agents/package.json — add stripe, @stripe/agent-toolkit, pg
- apps/agents/.env / .env.example — add STRIPE_SECRET_KEY, DATABASE_URL
- apps/web/ — full Next.js 14 + Tailwind scaffold (new directory)
  - package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs
  - app/layout.tsx, app/globals.css
  - app/page.tsx — procurement UI
  - app/dashboard/page.tsx — governance dashboard
  - app/api/procure/route.ts, contracts, override, transactions/[id]
  - lib/db.ts, lib/stripe.ts
  - .env.local.example

## Exclusions — what will NOT change
- No real auth
- No SSE event streaming (Phase 2 feature)
- No Gemini supplier agent (no key; GPT-4o used as all 3 supplier LLMs)
- No AWS CDK (Phase 7)
- No S3 transcript upload
- Query augmentation prompt — already fixed and correct

## Verification standard
- TEST 1 (happy path): POST /run with Default contract → ACCEPT, Stripe pi confirmed
- TEST 2 (block path): POST /run with halal contract + burger → BLOCK, held Stripe pi
- npm run dev (agents) — server starts, GET /health → 200
- npm run dev (web) — Next.js app loads at localhost:3000

## Invariants — must remain true throughout
- npx tsc --noEmit (agents) → 0 errors
- npm run test:discovery → still passes
- Query augmentation must not name delivery platforms
