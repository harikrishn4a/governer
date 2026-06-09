"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllContracts = getAllContracts;
exports.getActiveContract = getActiveContract;
exports.createContract = createContract;
exports.updateContract = updateContract;
exports.getContractSpend = getContractSpend;
exports.saveTransaction = saveTransaction;
exports.getTransaction = getTransaction;
exports.getTransactionsByContract = getTransactionsByContract;
exports.overrideTransaction = overrideTransaction;
exports.saveAuditEvent = saveAuditEvent;
const pg_1 = require("pg");
let pool = null;
function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL env var is not set");
        }
        pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
        });
    }
    return pool;
}
// ── Contracts ──────────────────────────────────────────────────────────────
async function getAllContracts() {
    const { rows } = await getPool().query(`SELECT id, name, budget_cap, budget_period, category_constraints,
            vendor_blocklist, vendor_allowlist, risk_threshold, active, created_at
     FROM spending_contracts ORDER BY created_at DESC`);
    return rows.map(rowToContract);
}
async function getActiveContract(contractId) {
    const q = contractId
        ? `SELECT * FROM spending_contracts WHERE id = $1 AND active = true LIMIT 1`
        : `SELECT * FROM spending_contracts WHERE active = true ORDER BY created_at ASC LIMIT 1`;
    const params = contractId ? [contractId] : [];
    const { rows } = await getPool().query(q, params);
    if (!rows[0])
        throw new Error("No active spending contract found");
    return rowToContract(rows[0]);
}
async function createContract(c) {
    const { rows } = await getPool().query(`INSERT INTO spending_contracts
       (name, budget_cap, budget_period, category_constraints, vendor_blocklist, vendor_allowlist, risk_threshold, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [c.name, c.budgetCap, c.budgetPeriod, c.categoryConstraints, c.vendorBlocklist,
        c.vendorAllowlist, c.riskThreshold, c.active]);
    return rowToContract(rows[0]);
}
async function updateContract(id, patch) {
    const fields = [];
    const values = [];
    let i = 1;
    if (patch.name !== undefined) {
        fields.push(`name=$${i++}`);
        values.push(patch.name);
    }
    if (patch.budgetCap !== undefined) {
        fields.push(`budget_cap=$${i++}`);
        values.push(patch.budgetCap);
    }
    if (patch.budgetPeriod !== undefined) {
        fields.push(`budget_period=$${i++}`);
        values.push(patch.budgetPeriod);
    }
    if (patch.categoryConstraints !== undefined) {
        fields.push(`category_constraints=$${i++}`);
        values.push(patch.categoryConstraints);
    }
    if (patch.vendorBlocklist !== undefined) {
        fields.push(`vendor_blocklist=$${i++}`);
        values.push(patch.vendorBlocklist);
    }
    if (patch.vendorAllowlist !== undefined) {
        fields.push(`vendor_allowlist=$${i++}`);
        values.push(patch.vendorAllowlist);
    }
    if (patch.riskThreshold !== undefined) {
        fields.push(`risk_threshold=$${i++}`);
        values.push(patch.riskThreshold);
    }
    if (patch.active !== undefined) {
        fields.push(`active=$${i++}`);
        values.push(patch.active);
    }
    values.push(id);
    const { rows } = await getPool().query(`UPDATE spending_contracts SET ${fields.join(",")} WHERE id=$${i} RETURNING *`, values);
    return rowToContract(rows[0]);
}
// ── Period spend ────────────────────────────────────────────────────────────
async function getContractSpend(contractId, period) {
    let since;
    const now = new Date();
    if (period === "daily") {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }
    else if (period === "weekly") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        since = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
    }
    else if (period === "monthly") {
        since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    else {
        return 0; // per_transaction: no cumulative spend check needed
    }
    const { rows } = await getPool().query(`SELECT COALESCE(SUM(winner_price),0) AS total FROM transactions
     WHERE contract_id=$1 AND governance_decision='ACCEPT' AND created_at >= $2`, [contractId, since]);
    return parseFloat(rows[0]?.total ?? "0");
}
// ── Transactions ────────────────────────────────────────────────────────────
async function saveTransaction(tx) {
    const { rows } = await getPool().query(`INSERT INTO transactions
       (user_intent, contract_id, winner_vendor, winner_item, winner_price,
        governance_decision, rationale, checked_rules, requires_human_review,
        stripe_payment_intent_id, stripe_status, full_result)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [tx.user_intent, tx.contract_id, tx.winner_vendor, tx.winner_item, tx.winner_price,
        tx.governance_decision, tx.rationale, JSON.stringify(tx.checked_rules),
        tx.requires_human_review, tx.stripe_payment_intent_id ?? null,
        tx.stripe_status ?? null, JSON.stringify(tx.full_result)]);
    return rows[0].id;
}
async function getTransaction(id) {
    const { rows } = await getPool().query(`SELECT * FROM transactions WHERE id=$1`, [id]);
    return rows[0] ? rowToTransaction(rows[0]) : null;
}
async function getTransactionsByContract(contractId) {
    const { rows } = await getPool().query(`SELECT * FROM transactions WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 100`, [contractId]);
    return rows.map(rowToTransaction);
}
async function overrideTransaction(id, approvedBy, stripeStatus) {
    await getPool().query(`UPDATE transactions SET overridden_by=$1, overridden_at=NOW(), stripe_status=$2 WHERE id=$3`, [approvedBy, stripeStatus, id]);
}
// ── Audit events ────────────────────────────────────────────────────────────
async function saveAuditEvent(event) {
    await getPool().query(`INSERT INTO audit_events (transaction_id, contract_id, event_type, detail, actor)
     VALUES ($1,$2,$3,$4,$5)`, [event.transaction_id ?? null, event.contract_id ?? null,
        event.event_type, event.detail, event.actor ?? "system"]);
}
// ── Row mappers ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToContract(r) {
    return {
        id: r.id,
        name: r.name,
        budgetCap: parseFloat(r.budget_cap),
        budgetPeriod: r.budget_period,
        categoryConstraints: r.category_constraints ?? [],
        vendorBlocklist: r.vendor_blocklist ?? [],
        vendorAllowlist: r.vendor_allowlist ?? [],
        riskThreshold: r.risk_threshold,
        active: r.active,
        createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTransaction(r) {
    return {
        id: r.id,
        user_intent: r.user_intent,
        contract_id: r.contract_id,
        winner_vendor: r.winner_vendor,
        winner_item: r.winner_item,
        winner_price: parseFloat(r.winner_price),
        governance_decision: r.governance_decision,
        rationale: r.rationale,
        checked_rules: typeof r.checked_rules === "string" ? JSON.parse(r.checked_rules) : r.checked_rules,
        requires_human_review: r.requires_human_review,
        overridden_by: r.overridden_by ?? null,
        overridden_at: r.overridden_at?.toISOString?.() ?? r.overridden_at ?? null,
        stripe_payment_intent_id: r.stripe_payment_intent_id ?? null,
        stripe_status: r.stripe_status ?? null,
        full_result: typeof r.full_result === "string" ? JSON.parse(r.full_result) : r.full_result,
        created_at: r.created_at?.toISOString?.() ?? String(r.created_at),
    };
}
