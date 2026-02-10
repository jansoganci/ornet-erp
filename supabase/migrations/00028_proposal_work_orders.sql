-- Migration: Phase 2 — Proposal ↔ Work Order Bridge
-- Tables: proposal_work_orders (junction)
-- Columns: work_orders.proposal_id (convenience FK)
-- Trigger: check_proposal_completion()
-- Views: updated proposals_detail, updated work_orders_detail

-- ============================================================
-- 1. Junction Table: proposal_work_orders
-- ============================================================
CREATE TABLE proposal_work_orders (
  proposal_id    UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  work_order_id  UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, work_order_id)
);

-- ============================================================
-- 2. Convenience FK on work_orders
-- ============================================================
ALTER TABLE work_orders ADD COLUMN proposal_id UUID REFERENCES proposals(id);

-- ============================================================
-- 3. RLS: proposal_work_orders
-- ============================================================
ALTER TABLE proposal_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal_work_orders"
    ON proposal_work_orders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage proposal_work_orders"
    ON proposal_work_orders FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'accountant')
        )
    );

-- ============================================================
-- 4. Add 'completed' to proposals status CHECK constraint
-- ============================================================
-- The trigger will set status to 'completed' when all WOs are done.
-- We need to allow this value in the CHECK constraint.
ALTER TABLE proposals DROP CONSTRAINT proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
    CHECK (status IN ('draft','sent','accepted','rejected','cancelled','completed'));

-- ============================================================
-- 5. Trigger: check_proposal_completion()
-- When the last work order linked to a proposal is marked 'completed',
-- auto-update the proposal status from 'accepted' to 'completed'.
-- ============================================================
CREATE OR REPLACE FUNCTION check_proposal_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prop_id UUID;
  all_done BOOLEAN;
BEGIN
  -- Only fire when a work order transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT pwo.proposal_id INTO prop_id
      FROM proposal_work_orders pwo
      WHERE pwo.work_order_id = NEW.id
      LIMIT 1;

    IF prop_id IS NOT NULL THEN
      SELECT bool_and(wo.status = 'completed') INTO all_done
        FROM proposal_work_orders pwo
        JOIN work_orders wo ON wo.id = pwo.work_order_id
        WHERE pwo.proposal_id = prop_id;

      IF all_done THEN
        UPDATE proposals SET status = 'completed' WHERE id = prop_id AND status = 'accepted';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_proposal_completion
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_proposal_completion();

-- ============================================================
-- 6. Update proposals_detail view
-- Add work_order_count and all_installations_complete
-- ============================================================
CREATE OR REPLACE VIEW proposals_detail AS
SELECT
  p.*,
  cs.site_name,
  cs.address AS site_address,
  cs.account_no,
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
JOIN customer_sites cs ON cs.id = p.site_id
JOIN customers c ON c.id = cs.customer_id;

-- ============================================================
-- 7. Update work_orders_detail view
-- Add proposal_id for quick lookups
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
  -- Site info
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  -- Customer info
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  -- Assigned workers as JSON array of objects
  (
    SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.full_name)), '[]'::json)
    FROM profiles p
    WHERE p.id = ANY(wo.assigned_to)
  ) AS assigned_workers,
  -- New: proposal link (appended at end for CREATE OR REPLACE compatibility)
  wo.proposal_id
FROM work_orders wo
JOIN customer_sites s ON wo.site_id = s.id
JOIN customers c ON s.customer_id = c.id;

-- Grant access to new table and updated views
GRANT SELECT ON proposal_work_orders TO authenticated;
GRANT SELECT ON proposals_detail TO authenticated;
GRANT SELECT ON work_orders_detail TO authenticated;
