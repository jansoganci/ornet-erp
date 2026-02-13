-- Migration: 00050_subscription_payment_to_finance
-- Description: When subscription payment is marked paid, create income + expense rows in financial_transactions.
-- Subscription data flows to Income/Expenses pages and v_profit_and_loss (no longer from subscription_payments).

-- ============================================================================
-- 1. Add subscription_payment_id to financial_transactions
-- ============================================================================

ALTER TABLE financial_transactions
  ADD COLUMN subscription_payment_id UUID REFERENCES subscription_payments(id) ON DELETE SET NULL;

CREATE INDEX idx_ft_subscription_payment ON financial_transactions(subscription_payment_id);

-- ============================================================================
-- 2. Add expense category for subscription COGS
-- ============================================================================

INSERT INTO expense_categories (code, name_tr, name_en, is_system, sort_order) VALUES
  ('subscription_cogs', 'Abonelik Maliyeti', 'Subscription Cost', true, 11)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. Trigger: create income + expense when subscription payment marked paid
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_subscription_payment_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_customer_id UUID;
  v_site_id UUID;
  v_cogs_try DECIMAL(12,2);
  v_multiplier INTEGER;
  v_expense_category_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Only when status changes to paid
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: already have financial rows for this payment
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE subscription_payment_id = NEW.id LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Get subscription and customer/site
  SELECT * INTO v_sub FROM subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = v_sub.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- COGS multiplier (same as v_profit_and_loss)
  IF (v_sub.billing_frequency = 'yearly' OR v_sub.subscription_type = 'annual') THEN
    v_multiplier := 12;
  ELSIF v_sub.billing_frequency = '6_month' THEN
    v_multiplier := 6;
  ELSE
    v_multiplier := 1;
  END IF;

  v_cogs_try := COALESCE(v_sub.cost, 0) * v_multiplier;

  -- 1. Insert income row (cogs_try for gross margin in P&L)
  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, subscription_payment_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate, cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'subscription', NEW.id,
      COALESCE(NEW.amount, 0), 'TRY', COALESCE(NEW.amount, 0), NULL,
      COALESCE(NEW.should_invoice, true), COALESCE(NEW.vat_amount, 0), 20,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      COALESCE(NEW.payment_date, NEW.payment_month), v_customer_id, v_site_id,
      COALESCE(NEW.payment_method, 'cash'),
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_subscription_payment_to_finance income failed for payment %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- 2. Insert expense row (COGS) if cost > 0
  IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories
    WHERE code = 'subscription_cogs'
    LIMIT 1;

    IF v_expense_category_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financial_transactions (
          direction, subscription_payment_id, expense_category_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id, payment_method,
          created_at, updated_at
        ) VALUES (
          'expense', NEW.id, v_expense_category_id,
          v_cogs_try, 'TRY', v_cogs_try, NULL,
          true, ROUND(v_cogs_try * 0.20, 2), 20,
          COALESCE(NEW.payment_date, NEW.payment_month), v_customer_id, v_site_id,
          COALESCE(NEW.payment_method, 'cash'),
          now(), now()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_subscription_payment_to_finance expense failed for payment %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_payment_to_finance
  AFTER UPDATE ON subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_subscription_payment_to_finance();

-- ============================================================================
-- 4. Update v_profit_and_loss: remove subscription_payments, use financial_transactions only
-- (DROP first to avoid "cannot change data type of view column" on CREATE OR REPLACE)
-- ============================================================================

DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Financial transactions (income) - includes subscription income from trigger
SELECT
  ft.id::TEXT AS source_id,
  COALESCE(ft.income_type, 'other') AS source_type,
  'income' AS direction,
  ft.transaction_date AS period_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL::DECIMAL AS input_vat,
  ft.should_invoice AS is_official,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'

UNION ALL

-- Financial transactions (expense)
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,
  NULL,
  ft.input_vat,
  ft.has_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense';

GRANT SELECT ON v_profit_and_loss TO authenticated;

-- ============================================================================
-- 5. Backfill: create financial rows for existing paid subscription payments
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  v_sub RECORD;
  v_customer_id UUID;
  v_site_id UUID;
  v_cogs_try DECIMAL(12,2);
  v_multiplier INTEGER;
  v_expense_category_id UUID;
BEGIN
  SELECT id INTO v_expense_category_id
  FROM expense_categories
  WHERE code = 'subscription_cogs'
  LIMIT 1;

  IF v_expense_category_id IS NULL THEN
    RAISE EXCEPTION 'subscription_cogs category not found';
  END IF;

  FOR rec IN
    SELECT sp.*
    FROM subscription_payments sp
    WHERE sp.status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft
        WHERE ft.subscription_payment_id = sp.id
      )
  LOOP
    SELECT * INTO v_sub FROM subscriptions WHERE id = rec.subscription_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
    FROM customer_sites cs WHERE cs.id = v_sub.site_id;
    IF v_site_id IS NULL THEN CONTINUE; END IF;

    IF (v_sub.billing_frequency = 'yearly' OR v_sub.subscription_type = 'annual') THEN
      v_multiplier := 12;
    ELSIF v_sub.billing_frequency = '6_month' THEN
      v_multiplier := 6;
    ELSE
      v_multiplier := 1;
    END IF;

    v_cogs_try := COALESCE(v_sub.cost, 0) * v_multiplier;

    -- Income (cogs_try for gross margin in P&L)
    INSERT INTO financial_transactions (
      direction, income_type, subscription_payment_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate, cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'subscription', rec.id,
      COALESCE(rec.amount, 0), 'TRY', COALESCE(rec.amount, 0), NULL,
      COALESCE(rec.should_invoice, true), COALESCE(rec.vat_amount, 0), 20,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      COALESCE(rec.payment_date, rec.payment_month), v_customer_id, v_site_id,
      COALESCE(rec.payment_method, 'cash'),
      now(), now()
    );

    -- Expense (COGS)
    IF v_cogs_try > 0 THEN
      INSERT INTO financial_transactions (
        direction, subscription_payment_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', rec.id, v_expense_category_id,
        v_cogs_try, 'TRY', v_cogs_try, NULL,
        true, ROUND(v_cogs_try * 0.20, 2), 20,
        COALESCE(rec.payment_date, rec.payment_month), v_customer_id, v_site_id,
        COALESCE(rec.payment_method, 'cash'),
        now(), now()
      );
    END IF;
  END LOOP;
END;
$$;
