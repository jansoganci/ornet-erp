-- 00085_soft_delete_customers.sql
-- Add soft delete support to customers table
--
-- Note: account_number was dropped in 00006_rebuild_customers.sql and
-- never re-added, so there is no unique constraint to convert here.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active customers only
CREATE INDEX IF NOT EXISTS idx_customers_active
  ON customers (company_name)
  WHERE deleted_at IS NULL;

-- Recreate select policy with deleted_at filter
DROP POLICY IF EXISTS "customers_select_authenticated" ON customers;
CREATE POLICY "customers_select_authenticated"
  ON customers FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Recreate update policy with deleted_at filter
DROP POLICY IF EXISTS "customers_update_authenticated" ON customers;
CREATE POLICY "customers_update_authenticated"
  ON customers FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);
