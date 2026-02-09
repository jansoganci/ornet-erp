-- Migration: 00017_fix_subscriptions_detail_view
-- Description: Add missing payment method columns (card_holder, bank_name, iban) to subscriptions_detail view
-- Note: Must DROP + CREATE because PostgreSQL cannot add columns mid-view with CREATE OR REPLACE

DROP VIEW IF EXISTS subscriptions_detail;

CREATE VIEW subscriptions_detail AS
SELECT
  sub.*,
  -- Computed totals
  (sub.base_price + sub.sms_fee + sub.line_fee) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  -- Profit (admin-only in UI)
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100) - sub.cost, 2) AS profit,
  -- Site info
  s.account_no,
  s.site_name,
  s.address       AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  -- Customer info
  c.id            AS customer_id,
  c.company_name,
  c.phone         AS customer_phone,
  c.tax_number,
  -- Payment method info
  pm.method_type  AS pm_type,
  pm.card_last4   AS pm_card_last4,
  pm.card_brand   AS pm_card_brand,
  pm.card_holder  AS pm_card_holder,
  pm.bank_name    AS pm_bank_name,
  pm.iban         AS pm_iban,
  pm.label        AS pm_label,
  -- Staff names
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id;

GRANT SELECT ON subscriptions_detail TO authenticated;
