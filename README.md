# AgentBid

> Express a purchase intent in natural language — AI agents discover real options, run a competitive bidding/negotiation round, enforce your spending rules, and execute a Stripe sandbox payment.

AgentBid is a multi-agent **agentic procurement** system. You describe what you want
("a direct flight to Kuala Lumpur tomorrow under $300"); the agents do the rest:
live discovery with [Exa](https://exa.ai), a supplier competition, an LLM judge, a
governance layer that enforces your spending contract, and a real Stripe test-mode
payment on approval.

**Stack:** Next.js (`apps/web`) · Express agent server (`apps/agents`) · PostgreSQL · Exa · Stripe (test mode) · Vercel AI Gateway

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Demo

> 📺 **Demo video** — _inline player coming once the repo is on GitHub (see steps below)._

<!--
  EMBED AN INLINE VIDEO PLAYER (no repo bloat — GitHub hosts the file on its CDN):
    1. Push this repo to GitHub.
    2. Open the repo on github.com → Issues → New issue (you do NOT need to submit it).
    3. Drag your demo file (final/p2.mp4) into the comment box; wait for the upload bar to finish.
    4. GitHub inserts a URL like:  https://github.com/user-attachments/assets/<id>
    5. Replace the blockquote line above with that URL on ITS OWN LINE — GitHub then
       renders an inline <video> player automatically. (Or paste the URL back to me.)
-->

---

## What it does

Two modes, one shared governance + payment tail:

- **Find mode** — natural-language intent → Exa discovery → supplier pitch agents →
  negotiation → LLM picks the winner.
- **Auction mode** — intent becomes a **tender broadcast**; Exa pulls real published
  prices; vendor agents bid across two rounds (sealed → best-and-final with a visible
  competitor board); an LLM judge ranks them on price, fit, value-adds, and credibility.

Every run then passes through:

- **Governance contracts** — per-contract rules the winner must satisfy: budget cap,
  category constraints, vendor blocklist/allowlist, and **flexibility rules** (hard vs.
  soft price caps with an overspend tolerance, strict allowlist enforcement, unverified-
  vendor blocking, and free-text **custom rules** evaluated by an LLM, e.g. "halal only").
- **Stripe execution** — `ACCEPT` confirms a test-mode PaymentIntent immediately;
  `BLOCK` holds it for human review and one-click override.
- **Audit trail** — every decision, rule check, and transcript is persisted to Postgres
  and shown in the dashboard.

---

## Architecture

```
                  ┌──────────────────────────┐
   Browser  ◄────►│  apps/web  (Next.js)      │   UI, dashboard, SSE stream,
                  │  API routes proxy + DB    │   Stripe client
                  └────────────┬─────────────┘
                               │  POST /run, /override   (AGENTS_BASE_URL)
                  ┌────────────▼─────────────┐
                  │  apps/agents  (Express)   │   discovery · supplier/bidding ·
                  │  agent pipeline + tools   │   governance · Stripe · DB
                  └────┬───────────┬─────────┘
                       │           │
              ┌────────▼──┐   ┌────▼─────┐   ┌──────────────┐
              │   Exa     │   │  Stripe  │   │  PostgreSQL  │
              │ discovery │   │ test API │   │  contracts,  │
              └───────────┘   └──────────┘   │  txns, audit │
                                             └──────────────┘
```

Secret-key APIs (Exa, Stripe, LLMs) are only ever called from `apps/agents` or
server-side Next.js API routes — never from the browser.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Postgres)
- API keys:
  - [Exa](https://dashboard.exa.ai/)
  - [OpenAI](https://platform.openai.com/api-keys) or [Anthropic](https://console.anthropic.com/) (or a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key)
  - [Stripe test mode](https://dashboard.stripe.com/test/apikeys)

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/harikrishn4a/procure.git
cd procure

npm install --prefix apps/agents
npm install --prefix apps/web
```

### 2. Environment variables

Copy the example and fill in your keys. Both apps load the repo-root `.env`:

```bash
cp .env.example .env
```

```env
# Discovery
EXA_API_KEY=your_exa_api_key

# LLM — direct keys, or route everything through Vercel AI Gateway
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=
AI_GATEWAY_API_KEY=

# Database — port 5433 avoids conflict with Postgres.app on macOS (5432)
DATABASE_URL=postgresql://agentbid:agentbid@localhost:5433/agentbid

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Servers
PORT=4000
AGENTS_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> `.env` is gitignored — never commit real keys.

### 3. Start Docker Postgres

```bash
docker compose up -d postgres
docker compose ps   # should show healthy on 0.0.0.0:5433
```

### 4. Run database migrations

```bash
for f in db/migrations/*.sql; do
  docker compose exec -T postgres psql -U agentbid -d agentbid < "$f"
done
```

This seeds a **Default contract**. Create more in the dashboard.

### 5. Start the backend (agents)

```bash
cd apps/agents && npm run dev   # http://localhost:4000
```

### 6. Start the frontend (web)

In a second terminal:

```bash
cd apps/web && npm run dev       # http://localhost:3000
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Procurement UI (find / auction, contract selector) |
| http://localhost:3000/dashboard | Governance dashboard (contracts, budget, transactions) |
| http://localhost:4000/health | Agents health check |

---

## Demo flow

1. Open http://localhost:3000 and create a spending contract at `/dashboard`
   (set a budget cap; expand **Advanced rules** to add flexibility/custom rules).
2. Pick a mode and contract, then enter an intent:
   - **Find:** `a good burger near Marina Bay Sands under $30`
   - **Auction:** `affordable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD`
3. Run it — watch live agent events, bids, and the judge's decision.
4. See the `ACCEPT`/`BLOCK` verdict and Stripe PaymentIntent; override a `BLOCK` from the UI.
5. Open `/dashboard` for budget spent and the full transaction log.

### Via curl

```bash
# Auction run (replace <CONTRACT_ID> from GET /api/contracts)
curl -X POST http://localhost:4000/run \
  -H "Content-Type: application/json" \
  -d '{"intent":"affordable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD","contractId":"<CONTRACT_ID>","mode":"auction"}'
```

---

## Tests

```bash
cd apps/agents
npm run test:discovery          # discovery pipeline
npm run test:auction            # auction logic (mock anchors, deterministic)
npm run test:auction-e2e        # live Exa + Stripe sandbox
npm run test:flexibility-rules  # governance flexibility/custom rules
```

---

## Project layout

```
procure/
  apps/
    agents/          Express agent server (port 4000) — pipeline, tools, tests
    web/             Next.js frontend (port 3000) — UI, dashboard, API routes
  db/migrations/     SQL schema + seed contract
  docs/              Design system, motion, and archived build notes (docs/internal/)
  docker-compose.yml Local Postgres (host port 5433)
  .env.example       Environment template
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `role "agentbid" does not exist` | App is hitting Postgres.app on **5432** instead of Docker on **5433**. Keep `DATABASE_URL` on **5433** and restart both dev servers. |
| `Cannot connect to Docker daemon` | Start Docker Desktop, then `docker compose up -d postgres`. |
| `contracts 500` / DB errors | Run the migrations (step 4); confirm `curl http://localhost:4000/health` is OK. |
| `.env` changes ignored | Restart `npm run dev` in **both** apps. |

---

## License

[MIT](LICENSE) © Harikrishnan Nandakumar

Built for the NEXT Hackathon @ SuperAI Singapore.
