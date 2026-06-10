> **AgentBid** — Canonical agent harness for working on the AgentBid repository.

# AGENTS.md

## What this is
AgentBid is a multi-agent agentic procurement system for users who want to express a purchase intent in natural language and have AI agents discover options, run an adversarial supplier pitch competition, make a procurement decision, enforce spending governance contracts, and execute a Stripe sandbox payment. It is being built for NEXT Hackathon @ SuperAI Singapore, targeting Top 5 Overall, Best Use of Exa, and Best Use of Stripe.

## Current stage
Hackathon MVP — end-to-end agentic procurement workflow for NEXT Hackathon @ SuperAI Singapore: natural-language procurement intake, Exa-powered discovery, supplier pitch agents, governance contract enforcement, live SSE agent events, and Stripe sandbox payment execution.

## Stack
- TypeScript on Node.js; Next.js frontend in `apps/web`; Node.js agent workers in `apps/agents`
- Next.js App Router, React components, Express agent server, AWS CDK TypeScript, Exa search/getContents wrappers, Stripe PaymentIntent tooling, LLM wrapper for Claude/GPT/Gemini
- PostgreSQL for local development via `docker-compose.yml`; Aurora Serverless v2/RDS in AWS; S3 transcript bucket; in-memory SSE event bus in `apps/web/lib/stream-store.ts`
- Test runner: Not yet documented
- Docker/Docker Compose for local development, Dockerfile for agent workers, AWS CDK for ECS Fargate/ECR/API Gateway/Lambda/RDS/S3, Vercel target for the web app

## Repo structure
```
agentbid/
  apps/
    web/                       — Next.js frontend, procurement UI, dashboard, API routes, SSE stream, Stripe webhook
      app/
        page.tsx               — main procurement UI
        dashboard/page.tsx     — governance dashboard
        api/
          procure/route.ts     — POST /api/procure starts workflow
          stream/route.ts      — GET /api/stream SSE agent events
          contracts/route.ts   — spending contract CRUD
          override/route.ts    — POST /api/override human review
          stripe-webhook/route.ts — Stripe webhook handler
      components/              — IntentInput, AgentStream, SupplierPitchCard, GovernancePanel, ContractForm, AuditLog
      lib/                     — stream-store.ts, stripe.ts, llm.ts (Vercel AI Gateway)
    agents/                    — Node.js agent workers intended for Docker to ECS Fargate
      src/
        index.ts               — Express server receiving workflow jobs
        agents/                — procurement, discovery, supplier, governance agents and shared types
        tools/                 — Exa, Stripe, and database helpers
        lib/                   — event bus, LLM wrapper (Vercel AI Gateway via ai@5), structured logger
      Dockerfile               — agent worker container build
      package.json             — agents package metadata and scripts
  infra/                       — AWS CDK TypeScript infrastructure
    bin/agentbid.ts            — CDK app entrypoint
    lib/                       — ECS, RDS, API, and S3 stacks
  db/
    migrations/                — contracts, transactions, and audit events SQL migrations
  docker-compose.yml           — local development: postgres, agents, and web
  CLAUDE.md                    — canonical build reference
  AGENTS.md                    — agent harness instructions
  PROGRESS.md                  — current progress tracking
  DECISIONS.md                 — architecture decisions
  CONSTRAINTS.md               — hard project constraints
  SESSION-HANDOFF.md           — restart state from the last session
  TASK.md                      — current sprint contract
  features.md                  — feature checklist and implementation notes
  feature_list.json            — machine-readable feature status and evidence
```

---

## Session start
1. Run `pwd` — confirm you are in the `agentbid` repo root
2. Read this file completely
3. Read `PROGRESS.md` — understand current state
4. Read `SESSION-HANDOFF.md` — see what the last session left
5. Run `git log --oneline -5` — see recent changes
6. Run `./init.sh` — confirm baseline is not broken
7. Read `feature_list.json` — identify the current active feature
8. Pick exactly one unfinished feature. Work only that until verified or blocked.

If baseline verification is failing, repair that first before adding new scope.

## Session end
1. Run full verification (see Verification Commands below)
2. Update `PROGRESS.md` if a feature completed, was added, or got blocked
3. Update `features.md` — check off completed tasks, add implementation notes
4. Update `feature_list.json` — set new status and record evidence
5. Overwrite `SESSION-HANDOFF.md` with this session's state
6. Commit with a descriptive message — leave a clean restart path

## Working rules
- One active feature at a time — never work on two features in parallel
- Before starting a feature, generate a sprint contract and save it to `TASK.md`
- Do not claim completion without runnable verification evidence
- Do not rewrite `PROGRESS.md` to hide unfinished work
- Do not remove or weaken tests to make a task appear complete
- Stay in scope — do not modify files unrelated to the current feature

## Completion gate
A feature moves to `passing` only when ALL of the following are true:
- [ ] Target behavior is implemented
- [ ] All verification commands pass (see below)
- [ ] Tasks checked off in `features.md`
- [ ] Evidence recorded in `feature_list.json`
- [ ] Repository is restartable from `./init.sh`

## Verification commands
```bash
./init.sh
docker compose config
```

Required checks:
- `./init.sh` must complete successfully and confirm the repository baseline is not broken
- `docker compose config` must validate `docker-compose.yml` for the local Postgres, agents, and web stack
- Web app verification commands are not yet documented; use the actual scripts from `apps/web/package.json` once available
- Agent worker verification commands are not yet documented; use the actual scripts from `apps/agents/package.json` once available
- Infrastructure verification commands are not yet documented; use the actual AWS CDK TypeScript scripts from the `infra` package once available

## Escalation
- **Architecture decisions**: Check `DECISIONS.md`, then ask the user
- **Unclear requirements**: Check `features.md` for the feature definition, then ask the user
- **Repeated failures**: Mark feature as blocked in `feature_list.json`, flag for human review
- **Scope ambiguity**: Re-read `TASK.md` sprint contract before expanding scope

## Constraints
See `CONSTRAINTS.md` for hard limits that must never be violated.

<!-- Merged from CLAUDE.md -->
**Target event details:** 36-hour build, June 9–11 2025

`apps/web/lib/stripe.ts` — Stripe client singleton

`apps/agents/src/agents/supplier.ts` — supplier pitch agent, parameterised

`apps/agents/src/tools/stripe.ts` — PaymentIntent create/confirm/cancel

`apps/agents/src/lib/event-bus.ts` — publishes agent events to SSE store

`apps/agents/src/lib/logger.ts` — CloudWatch-compatible structured logger