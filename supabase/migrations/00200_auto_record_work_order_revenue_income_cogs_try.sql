-- 00200_auto_record_work_order_revenue_income_cogs_try.sql
--
-- Align standalone WO finance with proposal pattern: compute COGS (TRY) before
-- the income INSERT and store cogs_try on the income row (gross margin / P&L).
-- Replaces body from 00190; keeps SECURITY DEFINER + idempotency + reversal compatibility.

CREATE OR REPLACE FUNCTION auto_record_work_order_revenue()
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
  v_cogs_try            DECIMAL(12,2);
  v_input_vat           DECIMAL(12,2);
  v_net_income          DECIMAL(12,2);
  v_discount_pct        DECIMAL(5,2);
  v_expense_category_id UUID;
  v_transaction_date    DATE;
BEGIN
  -- Only fire on transition → 'completed' for standalone WOs
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.site_id IS NULL THEN RETURN NEW; END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency guard (NET-based)
  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE work_order_id = NEW.id
    AND direction     = 'income'
    AND deleted_at    IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_currency         := UPPER(COALESCE(NEW.currency, 'TRY'));
  v_vat_rate         := COALESCE(NEW.vat_rate, 20);
  v_discount_pct     := COALESCE(NEW.materials_discount_percent, 0);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  -- Revenue amount
  IF v_currency = 'USD' THEN
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0)
    INTO v_amount_orig
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
    IF v_amount_orig <= 0 THEN RETURN NEW; END IF;

    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
      AND rate_date <= v_transaction_date
    ORDER BY rate_date DESC
    LIMIT 1;

    IF v_rate IS NULL OR v_rate = 0 THEN
      RAISE WARNING
        'auto_record_work_order_revenue: no USD rate on or before % for work_order %. '
        'Finance entry skipped.',
        v_transaction_date, NEW.id;
      RETURN NEW;
    END IF;

    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
  ELSE
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price), 0)
    INTO v_amount_orig
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
    IF v_amount_orig <= 0 THEN RETURN NEW; END IF;

    v_rate       := NULL;
    v_amount_try := v_amount_orig;
  END IF;

  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);

  -- COGS (TRY) before income insert
  IF v_currency = 'USD' THEN
    SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0)
    INTO v_cogs_try
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

    IF v_cogs_try > 0 THEN
      v_cogs_try := ROUND(v_cogs_try * v_rate, 2);
    END IF;
  ELSE
    SELECT COALESCE(SUM(wom.quantity * wom.cost), 0)
    INTO v_cogs_try
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.cost IS NOT NULL AND wom.cost > 0;
  END IF;

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'service', NEW.id,
      v_amount_orig, v_currency, v_amount_try, v_rate,
      true, v_output_vat, v_vat_rate,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue (income) failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- COGS expense row (unchanged)
  IF v_cogs_try > 0 THEN
    v_input_vat := ROUND(v_cogs_try * v_vat_rate / 100, 2);

    SELECT id INTO v_expense_category_id
    FROM expense_categories WHERE code = 'material' LIMIT 1;

    BEGIN
      INSERT INTO financial_transactions (
        direction, work_order_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        CASE WHEN v_currency = 'USD' THEN ROUND(v_cogs_try / NULLIF(v_rate, 0), 2)
             ELSE v_cogs_try END,
        v_currency, v_cogs_try, v_rate,
        true, v_input_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_work_order_revenue (COGS) failed for work_order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
