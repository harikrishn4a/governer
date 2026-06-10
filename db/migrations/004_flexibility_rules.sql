-- Add flexibility_rules JSONB column to spending_contracts
ALTER TABLE spending_contracts
ADD COLUMN IF NOT EXISTS flexibility_rules JSONB DEFAULT NULL;

COMMENT ON COLUMN spending_contracts.flexibility_rules IS 'Structured rules defining flexibility on price, vendor, and intent dimensions';
