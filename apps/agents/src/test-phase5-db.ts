import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import { getActiveContract, saveTransaction, saveAuditEvent } from "./tools/db";
import { runGovernance } from "./agents/governance";
import type { WinnerPaymentIntent, UserIntent } from "./agents/types";

const MOCK_WINNER: WinnerPaymentIntent = {
  id: "test-vendor-1",
  vendor: "Shake Shack",
  item: "ShackBurger Single",
  price: 9.9,
  currency: "SGD",
  link: "https://www.shakeshack.com.sg/menu/",
  order_url: "https://www.shakeshack.com.sg/menu/",
  description: "Classic burger near Marina Bay Sands",
  why_pick: "Best value under budget",
  metadata: {},
  procurementRationale: "Lowest price with strong brand quality",
  score: 92,
  withinBudget: true,
  rankedAlternatives: [],
};

const MOCK_INTENT: UserIntent = {
  raw: "find me a good burger near Marina Bay Sands under $30",
  category: "food",
  location: "Marina Bay Sands",
  budget: 30,
  currency: "SGD",
  constraints: [],
};

async function main() {
  const contractId = process.argv[2];
  console.log("\n🧪 Phase 5+ DB integration test (skips discovery)\n");

  const contract = await getActiveContract(contractId);
  console.log(`✓ Contract loaded: ${contract.name} (${contract.id})`);

  const decision = await runGovernance(MOCK_WINNER, MOCK_INTENT, contract);
  console.log(`✓ Governance: ${decision.decision}`);

  const txId = await saveTransaction({
    user_intent: MOCK_INTENT.raw,
    contract_id: contract.id,
    winner_vendor: MOCK_WINNER.vendor,
    winner_item: MOCK_WINNER.item,
    winner_price: MOCK_WINNER.price,
    governance_decision: decision.decision,
    rationale: decision.rationale,
    checked_rules: decision.checkedRules,
    requires_human_review: decision.requiresHumanReview,
    stripe_payment_intent_id: decision.stripePaymentIntentId ?? null,
    stripe_status: decision.decision === "ACCEPT" ? "succeeded" : "requires_confirmation",
    full_result: { winner: MOCK_WINNER, decision },
  });
  console.log(`✓ Transaction saved: ${txId}`);

  await saveAuditEvent({
    transaction_id: txId,
    contract_id: contract.id,
    event_type: decision.decision,
    detail: decision.rationale,
  });
  console.log(`✓ Audit event saved`);

  console.log("\n✅ Phase 5+ DB test PASSED\n");
}

main().catch((err) => {
  console.error("\n❌ Phase 5+ DB test FAILED:", err);
  process.exit(1);
});
