-- Migration: 00100_optimize_work_orders_view
-- Description: Three-part optimization of work_orders_detail.
--
-- ── Problem 1: Correlated subquery (assigned_workers) ───────────────────────
-- The original view runs a sub-SELECT once per work_order row:
--
--   (SELECT json_agg(...) FROM profiles WHERE p.id = ANY(wo.assigned_to))
--
-- With security_invoker = true and a LIMIT clause the planner CAN prune this
-- to only the rows in the result set, but it cannot batch across rows — each
-- row gets its own profiles lookup.  A LATERAL join expresses the same intent
-- but gives the planner the freedom to choose hash/merge join strategies.
--
-- ── Problem 2: View recomputes stored generated columns ─────────────────────
-- 00092 added stored generated columns (company_name_search, account_no_search)
-- to customers and customer_sites.  The view was written before those columns
-- existed and still calls normalize_tr_for_search() inline.  The planner sees
-- a function call expression, not a column reference — it cannot push an index
-- predicate through a function call on a JOIN output.  Switching the view to
-- SELECT c.company_name_search / s.account_no_search directly lets the planner
-- treat them as plain column references and use indexes on the base tables.
--
-- ── Problem 3: No trigram indexes for ilike search ──────────────────────────
-- All three search columns (company_name_search, account_no_search,
-- form_no_search) are searched with ilike '%term%' — a leading-wildcard
-- pattern that a B-tree index cannot accelerate.  GIN + pg_trgm indexes turn
-- this from O(n) sequential scan into O(result_size) bitmap index scan.
-- pg_trgm was enabled in 00099.
--
-- ── Column guarantee ────────────────────────────────────────────────────────
-- Identical columns in identical order to 00092.  No frontend changes needed.

-- ============================================================================
-- 1. Add form_no_search as a stored generated column on work_orders
-- ============================================================================
-- The view was computing this inline; make it a real stored column so we can
-- index it and the planner can use the index when filtering through the view.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS form_no_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(form_no)) STORED;

-- ============================================================================
-- 2. Trigram indexes on the three search columns
-- ============================================================================
-- GIN + gin_trgm_ops makes ilike '%term%' fast at any scale.
-- All partial (WHERE deleted_at IS NULL) so soft-deleted rows are excluded.

CREATE INDEX IF NOT EXISTS idx_work_orders_form_no_search_trgm
  ON work_orders USING gin (form_no_search gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_company_name_search_trgm
  ON customers USING gin (company_name_search gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_sites_account_no_search_trgm
  ON customer_sites USING gin (account_no_search gin_trgm_ops);

-- ============================================================================
-- 3. Filter + sort indexes on work_orders
-- ============================================================================
-- These support the four server-side filter columns and the ORDER BY used in
-- fetchWorkOrders.  All partial on deleted_at IS NULL.

CREATE INDEX IF NOT EXISTS idx_work_orders_status
  ON work_orders (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_work_type
  ON work_orders (work_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_priority
  ON work_orders (priority)
  WHERE deleted_at IS NULL;

-- Descending index matches the ORDER BY scheduled_date DESC, created_at DESC
-- in fetchWorkOrders — avoids a sort step when no filter is applied.
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date_desc
  ON work_orders (scheduled_date DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. GIN index on assigned_to[] — used by the LATERAL join's ANY lookup
-- ============================================================================
-- `WHERE p.id = ANY(wo.assigned_to)` scans profiles by PK per row.
-- A GIN index on the array is used in the REVERSE direction
-- (e.g. WHERE 'uuid' = ANY(assigned_to)), and also helps the planner
-- plan the LATERAL join as a nested loop with index scan on profiles.

CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to_gin
  ON work_orders USING gin (assigned_to)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. Recreate work_orders_detail — LATERAL join + direct column references
-- ============================================================================

DROP VIEW IF EXISTS work_orders_detail CASCADE;

CREATE VIEW work_orders_detail AS
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
  c.id       AS customer_id,
  c.company_name,
  c.phone    AS customer_phone,
  -- Search columns — read stored generated columns directly so the planner
  -- can use the trigram indexes added above (Problem 2 fix).
  c.company_name_search,
  s.account_no_search,
  wo.form_no_search,
  -- Assigned workers — LATERAL join instead of correlated subquery (Problem 1 fix).
  -- Semantically identical output; planner can now choose join strategies.
  COALESCE(aw.assigned_workers, '[]'::json) AS assigned_workers,
  -- Remaining scalar columns
  wo.proposal_id,
  wo.materials_discount_percent
FROM work_orders wo
JOIN  customer_sites s ON s.id = wo.site_id
JOIN  customers      c ON c.id = s.customer_id
-- LATERAL: evaluated once per outer row, but expressed as a join so the
-- planner can use nested-loop + profiles PK index in a single pass.
LEFT JOIN LATERAL (
  SELECT
    json_agg(json_build_object('id', p.id, 'name', p.full_name)) AS assigned_workers
  FROM profiles p
  WHERE p.id = ANY(wo.assigned_to)
) aw ON true;

-- Keep security_invoker so RLS on work_orders propagates through the view.
-- The deleted_at IS NULL filter is enforced by the RLS policy, not the view.
ALTER VIEW work_orders_detail SET (security_invoker = true);

GRANT SELECT ON work_orders_detail TO authenticated;
