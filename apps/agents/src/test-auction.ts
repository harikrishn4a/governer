import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../../../.env` });

import { runAuctionPipeline, isFlightIntent } from "./agents/auction";
import { FLIGHT_VENDORS } from "./agents/vendors/flight-vendors";
import type { AgentEvent, VendorAnchor, VendorProfile } from "./agents/types";

const dline = "═".repeat(62);

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// Mock anchors injected via anchorsOverride — deterministic bidder setup, no
// Exa calls; only the bidder/judge LLM calls run live.
function mockFlightAnchors(): { anchors: VendorAnchor[]; profiles: VendorProfile[] } {
  const prices: Record<string, number> = {
    Traveloka: 268,
    Skyscanner: 255,
    "Trip.com": 279,
    Scoot: 242,
    AirAsia: 259,
  };
  const anchors: VendorAnchor[] = FLIGHT_VENDORS.map((p, i) => ({
    vendorId: `mock-${p.slug}-${i}`,
    vendor: p.name,
    publishedPrice: prices[p.name],
    currency: "SGD",
    itemSummary: "SIN→KUL direct, 1 adult, economy, tomorrow",
    sourceUrl: `https://www.${p.domains[0]}/`,
  }));
  return { anchors, profiles: FLIGHT_VENDORS };
}

async function main() {
  console.log("\n" + dline);
  console.log("  AgentBid — Auction Mode Test Harness");
  console.log(dline + "\n");

  // ── 1. Flight-intent detection ──────────────────────────────────────────
  console.log("[1] Flight path detection");
  check(
    "flight intent detected",
    isFlightIntent({ raw: "direct flight to Malaysia tomorrow under $300 SGD" })
  );
  check(
    "generic intent not flagged as flight",
    !isFlightIntent({ raw: "catering for 20 people under $400", category: "food" })
  );

  // ── 2. Full auction over mock anchors (live bidder + judge LLM calls) ───
  console.log("\n[2] Auction rounds + judge (mock anchors, live LLM)");
  const { anchors, profiles } = mockFlightAnchors();
  const events: AgentEvent[] = [];

  const { outcome } = await runAuctionPipeline(
    "affordable comfortable direct flight to Kuala Lumpur tomorrow, 1 adult, under $300 SGD",
    "test-auction-tx",
    (e) => {
      events.push(e);
    },
    { anchors, profiles, category: "flight" }
  );

  check("2 rounds ran", outcome.rounds.length === 2);
  check("round 1 is sealed", outcome.rounds[0].kind === "sealed");
  check("round 2 is final", outcome.rounds[1].kind === "final");

  for (const round of outcome.rounds) {
    check(
      `round ${round.round}: all ${profiles.length} bidders bid`,
      round.bids.length === profiles.length,
      `${round.bids.length}/${profiles.length}`
    );
    for (const bid of round.bids) {
      const anchor = anchors.find((a) => a.vendorId === bid.vendorId)!;
      const ratio = bid.price / anchor.publishedPrice;
      check(
        `round ${round.round} ${bid.vendor}: structurally valid + sane vs published`,
        bid.price > 0 && bid.pitch.trim().length > 0 && ratio >= 0.5 && ratio <= 1.2,
        `SGD ${bid.price} (${(ratio * 100).toFixed(0)}% of published ${anchor.publishedPrice})`
      );
    }
  }

  const r1 = new Map(outcome.rounds[0].bids.map((b) => [b.vendorId, b.price]));
  const undercuts = outcome.rounds[1].bids.filter((b) => b.price < (r1.get(b.vendorId) ?? Infinity));
  check("≥1 round-2 counter-bid undercuts its round-1 offer", undercuts.length >= 1,
    undercuts.map((b) => `${b.vendor} ${r1.get(b.vendorId)}→${b.price}`).join("; ") || "none");

  // ── 3. Judge + winner normalization ─────────────────────────────────────
  console.log("\n[3] Judge ranking + winner");
  const ev = outcome.evaluation;
  check("ranking covers all bidders", ev.ranking.length === profiles.length, `${ev.ranking.length}`);
  check("scores within 0-100", ev.ranking.every((r) => r.score >= 0 && r.score <= 100));
  check("verdict non-empty", ev.verdict.trim().length > 0);

  const inBudgetExists = outcome.rounds[1].bids.some((b) => b.price <= 300);
  const w = outcome.winner;
  if (inBudgetExists) check("winner in budget when satisfiable", w.price <= 300, `SGD ${w.price}`);

  check(
    "winner is a complete WinnerPaymentIntent",
    !!(w.vendor && w.item && w.price > 0 && w.order_url && w.procurementRationale && w.currency),
  );
  check("winner transcript has both rounds", (w.conversation ?? []).length === 2);
  check("winner ranking attached", (w.ranking ?? []).length === profiles.length);

  // ── 4. SSE event vocabulary ──────────────────────────────────────────────
  console.log("\n[4] Event stream");
  const types = (t: string, agent?: string) =>
    events.filter((e) => e.type === t && (!agent || e.agent === agent)).length;
  check("agent:start auction emitted", types("agent:start", "auction") === 1);
  check("tender complete emitted", types("agent:complete", "tender") === 1);
  check("anchor events emitted per bidder", types("auction:anchor") === profiles.length);
  check("2 round_start events", types("auction:round_start") === 2);
  check("2 round_complete events", types("auction:round_complete") === 2);
  check("bid events ≥ bidders × rounds", types("auction:bid") >= profiles.length * 2,
    String(types("auction:bid")));
  check("judge complete emitted", types("agent:complete", "auction_judge") === 1);

  // ── 5. Abort behavior with <2 anchors ────────────────────────────────────
  console.log("\n[5] <2 anchors aborts loudly");
  let aborted = false;
  try {
    await runAuctionPipeline("flight to KL tomorrow", "test-abort-tx", undefined, {
      anchors: anchors.slice(0, 1),
      profiles,
      category: "flight",
    });
  } catch (err) {
    aborted = String(err).includes("at least 2 vendors");
  }
  check("aborts with explicit error", aborted);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + dline);
  if (failures === 0) {
    console.log("  ✅ VALIDATION PASSED — auction pipeline OK");
    console.log(dline + "\n");
    process.exit(0);
  } else {
    console.log(`  ❌ VALIDATION FAILED — ${failures} check(s) failed`);
    console.log(dline + "\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ test-auction crashed:", err);
  process.exit(1);
});
