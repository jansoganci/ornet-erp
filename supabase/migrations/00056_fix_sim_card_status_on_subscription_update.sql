-- Migration: 00056_fix_sim_card_status_on_subscription_update
-- Description: Fix SIM status when sim_card_id is added/changed on subscription UPDATE.
-- The previous trigger only handled status changes (cancel/reactivate), not sim_card_id assignment.

CREATE OR REPLACE FUNCTION fn_subscription_sim_status_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Handle status changes (cancel -> inactive, reactivate -> subscription)
  IF NEW.sim_card_id IS NOT NULL THEN
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
      UPDATE sim_cards SET status = 'inactive' WHERE id = NEW.sim_card_id;
    ELSIF NEW.status = 'active' AND OLD.status = 'cancelled' THEN
      UPDATE sim_cards SET status = 'subscription' WHERE id = NEW.sim_card_id;
    END IF;
  END IF;

  -- 2. Handle sim_card_id added or changed (subscription active/paused)
  IF NEW.status IN ('active', 'paused') THEN
    IF NEW.sim_card_id IS NOT NULL AND (OLD.sim_card_id IS NULL OR OLD.sim_card_id <> NEW.sim_card_id) THEN
      -- Set new SIM to subscription
      UPDATE sim_cards
      SET status = 'subscription',
          customer_id = (SELECT customer_id FROM customer_sites WHERE id = NEW.site_id),
          site_id = NEW.site_id
      WHERE id = NEW.sim_card_id;
      -- Set old SIM back to available if it was unlinked
      IF OLD.sim_card_id IS NOT NULL AND OLD.sim_card_id <> NEW.sim_card_id THEN
        UPDATE sim_cards
        SET status = 'available', customer_id = NULL, site_id = NULL
        WHERE id = OLD.sim_card_id;
      END IF;
    ELSIF NEW.sim_card_id IS NULL AND OLD.sim_card_id IS NOT NULL THEN
      -- SIM was unlinked
      UPDATE sim_cards
      SET status = 'available', customer_id = NULL, site_id = NULL
      WHERE id = OLD.sim_card_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix existing subscriptions that have sim_card_id but SIM is still available
UPDATE sim_cards sc
SET status = 'subscription',
    customer_id = (SELECT customer_id FROM customer_sites WHERE id = s.site_id),
    site_id = s.site_id
FROM subscriptions s
WHERE s.sim_card_id = sc.id
  AND s.status IN ('active', 'paused')
  AND sc.status = 'available';
