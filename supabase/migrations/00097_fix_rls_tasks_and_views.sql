-- Migration: 00097_fix_rls_tasks_and_views
-- Description: Fix two layered security bugs in the tasks module.
--
-- Bug 1 (Policy): 00080_soft_delete_tasks.sql overwrote tasks_select and
--   tasks_update with policies referencing non-existent roles ('manager', 'office')
--   and silently dropped the 'created_by = auth.uid()' condition. This left
--   accountants unable to see any tasks, and field_workers unable to see tasks
--   they created but didn't assign to themselves.
--
-- Bug 2 (View): tasks_with_details is owned by postgres (security definer).
--   Querying through the view bypasses RLS on the tasks table entirely, making
--   all tasks visible to all authenticated users regardless of policy.
--
-- Role model implemented:
--   admin      → all non-deleted tasks (full CRUD)
--   accountant → all non-deleted tasks (read + can create/update own)
--   field_worker → only tasks where assigned_to = auth.uid() OR created_by = auth.uid()
--
-- Note: v_active_notifications is intentionally NOT changed to security_invoker.
--   It already filters by get_my_role() IN ('admin', 'accountant') at the view
--   level and switching to security_invoker would break accountant reminders.

-- ============================================================================
-- 1. FIX tasks_select POLICY
-- ============================================================================
-- Drop the broken policy from 00080 (which references 'manager', 'office')
-- and the original from 00004. Recreate correctly.

DROP POLICY IF EXISTS tasks_select ON tasks;

CREATE POLICY tasks_select ON tasks
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      get_my_role() IN ('admin', 'accountant')   -- L1 and L2 see everything
      OR assigned_to = auth.uid()                -- L3 sees their assigned tasks
      OR created_by  = auth.uid()                -- L3 sees tasks they created
    )
  );

-- ============================================================================
-- 2. FIX tasks_update POLICY
-- ============================================================================
-- admin: can update any task
-- accountant: can update tasks they are assigned to or created
-- field_worker: same as accountant — only their own tasks
-- No role can update a soft-deleted task.

DROP POLICY IF EXISTS tasks_update ON tasks;

CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      get_my_role() = 'admin'
      OR assigned_to = auth.uid()
      OR created_by  = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR assigned_to = auth.uid()
    OR created_by  = auth.uid()
  );

-- ============================================================================
-- 3. FIX tasks_insert POLICY
-- ============================================================================
-- Original 00004 policy was WITH CHECK (true) — any authenticated user.
-- Recreate explicitly so it survives future policy drops cleanly.

DROP POLICY IF EXISTS tasks_insert ON tasks;

CREATE POLICY tasks_insert ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- all roles can create tasks

-- ============================================================================
-- 4. FIX tasks_delete POLICY
-- ============================================================================
-- Only admin can hard-delete. Field workers use soft-delete (tasks_update above).
-- Recreate for clarity.

DROP POLICY IF EXISTS tasks_delete_admin ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;

CREATE POLICY tasks_delete ON tasks
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================================
-- 5. SET security_invoker ON tasks_with_details VIEW
-- ============================================================================
-- With security_invoker = on, the view executes with the calling user's
-- permissions rather than the postgres superuser's. This means the RLS
-- policies defined above (steps 1-4) will apply when any code queries
-- through this view — closing the bypass entirely.

ALTER VIEW tasks_with_details SET (security_invoker = on);
