-- Migration: 00155_add_vat_rate_columns
-- Description: Add vat_rate column to work_orders, proposals, sim_cards so
--   finance triggers can use dynamic VAT instead of hardcoded 20%. Completes G6.

-- ============================================================================
-- 1. Add vat_rate column to each table
-- ============================================================================

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20;

ALTER TABLE sim_cards
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20;

COMMENT ON COLUMN work_orders.vat_rate IS 'VAT rate (%) for revenue trigger. Default 20.';
COMMENT ON COLUMN proposals.vat_rate IS 'VAT rate (%) for revenue trigger. Default 20.';
COMMENT ON COLUMN sim_cards.vat_rate IS 'VAT rate (%) for finance trigger. Default 20.';

-- ============================================================================
-- 2. auto_record_proposal_revenue — use COALESCE(NEW.vat_rate, 20)
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_site_id UUID;
  v_total_usd DECIMAL(12,2);
  v_cogs_usd DECIMAL(12,2) := 0;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_cogs_try DECIMAL(12,2);
  v_output_vat DECIMAL(12,2);
  v_exists BOOLEAN;
  v_item RECORD;
  v_has_detail BOOLEAN;
  v_item_cogs DECIMAL(12,2);
  v_vat_rate DECIMAL(5,2);
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE proposal_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_vat_rate := COALESCE(NEW.vat_rate, 20);

  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT pi.quantity, pi.cost_usd, pi.product_cost_usd, pi.labor_cost_usd,
           pi.material_cost_usd, pi.shipping_cost_usd, pi.misc_cost_usd
    FROM proposal_items pi
    WHERE pi.proposal_id = NEW.id
  LOOP
    v_has_detail :=
      (v_item.product_cost_usd IS NOT NULL AND v_item.product_cost_usd <> 0) OR
      (v_item.labor_cost_usd IS NOT NULL AND v_item.labor_cost_usd <> 0) OR
      (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0) OR
      (v_item.shipping_cost_usd IS NOT NULL AND v_item.shipping_cost_usd <> 0) OR
      (v_item.misc_cost_usd IS NOT NULL AND v_item.misc_cost_usd <> 0);

    IF v_has_detail THEN
      v_item_cogs := COALESCE(v_item.product_cost_usd, 0) + COALESCE(v_item.labor_cost_usd, 0) +
        COALESCE(v_item.material_cost_usd, 0) + COALESCE(v_item.shipping_cost_usd, 0) +
        COALESCE(v_item.misc_cost_usd, 0);
    ELSE
      v_item_cogs := COALESCE(v_item.cost_usd, 0);
    END IF;
    v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
  END LOOP;

  SELECT effective_rate INTO v_rate
  FROM exchange_rates
  WHERE currency = 'USD'
  ORDER BY rate_date DESC
  LIMIT 1;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    v_rate := 1;
  END IF;

  v_amount_try := ROUND(v_total_usd * v_rate, 2);
  v_cogs_try := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
  v_output_vat := ROUND(v_amount_try * (v_vat_rate / 100.0), 2);

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, proposal_id,
      amount_original, original_currency, amount_try, exchange_rate,
      cogs_try, should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_total_usd, 'USD', v_amount_try, v_rate,
      v_cogs_try, true, v_output_vat, v_vat_rate,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue failed for proposal %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. auto_record_work_order_revenue — use COALESCE(NEW.vat_rate, 20)
-- ============================================================================

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
  v_vat_rate DECIMAL(5,2);
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

  v_vat_rate := COALESCE(NEW.vat_rate, 20);

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_amount_orig := COALESCE(NEW.amount, 0);

  IF v_amount_orig <= 0 THEN
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

  v_output_vat := ROUND(v_amount_try * (v_vat_rate / 100.0), 2);

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
      true, v_output_vat, v_vat_rate,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0) INTO v_cogs_usd
  FROM work_order_materials wom
  WHERE wom.work_order_id = NEW.id AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

  IF v_cogs_usd > 0 THEN
    IF v_rate IS NULL OR v_rate <= 0 THEN
      SELECT effective_rate INTO v_rate FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
      v_rate := COALESCE(v_rate, 1);
    END IF;
    v_cogs_try := ROUND(v_cogs_usd * v_rate, 2);
    v_input_vat := ROUND(v_cogs_try * (v_vat_rate / 100.0), 2);

    SELECT id INTO v_expense_category_id FROM expense_categories WHERE code = 'material' LIMIT 1;

    IF v_expense_category_id IS NOT NULL THEN
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
          true, v_input_vat, v_vat_rate,
          CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
          now(), now()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'auto_record_work_order_revenue COGS expense failed for work_order %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. fn_sim_card_to_finance — use COALESCE(NEW.vat_rate, 20)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sim_card_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period       TEXT;
  v_tx_date      DATE;
  v_customer_id  UUID;
  v_site_id      UUID;
  v_expense_cat_id UUID;
  v_amount_try   DECIMAL(12,2);
  v_exists       BOOLEAN;
  v_is_wholesale BOOLEAN;
  v_vat_rate     DECIMAL(5,2);
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('subscription', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text NOT IN ('available', 'active') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_vat_rate := COALESCE(NEW.vat_rate, 20);

  v_customer_id := NEW.customer_id;
  v_site_id     := NEW.site_id;
  v_period      := to_char(CURRENT_DATE, 'YYYY-MM');
  v_tx_date     := date_trunc('month', CURRENT_DATE)::DATE;

  IF COALESCE(NEW.cost_price, 0) > 0 THEN
    SELECT id INTO v_expense_cat_id
    FROM expense_categories
    WHERE code = 'sim_operator'
    LIMIT 1;

    IF v_expense_cat_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'expense'
        LIMIT 1
      ) INTO v_exists;

      IF NOT v_exists THEN
        v_amount_try := COALESCE(NEW.cost_price, 0);
        INSERT INTO financial_transactions (
          direction, expense_category_id, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'expense', v_expense_cat_id, NEW.id,
          COALESCE(NEW.cost_price, 0), 'TRY', v_amount_try, NULL,
          true, ROUND(COALESCE(NEW.cost_price, 0) * (v_vat_rate / 100.0), 2), v_vat_rate,
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' (' || NEW.status::text || ')',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  IF NEW.status::text = 'active' AND COALESCE(NEW.sale_price, 0) > 0 THEN
    v_is_wholesale := (NEW.site_id IS NULL) OR (NOT site_has_active_subscription(NEW.site_id));

    IF v_is_wholesale THEN
      v_amount_try := COALESCE(NEW.sale_price, 0);

      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'income'
        LIMIT 1
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO financial_transactions (
          direction, income_type, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          should_invoice, output_vat, vat_rate, cogs_try,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'income', 'sim_rental', NEW.id,
          COALESCE(NEW.sale_price, 0), 'TRY', v_amount_try, NULL,
          true, ROUND(COALESCE(NEW.sale_price, 0) * (v_vat_rate / 100.0), 2), v_vat_rate,
          COALESCE(NEW.cost_price, 0),
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' kiralama',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
