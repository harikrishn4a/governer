CREATE TABLE IF NOT EXISTS spending_contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  budget_cap    NUMERIC(10,2) NOT NULL,
  budget_period TEXT NOT NULL DEFAULT 'per_transaction',
  category_constraints  TEXT[] NOT NULL DEFAULT '{}',
  vendor_blocklist      TEXT[] NOT NULL DEFAULT '{}',
  vendor_allowlist      TEXT[] NOT NULL DEFAULT '{}',
  risk_threshold        TEXT NOT NULL DEFAULT 'medium',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO spending_contracts (name, budget_cap, budget_period, risk_threshold)
VALUES ('Default contract', 100.00, 'per_transaction', 'low')
ON CONFLICT DO NOTHING;
