-- 00241_work_order_posting_consistency.sql
--
-- Phase 3 / Step 2: standalone work-order posting consistency.
--
-- Scope:
-- 1. Post standalone WO income from the canonical net base exposed by work_orders_detail
--    (discounted items + service fee; planned labor remains operational-only).
-- 2. Make work_orders.has_vat the source-row toggle for output VAT posting.
-- 3. Persist completion-time VAT overrides onto work_orders before completion so the
--    trigger and source row agree.
-- 4. Stop swallowing standalone WO finance insert failures so completion rolls back
--    instead of leaving receivable/payment state out of sync with posted income.

BEGIN;

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

  SELECT
    COALESCE(net_amount, 0),
    COALESCE(items_cost_total, 0)
  INTO
    v_amount_orig,
    v_cogs_orig
  FROM public.work_orders_detail
  WHERE id = NEW.id;

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
      v_input_vat,
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

CREATE OR REPLACE FUNCTION public.fn_complete_work_order_with_payment(
  p_work_order_id   UUID,
  p_payment_method  TEXT,
  p_collection_date DATE    DEFAULT CURRENT_DATE,
  p_vat_rate        NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_user_role      TEXT;
  v_wo_status      TEXT;
  v_proposal_id    UUID;
  v_assigned_to    UUID[];
  v_transaction_id UUID;
  v_amount_try     DECIMAL(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_user_role := get_my_role();

  IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
  END IF;

  SELECT status, proposal_id, assigned_to
  INTO v_wo_status, v_proposal_id, v_assigned_to
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order_not_found: %', p_work_order_id;
  END IF;

  IF v_user_role IS NULL OR (
    v_user_role NOT IN ('admin', 'accountant')
    AND NOT (v_user_role = 'field_worker' AND v_user_id = ANY(COALESCE(v_assigned_to, ARRAY[]::UUID[])))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot complete this work order', v_user_role;
  END IF;

  IF v_wo_status <> 'in_progress' THEN
    RAISE EXCEPTION 'work_order_not_in_progress: current status is %', v_wo_status;
  END IF;

  UPDATE public.work_orders
  SET
    status = 'completed',
    completed_at = p_collection_date::TIMESTAMPTZ,
    vat_rate = CASE
      WHEN p_vat_rate IS NOT NULL THEN p_vat_rate
      ELSE vat_rate
    END,
    has_vat = CASE
      WHEN p_vat_rate IS NOT NULL THEN p_vat_rate > 0
      ELSE has_vat
    END
  WHERE id = p_work_order_id;

  IF v_proposal_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed_proposal_linked');
  END IF;

  SELECT id, amount_try
  INTO v_transaction_id, v_amount_try
  FROM public.financial_transactions
  WHERE work_order_id = p_work_order_id
    AND direction = 'income'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_transaction_id IS NULL THEN
    RETURN jsonb_build_object('status', 'completed_no_finance');
  END IF;

  UPDATE public.financial_transactions
  SET payment_method = p_payment_method
  WHERE id = v_transaction_id;

  IF p_payment_method IN ('cash', 'card') THEN
    INSERT INTO public.financial_transaction_payments (
      transaction_id,
      amount_try,
      payment_method,
      paid_at,
      created_by
    ) VALUES (
      v_transaction_id,
      v_amount_try,
      p_payment_method,
      p_collection_date,
      v_user_id
    );

    RETURN jsonb_build_object(
      'status', 'paid',
      'transaction_id', v_transaction_id,
      'payment_status', 'paid'
    );
  END IF;

  UPDATE public.financial_transactions
  SET payment_status = 'unpaid'
  WHERE id = v_transaction_id;

  RETURN jsonb_build_object(
    'status', 'unpaid',
    'transaction_id', v_transaction_id,
    'payment_status', 'unpaid'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)
  TO authenticated;

COMMIT;

-- REVERT:
-- BEGIN;
--
-- CREATE OR REPLACE FUNCTION public.auto_record_work_order_revenue()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_customer_id         UUID;
--   v_site_id             UUID;
--   v_currency            TEXT;
--   v_amount_orig         DECIMAL(12,2);
--   v_rate                DECIMAL(10,4);
--   v_amount_try          DECIMAL(12,2);
--   v_vat_rate            DECIMAL(5,2);
--   v_output_vat          DECIMAL(12,2);
--   v_cogs_try            DECIMAL(12,2);
--   v_input_vat           DECIMAL(12,2);
--   v_net_income          DECIMAL(12,2);
--   v_discount_pct        DECIMAL(5,2);
--   v_expense_category_id UUID;
--   v_transaction_date    DATE;
-- BEGIN
--   IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
--     RETURN NEW;
--   END IF;
--   IF NEW.proposal_id IS NOT NULL THEN
--     RETURN NEW;
--   END IF;
--
--   IF NEW.site_id IS NULL THEN RETURN NEW; END IF;
--
--   SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
--   FROM customer_sites cs WHERE cs.id = NEW.site_id;
--   IF v_site_id IS NULL THEN RETURN NEW; END IF;
--
--   SELECT COALESCE(SUM(amount_try), 0)
--   INTO v_net_income
--   FROM financial_transactions
--   WHERE work_order_id = NEW.id
--     AND direction     = 'income'
--     AND deleted_at    IS NULL;
--   IF v_net_income > 0 THEN RETURN NEW; END IF;
--
--   v_currency         := UPPER(COALESCE(NEW.currency, 'TRY'));
--   v_vat_rate         := COALESCE(NEW.vat_rate, 20);
--   v_discount_pct     := COALESCE(NEW.materials_discount_percent, 0);
--   v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);
--
--   IF v_currency = 'USD' THEN
--     SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0)
--     INTO v_amount_orig
--     FROM work_order_materials wom
--     WHERE wom.work_order_id = NEW.id;
--
--     v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
--     IF v_amount_orig <= 0 THEN RETURN NEW; END IF;
--
--     SELECT effective_rate INTO v_rate
--     FROM exchange_rates
--     WHERE currency = 'USD'
--       AND rate_date <= v_transaction_date
--     ORDER BY rate_date DESC
--     LIMIT 1;
--
--     IF v_rate IS NULL OR v_rate = 0 THEN
--       RAISE WARNING
--         'auto_record_work_order_revenue: no USD rate on or before % for work_order %. Finance entry skipped.',
--         v_transaction_date, NEW.id;
--       RETURN NEW;
--     END IF;
--
--     v_amount_try := ROUND(v_amount_orig * v_rate, 2);
--   ELSE
--     SELECT COALESCE(SUM(wom.quantity * wom.unit_price), 0)
--     INTO v_amount_orig
--     FROM work_order_materials wom
--     WHERE wom.work_order_id = NEW.id;
--
--     v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
--     IF v_amount_orig <= 0 THEN RETURN NEW; END IF;
--
--     v_rate       := NULL;
--     v_amount_try := v_amount_orig;
--   END IF;
--
--   v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);
--
--   IF v_currency = 'USD' THEN
--     SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0)
--     INTO v_cogs_try
--     FROM work_order_materials wom
--     WHERE wom.work_order_id = NEW.id
--       AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;
--
--     IF v_cogs_try > 0 THEN
--       v_cogs_try := ROUND(v_cogs_try * v_rate, 2);
--     END IF;
--   ELSE
--     SELECT COALESCE(SUM(wom.quantity * wom.cost), 0)
--     INTO v_cogs_try
--     FROM work_order_materials wom
--     WHERE wom.work_order_id = NEW.id
--       AND wom.cost IS NOT NULL AND wom.cost > 0;
--   END IF;
--
--   BEGIN
--     INSERT INTO financial_transactions (
--       direction, income_type, work_order_id,
--       amount_original, original_currency, amount_try, exchange_rate,
--       should_invoice, output_vat, vat_rate,
--       cogs_try,
--       transaction_date, customer_id, site_id, payment_method,
--       created_at, updated_at
--     ) VALUES (
--       'income', 'service', NEW.id,
--       v_amount_orig, v_currency, v_amount_try, v_rate,
--       true, v_output_vat, v_vat_rate,
--       CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
--       v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--       now(), now()
--     );
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'auto_record_work_order_revenue (income) failed for work_order %: %', NEW.id, SQLERRM;
--     RETURN NEW;
--   END;
--
--   IF v_cogs_try > 0 THEN
--     v_input_vat := ROUND(v_cogs_try * v_vat_rate / 100, 2);
--
--     SELECT id INTO v_expense_category_id
--     FROM expense_categories WHERE code = 'material' LIMIT 1;
--
--     BEGIN
--       INSERT INTO financial_transactions (
--         direction, work_order_id, expense_category_id,
--         amount_original, original_currency, amount_try, exchange_rate,
--         has_invoice, input_vat, vat_rate,
--         transaction_date, customer_id, site_id, payment_method,
--         created_at, updated_at
--       ) VALUES (
--         'expense', NEW.id, v_expense_category_id,
--         CASE WHEN v_currency = 'USD' THEN ROUND(v_cogs_try / NULLIF(v_rate, 0), 2)
--              ELSE v_cogs_try END,
--         v_currency, v_cogs_try, v_rate,
--         true, v_input_vat, v_vat_rate,
--         v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--         now(), now()
--       );
--     EXCEPTION WHEN OTHERS THEN
--       RAISE WARNING 'auto_record_work_order_revenue (COGS) failed for work_order %: %', NEW.id, SQLERRM;
--     END;
--   END IF;
--
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE OR REPLACE FUNCTION public.fn_complete_work_order_with_payment(
--   p_work_order_id   UUID,
--   p_payment_method  TEXT,
--   p_collection_date DATE    DEFAULT CURRENT_DATE,
--   p_vat_rate        NUMERIC DEFAULT NULL
-- )
-- RETURNS JSONB
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_user_id        UUID;
--   v_user_role      TEXT;
--   v_wo_status      TEXT;
--   v_proposal_id    UUID;
--   v_wo_vat_rate    NUMERIC;
--   v_assigned_to    UUID[];
--   v_transaction_id UUID;
--   v_amount_try     DECIMAL(12,2);
-- BEGIN
--   v_user_id := auth.uid();
--   IF v_user_id IS NULL THEN
--     RAISE EXCEPTION 'not_authenticated';
--   END IF;
--
--   v_user_role := get_my_role();
--
--   IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
--     RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
--   END IF;
--
--   SELECT status, proposal_id, COALESCE(vat_rate, 0), assigned_to
--   INTO   v_wo_status, v_proposal_id, v_wo_vat_rate, v_assigned_to
--   FROM   work_orders
--   WHERE  id = p_work_order_id;
--
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'work_order_not_found: %', p_work_order_id;
--   END IF;
--
--   IF v_user_role IS NULL OR (
--     v_user_role NOT IN ('admin', 'accountant')
--     AND NOT (v_user_role = 'field_worker' AND v_user_id = ANY(COALESCE(v_assigned_to, ARRAY[]::UUID[])))
--   ) THEN
--     RAISE EXCEPTION 'Unauthorized: role % cannot complete this work order', v_user_role;
--   END IF;
--
--   IF v_wo_status <> 'in_progress' THEN
--     RAISE EXCEPTION 'work_order_not_in_progress: current status is %', v_wo_status;
--   END IF;
--
--   UPDATE work_orders
--   SET    status       = 'completed',
--          completed_at = p_collection_date::TIMESTAMPTZ
--   WHERE  id = p_work_order_id;
--
--   IF v_proposal_id IS NOT NULL THEN
--     RETURN jsonb_build_object('status', 'completed_proposal_linked');
--   END IF;
--
--   SELECT id, amount_try
--   INTO   v_transaction_id, v_amount_try
--   FROM   financial_transactions
--   WHERE  work_order_id = p_work_order_id
--     AND  direction     = 'income'
--     AND  deleted_at    IS NULL
--   ORDER  BY created_at DESC
--   LIMIT  1;
--
--   IF v_transaction_id IS NULL THEN
--     RETURN jsonb_build_object('status', 'completed_no_finance');
--   END IF;
--
--   IF p_vat_rate IS NOT NULL AND p_vat_rate IS DISTINCT FROM v_wo_vat_rate THEN
--     UPDATE financial_transactions
--     SET    output_vat = ROUND(amount_try * p_vat_rate / 100, 2),
--            vat_rate   = p_vat_rate
--     WHERE  id = v_transaction_id;
--   END IF;
--
--   UPDATE financial_transactions
--   SET    payment_method = p_payment_method
--   WHERE  id = v_transaction_id;
--
--   IF p_payment_method IN ('cash', 'card') THEN
--     INSERT INTO financial_transaction_payments (
--       transaction_id, amount_try, payment_method, paid_at, created_by
--     ) VALUES (
--       v_transaction_id, v_amount_try, p_payment_method, p_collection_date, v_user_id
--     );
--
--     RETURN jsonb_build_object(
--       'status',          'paid',
--       'transaction_id',  v_transaction_id,
--       'payment_status',  'paid'
--     );
--   ELSE
--     UPDATE financial_transactions
--     SET    payment_status = 'unpaid'
--     WHERE  id = v_transaction_id;
--
--     RETURN jsonb_build_object(
--       'status',          'unpaid',
--       'transaction_id',  v_transaction_id,
--       'payment_status',  'unpaid'
--     );
--   END IF;
-- END;
-- $$;
--
-- GRANT EXECUTE ON FUNCTION public.fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)
--   TO authenticated;
--
-- COMMIT;
