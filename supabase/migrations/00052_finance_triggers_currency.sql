-- Migration: 00052_finance_triggers_currency
-- Description: Phase 2 - Update finance triggers to use document currency (total_amount, unit_price, cost)
-- Scope: TRY and USD only. Uses COALESCE(new_col, old_col) for transition compatibility.

-- ============================================================
-- 1. auto_record_proposal_revenue
-- ============================================================
CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_site_id UUID;
  v_total_orig DECIMAL(12,2);
  v_cogs_orig DECIMAL(12,2) := 0;
  v_currency TEXT;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_cogs_try DECIMAL(12,2);
  v_output_vat DECIMAL(12,2);
  v_input_vat DECIMAL(12,2);
  v_exists BOOLEAN;
  v_item RECORD;
  v_has_detail BOOLEAN;
  v_item_cogs DECIMAL(12,2);
  v_expense_category_id UUID;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE proposal_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Revenue: prefer total_amount, fallback total_amount_usd when total_amount is 0 (app transition)
  v_total_orig := COALESCE(NULLIF(NEW.total_amount, 0), NEW.total_amount_usd, 0);
  IF v_total_orig <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Document currency (default USD for proposals)
  v_currency := UPPER(COALESCE(TRIM(NEW.currency), 'USD'));
  IF v_currency NOT IN ('TRY', 'USD') THEN
    v_currency := 'USD';
  END IF;

  -- Get customer_id, site_id from proposal (via customer_sites)
  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compute COGS from proposal_items (prefer new columns, fallback *_usd)
  FOR v_item IN
    SELECT pi.quantity,
           COALESCE(pi.cost, pi.cost_usd) AS cost_val,
           COALESCE(pi.product_cost, pi.product_cost_usd) AS product_cost_val,
           COALESCE(pi.labor_cost, pi.labor_cost_usd) AS labor_cost_val,
           COALESCE(pi.material_cost, pi.material_cost_usd) AS material_cost_val,
           COALESCE(pi.shipping_cost, pi.shipping_cost_usd) AS shipping_cost_val,
           COALESCE(pi.misc_cost, pi.misc_cost_usd) AS misc_cost_val
    FROM proposal_items pi
    WHERE pi.proposal_id = NEW.id
  LOOP
    v_has_detail :=
      (v_item.product_cost_val IS NOT NULL AND v_item.product_cost_val <> 0) OR
      (v_item.labor_cost_val IS NOT NULL AND v_item.labor_cost_val <> 0) OR
      (v_item.material_cost_val IS NOT NULL AND v_item.material_cost_val <> 0) OR
      (v_item.shipping_cost_val IS NOT NULL AND v_item.shipping_cost_val <> 0) OR
      (v_item.misc_cost_val IS NOT NULL AND v_item.misc_cost_val <> 0);

    IF v_has_detail THEN
      v_item_cogs := COALESCE(v_item.product_cost_val, 0) + COALESCE(v_item.labor_cost_val, 0) +
        COALESCE(v_item.material_cost_val, 0) + COALESCE(v_item.shipping_cost_val, 0) +
        COALESCE(v_item.misc_cost_val, 0);
    ELSE
      v_item_cogs := COALESCE(v_item.cost_val, 0);
    END IF;
    v_cogs_orig := v_cogs_orig + (v_item_cogs * COALESCE(v_item.quantity, 1));
  END LOOP;

  -- Conversion: TRY = no conversion; USD = fetch rate
  IF v_currency = 'USD' THEN
    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
    ORDER BY rate_date DESC
    LIMIT 1;
    IF v_rate IS NULL OR v_rate <= 0 THEN
      v_rate := 1;
    END IF;
    v_amount_try := ROUND(v_total_orig * v_rate, 2);
    v_cogs_try := CASE WHEN v_cogs_orig > 0 THEN ROUND(v_cogs_orig * v_rate, 2) ELSE NULL END;
  ELSE
    v_rate := NULL;
    v_amount_try := v_total_orig;
    v_cogs_try := CASE WHEN v_cogs_orig > 0 THEN v_cogs_orig ELSE NULL END;
  END IF;

  v_output_vat := ROUND(v_amount_try * 0.20, 2);
  v_input_vat := CASE WHEN v_cogs_try > 0 THEN ROUND(v_cogs_try * 0.20, 2) ELSE NULL END;

  -- 1. Insert income transaction
  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, proposal_id,
      amount_original, original_currency, amount_try, exchange_rate,
      cogs_try, should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_total_orig, v_currency, v_amount_try, v_rate,
      v_cogs_try, true, v_output_vat, 20,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue failed for proposal %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- 2. Insert COGS as expense transaction
  IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories
    WHERE code = 'material'
    LIMIT 1;

    BEGIN
      INSERT INTO financial_transactions (
        direction, proposal_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        v_cogs_orig, v_currency, v_cogs_try, v_rate,
        true, v_input_vat, 20,
        CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_proposal_revenue COGS expense failed for proposal %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. auto_record_work_order_revenue
-- ============================================================
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
  v_cogs_orig DECIMAL(12,2) := 0;
  v_cogs_try DECIMAL(12,2);
  v_input_vat DECIMAL(12,2);
  v_exists BOOLEAN;
  v_subtotal DECIMAL(12,2);
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

  -- Document currency (default TRY for work orders)
  v_currency := UPPER(COALESCE(TRIM(NEW.currency), 'TRY'));
  IF v_currency NOT IN ('TRY', 'USD') THEN
    v_currency := 'TRY';
  END IF;

  -- Revenue: work_orders.amount if filled, else from work_order_materials
  v_amount_orig := COALESCE(NEW.amount, 0);

  IF v_amount_orig <= 0 THEN
    -- Compute from work_order_materials (prefer unit_price, fallback unit_price_usd)
    SELECT COALESCE(
      SUM(wom.quantity * COALESCE(wom.unit_price, wom.unit_price_usd)),
      0
    ) INTO v_subtotal
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_discount_pct := COALESCE(NEW.materials_discount_percent, 0);
    v_amount_orig := v_subtotal * (1 - v_discount_pct / 100);

    IF v_amount_orig <= 0 THEN
      RETURN NEW;
    END IF;
    -- Materials use document currency (no longer hardcoded USD)
  END IF;

  -- Conversion: TRY = no conversion; USD = fetch rate
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

  -- 2. COGS from work_order_materials (prefer cost, fallback cost_usd)
  SELECT COALESCE(
    SUM(wom.quantity * COALESCE(wom.cost, wom.cost_usd)),
    0
  ) INTO v_cogs_orig
  FROM work_order_materials wom
  WHERE wom.work_order_id = NEW.id
    AND (wom.cost IS NOT NULL AND wom.cost > 0 OR wom.cost_usd IS NOT NULL AND wom.cost_usd > 0);

  IF v_cogs_orig > 0 THEN
    IF v_currency = 'USD' THEN
      IF v_rate IS NULL OR v_rate <= 0 THEN
        SELECT effective_rate INTO v_rate FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
        v_rate := COALESCE(v_rate, 1);
      END IF;
      v_cogs_try := ROUND(v_cogs_orig * v_rate, 2);
    ELSE
      v_cogs_try := v_cogs_orig;
      v_rate := NULL;
    END IF;
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
        v_cogs_orig, v_currency, v_cogs_try, v_rate,
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
