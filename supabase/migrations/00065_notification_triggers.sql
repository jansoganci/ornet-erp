-- Migration: 00065_notification_triggers
-- Description: Triggers for instant notifications and auto-resolve
-- Phase 2 of notification-system-progress.md

-- ============================================================================
-- 1. SUBSCRIPTION CANCEL/PAUSE NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notify_subscription_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_company_name TEXT;
  v_phone TEXT;
  v_operator_display TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('cancelled', 'paused') THEN
    RETURN NEW;
  END IF;

  v_type := CASE WHEN NEW.status = 'cancelled' THEN 'subscription_cancelled' ELSE 'subscription_paused' END;

  -- Title: company name from customer_sites -> customers
  SELECT c.company_name INTO v_company_name
  FROM customer_sites cs
  JOIN customers c ON c.id = cs.customer_id
  WHERE cs.id = NEW.site_id
  LIMIT 1;

  v_title := COALESCE(v_company_name, 'Abonelik') || ' — ' || CASE WHEN NEW.status = 'cancelled' THEN 'İptal' ELSE 'Duraklatma' END;

  -- Body: phone + carrier message if SIM linked
  IF NEW.sim_card_id IS NOT NULL THEN
    SELECT sc.phone_number,
           CASE sc.operator::text
             WHEN 'TURKCELL' THEN 'Turkcell'
             WHEN 'VODAFONE' THEN 'Vodafone'
             WHEN 'TURK_TELEKOM' THEN 'Turk Telekom'
             ELSE sc.operator::text
           END
    INTO v_phone, v_operator_display
    FROM sim_cards sc
    WHERE sc.id = NEW.sim_card_id
    LIMIT 1;

    IF v_phone IS NOT NULL THEN
      v_body := v_phone || ' — ' || CASE WHEN NEW.status = 'cancelled'
        THEN 'Cancel this number from ' || COALESCE(v_operator_display, 'carrier')
        ELSE 'Set this number to inactive at ' || COALESCE(v_operator_display, 'carrier')
      END;
    END IF;
  END IF;

  BEGIN
    INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
    VALUES (v_type, v_title, v_body, 'subscription', NEW.id, v_type || '::' || NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_subscription_status_change failed for subscription %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_status_change ON subscriptions;
CREATE TRIGGER trg_notify_subscription_status_change
  AFTER UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_notify_subscription_status_change();

-- ============================================================================
-- 2. WORK ORDER ASSIGNED NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notify_work_order_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_company_name TEXT;
  v_site_name TEXT;
BEGIN
  v_title := TRIM(COALESCE(NEW.form_no, '') || ' ' || COALESCE(NEW.work_type::text, ''));

  SELECT c.company_name, cs.site_name INTO v_company_name, v_site_name
  FROM customer_sites cs
  JOIN customers c ON c.id = cs.customer_id
  WHERE cs.id = NEW.site_id
  LIMIT 1;

  v_body := COALESCE(v_company_name, '') || ' — ' || COALESCE(v_site_name, '') || ' — ' || COALESCE(NEW.scheduled_date::text, '-');

  BEGIN
    INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, target_role, dedup_key)
    VALUES ('work_order_assigned', v_title, v_body, 'work_order', NEW.id, 'admin', 'work_order_assigned::' || NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_work_order_assigned failed for work_order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_work_order_assigned ON work_orders;
CREATE TRIGGER trg_notify_work_order_assigned
  AFTER INSERT ON work_orders
  FOR EACH ROW EXECUTE FUNCTION fn_notify_work_order_assigned();

-- ============================================================================
-- 3. AUTO-RESOLVE NOTIFICATIONS WHEN ENTITY CLOSES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_resolve_notification_on_entity_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'work_orders' AND NEW.status IN ('completed', 'cancelled') THEN
    BEGIN
      UPDATE notifications
      SET resolved_at = now()
      WHERE related_entity_type = 'work_order' AND related_entity_id = OLD.id AND resolved_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_resolve_notification work_order failed for %: %', OLD.id, SQLERRM;
    END;
  ELSIF TG_TABLE_NAME = 'tasks' AND NEW.status IN ('completed', 'cancelled') THEN
    BEGIN
      UPDATE notifications
      SET resolved_at = now()
      WHERE related_entity_type = 'task' AND related_entity_id = OLD.id AND resolved_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_resolve_notification task failed for %: %', OLD.id, SQLERRM;
    END;
  ELSIF TG_TABLE_NAME = 'subscription_payments' AND OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending' THEN
    BEGIN
      UPDATE notifications
      SET resolved_at = now()
      WHERE related_entity_type = 'subscription_payment' AND related_entity_id = OLD.id AND resolved_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_resolve_notification subscription_payment failed for %: %', OLD.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_notification_work_order ON work_orders;
CREATE TRIGGER trg_resolve_notification_work_order
  AFTER UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION fn_resolve_notification_on_entity_close();

DROP TRIGGER IF EXISTS trg_resolve_notification_task ON tasks;
CREATE TRIGGER trg_resolve_notification_task
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_resolve_notification_on_entity_close();

DROP TRIGGER IF EXISTS trg_resolve_notification_subscription_payment ON subscription_payments;
CREATE TRIGGER trg_resolve_notification_subscription_payment
  AFTER UPDATE ON subscription_payments
  FOR EACH ROW EXECUTE FUNCTION fn_resolve_notification_on_entity_close();
