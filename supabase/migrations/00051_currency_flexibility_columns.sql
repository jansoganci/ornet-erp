-- Migration: 00051_currency_flexibility_columns
-- Description: Phase 1 - Add currency-flexible columns for proposals and work orders.
-- Scope: TRY and USD only. Additive migration with backfill. Old columns kept for backward compatibility.
-- No columns dropped; app and triggers continue using *_usd until Phase 2/3.

-- ============================================================
-- 1. Proposals: Add total_amount and backfill
-- ============================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE proposals SET total_amount = total_amount_usd;

-- ============================================================
-- 2. Proposal items: Add new columns
-- ============================================================
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS product_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS material_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS misc_cost DECIMAL(12,2);

-- ============================================================
-- 3. Proposal items: Backfill from *_usd columns
-- ============================================================
UPDATE proposal_items SET
  unit_price = unit_price_usd,
  cost = cost_usd,
  product_cost = product_cost_usd,
  labor_cost = labor_cost_usd,
  material_cost = material_cost_usd,
  shipping_cost = shipping_cost_usd,
  misc_cost = misc_cost_usd;

-- ============================================================
-- 4. Proposal items: Add line_total generated column
-- ============================================================
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- ============================================================
-- 5. Work order materials: Add new columns
-- ============================================================
ALTER TABLE work_order_materials
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2);

-- ============================================================
-- 6. Work order materials: Backfill from *_usd columns
-- ============================================================
UPDATE work_order_materials SET
  unit_price = COALESCE(unit_price_usd, 0),
  cost = cost_usd;

-- ============================================================
-- 7. Recreate proposals_detail view with total_amount
-- ============================================================
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
  cs.account_no,
  c.id AS customer_id,
  c.company_name AS customer_company_name,
  c.phone AS customer_phone,
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
LEFT JOIN customer_sites cs ON cs.id = p.site_id
LEFT JOIN customers c ON c.id = cs.customer_id;

GRANT SELECT ON proposals_detail TO authenticated;
