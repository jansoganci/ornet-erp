-- Migration: 00014_fix_dashboard_functions
-- Description: Recreate dashboard RPCs to match current schema (work_orders has site_id, work_type, assigned_to UUID[])
-- Fixes: 400/404 on get_dashboard_stats, get_today_schedule, get_my_pending_tasks after 00009_rebuild_work_orders

-- ============================================
-- 1. get_dashboard_stats()
-- ============================================
-- work_orders: use auth.uid() = ANY(assigned_to); tables work_orders, tasks, customers unchanged

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := COALESCE(get_my_role(), 'field_worker');

  SELECT json_build_object(
    'today_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE scheduled_date = CURRENT_DATE
      AND status NOT IN ('completed', 'cancelled')
      AND (user_role IN ('admin', 'accountant') OR user_id = ANY(assigned_to) OR created_by = user_id)
    ),
    'pending_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'pending'
      AND (user_role IN ('admin', 'accountant') OR user_id = ANY(assigned_to) OR created_by = user_id)
    ),
    'in_progress_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'in_progress'
      AND (user_role IN ('admin', 'accountant') OR user_id = ANY(assigned_to) OR created_by = user_id)
    ),
    'completed_this_week', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'completed'
      AND completed_at >= date_trunc('week', CURRENT_DATE)
      AND (user_role IN ('admin', 'accountant') OR user_id = ANY(assigned_to) OR created_by = user_id)
    ),
    'open_tasks', (
      SELECT COUNT(*) FROM tasks
      WHERE status NOT IN ('completed', 'cancelled')
      AND (user_role = 'admin' OR assigned_to = user_id OR created_by = user_id)
    ),
    'overdue_tasks', (
      SELECT COUNT(*) FROM tasks
      WHERE due_date < CURRENT_DATE
      AND status NOT IN ('completed', 'cancelled')
      AND (user_role = 'admin' OR assigned_to = user_id OR created_by = user_id)
    ),
    'total_customers', (SELECT COUNT(*) FROM customers),
    'user_role', user_role
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- ============================================
-- 2. get_today_schedule()
-- ============================================
-- work_orders -> customer_sites -> customers; work_type as type, description/form_no as title

CREATE OR REPLACE FUNCTION get_today_schedule()
RETURNS TABLE (
  id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  type TEXT,
  status TEXT,
  scheduled_time TIME,
  title TEXT,
  priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := COALESCE(get_my_role(), 'field_worker');

  RETURN QUERY
  SELECT
    wo.id,
    c.company_name AS customer_name,
    COALESCE(s.contact_phone, c.phone) AS customer_phone,
    s.address AS customer_address,
    wo.work_type AS type,
    wo.status,
    wo.scheduled_time,
    COALESCE(wo.description, wo.form_no, '')::TEXT AS title,
    wo.priority
  FROM work_orders wo
  JOIN customer_sites s ON wo.site_id = s.id
  JOIN customers c ON s.customer_id = c.id
  WHERE wo.scheduled_date = CURRENT_DATE
  AND wo.status NOT IN ('completed', 'cancelled')
  AND (user_role IN ('admin', 'accountant') OR user_id = ANY(wo.assigned_to) OR wo.created_by = user_id)
  ORDER BY wo.scheduled_time NULLS LAST, wo.priority DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_schedule() TO authenticated;

-- ============================================
-- 3. get_my_pending_tasks(limit_count)
-- ============================================
-- tasks unchanged; work_orders joined via site -> customer for customer_name; work order title from description/form_no

CREATE OR REPLACE FUNCTION get_my_pending_tasks(limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title TEXT,
  due_date DATE,
  priority TEXT,
  work_order_title TEXT,
  customer_name TEXT,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := COALESCE(get_my_role(), 'field_worker');

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.due_date,
    t.priority,
    (SELECT COALESCE(wo.description, wo.form_no, '')::TEXT
     FROM work_orders wo WHERE wo.id = t.work_order_id) AS work_order_title,
    (SELECT c.company_name
     FROM work_orders wo
     JOIN customer_sites s ON wo.site_id = s.id
     JOIN customers c ON s.customer_id = c.id
     WHERE wo.id = t.work_order_id) AS customer_name,
    (t.due_date < CURRENT_DATE) AS is_overdue
  FROM tasks t
  WHERE t.status NOT IN ('completed', 'cancelled')
  AND (user_role = 'admin' OR t.assigned_to = user_id OR t.created_by = user_id)
  ORDER BY
    t.due_date NULLS LAST,
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      ELSE 4
    END
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_tasks(INT) TO authenticated;
