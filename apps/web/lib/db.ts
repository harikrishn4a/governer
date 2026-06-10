import { Pool } from "pg";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import dns from "dns/promises";

// Resolve DATABASE_URL robustly. Next.js auto-loads apps/web/.env.local, but the
// server can be launched from different working directories (repo root, apps/web,
// Vercel) — so if the var isn't already present, search the common env-file
// locations relative to the cwd instead of assuming a single fixed path.
function ensureEnvLoaded(): void {
  if (process.env.DATABASE_URL) return; // already provided (Next .env.local, shell, Vercel)
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".env.local"),        // launched from apps/web
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "../../.env"),         // apps/web → repo root
    path.resolve(cwd, "../../.env.local"),
    path.resolve(cwd, "apps/web/.env.local"), // launched from repo root
    path.resolve(cwd, ".env.local"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      config({ path: p });
      if (process.env.DATABASE_URL) return;
    }
  }
}

ensureEnvLoaded();

let poolPromise: Promise<Pool> | null = null;

async function buildPool(): Promise<Pool> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to apps/web/.env.local (or the repo-root .env), " +
        "then restart the dev server."
    );
  }

  let connUrl = rawUrl;
  try {
    const u = new URL(rawUrl);
    const addrs = await dns.resolve4(u.hostname);
    if (addrs.length > 0) {
      connUrl = rawUrl.replace(u.hostname, addrs[0]);
      console.log(`[db] resolved ${u.hostname} → ${addrs[0]}`);
    }
  } catch (e) {
    console.warn("[db] dns.resolve4 failed, using raw URL:", (e as Error).message);
  }

  return new Pool({
    connectionString: connUrl,
    connectionTimeoutMillis: 5_000,
    ssl: rawUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
}

function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = buildPool();
  return poolPromise;
}

export async function getAllContracts() {
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM spending_contracts ORDER BY created_at DESC"
  );
  return rows;
}

export async function getContractById(id: string) {
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM spending_contracts WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createContract(data: Record<string, unknown>) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `INSERT INTO spending_contracts
      (name, budget_cap, budget_period, category_constraints, vendor_blocklist, vendor_allowlist, risk_threshold, flexibility_rules, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      data.name,
      data.budget_cap,
      data.budget_period ?? "per_transaction",
      data.category_constraints ?? [],
      data.vendor_blocklist ?? [],
      data.vendor_allowlist ?? [],
      data.risk_threshold ?? "medium",
      data.flexibility_rules ? JSON.stringify(data.flexibility_rules) : null,
      data.active ?? true,
    ]
  );
  return rows[0];
}

export async function updateContract(id: string, data: Record<string, unknown>) {
  const pool = await getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, val] of Object.entries(data)) {
    fields.push(`${key} = $${i++}`);
    if (key === "flexibility_rules" && val && typeof val === "object") {
      values.push(JSON.stringify(val));
    } else {
      values.push(val);
    }
  }
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE spending_contracts SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0];
}

export async function getAllTransactions() {
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100"
  );
  return rows;
}

export async function getTransaction(id: string) {
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM transactions WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteContract(id: string) {
  const pool = await getPool();
  const { rows } = await pool.query(
    "DELETE FROM spending_contracts WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0] ?? null;
}

export async function getContractSpend(contractId: string, period: string): Promise<number> {
  const pool = await getPool();
  let since: string;
  const now = new Date();
  if (period === "daily") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    since = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
  } else if (period === "monthly") {
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  } else {
    return 0;
  }
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(winner_price), 0) AS total FROM transactions
     WHERE contract_id = $1
       AND (governance_decision = 'ACCEPT' OR overridden_by IS NOT NULL)
       AND created_at >= $2`,
    [contractId, since]
  );
  return parseFloat(rows[0]?.total ?? "0");
}
