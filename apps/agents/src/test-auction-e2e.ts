import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import { runAuctionPipeline } from "./agents/auction";
import { runGovernance } from "./agents/governance";
import { confirmHeldTransaction } from "./tools/stripe";
import { FLIGHT_VENDORS } from "./agents/vendors/flight-vendors";
import type { SpendingContract, VendorAnchor } from "./agents/types";

const INTENT =
  "affordable comfortable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD";

const TRAVEL_CONTRACT: SpendingContract = {
  id: "00000000-0000-0000-0000-000000000010",
  name: "Travel contract",
  budgetCap: 300,
  budgetPeriod: "per_transaction",
  categoryConstraints: [],
  vendorBlocklist: [],
  vendorAllowlist: [],
  riskThreshold: "low",
  active: true,
  createdAt: new Date().toISOString(),
};

const TIGHT_CONTRACT: SpendingContract = {
  ...TRAVEL_CONTRACT,
  id: "00000000-0000-0000-0000-000000000011",
  name: "Tight travel contract",
  budgetCap: 150,
};

function mockAnchors(): { anchors: VendorAnchor[]; profiles: typeof FLIGHT_VENDORS; category: "flight" } {
  const prices: Record<string, number> = {
    Traveloka: 268, Skyscanner: 255, "Trip.com": 279, Scoot: 242, AirAsia: 259,
  };
  return {
    anchors: FLIGHT_VENDORS.map((p, i) => ({
      vendorId: `e2e-${p.slug}-${i}`,
      vendor: p.name,
      publishedPrice: prices[p.name],
      currency: "SGD",
      itemSummary: "SIN→KUL direct, 1 adult, economy, tomorrow",
      sourceUrl: `https://www.${p.domains[0]}/`,
    })),
    profiles: FLIGHT_VENDORS,
    category: "flight",
  };
}

function box(title: string) {
  const line = "─".repeat(60);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title.padEnd(58)}│`);
  console.log(`└${line}┘`);
}

async function main() {
  console.log("\n\x1b[1m🔨 AgentBid Auction E2E Test (DB-bypass mode)\x1b[0m");
  let failed = false;

  // ── TEST 1 — live Exa anchor discovery → full auction → ACCEPT + Stripe ──
  box("TEST 1 — live discovery → auction → governance ACCEPT");
  let outcome;
  let parsedIntent;
  try {
    const r = await runAuctionPipeline(INTENT, "e2e-auction-live");
    outcome = r.outcome;
    parsedIntent = r.intent;
    console.log(`  ✓ LIVE Exa anchors: ${outcome.anchors.map((a) => `${a.vendor}=SGD ${a.publishedPrice}`).join(", ")}`);
    if (outcome.skipped.length) {
      console.log(`  ⚠ skipped (no live fare): ${outcome.skipped.map((s) => s.vendor).join(", ")}`);
    }
  } catch (err) {
    // <2 real anchors aborting loudly is designed behavior — fall back to mock
    // anchors so governance + Stripe coverage still runs.
    console.log(`  ⚠ live discovery aborted (${String(err).slice(0, 120)})`);
    console.log("  → continuing with mock anchors to cover bidding/governance/Stripe");
    const r = await runAuctionPipeline(INTENT, "e2e-auction-mock", undefined, mockAnchors());
    outcome = r.outcome;
    parsedIntent = r.intent;
  }

  const winner = outcome.winner;
  console.log(`  ✓ Winner: ${winner.vendor} — ${winner.item} @ SGD ${winner.price} (score ${winner.score})`);
  console.log(`  ✓ Rounds: ${outcome.rounds.length}, final bids: ${outcome.rounds[1].bids.length}`);

  const d1 = await runGovernance(winner, parsedIntent, TRAVEL_CONTRACT);
  console.log(`  Decision: ${d1.decision} | Stripe PI: ${d1.stripePaymentIntentId ?? "—"}`);
  for (const r of d1.checkedRules) console.log(`    ${r.passed ? "✓" : "✗"} [${r.rule}] ${r.detail.slice(0, 90)}`);

  if (winner.price <= TRAVEL_CONTRACT.budgetCap && d1.decision !== "ACCEPT") {
    console.log("\x1b[31m  ❌ expected ACCEPT for in-budget winner\x1b[0m");
    failed = true;
  } else if (d1.decision === "ACCEPT" && !d1.stripePaymentIntentId) {
    console.log("\x1b[31m  ❌ ACCEPT but no Stripe PaymentIntent\x1b[0m");
    failed = true;
  } else {
    console.log("\x1b[32m  ✅ PASS\x1b[0m");
  }

  // ── TEST 2 — tight cap → BLOCK → held PI → override releases it ──────────
  box("TEST 2 — cap SGD 150 → BLOCK → Stripe hold → override");
  const { outcome: o2, intent: i2 } = await runAuctionPipeline(
    INTENT,
    "e2e-auction-block",
    undefined,
    mockAnchors()
  );
  const d2 = await runGovernance(o2.winner, i2, TIGHT_CONTRACT);
  console.log(`  Decision: ${d2.decision} | Stripe PI: ${d2.stripePaymentIntentId ?? "—"}`);

  if (d2.decision !== "BLOCK") {
    console.log(`\x1b[31m  ❌ expected BLOCK (winner SGD ${o2.winner.price} vs cap 150)\x1b[0m`);
    failed = true;
  } else if (!d2.stripePaymentIntentId) {
    console.log("\x1b[31m  ❌ BLOCK but no held Stripe PaymentIntent\x1b[0m");
    failed = true;
  } else {
    console.log("  → overriding held PaymentIntent…");
    await confirmHeldTransaction(d2.stripePaymentIntentId, "e2e-test-user");
    console.log("\x1b[32m  ✅ PASS — BLOCK held, override confirmed via Stripe\x1b[0m");
  }

  console.log(failed ? "\n\x1b[31m❌ AUCTION E2E FAILED\x1b[0m\n" : "\n\x1b[1m✅ AUCTION E2E PASSED\x1b[0m\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("\n\x1b[31m❌ auction e2e crashed:\x1b[0m", err);
  process.exit(1);
});
