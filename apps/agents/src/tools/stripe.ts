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
  logger.info("stripe:override — releasing held intent", { piId: stripePaymentIntentId, approvedBy });

  let pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

  // 1) Confirm if it still needs confirmation (attaches the test card & authorises).
  if (pi.status === "requires_confirmation" || pi.status === "requires_payment_method") {
    pi = await stripe.paymentIntents.confirm(stripePaymentIntentId, {
      payment_method: "pm_card_visa",
    });
    logger.info("stripe:override — confirmed", { piId: stripePaymentIntentId, status: pi.status });
  }

  // 2) Capture the authorised hold so the payment actually goes through (manual capture).
  if (pi.status === "requires_capture") {
    pi = await stripe.paymentIntents.capture(stripePaymentIntentId);
    logger.info("stripe:override — captured", { piId: stripePaymentIntentId, status: pi.status });
  }

  if (pi.status !== "succeeded") {
    throw new Error(`PaymentIntent ${stripePaymentIntentId} ended in status "${pi.status}" (expected succeeded)`);
  }
  logger.info("stripe:override — payment succeeded", { piId: stripePaymentIntentId });
}
