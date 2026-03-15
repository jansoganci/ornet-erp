-- Migration: PR-C3 — Enforce currency→null rule for proposal_items
-- When proposal.currency = 'TRY', all _usd columns must be null (DB-level guard).
-- Protects against direct REST API inserts that bypass app logic.

-- ============================================================
-- 1. Allow unit_price_usd to be null (required for TRY proposals)
-- ============================================================
ALTER TABLE proposal_items
  ALTER COLUMN unit_price_usd DROP NOT NULL;

-- ============================================================
-- 2. Trigger: Force _usd columns to null when proposal is TRY
-- ============================================================
CREATE OR REPLACE FUNCTION fn_proposal_items_currency_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  SELECT currency INTO v_currency
  FROM proposals
  WHERE id = NEW.proposal_id
  LIMIT 1;

  IF v_currency = 'TRY' THEN
    NEW.unit_price_usd := NULL;
    NEW.cost_usd := NULL;
    NEW.product_cost_usd := NULL;
    NEW.labor_cost_usd := NULL;
    NEW.shipping_cost_usd := NULL;
    NEW.material_cost_usd := NULL;
    NEW.misc_cost_usd := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_items_currency_guard ON proposal_items;
CREATE TRIGGER trg_proposal_items_currency_guard
  BEFORE INSERT OR UPDATE ON proposal_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_proposal_items_currency_guard();
