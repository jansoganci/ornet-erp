-- Migration: 00094_add_site_assets_ownership
-- Description: Add ownership_type and subscription_id to site_assets for rental tracking.

-- 1. Add columns to site_assets
ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS ownership_type TEXT CHECK (ownership_type IN ('company_owned', 'customer_owned')),
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_assets_ownership ON site_assets(ownership_type);
CREATE INDEX IF NOT EXISTS idx_site_assets_subscription ON site_assets(subscription_id);

-- 3. Recreate site_assets_detail view to include new columns
DROP VIEW IF EXISTS site_assets_detail;

CREATE VIEW site_assets_detail AS
SELECT
  sa.*,
  cs.site_name,
  cs.account_no,
  cs.address AS site_address,
  c.company_name,
  m.code AS material_code,
  m.name AS material_name,
  wo_install.form_no AS installed_by_form_no,
  wo_install.scheduled_date AS installed_wo_date,
  sub.service_type AS subscription_service_type,
  sub.status AS subscription_status
FROM site_assets sa
JOIN customer_sites cs ON sa.site_id = cs.id
JOIN customers c ON sa.customer_id = c.id
LEFT JOIN materials m ON sa.material_id = m.id
LEFT JOIN work_orders wo_install ON sa.installed_by_work_order_id = wo_install.id
LEFT JOIN subscriptions sub ON sa.subscription_id = sub.id;

ALTER VIEW site_assets_detail SET (security_invoker = true);
GRANT SELECT ON site_assets_detail TO authenticated;
