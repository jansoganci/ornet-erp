-- 00084_soft_delete_site_assets.sql
-- Add soft delete support to site_assets table

ALTER TABLE site_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active assets only
CREATE INDEX IF NOT EXISTS idx_site_assets_active
  ON site_assets (site_id, status)
  WHERE deleted_at IS NULL;

-- Recreate select policy with deleted_at filter
-- site_assets_detail is security_invoker so RLS propagates through the view automatically
DROP POLICY IF EXISTS site_assets_select ON site_assets;
CREATE POLICY site_assets_select ON site_assets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Recreate update policy with deleted_at filter
DROP POLICY IF EXISTS site_assets_update ON site_assets;
CREATE POLICY site_assets_update ON site_assets
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'));
