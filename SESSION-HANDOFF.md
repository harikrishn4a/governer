> **AgentBid session handoff** — Current session state for AI coding agents. This file is overwritten by the agent at the end of every session.

# SESSION-HANDOFF.md

## Date
2026-06-09

## What was completed
feat-001 (Discovery pipeline — UserIntent → PaymentIntent[]) is **passing**.

All files under `apps/agents/` were built from scratch this session:
- `src/agents/types.ts` — full shared type set
- `src/lib/logger.ts` — structured JSON logger
- `src/lib/llm.ts` — Claude + GPT-4o unified wrapper, auto-selects based on available API key
- `src/tools/exa.ts` — Exa Agent via `exa.beta.agent.runs.create` + `pollUntilFinished`; 3-retry wrapper on transient errors; text-field JSON extraction fallback; `exaSearchAndContents` last-resort fallback
- `src/agents/discovery.ts` — LLM query augmentation (platform-name-free), Exa Agent primary path, logs `path: "agent" | "fallback"`
- `src/agents/procurement.ts` — parses raw intent into UserIntent via LLM, calls discovery
- `src/index.ts` — Express server, POST /run, GET /health, port 4000
- `src/test-discovery.ts` — validation harness with box output and raw JSON dump
- `package.json`, `tsconfig.json`, `.env.example`, `.env`

## Verification run
| Command | Result |
|---|---|
| `cd apps/agents && npx tsc --noEmit` | 0 errors |
| `cd apps/agents && npm run test:discovery` | VALIDATION PASSED — 5 options, all fields present |

## What is broken or unverified
- No ANTHROPIC_API_KEY in `.env` — GPT-4o is being used for all LLM calls. Claude Sonnet will be used automatically once ANTHROPIC_API_KEY is added.
- Exa Agent runs can occasionally timeout (>180s); poll timeout raised to 300s. Timeout errors do not retry.
- `apps/web`, `infra`, `db`, `docker-compose.yml` do not exist yet.

## Next best step
**Feature: feat-002 — Supplier pitch agents**

Start from `apps/agents/src/agents/supplier.ts`. Create a parameterised pitch agent that takes one `PaymentIntent` + `UserIntent` + an LLM model string and returns a `SupplierPitch`. Then update `procurement.ts` to fan out to 3 instances in `Promise.all` — one per LLM (GPT-4o, Claude, Gemini Flash). Extend `npm run test:discovery` or add `npm run test:supplier` to verify.

Write the sprint contract to `TASK.md` before starting.

## Must not change
- Query augmentation prompt in `discovery.ts` must not name any delivery platforms
- Exa Agent is the primary discovery path; fallback is last resort only
- `exaAgentWithRetry` retry count (3) and delay (2s) — working as designed
- Poll timeout (300000ms) — do not reduce
- `llm.ts` auto-selection logic (Claude if ANTHROPIC_API_KEY, else GPT-4o)
- Type definitions in `types.ts` match CLAUDE.md canonical spec
