-- Migration: 00122_guard_cancel_and_payment_rpcs
-- Description: Add role guards to fn_cancel_subscription() and fn_record_payment()
--   so only admin and accountant can execute them. Both functions are SECURITY
--   DEFINER and were previously callable by any authenticated user including
--   field_workers. Also adds SET search_path = public to fn_cancel_subscription
--   which was missing from the original 00111 definition.

-- ============================================================================
-- 1. fn_cancel_subscription — guard + add missing SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_cancel_subscription(
  p_subscription_id  UUID,
  p_reason           TEXT    DEFAULT NULL,
  p_write_off_unpaid BOOLEAN DEFAULT FALSE
)
RETURNS SETOF subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    TEXT;
  v_user_id UUID;
  v_row     subscriptions%ROWTYPE;
BEGIN
  -- Role guard: only admin and accountant may cancel subscriptions
  v_role := get_my_role();
  IF v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', v_role;
  END IF;

  -- Resolve the calling user for the audit log
  SELECT auth.uid() INTO v_user_id;

  -- 1. Cancel the subscription
  UPDATE subscriptions
  SET
    status        = 'cancelled',
    cancel_reason = p_reason,
    cancelled_at  = NOW(),
    updated_at    = NOW()
  WHERE id = p_subscription_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

  -- 2. Optionally write off all pending payments (same transaction)
  IF p_write_off_unpaid THEN
    UPDATE subscription_payments
    SET
      status     = 'write_off',
      updated_at = NOW()
    WHERE subscription_id = p_subscription_id
      AND status          = 'pending';
  END IF;

  -- 3. Audit log (also inside the same transaction)
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
    'subscriptions',
    p_subscription_id,
    'cancel',
    NULL,
    jsonb_build_object(
      'reason',           p_reason,
      'write_off_unpaid', p_write_off_unpaid
    ),
    v_user_id,
    'Abonelik iptal edildi'
  );

  RETURN NEXT v_row;
END;
$$;

-- ============================================================================
-- 2. fn_record_payment — guard only (SET search_path already present in 00098)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_record_payment(
  p_payment_id     UUID,
  p_payment_date   DATE,
  p_payment_method TEXT,
  p_should_invoice BOOLEAN,
  p_vat_rate       NUMERIC,
  p_invoice_no     TEXT,
  p_invoice_type   TEXT,
  p_notes          TEXT,
  p_reference_no   TEXT,
  p_user_id        UUID
)
RETURNS SETOF subscription_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    TEXT;
  v_payment subscription_payments;
  v_vat_amt NUMERIC;
  v_total   NUMERIC;
BEGIN
  -- Role guard: only admin and accountant may record payments
  v_role := get_my_role();
  IF v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', v_role;
  END IF;

  -- ── Step 1: Lock the row immediately ────────────────────────────────────
  SELECT * INTO v_payment
  FROM subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found: %', p_payment_id;
  END IF;

  -- ── Step 2: Immutability check ───────────────────────────────────────────
  IF v_payment.status = 'paid' AND v_payment.invoice_no IS NOT NULL THEN
    RAISE EXCEPTION 'payment_locked: payment % is already paid and invoiced', p_payment_id;
  END IF;

  -- ── Step 3: Derive VAT + totals ─────────────────────────────────────────
  IF p_should_invoice THEN
    v_vat_amt := ROUND(v_payment.amount * p_vat_rate / 100, 2);
    v_total   := v_payment.amount + v_vat_amt;
  ELSE
    v_vat_amt := 0;
    v_total   := v_payment.amount;
  END IF;

  -- ── Step 4: Apply update ─────────────────────────────────────────────────
  UPDATE subscription_payments
  SET
    status            = 'paid',
    payment_date      = p_payment_date,
    payment_method    = p_payment_method,
    should_invoice    = p_should_invoice,
    payment_vat_rate  = CASE WHEN p_should_invoice THEN p_vat_rate ELSE 0 END,
    vat_amount        = v_vat_amt,
    total_amount      = v_total,
    invoice_no        = CASE WHEN p_should_invoice THEN p_invoice_no   ELSE NULL END,
    invoice_type      = CASE WHEN p_should_invoice THEN p_invoice_type ELSE NULL END,
    invoice_date      = CASE
                          WHEN p_should_invoice AND p_invoice_no IS NOT NULL
                          THEN p_payment_date
                          ELSE NULL
                        END,
    notes             = p_notes,
    reference_no      = p_reference_no
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  -- ── Step 5: Audit log ────────────────────────────────────────────────────
  INSERT INTO audit_logs (
    table_name, record_id, action,
    old_values, new_values,
    user_id, description
  ) VALUES (
    'subscription_payments',
    p_payment_id,
    'payment_recorded',
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'status',          'paid',
      'payment_date',    p_payment_date,
      'payment_method',  p_payment_method,
      'should_invoice',  p_should_invoice
    ),
    p_user_id,
    'Ödeme kaydedildi: ' || v_payment.payment_month::text
  );

  RETURN NEXT v_payment;
END;
$$;
