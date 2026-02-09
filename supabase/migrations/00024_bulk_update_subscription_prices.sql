-- Migration: 00024_bulk_update_subscription_prices
-- Description: RPC to bulk-update subscription prices and recalc pending payment amounts.
-- Ref: docs/fiyat-revizyonu-plani.md Adim 1

-- ============================================================================
-- bulk_update_subscription_prices(p_updates JSONB) RETURNS INTEGER
-- ============================================================================
-- Input: JSON array of { "id": "uuid", "base_price": n, "sms_fee": n, "line_fee": n, "vat_rate": n, "cost": n }
-- For each item: UPDATE subscriptions; recalc and UPDATE subscription_payments (status='pending'); audit log.
-- Formula aligned with generate_subscription_payments: monthly = single period, yearly = 12x period.

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
  -- Computed amounts (one period)
  v_subtotal_one DECIMAL(10,2);
  v_vat_one      DECIMAL(10,2);
  v_total_one    DECIMAL(10,2);
  -- Amounts to write to subscription_payments (may be 12x for yearly)
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

    -- New values from payload (subscriptions has NOT NULL on base_price)
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

    -- One-period amounts (same formula as generate_subscription_payments)
    v_subtotal_one := v_base_price + v_sms_fee + v_line_fee;
    v_vat_one      := ROUND(v_subtotal_one * v_vat_rate / 100, 2);
    v_total_one    := v_subtotal_one + v_vat_one;

    IF (v_freq = 'yearly' OR v_sub_type = 'annual') THEN
      v_amount       := v_subtotal_one * 12;
      v_vat_amount   := v_vat_one * 12;
      v_total_amount := v_total_one * 12;
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

GRANT EXECUTE ON FUNCTION bulk_update_subscription_prices(JSONB) TO authenticated;
