-- Tabbed list pages: computed status_rank on work_orders_detail for server-side sort
-- (in_progress → pending → scheduled) when filtering the active tab in fetchWorkOrdersPaginated.

DROP VIEW IF EXISTS work_orders_detail CASCADE;

CREATE VIEW work_orders_detail AS
SELECT
  wo.id,
  wo.site_id,
  wo.form_no,
  wo.work_type,
  wo.work_type_other,
  wo.status,
  CASE wo.status
    WHEN 'in_progress' THEN 0
    WHEN 'pending'     THEN 1
    WHEN 'scheduled'   THEN 2
    WHEN 'completed'   THEN 3
    WHEN 'cancelled'   THEN 4
    ELSE 5
  END AS status_rank,
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
  c.id       AS customer_id,
  c.company_name,
  c.phone    AS customer_phone,
  -- Search columns
  c.company_name_search,
  s.account_no_search,
  wo.form_no_search,
  COALESCE(aw.assigned_workers, '[]'::json) AS assigned_workers,
  wo.proposal_id,
  wo.materials_discount_percent,
  wo.vat_rate,
  wo.has_tevkifat
FROM work_orders wo
JOIN  customer_sites s ON s.id = wo.site_id
JOIN  customers      c ON c.id = s.customer_id
LEFT JOIN LATERAL (
  SELECT
    json_agg(json_build_object('id', p.id, 'name', p.full_name)) AS assigned_workers
  FROM profiles p
  WHERE p.id = ANY(wo.assigned_to)
) aw ON true;

ALTER VIEW work_orders_detail SET (security_invoker = true);

GRANT SELECT ON work_orders_detail TO authenticated;

-- CASCADE drops functions that RETURN SETOF work_orders_detail — restore latest definitions (00194).

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

  IF v_role = 'field_worker' THEN
    RETURN QUERY
    SELECT * FROM work_orders_detail
    WHERE scheduled_date = target_date
      AND v_uid = ANY(assigned_to)
    ORDER BY scheduled_time ASC;

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

CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no'
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
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSIF search_type = 'company' THEN
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE company_name_search LIKE '%' || norm_query || '%'
          AND v_uid = ANY(assigned_to)
        ORDER BY scheduled_date DESC, created_at DESC;
    ELSE
      RETURN QUERY
        SELECT * FROM work_orders_detail
        WHERE (account_no_search LIKE '%' || norm_query || '%'
            OR company_name_search LIKE '%' || norm_query || '%')
          AND v_uid = ANY(assigned_to)
        ORDER BY scheduled_date DESC, created_at DESC;
    END IF;

  ELSE
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
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_work_list(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_work_history(text, text) TO authenticated;
