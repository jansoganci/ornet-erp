-- Migration: 00092_turkish_search_normalization
-- Description: Turkish character-insensitive search at DB level
--   - normalize_tr_for_search() function (same mapping as JS normalizeForSearch)
--   - Generated _search columns on tables
--   - _search columns in views
--   - Updated search_work_history RPC

-- ============================================================================
-- 1. Enable unaccent extension (for future use; we use custom translate here)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- 2. Turkish normalization function
-- Maps: ğ→g, Ğ→G, ş→s, Ş→S, ı→i, İ→I, ö→o, Ö→O, ü→u, Ü→U, ç→c, Ç→C
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_tr_for_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(coalesce(input, ''), 'ğĞşŞıİöÖüÜçÇ', 'gGsSiIoOuUcC')
  );
$$;

-- ============================================================================
-- 3. Generated columns on base tables
-- ============================================================================

-- customers: search by company_name, phone
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS company_name_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(company_name)) STORED;
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(phone)) STORED;

-- materials: search by name, code
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS name_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(name)) STORED;
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS code_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(code)) STORED;

-- customer_sites: search by account_no, site_name, address
ALTER TABLE customer_sites
  ADD COLUMN IF NOT EXISTS account_no_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(account_no)) STORED;
ALTER TABLE customer_sites
  ADD COLUMN IF NOT EXISTS site_name_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(site_name)) STORED;
ALTER TABLE customer_sites
  ADD COLUMN IF NOT EXISTS address_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(address)) STORED;

-- site_assets: search by serial_number, brand, model
ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS serial_number_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(serial_number)) STORED;
ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS brand_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(brand)) STORED;
ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS model_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(model)) STORED;

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_customers_company_name_search
  ON customers (company_name_search) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_materials_name_search
  ON materials (name_search) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_sites_site_name_search
  ON customer_sites (site_name_search) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_site_assets_serial_number_search
  ON site_assets (serial_number_search) WHERE serial_number_search IS NOT NULL AND serial_number_search != '';

-- ============================================================================
-- 4. Recreate work_orders_detail with _search columns
-- CASCADE drops dependent functions (search_work_history, get_daily_work_list)
-- ============================================================================
DROP VIEW IF EXISTS work_orders_detail CASCADE;

CREATE VIEW work_orders_detail AS
SELECT
  wo.id,
  wo.site_id,
  wo.form_no,
  wo.work_type,
  wo.work_type_other,
  wo.status,
  wo.priority,
  wo.scheduled_date,
  wo.scheduled_time,
  wo.assigned_to,
  wo.description,
  wo.notes,
  wo.amount,
  wo.currency,
  wo.created_by,
  wo.created_at,
  wo.updated_at,
  wo.completed_at,
  wo.cancelled_at,
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  normalize_tr_for_search(c.company_name) AS company_name_search,
  normalize_tr_for_search(s.account_no) AS account_no_search,
  normalize_tr_for_search(wo.form_no) AS form_no_search,
  (
    SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.full_name)), '[]'::json)
    FROM profiles p
    WHERE p.id = ANY(wo.assigned_to)
  ) AS assigned_workers,
  wo.proposal_id,
  wo.materials_discount_percent
FROM work_orders wo
JOIN customer_sites s ON wo.site_id = s.id
JOIN customers c ON s.customer_id = c.id;

ALTER VIEW work_orders_detail SET (security_invoker = true);
GRANT SELECT ON work_orders_detail TO authenticated;

-- ============================================================================
-- 5. Recreate subscriptions_detail with _search columns
-- ============================================================================
DROP VIEW IF EXISTS subscriptions_detail;

CREATE VIEW subscriptions_detail AS
SELECT
  sub.*,
  (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  ROUND(
    (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * (1 + sub.vat_rate / 100)
    - sub.cost - sub.static_ip_cost,
    2
  ) AS profit,
  (
    SELECT ip_address
    FROM sim_static_ips
    WHERE sim_card_id = sub.sim_card_id
      AND cancelled_at IS NULL
    LIMIT 1
  ) AS static_ip_address,
  s.account_no,
  s.site_name,
  s.address       AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  c.id            AS customer_id,
  c.company_name,
  c.phone         AS customer_phone,
  c.tax_number,
  normalize_tr_for_search(c.company_name) AS company_name_search,
  normalize_tr_for_search(s.account_no) AS account_no_search,
  normalize_tr_for_search(s.site_name) AS site_name_search,
  pm.method_type  AS pm_type,
  pm.card_last4   AS pm_card_last4,
  pm.card_brand   AS pm_card_brand,
  pm.card_holder  AS pm_card_holder,
  pm.bank_name   AS pm_bank_name,
  pm.iban         AS pm_iban,
  pm.label        AS pm_label,
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name,
  cash_collector.full_name AS cash_collector_name,
  sc.phone_number AS sim_phone_number
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id
LEFT JOIN profiles cash_collector ON sub.cash_collector_id = cash_collector.id
LEFT JOIN sim_cards sc ON sub.sim_card_id = sc.id;

ALTER VIEW subscriptions_detail SET (security_invoker = true);
GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 6. Recreate proposals_detail with _search columns
-- ============================================================================
DROP VIEW IF EXISTS proposals_detail;

CREATE VIEW proposals_detail AS
SELECT
  p.id,
  p.proposal_no,
  p.site_id,
  p.title,
  p.notes,
  p.scope_of_work,
  p.currency,
  p.total_amount_usd,
  p.total_amount,
  p.status,
  p.created_by,
  p.created_at,
  p.sent_at,
  p.accepted_at,
  p.rejected_at,
  p.updated_at,
  p.company_name,
  p.proposal_date,
  p.survey_date,
  p.authorized_person,
  p.installation_date,
  p.customer_representative,
  p.completion_date,
  p.discount_percent,
  p.terms_engineering,
  p.terms_pricing,
  p.terms_warranty,
  p.terms_other,
  p.terms_attachments,
  cs.site_name,
  cs.address AS site_address,
  cs.city,
  cs.account_no,
  c.id AS customer_id,
  c.company_name AS customer_company_name,
  c.phone AS customer_phone,
  normalize_tr_for_search(p.title) AS title_search,
  normalize_tr_for_search(c.company_name) AS customer_company_name_search,
  normalize_tr_for_search(p.proposal_no) AS proposal_no_search,
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
LEFT JOIN customer_sites cs ON cs.id = p.site_id
LEFT JOIN customers c ON c.id = cs.customer_id;

ALTER VIEW proposals_detail SET (security_invoker = true);
GRANT SELECT ON proposals_detail TO authenticated;

-- ============================================================================
-- 7. Recreate site_assets_detail with _search columns
-- ============================================================================
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
  wo_install.scheduled_date AS installed_wo_date
FROM site_assets sa
JOIN customer_sites cs ON sa.site_id = cs.id
JOIN customers c ON sa.customer_id = c.id
LEFT JOIN materials m ON sa.material_id = m.id
LEFT JOIN work_orders wo_install ON sa.installed_by_work_order_id = wo_install.id;

ALTER VIEW site_assets_detail SET (security_invoker = true);
GRANT SELECT ON site_assets_detail TO authenticated;

-- ============================================================================
-- 8. Update search_work_history to use normalize_tr_for_search
-- ============================================================================
CREATE OR REPLACE FUNCTION search_work_history(
  search_query TEXT,
  search_type TEXT DEFAULT 'account_no'
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_query text;
BEGIN
  norm_query := normalize_tr_for_search(search_query);

  IF search_type = 'account_no' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSIF search_type = 'company' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE company_name_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSE
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no_search LIKE '%' || norm_query || '%'
       OR company_name_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  END IF;
END;
$$;

-- Recreate get_daily_work_list (dropped by CASCADE)
CREATE OR REPLACE FUNCTION get_daily_work_list(
  target_date DATE,
  worker_id UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF worker_id IS NULL THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
    ORDER BY scheduled_time ASC;
  ELSE
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
      AND worker_id = ANY(assigned_to)
    ORDER BY scheduled_time ASC;
  END IF;
END;
$$;
