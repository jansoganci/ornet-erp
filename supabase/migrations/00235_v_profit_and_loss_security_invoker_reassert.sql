-- Migration: 00235_v_profit_and_loss_security_invoker_reassert
-- Supabase lint 0010 (security_definer_view): re-assert security_invoker after
-- 00207 CREATE OR REPLACE VIEW v_profit_and_loss (clears reloptions).

ALTER VIEW public.v_profit_and_loss SET (security_invoker = true);
