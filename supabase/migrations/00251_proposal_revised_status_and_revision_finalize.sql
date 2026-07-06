-- 00251_proposal_revised_status_and_revision_finalize.sql
--
-- Phase 4.1
-- 1. Add proposals.status = 'revised'
-- 2. Finalize revision creation atomically: create new draft revision, then
--    mark the source accepted/completed proposal as revised
-- 3. Preserve completed_at and existing finance rows when completed proposals
--    become revised

BEGIN;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_status_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'cancelled', 'completed', 'revised'));

CREATE OR REPLACE FUNCTION public.set_proposal_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS proposal_status_change ON public.proposals;

CREATE TRIGGER proposal_status_change
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_proposal_completed_at();

CREATE OR REPLACE FUNCTION public.revise_proposal_package(
  p_source_proposal_id UUID,
  p_new_proposal JSONB DEFAULT '{}'::jsonb,
  p_sections JSONB DEFAULT '[]'::jsonb,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_annual_fixed_costs JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_new_proposal JSONB;
  v_new_proposal_id UUID;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot revise proposal package', v_role;
  END IF;

  IF p_source_proposal_id IS NULL THEN
    RAISE EXCEPTION 'source proposal id is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_new_proposal, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'p_new_proposal must be a JSON object';
  END IF;

  IF jsonb_typeof(COALESCE(p_sections, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_sections must be a JSON array';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  IF jsonb_typeof(COALESCE(p_annual_fixed_costs, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_annual_fixed_costs must be a JSON array';
  END IF;

  PERFORM 1
  FROM public.proposals p
  WHERE p.id = p_source_proposal_id
    AND p.deleted_at IS NULL
    AND p.status IN ('accepted', 'completed')
    AND NOT EXISTS (
      SELECT 1
      FROM public.proposals newer
      WHERE newer.revised_from_proposal_id = p.id
        AND newer.deleted_at IS NULL
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal % not found, not revisable, or already superseded', p_source_proposal_id;
  END IF;

  v_new_proposal := COALESCE(p_new_proposal, '{}'::jsonb)
    || jsonb_build_object(
      'status', 'draft',
      'revised_from_proposal_id', p_source_proposal_id
    );

  v_new_proposal_id := public.fn_save_proposal_package(
    NULL,
    v_new_proposal,
    p_sections,
    p_items,
    p_annual_fixed_costs
  );

  UPDATE public.proposals
  SET
    status = 'revised',
    updated_at = now()
  WHERE id = p_source_proposal_id
    AND deleted_at IS NULL;

  RETURN v_new_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revise_proposal_package(UUID, JSONB, JSONB, JSONB, JSONB) TO authenticated;

DROP TRIGGER IF EXISTS proposal_finance_reversal ON public.proposals;

CREATE TRIGGER proposal_finance_reversal
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  WHEN (OLD.status = 'completed' AND NEW.status NOT IN ('completed', 'revised'))
  EXECUTE FUNCTION public.reverse_proposal_finance_entries();

COMMIT;

-- REVERT
-- 1. Drop public.revise_proposal_package(UUID, JSONB, JSONB, JSONB, JSONB)
-- 2. Restore proposal_finance_reversal trigger WHEN clause from 00190
-- 3. Restore public.set_proposal_completed_at() body from 00189
-- 4. Restore proposals_status_check without 'revised'
