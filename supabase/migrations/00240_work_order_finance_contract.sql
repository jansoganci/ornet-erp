-- 00240_work_order_finance_contract.sql
--
-- Phase 3 / Step 1: work-order DB contract only.
--
-- Scope:
-- 1. Add standalone work-order source fields for service-fee revenue and planned labor.
-- 2. Persist work_orders.has_vat so VAT semantics are explicit on the source row.
-- 3. Rebuild work_orders_detail with canonical pricing aliases for future frontend/RPC use.
-- 4. Recreate dependent functions that RETURN SETOF work_orders_detail.
--
-- Out of scope in this migration:
-- - auto_record_work_order_revenue()
-- - fn_complete_work_order_with_payment(...)
-- - frontend changes
-- - Paraşüt mapper logic

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS service_fee_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_operational_labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_operational_labor_cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_vat BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_orders_service_fee_revenue_check'
      AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_service_fee_revenue_check
      CHECK (service_fee_revenue >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_orders_service_fee_revenue_usd_check'
      AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_service_fee_revenue_usd_check
      CHECK (service_fee_revenue_usd >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_orders_planned_operational_labor_cost_check'
      AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_planned_operational_labor_cost_check
      CHECK (planned_operational_labor_cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_orders_planned_operational_labor_cost_usd_check'
      AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_planned_operational_labor_cost_usd_check
      CHECK (planned_operational_labor_cost_usd >= 0);
  END IF;
END $$;

-- Preserve current legacy semantics for existing rows: before has_vat existed,
-- the app treated vat_rate > 0 as "VAT enabled".
UPDATE public.work_orders
SET has_vat = COALESCE(vat_rate, 0) > 0
WHERE has_vat IS DISTINCT FROM (COALESCE(vat_rate, 0) > 0);

COMMENT ON COLUMN public.work_orders.service_fee_revenue IS
  'Standalone work-order service/labor revenue in TRY. Active when work_orders.currency = TRY.';
COMMENT ON COLUMN public.work_orders.service_fee_revenue_usd IS
  'Standalone work-order service/labor revenue in USD. Active when work_orders.currency = USD.';
COMMENT ON COLUMN public.work_orders.planned_operational_labor_cost IS
  'Operational-only planned labor cost in TRY. Never posts to financial_transactions.';
COMMENT ON COLUMN public.work_orders.planned_operational_labor_cost_usd IS
  'Operational-only planned labor cost in USD. Never posts to financial_transactions.';
COMMENT ON COLUMN public.work_orders.has_vat IS
  'Explicit standalone work-order VAT toggle. Separates VAT semantics from vat_rate storage.';

DROP VIEW IF EXISTS public.work_orders_detail CASCADE;

CREATE VIEW public.work_orders_detail AS
WITH work_order_metrics AS (
  SELECT
    wo.id,
    COALESCE(item_metrics.items_subtotal, 0) AS items_subtotal,
    COALESCE(item_metrics.items_cost_total, 0) AS items_cost_total,
    ROUND(
      COALESCE(item_metrics.items_subtotal, 0)
      * LEAST(GREATEST(COALESCE(wo.materials_discount_percent, 0), 0), 100)
      / 100,
      2
    ) AS discount_amount,
    CASE
      WHEN UPPER(COALESCE(wo.currency, 'TRY')) = 'USD'
        THEN COALESCE(wo.service_fee_revenue_usd, 0)
      ELSE COALESCE(wo.service_fee_revenue, 0)
    END AS service_fee_amount,
    CASE
      WHEN UPPER(COALESCE(wo.currency, 'TRY')) = 'USD'
        THEN COALESCE(wo.planned_operational_labor_cost_usd, 0)
      ELSE COALESCE(wo.planned_operational_labor_cost, 0)
    END AS planned_operational_labor_cost_amount
  FROM public.work_orders wo
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(
        wom.quantity * CASE
          WHEN UPPER(COALESCE(wo.currency, 'TRY')) = 'USD'
            THEN COALESCE(wom.unit_price_usd, 0)
          ELSE COALESCE(wom.unit_price, 0)
        END
      ), 0) AS items_subtotal,
      COALESCE(SUM(
        wom.quantity * CASE
          WHEN UPPER(COALESCE(wo.currency, 'TRY')) = 'USD'
            THEN COALESCE(wom.cost_usd, 0)
          ELSE COALESCE(wom.cost, 0)
        END
      ), 0) AS items_cost_total
    FROM public.work_order_materials wom
    WHERE wom.work_order_id = wo.id
  ) item_metrics ON true
),
work_order_totals AS (
  SELECT
    wom.*,
    ROUND(wom.items_subtotal - wom.discount_amount, 2) AS discounted_items_total,
    ROUND(wom.items_subtotal - wom.discount_amount + wom.service_fee_amount, 2) AS net_amount
  FROM work_order_metrics wom
)
SELECT
  wo.id,
  wo.site_id,
  wo.form_no,
  wo.work_type,
  wo.work_type_other,
  wo.status,
  CASE wo.status
    WHEN 'in_progress' THEN 0
    WHEN 'pending'     THEN 1
    WHEN 'scheduled'   THEN 2
    WHEN 'completed'   THEN 3
    WHEN 'cancelled'   THEN 4
    ELSE 5
  END AS status_rank,
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
  -- Site info
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  -- Customer info
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  -- Search columns
  c.company_name_search,
  s.account_no_search,
  wo.form_no_search,
  COALESCE(aw.assigned_workers, '[]'::json) AS assigned_workers,
  wo.proposal_id,
  wo.materials_discount_percent,
  wo.vat_rate,
  wo.has_vat,
  wo.has_tevkifat,
  wo.service_fee_revenue,
  wo.service_fee_revenue_usd,
  wo.planned_operational_labor_cost,
  wo.planned_operational_labor_cost_usd,
  wot.items_subtotal,
  wot.items_cost_total,
  wot.discount_amount,
  wot.discounted_items_total,
  wot.service_fee_amount,
  wot.planned_operational_labor_cost_amount,
  wot.net_amount,
  CASE
    WHEN COALESCE(wo.has_vat, false)
      THEN ROUND(wot.net_amount * COALESCE(wo.vat_rate, 0) / 100, 2)
    ELSE 0
  END AS vat_amount,
  CASE
    WHEN COALESCE(wo.has_vat, false)
      THEN ROUND(wot.net_amount + ROUND(wot.net_amount * COALESCE(wo.vat_rate, 0) / 100, 2), 2)
    ELSE wot.net_amount
  END AS gross_amount
FROM public.work_orders wo
JOIN public.customer_sites s
  ON s.id = wo.site_id
JOIN public.customers c
  ON c.id = s.customer_id
JOIN work_order_totals wot
  ON wot.id = wo.id
LEFT JOIN LATERAL (
  SELECT json_agg(json_build_object('id', p.id, 'name', p.full_name)) AS assigned_workers
  FROM public.profiles p
  WHERE p.id = ANY(wo.assigned_to)
) aw ON true;

ALTER VIEW public.work_orders_detail SET (security_invoker = true);

GRANT SELECT ON public.work_orders_detail TO authenticated;

-- CASCADE drops functions that RETURN SETOF work_orders_detail — restore latest definitions.

CREATE OR REPLACE FUNCTION public.get_daily_work_list(
  target_date DATE,
  worker_id   UUID DEFAULT NULL
)
RETURNS SETOF public.work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_uid  UUID;
BEGIN
  v_role := get_my_role();
  v_uid  := auth.uid();

  IF v_role = 'field_worker' THEN
    RETURN QUERY
    SELECT * FROM public.work_orders_detail
    WHERE scheduled_date = target_date
      AND v_uid = ANY(assigned_to)
    ORDER BY scheduled_time ASC;
  ELSE
    IF worker_id IS NULL THEN
      RETURN QUERY
      SELECT * FROM public.work_orders_detail
      WHERE scheduled_date = target_date
      ORDER BY scheduled_time ASC;
    ELSE
      RETURN QUERY
      SELECT * FROM public.work_orders_detail
      WHERE scheduled_date = target_date
        AND worker_id = ANY(assigned_to)
      ORDER BY scheduled_time ASC;
    END IF;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.search_work_history(text, text, uuid, date, date, text, uuid);

CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no',
  p_site_id    UUID DEFAULT NULL,
  p_date_from  DATE DEFAULT NULL,
  p_date_to    DATE DEFAULT NULL,
  p_work_type  TEXT DEFAULT NULL,
  p_worker_id  UUID DEFAULT NULL,
  p_limit      INTEGER DEFAULT 200,
  p_offset     INTEGER DEFAULT 0
)
RETURNS SETOF public.work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_uid      UUID;
  norm_query TEXT;
  v_limit    INTEGER;
  v_offset   INTEGER;
BEGIN
  v_role     := get_my_role();
  v_uid      := auth.uid();
  norm_query := normalize_tr_for_search(COALESCE(search_query, ''));

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
    SELECT *
    FROM public.work_orders_detail
    WHERE (
      (
        search_type = 'account_no' AND account_no_search LIKE '%' || norm_query || '%'
      )
      OR (
        search_type = 'company' AND company_name_search LIKE '%' || norm_query || '%'
      )
      OR (
        search_type NOT IN ('account_no', 'company')
        AND (
          account_no_search LIKE '%' || norm_query || '%'
          OR company_name_search LIKE '%' || norm_query || '%'
        )
      )
    )
      AND (p_site_id IS NULL OR site_id = p_site_id)
      AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
      AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
      AND (
        v_role IS DISTINCT FROM 'field_worker'
        OR (v_uid IS NOT NULL AND assigned_to IS NOT NULL AND v_uid = ANY(assigned_to))
      )
    ORDER BY scheduled_date DESC, created_at DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_work_list(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_work_history(
  text, text, uuid, date, date, text, uuid, integer, integer
) TO authenticated;

-- REVERT
-- DROP FUNCTION IF EXISTS public.search_work_history(text, text, uuid, date, date, text, uuid, integer, integer);
--
-- CREATE OR REPLACE FUNCTION public.search_work_history(
--   search_query TEXT,
--   search_type  TEXT DEFAULT 'account_no',
--   p_site_id    UUID DEFAULT NULL,
--   p_date_from  DATE DEFAULT NULL,
--   p_date_to    DATE DEFAULT NULL,
--   p_work_type  TEXT DEFAULT NULL,
--   p_worker_id  UUID DEFAULT NULL,
--   p_limit      INTEGER DEFAULT 200,
--   p_offset     INTEGER DEFAULT 0
-- )
-- RETURNS SETOF public.work_orders_detail
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $revert_search$
-- DECLARE
--   v_role     TEXT;
--   v_uid      UUID;
--   norm_query TEXT;
--   v_limit    INTEGER;
--   v_offset   INTEGER;
-- BEGIN
--   v_role     := get_my_role();
--   v_uid      := auth.uid();
--   norm_query := normalize_tr_for_search(COALESCE(search_query, ''));
--
--   v_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
--   v_offset := GREATEST(COALESCE(p_offset, 0), 0);
--
--   RETURN QUERY
--     SELECT *
--     FROM public.work_orders_detail
--     WHERE (
--       (
--         search_type = 'account_no' AND account_no_search LIKE '%' || norm_query || '%'
--       )
--       OR (
--         search_type = 'company' AND company_name_search LIKE '%' || norm_query || '%'
--       )
--       OR (
--         search_type NOT IN ('account_no', 'company')
--         AND (
--           account_no_search LIKE '%' || norm_query || '%'
--           OR company_name_search LIKE '%' || norm_query || '%'
--         )
--       )
--     )
--       AND (p_site_id IS NULL OR site_id = p_site_id)
--       AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
--       AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
--       AND (p_work_type IS NULL OR work_type = p_work_type)
--       AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
--       AND (
--         v_role IS DISTINCT FROM 'field_worker'
--         OR (v_uid IS NOT NULL AND assigned_to IS NOT NULL AND v_uid = ANY(assigned_to))
--       )
--     ORDER BY scheduled_date DESC, created_at DESC
--     LIMIT v_limit OFFSET v_offset;
-- END;
-- $revert_search$;
--
-- CREATE OR REPLACE FUNCTION public.get_daily_work_list(
--   target_date DATE,
--   worker_id   UUID DEFAULT NULL
-- )
-- RETURNS SETOF public.work_orders_detail
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $revert_daily$
-- DECLARE
--   v_role TEXT;
--   v_uid  UUID;
-- BEGIN
--   v_role := get_my_role();
--   v_uid  := auth.uid();
--
--   IF v_role = 'field_worker' THEN
--     RETURN QUERY
--     SELECT * FROM public.work_orders_detail
--     WHERE scheduled_date = target_date
--       AND v_uid = ANY(assigned_to)
--     ORDER BY scheduled_time ASC;
--   ELSE
--     IF worker_id IS NULL THEN
--       RETURN QUERY
--       SELECT * FROM public.work_orders_detail
--       WHERE scheduled_date = target_date
--       ORDER BY scheduled_time ASC;
--     ELSE
--       RETURN QUERY
--       SELECT * FROM public.work_orders_detail
--       WHERE scheduled_date = target_date
--         AND worker_id = ANY(assigned_to)
--       ORDER BY scheduled_time ASC;
--     END IF;
--   END IF;
-- END;
-- $revert_daily$;
--
-- DROP VIEW IF EXISTS public.work_orders_detail CASCADE;
--
-- CREATE VIEW public.work_orders_detail AS
-- SELECT
--   wo.id,
--   wo.site_id,
--   wo.form_no,
--   wo.work_type,
--   wo.work_type_other,
--   wo.status,
--   CASE wo.status
--     WHEN 'in_progress' THEN 0
--     WHEN 'pending'     THEN 1
--     WHEN 'scheduled'   THEN 2
--     WHEN 'completed'   THEN 3
--     WHEN 'cancelled'   THEN 4
--     ELSE 5
--   END AS status_rank,
--   wo.priority,
--   wo.scheduled_date,
--   wo.scheduled_time,
--   wo.assigned_to,
--   wo.description,
--   wo.notes,
--   wo.amount,
--   wo.currency,
--   wo.created_by,
--   wo.created_at,
--   wo.updated_at,
--   wo.completed_at,
--   wo.cancelled_at,
--   s.account_no,
--   s.site_name,
--   s.address AS site_address,
--   s.city,
--   s.district,
--   s.contact_phone AS site_phone,
--   s.panel_info,
--   c.id AS customer_id,
--   c.company_name,
--   c.phone AS customer_phone,
--   c.company_name_search,
--   s.account_no_search,
--   wo.form_no_search,
--   COALESCE(aw.assigned_workers, '[]'::json) AS assigned_workers,
--   wo.proposal_id,
--   wo.materials_discount_percent,
--   wo.vat_rate,
--   wo.has_tevkifat
-- FROM public.work_orders wo
-- JOIN public.customer_sites s ON s.id = wo.site_id
-- JOIN public.customers c ON c.id = s.customer_id
-- LEFT JOIN LATERAL (
--   SELECT json_agg(json_build_object('id', p.id, 'name', p.full_name)) AS assigned_workers
--   FROM public.profiles p
--   WHERE p.id = ANY(wo.assigned_to)
-- ) aw ON true;
--
-- ALTER VIEW public.work_orders_detail SET (security_invoker = true);
-- GRANT SELECT ON public.work_orders_detail TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_daily_work_list(date, uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.search_work_history(
--   text, text, uuid, date, date, text, uuid, integer, integer
-- ) TO authenticated;
--
-- ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_planned_operational_labor_cost_usd_check;
-- ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_planned_operational_labor_cost_check;
-- ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_service_fee_revenue_usd_check;
-- ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_service_fee_revenue_check;
-- ALTER TABLE public.work_orders DROP COLUMN IF EXISTS has_vat;
-- ALTER TABLE public.work_orders DROP COLUMN IF EXISTS planned_operational_labor_cost_usd;
-- ALTER TABLE public.work_orders DROP COLUMN IF EXISTS planned_operational_labor_cost;
-- ALTER TABLE public.work_orders DROP COLUMN IF EXISTS service_fee_revenue_usd;
-- ALTER TABLE public.work_orders DROP COLUMN IF EXISTS service_fee_revenue;
