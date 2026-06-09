import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import { runFullProcurement } from "./agents/procurement";
import { runGovernance } from "./agents/governance";
import type { SpendingContract } from "./agents/types";

const MOCK_DEFAULT_CONTRACT: SpendingContract = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Default contract",
  budgetCap: 100,
  budgetPeriod: "per_transaction",
  categoryConstraints: [],
  vendorBlocklist: [],
  vendorAllowlist: [],
  riskThreshold: "low",
  active: true,
  createdAt: new Date().toISOString(),
};

const MOCK_HALAL_CONTRACT: SpendingContract = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "Halal contract",
  budgetCap: 50,
  budgetPeriod: "per_transaction",
  categoryConstraints: ["halal certified restaurants only"],
  vendorBlocklist: [],
  vendorAllowlist: [],
  riskThreshold: "strict",
  active: true,
  createdAt: new Date().toISOString(),
};

function box(title: string) {
  const line = "─".repeat(60);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title.padEnd(58)}│`);
  console.log(`└${line}┘`);
}

async function runTest(label: string, intent: string, contract: SpendingContract) {
  box(`TEST: ${label}`);
  console.log(`Intent : "${intent}"`);
  console.log(`Contract: ${contract.name} | cap SGD ${contract.budgetCap} | period ${contract.budgetPeriod}`);
  if (contract.categoryConstraints.length) console.log(`Constraints: ${contract.categoryConstraints.join(", ")}`);

  console.log("\n[1/3] Running procurement pipeline (discovery → suppliers → pick_winner)…");
  const { intent: parsedIntent, options, pitches, winner } = await runFullProcurement(intent);
  console.log(`  ✓ Winner: ${winner.vendor} — ${winner.item} @ SGD ${winner.price}`);
  console.log(`  ✓ ${pitches.length} supplier pitch(es), ${options.length} discovered options`);

  console.log("\n[2/3] Running governance + Stripe…");
  const decision = await runGovernance(winner, parsedIntent, contract);

  console.log(`\n  Decision : ${decision.decision}`);
  if (decision.stripePaymentIntentId) {
    console.log(`  Stripe PI: ${decision.stripePaymentIntentId}`);
  }
  console.log(`  Rationale: ${decision.rationale}`);
  console.log("\n  Rules checked:");
  for (const r of decision.checkedRules) {
    console.log(`    ${r.passed ? "✓" : "✗"} [${r.rule}] ${r.detail.slice(0, 100)}`);
  }

  console.log("\n[3/3] Result summary:");
  console.log(JSON.stringify({
    decision: decision.decision,
    vendor: winner.vendor,
    item: winner.item,
    price: winner.price,
    stripePaymentIntentId: decision.stripePaymentIntentId ?? null,
    requiresHumanReview: decision.requiresHumanReview,
    rulesChecked: decision.checkedRules.length,
    rulesPassed: decision.checkedRules.filter(r => r.passed).length,
  }, null, 2));

  return decision;
}

async function main() {
  console.log("\n\x1b[1m🤖 AgentBid E2E Test (DB-bypass mode)\x1b[0m");
  console.log("Tests run the full pipeline. DB save is skipped — run migrations first.");

  try {
    // TEST 1 — happy path
    const d1 = await runTest(
      "TEST 1 — happy path ACCEPT",
      "find me a good burger near Marina Bay Sands under $30",
      MOCK_DEFAULT_CONTRACT
    );
    console.log(`\n\x1b[${d1.decision === "ACCEPT" ? "32" : "31"}m${d1.decision === "ACCEPT" ? "✅ PASS" : "❌ FAIL"} — expected ACCEPT\x1b[0m`);

    // TEST 2 — halal BLOCK
    const d2 = await runTest(
      "TEST 2 — halal constraint BLOCK",
      "find me a good burger near Marina Bay Sands under $30",
      MOCK_HALAL_CONTRACT
    );
    console.log(`\n\x1b[${d2.decision === "BLOCK" ? "32" : "31"}m${d2.decision === "BLOCK" ? "✅ PASS" : "⚠️  NOTE"} — expected BLOCK (burger may or may not be halal certified)\x1b[0m`);

    console.log("\n\x1b[1m✅ E2E test complete. Add DB + run migrations to enable full persistence.\x1b[0m\n");
  } catch (err) {
    console.error("\n\x1b[31m❌ E2E test failed:\x1b[0m", err);
    process.exit(1);
  }
}

main();
