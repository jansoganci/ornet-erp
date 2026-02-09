-- Migration: 00022_subscription_target_fields
-- Description: Hedef abonelik yapısı - subscriptions ve subscription_payments yeni kolonlar,
-- subscriptions_detail view (cash_collector_name), generate_subscription_payments (billing_frequency)
-- Ref: docs/abonelikler-hedefe-donusum-analizi.md Faz 1

-- ============================================================================
-- 1. SUBSCRIPTIONS – new columns
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN service_type TEXT CHECK (service_type IN (
    'alarm_only', 'camera_only', 'internet_only', 'alarm_camera', 'alarm_camera_internet'
  )),
  ADD COLUMN billing_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_frequency IN ('monthly', 'yearly')),
  ADD COLUMN cash_collector_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN official_invoice BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN card_bank_name TEXT,
  ADD COLUMN card_last4 TEXT CHECK (card_last4 IS NULL OR char_length(card_last4) = 4);

-- ============================================================================
-- 2. SUBSCRIPTION_PAYMENTS – reference_no (havale dekont)
-- ============================================================================

ALTER TABLE subscription_payments
  ADD COLUMN reference_no TEXT;

-- ============================================================================
-- 3. BACKFILL billing_frequency for existing annual subscriptions
-- ============================================================================

UPDATE subscriptions
SET billing_frequency = 'yearly'
WHERE subscription_type = 'annual';

-- ============================================================================
-- 4. SUBSCRIPTIONS_DETAIL VIEW – include new columns + cash_collector_name
-- ============================================================================

DROP VIEW IF EXISTS subscriptions_detail;

CREATE VIEW subscriptions_detail AS
SELECT
  sub.*,
  -- Computed totals
  (sub.base_price + sub.sms_fee + sub.line_fee) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  -- Profit (admin-only in UI)
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100) - sub.cost, 2) AS profit,
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
  cash_collector.full_name AS cash_collector_name
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id
LEFT JOIN profiles cash_collector ON sub.cash_collector_id = cash_collector.id;

GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 5. generate_subscription_payments – use billing_frequency (and legacy annual)
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
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  v_subtotal := v_sub.base_price + v_sub.sms_fee + v_sub.line_fee;
  v_vat := ROUND(v_subtotal * v_sub.vat_rate / 100, 2);
  v_total := v_subtotal + v_vat;

  IF (v_sub.billing_frequency = 'yearly' OR v_sub.subscription_type = 'annual') THEN
    -- Yearly: 1 record for the year
    v_month := date_trunc('month', COALESCE(p_start_date, v_sub.start_date))::DATE;
    INSERT INTO subscription_payments (subscription_id, payment_month, amount, vat_amount, total_amount)
    VALUES (p_subscription_id, v_month, v_subtotal * 12, v_vat * 12, v_total * 12)
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;
  ELSE
    -- Monthly: 12 records
    FOR i IN 0..11 LOOP
      v_month := (date_trunc('month', COALESCE(p_start_date, v_sub.start_date))
                  + (i || ' months')::INTERVAL)::DATE;
      INSERT INTO subscription_payments (subscription_id, payment_month, amount, vat_amount, total_amount)
      VALUES (p_subscription_id, v_month, v_subtotal, v_vat, v_total)
      ON CONFLICT (subscription_id, payment_month) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_subscription_payments(UUID, DATE) TO authenticated;
