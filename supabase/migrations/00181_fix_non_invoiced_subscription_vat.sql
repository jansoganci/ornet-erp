-- Migration: 00181_fix_non_invoiced_subscription_vat
-- Description: Fix VAT calculation for non-invoiced subscriptions
-- Bug: generate_subscription_payments() and extend_active_subscription_payments()
--      were applying VAT to ALL subscriptions, even those with official_invoice = false
-- Fix: Check official_invoice flag and set VAT to 0 when false
--      Also set should_invoice flag on generated payments to match subscription's official_invoice

-- ============================================================================
-- 1. Fix generate_subscription_payments() - used when creating/editing subscriptions
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_subscription_payments(
  p_subscription_id UUID,
  p_start_date      DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub             RECORD;
  v_subtotal        NUMERIC(12,2);
  v_vat             NUMERIC(12,2);
  v_total           NUMERIC(12,2);
  v_multiplier      INTEGER;
  v_interval_months INTEGER;
  v_start           DATE;
  v_month           DATE;
  v_anchor_year     INTEGER;
  v_horizon         DATE := '2040-12-01'::DATE;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

  v_subtotal := COALESCE(v_sub.base_price, 0)
              + COALESCE(v_sub.sms_fee, 0)
              + COALESCE(v_sub.line_fee, 0)
              + COALESCE(v_sub.static_ip_fee, 0)
              + COALESCE(v_sub.sim_amount, 0);

  -- FIX: Only calculate VAT if official_invoice is true
  IF COALESCE(v_sub.official_invoice, true) THEN
    v_vat := ROUND(v_subtotal * COALESCE(v_sub.vat_rate, 20) / 100, 2);
  ELSE
    v_vat := 0;
  END IF;

  v_total := v_subtotal + v_vat;

  CASE
    WHEN v_sub.billing_frequency = 'yearly' THEN
      v_multiplier      := 12;
      v_interval_months := 12;

    WHEN v_sub.billing_frequency = '6_month' THEN
      v_multiplier      := 6;
      v_interval_months := 6;

    WHEN v_sub.billing_frequency = '3_month' THEN
      v_multiplier      := 3;
      v_interval_months := 3;

    ELSE
      v_multiplier      := 1;
      v_interval_months := 1;
  END CASE;

  -- Anchor logic: use CURRENT_DATE when p_start_date is NULL (not start_date)
  IF v_sub.billing_frequency = 'monthly' OR v_sub.payment_start_month IS NULL THEN
    v_start := date_trunc('month',
                 COALESCE(p_start_date, CURRENT_DATE))::DATE;
  ELSE
    v_anchor_year := EXTRACT(YEAR FROM COALESCE(p_start_date, CURRENT_DATE))::INTEGER;
    v_start := make_date(v_anchor_year, v_sub.payment_start_month, 1);
  END IF;

  v_month := v_start;

  WHILE v_month <= v_horizon LOOP
    INSERT INTO subscription_payments (
      subscription_id,
      payment_month,
      amount,
      vat_amount,
      total_amount,
      should_invoice
    )
    VALUES (
      p_subscription_id,
      v_month,
      v_subtotal * v_multiplier,
      v_vat     * v_multiplier,
      v_total   * v_multiplier,
      COALESCE(v_sub.official_invoice, true)
    )
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;

    v_month := (v_month + (v_interval_months || ' months')::INTERVAL)::DATE;
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. Fix extend_active_subscription_payments() - used by monthly scheduler
-- ============================================================================

CREATE OR REPLACE FUNCTION extend_active_subscription_payments()
RETURNS TABLE (
  subscription_id   UUID,
  payment_month     DATE,
  action            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub             RECORD;
  v_last_month      DATE;
  v_interval_months INTEGER;
  v_next_due        DATE;
  v_subtotal        NUMERIC(12,2);
  v_vat             NUMERIC(12,2);
  v_total           NUMERIC(12,2);
  v_multiplier      INTEGER;
  v_current_month   DATE;
  v_horizon         DATE := '2040-12-01'::DATE;
BEGIN
  v_current_month := date_trunc('month', CURRENT_DATE)::DATE;

  FOR v_sub IN
    SELECT *
    FROM   subscriptions
    WHERE  status = 'active'
  LOOP

    -- Determine interval and amount multiplier from billing_frequency
    CASE
      WHEN v_sub.billing_frequency = 'yearly'
        OR v_sub.subscription_type = 'annual' THEN
        v_interval_months := 12;
        v_multiplier      := 12;

      WHEN v_sub.billing_frequency = '6_month' THEN
        v_interval_months := 6;
        v_multiplier      := 6;

      WHEN v_sub.billing_frequency = '3_month' THEN
        v_interval_months := 3;
        v_multiplier      := 3;

      ELSE
        -- Default: monthly
        v_interval_months := 1;
        v_multiplier      := 1;
    END CASE;

    -- Find the most recent payment row for this subscription
    SELECT MAX(sp.payment_month)
    INTO   v_last_month
    FROM   subscription_payments sp
    WHERE  sp.subscription_id = v_sub.id;

    -- If no payment rows exist at all, bootstrap from start_date
    IF v_last_month IS NULL THEN
      v_last_month := date_trunc('month', v_sub.start_date)::DATE
                    - (v_interval_months || ' months')::INTERVAL;
    END IF;

    v_next_due := (v_last_month + (v_interval_months || ' months')::INTERVAL)::DATE;

    -- Only act if next payment is due this month or overdue (and before horizon)
    IF v_next_due <= v_current_month AND v_next_due <= v_horizon THEN

      -- Recalculate amounts from current subscription prices
      v_subtotal := COALESCE(v_sub.base_price, 0)
                  + COALESCE(v_sub.sms_fee, 0)
                  + COALESCE(v_sub.line_fee, 0)
                  + COALESCE(v_sub.static_ip_fee, 0)
                  + COALESCE(v_sub.sim_amount, 0);

      -- FIX: Only calculate VAT if official_invoice is true
      IF COALESCE(v_sub.official_invoice, true) THEN
        v_vat := ROUND(v_subtotal * COALESCE(v_sub.vat_rate, 20) / 100, 2);
      ELSE
        v_vat := 0;
      END IF;

      v_total := v_subtotal + v_vat;

      INSERT INTO subscription_payments (
        subscription_id,
        payment_month,
        amount,
        vat_amount,
        total_amount,
        should_invoice
      )
      VALUES (
        v_sub.id,
        v_next_due,
        v_subtotal * v_multiplier,
        v_vat      * v_multiplier,
        v_total    * v_multiplier,
        COALESCE(v_sub.official_invoice, true)
      )
      ON CONFLICT (subscription_id, payment_month) DO NOTHING;

      -- Return a row so the Edge Function can log what was created
      subscription_id := v_sub.id;
      payment_month   := v_next_due;
      action          := 'created';
      RETURN NEXT;

    END IF;

  END LOOP;
END;
$$;

-- Maintain permissions (only service_role can call this)
REVOKE EXECUTE ON FUNCTION extend_active_subscription_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extend_active_subscription_payments() FROM authenticated;
GRANT  EXECUTE ON FUNCTION extend_active_subscription_payments() TO service_role;
