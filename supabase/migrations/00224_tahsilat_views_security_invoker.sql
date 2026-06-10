-- Migration: 00224_tahsilat_views_security_invoker
-- Tahsilat collection views must respect RLS (field_worker must not see aggregates).
-- ALTER only — no view definition rewrite (see audit A1).

BEGIN;

ALTER VIEW public.v_collection_customer_summary SET (security_invoker = true);
COMMENT ON VIEW public.v_collection_customer_summary IS
  'security_invoker=true: financial_transactions RLS applies per caller (admin/accountant).';

ALTER VIEW public.v_collection_documents SET (security_invoker = true);
COMMENT ON VIEW public.v_collection_documents IS
  'security_invoker=true: financial_transactions RLS applies per caller (admin/accountant).';

COMMIT;
