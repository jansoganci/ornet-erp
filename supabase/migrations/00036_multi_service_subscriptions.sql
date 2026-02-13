-- Migration: 00036_multi_service_subscriptions
-- Description: Multi-service support - allow multiple active subscriptions per site (one per service type).
-- Splits combo service types (alarm_camera, alarm_camera_internet) into atomic types with 0 pricing.
-- Fresh payment schedule from current month for affected subscriptions.

-- ============================================================================
-- Pre-migration: Run these manually before applying migration (backup)
-- ============================================================================
-- CREATE TABLE subscriptions_backup_20260211 AS SELECT * FROM subscriptions;
-- CREATE TABLE subscription_payments_backup_20260211 AS SELECT * FROM subscription_payments;
-- CREATE TABLE subscription_price_revision_notes_backup_20260211 AS SELECT * FROM subscription_price_revision_notes;

-- ============================================================================
-- Step 1: Drop old unique constraint
-- ============================================================================
DROP INDEX IF EXISTS idx_subscriptions_active_site;

-- ============================================================================
-- Step 2: Delete payments for combo subscriptions (before splitting)
-- ============================================================================
DELETE FROM subscription_payments
WHERE subscription_id IN (
  SELECT id FROM subscriptions
  WHERE service_type IN ('alarm_camera', 'alarm_camera_internet')
);

-- ============================================================================
-- Step 3: Split alarm_camera_internet -> alarm_only + camera_only + internet_only
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  camera_id UUID;
  internet_id UUID;
  current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  FOR rec IN
    SELECT * FROM subscriptions
    WHERE service_type = 'alarm_camera_internet'
  LOOP
    -- Update original to alarm_only with 0 pricing
    UPDATE subscriptions
    SET
      service_type = 'alarm_only',
      base_price = 0,
      sms_fee = 0,
      line_fee = 0,
      cost = 0,
      updated_at = now()
    WHERE id = rec.id;

    -- Insert camera_only and capture id
    INSERT INTO subscriptions (
      site_id, subscription_type, status, service_type,
      billing_frequency, start_date, billing_day,
      base_price, sms_fee, line_fee, vat_rate, cost, currency,
      payment_method_id, sold_by, managed_by, cash_collector_id,
      official_invoice, card_bank_name, card_last4,
      notes, setup_notes
    ) VALUES (
      rec.site_id, rec.subscription_type, rec.status, 'camera_only',
      rec.billing_frequency, rec.start_date, rec.billing_day,
      0, 0, 0, rec.vat_rate, 0, rec.currency,
      rec.payment_method_id, rec.sold_by, rec.managed_by, rec.cash_collector_id,
      rec.official_invoice, rec.card_bank_name, rec.card_last4,
      rec.notes, rec.setup_notes
    )
    RETURNING id INTO camera_id;

    -- Insert internet_only and capture id
    INSERT INTO subscriptions (
      site_id, subscription_type, status, service_type,
      billing_frequency, start_date, billing_day,
      base_price, sms_fee, line_fee, vat_rate, cost, currency,
      payment_method_id, sold_by, managed_by, cash_collector_id,
      official_invoice, card_bank_name, card_last4,
      notes, setup_notes
    ) VALUES (
      rec.site_id, rec.subscription_type, rec.status, 'internet_only',
      rec.billing_frequency, rec.start_date, rec.billing_day,
      0, 0, 0, rec.vat_rate, 0, rec.currency,
      rec.payment_method_id, rec.sold_by, rec.managed_by, rec.cash_collector_id,
      rec.official_invoice, rec.card_bank_name, rec.card_last4,
      rec.notes, rec.setup_notes
    )
    RETURNING id INTO internet_id;

    -- Generate payments for all 3
    PERFORM generate_subscription_payments(rec.id, current_month_start);
    PERFORM generate_subscription_payments(camera_id, current_month_start);
    PERFORM generate_subscription_payments(internet_id, current_month_start);
  END LOOP;
END $$;

-- ============================================================================
-- Step 4: Split alarm_camera -> alarm_only + camera_only
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  camera_id UUID;
  current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  FOR rec IN
    SELECT * FROM subscriptions
    WHERE service_type = 'alarm_camera'
  LOOP
    -- Update original to alarm_only with 0 pricing
    UPDATE subscriptions
    SET
      service_type = 'alarm_only',
      base_price = 0,
      sms_fee = 0,
      line_fee = 0,
      cost = 0,
      updated_at = now()
    WHERE id = rec.id;

    -- Insert camera_only and capture id
    INSERT INTO subscriptions (
      site_id, subscription_type, status, service_type,
      billing_frequency, start_date, billing_day,
      base_price, sms_fee, line_fee, vat_rate, cost, currency,
      payment_method_id, sold_by, managed_by, cash_collector_id,
      official_invoice, card_bank_name, card_last4,
      notes, setup_notes
    ) VALUES (
      rec.site_id, rec.subscription_type, rec.status, 'camera_only',
      rec.billing_frequency, rec.start_date, rec.billing_day,
      0, 0, 0, rec.vat_rate, 0, rec.currency,
      rec.payment_method_id, rec.sold_by, rec.managed_by, rec.cash_collector_id,
      rec.official_invoice, rec.card_bank_name, rec.card_last4,
      rec.notes, rec.setup_notes
    )
    RETURNING id INTO camera_id;

    -- Generate payments for both
    PERFORM generate_subscription_payments(rec.id, current_month_start);
    PERFORM generate_subscription_payments(camera_id, current_month_start);
  END LOOP;
END $$;

-- ============================================================================
-- Step 5: Add new unique constraint (site + service type)
-- ============================================================================
CREATE UNIQUE INDEX idx_subscriptions_active_site_service
  ON subscriptions (site_id, service_type)
  WHERE status = 'active' AND service_type IS NOT NULL;

-- ============================================================================
-- Step 6: Update service_type CHECK constraint (atomic types only)
-- ============================================================================
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_service_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('alarm_only', 'camera_only', 'internet_only'));
