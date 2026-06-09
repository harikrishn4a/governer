"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: `${__dirname}/../../../.env` });
const express_1 = __importDefault(require("express"));
const procurement_1 = require("./agents/procurement");
const governance_1 = require("./agents/governance");
const db_1 = require("./tools/db");
const stripe_1 = require("./tools/stripe");
const logger_1 = require("./lib/logger");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT ?? "4000", 10);
// Full pipeline: intent → discovery → supplier pitches → negotiation → governance → Stripe → DB
app.post("/run", async (req, res) => {
    const { intent, contractId } = req.body;
    if (!intent || typeof intent !== "string" || intent.trim() === "") {
        return res.status(400).json({ error: "intent is required" });
    }
    const requestStart = Date.now();
    try {
        logger_1.logger.section("POST /run — AGENTBID FULL PIPELINE");
        logger_1.logger.info("request:received", {
            intent: intent.trim(),
            contractId: contractId ?? "(default)",
            timestamp: new Date().toISOString(),
        });
        // ── Phase 1-4: procurement pipeline ──────────────────────────────────────
        const { intent: parsedIntent, options, pitches, winner } = await (0, procurement_1.runFullProcurement)(intent.trim());
        // ── Phase 5: load contract ────────────────────────────────────────────────
        logger_1.logger.section("PHASE 5a — CONTRACT LOAD");
        const contract = await (0, db_1.getActiveContract)(contractId);
        logger_1.logger.info("contract:loaded", {
            id: contract.id,
            name: contract.name,
            budgetCap: `SGD ${contract.budgetCap}`,
            budgetPeriod: contract.budgetPeriod,
            categoryConstraints: contract.categoryConstraints.length ? contract.categoryConstraints : "(none)",
            vendorBlocklist: contract.vendorBlocklist.length ? contract.vendorBlocklist : "(none)",
            riskThreshold: contract.riskThreshold,
        });
        // ── Phase 6-7: governance + Stripe ───────────────────────────────────────
        const decision = await (0, governance_1.runGovernance)(winner, parsedIntent, contract);
        // ── Phase 8: persist to DB ────────────────────────────────────────────────
        logger_1.logger.section("PHASE 7 — DATABASE PERSIST");
        const txId = await (0, db_1.saveTransaction)({
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
        await (0, db_1.saveAuditEvent)({
            transaction_id: txId,
            contract_id: contract.id,
            event_type: decision.decision,
            detail: decision.rationale,
        });
        logger_1.logger.info("db:saved", { transactionId: txId, auditEvent: decision.decision });
        // ── Summary ───────────────────────────────────────────────────────────────
        const totalMs = Date.now() - requestStart;
        logger_1.logger.section("REQUEST COMPLETE");
        logger_1.logger.info("response:summary", {
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
            pitches,
            options,
        });
    }
    catch (err) {
        const totalMs = Date.now() - requestStart;
        logger_1.logger.error("pipeline:failed", { error: String(err), totalMs });
        return res.status(500).json({ error: "Pipeline failed", detail: String(err) });
    }
});
// Discovery only
app.post("/discover", async (req, res) => {
    const { intent } = req.body;
    if (!intent)
        return res.status(400).json({ error: "intent required" });
    try {
        logger_1.logger.info("POST /discover", { intent });
        const options = await (0, procurement_1.runProcurement)(intent.trim());
        return res.json({ options });
    }
    catch (err) {
        logger_1.logger.error("POST /discover failed", { error: String(err) });
        return res.status(500).json({ error: String(err) });
    }
});
// Human override — confirm a held Stripe PaymentIntent
app.post("/override", async (req, res) => {
    const { transactionId, approvedBy } = req.body;
    if (!transactionId || !approvedBy) {
        return res.status(400).json({ error: "transactionId and approvedBy required" });
    }
    try {
        logger_1.logger.info("POST /override — human approval", { transactionId, approvedBy });
        const tx = await (0, db_1.getTransaction)(transactionId);
        if (!tx)
            return res.status(404).json({ error: "Transaction not found" });
        const stripePaymentIntentId = tx.stripe_payment_intent_id;
        if (!stripePaymentIntentId) {
            return res.status(400).json({ error: "No Stripe PaymentIntent associated with this transaction" });
        }
        logger_1.logger.info("override:confirming-stripe-pi", { piId: stripePaymentIntentId, approvedBy });
        await (0, stripe_1.confirmHeldTransaction)(stripePaymentIntentId, approvedBy);
        const { overrideTransaction } = await Promise.resolve().then(() => __importStar(require("./tools/db")));
        await overrideTransaction(transactionId, approvedBy, "succeeded");
        await (0, db_1.saveAuditEvent)({
            transaction_id: transactionId,
            event_type: "OVERRIDE",
            detail: `Human override by ${approvedBy}`,
            actor: approvedBy,
        });
        logger_1.logger.info("override:complete", { transactionId, piId: stripePaymentIntentId, approvedBy });
        return res.json({ ok: true });
    }
    catch (err) {
        logger_1.logger.error("POST /override failed", { error: String(err) });
        return res.status(500).json({ error: String(err) });
    }
});
app.get("/contracts", async (_req, res) => {
    try {
        const contracts = await (0, db_1.getAllContracts)();
        return res.json({ contracts });
    }
    catch (err) {
        return res.status(500).json({ error: String(err) });
    }
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    logger_1.logger.section("AGENTBID AGENTS SERVER");
    logger_1.logger.info("server:ready", {
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
