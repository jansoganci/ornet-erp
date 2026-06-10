-- Migration: 00234_tahsilat_views_security_invoker_reassert
-- R2: Re-assert security_invoker after 00233 CREATE OR REPLACE VIEW (clears reloptions).

ALTER VIEW public.v_collection_documents SET (security_invoker = true);
ALTER VIEW public.v_collection_customer_summary SET (security_invoker = true);
