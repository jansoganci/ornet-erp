-- Migration: 00004_tasks
-- Description: Create tasks table (yapilacak isler)
-- Single-tenant CRM - Role-based access control

-- ============================================
-- 1. TASKS TABLE
-- ============================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task content
  title TEXT NOT NULL,
  description TEXT,

  -- Status and priority
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),

  -- Optional link to work order
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,

  -- Scheduling
  due_date DATE,
  due_time TIME,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 2. INDEXES
-- ============================================

-- Assignment index (most common query)
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

-- Status filtering
CREATE INDEX idx_tasks_status ON tasks(status);

-- Due date sorting (for today's tasks)
CREATE INDEX idx_tasks_due ON tasks(due_date);

-- Work order link
CREATE INDEX idx_tasks_work_order ON tasks(work_order_id) WHERE work_order_id IS NOT NULL;

-- Composite: assigned + status (for "my pending tasks")
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);

-- Composite: due date + status (for overdue tasks)
CREATE INDEX idx_tasks_due_status ON tasks(due_date, status) WHERE status != 'completed';

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set completed_at
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;

  IF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_status_change
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Admin: see all tasks
-- Field worker: see only assigned tasks

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: Admin sees all, others see assigned or created
CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- INSERT: All authenticated can create tasks
CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Admin can update all, others can update assigned/created
CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- DELETE: Only admin can delete
CREATE POLICY "tasks_delete_admin"
  ON tasks FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================
-- 5. VIEW FOR TASK LIST
-- ============================================

CREATE VIEW tasks_with_details AS
SELECT
  t.*,
  p.full_name AS assigned_to_name,
  wo.title AS work_order_title,
  c.name AS customer_name
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
LEFT JOIN work_orders wo ON t.work_order_id = wo.id
LEFT JOIN customers c ON wo.customer_id = c.id;

GRANT SELECT ON tasks_with_details TO authenticated;
