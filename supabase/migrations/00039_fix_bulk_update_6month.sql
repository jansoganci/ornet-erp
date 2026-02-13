-- Migration: 00039_fix_bulk_update_6month
-- Description: Fix bulk_update_subscription_prices() to handle 6_month billing frequency
-- Bug: 6_month subscriptions got monthly amounts (subtotal × 1) instead of (subtotal × 6)
--      when prices were bulk-updated via Price Revision page
-- Fix: Add ELSIF for billing_frequency = '6_month' with multiplier = 6

CREATE OR REPLACE FUNCTION bulk_update_subscription_prices(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INTEGER := 0;
  i         INTEGER;
  elem      JSONB;
  v_id      UUID;
  v_freq    TEXT;
  v_sub_type TEXT;
  -- Old values (for audit)
  old_base_price DECIMAL(10,2);
  old_sms_fee    DECIMAL(10,2);
  old_line_fee   DECIMAL(10,2);
  old_vat_rate   DECIMAL(5,2);
  old_cost       DECIMAL(10,2);
  -- New values from payload
  v_base_price   DECIMAL(10,2);
  v_sms_fee      DECIMAL(10,2);
  v_line_fee     DECIMAL(10,2);
  v_vat_rate     DECIMAL(5,2);
  v_cost         DECIMAL(10,2);
  -- Computed amounts (one month)
  v_subtotal_one DECIMAL(10,2);
  v_vat_one      DECIMAL(10,2);
  v_total_one    DECIMAL(10,2);
  -- Amounts to write to subscription_payments (multiplied by billing period)
  v_amount       DECIMAL(10,2);
  v_vat_amount   DECIMAL(10,2);
  v_total_amount DECIMAL(10,2);
BEGIN
  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN 0;
  END IF;

  FOR i IN 0..(jsonb_array_length(p_updates) - 1) LOOP
    elem := p_updates->i;
    v_id := (elem->>'id')::UUID;

    -- Read current values for audit
    SELECT base_price, sms_fee, line_fee, vat_rate, cost
      INTO old_base_price, old_sms_fee, old_line_fee, old_vat_rate, old_cost
      FROM subscriptions
      WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription not found: %', v_id;
    END IF;

    -- New values from payload
    v_base_price := COALESCE((elem->>'base_price')::DECIMAL(10,2), 0);
    v_sms_fee    := COALESCE((elem->>'sms_fee')::DECIMAL(10,2), 0);
    v_line_fee   := COALESCE((elem->>'line_fee')::DECIMAL(10,2), 0);
    v_vat_rate   := COALESCE((elem->>'vat_rate')::DECIMAL(5,2), 20);
    v_cost       := COALESCE((elem->>'cost')::DECIMAL(10,2), 0);

    -- Update subscription
    UPDATE subscriptions
    SET base_price = v_base_price,
        sms_fee    = v_sms_fee,
        line_fee   = v_line_fee,
        vat_rate   = v_vat_rate,
        cost       = v_cost,
        updated_at = now()
    WHERE id = v_id;

    -- Get billing_frequency (and legacy annual) for payment amount logic
    SELECT billing_frequency, subscription_type INTO v_freq, v_sub_type
      FROM subscriptions WHERE id = v_id;

    -- One-month amounts (base_price etc. are ALWAYS monthly)
    v_subtotal_one := v_base_price + v_sms_fee + v_line_fee;
    v_vat_one      := ROUND(v_subtotal_one * v_vat_rate / 100, 2);
    v_total_one    := v_subtotal_one + v_vat_one;

    -- Multiply by billing period (same logic as generate_subscription_payments)
    IF (v_freq = 'yearly' OR v_sub_type = 'annual') THEN
      v_amount       := v_subtotal_one * 12;
      v_vat_amount   := v_vat_one * 12;
      v_total_amount := v_total_one * 12;
    ELSIF v_freq = '6_month' THEN
      v_amount       := v_subtotal_one * 6;
      v_vat_amount   := v_vat_one * 6;
      v_total_amount := v_total_one * 6;
    ELSE
      v_amount       := v_subtotal_one;
      v_vat_amount   := v_vat_one;
      v_total_amount := v_total_one;
    END IF;

    -- Update pending payment rows
    UPDATE subscription_payments
    SET amount       = v_amount,
        vat_amount   = v_vat_amount,
        total_amount = v_total_amount,
        updated_at   = now()
    WHERE subscription_id = v_id
      AND status = 'pending';

    -- Audit log
    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id, description)
    VALUES (
      'subscriptions',
      v_id,
      'price_change',
      jsonb_build_object(
        'base_price', old_base_price, 'sms_fee', old_sms_fee, 'line_fee', old_line_fee,
        'vat_rate', old_vat_rate, 'cost', old_cost
      ),
      jsonb_build_object(
        'base_price', v_base_price, 'sms_fee', v_sms_fee, 'line_fee', v_line_fee,
        'vat_rate', v_vat_rate, 'cost', v_cost
      ),
      auth.uid(),
      'Fiyat güncellendi (toplu revizyon)'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
