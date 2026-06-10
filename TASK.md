# TASK.md — Sprint contract: Vercel AI Gateway integration

**Feature:** feat-008 — Vercel AI Gateway + AI SDK for all LLM calls  
**Branch:** `governer-feature`  
**Date:** 2026-06-10  
**Status:** COMPLETE

## Goal

Route every agent and web LLM call through **Vercel AI Gateway** via the **AI SDK** (`generateText`) when `AI_GATEWAY_API_KEY` is set, satisfying the hackathon Vercel integration criterion.

## In scope

- [x] Merge `vercal` agents gateway work into `apps/agents/src/lib/llm.ts`
- [x] Add `ai@^5` deps to agents + web packages
- [x] Create `apps/web/lib/llm.ts` with `chatText` / `chatJSON`
- [x] Migrate web routes: negotiate, user/search, business/chat, business/upload
- [x] Add `GET /api/health` on web with `llm.route`
- [x] Update `.env.example`, harness docs

## Verification (passed 2026-06-10)

```bash
docker compose config                              # OK
cd apps/agents && npx tsc --noEmit                 # 0 errors
cd apps/web && npx tsc --noEmit && npm run build   # PASSING
curl -s localhost:4000/health                      # llm.route: vercel-ai-gateway
curl -s localhost:3000/api/health                # llm.route: vercel-ai-gateway
```
