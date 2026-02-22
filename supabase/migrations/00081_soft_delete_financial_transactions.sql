-- 00081_soft_delete_financial_transactions.sql
-- Add soft delete support to financial_transactions table

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active transactions only
CREATE INDEX IF NOT EXISTS idx_financial_transactions_active
  ON financial_transactions (period, direction)
  WHERE deleted_at IS NULL;

-- Recreate ft_select policy with deleted_at filter
DROP POLICY IF EXISTS ft_select ON financial_transactions;
CREATE POLICY ft_select ON financial_transactions
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
  );

-- Recreate ft_update policy with deleted_at filter
DROP POLICY IF EXISTS ft_update ON financial_transactions;
CREATE POLICY ft_update ON financial_transactions
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
  );
