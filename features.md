> **AgentBid** — Feature specs. Agent checks off tasks and adds notes as work progresses.

# FEATURES.md

Status tracking lives in `feature_list.json`. This file is the narrative spec.

---

## Feature 001: Discovery pipeline — UserIntent → PaymentIntent[]

**What the user sees:**
Not directly visible yet — this is the backend pipeline. A raw purchase intent string goes in; a structured list of real purchasing options comes out. Feeds into supplier pitch agents in feat-002.

**Tasks:**
- [x] `src/agents/types.ts` — UserIntent, PaymentIntent, and all shared types
- [x] `src/lib/logger.ts` — structured JSON logger (CloudWatch-compatible)
- [x] `src/lib/llm.ts` — unified LLM wrapper (Claude preferred, GPT-4o fallback)
- [x] `src/tools/exa.ts` — Exa Agent via `exa.beta.agent.runs` with 3-retry logic and text-field JSON fallback; `exaSearchAndContents` fallback
- [x] `src/agents/discovery.ts` — LLM query augmentation (no platform names) → Exa Agent → fallback; emits `path: "agent" | "fallback"`
- [x] `src/agents/procurement.ts` — parses raw text into UserIntent with LLM, calls runDiscovery
- [x] `src/index.ts` — Express server, POST /run, GET /health
- [x] `src/test-discovery.ts` — validation harness with box output and raw JSON dump
- [x] `package.json`, `tsconfig.json`, `.env.example`

**Acceptance criteria:**
- `npm run test:discovery` exits 0 with VALIDATION PASSED
- 5 options returned, each with vendor, item, price (numeric SGD), order_url, description, why_pick
- Augmented query contains no delivery platform or marketplace names
- Exa Agent is tried first; searchAndContents + LLM parsing is last resort only

**Out of scope:**
- Supplier pitch agents
- Governance enforcement
- Stripe payment execution
- Web frontend and SSE streaming
- Database persistence

**Notes:**
- exa-js v2.13.0 used (not v1.4.x from CLAUDE.md) — Agent API lives at `exa.beta.agent.runs.create` + `pollUntilFinished`, requires `betas: [AGENT_BETA_HEADER]`
- No ANTHROPIC_API_KEY in current `.env`; GPT-4o used for LLM calls. llm.ts auto-selects Claude if ANTHROPIC_API_KEY is set, GPT-4o otherwise
- Poll timeout set to 300000ms (5 min) — Exa Agent runs typically complete in 2–3 min
- Timeout errors classified as non-transient (not retried); JSON parse and 5xx errors are retried

---

## Feature 002: Supplier pitch agents — parallel fan-out

**What the user sees:**
After discovery, three supplier agents (GPT-4o, Claude, Gemini Flash) each advocate for one option. Their pitches are shown as cards with vendor name, price, LLM badge, key points, and a fit score bar.

**Tasks:**
- [ ] `src/agents/supplier.ts` — parameterised pitch agent, takes PaymentIntent + UserIntent + LLM model, returns SupplierPitch
- [ ] `src/lib/llm.ts` — add Gemini Flash support
- [ ] `src/agents/procurement.ts` — fan-out to 3 supplier agents in Promise.all, collect SupplierPitch[]
- [ ] Wire into POST /run response

**Acceptance criteria:**
- 3 SupplierPitch objects returned, one per LLM
- Each pitch has: vendorId, vendor, item, price, pitch, keyPoints (3 bullets), fitScore (0–100), llmUsed
- Runs in parallel (Promise.all), not sequential

**Out of scope:**
- pick_winner logic (that's procurement orchestration, feat-003)

**Notes:**

---

## Feature 003: Procurement orchestration — pick_winner

**What the user sees:**
After supplier pitches, the procurement agent selects the winner and explains why. The winning card is highlighted in the UI.

**Tasks:**
- [ ] `src/agents/procurement.ts` — pick_winner tool: receives SupplierPitch[] + UserIntent, returns WinnerPaymentIntent
- [ ] Wire winnerId + procurementRationale + rankedAlternatives into response

**Acceptance criteria:**
- WinnerPaymentIntent returned with procurementRationale and rankedAlternatives
- Winner selection uses Claude Sonnet as orchestrator

**Notes:**

---

## Feature 004: Governance agent + Stripe execution

**What the user sees:**
A green ACCEPT badge or red BLOCK badge with a per-rule checklist. On ACCEPT, a real Stripe test PaymentIntent is created and confirmed. On BLOCK, the intent is held for human override.

**Tasks:**
- [ ] `src/agents/governance.ts` — evaluates WinnerPaymentIntent against active SpendingContract, returns GovernanceDecision
- [ ] `src/tools/stripe.ts` — create, confirm, cancel PaymentIntent
- [ ] Wire ACCEPT → create + confirm; BLOCK → create with capture_method: manual
- [ ] Store stripePaymentIntentId in GovernanceDecision

**Acceptance criteria:**
- GovernanceDecision returned with decision, rationale, checkedRules[]
- On ACCEPT: Stripe PaymentIntent created and confirmed (status: succeeded)
- On BLOCK: Stripe PaymentIntent created but not confirmed (status: requires_confirmation)

**Notes:**

---

## Feature 005: Web frontend + SSE stream

**What the user sees:**
Full procurement UI: intent input, live agent event timeline, supplier pitch cards, governance panel with override button, governance dashboard with contract management and audit log.

**Tasks:**
- [ ] `apps/web/` — Next.js app scaffold
- [ ] `lib/stream-store.ts` + SSE routes
- [ ] `components/IntentInput.tsx`
- [ ] `components/AgentStream.tsx`
- [ ] `components/SupplierPitchCard.tsx`
- [ ] `components/GovernancePanel.tsx`
- [ ] `components/ContractForm.tsx`
- [ ] `components/AuditLog.tsx`
- [ ] All API routes: /api/procure, /api/stream, /api/contracts, /api/override, /api/stripe-webhook
- [ ] `apps/agents/src/lib/event-bus.ts` — POSTs agent events to web SSE ingest

**Notes:**

---

## Feature 006: Database persistence

**What the user sees:**
Audit log table in the governance dashboard showing all transactions with decision, rationale, and per-rule breakdown.

**Tasks:**
- [ ] `db/migrations/001_contracts.sql`
- [ ] `db/migrations/002_transactions.sql`
- [ ] `db/migrations/003_audit_events.sql`
- [ ] `apps/agents/src/tools/db.ts` — pg pool + typed query helpers
- [ ] Write transaction + audit events on each pipeline run
- [ ] Seed default and halal-only spending contracts

**Notes:**

---

## Feature 008: Vercel AI Gateway integration

**What the user sees:**
All agent and web LLM calls route through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set. Health endpoints on agents (`/health`) and web (`/api/health`) report `llm.route: vercel-ai-gateway` for hackathon demo verification.

**Tasks:**
- [x] `apps/agents/src/lib/llm.ts` — gateway-first AI SDK `generateText`, direct fallback
- [x] `apps/agents/package.json` — `ai@^5`, `@ai-sdk/openai`, `@ai-sdk/anthropic`
- [x] `apps/agents/src/index.ts` — extended `/health` with LLM route info
- [x] `apps/agents/src/agents/supplier.ts` — `isGatewayEnabled()` model selection
- [x] `apps/web/lib/llm.ts` — `chatText`, `chatJSON`, `llmRoute`, `gatewayStatus`
- [x] Migrate `negotiate`, `user/search`, `business/chat`, `business/upload` routes
- [x] Remove `apps/web/app/lib/openai.ts`
- [x] `apps/web/app/api/health/route.ts`
- [x] `.env.example` — `AI_GATEWAY_API_KEY` documented

**Acceptance criteria:**
- `npx tsc --noEmit` → 0 errors in agents and web
- `npm run build` in web succeeds
- `curl localhost:4000/health` → `llm.route: vercel-ai-gateway` when gateway key set
- `curl localhost:3000/api/health` → same

**Notes:**
- Pin `ai@^5.0.197` — `ai@6` breaks install with Stripe toolkit peer deps
- Use `legacy-peer-deps=true` in `.npmrc` for both packages
- Gateway model strings use `provider/model` format (e.g. `openai/gpt-4o-mini`)

---

## Feature 007: AWS infrastructure + deployment

**What the user sees:**
Production app running on Vercel (web) + ECS Fargate (agents). CloudWatch dashboard showing agent invocations, accept/block ratio, p95 latency. S3 bucket with transcript JSON per transaction.

**Tasks:**
- [ ] `infra/bin/agentbid.ts`
- [ ] `infra/lib/ecs-stack.ts`
- [ ] `infra/lib/rds-stack.ts`
- [ ] `infra/lib/s3-stack.ts`
- [ ] `infra/lib/api-stack.ts`
- [ ] `apps/agents/Dockerfile`
- [ ] `docker-compose.yml`
- [ ] CDK deploy all stacks
- [ ] Vercel deploy web app

**Notes:**

---

## Feature 009: Auction mode — tender broadcast + vendor bidding agents

**What the user sees:**
Toggling "Auction" in the sidebar and submitting an intent (e.g. "affordable, comfortable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD") broadcasts a tender. Exa discovers real published prices from booking sites; vendor bidding agents (Traveloka, Skyscanner, Trip.com, Scoot, AirAsia for flights; LLM-researched profiles for any other category) compete across 2 rounds — sealed offers, then open best-and-final counter-bids with full competitor visibility. A live bid board shows each vendor's offer vs published price, value-adds, and pitch. An LLM judge ranks the bids, governance verifies the winner against the spending contract, and Stripe (sandbox) executes. Full dashboard parity with find mode: live log feed, node graph, theatre, result card.

**Tasks:**
- [x] `apps/agents/src/agents/types.ts` — TenderBroadcast, VendorAnchor, VendorBid, AuctionRound, AuctionEvaluation, AuctionOutcome, TravelDetails
- [x] `apps/agents/src/agents/vendors/flight-vendors.ts` — 5 pre-built vendor profiles (prompt-only bidding policies)
- [x] `apps/agents/src/tools/exa.ts` — `includeDomains`/livecrawl support + `exaResearchVendor`
- [x] `apps/agents/src/agents/vendors/generic-vendor.ts` — researched bidder profiles for non-flight categories
- [x] `apps/agents/src/agents/auction.ts` — tender → anchors → 2 bidding rounds → judge → WinnerPaymentIntent
- [x] `apps/agents/src/index.ts` — auction branch replaces 501 (find branch untouched)
- [x] `apps/agents/src/test-auction.ts` + `test:auction` npm script
- [x] `apps/web/lib/useAgentStream.ts` — AuctionState derivation + auction log lines
- [x] `apps/web/components/AuctionTheatre.tsx` — tender / bid board / judge / review scenes
- [x] `apps/web/app/page.tsx` + `components/Sidebar.tsx` — enable auction mode, capture mode at submit
- [x] `apps/web/app/api/procure/route.ts` — remove 501 guard, raise dispatch timeout to 180s
- [x] `apps/agents/src/test-auction-e2e.ts` — ACCEPT + BLOCK + override cases

**Acceptance criteria:**
- POST /run with `mode:"auction"` returns 200 + transactionId; both 501 guards removed
- Flight intent → discovery restricted to the 5 vendor domains; ≥2 real Exa price anchors or loud failure; unpriced vendors skipped and visible in UI
- All resolved bidders bid in both rounds; at least one round-2 counter-bid undercuts its round-1 offer; character behaviors visible (Skyscanner holds price, Scoot zero value-adds, AirAsia urgency conditions)
- Judge ranking covers all bidders; winner in-budget when satisfiable
- Governance runs all 5 rules; ACCEPT → Stripe PI succeeded; BLOCK → requires_confirmation + override works
- `transactions.full_result.mode === "auction"` with full transcript
- Find mode regression passes unchanged
- `npx tsc --noEmit` 0 errors both apps; web `npm run build` passes; `npm run test:auction` exits 0

**Notes:**
- Auction discovery must NOT use the Exa Agent API (2–3 min latency) — searchAndContents + includeDomains only
- Bidding policies are prompt-only by user decision; tests assert a sanity band (0.5×–1.2× of published price) instead of clamping
- Terminal SSE event stays `agent:complete`/`governance` so stream close + override flow work unchanged
