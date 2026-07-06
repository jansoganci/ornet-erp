-- 00249_linked_work_order_safe_access_rpcs.sql
--
-- Safe access layer for proposal-linked work order creation.
-- Keeps proposal table RLS restrictive while allowing field workers to:
-- 1. browse selectable accepted/current proposals
-- 2. load proposal scope rows for linked work-order creation

BEGIN;

CREATE OR REPLACE FUNCTION public.get_selectable_linked_work_order_proposals()
RETURNS TABLE (
  id UUID,
  proposal_no TEXT,
  title TEXT,
  customer_company_name TEXT,
  company_name TEXT,
  site_name TEXT,
  customer_id UUID,
  site_id UUID,
  currency TEXT,
  vat_rate NUMERIC,
  has_tevkifat BOOLEAN,
  discount_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant', 'field_worker') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot read linked work-order proposals', COALESCE(v_role, 'unknown');
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.proposal_no,
    p.title,
    c.company_name AS customer_company_name,
    p.company_name,
    cs.site_name,
    c.id AS customer_id,
    p.site_id,
    p.currency,
    COALESCE(p.vat_rate, 0) AS vat_rate,
    COALESCE(p.has_tevkifat, false) AS has_tevkifat,
    COALESCE(p.discount_percent, 0) AS discount_percent
  FROM public.proposals p
  LEFT JOIN public.customer_sites cs ON cs.id = p.site_id
  LEFT JOIN public.customers c ON c.id = cs.customer_id
  WHERE p.deleted_at IS NULL
    AND p.status = 'accepted'
    AND p.site_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.proposals newer
      WHERE newer.revised_from_proposal_id = p.id
        AND newer.deleted_at IS NULL
    )
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_selectable_linked_work_order_proposals() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_linked_work_order_proposal_scope(
  p_proposal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_proposal RECORD;
  v_items JSONB := '[]'::JSONB;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant', 'field_worker') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot read linked work-order proposal scope', COALESCE(v_role, 'unknown');
  END IF;

  SELECT
    p.id,
    p.proposal_no,
    p.title,
    p.site_id,
    c.id AS customer_id,
    c.company_name AS customer_company_name,
    p.company_name,
    cs.site_name,
    p.currency,
    COALESCE(p.vat_rate, 0) AS vat_rate,
    COALESCE(p.has_tevkifat, false) AS has_tevkifat,
    COALESCE(p.discount_percent, 0) AS discount_percent
  INTO v_proposal
  FROM public.proposals p
  LEFT JOIN public.customer_sites cs ON cs.id = p.site_id
  LEFT JOIN public.customers c ON c.id = cs.customer_id
  WHERE p.id = p_proposal_id
    AND p.deleted_at IS NULL
    AND p.status = 'accepted'
    AND p.site_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.proposals newer
      WHERE newer.revised_from_proposal_id = p.id
        AND newer.deleted_at IS NULL
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'linked_work_order_proposal_not_selectable: %', p_proposal_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'description', pi.description,
        'quantity', pi.quantity,
        'unit', pi.unit,
        'material_id', pi.material_id,
        'revenue_type', pi.revenue_type,
        'unit_price', CASE WHEN v_proposal.currency = 'USD' THEN COALESCE(pi.unit_price_usd, 0) ELSE COALESCE(pi.unit_price, 0) END,
        'cost', CASE WHEN v_proposal.currency = 'USD' THEN pi.cost_usd ELSE pi.cost END,
        'sort_order', pi.sort_order
      )
      ORDER BY pi.sort_order ASC, pi.id ASC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.proposal_items pi
  WHERE pi.proposal_id = p_proposal_id;

  RETURN jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'proposal_no', v_proposal.proposal_no,
      'title', v_proposal.title,
      'site_id', v_proposal.site_id,
      'customer_id', v_proposal.customer_id,
      'customer_company_name', v_proposal.customer_company_name,
      'company_name', v_proposal.company_name,
      'site_name', v_proposal.site_name,
      'currency', v_proposal.currency,
      'vat_rate', v_proposal.vat_rate,
      'has_tevkifat', v_proposal.has_tevkifat,
      'discount_percent', v_proposal.discount_percent
    ),
    'items', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_linked_work_order_proposal_scope(UUID) TO authenticated;

COMMIT;

-- REVERT
-- BEGIN;
-- REVOKE EXECUTE ON FUNCTION public.get_linked_work_order_proposal_scope(UUID) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.get_linked_work_order_proposal_scope(UUID);
-- REVOKE EXECUTE ON FUNCTION public.get_selectable_linked_work_order_proposals() FROM authenticated;
-- DROP FUNCTION IF EXISTS public.get_selectable_linked_work_order_proposals();
-- COMMIT;
