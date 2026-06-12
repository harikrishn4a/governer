# AgentBid — Team split

3 people, 36 hours. Work is concurrent after the first 15 minutes.

---

## Do this together first (15 min)

Create and commit `apps/agents/src/agents/types.ts` with all shared types from `CLAUDE.md`.
This is the only hard dependency. Once it's committed, all three people never need to wait for each other again.

```bash
git init agentbid && cd agentbid
mkdir -p apps/agents/src/agents apps/agents/src/tools apps/agents/src/lib
mkdir -p apps/web db/migrations infra/lib
# paste types.ts from CLAUDE.md
git add . && git commit -m "init: shared types"
```

---

## Person 1 — Agent pipeline

**Owns:** `apps/agents/`
**Goal:** A working HTTP endpoint that takes a user intent and returns a completed transaction with Stripe payment intent

### Setup
```bash
cd apps/agents
npm init -y
npm install @anthropic-ai/sdk openai @google/generative-ai exa-js stripe express pg uuid zod
npm install -D typescript ts-node nodemon @types/express @types/pg @types/uuid
```

### Build order (strict — each depends on the previous)

**Block 1 (hours 0–3): Foundation**
- [ ] `src/lib/logger.ts` — structured JSON logger (just console.log wrapping to start)
- [ ] `src/lib/llm.ts` — unified LLM wrapper (Claude first, add GPT + Gemini once Claude works)
- [ ] `src/tools/db.ts` — pg pool + typed query helper
- [ ] `src/tools/exa.ts` — `exaSearch()` and `exaGetContents()` wrappers

**Block 2 (hours 3–8): Agents**
- [ ] `src/agents/discovery.ts` — Exa → `PaymentIntent[]`
- [ ] `src/agents/supplier.ts` — parameterised pitch agent (one function, takes LLM model as arg)
- [ ] `src/agents/procurement.ts` — orchestrates discovery + parallel supplier fan-out + pick_winner
- [ ] `src/agents/governance.ts` — contract evaluation → `GovernanceDecision`

**Block 3 (hours 8–12): Stripe + server**
- [ ] `src/tools/stripe.ts` — create, confirm, cancel PaymentIntent
- [ ] Wire Stripe calls into governance agent (ACCEPT → confirm, BLOCK → hold)
- [ ] `src/lib/event-bus.ts` — POST agent events to web SSE ingest endpoint
- [ ] `src/index.ts` — Express server with `POST /run` endpoint that executes full pipeline
- [ ] Add GPT-4o and Gemini to `llm.ts` + assign per supplier index

### Test as you go
```bash
# smoke test discovery alone
curl -X POST localhost:4000/run \
  -H "Content-Type: application/json" \
  -d '{"intent": "burger near marina bay sands under $30"}'
```

### Handoff to Person 2
Once `POST /run` returns a valid response (even if ugly), tell Person 2 the shape of the JSON.
Person 2 can swap their mock data for real calls immediately.

---

## Person 2 — Web frontend

**Owns:** `apps/web/`
**Goal:** A working UI that shows the full agent pipeline live, governance decision, and audit log

### Setup
```bash
cd apps/web
npx create-next-app@14 . --typescript --app --no-tailwind
npm install stripe uuid zod
```

### Key rule: build against mock data first

Define mock constants at the top of each component file. Match the shapes from `types.ts` exactly.
When Person 1's API is ready, delete the mock and replace with a real fetch. One change.

```typescript
// at the top of any component during dev
const MOCK_PITCHES: SupplierPitch[] = [
  {
    vendorId: "uuid-1",
    vendor: "Shake Shack",
    item: "ShackBurger",
    price: 14.90,
    pitch: "The ShackBurger is the gold standard...",
    keyPoints: ["$14.90 — well under budget", "Located in MBS", "Consistently rated 4.5+"],
    fitScore: 88,
    llmUsed: "gpt-4o",
  },
  // add 2 more
]
```

### Build order

**Block 1 (hours 0–4): Core layout + stream**
- [ ] `app/layout.tsx` — minimal shell, two-column layout (left: input + stream, right: results)
- [ ] `components/IntentInput.tsx` — text input + submit, calls `POST /api/procure`, opens SSE
- [ ] `lib/stream-store.ts` — in-memory event store + subscriber registry
- [ ] `app/api/stream/route.ts` — SSE endpoint (reads from stream-store)
- [ ] `app/api/stream/ingest/route.ts` — POST endpoint for agent worker to push events
- [ ] `components/AgentStream.tsx` — renders live event timeline from SSE (use mock events first)

**Block 2 (hours 4–9): Results components**
- [ ] `components/SupplierPitchCard.tsx` — vendor name, price, LLM badge, pitch text, fitScore bar, highlight winner
- [ ] `components/GovernancePanel.tsx` — ACCEPT/BLOCK badge, per-rule checklist, override button
- [ ] `app/api/procure/route.ts` — calls agents worker `POST /run`, returns `{ transactionId }`
- [ ] `app/api/override/route.ts` — confirms held Stripe PaymentIntent

**Block 3 (hours 9–14): Governance dashboard**
- [ ] `components/ContractForm.tsx` — budget cap, period, category constraints (tag input), blocklist, risk threshold
- [ ] `components/AuditLog.tsx` — table with expand rows showing per-rule checklist
- [ ] `app/dashboard/page.tsx` — contract management + audit log
- [ ] `app/api/contracts/route.ts` — GET + POST
- [ ] `app/api/contracts/[id]/route.ts` — PATCH + DELETE

**Block 4 (hours 14–16): Wire to real API**
- [ ] Replace all mock constants with real fetches to Person 1's agent worker
- [ ] Test full flow end-to-end locally

### Agent event colours (keep consistent with CLAUDE.md)
```typescript
const AGENT_COLOURS: Record<string, string> = {
  procurement: "#7F77DD",   // purple
  discovery:   "#378ADD",   // blue
  supplier_a:  "#EF9F27",   // amber
  supplier_b:  "#D85A30",   // coral
  supplier_c:  "#BA7517",   // darker amber
  governance:  "#1D9E75",   // teal
}
```

---

## Person 3 — Infra, DB, and integration

**Owns:** `infra/` + `db/` + `docker-compose.yml` + deployment pipeline
**Goal:** Local environment running within the first hour, production deployed by hour 30

### Block 1 (hours 0–2): Local environment
- [ ] `docker-compose.yml` — postgres:15 on port 5432
- [ ] `db/migrations/001_contracts.sql`
- [ ] `db/migrations/002_transactions.sql`
- [ ] `db/migrations/003_audit_events.sql`
- [ ] Run migrations, verify tables exist
- [ ] Seed one permissive contract + one strict halal contract for demo

```bash
docker-compose up -d
psql postgresql://agentbid:agentbid@localhost:5432/agentbid \
  -f db/migrations/001_contracts.sql \
  -f db/migrations/002_transactions.sql \
  -f db/migrations/003_audit_events.sql
```

Seed SQL:
```sql
INSERT INTO spending_contracts
  (name, budget_cap, budget_period, risk_threshold, active)
VALUES
  ('Default contract', 100.00, 'per_transaction', 'low', true),
  ('Halal only — strict', 50.00, 'per_transaction', 'strict', false);

UPDATE spending_contracts
SET category_constraints = ARRAY['halal certified restaurants only']
WHERE name = 'Halal only — strict';
```

### Block 2 (hours 2–8): CDK infra
- [ ] `infra/bin/agentbid.ts` — CDK app entry
- [ ] `infra/lib/rds-stack.ts` — Aurora Serverless v2, PostgreSQL 15, private subnet
- [ ] `infra/lib/ecs-stack.ts` — Fargate service, ECR repo, IAM role
- [ ] `infra/lib/s3-stack.ts` — transcript bucket, 90-day lifecycle
- [ ] `infra/lib/api-stack.ts` — API Gateway + two Lambdas (stripe-webhook, override)
- [ ] `apps/agents/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Block 3 (hours 8–14): Stripe webhook Lambda
```typescript
// infra lambda handler — verifies signature, updates DB
export const handler = async (event: APIGatewayProxyEvent) => {
  const sig = event.headers['stripe-signature']!;
  const webhookEvent = stripe.webhooks.constructEvent(
    event.body!, sig, process.env.STRIPE_WEBHOOK_SECRET!
  );
  if (webhookEvent.type === 'payment_intent.succeeded') {
    const pi = webhookEvent.data.object as Stripe.PaymentIntent;
    await db.query(
      `UPDATE transactions SET stripe_status = 'succeeded' 
       WHERE stripe_payment_intent_id = $1`, [pi.id]
    );
  }
  return { statusCode: 200, body: 'ok' };
};
```

### Block 4 (hours 24–30): Production deploy

```bash
# Build and push Docker image
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker build -t agentbid-agents apps/agents/
docker tag agentbid-agents:latest $ECR_URI/agentbid-agents:latest
docker push $ECR_URI/agentbid-agents:latest

# Deploy CDK stacks (in order — RDS must exist before ECS)
cd infra
cdk deploy RdsStack
cdk deploy S3Stack
cdk deploy EcsStack
cdk deploy ApiStack

# Deploy web
cd apps/web
vercel --prod
```

### Block 5 (hours 30–34): Integration owner
Once both Person 1 and Person 2 say they're done locally, you own making it work end-to-end on prod:
- [ ] Verify `POST /api/procure` on Vercel hits ECS agent worker
- [ ] Verify SSE stream reaches browser
- [ ] Verify Stripe charge fires and appears in test dashboard
- [ ] Verify governance BLOCK holds the PaymentIntent
- [ ] Verify override button confirms the held intent
- [ ] Verify audit log populates in DB
- [ ] Set up CloudWatch dashboard (agent invocations, accept/block count, latency)

---

## Sync points

| Time | What |
|------|------|
| Hour 0 | `types.ts` committed — everyone unblocked |
| Hour 4 | Person 1: discovery agent working. Person 2: AgentStream rendering mock events. Person 3: local DB running. Quick 10-min standup. |
| Hour 10 | Person 1: full pipeline working locally. Person 2: all components built with mock data. Swap to real API. |
| Hour 16 | Person 3: CDK stacks deployed. Full flow tested on prod URLs. |
| Hour 24 | Feature freeze. Person 3 takes over integration. Persons 1+2 fix bugs only. |
| Hour 30 | Demo rehearsal. All three people. Run both demo beats twice. |
| Hour 34 | Final freeze. Set up demo browser tabs. Sleep. |

---

## If something breaks at hour 30

Priority order for cuts:
1. **Drop Gemini** — two supplier agents (Claude + GPT-4o) is still compelling
2. **Drop CloudWatch dashboard** — judges care more about the product than the monitoring
3. **Drop audit log** — show DB records in a psql terminal instead
4. **Drop CDK** — manual ECS deploy via console is fine, still counts as AWS infra
5. **Never cut:** Exa search, Stripe charges, governance BLOCK flow, live agent event stream

These five things are the demo. Everything else is polish.