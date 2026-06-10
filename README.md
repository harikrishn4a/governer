# AgentBid

Multi-agent procurement system: express a purchase intent in natural language, discover options with Exa, run supplier pitches and negotiation, enforce spending contracts, and execute Stripe sandbox payments.

**Stack:** Next.js (`apps/web`) · Express agents (`apps/agents`) · PostgreSQL · Stripe test mode

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Postgres)
- API keys:
  - [Exa](https://dashboard.exa.ai/)
  - [OpenAI](https://platform.openai.com/api-keys) (or Anthropic)
  - [Stripe test mode](https://dashboard.stripe.com/test/apikeys)

---

## Quick start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd governer

npm install --prefix apps/agents
npm install --prefix apps/web
```

### 2. Environment variables

Create `governer/.env` at the repo root (both apps load this file):

```env
# Discovery
EXA_API_KEY=your_exa_api_key

# LLM — Vercel AI Gateway (preferred; routes all agent LLM calls)
AI_GATEWAY_API_KEY=vck_...

# Direct provider keys (fallback when AI_GATEWAY_API_KEY is unset)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=

# Database — port 5433 avoids conflict with Postgres.app on macOS (5432)
DATABASE_URL=postgresql://agentbid:agentbid@localhost:5433/agentbid

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Agents server
PORT=4000

# Web app
AGENTS_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Do not commit `.env`** — it is gitignored.

### 3. Start Docker Postgres

```bash
docker compose up -d postgres
docker compose ps   # should show healthy on 0.0.0.0:5433
```

### 4. Run database migrations

```bash
docker compose exec -T postgres psql -U agentbid -d agentbid < db/migrations/001_contracts.sql
docker compose exec -T postgres psql -U agentbid -d agentbid < db/migrations/002_transactions.sql
docker compose exec -T postgres psql -U agentbid -d agentbid < db/migrations/003_audit_events.sql
```

This seeds a **Default contract**. Create more contracts in the dashboard (e.g. "food spending").

### 5. Start backend (agents)

```bash
cd apps/agents
npm run dev
```

Runs on **http://localhost:4000**. Restart after any `.env` change.

### 6. Start frontend (web)

In a second terminal:

```bash
cd apps/web
npm run dev
```

Runs on **http://localhost:3000**

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Procurement UI (find mode, contract selector) |
| http://localhost:3000/dashboard | Governance dashboard (contracts, budget, transactions) |
| http://localhost:4000/health | Agents health check |

---

## Demo flow (UI)

1. Open http://localhost:3000
2. Select **Find** mode and a spending contract (create one at `/dashboard` first)
3. Enter e.g. `find me a good burger near Marina Bay Sands under $30`
4. Click **Find & procure** (~3 min — Exa discovery + negotiation + governance)
5. View ACCEPT/BLOCK verdict; use **Request manual review** to override a BLOCK
6. Open `/dashboard` to see budget spent and transaction log

---

## Test commands (curl)

### Health & contracts

```bash
# Agents server
curl -s http://localhost:4000/health

# List contracts (agents API)
curl -s http://localhost:4000/contracts | jq .

# List contracts (web API)
curl -s http://localhost:3000/api/contracts | jq .

# Get a contract ID from the response, then check budget:
curl -s http://localhost:3000/api/contracts/<CONTRACT_ID>/budget | jq .
```

### Full procurement pipeline (~3 min)

Replace `<CONTRACT_ID>` with an ID from `/api/contracts`:

```bash
curl -X POST http://localhost:4000/run \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find me a good burger near Marina Bay Sands under $30",
    "contractId": "<CONTRACT_ID>",
    "mode": "find"
  }'
```

Via web proxy (same pipeline):

```bash
curl -X POST http://localhost:3000/api/procure \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find me a good burger near Marina Bay Sands under $30",
    "contractId": "<CONTRACT_ID>",
    "mode": "find"
  }'
```

### Transactions

```bash
curl -s http://localhost:3000/api/transactions | jq .
```

### Override a blocked transaction

```bash
curl -X POST http://localhost:3000/api/override \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "<TRANSACTION_ID>",
    "approvedBy": "demo-user"
  }'
```

---

## Fast tests (no 3-min discovery)

```bash
cd apps/agents

# Discovery only (~2–3 min)
npm run test:discovery

# Phase 5+ only: governance + DB persist (~15s)
npm run test:phase5-db -- <CONTRACT_ID>

# Full pipeline, DB bypass (mock contracts)
npm run test:e2e
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `role "agentbid" does not exist` | Agents/web hitting Postgres.app on **5432** instead of Docker on **5433**. Use `DATABASE_URL=...@localhost:5433/...` and restart both dev servers. |
| `Cannot connect to Docker daemon` | Start Docker Desktop, then `docker compose up -d postgres` |
| `contracts 500` / DB errors | Run migrations (step 4). Confirm `curl http://localhost:4000/contracts` returns JSON. |
| Changes to `.env` not picked up | Restart `npm run dev` in both `apps/agents` and `apps/web` |

### macOS Postgres.app conflict

If you have [Postgres.app](https://postgresapp.com/) on port 5432, Docker is mapped to **5433** in `docker-compose.yml`. Keep `DATABASE_URL` on port **5433**.

---

## Project layout

```
governer/
  apps/
    agents/          Express agent server (port 4000)
    web/             Next.js frontend (port 3000)
  db/migrations/     SQL schema + seed contract
  docker-compose.yml Local Postgres (host port 5433)
  .env               Shared secrets (gitignored)
```

For agent harness, feature status, and architecture notes see `AGENTS.md`, `PROGRESS.md`, and `SESSION-HANDOFF.md`.
