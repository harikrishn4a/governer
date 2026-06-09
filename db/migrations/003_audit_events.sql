CREATE TABLE IF NOT EXISTS audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(id),
  contract_id     UUID REFERENCES spending_contracts(id),
  event_type      TEXT NOT NULL,
  detail          TEXT NOT NULL,
  actor           TEXT NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_contract     ON audit_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_transaction  ON audit_events(transaction_id);
