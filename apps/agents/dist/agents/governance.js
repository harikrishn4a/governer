"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGovernance = runGovernance;
const llm_1 = require("../lib/llm");
const logger_1 = require("../lib/logger");
const db_1 = require("../tools/db");
const stripe_1 = require("../tools/stripe");
async function checkIntentMatch(winner, intent) {
    const prompt = `User asked for: "${intent.raw}"
Winning item: ${winner.vendor} — ${winner.item} (${winner.description})
Does this item genuinely match what the user asked for? Answer YES or NO on the first line, then explain briefly.`;
    const reply = await (0, llm_1.llmCall)({
        system: "You are a procurement auditor checking whether a selected item matches the buyer's intent. Be strict.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 256,
    });
    const passed = reply.trim().toUpperCase().startsWith("YES");
    const rule = { rule: "INTENT_MATCH", passed, detail: reply.trim().slice(0, 300) };
    logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail.slice(0, 120) });
    return rule;
}
async function checkBudget(winner, contract) {
    let rule;
    if (contract.budgetPeriod === "per_transaction") {
        const passed = winner.price <= contract.budgetCap;
        rule = {
            rule: "BUDGET_CAP",
            passed,
            detail: passed
                ? `SGD ${winner.price} ≤ cap SGD ${contract.budgetCap} (per_transaction)`
                : `SGD ${winner.price} exceeds cap SGD ${contract.budgetCap} (per_transaction)`,
        };
    }
    else {
        const periodSpend = await (0, db_1.getContractSpend)(contract.id, contract.budgetPeriod);
        const total = periodSpend + winner.price;
        const passed = total <= contract.budgetCap;
        rule = {
            rule: "BUDGET_CAP",
            passed,
            detail: passed
                ? `Period spend SGD ${periodSpend.toFixed(2)} + SGD ${winner.price} = SGD ${total.toFixed(2)} ≤ cap SGD ${contract.budgetCap} (${contract.budgetPeriod})`
                : `Period spend SGD ${periodSpend.toFixed(2)} + SGD ${winner.price} = SGD ${total.toFixed(2)} exceeds cap SGD ${contract.budgetCap} (${contract.budgetPeriod})`,
        };
    }
    logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail });
    return rule;
}
async function checkCategoryConstraints(winner, constraints) {
    return Promise.all(constraints.map(async (constraint) => {
        const reply = await (0, llm_1.llmCall)({
            system: "You are a procurement compliance checker. Answer YES if the item satisfies the constraint, NO if it does not, or UNCERTAIN if you cannot determine. First line must be YES, NO, or UNCERTAIN.",
            messages: [
                {
                    role: "user",
                    content: `Constraint: "${constraint}"\nItem: ${winner.vendor} — ${winner.item}\nDescription: ${winner.description}\nDoes this item satisfy the constraint?`,
                },
            ],
            maxTokens: 200,
        });
        const first = reply.trim().split("\n")[0].toUpperCase();
        const passed = first.startsWith("YES");
        const rule = {
            rule: `CATEGORY_CONSTRAINT: ${constraint}`,
            passed,
            detail: reply.trim().slice(0, 300),
        };
        logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail.slice(0, 120) });
        return rule;
    }));
}
function checkVendorBlocklist(winner, blocklist) {
    const vendorLower = winner.vendor.toLowerCase();
    const blocked = blocklist.some((b) => vendorLower.includes(b.toLowerCase()));
    const rule = {
        rule: "VENDOR_BLOCKLIST",
        passed: !blocked,
        detail: blocked
            ? `Vendor "${winner.vendor}" matches blocklist entry`
            : `Vendor "${winner.vendor}" not in blocklist (${blocklist.length} entries checked)`,
    };
    logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail });
    return rule;
}
async function checkVendorLegitimacy(winner) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(winner.order_url, { method: "HEAD", signal: controller.signal });
        clearTimeout(timeout);
        const passed = res.status < 400;
        const rule = {
            rule: "VENDOR_LEGITIMACY",
            passed: true, // warning only — never a hard block
            detail: passed
                ? `URL ${winner.order_url} returned HTTP ${res.status}`
                : `URL ${winner.order_url} returned HTTP ${res.status} — flagged as suspicious`,
        };
        logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail });
        return rule;
    }
    catch (err) {
        logger_1.logger.warn("governance:legitimacy-check — URL unreachable (warning only)", {
            url: winner.order_url,
            error: String(err).slice(0, 120),
        });
        const rule = {
            rule: "VENDOR_LEGITIMACY",
            passed: true,
            detail: `URL check failed for ${winner.order_url} — flagged for review (not a hard block)`,
        };
        logger_1.logger.info("governance:rule-check", { rule: rule.rule, passed: rule.passed, detail: rule.detail });
        return rule;
    }
}
async function runGovernance(winner, intent, contract) {
    logger_1.logger.section("PHASE 5 — GOVERNANCE EVALUATION");
    logger_1.logger.info("governance:start", {
        vendor: winner.vendor,
        item: winner.item,
        price: `SGD ${winner.price}`,
        contractName: contract.name,
        contractId: contract.id,
        budgetCap: `SGD ${contract.budgetCap} / ${contract.budgetPeriod}`,
        categoryConstraints: contract.categoryConstraints.length ? contract.categoryConstraints : "(none)",
        vendorBlocklist: contract.vendorBlocklist.length ? contract.vendorBlocklist : "(none)",
        riskThreshold: contract.riskThreshold,
    });
    const checkedRules = [];
    logger_1.logger.info("governance:checking — RULE 1: INTENT_MATCH");
    const intentRule = await checkIntentMatch(winner, intent);
    checkedRules.push(intentRule);
    logger_1.logger.info("governance:checking — RULE 2: BUDGET_CAP");
    const budgetRule = await checkBudget(winner, contract);
    checkedRules.push(budgetRule);
    if (contract.categoryConstraints.length > 0) {
        logger_1.logger.info("governance:checking — RULE 3: CATEGORY_CONSTRAINTS", {
            constraints: contract.categoryConstraints,
        });
        const categoryRules = await checkCategoryConstraints(winner, contract.categoryConstraints);
        checkedRules.push(...categoryRules);
    }
    logger_1.logger.info("governance:checking — RULE 4: VENDOR_BLOCKLIST");
    const blocklistRule = checkVendorBlocklist(winner, contract.vendorBlocklist);
    checkedRules.push(blocklistRule);
    logger_1.logger.info("governance:checking — RULE 5: VENDOR_LEGITIMACY (warning-only)");
    const legitimacyRule = await checkVendorLegitimacy(winner);
    checkedRules.push(legitimacyRule);
    const failedRules = checkedRules.filter((r) => !r.passed);
    const decision = failedRules.length === 0 ? "ACCEPT" : "BLOCK";
    const rationale = decision === "ACCEPT"
        ? `All ${checkedRules.length} governance rules passed. Approved: ${winner.vendor} — ${winner.item} at SGD ${winner.price}.`
        : `BLOCKED — ${failedRules.length} rule(s) failed: ${failedRules.map((r) => r.rule).join(", ")}. ${failedRules[0].detail}`;
    logger_1.logger.info("governance:decision", {
        decision,
        totalRules: checkedRules.length,
        passed: checkedRules.filter(r => r.passed).length,
        failed: failedRules.length,
        failedRules: failedRules.map(r => r.rule),
        rationale,
    });
    // ── Stripe execution ──────────────────────────────────────────────────────
    let stripePaymentIntentId;
    if (process.env.STRIPE_SECRET_KEY) {
        logger_1.logger.section("PHASE 6 — STRIPE PAYMENT INTENT");
        try {
            if (decision === "ACCEPT") {
                logger_1.logger.info("stripe:creating — ACCEPT: confirm payment immediately", {
                    vendor: winner.vendor,
                    amount: `SGD ${winner.price}`,
                    method: "pm_card_visa",
                });
                stripePaymentIntentId = await (0, stripe_1.executeAcceptedTransaction)(winner, contract.id, rationale);
                logger_1.logger.info("stripe:created — ACCEPT", {
                    piId: stripePaymentIntentId,
                    status: "succeeded",
                });
            }
            else {
                logger_1.logger.info("stripe:creating — BLOCK: hold payment pending human review", {
                    vendor: winner.vendor,
                    amount: `SGD ${winner.price}`,
                    captureMethod: "manual",
                });
                stripePaymentIntentId = await (0, stripe_1.executeBlockedTransaction)(winner, contract.id, rationale);
                logger_1.logger.info("stripe:created — BLOCK", {
                    piId: stripePaymentIntentId,
                    status: "requires_confirmation",
                    note: "Use POST /override to release",
                });
            }
        }
        catch (stripeErr) {
            logger_1.logger.error("stripe:failed — PaymentIntent creation error", { error: String(stripeErr) });
        }
    }
    else {
        logger_1.logger.warn("stripe:skipped — STRIPE_SECRET_KEY not set");
    }
    return {
        decision,
        rationale,
        contractId: contract.id,
        checkedRules,
        requiresHumanReview: decision === "BLOCK",
        stripePaymentIntentId,
    };
}
