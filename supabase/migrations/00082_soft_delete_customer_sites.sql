-- 00082_soft_delete_customer_sites.sql
-- Add soft delete support to customer_sites table

ALTER TABLE customer_sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active sites only
CREATE INDEX IF NOT EXISTS idx_customer_sites_active
  ON customer_sites (customer_id)
  WHERE deleted_at IS NULL;

-- Recreate select policy with deleted_at filter
DROP POLICY IF EXISTS "customer_sites_select_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_select_authenticated"
  ON customer_sites FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Recreate update policy with deleted_at filter
DROP POLICY IF EXISTS "customer_sites_update_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_update_authenticated"
  ON customer_sites FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);
