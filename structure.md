> **AgentBid** — Repository artifact layout and ownership for the actual AgentBid project.

# STRUCTURE.md

How artifacts are organised in this repository.

```
agentbid/
├── CLAUDE.md                          # Canonical build reference: project overview, architecture, stack, constraints
├── docker-compose.yml                 # Local development orchestration: postgres + agents + web
├── apps/
│   ├── web/                           # Next.js frontend deployed to Vercel
│   │   ├── app/
│   │   │   ├── page.tsx               # Main procurement UI
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # Governance dashboard
│   │   │   ├── api/
│   │   │   │   ├── procure/
│   │   │   │   │   └── route.ts       # POST /api/procure — starts procurement workflow
│   │   │   │   ├── stream/
│   │   │   │   │   └── route.ts       # GET /api/stream — SSE agent events
│   │   │   │   ├── contracts/
│   │   │   │   │   └── route.ts       # Spending contract CRUD
│   │   │   │   ├── override/
│   │   │   │   │   └── route.ts       # POST /api/override — human review path
│   │   │   │   └── stripe-webhook/
│   │   │   │       └── route.ts       # Stripe webhook handler
│   │   │   └── layout.tsx             # Next.js root layout
│   │   ├── components/
│   │   │   ├── IntentInput.tsx        # Natural-language purchase intent input
│   │   │   ├── AgentStream.tsx        # Live SSE event display
│   │   │   ├── SupplierPitchCard.tsx  # Supplier pitch presentation
│   │   │   ├── GovernancePanel.tsx    # Spending governance UI
│   │   │   ├── ContractForm.tsx       # Contract creation/editing UI
│   │   │   └── AuditLog.tsx           # Audit event display
│   │   └── lib/
│   │       ├── stream-store.ts        # In-memory SSE event bus
│   │       └── stripe.ts              # Stripe client singleton
│   └── agents/                        # Node.js agent workers deployed with Docker to ECS Fargate
│       ├── Dockerfile                 # Agent worker container definition
│       ├── package.json               # Agent service package metadata and scripts
│       └── src/
│           ├── index.ts               # Express server receiving workflow jobs
│           ├── agents/
│           │   ├── procurement.ts     # Main orchestrator agent
│           │   ├── discovery.ts       # Exa search + payment intent builder
│           │   ├── supplier.ts        # Parameterised supplier pitch agent
│           │   ├── governance.ts      # Spending contract enforcement agent
│           │   └── types.ts           # Shared agent types
│           ├── tools/
│           │   ├── exa.ts             # Exa search and getContents wrappers
│           │   ├── stripe.ts          # Stripe PaymentIntent create/confirm/cancel helpers
│           │   └── db.ts              # RDS query helpers
│           └── lib/
│               ├── event-bus.ts       # Publishes agent events to SSE store
│               ├── llm.ts             # Unified LLM call wrapper for Claude/GPT/Gemini
│               └── logger.ts          # CloudWatch-compatible structured logger
├── infra/                             # AWS CDK infrastructure in TypeScript
│   ├── bin/
│   │   └── agentbid.ts                # CDK app entry point
│   └── lib/
│       ├── ecs-stack.ts               # ECS Fargate service + ECR repository
│       ├── rds-stack.ts               # Aurora Serverless v2 database
│       ├── api-stack.ts               # API Gateway + Lambda for webhook and override paths
│       └── s3-stack.ts                # Transcript bucket
└── db/
    └── migrations/
        ├── 001_contracts.sql          # Spending contracts schema
        ├── 002_transactions.sql       # Transactions schema
        └── 003_audit_events.sql       # Audit events schema
```

## Ownership

| File | Human | Agent |
|---|---|---|
| CLAUDE.md | author, update when architectural, stack, or implementation decisions change | read as canonical build reference; do not deviate without explicit instruction |
| docker-compose.yml | review service topology and local dependency choices | update only when local dev services, ports, or environment requirements change |
| apps/web/app/page.tsx | review main procurement user experience | implement procurement UI behavior consistent with CLAUDE.md |
| apps/web/app/dashboard/page.tsx | review governance dashboard requirements | implement dashboard display for contracts, audit state, and governance status |
| apps/web/app/api/procure/route.ts | review workflow start contract | implement POST /api/procure integration with agent workflow |
| apps/web/app/api/stream/route.ts | review SSE event contract | implement GET /api/stream event streaming from stream-store |
| apps/web/app/api/contracts/route.ts | review spending contract API behavior | implement contract CRUD behavior against database |
| apps/web/app/api/override/route.ts | review human review and override policy | implement POST /api/override without bypassing governance rules |
| apps/web/app/api/stripe-webhook/route.ts | review Stripe webhook handling and security | implement sandbox Stripe webhook verification and event handling |
| apps/web/components/IntentInput.tsx | review purchase intent input UX | implement natural-language intent capture |
| apps/web/components/AgentStream.tsx | review live agent event presentation | implement SSE-driven agent event display |
| apps/web/components/SupplierPitchCard.tsx | review supplier pitch UX | implement supplier pitch comparison display |
| apps/web/components/GovernancePanel.tsx | review governance visibility requirements | implement spending contract and enforcement UI |
| apps/web/components/ContractForm.tsx | review contract creation and editing flow | implement contract form behavior |
| apps/web/components/AuditLog.tsx | review audit log display requirements | implement audit event rendering |
| apps/web/lib/stream-store.ts | review event model if changed | maintain in-memory SSE event bus for local and demo workflow |
| apps/web/lib/stripe.ts | review Stripe configuration expectations | maintain Stripe client singleton using sandbox credentials |
| apps/agents/package.json | review dependency and script changes | maintain agent service scripts and package dependencies |
| apps/agents/Dockerfile | review production container assumptions | maintain Docker image for ECS Fargate deployment |
| apps/agents/src/index.ts | review agent service API surface | implement Express job receiver and service startup |
| apps/agents/src/agents/procurement.ts | review orchestration policy | implement main procurement agent workflow |
| apps/agents/src/agents/discovery.ts | review discovery criteria and Exa usage | implement Exa-backed option discovery and payment intent preparation |
| apps/agents/src/agents/supplier.ts | review supplier competition behavior | implement parameterised supplier pitch agent |
| apps/agents/src/agents/governance.ts | review spending governance rules | implement contract enforcement agent |
| apps/agents/src/agents/types.ts | review shared workflow type changes | maintain shared agent and workflow types |
| apps/agents/src/tools/exa.ts | review Exa integration assumptions | implement Exa search and getContents wrappers |
| apps/agents/src/tools/stripe.ts | review Stripe payment lifecycle policy | implement PaymentIntent create, confirm, and cancel helpers |
| apps/agents/src/tools/db.ts | review database access patterns | implement RDS query helpers |
| apps/agents/src/lib/event-bus.ts | review event payload shape | publish agent events to the web SSE store |
| apps/agents/src/lib/llm.ts | review model/provider selection | maintain unified LLM wrapper for Claude, GPT, and Gemini |
| apps/agents/src/lib/logger.ts | review observability requirements | maintain CloudWatch-compatible structured logging |
| infra/bin/agentbid.ts | review CDK app composition | maintain CDK entry point |
| infra/lib/ecs-stack.ts | review ECS, Fargate, and ECR infrastructure | maintain agent container deployment infrastructure |
| infra/lib/rds-stack.ts | review database sizing and persistence choices | maintain Aurora Serverless v2 infrastructure |
| infra/lib/api-stack.ts | review API Gateway and Lambda integration boundaries | maintain webhook and override infrastructure |
| infra/lib/s3-stack.ts | review transcript retention and bucket policy | maintain transcript bucket infrastructure |
| db/migrations/001_contracts.sql | review spending contract schema | update only with explicit schema migration intent |
| db/migrations/002_transactions.sql | review transaction schema | update only with explicit schema migration intent |
| db/migrations/003_audit_events.sql | review audit event schema | update only with explicit schema migration intent |