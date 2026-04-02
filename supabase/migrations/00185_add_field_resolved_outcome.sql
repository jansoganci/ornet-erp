-- 00185_add_field_resolved_outcome.sql
-- Allow outcome_type = 'field_resolved' (servis verildi / yerinde çözüm).
-- Idempotent: drop any CHECK referencing outcome_type, then add unified constraint.

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
      'work_order_cancelled',
      'field_resolved'
    )
  );
