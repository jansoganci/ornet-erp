-- Migration: 00229_subscription_rpc_role_guards
-- B1: Add role guards to subscription billing SECURITY DEFINER RPCs.
-- Functions covered:
--   - generate_subscription_payments(uuid, date)
--   - ensure_payments_for_year(uuid, integer)
--   - bulk_import_subscriptions(jsonb, uuid)
--   - fn_update_subscription_price(...)
--
-- Guard rule (NULL-safe): get_my_role() IN ('admin','accountant')

BEGIN;

CREATE OR REPLACE FUNCTION generate_subscription_payments(
  p_subscription_id UUID,
  p_start_date      DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub              RECORD;
  v_subtotal         NUMERIC(12,2);
  v_taxable_subtotal NUMERIC(12,2);
  v_sim_amount       NUMERIC(12,2);
  v_vat              NUMERIC(12,2);
  v_total            NUMERIC(12,2);
  v_multiplier       INTEGER;
  v_interval_months  INTEGER;
  v_start            DATE;
  v_month            DATE;
  v_anchor_year      INTEGER;
  v_horizon          DATE := '2040-12-01'::DATE;
  v_role             TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot generate subscription payments', v_role;
  END IF;

  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

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

  IF v_sub.billing_frequency = 'monthly' OR v_sub.payment_start_month IS NULL THEN
    v_start := date_trunc('month', COALESCE(p_start_date, CURRENT_DATE))::DATE;
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
      v_vat * v_multiplier,
      v_total * v_multiplier,
      COALESCE(v_sub.official_invoice, true)
    )
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;

    v_month := (v_month + (v_interval_months || ' months')::INTERVAL)::DATE;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_payments_for_year(
  p_subscription_id UUID,
  p_year            INTEGER
)
RETURNS INTEGER
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
  v_vat             NUMERIC(12,2);
  v_total           NUMERIC(12,2);
  v_multiplier      INTEGER;
  v_count           INTEGER := 0;
  v_role            TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot ensure payments for year', v_role;
  END IF;

  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

  IF v_sub.status = 'cancelled' THEN
    RETURN 0;
  END IF;

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

  v_subtotal := COALESCE(v_sub.base_price, 0)
              + COALESCE(v_sub.sms_fee, 0)
              + COALESCE(v_sub.line_fee, 0)
              + COALESCE(v_sub.static_ip_fee, 0)
              + COALESCE(v_sub.sim_amount, 0);
  v_vat   := ROUND(v_subtotal * COALESCE(v_sub.vat_rate, 20) / 100, 2);
  v_total := v_subtotal + v_vat;

  SELECT MAX(sp.payment_month)
  INTO   v_last_month
  FROM   subscription_payments sp
  WHERE  sp.subscription_id = p_subscription_id
    AND  sp.payment_month <= make_date(p_year, 12, 31);

  IF v_last_month IS NULL THEN
    IF v_sub.billing_frequency != 'monthly'
       AND v_sub.payment_start_month IS NOT NULL THEN
      v_last_month := make_date(
        EXTRACT(YEAR FROM v_sub.start_date)::INTEGER,
        v_sub.payment_start_month,
        1
      ) - (v_interval_months || ' months')::INTERVAL;
    ELSE
      v_last_month := date_trunc('month', v_sub.start_date)::DATE
                    - (v_interval_months || ' months')::INTERVAL;
    END IF;
  END IF;

  v_next_due := (v_last_month + (v_interval_months || ' months')::INTERVAL)::DATE;

  WHILE v_next_due <= make_date(p_year, 12, 31) LOOP
    INSERT INTO subscription_payments (
      subscription_id,
      payment_month,
      amount,
      vat_amount,
      total_amount
    )
    VALUES (
      p_subscription_id,
      v_next_due,
      v_subtotal * v_multiplier,
      v_vat * v_multiplier,
      v_total * v_multiplier
    )
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;

    v_count := v_count + 1;
    v_next_due := (v_next_due + (v_interval_months || ' months')::INTERVAL)::DATE;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_import_subscriptions(
  items jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row        jsonb;
  v_sub_id     uuid;
  v_idx        integer := 0;
  v_created    integer := 0;
  v_failed     integer := 0;
  v_errors     jsonb   := '[]'::jsonb;
  v_row_num    integer;
  v_role       TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot bulk import subscriptions', v_role;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_idx := v_idx + 1;
    v_row_num := COALESCE((v_row->>'row_num')::integer, v_idx + 1);

    BEGIN
      INSERT INTO subscriptions (
        site_id,
        start_date,
        billing_day,
        base_price,
        sim_amount,
        sms_fee,
        line_fee,
        cost,
        vat_rate,
        currency,
        billing_frequency,
        payment_start_month,
        service_type,
        official_invoice,
        notes,
        setup_notes,
        subscriber_title,
        alarm_center,
        alarm_center_account,
        created_by
      ) VALUES (
        (v_row->>'site_id')::uuid,
        (v_row->>'start_date')::date,
        COALESCE((v_row->>'billing_day')::integer, 1),
        COALESCE((v_row->>'base_price')::decimal, 0),
        COALESCE((v_row->>'sim_amount')::decimal, 0),
        COALESCE((v_row->>'sms_fee')::decimal, 0),
        COALESCE((v_row->>'line_fee')::decimal, 0),
        COALESCE((v_row->>'cost')::decimal, 0),
        COALESCE((v_row->>'vat_rate')::decimal, 20),
        COALESCE(v_row->>'currency', 'TRY'),
        COALESCE(v_row->>'billing_frequency', 'monthly'),
        (v_row->>'payment_start_month')::integer,
        NULLIF(v_row->>'service_type', ''),
        COALESCE((v_row->>'official_invoice')::boolean, true),
        NULLIF(v_row->>'notes', ''),
        NULLIF(v_row->>'setup_notes', ''),
        NULLIF(v_row->>'subscriber_title', ''),
        NULLIF(v_row->>'alarm_center', ''),
        NULLIF(v_row->>'alarm_center_account', ''),
        p_user_id
      )
      RETURNING id INTO v_sub_id;

      PERFORM generate_subscription_payments(v_sub_id);

      INSERT INTO audit_logs (table_name, record_id, action, new_values, user_id, description)
      VALUES (
        'subscriptions',
        v_sub_id,
        'insert',
        v_row,
        p_user_id,
        'Toplu içe aktarma ile oluşturuldu'
      );

      v_created := v_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_row_num,
        'message', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'failed',  v_failed,
    'errors',  v_errors
  );
END;
$$;

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
  v_sub              subscriptions;
  v_subtotal         NUMERIC;
  v_taxable_subtotal NUMERIC;
  v_vat_amt          NUMERIC;
  v_total            NUMERIC;
  v_multiplier       INT;
  v_role             TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot update subscription price', v_role;
  END IF;

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

  v_taxable_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee;
  v_subtotal := v_taxable_subtotal + COALESCE(p_sim_amount, 0);
  v_vat_amt  := ROUND(v_taxable_subtotal * p_vat_rate / 100, 2);
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

COMMIT;
