-- Migration: 00098_atomic_record_payment
-- Description: Replace the client-side SELECT→check→UPDATE sequence in
--   recordPayment() with a single atomic database function (fn_record_payment).
--   Uses SELECT FOR UPDATE to row-lock the payment before any modification,
--   eliminating the TOCTOU race window where two concurrent requests could
--   both pass the immutability check and both mark the same payment as paid.
--
--   Also adds fn_update_subscription_price to atomically update subscription
--   prices and recalculate all pending payment amounts in one transaction,
--   preventing a concurrent price-change from producing inconsistent payment rows.
--
-- Usage (JS client):
--   supabase.rpc('fn_record_payment', { p_payment_id, p_payment_date, ... })
--   supabase.rpc('fn_update_subscription_price', { p_subscription_id, ... })

-- ============================================================================
-- 1. fn_record_payment — atomic payment recording with optimistic row-lock
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_record_payment(
  p_payment_id     UUID,
  p_payment_date   DATE,
  p_payment_method TEXT,
  p_should_invoice BOOLEAN,
  p_vat_rate       NUMERIC,   -- pre-resolved by client; never NULL
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
  v_payment  subscription_payments;
  v_vat_amt  NUMERIC;
  v_total    NUMERIC;
BEGIN
  -- ── Step 1: Lock the row immediately ────────────────────────────────────
  -- FOR UPDATE acquires a row-level lock. Any concurrent transaction that
  -- tries to UPDATE this payment will block until this transaction commits
  -- or rolls back — closing the race window entirely.
  SELECT * INTO v_payment
  FROM subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found: %', p_payment_id;
  END IF;

  -- ── Step 2: Immutability check ───────────────────────────────────────────
  -- paid + invoiced = permanently locked; no further changes allowed.
  IF v_payment.status = 'paid' AND v_payment.invoice_no IS NOT NULL THEN
    RAISE EXCEPTION 'payment_locked: payment % is already paid and invoiced', p_payment_id;
  END IF;

  -- ── Step 3: Derive VAT + totals ─────────────────────────────────────────
  -- v_payment.amount is the base amount (net, excl. VAT) — same value that
  -- was set when the payment record was generated.
  IF p_should_invoice THEN
    v_vat_amt := ROUND(v_payment.amount * p_vat_rate / 100, 2);
    v_total   := v_payment.amount + v_vat_amt;
  ELSE
    v_vat_amt := 0;
    v_total   := v_payment.amount;
  END IF;

  -- ── Step 4: Apply update (same transaction, row already locked) ──────────
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

-- ============================================================================
-- 2. fn_update_subscription_price — atomic price update + payment recalc
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_subscription_price(
  p_subscription_id  UUID,
  p_base_price       NUMERIC,
  p_sms_fee          NUMERIC,
  p_line_fee         NUMERIC,
  p_static_ip_fee    NUMERIC,
  p_vat_rate         NUMERIC,
  p_cost             NUMERIC,
  p_old_prices       JSONB,   -- passed from client for audit log
  p_user_id          UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub         subscriptions;
  v_subtotal    NUMERIC;
  v_vat_amt     NUMERIC;
  v_total       NUMERIC;
  v_multiplier  INT;
BEGIN
  -- ── Lock subscription row ────────────────────────────────────────────────
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found: %', p_subscription_id;
  END IF;

  -- ── Update subscription prices ───────────────────────────────────────────
  UPDATE subscriptions
  SET
    base_price      = p_base_price,
    sms_fee         = p_sms_fee,
    line_fee        = p_line_fee,
    static_ip_fee   = p_static_ip_fee,
    vat_rate        = p_vat_rate,
    cost            = p_cost
  WHERE id = p_subscription_id;

  -- ── Recalculate pending payment amounts ─────────────────────────────────
  -- base_price / sms_fee / line_fee / static_ip_fee are always stored as
  -- monthly net amounts. Multiply by billing frequency for the actual
  -- payment row amount.
  v_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee;
  v_vat_amt  := ROUND(v_subtotal * p_vat_rate / 100, 2);
  v_total    := v_subtotal + v_vat_amt;

  v_multiplier := CASE
    WHEN v_sub.subscription_type = 'annual'   THEN 12
    WHEN v_sub.billing_frequency = 'yearly'   THEN 12
    WHEN v_sub.billing_frequency = '6_month'  THEN 6
    ELSE 1
  END;

  UPDATE subscription_payments
  SET
    amount       = v_subtotal * v_multiplier,
    vat_amount   = v_vat_amt  * v_multiplier,
    total_amount = v_total    * v_multiplier
  WHERE subscription_id = p_subscription_id
    AND status = 'pending';

  -- ── Audit log ────────────────────────────────────────────────────────────
  INSERT INTO audit_logs (
    table_name, record_id, action,
    old_values, new_values,
    user_id, description
  ) VALUES (
    'subscriptions',
    p_subscription_id,
    'price_change',
    p_old_prices,
    jsonb_build_object(
      'base_price',     p_base_price,
      'sms_fee',        p_sms_fee,
      'line_fee',       p_line_fee,
      'static_ip_fee',  p_static_ip_fee,
      'vat_rate',       p_vat_rate
    ),
    p_user_id,
    'Fiyat güncellendi'
  );
END;
$$;

-- ============================================================================
-- 3. Grant execute to authenticated role
-- ============================================================================

GRANT EXECUTE ON FUNCTION fn_record_payment(
  UUID, DATE, TEXT, BOOLEAN, NUMERIC, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION fn_update_subscription_price(
  UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, UUID
) TO authenticated;
