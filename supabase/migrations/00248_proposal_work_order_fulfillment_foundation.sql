-- 00248_proposal_work_order_fulfillment_foundation.sql
--
-- Foundation for proposal-linked fulfillment:
-- 1. Add proposal revision chain support.
-- 2. Add row lineage + source category support to work_order_materials.
-- 3. Disable legacy auto-completion of proposals from work-order completion.
-- 4. Keep proposal save semantics unchanged for now; revision persistence flow
--    will be implemented later without delete-reinsert lineage breakage.

BEGIN;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS revised_from_proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_revised_from_proposal_id
  ON public.proposals(revised_from_proposal_id);

ALTER TABLE public.work_order_materials
  ADD COLUMN IF NOT EXISTS proposal_item_id UUID REFERENCES public.proposal_items(id) ON DELETE SET NULL;

ALTER TABLE public.work_order_materials
  ADD COLUMN IF NOT EXISTS source_type TEXT;

UPDATE public.work_order_materials
SET source_type = 'legacy'
WHERE source_type IS NULL
   OR BTRIM(source_type) = '';

ALTER TABLE public.work_order_materials
  ALTER COLUMN source_type SET DEFAULT 'manual_extra';

ALTER TABLE public.work_order_materials
  ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE public.work_order_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_source_type_check;

ALTER TABLE public.work_order_materials
  ADD CONSTRAINT work_order_materials_source_type_check
  CHECK (source_type IN ('proposal_item', 'manual_extra', 'legacy'));

ALTER TABLE public.work_order_materials
  DROP CONSTRAINT IF EXISTS work_order_materials_source_lineage_check;

ALTER TABLE public.work_order_materials
  ADD CONSTRAINT work_order_materials_source_lineage_check
  CHECK (
    (source_type = 'proposal_item' AND proposal_item_id IS NOT NULL)
    OR (source_type IN ('manual_extra', 'legacy') AND proposal_item_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_work_order_materials_proposal_item_id
  ON public.work_order_materials(proposal_item_id);

CREATE INDEX IF NOT EXISTS idx_work_order_materials_source_type
  ON public.work_order_materials(source_type);

DROP TRIGGER IF EXISTS trg_check_proposal_completion ON public.work_orders;

COMMIT;

-- REVERT
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_check_proposal_completion ON public.work_orders;
-- CREATE TRIGGER trg_check_proposal_completion
--   AFTER UPDATE ON public.work_orders
--   FOR EACH ROW
--   EXECUTE FUNCTION public.check_proposal_completion();
-- DROP INDEX IF EXISTS idx_work_order_materials_source_type;
-- DROP INDEX IF EXISTS idx_work_order_materials_proposal_item_id;
-- ALTER TABLE public.work_order_materials DROP CONSTRAINT IF EXISTS work_order_materials_source_lineage_check;
-- ALTER TABLE public.work_order_materials DROP CONSTRAINT IF EXISTS work_order_materials_source_type_check;
-- ALTER TABLE public.work_order_materials DROP COLUMN IF EXISTS source_type;
-- ALTER TABLE public.work_order_materials DROP COLUMN IF EXISTS proposal_item_id;
-- DROP INDEX IF EXISTS idx_proposals_revised_from_proposal_id;
-- ALTER TABLE public.proposals DROP COLUMN IF EXISTS revised_from_proposal_id;
-- COMMIT;
