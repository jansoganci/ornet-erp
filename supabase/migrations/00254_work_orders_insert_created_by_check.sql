-- 00254_work_orders_insert_created_by_check.sql
--
-- Batch A3 (docs/audit-reports/11 + 12): replace permissive work_orders_insert
-- WITH CHECK (true) with created_by = auth.uid().
--
-- Product rule: admin, accountant, and field_worker may all create work orders;
-- the insert row must be owned by the calling user (no forged created_by).
-- App already sets created_by in src/features/workOrders/api.js.

BEGIN;

DROP POLICY IF EXISTS "work_orders_insert" ON public.work_orders;

CREATE POLICY "work_orders_insert"
  ON public.work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMIT;
