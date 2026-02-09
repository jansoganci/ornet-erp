-- Migration: 00010_work_order_materials
-- Description: Create junction table for materials used in work orders

-- 1. Create Table
CREATE TABLE IF NOT EXISTS work_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint (same material can't be added twice to same work order)
  UNIQUE(work_order_id, material_id)
);

-- 2. Indexes
CREATE INDEX idx_wo_materials_wo_id ON work_order_materials(work_order_id);
CREATE INDEX idx_wo_materials_material_id ON work_order_materials(material_id);

-- 3. RLS
ALTER TABLE work_order_materials ENABLE ROW LEVEL SECURITY;

-- SELECT: Link to work_orders policy
CREATE POLICY "wo_materials_select"
  ON work_order_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_materials.work_order_id
      AND (
        get_my_role() IN ('admin', 'accountant')
        OR auth.uid() = ANY(wo.assigned_to)
        OR wo.created_by = auth.uid()
      )
    )
  );

-- INSERT
CREATE POLICY "wo_materials_insert"
  ON work_order_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_materials.work_order_id
      AND (
        get_my_role() = 'admin'
        OR auth.uid() = ANY(wo.assigned_to)
        OR wo.created_by = auth.uid()
      )
    )
  );

-- UPDATE
CREATE POLICY "wo_materials_update"
  ON work_order_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_materials.work_order_id
      AND (
        get_my_role() = 'admin'
        OR auth.uid() = ANY(wo.assigned_to)
        OR wo.created_by = auth.uid()
      )
    )
  );

-- DELETE
CREATE POLICY "wo_materials_delete"
  ON work_order_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_materials.work_order_id
      AND (
        get_my_role() = 'admin'
        OR auth.uid() = ANY(wo.assigned_to)
        OR wo.created_by = auth.uid()
      )
    )
  );
