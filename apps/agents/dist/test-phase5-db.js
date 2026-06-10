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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: `${__dirname}/../../../.env` });
const db_1 = require("./tools/db");
const governance_1 = require("./agents/governance");
const MOCK_WINNER = {
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
const MOCK_INTENT = {
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
    const contract = await (0, db_1.getActiveContract)(contractId);
    console.log(`✓ Contract loaded: ${contract.name} (${contract.id})`);
    const decision = await (0, governance_1.runGovernance)(MOCK_WINNER, MOCK_INTENT, contract);
    console.log(`✓ Governance: ${decision.decision}`);
    const txId = await (0, db_1.saveTransaction)({
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
    await (0, db_1.saveAuditEvent)({
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
