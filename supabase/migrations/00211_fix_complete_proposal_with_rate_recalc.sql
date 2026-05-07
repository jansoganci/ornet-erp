-- 00211_fix_complete_proposal_with_rate_recalc.sql
--
-- Problem: complete_proposal_with_rate sets status = 'completed' and the
-- auto_record_proposal_revenue trigger fires immediately after. That trigger
-- reads NEW.total_amount_usd to compute the finance entry. When the stored
-- value is 0 or NULL (stale data from before the sections feature, or items
-- saved without section linkage), the trigger silently skips the entire
-- finance entry — no error, no income row written.
--
-- Fix: before the status UPDATE, recompute total_amount_usd from
-- proposal_items.unit_price_usd * quantity (always set correctly by the app
-- at item-save time) and write it back when the stored value is zero/null.
-- The trigger then sees the correct non-zero value and writes finance entries.

CREATE OR REPLACE FUNCTION complete_proposal_with_rate(
  p_proposal_id    UUID,
  p_exchange_rate  DECIMAL,
  p_rate_suggested DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed_usd DECIMAL(12,2);
BEGIN
  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'exchange_rate must be greater than zero';
  END IF;

  -- Recompute USD total from items.
  -- Prefer the generated total_usd column when non-zero; fall back to
  -- unit_price_usd * quantity which is always set by the app at item-save time.
  SELECT COALESCE(
    SUM(COALESCE(NULLIF(pi.total_usd, 0), pi.unit_price_usd * pi.quantity)),
    0
  )
  INTO v_computed_usd
  FROM proposal_items pi
  WHERE pi.proposal_id = p_proposal_id;

  UPDATE proposals
  SET
    status                    = 'completed',
    completed_at              = now(),
    completed_by              = auth.uid(),
    completion_exchange_rate  = p_exchange_rate,
    completion_rate_suggested = p_rate_suggested,
    -- Heal stale zero/null total so the trigger can write finance entries.
    total_amount_usd          = CASE
                                  WHEN COALESCE(total_amount_usd, 0) <= 0
                                   AND v_computed_usd > 0
                                  THEN v_computed_usd
                                  ELSE total_amount_usd
                                END
  WHERE id         = p_proposal_id
    AND status     = 'accepted'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal % not found or not in accepted status', p_proposal_id;
  END IF;
END;
$$;
