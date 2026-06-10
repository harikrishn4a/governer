> **AgentBid** — Tracks current project progress from the canonical build reference in CLAUDE.md.

# Project Progress

## Current State
- Project: AgentBid, a multi-agent agentic procurement system for natural-language purchase intents
- Target event: NEXT Hackathon @ SuperAI Singapore, 36-hour build, June 9–11 2025
- Prize targets: Top 5 Overall + Best Use of Exa + Best Use of Stripe
- Latest commit: 4035d8c (entry point)
- Test status: `npm run test:discovery` → PASSING
- Typecheck agents: `npx tsc --noEmit` → 0 errors
- Typecheck web: `npx tsc --noEmit` → 0 errors

## Completed

### feat-001: Discovery pipeline — UserIntent → PaymentIntent[]
- [x] `apps/agents/src/agents/types.ts` — all shared types
- [x] `apps/agents/src/lib/logger.ts` — structured JSON logger
- [x] `apps/agents/src/lib/llm.ts` — unified LLM wrapper (Claude preferred, GPT-4o fallback)
- [x] `apps/agents/src/tools/exa.ts` — Exa Agent with 3-retry, dedup check, fallback search
- [x] `apps/agents/src/agents/discovery.ts` — LLM query augmentation (no platform names), Exa Agent primary
- [x] `apps/agents/src/agents/procurement.ts` — parses raw text into UserIntent, calls discovery
- [x] `apps/agents/src/index.ts` — Express server with `/run`, `/discover`, `/override`, `/contracts`, `/health`
- [x] `apps/agents/src/test-discovery.ts` — validation harness with raw JSON dump

**Verification passed:** `npm run test:discovery` exits 0, VALIDATION PASSED, 5 options, all fields present.

### feat-002: Supplier pitch agents
- [x] `apps/agents/src/agents/supplier.ts` — parallel fan-out, 3 agents (GPT-4o × 3), SupplierPitch[]

### feat-003: Procurement orchestration
- [x] `apps/agents/src/agents/procurement.ts` (updated) — `runFullProcurement`, `pickWinner` stub (highest fitScore)

### feat-004: Governance agent + Stripe execution
- [x] `apps/agents/src/agents/governance.ts` — 5 rules: INTENT_MATCH, BUDGET_CAP, CATEGORY_CONSTRAINT, VENDOR_BLOCKLIST, VENDOR_LEGITIMACY
- [x] `apps/agents/src/tools/stripe.ts` — ACCEPT: create+confirm; BLOCK: create with capture_method=manual; override confirm
- [x] `apps/agents/src/tools/db.ts` — Pool singleton, contracts CRUD, period spend, transactions, audit events

### feat-005: Web frontend
- [x] `apps/web/` — Next.js 14 + Tailwind CSS scaffold (package.json, tsconfig, next.config.ts, tailwind.config.ts, postcss.config.mjs)
- [x] `apps/web/app/layout.tsx` — root layout with nav
- [x] `apps/web/app/globals.css` — Tailwind base + slide-in animation
- [x] `apps/web/app/page.tsx` — procurement UI (intent input, contract selector, ACCEPT/BLOCK display, supplier pitches, override button)
- [x] `apps/web/app/dashboard/page.tsx` — governance dashboard (contracts CRUD form, transaction log, expand rows, override)
- [x] `apps/web/app/api/procure/route.ts` — POST, proxies to agents `/run`
- [x] `apps/web/app/api/contracts/route.ts` — GET + POST
- [x] `apps/web/app/api/contracts/[id]/route.ts` — PATCH + DELETE
- [x] `apps/web/app/api/override/route.ts` — POST, proxies to agents `/override`
- [x] `apps/web/app/api/transactions/route.ts` — GET all
- [x] `apps/web/app/api/transactions/[id]/route.ts` — GET single
- [x] `apps/web/lib/db.ts` — web DB helpers (contracts + transactions)
- [x] `apps/web/lib/stripe.ts` — Stripe client singleton
- [x] `apps/web/.env.local.example` — all required env vars

### feat-006: Database persistence
- [x] `docker-compose.yml` — postgres:15 service
- [x] `db/migrations/001_contracts.sql` — spending_contracts table + seed default contract
- [x] `db/migrations/002_transactions.sql` — transactions table
- [x] `db/migrations/003_audit_events.sql` — audit_events table

### feat-008: Design audit remediation (UI consistency pass)
- [x] `apps/web/components/Wordmark.tsx` — single brand treatment, rendered once per page (was 3 divergent wordmarks on `/`)
- [x] `apps/web/app/layout.tsx` — global top nav removed; sidebar is the shell on `/`, dashboard owns its header
- [x] `apps/web/components/ContractForm.tsx` — single-source contract create/edit + TagInput (replaces 2 divergent copies in Sidebar + dashboard; unified default period `monthly`, allowlist field everywhere)
- [x] `apps/web/components/Dialog.tsx` — modal primitive: role=dialog, aria-modal, Escape, focus trap + restore (replaces 3 drifted ad-hoc modals)
- [x] `apps/web/lib/labels.ts` — humanized enums (`per_transaction` → "per transaction", ACCEPT → "Accepted") used by both pages
- [x] `apps/web/app/page.tsx` — example-intent chips, disabled-CTA explanation, Next `Link`s, responsive active grid (`lg:` stack), dead auction branch removed, modal → Dialog
- [x] `apps/web/app/dashboard/page.tsx` — rewritten: Wordmark header, skeleton loading, budget-stat hierarchy (numbers > name), responsive stat grid, keyboard-accessible contract cards, stopPropagation + confirm on Deactivate, empty-state CTAs, shorter dates, modal → Dialog
- [x] `apps/web/components/AgentLog.tsx` — auto-scroll only sticks when reader is at the bottom
- [x] `apps/web/components/ResultCard.tsx` — emojis removed from pills, over-budget → review/amber (not block/red), `break-words` on vendor, motion-law-compliant hovers (opacity, not brightness filter)

**Verification passed:** `npx tsc --noEmit` → 0 errors; `npx next build` → both routes compile.
**Deferred:** mobile sidebar strategy (DESIGN-SYSTEM.md declares desktop-only), NodeGraph 9px labels, log/result column takeover on completion.

## Pending Validation (keys not yet added)
- [ ] TEST 1: Default contract + burger intent → ACCEPT + Stripe PI confirmed
- [ ] TEST 2: Halal contract + burger intent → BLOCK + held Stripe PI
- [ ] Web dev server: `cd apps/web && npm run dev` → http://localhost:3000

## Not Started
- feat-007: AWS infrastructure + deployment (CDK stacks)

## Known Issues / Notes
- No ANTHROPIC_API_KEY in `.env` — llm.ts auto-selects GPT-4o for all LLM calls.
- exa-js v2.13.0 (CLAUDE.md specifies v1.4.0) — Agent API only in v2.x.
- Stripe keys empty in `.env` — governance skips Stripe charge gracefully until keys added.
- DATABASE_URL defaults to local postgres from docker-compose — run `docker-compose up -d postgres` before agents.
- next@14.2.0 has a reported security advisory — fine for hackathon demo, upgrade post-event.
- Web app `npm install` succeeded, 0 TypeScript errors.
