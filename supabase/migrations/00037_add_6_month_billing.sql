-- Migration: 00037_add_6_month_billing
-- Description: Add '6_month' billing frequency for subscriptions that bill every 6 months
-- Module 0.5: Pre-finance module requirement

-- ============================================================================
-- 1. Update billing_frequency CHECK constraint
-- ============================================================================

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_frequency_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_frequency_check
  CHECK (billing_frequency IN ('monthly', '6_month', 'yearly'));

COMMENT ON COLUMN subscriptions.billing_frequency IS
  'Billing frequency: monthly (12 payments/year), 6_month (2 payments/year), yearly (1 payment/year). '
  'cost field is always MONTHLY regardless of billing_frequency.';

-- ============================================================================
-- 2. Update generate_subscription_payments() to handle 3 frequencies
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_subscription_payments(
  p_subscription_id UUID,
  p_start_date DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
  v_month DATE;
  v_subtotal DECIMAL(10,2);
  v_vat DECIMAL(10,2);
  v_total DECIMAL(10,2);
  v_multiplier INTEGER;
  v_payments INTEGER;
  v_interval_months INTEGER;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  -- Monthly subtotal (base_price + sms_fee + line_fee)
  v_subtotal := v_sub.base_price + v_sub.sms_fee + v_sub.line_fee;
  v_vat := ROUND(v_subtotal * v_sub.vat_rate / 100, 2);
  v_total := v_subtotal + v_vat;

  -- Determine multiplier, payment count, and interval based on billing_frequency
  -- billing_frequency = 'yearly' OR legacy subscription_type = 'annual'
  IF (v_sub.billing_frequency = 'yearly' OR v_sub.subscription_type = 'annual') THEN
    v_multiplier := 12;       -- Each payment covers 12 months
    v_payments := 1;          -- 1 payment per year
    v_interval_months := 12;  -- 12 months between payments
  ELSIF v_sub.billing_frequency = '6_month' THEN
    v_multiplier := 6;        -- Each payment covers 6 months
    v_payments := 2;          -- 2 payments per year
    v_interval_months := 6;   -- 6 months between payments
  ELSE
    -- Default: monthly
    v_multiplier := 1;        -- Each payment covers 1 month
    v_payments := 12;         -- 12 payments per year
    v_interval_months := 1;   -- 1 month between payments
  END IF;

  -- Generate payment records
  FOR i IN 0..(v_payments - 1) LOOP
    v_month := (date_trunc('month', COALESCE(p_start_date, v_sub.start_date))
                + ((i * v_interval_months) || ' months')::INTERVAL)::DATE;
    INSERT INTO subscription_payments (
      subscription_id, payment_month,
      amount, vat_amount, total_amount
    )
    VALUES (
      p_subscription_id, v_month,
      v_subtotal * v_multiplier,
      v_vat * v_multiplier,
      v_total * v_multiplier
    )
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_subscription_payments(UUID, DATE) TO authenticated;
