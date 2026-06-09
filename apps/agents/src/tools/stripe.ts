import Stripe from "stripe";
import { logger } from "../lib/logger";
import type { WinnerPaymentIntent } from "../agents/types";

function getStripe(): InstanceType<typeof Stripe> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY env var is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-05-27.dahlia",
  });
}

// Initialise the @stripe/agent-toolkit for AI agent tool use (async — call once at startup).
// Export for use in LLM tool-calling contexts; direct functions below are used by governance.
export async function initStripeAgentToolkit() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { createStripeAgentToolkit } = await import("@stripe/agent-toolkit/ai-sdk");
    const toolkit = await createStripeAgentToolkit({
      secretKey: process.env.STRIPE_SECRET_KEY,
      configuration: {},
    });
    logger.info("stripe:agent-toolkit — initialised");
    return toolkit;
  } catch (err) {
    logger.warn("stripe:agent-toolkit — init failed, direct SDK only", { error: String(err) });
    return null;
  }
}

export async function executeAcceptedTransaction(
  winner: WinnerPaymentIntent,
  contractId: string,
  rationale: string
): Promise<string> {
  const stripe = getStripe();
  logger.info("stripe:accept — creating and confirming PaymentIntent", {
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

  logger.info("stripe:accept — done", { piId: pi.id, status: pi.status });
  return pi.id;
}

export async function executeBlockedTransaction(
  winner: WinnerPaymentIntent,
  contractId: string,
  blockReason: string
): Promise<string> {
  const stripe = getStripe();
  logger.info("stripe:block — creating held PaymentIntent", {
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

  logger.info("stripe:block — held intent created", { piId: pi.id, status: pi.status });
  return pi.id;
}

export async function confirmHeldTransaction(
  stripePaymentIntentId: string,
  approvedBy: string
): Promise<void> {
  const stripe = getStripe();
  logger.info("stripe:override — confirming held intent", { piId: stripePaymentIntentId, approvedBy });
  await stripe.paymentIntents.confirm(stripePaymentIntentId);
  logger.info("stripe:override — confirmed", { piId: stripePaymentIntentId });
}
