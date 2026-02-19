-- ============================================================
-- Fix: SECURITY DEFINER views → SECURITY INVOKER
-- Supabase Security Advisor lint: 0010
-- Date: 2026-02-19
-- Risk: LOW — ALTER VIEW preserves the stored SELECT definition.
--            No DROP+CREATE. Single transaction. Fully reversible.
--
-- Problem: Views without security_invoker=true run as the view
--   owner (postgres superuser), bypassing Row Level Security on
--   underlying tables. Any authenticated user could query data
--   that RLS would otherwise block.
--
-- Fix: ALTER VIEW ... SET (security_invoker = true)
--   Forces the view to execute as the *calling* role, so RLS
--   on underlying tables is evaluated against auth.uid().
--
-- Safe to apply because:
--   - All 10 underlying table sets have RLS with TO authenticated
--   - No GRANT TO anon exists on any of these views
--   - subscriptions_detail LEFT JOINs payment_methods (admin/accountant
--     only RLS) → worker role gets NULL for pm_* columns — correct behavior
--   - v_active_notifications already has get_my_role() filter internally
-- ============================================================

-- ============================================================
-- BEFORE SNAPSHOT (run this BEFORE applying the migration)
-- Save results to compare against AFTER snapshot below.
-- ============================================================
-- SELECT
--   c.relname AS view_name,
--   COALESCE(
--     (SELECT option_value
--      FROM pg_options_to_table(c.reloptions)
--      WHERE option_name = 'security_invoker'),
--     'false'
--   ) AS security_invoker_before
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.relkind = 'v'
--   AND n.nspname = 'public'
--   AND c.relname IN (
--     'tasks_with_details', 'site_assets_detail', 'proposals_detail',
--     'v_profit_and_loss', 'work_orders_detail', 'v_active_notifications',
--     'subscriptions_detail', 'view_sim_card_stats',
--     'view_sim_card_operator_distribution', 'view_sim_card_financials'
--   )
-- ORDER BY c.relname;
-- Expected: security_invoker_before = 'false' (or NULL) for ALL rows.

-- ============================================================
-- MIGRATION
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- CRITICAL: Financial views — expose raw monetary data
-- ------------------------------------------------------------

-- v_profit_and_loss: UNION of subscription payments + all financial
-- transactions (income & expense). Contains amount_try, cogs_try,
-- output_vat, input_vat. Most sensitive view in the system.
ALTER VIEW public.v_profit_and_loss SET (security_invoker = true);

-- subscriptions_detail: Exposes base_price, cost, profit, card_last4,
-- IBAN, billing frequency. LEFT JOIN to payment_methods — workers will
-- receive NULL for pm_* columns (correct per their RLS policy).
ALTER VIEW public.subscriptions_detail SET (security_invoker = true);

-- view_sim_card_financials: Monthly revenue, cost, profit per active SIM.
-- Only authenticated users have SELECT on sim_cards (USING true).
ALTER VIEW public.view_sim_card_financials SET (security_invoker = true);

-- ------------------------------------------------------------
-- HIGH: Operational views — customer & work order data
-- ------------------------------------------------------------

-- work_orders_detail: Work orders joined with site, customer, assigned
-- workers (JSON array). Used by calendar, daily list, work history.
ALTER VIEW public.work_orders_detail SET (security_invoker = true);

-- proposals_detail: Offers joined with site, customer, WO counts,
-- completion state. Contains total_amount_usd and cost fields.
ALTER VIEW public.proposals_detail SET (security_invoker = true);

-- tasks_with_details: Tasks joined with assignee profile, work order,
-- customer. Used by the task list page.
ALTER VIEW public.tasks_with_details SET (security_invoker = true);

-- site_assets_detail: Installed equipment registry per customer site.
-- Joined with materials catalog, installing work order.
ALTER VIEW public.site_assets_detail SET (security_invoker = true);

-- ------------------------------------------------------------
-- MEDIUM: Stats & notification views
-- ------------------------------------------------------------

-- view_sim_card_stats: Aggregate counts by status (available, active,
-- inactive, sold). No customer PII, but still runs as postgres now.
ALTER VIEW public.view_sim_card_stats SET (security_invoker = true);

-- view_sim_card_operator_distribution: COUNT + profit per operator.
-- Aggregate only, no per-row customer data.
ALTER VIEW public.view_sim_card_operator_distribution SET (security_invoker = true);

-- v_active_notifications: UNION of 8 computed + stored notification
-- sources. Already has WHERE get_my_role() IN ('admin','accountant')
-- in its outer query — fixing INVOKER adds a second layer of protection.
ALTER VIEW public.v_active_notifications SET (security_invoker = true);

-- ------------------------------------------------------------
-- Precautionary: Revoke anon access
-- No migration ever granted these views to anon, but belt+suspenders.
-- REVOKE on a non-existent grant is a no-op (safe).
-- ------------------------------------------------------------

REVOKE SELECT ON public.v_profit_and_loss                   FROM anon;
REVOKE SELECT ON public.subscriptions_detail                FROM anon;
REVOKE SELECT ON public.view_sim_card_financials            FROM anon;
REVOKE SELECT ON public.work_orders_detail                  FROM anon;
REVOKE SELECT ON public.proposals_detail                    FROM anon;
REVOKE SELECT ON public.tasks_with_details                  FROM anon;
REVOKE SELECT ON public.site_assets_detail                  FROM anon;
REVOKE SELECT ON public.view_sim_card_stats                 FROM anon;
REVOKE SELECT ON public.view_sim_card_operator_distribution FROM anon;
REVOKE SELECT ON public.v_active_notifications              FROM anon;

COMMIT;

-- ============================================================
-- AFTER SNAPSHOT — run this immediately after applying.
-- All rows MUST show security_invoker = 'true'.
-- ============================================================
-- SELECT
--   c.relname AS view_name,
--   COALESCE(
--     (SELECT option_value
--      FROM pg_options_to_table(c.reloptions)
--      WHERE option_name = 'security_invoker'),
--     'false'
--   ) AS security_invoker
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.relkind = 'v'
--   AND n.nspname = 'public'
--   AND c.relname IN (
--     'tasks_with_details', 'site_assets_detail', 'proposals_detail',
--     'v_profit_and_loss', 'work_orders_detail', 'v_active_notifications',
--     'subscriptions_detail', 'view_sim_card_stats',
--     'view_sim_card_operator_distribution', 'view_sim_card_financials'
--   )
-- ORDER BY c.relname;
-- Expected: security_invoker = 'true' for ALL 10 rows.

-- ============================================================
-- ANON ACCESS CHECK — should return 0 rows
-- ============================================================
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN (
--   'tasks_with_details', 'site_assets_detail', 'proposals_detail',
--   'v_profit_and_loss', 'work_orders_detail', 'v_active_notifications',
--   'subscriptions_detail', 'view_sim_card_stats',
--   'view_sim_card_operator_distribution', 'view_sim_card_financials'
-- )
--   AND grantee = 'anon';
-- Expected: 0 rows.

-- ============================================================
-- SMOKE TEST — run as authenticated role (should still work)
-- ============================================================
-- SET ROLE authenticated;
-- SELECT COUNT(*) FROM public.work_orders_detail;
-- SELECT COUNT(*) FROM public.subscriptions_detail;
-- SELECT COUNT(*) FROM public.proposals_detail;
-- SELECT COUNT(*) FROM public.v_profit_and_loss;
-- SELECT COUNT(*) FROM public.view_sim_card_stats;
-- RESET ROLE;
-- Expected: all return row counts (not errors).

-- ============================================================
-- ROLLBACK — run this if something breaks after applying
-- ============================================================
-- BEGIN;
-- ALTER VIEW public.v_profit_and_loss                   SET (security_invoker = false);
-- ALTER VIEW public.subscriptions_detail                SET (security_invoker = false);
-- ALTER VIEW public.view_sim_card_financials            SET (security_invoker = false);
-- ALTER VIEW public.work_orders_detail                  SET (security_invoker = false);
-- ALTER VIEW public.proposals_detail                    SET (security_invoker = false);
-- ALTER VIEW public.tasks_with_details                  SET (security_invoker = false);
-- ALTER VIEW public.site_assets_detail                  SET (security_invoker = false);
-- ALTER VIEW public.view_sim_card_stats                 SET (security_invoker = false);
-- ALTER VIEW public.view_sim_card_operator_distribution SET (security_invoker = false);
-- ALTER VIEW public.v_active_notifications              SET (security_invoker = false);
-- COMMIT;
