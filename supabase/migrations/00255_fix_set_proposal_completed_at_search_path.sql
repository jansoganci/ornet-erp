-- 00255_fix_set_proposal_completed_at_search_path.sql
--
-- Batch A4: restore fixed search_path on set_proposal_completed_at.
-- Regression: 00206 set search_path = public; 00251 recreated the function
-- without that clause. Behavior unchanged (completed_at still set/cleared
-- the same way, including revised status preservation from 00251).

BEGIN;

CREATE OR REPLACE FUNCTION public.set_proposal_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at := now();
  ELSIF OLD.status = 'completed' AND NEW.status NOT IN ('completed', 'revised') THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
