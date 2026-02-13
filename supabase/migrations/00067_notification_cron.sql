-- Migration: 00067_notification_cron
-- Description: pg_cron jobs for scheduled notifications
-- Phase 4 of notification-system-progress.md

-- ============================================================================
-- 1. FN_CREATE_SCHEDULED_NOTIFICATIONS()
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_create_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Payment due soon (5 days)
  INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
  SELECT
    'payment_due_soon',
    'Ödeme vadesi yaklaşıyor — ' || COALESCE(c.company_name, ''),
    to_char(sp.payment_month, 'DD.MM.YYYY') || ' — ' || COALESCE(sp.total_amount::TEXT, '') || ' TL',
    'subscription_payment',
    sp.id,
    'payment_due_soon::' || sp.id
  FROM subscription_payments sp
  JOIN subscriptions s ON s.id = sp.subscription_id
  JOIN customer_sites cs ON cs.id = s.site_id
  JOIN customers c ON c.id = cs.customer_id
  WHERE sp.status = 'pending'
    AND sp.payment_month BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ON CONFLICT (dedup_key) DO NOTHING;

  -- Step 2: Renewal due soon (5 days)
  INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
  SELECT
    'renewal_due_soon',
    'Yenileme tarihi yaklaşıyor — ' || COALESCE(c.company_name, ''),
    to_char(s.end_date, 'DD.MM.YYYY'),
    'subscription',
    s.id,
    'renewal_due_soon::' || s.id
  FROM subscriptions s
  JOIN customer_sites cs ON cs.id = s.site_id
  JOIN customers c ON c.id = cs.customer_id
  WHERE s.status = 'active'
    AND s.end_date IS NOT NULL
    AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ON CONFLICT (dedup_key) DO NOTHING;

  -- Step 3: Task due soon (2 days)
  INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
  SELECT
    'task_due_soon',
    COALESCE(t.title, 'Görev'),
    to_char(t.due_date, 'DD.MM.YYYY'),
    'task',
    t.id,
    'task_due_soon::' || t.id
  FROM tasks t
  WHERE t.status NOT IN ('completed', 'cancelled')
    AND t.due_date IS NOT NULL
    AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
  ON CONFLICT (dedup_key) DO NOTHING;

  -- Step 4: Auto-resolve (catch-up)
  UPDATE notifications
  SET resolved_at = now()
  WHERE type = 'payment_due_soon'
    AND related_entity_id IN (
      SELECT id FROM subscription_payments
      WHERE status != 'pending'
    )
    AND resolved_at IS NULL;

  UPDATE notifications
  SET resolved_at = now()
  WHERE type = 'renewal_due_soon'
    AND related_entity_id IN (
      SELECT id FROM subscriptions
      WHERE status NOT IN ('active')
         OR (end_date IS NOT NULL AND end_date < CURRENT_DATE)
    )
    AND resolved_at IS NULL;

  UPDATE notifications
  SET resolved_at = now()
  WHERE type = 'task_due_soon'
    AND related_entity_id IN (
      SELECT id FROM tasks
      WHERE status IN ('completed', 'cancelled')
    )
    AND resolved_at IS NULL;

  -- Step 5: Cleanup orphaned notifications (entities deleted)
  DELETE FROM notifications
  WHERE resolved_at IS NULL
    AND (
      (related_entity_type = 'work_order' AND NOT EXISTS (
        SELECT 1 FROM work_orders WHERE id = notifications.related_entity_id
      ))
      OR (related_entity_type = 'proposal' AND NOT EXISTS (
        SELECT 1 FROM proposals WHERE id = notifications.related_entity_id
      ))
      OR (related_entity_type = 'subscription' AND NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE id = notifications.related_entity_id
      ))
      OR (related_entity_type = 'task' AND NOT EXISTS (
        SELECT 1 FROM tasks WHERE id = notifications.related_entity_id
      ))
      OR (related_entity_type = 'subscription_payment' AND NOT EXISTS (
        SELECT 1 FROM subscription_payments WHERE id = notifications.related_entity_id
      ))
    );
END;
$$;

-- ============================================================================
-- 2. FN_PROCESS_REMINDERS()
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_process_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notifications for due reminders
  INSERT INTO notifications (type, title, body, related_entity_type, related_entity_id, dedup_key)
  SELECT
    'user_reminder',
    ur.title,
    ur.content,
    'reminder',
    ur.id,
    'user_reminder::' || ur.id
  FROM user_reminders ur
  WHERE ur.notified = false
    AND ur.completed_at IS NULL
    AND ur.remind_date <= CURRENT_DATE
    AND (ur.remind_time <= LOCALTIME OR ur.remind_time IS NULL)
  ON CONFLICT (dedup_key) DO NOTHING;

  -- Mark as notified
  UPDATE user_reminders
  SET notified = true
  WHERE notified = false
    AND completed_at IS NULL
    AND remind_date <= CURRENT_DATE
    AND (remind_time <= LOCALTIME OR remind_time IS NULL);
END;
$$;

-- ============================================================================
-- 3. FN_NOTIFICATION_CLEANUP()
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notification_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE resolved_at IS NOT NULL
    AND resolved_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ============================================================================
-- 4. SCHEDULE PG_CRON JOBS
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('notification-daily-check');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('notification-reminder-check');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('notification-cleanup-monthly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'notification-daily-check',
  '0 6 * * *',
  $$ SELECT fn_create_scheduled_notifications(); $$
);

SELECT cron.schedule(
  'notification-reminder-check',
  '0 * * * *',
  $$ SELECT fn_process_reminders(); $$
);

SELECT cron.schedule(
  'notification-cleanup-monthly',
  '0 4 1 * *',
  $$ SELECT fn_notification_cleanup(); $$
);
