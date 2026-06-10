import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import { runGovernance } from "./agents/governance";
import { DEFAULT_FLEXIBILITY_RULES } from "./agents/types";
import type { SpendingContract, WinnerPaymentIntent, UserIntent } from "./agents/types";

function box(title: string) {
  const line = "─".repeat(70);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title.padEnd(68)}│`);
  console.log(`└${line}┘`);
}

const testIntent: UserIntent = {
  raw: "lunch near office",
  category: "food",
  budget: 30,
  currency: "SGD",
};

const testWinner: WinnerPaymentIntent = {
  id: "test-1",
  vendor: "Halal Bihalal Kitchen",
  item: "Nasi kuning with satay",
  description: "Indonesian halal dish",
  price: 28,
  currency: "SGD",
  link: "https://www.google.com",
  order_url: "https://www.google.com",
  metadata: {},
  withinBudget: true,
  procurementRationale: "Best value halal option",
  score: 85,
  rankedAlternatives: [],
};

async function main() {
  console.log("\n\x1b[1m🔨 FlexibilityRules Governance Test\x1b[0m");
  let passed = 0;
  let failed = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO A: Strict custom rule (halal only) — should BLOCK non-halal
  // ─────────────────────────────────────────────────────────────────────────
  box("SCENARIO A — Custom rule: 'halal only' — non-halal vendor");

  const contractA: SpendingContract = {
    id: "test-a",
    name: "Halal Dietary Contract",
    budgetCap: 30,
    budgetPeriod: "per_transaction",
    categoryConstraints: [],
    vendorBlocklist: [],
    vendorAllowlist: [],
    riskThreshold: "medium",
    flexibilityRules: {
      ...DEFAULT_FLEXIBILITY_RULES,
      custom: ["This must be a halal-certified meal"],
    },
    active: true,
    createdAt: new Date().toISOString(),
  };

  const winnerA: WinnerPaymentIntent = {
    ...testWinner,
    vendor: "Non-Halal Deli",
    item: "Pork sandwich",
    description: "Non-halal deli sandwich",
    order_url: "https://www.google.com",
  };

  try {
    const decisionA = await runGovernance(winnerA, testIntent, contractA);
    console.log(`\n  Decision: ${decisionA.decision}`);
    for (const rule of decisionA.checkedRules) {
      const status = rule.passed ? "✓" : "✗";
      console.log(`    ${status} [${rule.rule}] ${rule.detail.slice(0, 80)}`);
    }

    if (decisionA.decision === "BLOCK") {
      console.log("\n  ✅ PASS — Custom rule blocked non-halal vendor as expected");
      passed++;
    } else {
      console.log("\n  ❌ FAIL — Expected BLOCK for non-halal vendor");
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${String(err).slice(0, 100)}`);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO B: Flexible pricing (15% tolerance) — should PASS overspend
  // ─────────────────────────────────────────────────────────────────────────
  box("SCENARIO B — Flexible pricing: 15% tolerance — 10% over budget");

  const contractB: SpendingContract = {
    id: "test-b",
    name: "Flexible Lunch Budget",
    budgetCap: 30,
    budgetPeriod: "per_transaction",
    categoryConstraints: [],
    vendorBlocklist: [],
    vendorAllowlist: [],
    riskThreshold: "medium",
    flexibilityRules: {
      ...DEFAULT_FLEXIBILITY_RULES,
      price: { hardCap: false, overspendTolerancePct: 15 },
    },
    active: true,
    createdAt: new Date().toISOString(),
  };

  const winnerB: WinnerPaymentIntent = {
    ...testWinner,
    price: 33, // 10% over $30 cap, within 15% tolerance
    description: "Premium halal option, 10% over budget but excellent value",
  };

  try {
    const decisionB = await runGovernance(winnerB, testIntent, contractB);
    console.log(`\n  Decision: ${decisionB.decision}`);
    for (const rule of decisionB.checkedRules) {
      const status = rule.passed ? "✓" : "✗";
      console.log(`    ${status} [${rule.rule}] ${rule.detail.slice(0, 80)}`);
    }

    if (decisionB.decision === "ACCEPT") {
      const budgetRule = decisionB.checkedRules.find(r => r.rule === "BUDGET_CAP");
      if (budgetRule && budgetRule.detail.includes("tolerance")) {
        console.log("\n  ✅ PASS — Overspend within tolerance accepted with note");
        passed++;
      } else {
        console.log("\n  ⚠️  PASS but no tolerance note in rationale");
        passed++;
      }
    } else {
      console.log("\n  ❌ FAIL — Expected ACCEPT for overspend within tolerance");
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${String(err).slice(0, 100)}`);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO C: Hard cap — should BLOCK any overspend
  // ─────────────────────────────────────────────────────────────────────────
  box("SCENARIO C — Hard cap enforced — 5% over budget");

  const contractC: SpendingContract = {
    id: "test-c",
    name: "Strict Budget Contract",
    budgetCap: 30,
    budgetPeriod: "per_transaction",
    categoryConstraints: [],
    vendorBlocklist: [],
    vendorAllowlist: [],
    riskThreshold: "strict",
    flexibilityRules: {
      ...DEFAULT_FLEXIBILITY_RULES,
      price: { hardCap: true, overspendTolerancePct: 0 },
    },
    active: true,
    createdAt: new Date().toISOString(),
  };

  const winnerC: WinnerPaymentIntent = {
    ...testWinner,
    price: 31.5, // 5% over $30 cap, but hardCap is true
  };

  try {
    const decisionC = await runGovernance(winnerC, testIntent, contractC);
    console.log(`\n  Decision: ${decisionC.decision}`);
    for (const rule of decisionC.checkedRules) {
      const status = rule.passed ? "✓" : "✗";
      console.log(`    ${status} [${rule.rule}] ${rule.detail.slice(0, 80)}`);
    }

    if (decisionC.decision === "BLOCK") {
      console.log("\n  ✅ PASS — Hard cap blocked any overspend");
      passed++;
    } else {
      console.log("\n  ❌ FAIL — Expected BLOCK with hard cap");
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${String(err).slice(0, 100)}`);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} scenarios: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("\x1b[1m✅ FLEXIBILITYRULES TEST PASSED\x1b[0m\n");
    process.exit(0);
  } else {
    console.log("\x1b[31m❌ FLEXIBILITYRULES TEST FAILED\x1b[0m\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31m❌ Test crashed:\x1b[0m", err);
  process.exit(1);
});
