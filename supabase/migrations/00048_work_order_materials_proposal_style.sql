-- Migration: 00048_work_order_materials_proposal_style
-- Description: Extend work_order_materials to match proposal_items structure (description, unit, unit_price_usd, cost_usd)
-- and add materials_discount_percent to work_orders.

-- ============================================================
-- 1. work_order_materials: Add new columns
-- ============================================================
ALTER TABLE work_order_materials
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'adet',
  ADD COLUMN IF NOT EXISTS unit_price_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Backfill description and unit for existing rows
-- ============================================================
UPDATE work_order_materials wom
SET
  description = COALESCE(m.name, ''),
  unit = COALESCE(m.unit, 'adet')
FROM materials m
WHERE wom.material_id = m.id;

-- Rows without material (shouldn't exist yet, but safety)
UPDATE work_order_materials
SET description = COALESCE(description, '')
WHERE description IS NULL OR description = '';

-- ============================================================
-- 3. Make description NOT NULL (after backfill)
-- ============================================================
ALTER TABLE work_order_materials
  ALTER COLUMN description SET NOT NULL;

-- ============================================================
-- 4. Drop UNIQUE(work_order_id, material_id) constraint
-- ============================================================
ALTER TABLE work_order_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_work_order_id_material_id_key;

-- ============================================================
-- 5. Make material_id nullable
-- ============================================================
ALTER TABLE work_order_materials
  ALTER COLUMN material_id DROP NOT NULL;

-- Update FK to SET NULL on delete (for when material is deleted)
ALTER TABLE work_order_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_material_id_fkey;
ALTER TABLE work_order_materials
  ADD CONSTRAINT work_order_materials_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;

-- ============================================================
-- 6. Change quantity from INTEGER to DECIMAL(10,2)
-- ============================================================
ALTER TABLE work_order_materials
  ALTER COLUMN quantity TYPE DECIMAL(10,2) USING quantity::DECIMAL(10,2);

-- Drop old CHECK and add new one for positive
ALTER TABLE work_order_materials DROP CONSTRAINT IF EXISTS work_order_materials_quantity_check;
ALTER TABLE work_order_materials
  ADD CONSTRAINT work_order_materials_quantity_check CHECK (quantity > 0);

-- ============================================================
-- 7. work_orders: Add materials_discount_percent
-- ============================================================
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS materials_discount_percent DECIMAL(5,2) DEFAULT 0;

-- ============================================================
-- 8. work_orders_detail view: Add materials_discount_percent at end
-- (Adding in middle causes "cannot change name of view column" error)
-- ============================================================
CREATE OR REPLACE VIEW work_orders_detail AS
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
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  (
    SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.full_name)), '[]'::json)
    FROM profiles p
    WHERE p.id = ANY(wo.assigned_to)
  ) AS assigned_workers,
  wo.proposal_id,
  wo.materials_discount_percent
FROM work_orders wo
JOIN customer_sites s ON wo.site_id = s.id
JOIN customers c ON s.customer_id = c.id;

GRANT SELECT ON work_orders_detail TO authenticated;
