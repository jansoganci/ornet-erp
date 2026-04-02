-- 00184_sync_work_order_to_operations.sql
-- When a work order linked from Operations completes or is cancelled, sync the parent operations_items row.
-- operations_items.status has no 'cancelled' value (v2 model): use status = 'closed' with outcome_type.
--
-- Lock ordering: take work_orders BEFORE operations_items to reduce deadlock risk (40P01).

LOCK TABLE public.work_orders IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.operations_items IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname::text AS conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.operations_items'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%outcome_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.operations_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.operations_items
  ADD CONSTRAINT operations_items_outcome_type_check
  CHECK (
    outcome_type IS NULL
    OR outcome_type IN (
      'work_order',
      'proposal',
      'remote_resolved',
      'closed_no_action',
      'cancelled',
      'completed_via_work_order',
      'work_order_cancelled'
    )
  );

CREATE OR REPLACE FUNCTION public.fn_sync_work_order_to_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.operations_items
    SET
      status        = 'closed',
      outcome_type  = 'completed_via_work_order',
      updated_at    = now()
    WHERE work_order_id = NEW.id
      AND deleted_at IS NULL;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.operations_items
    SET
      status        = 'closed',
      outcome_type  = 'work_order_cancelled',
      updated_at    = now()
    WHERE work_order_id = NEW.id
      AND deleted_at IS NULL;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_sync_work_order_to_operations() IS
  'After work_orders status -> completed/cancelled, closes linked operations_items (SECURITY DEFINER for RLS).';

DROP TRIGGER IF EXISTS trg_sync_work_order_to_operations ON public.work_orders;
CREATE TRIGGER trg_sync_work_order_to_operations
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_work_order_to_operations();
