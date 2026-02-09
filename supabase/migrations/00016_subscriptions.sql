-- Migration: 00016_subscriptions
-- Description: Subscription management system - tables, view, functions, triggers, RLS
-- Tables: payment_methods, subscriptions, subscription_payments, audit_logs
-- View: subscriptions_detail
-- Functions: generate_subscription_payments, get_overdue_invoices, get_subscription_stats

-- ============================================================================
-- 1. PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Type
  method_type     TEXT NOT NULL CHECK (method_type IN ('card', 'bank_transfer', 'cash')),

  -- Card info (display only - NO full card numbers, PCI-DSS compliant)
  card_last4      TEXT CHECK (char_length(card_last4) = 4),
  card_holder     TEXT,
  card_expiry     TEXT,
  card_brand      TEXT,

  -- Bank transfer info
  bank_name       TEXT,
  iban            TEXT,

  -- Future automation (Phase 2)
  iyzico_token    TEXT,

  -- Display
  label           TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_methods_customer ON payment_methods (customer_id);
CREATE INDEX idx_payment_methods_active ON payment_methods (customer_id) WHERE is_active = true;

CREATE TRIGGER set_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select" ON payment_methods FOR SELECT
  TO authenticated USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_insert" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_update" ON payment_methods FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_delete" ON payment_methods FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,

  -- Type & Status
  subscription_type TEXT NOT NULL CHECK (subscription_type IN (
    'recurring_card', 'manual_cash', 'manual_bank', 'annual', 'internet_only'
  )),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled'
  )),

  -- Dates
  start_date        DATE NOT NULL,
  end_date          DATE,
  billing_day       INTEGER DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),

  -- Pricing (DECIMAL, never float)
  base_price        DECIMAL(10,2) NOT NULL,
  sms_fee           DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_fee          DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate          DECIMAL(5,2)  NOT NULL DEFAULT 20.00,
  cost              DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'TRY',

  -- Payment method (nullable - cash/bank don't need stored method)
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,

  -- Lifecycle metadata
  pause_reason      TEXT,
  cancel_reason     TEXT,
  paused_at         TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  -- Ownership & tracking
  sold_by           UUID REFERENCES profiles(id),
  managed_by        UUID REFERENCES profiles(id),
  setup_notes       TEXT,
  notes             TEXT,

  -- Timestamps
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRITICAL: One active subscription per site
CREATE UNIQUE INDEX idx_subscriptions_active_site
  ON subscriptions (site_id) WHERE status = 'active';

CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_type ON subscriptions (subscription_type);
CREATE INDEX idx_subscriptions_status_start ON subscriptions (status, start_date);
CREATE INDEX idx_subscriptions_site ON subscriptions (site_id);
CREATE INDEX idx_subscriptions_managed ON subscriptions (managed_by) WHERE managed_by IS NOT NULL;

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto lifecycle timestamps trigger function
CREATE OR REPLACE FUNCTION set_subscription_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paused' AND OLD.status != 'paused' THEN
    NEW.paused_at = now();
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
    NEW.end_date = COALESCE(NEW.end_date, CURRENT_DATE);
  END IF;
  IF NEW.status = 'active' AND OLD.status = 'paused' THEN
    NEW.paused_at = NULL;
    NEW.pause_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_lifecycle
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_subscription_lifecycle_timestamps();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "subscriptions_delete" ON subscriptions FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');

-- ============================================================================
-- 3. SUBSCRIPTION PAYMENTS TABLE
-- ============================================================================

CREATE TABLE subscription_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- Period (always 1st of month)
  payment_month       DATE NOT NULL,

  -- Amounts
  amount              DECIMAL(10,2) NOT NULL,
  vat_amount          DECIMAL(10,2) NOT NULL,
  total_amount        DECIMAL(10,2) NOT NULL,

  -- Status
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'failed', 'skipped', 'write_off'
  )),

  -- Payment details (filled when recording payment)
  payment_date        DATE,
  payment_method      TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),

  -- Invoice (Turkish tax compliance)
  invoice_no          TEXT,
  invoice_type        TEXT CHECK (invoice_type IN ('e_fatura', 'e_arsiv')),
  invoice_date        DATE,
  parasut_invoice_id  TEXT,

  -- Dunning (Phase 2)
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One payment record per subscription per month
  CONSTRAINT uq_subscription_payment_month UNIQUE (subscription_id, payment_month)
);

CREATE INDEX idx_sub_payments_subscription ON subscription_payments (subscription_id);
CREATE INDEX idx_sub_payments_status ON subscription_payments (status);
CREATE INDEX idx_sub_payments_month ON subscription_payments (payment_month);
CREATE INDEX idx_sub_payments_overdue_invoice
  ON subscription_payments (payment_date)
  WHERE status = 'paid' AND invoice_no IS NULL;

CREATE TRIGGER set_sub_payments_updated_at
  BEFORE UPDATE ON subscription_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select" ON subscription_payments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "sp_insert" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "sp_update" ON subscription_payments FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "sp_delete" ON subscription_payments FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');

-- ============================================================================
-- 4. AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN (
    'insert', 'update', 'delete', 'status_change', 'payment_recorded',
    'price_change', 'pause', 'cancel', 'reactivate'
  )),
  old_values      JSONB,
  new_values      JSONB,
  user_id         UUID REFERENCES profiles(id),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_table_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs (user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  TO authenticated USING (get_my_role() = 'admin');

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================================
-- 5. SUBSCRIPTIONS DETAIL VIEW
-- ============================================================================

CREATE OR REPLACE VIEW subscriptions_detail AS
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
  pm.label        AS pm_label,
  -- Staff names
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id;

GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Generate monthly payment records for a subscription
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

  IF v_sub.subscription_type = 'annual' THEN
    -- Annual: 1 record for the year
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

-- Get payments that are paid but missing invoice for >7 days (Turkish tax compliance)
CREATE OR REPLACE FUNCTION get_overdue_invoices()
RETURNS TABLE (
  payment_id UUID,
  subscription_id UUID,
  payment_month DATE,
  payment_date DATE,
  total_amount DECIMAL(10,2),
  days_overdue INTEGER,
  company_name TEXT,
  account_no TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    sp.id,
    sp.subscription_id,
    sp.payment_month,
    sp.payment_date,
    sp.total_amount,
    (CURRENT_DATE - sp.payment_date)::INTEGER,
    c.company_name,
    s.account_no
  FROM subscription_payments sp
  JOIN subscriptions sub ON sp.subscription_id = sub.id
  JOIN customer_sites s ON sub.site_id = s.id
  JOIN customers c ON s.customer_id = c.id
  WHERE sp.status = 'paid'
    AND sp.invoice_no IS NULL
    AND sp.payment_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY sp.payment_date ASC;
$$;

-- Dashboard KPI stats
CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'active_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'paused_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      SELECT COALESCE(SUM(
        CASE
          WHEN subscription_type = 'annual'
            THEN ROUND((base_price + sms_fee + line_fee) * (1 + vat_rate / 100) / 12, 2)
          ELSE
            ROUND((base_price + sms_fee + line_fee) * (1 + vat_rate / 100), 2)
        END
      ), 0) FROM subscriptions WHERE status = 'active'
    ),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'paid' AND invoice_no IS NULL
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
