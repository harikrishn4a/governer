> **AgentBid architecture boundary** — Shows the module-level boundary for the Next.js web renderer layer.

# Renderer Layer

Responsibilities:
- Render the main procurement UI in `apps/web/app/page.tsx`, where users express purchase intent in natural language.
- Render the governance dashboard in `apps/web/app/dashboard/page.tsx`.
- Handle browser user interactions through `apps/web/components/IntentInput.tsx`, `AgentStream.tsx`, `SupplierPitchCard.tsx`, `GovernancePanel.tsx`, `ContractForm.tsx`, and `AuditLog.tsx`.
- Display live agent workflow events from `GET /api/stream` using the in-memory SSE event bus in `apps/web/lib/stream-store.ts`.
- Initiate procurement workflows through `POST /api/procure`.
- Present spending contracts through `apps/web/app/api/contracts/route.ts`.
- Present human review and override flows through `POST /api/override`.
- Surface supplier pitches, governance decisions, audit events, spending-contract status, and Stripe sandbox payment state to the user.

Must NOT:
- Run procurement orchestration, Exa discovery, supplier pitch competition, governance enforcement, or Stripe PaymentIntent execution logic; those belong in `apps/agents/src/agents/` and `apps/agents/src/tools/`.
- Access AWS infrastructure resources such as ECS Fargate, Aurora Serverless v2, API Gateway/Lambda, S3 transcript storage, or CloudWatch directly.
- Call Exa, Anthropic, OpenAI, Google Generative AI, or Stripe secret-key APIs directly from browser-rendered components.
- Read or write PostgreSQL/RDS data directly from UI components.
- Expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `EXA_API_KEY` to the browser.

Use Next.js API routes and the `AGENTS_BASE_URL` server-side boundary instead.