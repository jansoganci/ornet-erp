-- Migration: 00011_views_and_functions
-- Description: Create views and helper functions for Work Order System
-- Part of Work Order System Implementation

-- 1. Work Orders Detail View
-- Provides a comprehensive view of work orders with joined site and customer data
CREATE OR REPLACE VIEW work_orders_detail AS
SELECT
  wo.id,
  wo.site_id,
  wo.form_no,
  wo.work_type,
  wo.work_type_other,
  wo.status,
  wo.priority,
  wo.scheduled_date,
  wo.scheduled_time,
  wo.assigned_to,
  wo.description,
  wo.notes,
  wo.amount,
  wo.currency,
  wo.created_by,
  wo.created_at,
  wo.updated_at,
  wo.completed_at,
  wo.cancelled_at,
  -- Site info
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  -- Customer info
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  -- Assigned workers as JSON array of objects
  (
    SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.full_name)), '[]'::json)
    FROM profiles p
    WHERE p.id = ANY(wo.assigned_to)
  ) AS assigned_workers
FROM work_orders wo
JOIN customer_sites s ON wo.site_id = s.id
JOIN customers c ON s.customer_id = c.id;

-- Grant access to the view
GRANT SELECT ON work_orders_detail TO authenticated;

-- 2. Search Work History Function
-- Helper for searching work history by account_no or company_name
CREATE OR REPLACE FUNCTION search_work_history(
  search_query TEXT,
  search_type TEXT DEFAULT 'account_no' -- 'account_no' or 'company'
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF search_type = 'account_no' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no ILIKE '%' || search_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSIF search_type = 'company' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE company_name ILIKE '%' || search_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSE
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no ILIKE '%' || search_query || '%'
       OR company_name ILIKE '%' || search_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  END IF;
END;
$$;

-- 3. Daily Work List Function
-- Helper for fetching work list for a specific date and optional worker
CREATE OR REPLACE FUNCTION get_daily_work_list(
  target_date DATE,
  worker_id UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF worker_id IS NULL THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
    ORDER BY scheduled_time ASC;
  ELSE
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
      AND worker_id = ANY(assigned_to)
    ORDER BY scheduled_time ASC;
  END IF;
END;
$$;
