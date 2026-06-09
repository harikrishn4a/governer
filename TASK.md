> **AgentBid** — Sprint contract for the current active feature.

# TASK.md — Sprint Contract

## Feature
- ID: feat-001
- Title: Discovery pipeline — UserIntent → PaymentIntent[]

## Scope — what will change
- `apps/agents/src/agents/types.ts` — all shared types
- `apps/agents/src/agents/procurement.ts` — parses raw text into UserIntent via LLM, calls discovery
- `apps/agents/src/agents/discovery.ts` — augments query with LLM, runs Exa Agent, falls back to searchAndContents + Claude
- `apps/agents/src/tools/exa.ts` — Exa Agent wrapper with 3-retry logic, text-field JSON fallback, searchAndContents fallback
- `apps/agents/src/lib/llm.ts` — unified LLM wrapper (Claude + GPT-4o)
- `apps/agents/src/lib/logger.ts` — structured JSON logger
- `apps/agents/src/index.ts` — Express server POST /run + GET /health
- `apps/agents/src/test-discovery.ts` — validation harness
- `apps/agents/package.json`, `tsconfig.json`, `.env.example`

## Exclusions — what will NOT change
- No supplier agents (feat-002)
- No procurement pick_winner logic (feat-002)
- No governance agent (feat-003)
- No Stripe integration (feat-004)
- No web frontend (feat-005)
- No SSE event bus (feat-005)
- No database writes (feat-006)

## Files expected to change
- `apps/agents/src/agents/types.ts`
- `apps/agents/src/agents/procurement.ts`
- `apps/agents/src/agents/discovery.ts`
- `apps/agents/src/tools/exa.ts`
- `apps/agents/src/lib/llm.ts`
- `apps/agents/src/lib/logger.ts`
- `apps/agents/src/index.ts`
- `apps/agents/src/test-discovery.ts`

## Verification standard
- `cd apps/agents && npm run test:discovery` — exits 0, prints VALIDATION PASSED, 5 options with all required fields

## Acceptance criteria
- Raw user text in → structured PaymentIntent[] out
- Each PaymentIntent has: vendor, item, price (numeric SGD), order_url, description, why_pick
- Exa Agent is the primary path; searchAndContents + LLM parsing is the fallback
- Exa Agent retries up to 3 times on transient errors before falling back
- Augmented query contains no delivery platform names

## Invariants — must remain true throughout
- `npx tsc --noEmit` must pass with zero errors
- `npm run test:discovery` must exit 0
