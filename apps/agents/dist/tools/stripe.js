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
exports.initStripeAgentToolkit = initStripeAgentToolkit;
exports.executeAcceptedTransaction = executeAcceptedTransaction;
exports.executeBlockedTransaction = executeBlockedTransaction;
exports.confirmHeldTransaction = confirmHeldTransaction;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../lib/logger");
function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY env var is not set");
    }
    return new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-05-27.dahlia",
    });
}
// Initialise the @stripe/agent-toolkit for AI agent tool use (async — call once at startup).
// Export for use in LLM tool-calling contexts; direct functions below are used by governance.
async function initStripeAgentToolkit() {
    if (!process.env.STRIPE_SECRET_KEY)
        return null;
    try {
        const { createStripeAgentToolkit } = await Promise.resolve().then(() => __importStar(require("@stripe/agent-toolkit/ai-sdk")));
        const toolkit = await createStripeAgentToolkit({
            secretKey: process.env.STRIPE_SECRET_KEY,
            configuration: {},
        });
        logger_1.logger.info("stripe:agent-toolkit — initialised");
        return toolkit;
    }
    catch (err) {
        logger_1.logger.warn("stripe:agent-toolkit — init failed, direct SDK only", { error: String(err) });
        return null;
    }
}
async function executeAcceptedTransaction(winner, contractId, rationale) {
    const stripe = getStripe();
    logger_1.logger.info("stripe:accept — creating and confirming PaymentIntent", {
        vendor: winner.vendor,
        item: winner.item,
        price: winner.price,
    });
    const pi = await stripe.paymentIntents.create({
        amount: Math.round(winner.price * 100),
        currency: "sgd",
        payment_method: "pm_card_visa",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
            vendor: winner.vendor,
            item: winner.item,
            contractId,
            rationale: rationale.slice(0, 500),
            procurementRationale: winner.procurementRationale.slice(0, 500),
        },
    });
    logger_1.logger.info("stripe:accept — done", { piId: pi.id, status: pi.status });
    return pi.id;
}
async function executeBlockedTransaction(winner, contractId, blockReason) {
    const stripe = getStripe();
    logger_1.logger.info("stripe:block — creating held PaymentIntent", {
        vendor: winner.vendor,
        price: winner.price,
    });
    const pi = await stripe.paymentIntents.create({
        amount: Math.round(winner.price * 100),
        currency: "sgd",
        payment_method: "pm_card_visa",
        capture_method: "manual",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
            vendor: winner.vendor,
            item: winner.item,
            contractId,
            blockReason: blockReason.slice(0, 500),
            blocked: "true",
        },
    });
    logger_1.logger.info("stripe:block — held intent created", { piId: pi.id, status: pi.status });
    return pi.id;
}
async function confirmHeldTransaction(stripePaymentIntentId, approvedBy) {
    const stripe = getStripe();
    logger_1.logger.info("stripe:override — confirming held intent", { piId: stripePaymentIntentId, approvedBy });
    await stripe.paymentIntents.confirm(stripePaymentIntentId);
    logger_1.logger.info("stripe:override — confirmed", { piId: stripePaymentIntentId });
}
