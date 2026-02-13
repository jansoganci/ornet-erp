-- Migration: 00049_work_order_materials_finance_flow
-- Description: Work Order finance trigger now uses work_order_materials when amount is null.
-- Revenue from materials (subtotal - discount), COGS as expense. Like Proposal flow.

CREATE OR REPLACE FUNCTION auto_record_work_order_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_site_id UUID;
  v_amount_orig DECIMAL(12,2);
  v_currency TEXT;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_output_vat DECIMAL(12,2);
  v_cogs_usd DECIMAL(12,2) := 0;
  v_cogs_try DECIMAL(12,2);
  v_input_vat DECIMAL(12,2);
  v_exists BOOLEAN;
  v_subtotal_usd DECIMAL(12,2);
  v_discount_pct DECIMAL(5,2);
  v_expense_category_id UUID;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE work_order_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  IF NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Revenue: work_orders.amount if filled, else from work_order_materials
  v_amount_orig := COALESCE(NEW.amount, 0);

  IF v_amount_orig <= 0 THEN
    -- Compute from work_order_materials (subtotal - discount)
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0) INTO v_subtotal_usd
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_discount_pct := COALESCE(NEW.materials_discount_percent, 0);
    v_amount_orig := v_subtotal_usd * (1 - v_discount_pct / 100);
    v_currency := 'USD';

    IF v_amount_orig <= 0 THEN
      RETURN NEW;
    END IF;
  ELSE
    v_currency := CASE WHEN UPPER(COALESCE(NEW.currency, 'TRY')) = 'USD' THEN 'USD' ELSE 'TRY' END;
  END IF;

  IF v_currency = 'USD' THEN
    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
    ORDER BY rate_date DESC
    LIMIT 1;
    IF v_rate IS NULL OR v_rate <= 0 THEN
      v_rate := 1;
    END IF;
    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
  ELSE
    v_rate := NULL;
    v_amount_try := v_amount_orig;
  END IF;

  v_output_vat := ROUND(v_amount_try * 0.20, 2);

  -- 1. Insert income
  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'service', NEW.id,
      v_amount_orig, v_currency, v_amount_try, v_rate,
      true, v_output_vat, 20,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- 2. COGS from work_order_materials as expense
  SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0) INTO v_cogs_usd
  FROM work_order_materials wom
  WHERE wom.work_order_id = NEW.id AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

  IF v_cogs_usd > 0 THEN
    IF v_rate IS NULL OR v_rate <= 0 THEN
      SELECT effective_rate INTO v_rate FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
      v_rate := COALESCE(v_rate, 1);
    END IF;
    v_cogs_try := ROUND(v_cogs_usd * v_rate, 2);
    v_input_vat := ROUND(v_cogs_try * 0.20, 2);

    SELECT id INTO v_expense_category_id FROM expense_categories WHERE code = 'material' LIMIT 1;

    BEGIN
      INSERT INTO financial_transactions (
        direction, work_order_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        v_cogs_usd, 'USD', v_cogs_try, COALESCE(v_rate, 1),
        true, v_input_vat, 20,
        CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_work_order_revenue COGS expense failed for work_order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: Standalone completed work orders with no finance records yet
DO $$
DECLARE
  r RECORD;
  v_customer_id UUID;
  v_subtotal DECIMAL(12,2);
  v_discount_pct DECIMAL(5,2);
  v_amount_orig DECIMAL(12,2);
  v_currency TEXT;
  v_amount_try DECIMAL(12,2);
  v_cogs_usd DECIMAL(12,2);
  v_cogs_try DECIMAL(12,2);
  v_rate DECIMAL(10,4);
  v_ec_id UUID;
BEGIN
  SELECT id INTO v_ec_id FROM expense_categories WHERE code = 'material' LIMIT 1;
  SELECT effective_rate INTO v_rate FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
  v_rate := COALESCE(v_rate, 1);

  FOR r IN
    SELECT wo.id, wo.site_id, wo.amount, wo.currency, wo.materials_discount_percent
    FROM work_orders wo
    WHERE wo.status = 'completed'
      AND wo.proposal_id IS NULL
      AND wo.site_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.work_order_id = wo.id AND ft.direction = 'income')
  LOOP
    SELECT cs.customer_id INTO v_customer_id FROM customer_sites cs WHERE cs.id = r.site_id;
    IF v_customer_id IS NULL THEN CONTINUE; END IF;

    IF COALESCE(r.amount, 0) > 0 THEN
      v_amount_orig := r.amount;
      v_currency := CASE WHEN UPPER(COALESCE(r.currency, 'TRY')) = 'USD' THEN 'USD' ELSE 'TRY' END;
      IF v_currency = 'USD' THEN
        v_amount_try := ROUND(v_amount_orig * v_rate, 2);
      ELSE
        v_amount_try := v_amount_orig;
      END IF;
    ELSE
      SELECT COALESCE(SUM(quantity * unit_price_usd), 0) INTO v_subtotal
      FROM work_order_materials WHERE work_order_id = r.id;
      v_discount_pct := COALESCE(r.materials_discount_percent, 0);
      v_amount_orig := v_subtotal * (1 - v_discount_pct / 100);
      IF v_amount_orig <= 0 THEN CONTINUE; END IF;
      v_currency := 'USD';
      v_amount_try := ROUND(v_amount_orig * v_rate, 2);
    END IF;

    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method, created_at, updated_at
    ) VALUES (
      'income', 'service', r.id,
      v_amount_orig, v_currency, v_amount_try, CASE WHEN v_currency = 'USD' THEN v_rate ELSE NULL END,
      true, ROUND(v_amount_try * 0.20, 2), 20,
      CURRENT_DATE, v_customer_id, r.site_id, 'bank_transfer', now(), now()
    );

    SELECT COALESCE(SUM(quantity * cost_usd), 0) INTO v_cogs_usd
    FROM work_order_materials WHERE work_order_id = r.id AND cost_usd IS NOT NULL AND cost_usd > 0;

    IF v_cogs_usd > 0 THEN
      v_cogs_try := ROUND(v_cogs_usd * v_rate, 2);
      INSERT INTO financial_transactions (
        direction, work_order_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method, created_at, updated_at
      ) VALUES (
        'expense', r.id, v_ec_id, v_cogs_usd, 'USD', v_cogs_try, v_rate,
        true, ROUND(v_cogs_try * 0.20, 2), 20,
        CURRENT_DATE, v_customer_id, r.site_id, 'bank_transfer', now(), now()
      );
    END IF;
  END LOOP;
END;
$$;
