-- 00080_soft_delete_tasks.sql
-- Add soft delete support to tasks table

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active tasks only
CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON tasks (status, due_date)
  WHERE deleted_at IS NULL;

-- Recreate tasks_select policy with deleted_at filter
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
      OR assigned_to = auth.uid()
    )
  );

-- Recreate tasks_update policy with deleted_at filter
DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
      OR assigned_to = auth.uid()
    )
  );
