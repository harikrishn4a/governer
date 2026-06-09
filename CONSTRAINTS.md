> **AgentBid** — Hard limits for the multi-agent procurement workflow, governance contracts, Exa discovery, and Stripe sandbox payments.

# CONSTRAINTS.md

Hard limits for this repository. Agents MUST follow these without exception.
Use MUST / MUST NOT language only. No ambiguity.

## Scope
- MUST work on exactly one feature at a time
- MUST NOT modify files outside the current feature scope
- MUST NOT refactor unrelated code during a feature implementation

## Verification
- MUST run all verification commands before marking a feature done
- MUST NOT remove or weaken tests to make a task appear complete
- MUST NOT claim completion without runnable evidence

## Artifacts
- MUST update `features.md` task checkboxes and notes before ending a session
- MUST update `feature_list.json` status and evidence before ending a session
- MUST NOT rewrite `PROGRESS.md` to hide unfinished work or failed checks
- MUST NOT delete any project file without explicit user instruction

## Dependencies
- MUST NOT add new dependencies without recording the decision in `DECISIONS.md`
- MUST NOT upgrade existing dependencies mid-feature

## Procurement and Payments
- MUST NOT execute live Stripe payments or use live Stripe keys; AgentBid MUST remain in Stripe sandbox mode with `sk_test_...` and `pk_test_...` credentials
- MUST NOT bypass spending governance contract enforcement before procurement decisions or Stripe payment actions
- MUST NOT confirm, create, or cancel Stripe PaymentIntents outside the documented agent/tool boundaries in `apps/agents/src/tools/stripe.ts` and `apps/web/app/api/stripe-webhook/route.ts`
- MUST NOT bypass human review or override handling for governance exceptions handled by `apps/web/app/api/override/route.ts`
- MUST preserve the multi-agent procurement pipeline: intent intake, Exa discovery, supplier pitch competition, procurement decision, governance enforcement, and Stripe sandbox payment execution

## {{DOMAIN_SPECIFIC_SECTION}}
- MUST NOT {{CONSTRAINT}}