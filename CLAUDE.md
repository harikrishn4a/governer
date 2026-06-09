# AgentBid — CLAUDE.md
> Canonical build reference for Claude Code. Every architectural, stack, and implementation decision is documented here. Do not deviate from these decisions without explicit instruction.

---

## Project overview

AgentBid is a multi-agent agentic procurement system. A user expresses a purchase intent in natural language. A pipeline of AI agents discovers options, runs an adversarial supplier pitch competition, makes a procurement decision, enforces spending governance contracts, and executes a Stripe payment in sandbox mode.

**Target event:** NEXT Hackathon @ SuperAI Singapore (36-hour build, June 9–11 2025)
**Prize targets:** Top 5 Overall + Best Use of Exa + Best Use of Stripe

---

## Repository structure

```
agentbid/
├── CLAUDE.md                  # this file
├── apps/
│   ├── web/                   # Next.js frontend (Vercel)
│   │   ├── app/
│   │   │   ├── page.tsx               # main procurement UI
│   │   │   ├── dashboard/page.tsx     # governance dashboard
│   │   │   ├── api/
│   │   │   │   ├── procure/route.ts   # POST /api/procure — starts workflow
│   │   │   │   ├── stream/route.ts    # GET /api/stream — SSE agent events
│   │   │   │   ├── contracts/route.ts # CRUD spending contracts
│   │   │   │   ├── override/route.ts  # POST /api/override — human review
│   │   │   │   └── stripe-webhook/route.ts
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── IntentInput.tsx
│   │   │   ├── AgentStream.tsx        # live SSE event display
│   │   │   ├── SupplierPitchCard.tsx
│   │   │   ├── GovernancePanel.tsx
│   │   │   ├── ContractForm.tsx
│   │   │   └── AuditLog.tsx
│   │   └── lib/
│   │       ├── stream-store.ts        # in-memory SSE event bus
│   │       └── stripe.ts              # Stripe client singleton
│   └── agents/                # Node.js agent workers (Docker → ECS Fargate)
│       ├── src/
│       │   ├── index.ts               # Express server, receives workflow jobs
│       │   ├── agents/
│       │   │   ├── procurement.ts     # main orchestrator agent
│       │   │   ├── discovery.ts       # Exa search + payment intent builder
│       │   │   ├── supplier.ts        # supplier pitch agent (parameterised)
│       │   │   ├── governance.ts      # contract enforcement agent
│       │   │   └── types.ts           # shared types across all agents
│       │   ├── tools/
│       │   │   ├── exa.ts             # Exa search + getContents wrappers
│       │   │   ├── stripe.ts          # PaymentIntent create/confirm/cancel
│       │   │   └── db.ts              # RDS query helpers
│       │   └── lib/
│       │       ├── event-bus.ts       # publishes agent events to SSE store
│       │       ├── llm.ts             # unified LLM call wrapper (Claude/GPT/Gemini)
│       │       └── logger.ts          # CloudWatch-compatible structured logger
│       ├── Dockerfile
│       └── package.json
├── infra/                     # AWS CDK (TypeScript)
│   ├── bin/agentbid.ts
│   └── lib/
│       ├── ecs-stack.ts           # Fargate service + ECR repo
│       ├── rds-stack.ts           # Aurora Serverless v2
│       ├── api-stack.ts           # API Gateway + Lambda (webhook + override)
│       └── s3-stack.ts            # transcript bucket
├── db/
│   └── migrations/
│       ├── 001_contracts.sql
│       ├── 002_transactions.sql
│       └── 003_audit_events.sql
└── docker-compose.yml         # local dev: postgres + agents + web
```

---

## Environment variables

### Web app (`apps/web/.env.local`)
```
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Internal
AGENTS_BASE_URL=http://localhost:4000          # local dev / ECS URL in prod
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Agents (`apps/agents/.env`)
```
# LLM keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Exa
EXA_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_test_...

# DB
DATABASE_URL=postgresql://...

# Internal
PORT=4000
SSE_ENDPOINT=http://localhost:3000/api/stream   # web SSE ingestion endpoint
```

---

## Agent architecture

### Message flow (strict order, no skipping)

```
User intent
  → POST /api/procure
    → Procurement agent (Claude Sonnet 4.5)
      → Discovery agent (Claude Sonnet 4.5)
        → Exa search + getContents
        → returns PaymentIntent[] (3–5 options)
      ← PaymentIntent[] returned to Procurement
      → Procurement broadcasts to Supplier agents (parallel fan-out)
        → Supplier A agent (GPT-4o)     — returns SupplierPitch
        → Supplier B agent (Claude)     — returns SupplierPitch
        → Supplier C agent (Gemini Flash) — returns SupplierPitch
      ← SupplierPitch[] collected
      → Procurement evaluates pitches, calls pick_winner tool
      → generates WinnerPaymentIntent
      → Governance agent (Claude Sonnet 4.5)
        → evaluates WinnerPaymentIntent against active SpendingContract
        → returns GovernanceDecision { decision: ACCEPT | BLOCK, rationale }
        → if ACCEPT: calls stripe.paymentIntents.create() + confirm()
        → if BLOCK:  calls stripe.paymentIntents.create() (uncaptured), stores for human review
      → writes AuditEvent to DB
    ← final result returned to web
```

### Agent communication pattern

Agents are **not** microservices calling each other directly. The Procurement agent is the single orchestrator. It calls Discovery, then calls each Supplier agent, then calls Governance — all as awaited async function calls within a single workflow execution in the agents worker. This keeps the demo deterministic and observable.

Each agent function emits SSE events to the web via `event-bus.ts` at key moments:
- `agent:start` — agent begins reasoning
- `agent:thinking` — intermediate reasoning step (stream partial text if available)
- `agent:tool_call` — tool invoked (show tool name + truncated args)
- `agent:tool_result` — tool returned (show summary)
- `agent:complete` — agent finished, emit final output

---

## Core types (`apps/agents/src/agents/types.ts`)

```typescript
export interface UserIntent {
  raw: string;                    // "find me a burger near MBS under $30"
  category?: string;              // inferred by procurement agent
  location?: string;
  budget?: number;
  currency?: string;
  constraints?: string[];         // ["halal", "vegetarian", etc.]
}

export interface PaymentIntent {
  id: string;                     // uuid generated by discovery agent
  vendor: string;
  item: string;
  description: string;
  price: number;
  currency: string;               // always "SGD" for demo
  link: string;                   // source URL from Exa
  imageUrl?: string;
  metadata: Record<string, string>;
}

export interface SupplierPitch {
  vendorId: string;               // matches PaymentIntent.id
  vendor: string;
  item: string;
  price: number;
  pitch: string;                  // the agent's advocacy argument
  keyPoints: string[];            // bullet summary for UI
  fitScore: number;               // 0–100, self-reported by supplier agent
  llmUsed: string;                // "gpt-4o" | "claude-sonnet-4-5" | "gemini-1.5-flash"
}

export interface WinnerPaymentIntent extends PaymentIntent {
  procurementRationale: string;   // why this was selected
  rankedAlternatives: PaymentIntent[];
}

export interface SpendingContract {
  id: string;
  name: string;
  budgetCap: number;
  budgetPeriod: "per_transaction" | "daily" | "weekly" | "monthly";
  categoryConstraints: string[];  // free text, e.g. "halal only", "sustainably sourced"
  vendorBlocklist: string[];
  vendorAllowlist: string[];      // empty = allow all (minus blocklist)
  riskThreshold: "low" | "medium" | "strict";
  active: boolean;
  createdAt: string;
}

export interface GovernanceDecision {
  decision: "ACCEPT" | "BLOCK";
  rationale: string;              // human-readable, stored in audit log
  contractId: string;
  checkedRules: Array<{
    rule: string;
    passed: boolean;
    detail: string;
  }>;
  stripePaymentIntentId?: string; // set after Stripe call
}

export interface AuditEvent {
  id: string;
  contractId: string;
  transactionId: string;
  userIntent: string;
  vendor: string;
  item: string;
  price: number;
  decision: "ACCEPT" | "BLOCK";
  rationale: string;
  requiresHumanReview: boolean;
  overriddenBy?: string;          // set if human approved a blocked tx
  stripePaymentIntentId?: string;
  createdAt: string;
}
```

---

## Agent implementations

### 1. Discovery agent (`apps/agents/src/agents/discovery.ts`)

**Model:** Claude Sonnet 4.5 (`claude-sonnet-4-5`)
**Purpose:** Takes user intent, augments it into an Exa query, retrieves results, returns structured `PaymentIntent[]`

**System prompt:**
```
You are a procurement discovery agent. Your job is to find real purchasing options that match a user's intent.

Given a user intent, you will:
1. Call the exa_search tool with an optimised search query
2. Call exa_get_contents on the top results to extract product details
3. Return a structured list of PaymentIntent objects

Always extract: vendor name, item name, price (in SGD), and the source URL.
If price is not found, estimate based on context clues or exclude the item.
Return exactly 3–5 options. Prefer options with clear pricing.
```

**Tools available:**
- `exa_search(query: string, numResults: number)` → raw Exa results
- `exa_get_contents(urls: string[])` → full page content

**Output:** `PaymentIntent[]` as structured JSON (use `tool_choice: {type: "tool"}` with a `return_results` tool to force structured output)

**Exa usage pattern:**
```typescript
// In tools/exa.ts
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);

export async function exaSearch(query: string, numResults = 5) {
  return exa.search(query, {
    numResults,
    type: "neural",
    useAutoprompt: true,
    category: "company",  // for food/product queries
  });
}

export async function exaGetContents(urls: string[]) {
  return exa.getContents(urls, {
    text: { maxCharacters: 1000 },
    highlights: { numSentences: 3, highlightsPerUrl: 2 },
  });
}
```

---

### 2. Supplier agent (`apps/agents/src/agents/supplier.ts`)

**Purpose:** Receives a single `PaymentIntent` + user intent + tender constraints. Advocates why this product best satisfies the tender. Each instance uses a different LLM.

**LLM assignment (hardcoded for demo, index-based):**
```typescript
const SUPPLIER_LLMS = [
  { id: "gpt-4o",              label: "GPT-4o" },
  { id: "claude-sonnet-4-5",   label: "Claude Sonnet" },
  { id: "gemini-1.5-flash",    label: "Gemini Flash" },
];
// supplier index 0,1,2 → SUPPLIER_LLMS[index]
```

**System prompt (parameterised):**
```
You are the exclusive sales agent for {{vendor}}. You are competing in a procurement tender.

The buyer's intent: "{{userIntent}}"
The buyer's constraints: {{constraints}}
The tender budget: {{budget}} SGD

Your product:
- Item: {{item}}
- Price: {{price}} SGD
- Details: {{description}}

Make the strongest possible case that your product is the best fit for this buyer.
Be specific. Cite price value, quality, location convenience, and fit to constraints.
Be persuasive but factual. Keep your pitch under 200 words.

Return a JSON object with:
- pitch: string (your full argument)
- keyPoints: string[] (3 bullet points)
- fitScore: number (0-100, your honest self-assessment of fit)
```

**Implementation note:** All three supplier agents run in `Promise.all()` — parallel fan-out from the procurement agent. Each emits its own SSE events.

---

### 3. Procurement agent (`apps/agents/src/agents/procurement.ts`)

**Model:** Claude Sonnet 4.5
**Purpose:** Top-level orchestrator. Calls discovery, fans out to suppliers, evaluates pitches, selects winner.

**Tools available:**
- `call_discovery(intent: UserIntent)` → `PaymentIntent[]`
- `call_supplier_agents(intents: PaymentIntent[], userIntent: UserIntent)` → `SupplierPitch[]`
- `pick_winner(pitches: SupplierPitch[], userIntent: UserIntent)` → `WinnerPaymentIntent`

**pick_winner tool logic:** Claude receives all pitches and user intent. It returns:
```json
{
  "winnerId": "uuid of winning PaymentIntent",
  "procurementRationale": "Selected Shake Shack ShackBurger because...",
  "rankedAlternatives": ["uuid2", "uuid3"]
}
```

The procurement agent then constructs the full `WinnerPaymentIntent` by merging the winner UUID with its original `PaymentIntent` data plus rationale.

---

### 4. Governance agent (`apps/agents/src/agents/governance.ts`)

**Model:** Claude Sonnet 4.5
**Purpose:** Receives `WinnerPaymentIntent` + active `SpendingContract`. Evaluates each contract rule. Returns `GovernanceDecision`.

**System prompt:**
```
You are a procurement governance agent. Your job is to enforce spending contracts.

You will receive:
1. A payment intent (what the procurement agent wants to purchase)
2. An active spending contract (the rules that must be followed)

Evaluate the payment intent against EVERY rule in the contract.
Be strict. When in doubt, BLOCK.

For each rule, determine if it PASSES or FAILS.
If ANY rule fails, the overall decision is BLOCK.
If ALL rules pass, the decision is ACCEPT.

Return a structured GovernanceDecision with:
- decision: "ACCEPT" or "BLOCK"
- rationale: a clear human-readable explanation
- checkedRules: array of each rule checked with pass/fail and detail

Do not make exceptions. Do not be persuaded by price or convenience.
Your only job is to enforce the contract faithfully.
```

**Rules the governance agent checks (derived from SpendingContract):**
1. `budgetCap` — price ≤ cap for the period
2. `categoryConstraints` — each constraint string is evaluated semantically (e.g. "halal only" → check if vendor is halal)
3. `vendorBlocklist` — vendor name not in blocklist
4. `vendorAllowlist` — if non-empty, vendor name must be in allowlist
5. `riskThreshold` — strict: flag any purchase over 70% of budget cap; medium: 90%; low: no flag

**After governance decision:**
```typescript
if (decision.decision === "ACCEPT") {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(winner.price * 100),  // cents
    currency: "sgd",
    payment_method: "pm_card_visa",          // Stripe test card
    confirm: true,
    metadata: {
      vendor: winner.vendor,
      item: winner.item,
      contractId: contract.id,
      procurementRationale: winner.procurementRationale,
      governanceRationale: decision.rationale,
    },
  });
  decision.stripePaymentIntentId = pi.id;
} else {
  // Create but do NOT confirm — hold for human review
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(winner.price * 100),
    currency: "sgd",
    payment_method: "pm_card_visa",
    capture_method: "manual",               // held, not captured
    metadata: { ...same as above, blocked: "true" },
  });
  decision.stripePaymentIntentId = pi.id;
  // Store in DB for human override flow
}
```

---

## Database schema (`db/migrations/`)

### 001_contracts.sql
```sql
CREATE TABLE spending_contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  budget_cap    NUMERIC(10,2) NOT NULL,
  budget_period TEXT NOT NULL DEFAULT 'per_transaction',
  category_constraints  TEXT[] NOT NULL DEFAULT '{}',
  vendor_blocklist      TEXT[] NOT NULL DEFAULT '{}',
  vendor_allowlist      TEXT[] NOT NULL DEFAULT '{}',
  risk_threshold        TEXT NOT NULL DEFAULT 'medium',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default permissive contract for demo
INSERT INTO spending_contracts (name, budget_cap, budget_period, risk_threshold)
VALUES ('Default contract', 100.00, 'per_transaction', 'low');
```

### 002_transactions.sql
```sql
CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_intent             TEXT NOT NULL,
  winner_vendor           TEXT NOT NULL,
  winner_item             TEXT NOT NULL,
  winner_price            NUMERIC(10,2) NOT NULL,
  payment_intents_json    JSONB NOT NULL,   -- full PaymentIntent[] from discovery
  supplier_pitches_json   JSONB NOT NULL,   -- full SupplierPitch[]
  winner_json             JSONB NOT NULL,   -- WinnerPaymentIntent
  governance_decision     TEXT NOT NULL,    -- ACCEPT | BLOCK
  stripe_payment_intent_id TEXT,
  requires_human_review   BOOLEAN NOT NULL DEFAULT false,
  overridden_by           TEXT,             -- name/id of human who approved
  overridden_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 003_audit_events.sql
```sql
CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(id),
  contract_id     UUID REFERENCES spending_contracts(id),
  event_type      TEXT NOT NULL,  -- ACCEPT | BLOCK | OVERRIDE | CONTRACT_CREATED
  detail          TEXT NOT NULL,
  actor           TEXT NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_contract ON audit_events(contract_id);
CREATE INDEX idx_audit_transaction ON audit_events(transaction_id);
```

---

## API routes

### POST `/api/procure`
```typescript
// Body: { intent: string }
// Starts the full agent pipeline
// Returns: { transactionId: string } immediately
// Full results streamed via SSE on /api/stream?txId=...
```

### GET `/api/stream?txId=xxx`
```typescript
// Server-Sent Events
// Emits AgentEvent objects as they arrive from agent worker
// Event shape: { type: string, agent: string, data: any, timestamp: string }
// Client reads these to animate the live agent display
```

### POST `/api/override`
```typescript
// Body: { transactionId: string, approvedBy: string }
// Calls stripe.paymentIntents.confirm(pi_id) on the held intent
// Updates transaction: overridden_by, overridden_at
// Inserts audit_event with event_type: OVERRIDE
```

### GET `/api/contracts`
### POST `/api/contracts`
### PATCH `/api/contracts/:id`
### DELETE `/api/contracts/:id`
```typescript
// Standard CRUD for SpendingContract
// PATCH active=false to deactivate (never hard delete for audit trail)
```

### POST `/api/stripe-webhook`
```typescript
// Verifies Stripe signature
// Handles: payment_intent.succeeded, payment_intent.payment_failed
// Updates transaction record accordingly
```

---

## Frontend components

### IntentInput (`components/IntentInput.tsx`)
- Single large text input + submit button
- On submit: POST /api/procure, get transactionId, open SSE stream
- Show spinner while agents are running

### AgentStream (`components/AgentStream.tsx`)
- Connects to `/api/stream?txId=...` via `EventSource`
- Renders a vertical timeline of agent events
- Each event shows: agent name (color-coded), event type, truncated data
- Animate new events sliding in from top
- Agent colors: Procurement=purple, Discovery=blue, Supplier A=orange, Supplier B=coral, Supplier C=amber, Governance=teal

### SupplierPitchCard (`components/SupplierPitchCard.tsx`)
- Receives `SupplierPitch`
- Shows: vendor name, item, price, LLM badge, pitch text, key points, fitScore bar
- Highlight winning card with a border after procurement decision

### GovernancePanel (`components/GovernancePanel.tsx`)
- Shows `GovernanceDecision` with ACCEPT (green) or BLOCK (red) badge
- Expands to show `checkedRules` with pass/fail per rule
- If BLOCK: shows human override button → calls `/api/override`

### ContractForm (`components/ContractForm.tsx`)
- Fields: name, budgetCap (number), budgetPeriod (select), categoryConstraints (tag input), vendorBlocklist (tag input), vendorAllowlist (tag input), riskThreshold (select), active (toggle)
- `categoryConstraints` is free-text tag input — user types anything
- Saves via POST/PATCH `/api/contracts`

### AuditLog (`components/AuditLog.tsx`)
- Table: date, vendor, item, price, decision, rationale, contract name
- Filter by contract, decision type
- Expandable rows showing full checkedRules

---

## LLM wrapper (`apps/agents/src/lib/llm.ts`)

Unified interface so agents don't care which LLM they use:

```typescript
interface LLMCallOptions {
  model: string;           // "claude-sonnet-4-5" | "gpt-4o" | "gemini-1.5-flash"
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools?: Tool[];
  tool_choice?: any;
  temperature?: number;
}

export async function llmCall(opts: LLMCallOptions): Promise<string> {
  if (opts.model.startsWith("claude")) {
    // Use @anthropic-ai/sdk
  } else if (opts.model.startsWith("gpt")) {
    // Use openai sdk
  } else if (opts.model.startsWith("gemini")) {
    // Use @google/generative-ai sdk
  }
}
```

**Claude calls:** Use `@anthropic-ai/sdk`. Model string: `claude-sonnet-4-5`.
**GPT calls:** Use `openai` npm package. Model string: `gpt-4o`.
**Gemini calls:** Use `@google/generative-ai`. Model string: `gemini-1.5-flash`.

For structured JSON output from all models: append to system prompt `"Return ONLY valid JSON. No markdown fences. No preamble."` and parse with `JSON.parse()` wrapped in try/catch. If parse fails, retry once with an error correction prompt.

---

## Stripe integration decisions

- Use **Stripe test mode** throughout. Never real money.
- Test card for all charges: `pm_card_visa` (Stripe built-in test payment method)
- Currency: `sgd` (Singapore dollars), amounts in cents
- On ACCEPT: `create` + `confirm` in one call (`confirm: true`)
- On BLOCK: `create` with `capture_method: "manual"`, do NOT confirm. Store `pi.id`.
- Human override: `stripe.paymentIntents.confirm(piId)` from `/api/override`
- Webhook: listen for `payment_intent.succeeded` to confirm Stripe-side success in DB
- Show Stripe dashboard (test mode) during demo to prove real charges firing

---

## Exa integration decisions

- Use `exa-js` npm package
- Search type: `"neural"` with `useAutoprompt: true`
- Always call `getContents` after `search` — raw search results lack price data
- `maxCharacters: 1000` per page to stay within context limits
- For food queries add `category: "company"` to bias toward restaurant/vendor pages
- Discovery agent must emit the raw Exa URLs as SSE events (show the source links in UI)

---

## AWS infrastructure decisions

All infra defined in `infra/` using **AWS CDK v2 (TypeScript)**.

### ECS Fargate (`infra/lib/ecs-stack.ts`)
- Single Fargate service running `apps/agents` Docker image
- CPU: 1024, Memory: 2048
- Port: 4000
- IAM role with permissions: RDS connect, S3 put, CloudWatch logs
- ECR repo: `agentbid-agents`
- Deploy command: `cdk deploy EcsStack`

### Aurora Serverless v2 (`infra/lib/rds-stack.ts`)
- PostgreSQL 15 compatible
- Min ACU: 0.5, Max ACU: 4 (scales to zero when idle — cost-efficient for hackathon)
- VPC: default VPC, private subnets
- Security group: allow port 5432 from ECS security group + bastion (for migrations)

### Lambda + API Gateway (`infra/lib/api-stack.ts`)
- **Stripe webhook handler** Lambda — verifies signature, updates DB
- **Human override handler** Lambda — confirms held Stripe PaymentIntent
- Both Lambdas connect to RDS via same DATABASE_URL env var
- API Gateway HTTP API routes to both

### S3 (`infra/lib/s3-stack.ts`)
- Bucket: `agentbid-transcripts-{accountId}`
- Lifecycle: expire objects after 90 days
- On each transaction complete: upload full JSON transcript (all agent messages, pitches, decisions) as `transcripts/{transactionId}.json`
- This is the evidence trail — show the S3 console during demo

### CloudWatch
- Log group: `/agentbid/agents`
- Structured JSON logs from `logger.ts`
- Dashboard with widgets: agent invocations, transaction count, accept/block ratio, p95 latency
- Show CloudWatch dashboard on stage as proof of AWS infra

---

## Vercel deployment decisions

- **Framework:** Next.js 14 App Router
- **Vercel product:** AI SDK Workflows (use `@vercel/ai` SDK for streaming the agent event pipeline to the frontend)
- Deploy: `vercel --prod` from `apps/web/`
- Environment variables set in Vercel dashboard
- `AGENTS_BASE_URL` = public ECS ALB URL in production
- Edge runtime: **do not use** for `/api/procure` or `/api/stream` — these need Node.js runtime for SSE and long-running connections
- Use `export const runtime = "nodejs"` in those route files

---

## SSE event bus pattern

The agent worker (ECS) cannot push directly to browser clients. Pattern:

1. Agent worker POSTs events to `POST {WEB_URL}/api/stream/ingest` (internal endpoint, IP-restricted)
2. Web app maintains an in-memory event store per `transactionId` (`lib/stream-store.ts`)
3. Browser connects to `GET /api/stream?txId=xxx` which reads from the store and streams

For the hackathon, `stream-store.ts` is a simple `Map<string, AgentEvent[]>` with a callback registry. Production would use Redis pub/sub, but in-memory is fine for the demo.

```typescript
// lib/stream-store.ts
type Listener = (event: AgentEvent) => void;
const store = new Map<string, AgentEvent[]>();
const listeners = new Map<string, Set<Listener>>();

export function emit(txId: string, event: AgentEvent) {
  if (!store.has(txId)) store.set(txId, []);
  store.get(txId)!.push(event);
  listeners.get(txId)?.forEach(fn => fn(event));
}

export function subscribe(txId: string, fn: Listener) {
  if (!listeners.has(txId)) listeners.set(txId, new Set());
  listeners.get(txId)!.add(fn);
  return () => listeners.get(txId)?.delete(fn);  // unsubscribe
}
```

---

## Local development

```bash
# 1. Start postgres
docker-compose up -d postgres

# 2. Run migrations
cd db && psql $DATABASE_URL -f migrations/001_contracts.sql
cd db && psql $DATABASE_URL -f migrations/002_transactions.sql
cd db && psql $DATABASE_URL -f migrations/003_audit_events.sql

# 3. Start agent worker
cd apps/agents && npm run dev   # nodemon on port 4000

# 4. Start web
cd apps/web && npm run dev      # Next.js on port 3000

# 5. Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

### docker-compose.yml (dev only)
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: agentbid
      POSTGRES_USER: agentbid
      POSTGRES_PASSWORD: agentbid
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

---

## Demo script (rehearsed sequence for live stage)

### Setup before going on stage
- Browser tab 1: AgentBid web app (localhost or Vercel URL)
- Browser tab 2: Stripe test dashboard → Payment Intents
- Browser tab 3: CloudWatch dashboard
- Browser tab 4: S3 bucket (transcripts)
- Active spending contract: "Demo contract" — budget $50, no constraints

### Demo flow

**Beat 1 — Happy path**
1. Type: `"find me a good burger near Marina Bay Sands under $30"`
2. Show agent event stream animating live — discovery fires Exa, 3 supplier pitches appear
3. Procurement picks winner, governance ACCEPTS
4. Switch to Stripe dashboard — show `payment_intent.succeeded` in real time
5. Switch to S3 — show transcript JSON uploaded

**Beat 2 — Governance BLOCK**
1. Edit "Demo contract" → add category constraint: `"halal certified restaurants only"`
2. Repeat same query
3. Show governance agent checking the halal rule → BLOCK
4. Show BLOCK banner in UI with rationale
5. Show Stripe dashboard — PaymentIntent created but NOT confirmed (status: `requires_confirmation`)
6. Click "Override and approve" → show it confirm in Stripe

**Beat 3 — Show audit log**
1. Navigate to governance dashboard
2. Show two transactions: one ACCEPT, one BLOCK→OVERRIDE
3. Expand rows to show per-rule checklist

---

## Error handling rules

- **Exa returns no results:** Discovery agent returns empty array. Procurement agent emits SSE event `{ type: "error", agent: "discovery", data: "No results found for this query. Try a broader search." }` and terminates gracefully. UI shows error state.
- **LLM call fails:** Retry once with exponential backoff (500ms, then 1500ms). If second attempt fails, emit error event and skip that agent (supplier agents: skip that supplier, continue with others; procurement/governance: fail the transaction).
- **Stripe call fails:** Catch error, set `stripePaymentIntentId: null`, emit error event. Transaction is still recorded in DB with `stripe_payment_intent_id = NULL`. UI shows "Payment pending — Stripe error" state.
- **Governance agent returns unparseable JSON:** Treat as BLOCK with rationale "Governance check inconclusive — transaction blocked for safety". Never auto-accept on governance failure.
- **All supplier agents fail:** Procurement agent falls back to selecting winner directly from `PaymentIntent[]` using its own judgment (no pitch data). Still goes to governance.
- **Database connection failure:** Log to CloudWatch. Return 500 to web. Do not execute Stripe charge if DB write will fail — we need the audit trail.

---

## Package dependencies

### `apps/agents/package.json`
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.67.0",
    "@google/generative-ai": "^0.21.0",
    "exa-js": "^1.4.0",
    "stripe": "^17.3.0",
    "express": "^4.21.0",
    "pg": "^8.13.0",
    "uuid": "^10.0.0",
    "zod": "^3.23.0"
  }
}
```

### `apps/web/package.json`
```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@vercel/ai": "^3.4.0",
    "stripe": "^17.3.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0",
    "uuid": "^10.0.0"
  }
}
```

---

## Build order for 36-hour sprint

### Hour 0–4: Scaffold + infra
- [ ] Monorepo structure, all package.jsons, tsconfigs
- [ ] docker-compose + DB migrations + seed contract
- [ ] ECS Dockerfile for agents worker
- [ ] `llm.ts` wrapper (Claude only first, add GPT/Gemini later)

### Hour 4–10: Core agent pipeline
- [ ] `types.ts` — all shared types
- [ ] `exa.ts` tool wrappers
- [ ] `discovery.ts` agent (Exa → PaymentIntent[])
- [ ] `supplier.ts` agent (pitch generation, Claude first)
- [ ] `procurement.ts` orchestrator (calls discovery + suppliers)
- [ ] Test full pipeline end-to-end with `console.log`

### Hour 10–16: Governance + Stripe
- [ ] `governance.ts` agent (contract evaluation)
- [ ] `stripe.ts` tool wrappers (create, confirm, cancel)
- [ ] ACCEPT/BLOCK flow with Stripe
- [ ] DB writes for transactions + audit_events
- [ ] Add GPT-4o and Gemini to `llm.ts` + supplier agent assignment

### Hour 16–24: Web + SSE
- [ ] `stream-store.ts` + SSE route `/api/stream`
- [ ] `event-bus.ts` in agents worker (POST events to web)
- [ ] `AgentStream.tsx` — live animated event display
- [ ] `SupplierPitchCard.tsx` — pitch cards
- [ ] `GovernancePanel.tsx` — accept/block display + override button
- [ ] `IntentInput.tsx` — main entry point
- [ ] `/api/procure` route wiring it all together

### Hour 24–30: Governance dashboard + polish
- [ ] `ContractForm.tsx` — create/edit contracts
- [ ] `AuditLog.tsx` — transaction history table
- [ ] `/api/contracts` CRUD routes
- [ ] `/api/override` route
- [ ] Error states in UI

### Hour 30–34: AWS deploy
- [ ] CDK deploy EcsStack + RdsStack
- [ ] Push Docker image to ECR, deploy to Fargate
- [ ] Set production env vars in ECS + Vercel
- [ ] Verify end-to-end on prod URLs

### Hour 34–36: Demo prep
- [ ] Rehearse both demo beats (happy path + governance block)
- [ ] Seed two spending contracts (permissive + halal)
- [ ] Set up browser tabs
- [ ] Verify Stripe dashboard visible
- [ ] Verify CloudWatch dashboard visible
- [ ] S3 bucket accessible

---

## What NOT to build (scope cuts)

- No user authentication (hardcode a single user for demo)
- No real payment methods (Stripe test cards only)
- No multi-user contract isolation
- No rate limiting
- No email notifications
- No mobile responsive design (desktop demo only)
- No supplier agent API (suppliers are simulated, not real integrations)
- No real Grab/food platform integrations (Exa finds real links but we don't deep-link)