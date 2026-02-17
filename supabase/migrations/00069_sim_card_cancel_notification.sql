-- Migration: 00069_sim_card_cancel_notification
-- Description: Trigger to notify when a SIM card status changes to cancelled
-- Ensures staff remember to shut down the line at the operator website

-- ============================================================================
-- 1. EXPAND CHECK CONSTRAINTS TO ALLOW NEW TYPE
-- ============================================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'subscription_cancelled', 'subscription_paused', 'payment_due_soon',
  'renewal_due_soon', 'work_order_assigned', 'task_due_soon', 'user_reminder',
  'sim_card_cancelled'
));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_entity_type_check CHECK (related_entity_type IN (
  'work_order', 'proposal', 'subscription', 'subscription_payment', 'task', 'reminder',
  'sim_card'
));

-- ============================================================================
-- 2. TRIGGER FUNCTION: SIM CARD STATUS → CANCELLED
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notify_sim_card_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_operator_display TEXT;
  v_customer_name TEXT;
BEGIN
  -- Only fire when status changes TO cancelled
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Operator display name
  v_operator_display := CASE NEW.operator::text
    WHEN 'TURKCELL'     THEN 'Turkcell'
    WHEN 'VODAFONE'     THEN 'Vodafone'
    WHEN 'TURK_TELEKOM' THEN 'Türk Telekom'
    ELSE NEW.operator::text
  END;

  -- Customer name if assigned
  IF NEW.customer_id IS NOT NULL THEN
    SELECT c.company_name INTO v_customer_name
    FROM customers c WHERE c.id = NEW.customer_id LIMIT 1;
  END IF;

  v_title := 'Bu hattı kapattınız mı? ' || COALESCE(NEW.phone_number, '-');

  v_body := COALESCE(v_operator_display, 'Operatör') || ' üzerinden kapatılmalı';
  IF v_customer_name IS NOT NULL THEN
    v_body := v_customer_name || ' — ' || v_body;
  END IF;

  BEGIN
    INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
    VALUES ('sim_card_cancelled', v_title, v_body, 'sim_card', NEW.id, 'sim_card_cancelled::' || NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_sim_card_cancelled failed for sim_card %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. ATTACH TRIGGER TO sim_cards TABLE
-- ============================================================================

DROP TRIGGER IF EXISTS trg_notify_sim_card_cancelled ON sim_cards;
CREATE TRIGGER trg_notify_sim_card_cancelled
  AFTER UPDATE ON sim_cards
  FOR EACH ROW EXECUTE FUNCTION fn_notify_sim_card_cancelled();
