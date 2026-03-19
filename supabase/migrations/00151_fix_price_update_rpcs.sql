-- Migration: 00151_fix_price_update_rpcs
-- Description: Add sim_amount and static_ip_fee to subscription price update RPCs.
--   Phase 2 from FINANCE_AND_SUBSCRIPTION_ROADMAP.md.
--
-- 1. fn_update_subscription_price: add p_sim_amount param, include in v_subtotal
-- 2. bulk_update_subscription_prices: extract static_ip_fee and sim_amount from
--    JSON payload, include in v_subtotal_one, update subscriptions row

-- ============================================================================
-- 1. fn_update_subscription_price — add p_sim_amount
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_subscription_price(
  p_subscription_id  UUID,
  p_base_price       NUMERIC,
  p_sms_fee          NUMERIC,
  p_line_fee         NUMERIC,
  p_static_ip_fee    NUMERIC,
  p_sim_amount       NUMERIC,
  p_vat_rate         NUMERIC,
  p_cost             NUMERIC,
  p_old_prices       JSONB,
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
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found: %', p_subscription_id;
  END IF;

  UPDATE subscriptions
  SET
    base_price      = p_base_price,
    sms_fee         = p_sms_fee,
    line_fee        = p_line_fee,
    static_ip_fee   = p_static_ip_fee,
    sim_amount      = COALESCE(p_sim_amount, 0),
    vat_rate        = p_vat_rate,
    cost            = p_cost
  WHERE id = p_subscription_id;

  v_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee + COALESCE(p_sim_amount, 0);
  v_vat_amt  := ROUND(v_subtotal * p_vat_rate / 100, 2);
  v_total    := v_subtotal + v_vat_amt;

  v_multiplier := CASE
    WHEN v_sub.billing_frequency = 'yearly'   THEN 12
    WHEN v_sub.billing_frequency = '6_month'  THEN 6
    WHEN v_sub.billing_frequency = '3_month'  THEN 3
    ELSE 1
  END;

  UPDATE subscription_payments
  SET
    amount       = v_subtotal * v_multiplier,
    vat_amount   = v_vat_amt  * v_multiplier,
    total_amount = v_total    * v_multiplier
  WHERE subscription_id = p_subscription_id
    AND status = 'pending';

  INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id, description)
  VALUES (
    'subscriptions',
    p_subscription_id,
    'price_change',
    p_old_prices,
    jsonb_build_object(
      'base_price',     p_base_price,
      'sms_fee',        p_sms_fee,
      'line_fee',       p_line_fee,
      'static_ip_fee',  p_static_ip_fee,
      'sim_amount',     COALESCE(p_sim_amount, 0),
      'vat_rate',       p_vat_rate
    ),
    p_user_id,
    'Fiyat güncellendi'
  );
END;
$$;

-- ============================================================================
-- 2. bulk_update_subscription_prices — add static_ip_fee and sim_amount
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_update_subscription_prices(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_count   INTEGER := 0;
  i         INTEGER;
  elem      JSONB;
  v_id      UUID;
  v_freq    TEXT;
  old_base_price DECIMAL(10,2);
  old_sms_fee    DECIMAL(10,2);
  old_line_fee   DECIMAL(10,2);
  old_static_ip_fee DECIMAL(10,2);
  old_sim_amount   DECIMAL(10,2);
  old_vat_rate   DECIMAL(5,2);
  old_cost       DECIMAL(10,2);
  v_base_price   DECIMAL(10,2);
  v_sms_fee      DECIMAL(10,2);
  v_line_fee     DECIMAL(10,2);
  v_static_ip_fee DECIMAL(10,2);
  v_sim_amount    DECIMAL(10,2);
  v_vat_rate     DECIMAL(5,2);
  v_cost         DECIMAL(10,2);
  v_subtotal_one DECIMAL(10,2);
  v_vat_one      DECIMAL(10,2);
  v_total_one    DECIMAL(10,2);
  v_amount       DECIMAL(10,2);
  v_vat_amount   DECIMAL(10,2);
  v_total_amount DECIMAL(10,2);
BEGIN
  v_role := get_my_role();
  IF v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot update subscription prices', v_role;
  END IF;

  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN 0;
  END IF;

  FOR i IN 0..(jsonb_array_length(p_updates) - 1) LOOP
    elem := p_updates->i;
    v_id := (elem->>'id')::UUID;

    SELECT base_price, sms_fee, line_fee, static_ip_fee, sim_amount, vat_rate, cost
      INTO old_base_price, old_sms_fee, old_line_fee, old_static_ip_fee, old_sim_amount, old_vat_rate, old_cost
      FROM subscriptions
      WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription not found: %', v_id;
    END IF;

    v_base_price    := COALESCE((elem->>'base_price')::DECIMAL(10,2), 0);
    v_sms_fee       := COALESCE((elem->>'sms_fee')::DECIMAL(10,2), 0);
    v_line_fee      := COALESCE((elem->>'line_fee')::DECIMAL(10,2), 0);
    v_static_ip_fee := COALESCE((elem->>'static_ip_fee')::DECIMAL(10,2), old_static_ip_fee);
    v_sim_amount    := COALESCE((elem->>'sim_amount')::DECIMAL(10,2), old_sim_amount);
    v_vat_rate      := COALESCE((elem->>'vat_rate')::DECIMAL(5,2), 20);
    v_cost          := COALESCE((elem->>'cost')::DECIMAL(10,2), 0);

    UPDATE subscriptions
    SET base_price = v_base_price,
        sms_fee    = v_sms_fee,
        line_fee   = v_line_fee,
        static_ip_fee = v_static_ip_fee,
        sim_amount    = v_sim_amount,
        vat_rate   = v_vat_rate,
        cost       = v_cost,
        updated_at = now()
    WHERE id = v_id;

    SELECT billing_frequency INTO v_freq
      FROM subscriptions WHERE id = v_id;

    v_subtotal_one := v_base_price + v_sms_fee + v_line_fee + v_static_ip_fee + v_sim_amount;
    v_vat_one      := ROUND(v_subtotal_one * v_vat_rate / 100, 2);
    v_total_one    := v_subtotal_one + v_vat_one;

    IF v_freq = 'yearly' THEN
      v_amount       := v_subtotal_one * 12;
      v_vat_amount   := v_vat_one * 12;
      v_total_amount := v_total_one * 12;
    ELSIF v_freq = '6_month' THEN
      v_amount       := v_subtotal_one * 6;
      v_vat_amount   := v_vat_one * 6;
      v_total_amount := v_total_one * 6;
    ELSIF v_freq = '3_month' THEN
      v_amount       := v_subtotal_one * 3;
      v_vat_amount   := v_vat_one * 3;
      v_total_amount := v_total_one * 3;
    ELSE
      v_amount       := v_subtotal_one;
      v_vat_amount   := v_vat_one;
      v_total_amount := v_total_one;
    END IF;

    UPDATE subscription_payments
    SET amount       = v_amount,
        vat_amount   = v_vat_amount,
        total_amount = v_total_amount,
        updated_at   = now()
    WHERE subscription_id = v_id
      AND status = 'pending';

    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id, description)
    VALUES (
      'subscriptions',
      v_id,
      'price_change',
      jsonb_build_object(
        'base_price', old_base_price, 'sms_fee', old_sms_fee, 'line_fee', old_line_fee,
        'static_ip_fee', old_static_ip_fee, 'sim_amount', old_sim_amount,
        'vat_rate', old_vat_rate, 'cost', old_cost
      ),
      jsonb_build_object(
        'base_price', v_base_price, 'sms_fee', v_sms_fee, 'line_fee', v_line_fee,
        'static_ip_fee', v_static_ip_fee, 'sim_amount', v_sim_amount,
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
