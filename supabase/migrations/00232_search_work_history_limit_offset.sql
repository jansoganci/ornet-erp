-- Migration: 00232_search_work_history_limit_offset
-- B4: add LIMIT/OFFSET to search_work_history and keep role/date/site filters server-side.

DROP FUNCTION IF EXISTS public.search_work_history(text, text, uuid, date, date, text, uuid);

CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no',
  p_site_id    UUID DEFAULT NULL,
  p_date_from  DATE DEFAULT NULL,
  p_date_to    DATE DEFAULT NULL,
  p_work_type  TEXT DEFAULT NULL,
  p_worker_id  UUID DEFAULT NULL,
  p_limit      INTEGER DEFAULT 200,
  p_offset     INTEGER DEFAULT 0
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_uid      UUID;
  norm_query TEXT;
  v_limit    INTEGER;
  v_offset   INTEGER;
BEGIN
  v_role     := get_my_role();
  v_uid      := auth.uid();
  norm_query := normalize_tr_for_search(COALESCE(search_query, ''));

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
    SELECT *
    FROM work_orders_detail
    WHERE (
      (
        search_type = 'account_no' AND account_no_search LIKE '%' || norm_query || '%'
      )
      OR (
        search_type = 'company' AND company_name_search LIKE '%' || norm_query || '%'
      )
      OR (
        search_type NOT IN ('account_no', 'company')
        AND (
          account_no_search LIKE '%' || norm_query || '%'
          OR company_name_search LIKE '%' || norm_query || '%'
        )
      )
      )
      AND (p_site_id IS NULL OR site_id = p_site_id)
      AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
      AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
      AND (
        v_role IS DISTINCT FROM 'field_worker'
        OR (v_uid IS NOT NULL AND assigned_to IS NOT NULL AND v_uid = ANY(assigned_to))
      )
    ORDER BY scheduled_date DESC, created_at DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_work_history(
  text, text, uuid, date, date, text, uuid, integer, integer
) TO authenticated;
