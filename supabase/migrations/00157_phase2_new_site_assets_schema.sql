-- Migration: 00157_phase2_new_site_assets_schema
-- Phase 2 of Asset Tracking Refactor: Create new quantity-based site_assets.
-- Depends on 00156 (Phase 1) having dropped the old tables.

-- ============================================================================
-- 1. CREATE site_assets TABLE
-- ============================================================================

CREATE TABLE site_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES customer_sites(id) ON DELETE CASCADE,
  equipment_name    TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  installation_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, equipment_name)
);

CREATE INDEX idx_site_assets_site ON site_assets(site_id);
CREATE INDEX idx_site_assets_installation_date ON site_assets(installation_date);

COMMENT ON TABLE site_assets IS 'Quantity-based asset tracking per site. Equipment by name/type, not serial.';

-- ============================================================================
-- 2. ADD COLUMNS TO proposals
-- ============================================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (contract_type IN ('sale', 'rental')),
  ADD COLUMN IF NOT EXISTS rental_description TEXT;

COMMENT ON COLUMN proposals.contract_type IS 'sale = one-time sale; rental = equipment remains company-owned';
COMMENT ON COLUMN proposals.rental_description IS 'Optional description for rental terms';

-- ============================================================================
-- 3. CREATE site_assets_detail VIEW
-- ============================================================================

CREATE VIEW site_assets_detail AS
SELECT
  sa.id,
  sa.site_id,
  sa.equipment_name,
  sa.quantity,
  sa.installation_date,
  sa.created_at,
  cs.site_name,
  cs.account_no,
  cs.address AS site_address,
  c.id AS customer_id,
  c.company_name,
  sub.id AS subscription_id,
  sub.status AS subscription_status
FROM site_assets sa
JOIN customer_sites cs ON sa.site_id = cs.id
JOIN customers c ON cs.customer_id = c.id
LEFT JOIN LATERAL (
  SELECT id, status
  FROM subscriptions
  WHERE site_id = sa.site_id
  ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, created_at DESC
  LIMIT 1
) sub ON true;

ALTER VIEW site_assets_detail SET (security_invoker = true);
GRANT SELECT ON site_assets_detail TO authenticated;

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE site_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_assets_select ON site_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY site_assets_insert ON site_assets
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY site_assets_update ON site_assets
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY site_assets_delete ON site_assets
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON site_assets TO authenticated;
