> **AgentBid** — Tracks current project progress from the canonical build reference in CLAUDE.md.

# Project Progress

## Current State
- Project: AgentBid, a multi-agent agentic procurement system for natural-language purchase intents
- Target event: NEXT Hackathon @ SuperAI Singapore, 36-hour build, June 9–11 2025
- Prize targets: Top 5 Overall + Best Use of Exa + Best Use of Stripe
- Latest commit: 4035d8c (entry point)
- Test status: `npm run test:discovery` → PASSING
- Typecheck: `npx tsc --noEmit` → 0 errors

## Completed

### feat-001: Discovery pipeline — UserIntent → PaymentIntent[]
- [x] `apps/agents/src/agents/types.ts` — all shared types (UserIntent, PaymentIntent, SupplierPitch, WinnerPaymentIntent, SpendingContract, GovernanceDecision, AuditEvent, AgentEvent)
- [x] `apps/agents/src/lib/logger.ts` — structured JSON logger
- [x] `apps/agents/src/lib/llm.ts` — unified LLM wrapper, Claude preferred, GPT-4o fallback
- [x] `apps/agents/src/tools/exa.ts` — Exa Agent via `exa.beta.agent.runs` with 3-retry logic, text-field JSON extraction fallback, `exaSearchAndContents` last-resort fallback
- [x] `apps/agents/src/agents/discovery.ts` — LLM query augmentation (no platform names), Exa Agent primary, searchAndContents fallback, logs path used
- [x] `apps/agents/src/agents/procurement.ts` — parses raw text into UserIntent, calls discovery
- [x] `apps/agents/src/index.ts` — Express server, POST /run, GET /health
- [x] `apps/agents/src/test-discovery.ts` — validation harness with box output and raw JSON dump
- [x] `apps/agents/package.json`, `tsconfig.json`, `.env.example`

**Verification passed:** `npm run test:discovery` exits 0, VALIDATION PASSED, 5 options, all fields present.

## In Progress
- Nothing active. Next feature: feat-002 (supplier pitch agents).

## Not Started
- feat-002: Supplier pitch agents — parallel fan-out (GPT-4o, Claude, Gemini Flash)
- feat-003: Procurement orchestration — pick_winner
- feat-004: Governance agent + Stripe execution
- feat-005: Web frontend + SSE stream
- feat-006: Database persistence
- feat-007: AWS infrastructure + deployment

## Known Issues / Notes
- No ANTHROPIC_API_KEY in `.env` — llm.ts auto-selects GPT-4o. Add ANTHROPIC_API_KEY to use Claude for query augmentation and intent parsing as specified in CLAUDE.md.
- exa-js upgraded to v2.13.0 (CLAUDE.md specifies v1.4.0) — Agent API only available in v2.x.
- Exa Agent poll timeout is 300s. Runs occasionally exceed 180s; 300s has been reliable.
- Timeout errors are classified as non-transient and do not trigger retries (only JSON/parse and 5xx errors retry).
- `apps/web`, `infra`, `db` directories do not exist yet.
- `docker-compose.yml` does not exist yet.
