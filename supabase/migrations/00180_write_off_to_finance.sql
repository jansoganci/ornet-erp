-- Migration: 00180_write_off_to_finance
-- Description: When a subscription payment is written off (status → write_off),
--   create an expense row in financial_transactions under the "bad_debt" category.
--   fn_revert_write_off is updated to delete that expense row on reversal.

-- ============================================================================
-- 1. Add bad_debt expense category
-- ============================================================================

INSERT INTO expense_categories (code, name_tr, name_en, is_system, sort_order) VALUES
  ('bad_debt', 'Tahsil Edilemeyen Alacak', 'Bad Debt / Write-Off', true, 12)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. Trigger function: create expense row when payment status → write_off
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_write_off_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub                  RECORD;
  v_customer_id          UUID;
  v_site_id              UUID;
  v_expense_category_id  UUID;
  v_exists               BOOLEAN;
BEGIN
  -- Only when status transitions to write_off
  IF NEW.status <> 'write_off' OR OLD.status = 'write_off' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if a bad_debt expense row already exists for this payment
  SELECT EXISTS(
    SELECT 1
    FROM financial_transactions ft
    JOIN expense_categories ec ON ft.expense_category_id = ec.id
    WHERE ft.subscription_payment_id = NEW.id
      AND ft.direction = 'expense'
      AND ec.code = 'bad_debt'
    LIMIT 1
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Get the bad_debt category
  SELECT id INTO v_expense_category_id
  FROM expense_categories
  WHERE code = 'bad_debt'
  LIMIT 1;

  IF v_expense_category_id IS NULL THEN
    RAISE WARNING 'fn_write_off_to_finance: bad_debt expense category not found, skipping payment %', NEW.id;
    RETURN NEW;
  END IF;

  -- Get subscription and resolve customer / site
  SELECT * INTO v_sub FROM subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN
    RAISE WARNING 'fn_write_off_to_finance: subscription not found for payment %', NEW.id;
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, cs.id
  INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = v_sub.site_id;

  -- Insert the bad-debt expense row
  BEGIN
    INSERT INTO financial_transactions (
      direction,
      expense_category_id,
      subscription_payment_id,
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
      v_expense_category_id,
      NEW.id,
      COALESCE(NEW.amount, 0),
      'TRY',
      COALESCE(NEW.amount, 0),
      NULL,
      false,
      0,
      0,
      COALESCE(NEW.payment_date, NEW.payment_month, CURRENT_DATE),
      v_customer_id,
      v_site_id,
      COALESCE(NEW.payment_method, 'cash'),
      now(),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_write_off_to_finance: insert failed for payment %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_write_off_to_finance
  AFTER UPDATE ON subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_write_off_to_finance();

-- ============================================================================
-- 3. Update fn_revert_write_off: delete the bad_debt expense row on reversal
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_revert_write_off(
  p_payment_id UUID
)
RETURNS SETOF subscription_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_row     subscription_payments%ROWTYPE;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  -- Remove the bad_debt expense row created by fn_write_off_to_finance
  DELETE FROM financial_transactions
  WHERE subscription_payment_id = p_payment_id
    AND direction = 'expense'
    AND expense_category_id = (
      SELECT id FROM expense_categories WHERE code = 'bad_debt' LIMIT 1
    );

  UPDATE subscription_payments
  SET
    status     = 'pending',
    updated_at = NOW()
  WHERE id     = p_payment_id
    AND status = 'write_off'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or is not in write_off status: %', p_payment_id;
  END IF;

  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    description
  )
  VALUES (
    'subscription_payments',
    p_payment_id,
    'status_change',
    jsonb_build_object('status', 'write_off'),
    jsonb_build_object('status', 'pending'),
    v_user_id,
    'Silme geri alındı, ödeme beklemeye alındı'
  );

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_revert_write_off(UUID) TO authenticated;
