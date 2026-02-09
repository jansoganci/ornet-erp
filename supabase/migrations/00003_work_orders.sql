-- Migration: 00003_work_orders
-- Description: Create work_orders table (servis/montaj)
-- Single-tenant CRM - Role-based access control

-- ============================================
-- 1. WORK ORDERS TABLE
-- ============================================

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to customer
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  -- Work type and status
  type TEXT NOT NULL CHECK (type IN ('service', 'installation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),

  -- Work details
  title TEXT,                           -- Short description
  description TEXT,                     -- Detailed description

  -- Technical details (from your requirements)
  panel_number TEXT,                    -- Ekran/panel numarası
  materials TEXT,                       -- Used materials (free text for MVP)

  -- Financial
  amount DECIMAL(12, 2),                -- Tutar (TL)
  currency TEXT DEFAULT 'TRY',          -- Currency code

  -- Notes and files
  notes TEXT,                           -- Internal notes

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- ============================================
-- 2. INDEXES
-- ============================================

-- Foreign key indexes
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX idx_work_orders_created_by ON work_orders(created_by);

-- Status and type filtering
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_type ON work_orders(type);

-- Date-based queries (for dashboard, calendar)
CREATE INDEX idx_work_orders_scheduled ON work_orders(scheduled_date, scheduled_time);
CREATE INDEX idx_work_orders_created ON work_orders(created_at DESC);

-- Composite index for common queries: assigned + status
CREATE INDEX idx_work_orders_assigned_status ON work_orders(assigned_to, status);

-- ============================================
-- 3. UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. AUTO-SET COMPLETED_AT
-- ============================================

CREATE OR REPLACE FUNCTION set_work_order_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set completed_at when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;

  -- Set cancelled_at when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
  END IF;

  -- Clear timestamps if status reverts
  IF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;

  IF NEW.status != 'cancelled' THEN
    NEW.cancelled_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_status_change
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_work_order_completed_at();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Admin/Accountant: see all
-- Field worker: see only assigned work orders

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- SELECT: Admin and Accountant see all, Field workers see assigned only
CREATE POLICY "work_orders_select"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'accountant')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- INSERT: All authenticated can create work orders
CREATE POLICY "work_orders_insert"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Admin can update all, others can update assigned
CREATE POLICY "work_orders_update"
  ON work_orders FOR UPDATE
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
CREATE POLICY "work_orders_delete_admin"
  ON work_orders FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================
-- 6. VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Work orders with customer name (for lists)
CREATE VIEW work_orders_with_customer AS
SELECT
  wo.*,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.address AS customer_address,
  p.full_name AS assigned_to_name
FROM work_orders wo
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN profiles p ON wo.assigned_to = p.id;

-- Grant access to the view
GRANT SELECT ON work_orders_with_customer TO authenticated;
