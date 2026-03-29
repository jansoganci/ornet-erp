-- Migration: 00166_notify_work_order_completed
-- Description: Insert an already-resolved notification row when a work order
-- is completed or cancelled. The row is immediately visible in the "Geçmiş"
-- (history) tab and never appears in the active notification feed.

-- ============================================================================
-- 1. EXTEND notifications.type CHECK CONSTRAINT
-- ============================================================================
-- The existing constraint was last set in 00149. We add 'work_order_completed'.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'subscription_cancelled', 'subscription_paused', 'payment_due_soon',
  'renewal_due_soon', 'work_order_assigned', 'task_due_soon', 'user_reminder',
  'sim_card_cancelled', 'pending_payments_summary', 'work_order_completed'
));

-- ============================================================================
-- 2. fn_notify_work_order_completed()
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notify_work_order_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
  v_company_name TEXT;
  v_site_name    TEXT;
BEGIN
  -- Resolve company/site for a meaningful title
  SELECT c.company_name, cs.site_name
  INTO v_company_name, v_site_name
  FROM customer_sites cs
  JOIN customers c ON c.id = cs.customer_id
  WHERE cs.id = NEW.site_id
  LIMIT 1;

  v_title := TRIM(
    COALESCE(NEW.form_no, '') || ' ' ||
    COALESCE(v_company_name, '') || ' — ' ||
    COALESCE(v_site_name, '')
  );

  v_body := CASE
    WHEN NEW.status = 'completed' THEN 'İş emri tamamlandı'
    ELSE 'İş emri iptal edildi'
  END;

  BEGIN
    INSERT INTO notifications (
      type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      target_role,
      resolved_at,
      dedup_key
    )
    VALUES (
      'work_order_completed',
      v_title,
      v_body,
      'work_order',
      NEW.id,
      'admin',
      NOW(),   -- already resolved → skips active feed, lands only in history
      'work_order_' || NEW.id || '_' || NEW.status
    )
    ON CONFLICT (dedup_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_work_order_completed failed for work_order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trg_notify_work_order_completed ON work_orders;
CREATE TRIGGER trg_notify_work_order_completed
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('completed', 'cancelled')
    AND OLD.status NOT IN ('completed', 'cancelled')
  )
  EXECUTE FUNCTION fn_notify_work_order_completed();
