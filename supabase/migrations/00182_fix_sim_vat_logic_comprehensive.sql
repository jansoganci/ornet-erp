-- Migration: 00182_fix_sim_vat_logic_comprehensive
-- Description:
--   - Keep historical migrations immutable by applying SIM VAT fixes in a new migration.
--   - Set sim_cards.vat_rate default to 0 and backfill old defaulted rows.
--   - Exclude subscriptions.sim_amount from subscription VAT base.
--   - Make fn_sim_card_to_finance fallback VAT 0 when sim vat_rate is null.
--   - Align subscription price update RPCs with the same VAT base rule.

-- 1) SIM VAT defaults and backfill
ALTER TABLE sim_cards
  ALTER COLUMN vat_rate SET DEFAULT 0;

UPDATE sim_cards
SET vat_rate = 0
WHERE vat_rate = 20;

-- 2) generate_subscription_payments: exclude sim_amount from VAT base
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
  v_taxable_subtotal NUMERIC(12,2);
  v_sim_amount      NUMERIC(12,2);
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

-- 3) extend_active_subscription_payments: exclude sim_amount from VAT base
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
GRANT  EXECUTE ON FUNCTION extend_active_subscription_payments() TO service_role;

-- 4) SIM finance trigger: default VAT fallback 0
CREATE OR REPLACE FUNCTION fn_sim_card_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period       TEXT;
  v_tx_date      DATE;
  v_customer_id  UUID;
  v_site_id      UUID;
  v_expense_cat_id UUID;
  v_amount_try   DECIMAL(12,2);
  v_exists       BOOLEAN;
  v_is_wholesale BOOLEAN;
  v_vat_rate     DECIMAL(5,2);
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('subscription', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text NOT IN ('available', 'active') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_vat_rate := COALESCE(NEW.vat_rate, 0);

  v_customer_id := NEW.customer_id;
  v_site_id     := NEW.site_id;
  v_period      := to_char(CURRENT_DATE, 'YYYY-MM');
  v_tx_date     := date_trunc('month', CURRENT_DATE)::DATE;

  IF COALESCE(NEW.cost_price, 0) > 0 THEN
    SELECT id INTO v_expense_cat_id
    FROM expense_categories
    WHERE code = 'sim_operator'
    LIMIT 1;

    IF v_expense_cat_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'expense'
        LIMIT 1
      ) INTO v_exists;

      IF NOT v_exists THEN
        v_amount_try := COALESCE(NEW.cost_price, 0);
        INSERT INTO financial_transactions (
          direction, expense_category_id, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'expense', v_expense_cat_id, NEW.id,
          COALESCE(NEW.cost_price, 0), 'TRY', v_amount_try, NULL,
          true, ROUND(COALESCE(NEW.cost_price, 0) * (v_vat_rate / 100.0), 2), v_vat_rate,
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' (' || NEW.status::text || ')',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  IF NEW.status::text = 'active' AND COALESCE(NEW.sale_price, 0) > 0 THEN
    v_is_wholesale := (NEW.site_id IS NULL) OR (NOT site_has_active_subscription(NEW.site_id));

    IF v_is_wholesale THEN
      v_amount_try := COALESCE(NEW.sale_price, 0);

      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'income'
        LIMIT 1
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO financial_transactions (
          direction, income_type, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          should_invoice, output_vat, vat_rate, cogs_try,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'income', 'sim_rental', NEW.id,
          COALESCE(NEW.sale_price, 0), 'TRY', v_amount_try, NULL,
          true, ROUND(COALESCE(NEW.sale_price, 0) * (v_vat_rate / 100.0), 2), v_vat_rate,
          COALESCE(NEW.cost_price, 0),
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' kiralama',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Price update RPCs: exclude sim_amount from VAT base
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
  v_taxable_subtotal NUMERIC;
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
  v_taxable_subtotal_one DECIMAL(10,2);
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

    v_taxable_subtotal_one := v_base_price + v_sms_fee + v_line_fee + v_static_ip_fee;
    v_subtotal_one := v_taxable_subtotal_one + v_sim_amount;
    v_vat_one      := ROUND(v_taxable_subtotal_one * v_vat_rate / 100, 2);
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
