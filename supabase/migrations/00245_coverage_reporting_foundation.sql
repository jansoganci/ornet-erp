-- 00245_coverage_reporting_foundation.sql
--
-- Phase 4 / Step 2:
-- 1. Create a canonical coverage reporting base view.
-- 2. Expose labor revenue from completed proposals and standalone work orders.
-- 3. Expose recurring burden rows needed for labor coverage now and field coverage later.
--
-- Notes:
-- - Ledger profit remains on v_profit_and_loss / financial_transactions.
-- - This view is reporting-only and does not change posting behavior.
-- - Proposal labor revenue is proportional to the posted income row so TRY reporting
--   follows the actual posted finance amount instead of redoing exchange-rate lookup.

BEGIN;

CREATE OR REPLACE VIEW public.v_coverage_reporting_base AS
WITH proposal_item_amounts AS (
  SELECT
    p.id AS proposal_id,
    pi.section_id,
    pi.revenue_type,
    CASE
      WHEN UPPER(COALESCE(p.currency, 'USD')) = 'USD'
        THEN COALESCE(NULLIF(pi.total_usd, 0), COALESCE(pi.unit_price_usd, 0) * COALESCE(pi.quantity, 0))
      ELSE COALESCE(NULLIF(pi.line_total, 0), COALESCE(pi.unit_price, 0) * COALESCE(pi.quantity, 0))
    END AS line_total_active
  FROM public.proposals p
  JOIN public.proposal_items pi
    ON pi.proposal_id = p.id
  WHERE p.deleted_at IS NULL
),
proposal_grouped_section_metrics AS (
  SELECT
    pia.proposal_id,
    pia.section_id,
    LEAST(GREATEST(COALESCE(ps.discount_percent, 0), 0), 100) AS discount_percent,
    COALESCE(SUM(pia.line_total_active), 0) AS section_subtotal_active,
    COALESCE(SUM(
      CASE
        WHEN pia.revenue_type = 'labor_service' THEN pia.line_total_active
        ELSE 0
      END
    ), 0) AS section_labor_subtotal_active
  FROM proposal_item_amounts pia
  JOIN public.proposal_sections ps
    ON ps.id = pia.section_id
  GROUP BY pia.proposal_id, pia.section_id, ps.discount_percent
),
proposal_grouped_rollup AS (
  SELECT
    proposal_id,
    COALESCE(SUM(
      ROUND(
        section_subtotal_active
        - ROUND(section_subtotal_active * discount_percent / 100, 2),
        2
      )
    ), 0) AS grouped_net_active,
    COALESCE(SUM(
      CASE
        WHEN section_subtotal_active > 0 THEN ROUND(
          ROUND(
            section_subtotal_active
            - ROUND(section_subtotal_active * discount_percent / 100, 2),
            2
          ) * section_labor_subtotal_active / section_subtotal_active,
          2
        )
        ELSE 0
      END
    ), 0) AS grouped_labor_net_active
  FROM proposal_grouped_section_metrics
  GROUP BY proposal_id
),
proposal_ungrouped_rollup AS (
  SELECT
    proposal_id,
    COALESCE(SUM(line_total_active), 0) AS ungrouped_net_active,
    COALESCE(SUM(
      CASE
        WHEN revenue_type = 'labor_service' THEN line_total_active
        ELSE 0
      END
    ), 0) AS ungrouped_labor_net_active
  FROM proposal_item_amounts
  WHERE section_id IS NULL
  GROUP BY proposal_id
),
proposal_income_rollup AS (
  SELECT
    ft.proposal_id,
    COALESCE(SUM(ft.amount_try), 0) AS total_posted_income_try,
    MIN(ft.period) AS period,
    MIN(ft.transaction_date) AS period_date,
    BOOL_AND(COALESCE(ft.should_invoice, false)) AS is_official,
    MAX(ft.created_at) AS created_at,
    NULL::UUID AS finance_transaction_id
  FROM public.financial_transactions ft
  WHERE ft.proposal_id IS NOT NULL
    AND ft.direction = 'income'
    AND ft.deleted_at IS NULL
  GROUP BY ft.proposal_id
),
proposal_labor_sources AS (
  SELECT
    p.id AS source_id,
    'proposal_labor_service'::TEXT AS source_type,
    'labor_revenue'::TEXT AS coverage_bucket,
    pir.period,
    pir.period_date,
    pir.is_official,
    pir.created_at,
    pir.finance_transaction_id,
    LEAST(
      pir.total_posted_income_try,
      GREATEST(
        ROUND(
          pir.total_posted_income_try
          * (
            (COALESCE(pgr.grouped_labor_net_active, 0) + COALESCE(pur.ungrouped_labor_net_active, 0))
            / NULLIF(COALESCE(pgr.grouped_net_active, 0) + COALESCE(pur.ungrouped_net_active, 0), 0)
          ),
          2
        ),
        0
      )
  ) AS amount_try
  FROM public.proposals p
  JOIN proposal_income_rollup pir
    ON pir.proposal_id = p.id
  LEFT JOIN proposal_grouped_rollup pgr
    ON pgr.proposal_id = p.id
  LEFT JOIN proposal_ungrouped_rollup pur
    ON pur.proposal_id = p.id
  WHERE p.deleted_at IS NULL
    AND (
      COALESCE(pgr.grouped_labor_net_active, 0) + COALESCE(pur.ungrouped_labor_net_active, 0)
    ) > 0
    AND (COALESCE(pgr.grouped_net_active, 0) + COALESCE(pur.ungrouped_net_active, 0)) > 0
),
work_order_income_rollup AS (
  SELECT
    ft.work_order_id,
    COALESCE(SUM(ft.amount_try), 0) AS total_posted_income_try,
    MIN(ft.period) AS period,
    MIN(ft.transaction_date) AS period_date,
    BOOL_AND(COALESCE(ft.should_invoice, false)) AS is_official,
    MAX(ft.created_at) AS created_at,
    NULL::UUID AS finance_transaction_id
  FROM public.financial_transactions ft
  WHERE ft.work_order_id IS NOT NULL
    AND ft.direction = 'income'
    AND ft.deleted_at IS NULL
  GROUP BY ft.work_order_id
),
work_order_service_fee_sources AS (
  SELECT
    wo.id AS source_id,
    'work_order_service_fee'::TEXT AS source_type,
    'labor_revenue'::TEXT AS coverage_bucket,
    wir.period,
    wir.period_date,
    wir.is_official,
    wir.created_at,
    wir.finance_transaction_id,
    LEAST(
      wir.total_posted_income_try,
      GREATEST(
        ROUND(wir.total_posted_income_try * wod.service_fee_amount / NULLIF(wod.net_amount, 0), 2),
        0
      )
    ) AS amount_try
  FROM public.work_orders wo
  JOIN public.work_orders_detail wod
    ON wod.id = wo.id
  JOIN work_order_income_rollup wir
    ON wir.work_order_id = wo.id
  WHERE wo.deleted_at IS NULL
    AND wo.proposal_id IS NULL
    AND COALESCE(wod.service_fee_amount, 0) > 0
    AND COALESCE(wod.net_amount, 0) > 0
),
recurring_burden_sources AS (
  SELECT
    ft.id AS source_id,
    'recurring_expense'::TEXT AS source_type,
    CASE
      WHEN ft.burden_type = 'labor_burden' THEN 'labor_burden'
      WHEN ft.burden_type = 'vehicle_burden' THEN 'vehicle_burden'
      ELSE 'other'
    END AS coverage_bucket,
    ft.period,
    ft.transaction_date AS period_date,
    COALESCE(ft.has_invoice, false) AS is_official,
    ft.created_at,
    ft.id AS finance_transaction_id,
    ABS(COALESCE(ft.amount_try, 0)) AS amount_try
  FROM public.financial_transactions ft
  WHERE ft.deleted_at IS NULL
    AND ft.direction = 'expense'
    AND ft.recurring_template_id IS NOT NULL
    AND ft.burden_type IN ('labor_burden', 'vehicle_burden')
    AND ABS(COALESCE(ft.amount_try, 0)) > 0
)
SELECT
  source_id,
  source_type,
  coverage_bucket,
  period,
  period_date,
  is_official,
  created_at,
  finance_transaction_id,
  amount_try
FROM proposal_labor_sources
WHERE amount_try > 0

UNION ALL

SELECT
  source_id,
  source_type,
  coverage_bucket,
  period,
  period_date,
  is_official,
  created_at,
  finance_transaction_id,
  amount_try
FROM work_order_service_fee_sources
WHERE amount_try > 0

UNION ALL

SELECT
  source_id,
  source_type,
  coverage_bucket,
  period,
  period_date,
  is_official,
  created_at,
  finance_transaction_id,
  amount_try
FROM recurring_burden_sources;

ALTER VIEW public.v_coverage_reporting_base SET (security_invoker = true);

GRANT SELECT ON public.v_coverage_reporting_base TO authenticated;

COMMENT ON VIEW public.v_coverage_reporting_base IS
  'Canonical coverage reporting base: proposal labor_service revenue, standalone work-order service-fee revenue, and recurring burden expense rows.';

COMMIT;

-- REVERT:
-- BEGIN;
-- DROP VIEW IF EXISTS public.v_coverage_reporting_base;
-- COMMIT;
