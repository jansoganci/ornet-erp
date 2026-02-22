-- Migration: 00090_static_ip_feature
-- Description: Add static IP tracking for SIM cards and integrate static IP fee/cost
-- into subscriptions pricing, payment generation, MRR stats, and P&L COGS.

-- ============================================================================
-- 1. New table: sim_static_ips
-- ============================================================================

CREATE TABLE IF NOT EXISTS sim_static_ips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sim_card_id   UUID NOT NULL REFERENCES sim_cards(id),
  ip_address    TEXT NOT NULL,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_sim_static_ips_sim ON sim_static_ips(sim_card_id);

-- RLS
ALTER TABLE sim_static_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sim_static_ips_select"
  ON sim_static_ips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sim_static_ips_insert"
  ON sim_static_ips FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "sim_static_ips_update"
  ON sim_static_ips FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

GRANT SELECT, INSERT, UPDATE ON sim_static_ips TO authenticated;

-- ============================================================================
-- 2. New columns on subscriptions
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS static_ip_fee  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS static_ip_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ============================================================================
-- 3. Update subscriptions_detail view
-- ============================================================================

DROP VIEW IF EXISTS subscriptions_detail;

CREATE VIEW subscriptions_detail AS
SELECT
  sub.*,
  -- Computed totals (now includes static_ip_fee)
  (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  -- Profit (admin-only in UI) — includes static_ip_cost in COGS
  ROUND(
    (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee) * (1 + sub.vat_rate / 100)
    - sub.cost - sub.static_ip_cost,
    2
  ) AS profit,
  -- Active static IP for this SIM
  (
    SELECT ip_address
    FROM sim_static_ips
    WHERE sim_card_id = sub.sim_card_id
      AND cancelled_at IS NULL
    LIMIT 1
  ) AS static_ip_address,
  -- Site info
  s.account_no,
  s.site_name,
  s.address       AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  -- Customer info
  c.id            AS customer_id,
  c.company_name,
  c.phone         AS customer_phone,
  c.tax_number,
  -- Payment method info
  pm.method_type  AS pm_type,
  pm.card_last4   AS pm_card_last4,
  pm.card_brand   AS pm_card_brand,
  pm.card_holder  AS pm_card_holder,
  pm.bank_name    AS pm_bank_name,
  pm.iban         AS pm_iban,
  pm.label        AS pm_label,
  -- Staff names
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name,
  cash_collector.full_name AS cash_collector_name,
  -- SIM card (for display)
  sc.phone_number AS sim_phone_number
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id
LEFT JOIN profiles cash_collector ON sub.cash_collector_id = cash_collector.id
LEFT JOIN sim_cards sc ON sub.sim_card_id = sc.id;

GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 4. Update generate_subscription_payments — include static_ip_fee in subtotal
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_subscription_payments(
  p_subscription_id UUID,
  p_start_date DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Monthly subtotal (base_price + sms_fee + line_fee + static_ip_fee)
  v_subtotal := v_sub.base_price + v_sub.sms_fee + v_sub.line_fee + v_sub.static_ip_fee;
  v_vat := ROUND(v_subtotal * v_sub.vat_rate / 100, 2);
  v_total := v_subtotal + v_vat;

  -- Determine multiplier, payment count, and interval based on billing_frequency
  IF (v_sub.billing_frequency = 'yearly' OR v_sub.subscription_type = 'annual') THEN
    v_multiplier := 12;
    v_payments := 1;
    v_interval_months := 12;
  ELSIF v_sub.billing_frequency = '6_month' THEN
    v_multiplier := 6;
    v_payments := 2;
    v_interval_months := 6;
  ELSE
    v_multiplier := 1;
    v_payments := 12;
    v_interval_months := 1;
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

-- ============================================================================
-- 5. Update get_subscription_stats — include static_ip_fee in MRR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_last_month_end DATE;
BEGIN
  v_last_month_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::DATE;

  SELECT json_build_object(
    'active_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'distinct_customer_count', (
      SELECT COUNT(DISTINCT cs.customer_id)
      FROM subscriptions s
      JOIN customer_sites cs ON s.site_id = cs.id
      WHERE s.status = 'active'
    ),
    'paused_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      SELECT COALESCE(SUM(base_price + sms_fee + line_fee + static_ip_fee), 0)
      FROM subscriptions WHERE status = 'active'
    ),
    'mrr_previous_month', (
      SELECT COALESCE(SUM(s.base_price + s.sms_fee + s.line_fee + s.static_ip_fee), 0)
      FROM subscriptions s
      WHERE s.start_date <= v_last_month_end
        AND (s.end_date IS NULL OR s.end_date >= v_last_month_end)
        AND (s.cancelled_at IS NULL OR s.cancelled_at::date > v_last_month_end)
        AND (
          s.paused_at IS NULL
          OR s.paused_at::date > v_last_month_end
          OR (s.reactivated_at IS NOT NULL AND s.reactivated_at::date <= v_last_month_end)
        )
    ),
    'active_count_previous_month', (
      SELECT COUNT(*)
      FROM subscriptions s
      WHERE s.start_date <= v_last_month_end
        AND (s.end_date IS NULL OR s.end_date >= v_last_month_end)
        AND (s.cancelled_at IS NULL OR s.cancelled_at::date > v_last_month_end)
        AND (
          s.paused_at IS NULL
          OR s.paused_at::date > v_last_month_end
          OR (s.reactivated_at IS NOT NULL AND s.reactivated_at::date <= v_last_month_end)
        )
    ),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'paid'
        AND should_invoice = TRUE
        AND invoice_no IS NULL
        AND payment_date < CURRENT_DATE - INTERVAL '7 days'
    ),
    'unpaid_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'pending' AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_stats() TO authenticated;

-- ============================================================================
-- 6. Update v_profit_and_loss — include static_ip_cost in COGS
-- ============================================================================

DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Subscription payments (recurring revenue)
SELECT
  sp.id::TEXT AS source_id,
  'subscription' AS source_type,
  'income' AS direction,
  sp.payment_month AS period_date,
  to_char(sp.payment_month, 'YYYY-MM') AS period,
  cs.customer_id,
  sub.site_id,
  sp.amount AS amount_try,
  sp.vat_amount AS output_vat,
  NULL::DECIMAL AS input_vat,
  sp.should_invoice AS is_official,
  'TRY' AS original_currency,
  sp.amount AS amount_original,
  NULL::DECIMAL AS exchange_rate,
  CASE
    WHEN sub.billing_frequency = 'yearly' THEN (sub.cost + sub.static_ip_cost) * 12
    WHEN sub.billing_frequency = '6_month' THEN (sub.cost + sub.static_ip_cost) * 6
    ELSE (sub.cost + sub.static_ip_cost)
  END AS cogs_try,
  sp.payment_method,
  sp.created_at
FROM subscription_payments sp
JOIN subscriptions sub ON sp.subscription_id = sub.id
JOIN customer_sites cs ON sub.site_id = cs.id
WHERE sp.status = 'paid'

UNION ALL

-- Financial transactions (income) — only confirmed
SELECT
  ft.id::TEXT,
  COALESCE(ft.income_type, 'other'),
  'income',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL,
  ft.should_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND (ft.status = 'confirmed' OR ft.status IS NULL)

UNION ALL

-- Financial transactions (expense) — only confirmed
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,
  NULL,
  ft.input_vat,
  ft.has_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense'
  AND (ft.status = 'confirmed' OR ft.status IS NULL);

GRANT SELECT ON v_profit_and_loss TO authenticated;
