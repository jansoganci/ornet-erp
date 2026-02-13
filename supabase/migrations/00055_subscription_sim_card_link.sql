-- Migration: 00055_subscription_sim_card_link
-- Description: Link subscriptions to SIM cards. Option A - sim_card_id FK.
-- When subscription created with sim_card_id: SIM status = 'subscription'
-- When subscription cancelled: SIM status = 'inactive'
-- When subscription reactivated: SIM status = 'subscription'
-- Depends on: 00054_add_sim_card_subscription_enum

-- ============================================================================
-- 1. Add sim_card_id to subscriptions
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS sim_card_id UUID REFERENCES sim_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_sim_card ON subscriptions(sim_card_id);

-- ============================================================================
-- 2. Trigger: on INSERT - set SIM status to 'subscription'
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_subscription_sim_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sim_card_id IS NOT NULL THEN
    UPDATE sim_cards
    SET status = 'subscription',
        customer_id = (SELECT customer_id FROM customer_sites WHERE id = NEW.site_id),
        site_id = NEW.site_id
    WHERE id = NEW.sim_card_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_sim_insert ON subscriptions;
CREATE TRIGGER trg_subscription_sim_insert
  AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_subscription_sim_status_on_insert();

-- ============================================================================
-- 3. Trigger: on UPDATE - set SIM to inactive on cancel, subscription on reactivate
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_subscription_sim_status_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sim_card_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
    UPDATE sim_cards
    SET status = 'inactive'
    WHERE id = NEW.sim_card_id;
  ELSIF NEW.status = 'active' AND OLD.status = 'cancelled' THEN
    UPDATE sim_cards
    SET status = 'subscription'
    WHERE id = NEW.sim_card_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_sim_update ON subscriptions;
CREATE TRIGGER trg_subscription_sim_update
  AFTER UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_subscription_sim_status_on_update();

-- ============================================================================
-- 4. Update view_sim_card_stats to include subscription_count
-- ============================================================================

DROP VIEW IF EXISTS view_sim_card_stats;

CREATE VIEW view_sim_card_stats AS
SELECT
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'available') as available_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'subscription') as subscription_count,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
  COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
  COUNT(DISTINCT operator) as operator_count
FROM sim_cards;

GRANT SELECT ON view_sim_card_stats TO authenticated;

-- ============================================================================
-- 5. Extend subscriptions_detail with sim_phone_number for display
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
