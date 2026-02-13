-- Migration: 00062_fix_null_cost_price
-- Description: Fix SIM-to-Finance trigger to handle NULL/zero cost_price.
-- Skip all transaction creation when cost_price <= 0, with RAISE NOTICE for debugging.

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
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Skip subscription and cancelled (no transactions)
  IF NEW.status::text IN ('subscription', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Only process available and active
  IF NEW.status::text NOT IN ('available', 'active') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Require customer_id only (site_id can be NULL for wholesale)
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Early exit: skip all transactions if cost_price is NULL or <= 0
  IF COALESCE(NEW.cost_price, 0) <= 0 THEN
    RAISE NOTICE 'SIM % has no cost_price, skipping transaction', COALESCE(NEW.phone_number, NEW.id::TEXT);
    RETURN NEW;
  END IF;

  v_customer_id := NEW.customer_id;
  v_site_id     := NEW.site_id;
  v_period      := to_char(CURRENT_DATE, 'YYYY-MM');
  v_tx_date     := date_trunc('month', CURRENT_DATE)::DATE;

  -- 1. EXPENSE (cost_price) — for both available and active
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
        true, ROUND(COALESCE(NEW.cost_price, 0) * 0.20, 2), 20,
        v_tx_date, v_customer_id, v_site_id,
        'SIM: ' || COALESCE(NEW.phone_number, '') || ' (' || NEW.status::text || ')',
        now(), now()
      );
    END IF;
  END IF;

  -- 2. INCOME (sale_price) — only for active, and only if wholesale
  -- Wholesale = site_id NULL OR site has no active subscription
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
          true, ROUND(COALESCE(NEW.sale_price, 0) * 0.20, 2), 20,
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
