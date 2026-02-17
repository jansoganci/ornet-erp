-- Migration: 00066_notification_views_functions
-- Description: View, badge count, resolve function
-- Phase 3 of notification-system-progress.md

-- ============================================================================
-- 1. V_ACTIVE_NOTIFICATIONS VIEW
-- ============================================================================

DROP VIEW IF EXISTS v_active_notifications;
CREATE VIEW v_active_notifications AS
SELECT * FROM (
  -- Section 1: Open Work Orders
  SELECT
    'computed'::TEXT AS notification_source,
    'open_work_order'::TEXT AS notification_type,
    TRIM(COALESCE(wo.form_no, '') || ' ' || COALESCE(wo.work_type::TEXT, '')) AS title,
    (COALESCE(c.company_name, '') || ' — ' || COALESCE(cs.site_name, '') || ' — ' || COALESCE(wo.scheduled_date::TEXT, '-')) AS body,
    'work_order'::TEXT AS entity_type,
    wo.id AS entity_id,
    wo.created_at,
    NULL::UUID AS notification_id
  FROM work_orders wo
  JOIN customer_sites cs ON wo.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE wo.status NOT IN ('completed', 'cancelled')
    AND (wo.scheduled_date > CURRENT_DATE OR wo.scheduled_date IS NULL)

  UNION ALL

  -- Section 2: Overdue Work Orders
  SELECT
    'computed'::TEXT,
    'overdue_work_order'::TEXT,
    TRIM(COALESCE(wo.form_no, '') || ' ' || COALESCE(wo.work_type::TEXT, '')),
    (COALESCE(c.company_name, '') || ' — ' || COALESCE(cs.site_name, '') || ' — ' || COALESCE(wo.scheduled_date::TEXT, '-')),
    'work_order'::TEXT,
    wo.id,
    wo.created_at,
    NULL::UUID
  FROM work_orders wo
  JOIN customer_sites cs ON wo.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE wo.status NOT IN ('completed', 'cancelled')
    AND wo.scheduled_date < CURRENT_DATE

  UNION ALL

  -- Section 3: Proposals Awaiting Response (sent within last 2 days)
  SELECT
    'computed'::TEXT,
    'proposal_awaiting_response'::TEXT,
    (COALESCE(p.proposal_no, '') || ' ' || COALESCE(c.company_name, '')),
    COALESCE(c.company_name, ''),
    'proposal'::TEXT,
    p.id,
    p.created_at,
    NULL::UUID
  FROM proposals p
  JOIN customer_sites cs ON p.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE p.status = 'sent'
    AND (p.sent_at IS NULL OR p.sent_at >= NOW() - INTERVAL '2 days')

  UNION ALL

  -- Section 4: Proposal 2+ Days No Response (sent 2+ days ago)
  SELECT
    'computed'::TEXT,
    'proposal_no_response_2d'::TEXT,
    (COALESCE(p.proposal_no, '') || ' ' || COALESCE(c.company_name, '')),
    (COALESCE(c.company_name, '') || ' — 2+ gündür cevapsız'),
    'proposal'::TEXT,
    p.id,
    p.created_at,
    NULL::UUID
  FROM proposals p
  JOIN customer_sites cs ON p.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE p.status = 'sent'
    AND p.sent_at < NOW() - INTERVAL '2 days'

  UNION ALL

  -- Section 5: Approved Not Installed
  SELECT
    'computed'::TEXT,
    'proposal_approved_no_wo'::TEXT,
    (COALESCE(p.proposal_no, '') || ' ' || COALESCE(c.company_name, '')),
    COALESCE(c.company_name, ''),
    'proposal'::TEXT,
    p.id,
    p.created_at,
    NULL::UUID
  FROM proposals p
  JOIN customer_sites cs ON p.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE p.status = 'accepted'
    AND NOT EXISTS (SELECT 1 FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id)

  UNION ALL

  -- Section 6: Today Scheduled Not Started
  SELECT
    'computed'::TEXT,
    'today_not_started'::TEXT,
    TRIM(COALESCE(wo.form_no, '') || ' ' || COALESCE(wo.work_type::TEXT, '')),
    (COALESCE(c.company_name, '') || ' — ' || COALESCE(cs.site_name, '') || ' — ' || COALESCE(wo.scheduled_date::TEXT, '-')),
    'work_order'::TEXT,
    wo.id,
    wo.created_at,
    NULL::UUID
  FROM work_orders wo
  JOIN customer_sites cs ON wo.site_id = cs.id
  JOIN customers c ON cs.customer_id = c.id
  WHERE wo.status NOT IN ('completed', 'cancelled')
    AND wo.scheduled_date = CURRENT_DATE

  UNION ALL

  -- Section 7: Active Stored Notifications
  SELECT
    'stored'::TEXT,
    n.type,
    n.title,
    n.body,
    n.related_entity_type,
    n.related_entity_id,
    n.created_at,
    n.id
  FROM notifications n
  WHERE n.resolved_at IS NULL

  UNION ALL

  -- Section 8: Active User Reminders (already triggered)
  SELECT
    'stored'::TEXT,
    'user_reminder'::TEXT,
    ur.title,
    ur.content,
    'reminder'::TEXT,
    ur.id,
    ur.created_at,
    NULL::UUID
  FROM user_reminders ur
  WHERE ur.notified = true
    AND ur.completed_at IS NULL
) sub
WHERE get_my_role() IN ('admin', 'accountant');

GRANT SELECT ON v_active_notifications TO authenticated;

-- ============================================================================
-- 2. GET_NOTIFICATION_BADGE_COUNT() FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_notification_badge_count()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_open_work_orders BIGINT;
  v_overdue_work_orders BIGINT;
  v_today_not_started BIGINT;
  v_proposals_sent BIGINT;
  v_proposals_approved_no_wo BIGINT;
  v_proposals_waiting BIGINT;
  v_stored_notifications BIGINT;
  v_reminders BIGINT;
  v_total BIGINT;
BEGIN
  v_role := get_my_role();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RETURN json_build_object(
      'total', 0,
      'open_work_orders', 0,
      'overdue_work_orders', 0,
      'today_not_started', 0,
      'proposals_waiting', 0,
      'stored_notifications', 0,
      'reminders', 0
    );
  END IF;

  -- Open = future or unscheduled (excludes overdue and today)
  SELECT COUNT(*) INTO v_open_work_orders
  FROM work_orders
  WHERE status NOT IN ('completed', 'cancelled')
    AND (scheduled_date > CURRENT_DATE OR scheduled_date IS NULL);

  -- Overdue = past due date
  SELECT COUNT(*) INTO v_overdue_work_orders
  FROM work_orders
  WHERE status NOT IN ('completed', 'cancelled')
    AND scheduled_date < CURRENT_DATE;

  -- Today = scheduled for today but not done
  SELECT COUNT(*) INTO v_today_not_started
  FROM work_orders
  WHERE status NOT IN ('completed', 'cancelled')
    AND scheduled_date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_proposals_sent
  FROM proposals
  WHERE status = 'sent';

  SELECT COUNT(*) INTO v_proposals_approved_no_wo
  FROM proposals p
  WHERE p.status = 'accepted'
    AND NOT EXISTS (SELECT 1 FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id);

  v_proposals_waiting := v_proposals_sent + v_proposals_approved_no_wo;

  SELECT COUNT(*) INTO v_stored_notifications
  FROM notifications
  WHERE resolved_at IS NULL;

  SELECT COUNT(*) INTO v_reminders
  FROM user_reminders
  WHERE notified = true
    AND completed_at IS NULL;

  v_total := v_open_work_orders + v_overdue_work_orders + v_today_not_started + v_proposals_waiting + v_stored_notifications + v_reminders;

  RETURN json_build_object(
    'total', v_total,
    'open_work_orders', v_open_work_orders,
    'overdue_work_orders', v_overdue_work_orders,
    'today_not_started', v_today_not_started,
    'proposals_waiting', v_proposals_waiting,
    'stored_notifications', v_stored_notifications,
    'reminders', v_reminders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_notification_badge_count() TO authenticated;

-- ============================================================================
-- 3. FN_RESOLVE_NOTIFICATION() FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_resolve_notification(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_my_role() NOT IN ('admin', 'accountant') THEN
    RETURN;
  END IF;

  UPDATE notifications
  SET resolved_at = now()
  WHERE id = p_notification_id
    AND resolved_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_resolve_notification(UUID) TO authenticated;
