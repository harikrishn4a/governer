CREATE TABLE IF NOT EXISTS transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_intent               TEXT NOT NULL,
  contract_id               UUID REFERENCES spending_contracts(id),
  winner_vendor             TEXT NOT NULL,
  winner_item               TEXT NOT NULL,
  winner_price              NUMERIC(10,2) NOT NULL,
  governance_decision       TEXT NOT NULL,
  rationale                 TEXT NOT NULL,
  checked_rules             JSONB NOT NULL DEFAULT '[]',
  requires_human_review     BOOLEAN NOT NULL DEFAULT false,
  overridden_by             TEXT,
  overridden_at             TIMESTAMPTZ,
  stripe_payment_intent_id  TEXT,
  stripe_status             TEXT,
  full_result               JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_contract ON transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(created_at);
