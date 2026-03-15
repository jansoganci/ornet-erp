-- Migration: 00123_fix_get_daily_work_list_rls
-- Description: Add role-based filtering to get_daily_work_list() so that
--   field_workers are always restricted to their own work orders, regardless
--   of what worker_id parameter was passed. Previously, calling the function
--   with worker_id = NULL returned all work orders for the date to any caller.
--   admin / accountant retain the original behaviour (any worker_id, or all).

CREATE OR REPLACE FUNCTION public.get_daily_work_list(
  target_date DATE,
  worker_id   UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_uid  UUID;
BEGIN
  v_role := get_my_role();
  v_uid  := auth.uid();

  -- field_workers always see only their own work orders
  IF v_role = 'field_worker' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
      AND v_uid = ANY(assigned_to)
    ORDER BY scheduled_time ASC;

  -- admin / accountant: honour the passed worker_id or return all
  ELSE
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
  END IF;
END;
$$;
