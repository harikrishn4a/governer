# Session Handoff — AWS + Vercel Deploy

## Status: DEPLOYED (hybrid)

### EC2 (`44.248.228.50`) — full stack
| Service | Port | pm2 name | Status |
|---------|------|----------|--------|
| Postgres (Docker) | 5432 (local) | `agentbid-postgres` | running |
| Agents worker | 4000 (local) | `agentbid-agents` | online |
| Next.js web | **3000 (public)** | `agentbid-web` | online |

**Public URL:** http://44.248.228.50:3000

```bash
ssh -i ~/.ssh/id_ed25519 ec2-user@44.248.228.50
pm2 list
curl http://localhost:4000/health
curl http://localhost:3000/api/health
```

Redeploy: `./scripts/deploy-ec2.sh`

### Vercel — frontend + serverless APIs
**URL:** https://agentsbid.vercel.app

Env vars set (production): `EXA_API_KEY`, `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, Stripe keys, `AGENTS_BASE_URL=http://44.248.228.50:3000/api/agents-proxy`, `NEXT_PUBLIC_APP_URL`

`DATABASE_URL` intentionally **unset** on Vercel — contract/transaction APIs proxy to EC2 at runtime via `lib/ec2-proxy.ts`.

### Architecture
```
Browser → Vercel (agentsbid.vercel.app)
           ├─ /api/procure → EC2 agents-proxy → localhost:4000 agents
           ├─ /api/contracts → EC2 :3000 (postgres on EC2)
           └─ /api/stream ← SSE ingest from EC2 agents (WEB_URL_EXTRA)

Browser → EC2 (:3000) — self-contained, all local
```

EC2 agents `.env`:
- `WEB_URL=http://localhost:3000` (EC2 UI SSE)
- `WEB_URL_EXTRA=https://agentsbid.vercel.app` (Vercel UI SSE fan-out)

### Build hang fix (Vercel)
**Root cause:** Next.js statically pre-rendered `/api/transactions` at build time; `DATABASE_URL` pointed to EC2:5432 (unreachable) → 60s timeout loop.

**Fix:**
1. `export const dynamic = "force-dynamic"` on all DB API routes
2. Removed `DATABASE_URL` from Vercel env
3. Runtime EC2 proxy when `DATABASE_URL` unset (`lib/ec2-proxy.ts`)
4. `connectionTimeoutMillis: 5000` on pg Pool

### Security group (optional)
Only port **3000** is public today. Ports 4000/5432 remain closed (by design — proxied via :3000).

### Local changes not yet committed
- `apps/web/lib/ec2-proxy.ts`
- `apps/web/app/api/agents-proxy/[...path]/route.ts`
- `apps/web/app/api/*/route.ts` — force-dynamic + EC2 proxy
- `apps/agents/src/lib/event-bus.ts` — WEB_URL_EXTRA fan-out
- `apps/web/lib/db.ts` — connection timeout
- `scripts/deploy-ec2.sh`

### Next session
1. Commit deploy changes
2. feat-007 full CDK/ECS if needed for hackathon judging
3. E2E test: procure from https://agentsbid.vercel.app with live agent stream
