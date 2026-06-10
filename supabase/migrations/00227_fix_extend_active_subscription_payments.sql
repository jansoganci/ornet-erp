-- Migration: 00227_fix_extend_active_subscription_payments
-- Description: Remove dead v_sub.subscription_type reference from
--   extend_active_subscription_payments(). Column dropped in 00142;
--   annual rows migrated to billing_frequency = 'yearly' in 00112.
--   00181/00182 re-introduced the OR branch when updating VAT logic.
--   Without this fix, RPC crashes: record "v_sub" has no field "subscription_type"

CREATE OR REPLACE FUNCTION extend_active_subscription_payments()
RETURNS TABLE (
  subscription_id   UUID,
  payment_month     DATE,
  action            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub             RECORD;
  v_last_month      DATE;
  v_interval_months INTEGER;
  v_next_due        DATE;
  v_subtotal        NUMERIC(12,2);
  v_taxable_subtotal NUMERIC(12,2);
  v_sim_amount      NUMERIC(12,2);
  v_vat             NUMERIC(12,2);
  v_total           NUMERIC(12,2);
  v_multiplier      INTEGER;
  v_current_month   DATE;
  v_horizon         DATE := '2040-12-01'::DATE;
BEGIN
  v_current_month := date_trunc('month', CURRENT_DATE)::DATE;

  FOR v_sub IN
    SELECT *
    FROM subscriptions
    WHERE status = 'active'
  LOOP
    CASE
      WHEN v_sub.billing_frequency = 'yearly' THEN
        v_interval_months := 12;
        v_multiplier      := 12;
      WHEN v_sub.billing_frequency = '6_month' THEN
        v_interval_months := 6;
        v_multiplier      := 6;
      WHEN v_sub.billing_frequency = '3_month' THEN
        v_interval_months := 3;
        v_multiplier      := 3;
      ELSE
        v_interval_months := 1;
        v_multiplier      := 1;
    END CASE;

    SELECT MAX(sp.payment_month)
    INTO v_last_month
    FROM subscription_payments sp
    WHERE sp.subscription_id = v_sub.id;

    IF v_last_month IS NULL THEN
      v_last_month := date_trunc('month', v_sub.start_date)::DATE
                    - (v_interval_months || ' months')::INTERVAL;
    END IF;

    v_next_due := (v_last_month + (v_interval_months || ' months')::INTERVAL)::DATE;

    IF v_next_due <= v_current_month AND v_next_due <= v_horizon THEN
      v_sim_amount := COALESCE(v_sub.sim_amount, 0);
      v_taxable_subtotal := COALESCE(v_sub.base_price, 0)
                          + COALESCE(v_sub.sms_fee, 0)
                          + COALESCE(v_sub.line_fee, 0)
                          + COALESCE(v_sub.static_ip_fee, 0);
      v_subtotal := v_taxable_subtotal + v_sim_amount;

      IF COALESCE(v_sub.official_invoice, true) THEN
        v_vat := ROUND(v_taxable_subtotal * COALESCE(v_sub.vat_rate, 20) / 100, 2);
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
        v_vat * v_multiplier,
        v_total * v_multiplier,
        COALESCE(v_sub.official_invoice, true)
      )
      ON CONFLICT (subscription_id, payment_month) DO NOTHING;

      subscription_id := v_sub.id;
      payment_month := v_next_due;
      action := 'created';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION extend_active_subscription_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extend_active_subscription_payments() FROM authenticated;
GRANT EXECUTE ON FUNCTION extend_active_subscription_payments() TO service_role;
