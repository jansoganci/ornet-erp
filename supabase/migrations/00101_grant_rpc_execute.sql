-- Migration: 00101_grant_rpc_execute
-- Description: Recreate get_daily_work_list and search_work_history (dropped by
-- 00100's DROP VIEW work_orders_detail CASCADE) and add GRANT EXECUTE.
-- Without these functions + grants, PostgREST returns 404 for RPC calls.

-- ============================================================================
-- 1. Recreate search_work_history (dropped by 00100 CASCADE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type TEXT DEFAULT 'account_no'
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_query text;
BEGIN
  norm_query := normalize_tr_for_search(search_query);

  IF search_type = 'account_no' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSIF search_type = 'company' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE company_name_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  ELSE
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE account_no_search LIKE '%' || norm_query || '%'
       OR company_name_search LIKE '%' || norm_query || '%'
    ORDER BY scheduled_date DESC, created_at DESC;
  END IF;
END;
$$;

-- ============================================================================
-- 2. Recreate get_daily_work_list (dropped by 00100 CASCADE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_daily_work_list(
  target_date DATE,
  worker_id UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- 3. Grant EXECUTE to authenticated (required for PostgREST RPC)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_daily_work_list(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_work_history(text, text) TO authenticated;
