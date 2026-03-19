-- Migration: 00158_phase3_rental_proposal_site_assets_trigger
-- Phase 3 of Asset Tracking Refactor: Auto-upsert site_assets when rental
-- proposal's Installation Work Order is completed.

-- ============================================================================
-- TRIGGER: When rental proposal + installation WO completed → UPSERT site_assets
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_upsert_site_assets_from_rental_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id UUID;
  v_contract_type TEXT;
  v_site_id UUID;
  v_item RECORD;
  v_wo_type TEXT;
  v_install_date DATE;
BEGIN
  -- Only on transition to completed
  IF NEW.status <> 'completed' OR (OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;

  -- Must be installation work type
  v_wo_type := (SELECT work_type FROM work_orders WHERE id = NEW.id);
  IF v_wo_type <> 'installation' THEN
    RETURN NEW;
  END IF;

  -- Get proposal via proposal_work_orders
  SELECT pwo.proposal_id INTO v_proposal_id
  FROM proposal_work_orders pwo
  WHERE pwo.work_order_id = NEW.id
  LIMIT 1;

  IF v_proposal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check contract_type = rental and get site_id (proposal or work order)
  SELECT p.contract_type, COALESCE(p.site_id, NEW.site_id) INTO v_contract_type, v_site_id
  FROM proposals p
  WHERE p.id = v_proposal_id;

  IF v_contract_type <> 'rental' OR v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_install_date := COALESCE(NEW.completed_at::DATE, NEW.scheduled_date, CURRENT_DATE);

  -- Upsert from proposal_items: equipment_name = description, quantity = quantity
  FOR v_item IN
    SELECT
      TRIM(pi.description) AS equipment_name,
      GREATEST(1, (pi.quantity)::INTEGER) AS qty
    FROM proposal_items pi
    WHERE pi.proposal_id = v_proposal_id
      AND pi.description IS NOT NULL
      AND TRIM(pi.description) <> ''
      AND pi.quantity > 0
  LOOP
    INSERT INTO site_assets (site_id, equipment_name, quantity, installation_date)
    VALUES (v_site_id, v_item.equipment_name, v_item.qty, v_install_date)
    ON CONFLICT (site_id, equipment_name) DO UPDATE SET
      quantity = site_assets.quantity + EXCLUDED.quantity,
      installation_date = LEAST(COALESCE(site_assets.installation_date, EXCLUDED.installation_date), EXCLUDED.installation_date);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_upsert_site_assets_from_rental_proposal
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_upsert_site_assets_from_rental_proposal();

COMMENT ON FUNCTION fn_upsert_site_assets_from_rental_proposal() IS
  'When a rental proposal''s Installation WO is completed, upsert equipment quantities into site_assets from proposal_items.';
