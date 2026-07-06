-- 00247_work_order_revenue_type_alignment.sql
--
-- Align work-order commercial item handling with proposal rows:
-- - persist revenue_type on work_order_materials
-- - derive service revenue from line rows when present
-- - keep legacy service_fee_* fields as a fallback for old records
-- - post COGS only for material-classified rows

BEGIN;

ALTER TABLE public.work_order_materials
  ADD COLUMN IF NOT EXISTS revenue_type TEXT;

UPDATE public.work_order_materials
SET revenue_type = 'material'
WHERE revenue_type IS NULL;

ALTER TABLE public.work_order_materials
  ALTER COLUMN revenue_type SET DEFAULT 'material';

ALTER TABLE public.work_order_materials
  ALTER COLUMN revenue_type SET NOT NULL;

ALTER TABLE public.work_order_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_revenue_type_check;

ALTER TABLE public.work_order_materials
  ADD CONSTRAINT work_order_materials_revenue_type_check
  CHECK (revenue_type IN ('material', 'labor_service', 'other'));

CREATE OR REPLACE VIEW public.work_orders_detail AS
WITH work_order_metrics AS (
  SELECT
    wo.id,
    COALESCE(item_metrics.items_subtotal, 0) AS items_subtotal,
    COALESCE(item_metrics.items_cost_total, 0) AS items_cost_total,
    COALESCE(item_metrics.labor_service_subtotal, 0) AS labor_service_subtotal,
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
    END AS legacy_service_fee_amount,
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
      ), 0) AS items_cost_total,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(wom.revenue_type, 'material') = 'labor_service' THEN
            wom.quantity * CASE
              WHEN UPPER(COALESCE(wo.currency, 'TRY')) = 'USD'
                THEN COALESCE(wom.unit_price_usd, 0)
              ELSE COALESCE(wom.unit_price, 0)
            END
          ELSE 0
        END
      ), 0) AS labor_service_subtotal
    FROM public.work_order_materials wom
    WHERE wom.work_order_id = wo.id
  ) item_metrics ON true
),
work_order_totals AS (
  SELECT
    wom.*,
    ROUND(wom.items_subtotal - wom.discount_amount, 2) AS discounted_items_total,
    CASE
      WHEN wom.labor_service_subtotal > 0
        THEN ROUND(wom.labor_service_subtotal, 2)
      ELSE ROUND(wom.legacy_service_fee_amount, 2)
    END AS service_fee_amount,
    ROUND(
      wom.items_subtotal
      - wom.discount_amount
      + CASE
          WHEN wom.labor_service_subtotal > 0 THEN 0
          ELSE wom.legacy_service_fee_amount
        END,
      2
    ) AS net_amount
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
    WHEN 'pending' THEN 1
    WHEN 'scheduled' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'cancelled' THEN 4
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

CREATE OR REPLACE FUNCTION public.auto_record_work_order_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id         UUID;
  v_site_id             UUID;
  v_currency            TEXT;
  v_amount_orig         DECIMAL(12,2);
  v_rate                DECIMAL(10,4);
  v_amount_try          DECIMAL(12,2);
  v_vat_rate            DECIMAL(5,2);
  v_output_vat          DECIMAL(12,2);
  v_cogs_orig           DECIMAL(12,2);
  v_cogs_try            DECIMAL(12,2);
  v_input_vat           DECIMAL(12,2);
  v_net_income          DECIMAL(12,2);
  v_expense_category_id UUID;
  v_transaction_date    DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.site_id IS NULL THEN
    RAISE EXCEPTION 'standalone_work_order_missing_site: %', NEW.id;
  END IF;

  SELECT cs.customer_id, cs.id
  INTO v_customer_id, v_site_id
  FROM public.customer_sites cs
  WHERE cs.id = NEW.site_id;

  IF v_site_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION 'standalone_work_order_site_customer_not_found: %', NEW.id;
  END IF;

  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM public.financial_transactions
  WHERE work_order_id = NEW.id
    AND direction = 'income'
    AND deleted_at IS NULL;

  IF v_net_income > 0 THEN
    RETURN NEW;
  END IF;

  v_currency := UPPER(COALESCE(NEW.currency, 'TRY'));
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  SELECT COALESCE(net_amount, 0)
  INTO v_amount_orig
  FROM public.work_orders_detail
  WHERE id = NEW.id;

  SELECT COALESCE(SUM(
    wom.quantity * CASE
      WHEN v_currency = 'USD'
        THEN COALESCE(wom.cost_usd, 0)
      ELSE COALESCE(wom.cost, 0)
    END
  ), 0)
  INTO v_cogs_orig
  FROM public.work_order_materials wom
  WHERE wom.work_order_id = NEW.id
    AND COALESCE(wom.revenue_type, 'material') = 'material';

  IF v_amount_orig <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_currency = 'USD' THEN
    SELECT effective_rate
    INTO v_rate
    FROM public.exchange_rates
    WHERE currency = 'USD'
      AND rate_date <= v_transaction_date
    ORDER BY rate_date DESC
    LIMIT 1;

    IF v_rate IS NULL OR v_rate = 0 THEN
      RAISE EXCEPTION
        'auto_record_work_order_revenue: no USD rate on or before % for work_order %',
        v_transaction_date, NEW.id;
    END IF;

    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
    v_cogs_try := CASE
      WHEN v_cogs_orig > 0 THEN ROUND(v_cogs_orig * v_rate, 2)
      ELSE 0
    END;
  ELSE
    v_rate := NULL;
    v_amount_try := v_amount_orig;
    v_cogs_try := v_cogs_orig;
  END IF;

  v_vat_rate := CASE
    WHEN COALESCE(NEW.has_vat, false) THEN COALESCE(NEW.vat_rate, 20)
    ELSE 0
  END;
  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);

  INSERT INTO public.financial_transactions (
    direction,
    income_type,
    work_order_id,
    amount_original,
    original_currency,
    amount_try,
    exchange_rate,
    should_invoice,
    output_vat,
    vat_rate,
    cogs_try,
    transaction_date,
    customer_id,
    site_id,
    payment_method,
    created_at,
    updated_at
  ) VALUES (
    'income',
    'service',
    NEW.id,
    v_amount_orig,
    v_currency,
    v_amount_try,
    v_rate,
    true,
    v_output_vat,
    v_vat_rate,
    CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
    v_transaction_date,
    v_customer_id,
    v_site_id,
    'bank_transfer',
    now(),
    now()
  );

  IF v_cogs_try > 0 THEN
    v_input_vat := ROUND(v_cogs_try * v_vat_rate / 100, 2);

    SELECT id
    INTO v_expense_category_id
    FROM public.expense_categories
    WHERE code = 'material'
    LIMIT 1;

    INSERT INTO public.financial_transactions (
      direction,
      work_order_id,
      expense_category_id,
      amount_original,
      original_currency,
      amount_try,
      exchange_rate,
      has_invoice,
      input_vat,
      vat_rate,
      transaction_date,
      customer_id,
      site_id,
      payment_method,
      created_at,
      updated_at
    ) VALUES (
      'expense',
      NEW.id,
      v_expense_category_id,
      v_cogs_orig,
      v_currency,
      v_cogs_try,
      v_rate,
      true,
      CASE WHEN v_input_vat > 0 THEN v_input_vat ELSE NULL END,
      v_vat_rate,
      v_transaction_date,
      v_customer_id,
      v_site_id,
      'bank_transfer',
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
