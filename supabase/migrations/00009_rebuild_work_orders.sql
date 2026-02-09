-- Migration: 00009_rebuild_work_orders
-- Description: Modify work_orders table (add site_id, form_no, work_type, assigned_to[])
-- Part of Work Order System Implementation

-- 1. Drop existing views that depend on work_orders
-- work_orders_with_customer was already dropped in 00006, but adding here for safety
DROP VIEW IF EXISTS work_orders_with_customer CASCADE;
-- tasks_with_details depends on work_orders.customer_id
DROP VIEW IF EXISTS tasks_with_details CASCADE;

-- 2. Drop existing policies to avoid conflicts during modification
DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
DROP POLICY IF EXISTS "work_orders_delete_admin" ON work_orders;

-- 3. Modify columns
-- Add site_id (will replace customer_id eventually)
ALTER TABLE work_orders ADD COLUMN site_id UUID REFERENCES customer_sites(id) ON DELETE RESTRICT;

-- Add form_no
ALTER TABLE work_orders ADD COLUMN form_no TEXT;

-- Add work_type (replacing 'type')
-- We'll use the new types: 'kesif', 'montaj', 'servis', 'bakim', 'diger'
ALTER TABLE work_orders ADD COLUMN work_type TEXT CHECK (work_type IN ('kesif', 'montaj', 'servis', 'bakim', 'diger'));
ALTER TABLE work_orders ADD COLUMN work_type_other TEXT; -- For 'diger' description

-- Add assigned_to array (replacing single assigned_to)
ALTER TABLE work_orders ADD COLUMN assigned_to_new UUID[] DEFAULT '{}';

-- 4. Data Migration (if any existing data)
-- This is a fresh implementation, but we'll map existing 'type' to 'work_type' just in case
UPDATE work_orders SET 
  work_type = CASE 
    WHEN type = 'service' THEN 'servis'
    WHEN type = 'installation' THEN 'montaj'
    ELSE 'servis'
  END,
  assigned_to_new = ARRAY[assigned_to] 
WHERE assigned_to IS NOT NULL;

-- 5. Finalize column changes
-- Remove old columns
ALTER TABLE work_orders DROP COLUMN IF EXISTS type;
ALTER TABLE work_orders DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE work_orders DROP COLUMN IF EXISTS customer_id; -- Now linked via site_id
ALTER TABLE work_orders DROP COLUMN IF EXISTS materials;   -- Moving to junction table
ALTER TABLE work_orders DROP COLUMN IF EXISTS title;       -- Description is enough
ALTER TABLE work_orders DROP COLUMN IF EXISTS panel_number; -- Moving to customer_sites.panel_info

-- Rename new columns to final names
ALTER TABLE work_orders RENAME COLUMN assigned_to_new TO assigned_to;

-- 6. Re-create RLS policies
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- SELECT: Admin and Accountant see all, Field workers see assigned only
CREATE POLICY "work_orders_select"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'accountant')
    OR auth.uid() = ANY(assigned_to)
    OR created_by = auth.uid()
  );

-- INSERT: All authenticated can create
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
    OR auth.uid() = ANY(assigned_to)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR auth.uid() = ANY(assigned_to)
    OR created_by = auth.uid()
  );

-- DELETE: Only admin
CREATE POLICY "work_orders_delete_admin"
  ON work_orders FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- 7. Update Indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_site ON work_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_array ON work_orders USING GIN (assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_work_type ON work_orders(work_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_form_no ON work_orders(form_no);
