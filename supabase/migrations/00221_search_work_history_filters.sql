-- Push work-history filters (site, date range, work type, worker) into search_work_history RPC.
-- Replaces 2-parameter overload; app no longer filters large RPC result sets in JavaScript.

DROP FUNCTION IF EXISTS public.search_work_history(text, text);

CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no',
  p_site_id    UUID DEFAULT NULL,
  p_date_from  DATE DEFAULT NULL,
  p_date_to    DATE DEFAULT NULL,
  p_work_type  TEXT DEFAULT NULL,
  p_worker_id  UUID DEFAULT NULL
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
BEGIN
  v_role     := get_my_role();
  v_uid      := auth.uid();
  norm_query := normalize_tr_for_search(search_query);

  IF v_role = 'field_worker' THEN
    IF search_type = 'account_no' THEN
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE account_no_search LIKE '%' || norm_query || '%'
          AND v_uid = ANY(assigned_to)
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSIF search_type = 'company' THEN
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE company_name_search LIKE '%' || norm_query || '%'
          AND v_uid = ANY(assigned_to)
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSE
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE (account_no_search LIKE '%' || norm_query || '%'
            OR company_name_search LIKE '%' || norm_query || '%')
          AND v_uid = ANY(assigned_to)
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    END IF;

  ELSE
    IF search_type = 'account_no' THEN
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE account_no_search LIKE '%' || norm_query || '%'
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSIF search_type = 'company' THEN
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE company_name_search LIKE '%' || norm_query || '%'
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSE
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE (account_no_search LIKE '%' || norm_query || '%'
            OR company_name_search LIKE '%' || norm_query || '%')
          AND (p_site_id IS NULL OR site_id = p_site_id)
          AND (p_date_from IS NULL OR scheduled_date >= p_date_from)
          AND (p_date_to IS NULL OR scheduled_date <= p_date_to)
          AND (p_work_type IS NULL OR work_type = p_work_type)
          AND (p_worker_id IS NULL OR (assigned_to IS NOT NULL AND p_worker_id = ANY(assigned_to)))
        ORDER BY scheduled_date DESC, created_at DESC;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_work_history(
  text, text, uuid, date, date, text, uuid
) TO authenticated;
