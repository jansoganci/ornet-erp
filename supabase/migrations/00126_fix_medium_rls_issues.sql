-- Migration: 00126_fix_medium_rls_issues
-- Description: Fix all 5 MEDIUM-severity RLS issues identified in docs/RLS-AUDIT.md.
--
-- MED-1: customers + customer_sites — restrict INSERT+UPDATE to admin+accountant
-- MED-2: audit_logs — restrict INSERT to admin only (all real writes go through
--         SECURITY DEFINER functions which bypass RLS, so this is safe)
-- MED-3: work_order_assets — add missing UPDATE policy
-- MED-4: sim_static_ips — add missing DELETE policy
-- MED-5: search_work_history() — add field_worker scope filter (SECURITY DEFINER
--         bypasses security_invoker on the view, so the filter must live in the fn)

-- ============================================================================
-- MED-1a: customers INSERT + UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "customers_insert_authenticated" ON customers;
CREATE POLICY "customers_insert_authenticated" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "customers_update_authenticated" ON customers;
CREATE POLICY "customers_update_authenticated" ON customers
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- ============================================================================
-- MED-1b: customer_sites INSERT + UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "customer_sites_insert_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_insert_authenticated" ON customer_sites
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "customer_sites_update_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_update_authenticated" ON customer_sites
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- ============================================================================
-- MED-2: audit_logs INSERT
-- All legitimate writes to audit_logs happen inside SECURITY DEFINER functions
-- (00024, 00098, 00111, 00113, 00117, 00122) which run as postgres and bypass
-- RLS entirely. Restricting this policy only blocks direct rogue inserts.
-- ============================================================================

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================================
-- MED-3: work_order_assets — missing UPDATE policy
-- Admin/accountant: any row. Field_worker: only on their assigned work orders.
-- ============================================================================

CREATE POLICY woa_update ON work_order_assets
  FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin', 'accountant')
    OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_assets.work_order_id
        AND auth.uid() = ANY(wo.assigned_to)
    )
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'accountant')
    OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_assets.work_order_id
        AND auth.uid() = ANY(wo.assigned_to)
    )
  );

-- ============================================================================
-- MED-4: sim_static_ips — missing DELETE policy
-- ============================================================================

CREATE POLICY "sim_static_ips_delete" ON sim_static_ips
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================================
-- MED-5: search_work_history() — add field_worker scope filter
-- The function is SECURITY DEFINER so it runs as postgres and bypasses the
-- security_invoker guard on work_orders_detail. The filter must be explicit
-- inside the function body. Admin/accountant behaviour is unchanged.
-- ============================================================================

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
    -- field_worker: restrict results to work orders they are assigned to
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
    -- admin / accountant: full search, original behaviour
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

-- No new GRANT needed — existing grant from 00101 covers this signature.
