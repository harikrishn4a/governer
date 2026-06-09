import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function getAllContracts() {
  const { rows } = await getPool().query(
    "SELECT * FROM spending_contracts ORDER BY created_at DESC"
  );
  return rows;
}

export async function createContract(data: Record<string, unknown>) {
  const { rows } = await getPool().query(
    `INSERT INTO spending_contracts
      (name, budget_cap, budget_period, category_constraints, vendor_blocklist, vendor_allowlist, risk_threshold, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      data.name,
      data.budget_cap,
      data.budget_period ?? "per_transaction",
      data.category_constraints ?? [],
      data.vendor_blocklist ?? [],
      data.vendor_allowlist ?? [],
      data.risk_threshold ?? "medium",
      data.active ?? true,
    ]
  );
  return rows[0];
}

export async function updateContract(id: string, data: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, val] of Object.entries(data)) {
    fields.push(`${key} = $${i++}`);
    values.push(val);
  }
  fields.push(`updated_at = NOW()`);
  values.push(id);
  const { rows } = await getPool().query(
    `UPDATE spending_contracts SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0];
}

export async function getAllTransactions() {
  const { rows } = await getPool().query(
    "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100"
  );
  return rows;
}

export async function getTransaction(id: string) {
  const { rows } = await getPool().query(
    "SELECT * FROM transactions WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}
