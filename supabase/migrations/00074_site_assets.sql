-- Migration: 00074_site_assets
-- Description: Site asset (equipment) tracking — installed equipment registry per customer site.
--   Phase 1: site_assets table, work_order_assets junction, detail view, RLS.
--   Also adds 'demount' to work_orders work_type constraint.

-- ============================================================================
-- 1. SITE_ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_assets (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                    UUID NOT NULL REFERENCES customer_sites(id) ON DELETE CASCADE,
  customer_id                UUID NOT NULL REFERENCES customers(id),

  -- What
  asset_type                 TEXT NOT NULL,
  brand                      TEXT,
  model                      TEXT,
  serial_number              TEXT,
  material_id                UUID REFERENCES materials(id) ON DELETE SET NULL,

  -- When / How
  installed_at               DATE,
  installed_by_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,

  -- Status
  status                     TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed', 'replaced', 'faulty')),
  removed_at                 DATE,
  removed_by_work_order_id   UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  replaced_by_asset_id       UUID REFERENCES site_assets(id),

  -- Extra
  location_note              TEXT,
  warranty_expires_at        DATE,
  notes                      TEXT,

  created_by                 UUID REFERENCES profiles(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE TRIGGER set_site_assets_updated_at
  BEFORE UPDATE ON site_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_site_assets_site ON site_assets(site_id) WHERE status = 'active';
CREATE INDEX idx_site_assets_customer ON site_assets(customer_id);
CREATE INDEX idx_site_assets_serial ON site_assets(serial_number) WHERE serial_number IS NOT NULL;

-- ============================================================================
-- 2. WORK_ORDER_ASSETS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_order_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES site_assets(id) ON DELETE CASCADE,
  action          TEXT NOT NULL
    CHECK (action IN ('installed', 'serviced', 'removed', 'replaced', 'inspected')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(work_order_id, asset_id)
);

CREATE INDEX idx_woa_work_order ON work_order_assets(work_order_id);
CREATE INDEX idx_woa_asset ON work_order_assets(asset_id);

-- ============================================================================
-- 3. DETAIL VIEW
-- ============================================================================

CREATE OR REPLACE VIEW site_assets_detail AS
SELECT
  sa.*,
  cs.site_name,
  cs.account_no,
  cs.address AS site_address,
  c.company_name,
  m.code AS material_code,
  m.name AS material_name,
  wo_install.form_no AS installed_by_form_no,
  wo_install.scheduled_date AS installed_wo_date
FROM site_assets sa
JOIN customer_sites cs ON sa.site_id = cs.id
JOIN customers c ON sa.customer_id = c.id
LEFT JOIN materials m ON sa.material_id = m.id
LEFT JOIN work_orders wo_install ON sa.installed_by_work_order_id = wo_install.id;

GRANT SELECT ON site_assets_detail TO authenticated;

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE site_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_assets ENABLE ROW LEVEL SECURITY;

-- site_assets: all authenticated can read, admin+accountant can write
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

-- work_order_assets: all read, admin+accountant write
CREATE POLICY woa_select ON work_order_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY woa_insert ON work_order_assets
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY woa_delete ON work_order_assets
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON site_assets TO authenticated;
GRANT SELECT, INSERT, DELETE ON work_order_assets TO authenticated;

-- ============================================================================
-- 5. ADD 'demount' TO WORK_ORDERS WORK_TYPE
-- ============================================================================
-- Note: work_type uses English values (see 00013_translate_work_types.sql).
-- demontaj (Turkish) = demount (English)

ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_work_type_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_work_type_check
  CHECK (work_type IN ('survey', 'installation', 'service', 'maintenance', 'demount', 'other'));
