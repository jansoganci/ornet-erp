-- 00083_soft_delete_work_orders.sql
-- Add soft delete support to work_orders table

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active work orders only
CREATE INDEX IF NOT EXISTS idx_work_orders_active
  ON work_orders (status, scheduled_date)
  WHERE deleted_at IS NULL;

-- Recreate select policy with deleted_at filter
-- work_orders_detail is security_invoker so RLS propagates through the view automatically
DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
CREATE POLICY "work_orders_select"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      get_my_role() IN ('admin', 'accountant')
      OR auth.uid() = ANY(assigned_to)
      OR created_by = auth.uid()
    )
  );

-- Recreate update policy with deleted_at filter
DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
CREATE POLICY "work_orders_update"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      get_my_role() = 'admin'
      OR auth.uid() = ANY(assigned_to)
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR auth.uid() = ANY(assigned_to)
    OR created_by = auth.uid()
  );
