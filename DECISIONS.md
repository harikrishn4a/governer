> **Example** — The Template section shows the format; the Example section shows a filled entry. Generate new entries in this format as decisions are made.

# DECISIONS.md

Record every significant architectural or dependency decision here.
Agents read this before making choices that affect the project structure.

## Template

### 2025-06-09: Use multi-agent procurement pipeline
- **Decision**: Build AgentBid as a multi-agent agentic procurement system where natural-language purchase intent flows through discovery, supplier pitch competition, procurement decisioning, governance enforcement, and Stripe sandbox payment execution.
- **Reason**: The product goal is to demonstrate an agentic procurement workflow for NEXT Hackathon @ SuperAI Singapore and compete for Top 5 Overall, Best Use of Exa, and Best Use of Stripe.
- **Rejected alternatives**: Single-agent procurement flow — would not demonstrate the adversarial supplier pitch competition, specialized governance enforcement, or clear agent separation required by the project concept.
- **Constraints introduced**: Agents must preserve the pipeline roles documented in `apps/agents/src/agents/`: `procurement.ts`, `discovery.ts`, `supplier.ts`, and `governance.ts`; changes that collapse these roles require explicit architectural approval.
- **Revisit when**: The procurement workflow no longer needs separate discovery, supplier competition, governance, and payment execution stages.

---

### 2025-06-09: Use Next.js web app with API routes for procurement UI
- **Decision**: Implement the frontend in `apps/web` as a Next.js application with routes for the main procurement UI, governance dashboard, procurement start endpoint, SSE stream endpoint, contract CRUD, human override, and Stripe webhook handling.
- **Reason**: Next.js provides a single deployable web surface for the user interface and lightweight API routes needed by the hackathon build.
- **Rejected alternatives**: Separate frontend and standalone API service for all web-facing endpoints — too much operational overhead for the 36-hour build.
- **Constraints introduced**: Web-facing routes must stay aligned with the documented structure: `app/page.tsx`, `app/dashboard/page.tsx`, `app/api/procure/route.ts`, `app/api/stream/route.ts`, `app/api/contracts/route.ts`, `app/api/override/route.ts`, and `app/api/stripe-webhook/route.ts`.
- **Revisit when**: API route complexity grows beyond what can be safely maintained inside the Next.js app.

---

### 2025-06-09: Run agent workers as Node.js services deployable to ECS Fargate
- **Decision**: Implement agent workers in `apps/agents` as a Node.js service with an Express server in `src/index.ts`, containerized by `apps/agents/Dockerfile`, and intended for Docker to ECS Fargate deployment.
- **Reason**: A containerized Node.js agent service gives the procurement workflow a separate execution environment from the Vercel-hosted web app while remaining compatible with TypeScript and shared JavaScript tooling.
- **Rejected alternatives**: Running all agent logic inside Next.js API routes — rejected because long-running agent workflows, external tool calls, and worker-style orchestration are better isolated in a dedicated service.
- **Constraints introduced**: Workflow jobs should enter through the agents service, and agent implementation should remain under `apps/agents/src/agents/` with shared tools under `apps/agents/src/tools/`.
- **Revisit when**: The workflow requires queue-based orchestration, scheduled workers, or execution semantics that Express plus ECS Fargate cannot provide cleanly.

---

### 2025-06-09: Use Exa for supplier discovery and content retrieval
- **Decision**: Use Exa through `apps/agents/src/tools/exa.ts` for search and `getContents` wrappers in the discovery agent.
- **Reason**: Exa is a target prize category and directly supports supplier discovery for natural-language procurement intents.
- **Rejected alternatives**: Generic web scraping or manually curated supplier lists — rejected because they would reduce freshness, weaken the Best Use of Exa story, and increase implementation complexity.
- **Constraints introduced**: Discovery logic should call the Exa wrapper rather than introducing unrelated search providers directly into agents.
- **Revisit when**: Exa cannot provide sufficient supplier coverage, result quality, or reliability for the procurement categories AgentBid supports.

---

### 2025-06-09: Use Stripe sandbox PaymentIntents for payment execution
- **Decision**: Execute payments through Stripe in sandbox mode using PaymentIntent create, confirm, and cancel operations exposed through `apps/agents/src/tools/stripe.ts`, with web support through `apps/web/lib/stripe.ts` and `app/api/stripe-webhook/route.ts`.
- **Reason**: Stripe is a target prize category and provides a safe sandbox payment flow for hackathon procurement demos.
- **Rejected alternatives**: Mock-only payments — rejected because the product goal includes real Stripe sandbox execution; direct card handling — rejected because Stripe-hosted primitives avoid unnecessary payment security scope.
- **Constraints introduced**: Payment code must use Stripe test keys such as `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; production payment behavior must not be introduced without explicit approval.
- **Revisit when**: AgentBid needs live payments, non-card payment methods, or marketplace payout flows.

---

### 2025-06-09: Enforce spending governance through contracts before payment
- **Decision**: Add a governance agent in `apps/agents/src/agents/governance.ts`, contract CRUD in `apps/web/app/api/contracts/route.ts`, a dashboard in `apps/web/app/dashboard/page.tsx`, and a human override endpoint in `apps/web/app/api/override/route.ts`.
- **Reason**: AgentBid must enforce spending governance contracts before executing payment, while still allowing human review for exceptional cases.
- **Rejected alternatives**: Allowing the procurement agent to pay solely based on supplier ranking — rejected because it bypasses the documented governance contract requirement.
- **Constraints introduced**: Payment execution must be gated by governance checks, and override behavior must be explicit through the override API path.
- **Revisit when**: Governance contracts become too complex for the current CRUD and agent enforcement model.

---

### 2025-06-09: Stream live agent events to the web UI with SSE
- **Decision**: Use server-sent events for live agent updates, with `apps/web/app/api/stream/route.ts`, `apps/web/components/AgentStream.tsx`, `apps/web/lib/stream-store.ts`, and `apps/agents/src/lib/event-bus.ts`.
- **Reason**: SSE is simple to implement for one-way real-time workflow updates and fits the hackathon demo requirement for visible agent activity.
- **Rejected alternatives**: WebSockets — rejected as unnecessary for one-way event streaming; polling — rejected because it provides a less responsive demo and adds repeated request overhead.
- **Constraints introduced**: Agent progress should be published as events to the event bus and displayed through the AgentStream component; bidirectional realtime communication should not be added unless required.
- **Revisit when**: The UI needs bidirectional realtime controls, multi-user collaboration, or durable event replay.

---

### 2025-06-09: Use PostgreSQL-compatible persistence with migrations
- **Decision**: Store core data in a PostgreSQL-compatible database using migrations under `db/migrations/`, including `001_contracts.sql`, `002_transactions.sql`, and `003_audit_events.sql`.
- **Reason**: Contracts, transactions, and audit events require structured persistence that can be queried by the web app and agent service.
- **Rejected alternatives**: In-memory-only storage — rejected because governance, transaction history, and audit logs must persist; document-only storage — rejected because the documented schema is relational migration-based.
- **Constraints introduced**: Schema changes must be represented as ordered SQL migrations in `db/migrations/`; database access from agents should go through `apps/agents/src/tools/db.ts`.
- **Revisit when**: Procurement state requires event sourcing, high-volume analytics, or a non-relational data model.

---

### 2025-06-09: Provision cloud infrastructure with AWS CDK
- **Decision**: Define production infrastructure in TypeScript CDK under `infra/`, including ECS Fargate, ECR, Aurora Serverless v2, API Gateway, Lambda, and S3 transcript storage stacks.
- **Reason**: CDK keeps infrastructure versioned in the repository and matches the documented deployment target for the agent service and supporting resources.
- **Rejected alternatives**: Manual AWS console setup — rejected because it is not reproducible; Terraform — rejected because the repository documents AWS CDK TypeScript.
- **Constraints introduced**: Infrastructure changes must be made in `infra/bin/agentbid.ts` and the stack files under `infra/lib/`, including `ecs-stack.ts`, `rds-stack.ts`, `api-stack.ts`, and `s3-stack.ts`.
- **Revisit when**: The deployment target moves away from AWS or the infrastructure exceeds the maintainability of the current CDK stack layout.

---

### 2025-06-09: Centralize LLM calls behind a unified wrapper
- **Decision**: Route LLM usage through `apps/agents/src/lib/llm.ts`, with support for Anthropic, OpenAI, and Google Generative AI credentials.
- **Reason**: A unified wrapper allows agents to share LLM invocation logic and switch providers without scattering provider-specific code across procurement, discovery, supplier, and governance agents.
- **Rejected alternatives**: Direct provider calls inside each agent — rejected because it would duplicate logic and make provider changes harder.
- **Constraints introduced**: New LLM usage should go through the shared wrapper and rely on documented environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Revisit when**: Agents need provider-specific features that cannot be represented cleanly through the unified wrapper.

---

### 2025-06-09: Use Docker Compose for local development
- **Decision**: Provide local development through `docker-compose.yml` with Postgres, agents, and web services.
- **Reason**: Docker Compose gives contributors a reproducible local environment matching the repository’s split between database, agent service, and web app.
- **Rejected alternatives**: Requiring developers to run all services manually — rejected because it increases setup drift and slows hackathon iteration.
- **Constraints introduced**: Local service URLs and credentials should align with documented environment variables such as `AGENTS_BASE_URL=http://localhost:4000`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and `DATABASE_URL=postgresql://...`.
- **Revisit when**: Local development requires additional managed services that cannot be represented reliably in Docker Compose.

---

## Example

### 2025-06-09: Use Redis for session caching
- **Decision**: Not yet documented
- **Reason**: Not yet documented
- **Rejected alternatives**: Not yet documented
- **Constraints introduced**: Not yet documented
- **Revisit when**: Not yet documented