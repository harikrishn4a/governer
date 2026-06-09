import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import express from "express";
import { runProcurement, runFullProcurement } from "./agents/procurement";
import { runGovernance } from "./agents/governance";
import { getActiveContract, saveTransaction, saveAuditEvent, getAllContracts, getTransaction } from "./tools/db";
import { confirmHeldTransaction } from "./tools/stripe";
import { logger } from "./lib/logger";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? "4000", 10);

// Full pipeline: intent → discovery → supplier pitches → negotiation → governance → Stripe → DB
app.post("/run", async (req, res) => {
  const { intent, contractId, mode } = req.body as {
    intent?: string;
    contractId?: string;
    mode?: "find" | "auction";
  };

  if (!intent || typeof intent !== "string" || intent.trim() === "") {
    return res.status(400).json({ error: "intent is required" });
  }

  if (mode === "auction") {
    return res.status(501).json({
      error: "Auction mode is not implemented yet",
      detail: "Use find mode for the burger demo. Auction mode (flight search) is planned for a later sprint.",
    });
  }

  const requestStart = Date.now();

  try {
    logger.section("POST /run — AGENTBID FULL PIPELINE");
    logger.info("request:received", {
      intent: intent.trim(),
      contractId: contractId ?? "(default)",
      timestamp: new Date().toISOString(),
    });

    // ── Phase 1-4: procurement pipeline ──────────────────────────────────────
    const { intent: parsedIntent, options, pitches, winner } = await runFullProcurement(intent.trim());

    // ── Phase 5: load contract ────────────────────────────────────────────────
    logger.section("PHASE 5a — CONTRACT LOAD");
    const contract = await getActiveContract(contractId);
    logger.info("contract:loaded", {
      id: contract.id,
      name: contract.name,
      budgetCap: `SGD ${contract.budgetCap}`,
      budgetPeriod: contract.budgetPeriod,
      categoryConstraints: contract.categoryConstraints.length ? contract.categoryConstraints : "(none)",
      vendorBlocklist: contract.vendorBlocklist.length ? contract.vendorBlocklist : "(none)",
      riskThreshold: contract.riskThreshold,
    });

    // ── Phase 6-7: governance + Stripe ───────────────────────────────────────
    const decision = await runGovernance(winner, parsedIntent, contract);

    // ── Phase 8: persist to DB ────────────────────────────────────────────────
    logger.section("PHASE 7 — DATABASE PERSIST");
    const txId = await saveTransaction({
      user_intent: intent.trim(),
      contract_id: contract.id,
      winner_vendor: winner.vendor,
      winner_item: winner.item,
      winner_price: winner.price,
      governance_decision: decision.decision,
      rationale: decision.rationale,
      checked_rules: decision.checkedRules,
      requires_human_review: decision.requiresHumanReview,
      stripe_payment_intent_id: decision.stripePaymentIntentId ?? null,
      stripe_status: decision.decision === "ACCEPT" ? "succeeded" : "requires_confirmation",
      full_result: { options, pitches, winner, decision },
    });

    await saveAuditEvent({
      transaction_id: txId,
      contract_id: contract.id,
      event_type: decision.decision,
      detail: decision.rationale,
    });

    logger.info("db:saved", { transactionId: txId, auditEvent: decision.decision });

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalMs = Date.now() - requestStart;
    logger.section("REQUEST COMPLETE");
    logger.info("response:summary", {
      transactionId: txId,
      decision: decision.decision,
      vendor: winner.vendor,
      item: winner.item,
      price: `SGD ${winner.price}`,
      stripePaymentIntentId: decision.stripePaymentIntentId ?? null,
      requiresHumanReview: decision.requiresHumanReview,
      totalMs,
    });

    return res.json({
      transactionId: txId,
      decision: decision.decision,
      vendor: winner.vendor,
      item: winner.item,
      price: winner.price,
      currency: "SGD",
      rationale: decision.rationale,
      checkedRules: decision.checkedRules,
      requiresHumanReview: decision.requiresHumanReview,
      stripePaymentIntentId: decision.stripePaymentIntentId ?? null,
      procurementRationale: winner.procurementRationale,
      contractId: contract.id,
      contractName: contract.name,
      contractBudgetCap: contract.budgetCap,
      contractBudgetPeriod: contract.budgetPeriod,
      pitches,
      options,
    });
  } catch (err) {
    const totalMs = Date.now() - requestStart;
    logger.error("pipeline:failed", { error: String(err), totalMs });
    return res.status(500).json({ error: "Pipeline failed", detail: String(err) });
  }
});

// Discovery only
app.post("/discover", async (req, res) => {
  const { intent } = req.body as { intent?: string };
  if (!intent) return res.status(400).json({ error: "intent required" });
  try {
    logger.info("POST /discover", { intent });
    const options = await runProcurement(intent.trim());
    return res.json({ options });
  } catch (err) {
    logger.error("POST /discover failed", { error: String(err) });
    return res.status(500).json({ error: String(err) });
  }
});

// Human override — confirm a held Stripe PaymentIntent
app.post("/override", async (req, res) => {
  const { transactionId, approvedBy } = req.body as {
    transactionId?: string;
    approvedBy?: string;
  };

  if (!transactionId || !approvedBy) {
    return res.status(400).json({ error: "transactionId and approvedBy required" });
  }

  try {
    logger.info("POST /override — human approval", { transactionId, approvedBy });

    const tx = await getTransaction(transactionId);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    const stripePaymentIntentId = tx.stripe_payment_intent_id;
    if (!stripePaymentIntentId) {
      return res.status(400).json({ error: "No Stripe PaymentIntent associated with this transaction" });
    }

    logger.info("override:confirming-stripe-pi", { piId: stripePaymentIntentId, approvedBy });
    await confirmHeldTransaction(stripePaymentIntentId, approvedBy);

    const { overrideTransaction } = await import("./tools/db");
    await overrideTransaction(transactionId, approvedBy, "succeeded");

    await saveAuditEvent({
      transaction_id: transactionId,
      event_type: "OVERRIDE",
      detail: `Human override by ${approvedBy}`,
      actor: approvedBy,
    });

    logger.info("override:complete", { transactionId, piId: stripePaymentIntentId, approvedBy });
    return res.json({ ok: true });
  } catch (err) {
    logger.error("POST /override failed", { error: String(err) });
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/contracts", async (_req, res) => {
  try {
    const contracts = await getAllContracts();
    return res.json({ contracts });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.section("AGENTBID AGENTS SERVER");
  logger.info("server:ready", {
    port: PORT,
    env: {
      exa: process.env.EXA_API_KEY ? "✓" : "✗ MISSING",
      openai: process.env.OPENAI_API_KEY ? "✓" : "✗ MISSING",
      anthropic: process.env.ANTHROPIC_API_KEY ? "✓" : "(not set — GPT-4o active)",
      stripe: process.env.STRIPE_SECRET_KEY ? "✓" : "✗ MISSING",
      db: process.env.DATABASE_URL ? "✓" : "✗ MISSING",
    },
  });
});
