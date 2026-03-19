-- Migration: 00150_fix_v_pnl_double_counting
-- Description: Fix G1 double-counting bug. Remove subscription_payments from
--   v_profit_and_loss (trigger already creates financial_transactions rows).
--   Add deleted_at filter (G2). Fix 3_month COGS multiplier in trigger (G5).
--   Backfill existing 3_month records with wrong COGS.
--
-- Tasks: 1.1, 1.2, 1.3 from finance-fix-roadmap.md

-- ============================================================================
-- 1. Drop and recreate v_profit_and_loss — financial_transactions only
-- ============================================================================

DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Income (subscriptions via trigger + manual + proposals + work orders)
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
  AND ft.deleted_at IS NULL
  AND (ft.status = 'confirmed' OR ft.status IS NULL)

UNION ALL

-- Expense
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
WHERE ft.direction = 'expense'
  AND ft.deleted_at IS NULL
  AND (ft.status = 'confirmed' OR ft.status IS NULL);

-- ============================================================================
-- 2. Fix fn_subscription_payment_to_finance — 3_month COGS multiplier
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
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE subscription_payment_id = NEW.id LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

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

  -- COGS multiplier (subscription_type dropped in 00142; use billing_frequency only)
  IF v_sub.billing_frequency = 'yearly' THEN
    v_multiplier := 12;
  ELSIF v_sub.billing_frequency = '6_month' THEN
    v_multiplier := 6;
  ELSIF v_sub.billing_frequency = '3_month' THEN
    v_multiplier := 3;
  ELSE
    v_multiplier := 1;
  END IF;

  v_cogs_try := COALESCE(v_sub.cost, 0) * v_multiplier;

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

-- ============================================================================
-- 3. Backfill: fix existing 3_month subscription records with wrong COGS
-- ============================================================================

-- Income rows: cogs_try was 1x, should be 3x
UPDATE financial_transactions ft
SET cogs_try = v.correct_cogs
FROM (
  SELECT ft2.id, (COALESCE(sub.cost, 0) * 3) AS correct_cogs
  FROM financial_transactions ft2
  JOIN subscription_payments sp ON sp.id = ft2.subscription_payment_id
  JOIN subscriptions sub ON sub.id = sp.subscription_id
  WHERE ft2.direction = 'income'
    AND ft2.subscription_payment_id IS NOT NULL
    AND sub.billing_frequency = '3_month'
    AND (ft2.cogs_try IS NULL OR ft2.cogs_try < COALESCE(sub.cost, 0) * 3)
) v
WHERE ft.id = v.id;

-- Expense rows (subscription_cogs): amount_try and input_vat were 1x, should be 3x
UPDATE financial_transactions ft
SET
  amount_try = v.correct_amount,
  amount_original = v.correct_amount,
  input_vat = v.correct_input_vat
FROM (
  SELECT ft2.id,
         (COALESCE(sub.cost, 0) * 3) AS correct_amount,
         ROUND(COALESCE(sub.cost, 0) * 3 * 0.20, 2) AS correct_input_vat
  FROM financial_transactions ft2
  JOIN subscription_payments sp ON sp.id = ft2.subscription_payment_id
  JOIN subscriptions sub ON sub.id = sp.subscription_id
  JOIN expense_categories ec ON ec.id = ft2.expense_category_id AND ec.code = 'subscription_cogs'
  WHERE ft2.direction = 'expense'
    AND ft2.subscription_payment_id IS NOT NULL
    AND sub.billing_frequency = '3_month'
    AND ft2.amount_try < COALESCE(sub.cost, 0) * 3
) v
WHERE ft.id = v.id;

-- ============================================================================
-- 4. Re-apply security invoker and grant
-- ============================================================================

ALTER VIEW v_profit_and_loss SET (security_invoker = true);
GRANT SELECT ON v_profit_and_loss TO authenticated;
