# SESSION-HANDOFF.md

## Last session
- **Date:** 2026-06-10
- **Focus:** feat-008 — Vercel AI Gateway integration (agents + web)

## Branch
`governer-feature`

## AI Gateway (feat-008 — PASSING)
All LLM calls route through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set in root `.env`.

```env
AI_GATEWAY_API_KEY=vck_...   # required for hackathon Vercel criterion
OPENAI_API_KEY=              # fallback when gateway unset
ANTHROPIC_API_KEY=           # optional fallback
```

**Health checks (demo for judges):**
```bash
curl -s localhost:4000/health        # agents → llm.route: vercel-ai-gateway
curl -s localhost:3000/api/health   # web → llm.route: vercel-ai-gateway
```

**Key files:**
- `apps/agents/src/lib/llm.ts` — `llmCall`, `llmCallJSON`, `isGatewayEnabled`
- `apps/web/lib/llm.ts` — `chatText`, `chatJSON`, `llmRoute`
- Migrated routes: negotiate, user/search, business/chat, business/upload

## Database
```env
DATABASE_URL=postgresql://agentbid:agentbid@localhost:5433/agentbid
```
Docker postgres on **5433**. Restart dev servers after `.env` changes.

## Verified this session
```bash
cd apps/agents && npx tsc --noEmit          # 0 errors
cd apps/web && npx tsc --noEmit && npm run build  # PASSING
docker compose config                        # OK
curl localhost:4000/health                   # vercel-ai-gateway
curl localhost:3000/api/health               # vercel-ai-gateway
```

## Demo flow
1. `docker compose up -d postgres`
2. `cd apps/agents && npm run dev`
3. `cd apps/web && npm run dev`
4. Verify gateway: `curl localhost:4000/health` and `curl localhost:3000/api/health`
5. `/` → Find mode → procure or negotiate flow

## Production notes
- Set `AI_GATEWAY_API_KEY` on **both** Vercel (web) and ECS (agents) task env
- `WEB_URL` on ECS must be public Vercel URL (not localhost) for SSE ingest
- SSE in-memory store won't work across Vercel serverless instances — needs Redis (deferred)

## Still deferred
- feat-007: AWS ECS + RDS deploy
- SSE Redis for serverless
- `waitUntil()` on `/api/procure` for Vercel

## Next agent should
1. Run feat-007 AWS deploy OR fix SSE for Vercel prod
2. End-to-end burger demo with gateway-only key (no direct OpenAI)
3. Do not commit unless user requests
