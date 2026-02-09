-- Migration: 00005_dashboard_functions
-- Description: Helper functions for dashboard statistics
-- Single-tenant CRM

-- ============================================
-- 1. DASHBOARD STATISTICS FUNCTION
-- ============================================
-- Returns counts for the dashboard cards

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
  user_role := get_my_role();

  SELECT json_build_object(
    -- Today's work orders
    'today_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE scheduled_date = CURRENT_DATE
      AND status NOT IN ('completed', 'cancelled')
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- Pending work orders
    'pending_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'pending'
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- In progress work orders
    'in_progress_work_orders', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'in_progress'
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- Completed this week
    'completed_this_week', (
      SELECT COUNT(*) FROM work_orders
      WHERE status = 'completed'
      AND completed_at >= date_trunc('week', CURRENT_DATE)
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- Open tasks
    'open_tasks', (
      SELECT COUNT(*) FROM tasks
      WHERE status NOT IN ('completed', 'cancelled')
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- Overdue tasks
    'overdue_tasks', (
      SELECT COUNT(*) FROM tasks
      WHERE due_date < CURRENT_DATE
      AND status NOT IN ('completed', 'cancelled')
      AND (user_role = 'admin' OR assigned_to = user_id)
    ),

    -- Total customers (admin only shows all, others see count)
    'total_customers', (
      SELECT COUNT(*) FROM customers
    ),

    -- User role for UI
    'user_role', user_role
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- ============================================
-- 2. TODAY'S SCHEDULE FUNCTION
-- ============================================
-- Returns today's work orders for the user

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
  user_role := get_my_role();

  RETURN QUERY
  SELECT
    wo.id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.address AS customer_address,
    wo.type,
    wo.status,
    wo.scheduled_time,
    wo.title,
    wo.priority
  FROM work_orders wo
  JOIN customers c ON wo.customer_id = c.id
  WHERE wo.scheduled_date = CURRENT_DATE
  AND wo.status NOT IN ('completed', 'cancelled')
  AND (user_role = 'admin' OR wo.assigned_to = user_id)
  ORDER BY wo.scheduled_time NULLS LAST, wo.priority DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_schedule() TO authenticated;

-- ============================================
-- 3. MY PENDING TASKS FUNCTION
-- ============================================

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
  user_role := get_my_role();

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.due_date,
    t.priority,
    wo.title AS work_order_title,
    c.name AS customer_name,
    (t.due_date < CURRENT_DATE) AS is_overdue
  FROM tasks t
  LEFT JOIN work_orders wo ON t.work_order_id = wo.id
  LEFT JOIN customers c ON wo.customer_id = c.id
  WHERE t.status NOT IN ('completed', 'cancelled')
  AND (user_role = 'admin' OR t.assigned_to = user_id)
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

-- ============================================
-- 4. CUSTOMER WORK HISTORY FUNCTION
-- ============================================
-- For customer detail page: get all work orders for a customer

CREATE OR REPLACE FUNCTION get_customer_work_history(p_customer_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
  status TEXT,
  title TEXT,
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  amount DECIMAL,
  assigned_to_name TEXT,
  materials TEXT,
  panel_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wo.id,
    wo.type,
    wo.status,
    wo.title,
    wo.scheduled_date,
    wo.completed_at,
    wo.amount,
    p.full_name AS assigned_to_name,
    wo.materials,
    wo.panel_number
  FROM work_orders wo
  LEFT JOIN profiles p ON wo.assigned_to = p.id
  WHERE wo.customer_id = p_customer_id
  ORDER BY wo.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_work_history(UUID) TO authenticated;
