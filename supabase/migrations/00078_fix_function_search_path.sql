-- ============================================================
-- Fix: function_search_path_mutable (Supabase lint: 0011)
-- Date: 2026-02-19
-- Risk: NONE — ALTER FUNCTION SET search_path never touches
--        function body, signature, or behavior. Fully reversible.
--
-- Problem: Functions without SET search_path = public run with
--   whatever search_path the calling session has. A user with
--   CREATE privilege on any schema could shadow public tables
--   (e.g. create their own "subscriptions" table) and redirect
--   a SECURITY DEFINER function to operate on the wrong data.
--
-- Fix: ALTER FUNCTION ... SET search_path = public
--   Pins the search_path at function entry, regardless of caller.
--   This is identical to what get_my_role() and handle_new_user()
--   already have correctly set (reference: 00001_profiles.sql).
--
-- Priority order: SECURITY DEFINER first (highest exploitability),
--   then triggers and helpers (lower risk, fixed for completeness).
--
-- ROLLBACK: ALTER FUNCTION public.<name>(<args>) RESET search_path;
-- ============================================================

BEGIN;

-- ============================================================
-- CRITICAL: SECURITY DEFINER functions that write data
-- ============================================================

-- bulk_update_subscription_prices: SECURITY DEFINER, processes
-- user-supplied JSONB, writes to subscriptions + subscription_payments
-- + audit_logs, calls auth.uid(). Highest exposure surface.
ALTER FUNCTION public.bulk_update_subscription_prices(jsonb)
  SET search_path = public;

-- ============================================================
-- HIGH: SECURITY DEFINER functions exposed as frontend RPCs
-- ============================================================

-- search_work_history: SECURITY DEFINER, called from work history
-- search page, returns SETOF work_orders_detail via ILIKE query.
ALTER FUNCTION public.search_work_history(text, text)
  SET search_path = public;

-- get_daily_work_list: SECURITY DEFINER, called from calendar/daily
-- view, returns SETOF work_orders_detail for a given date + worker.
ALTER FUNCTION public.get_daily_work_list(date, uuid)
  SET search_path = public;

-- get_overdue_invoices: SECURITY DEFINER, returns paid payments
-- missing invoice > 7 days — exposes amounts, company names.
ALTER FUNCTION public.get_overdue_invoices()
  SET search_path = public;

-- generate_subscription_payments: SECURITY DEFINER, inserts rows
-- into subscription_payments — writes financial records.
ALTER FUNCTION public.generate_subscription_payments(uuid, date)
  SET search_path = public;

-- get_subscription_stats: SECURITY DEFINER, returns MRR and
-- subscription counts as JSON — exposes financial aggregates.
ALTER FUNCTION public.get_subscription_stats()
  SET search_path = public;

-- ============================================================
-- LOW: SECURITY INVOKER functions (no SECURITY DEFINER)
-- Fixed for completeness — schema-shadowing attack requires
-- CREATE privilege which no app user has in Supabase.
-- ============================================================

-- generate_proposal_no: reads proposals count, returns text string.
ALTER FUNCTION public.generate_proposal_no()
  SET search_path = public;

-- generate_account_number: reads customers, returns M-YYYY-XXX string.
ALTER FUNCTION public.generate_account_number()
  SET search_path = public;

-- check_proposal_completion: BEFORE UPDATE trigger on work_orders,
-- auto-completes proposal when all linked work orders are done.
ALTER FUNCTION public.check_proposal_completion()
  SET search_path = public;

-- set_subscription_lifecycle_timestamps: BEFORE UPDATE trigger on
-- subscriptions, sets paused_at / cancelled_at / end_date.
ALTER FUNCTION public.set_subscription_lifecycle_timestamps()
  SET search_path = public;

-- log_sim_card_history: AFTER INSERT/UPDATE trigger on sim_cards,
-- writes status/assignment changes to sim_card_history.
ALTER FUNCTION public.log_sim_card_history()
  SET search_path = public;

-- set_work_order_completed_at: BEFORE UPDATE trigger on work_orders,
-- sets completed_at / cancelled_at on status transitions.
ALTER FUNCTION public.set_work_order_completed_at()
  SET search_path = public;

-- set_task_completed_at: BEFORE UPDATE trigger on tasks,
-- sets completed_at on status transitions.
ALTER FUNCTION public.set_task_completed_at()
  SET search_path = public;

-- update_updated_at_column: generic BEFORE UPDATE trigger used on
-- every table in the system — sets updated_at = now().
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public;

COMMIT;

-- ============================================================
-- VERIFICATION (run after applying)
-- Expected: proconfig = {search_path=public} for all 14 rows.
-- ============================================================
-- SELECT
--   proname                                         AS function_name,
--   pg_get_function_identity_arguments(oid)         AS arguments,
--   prosecdef                                       AS is_security_definer,
--   proconfig                                       AS config
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'bulk_update_subscription_prices',
--     'search_work_history',
--     'get_daily_work_list',
--     'get_overdue_invoices',
--     'generate_subscription_payments',
--     'get_subscription_stats',
--     'generate_proposal_no',
--     'generate_account_number',
--     'check_proposal_completion',
--     'set_subscription_lifecycle_timestamps',
--     'log_sim_card_history',
--     'set_work_order_completed_at',
--     'set_task_completed_at',
--     'update_updated_at_column'
--   )
-- ORDER BY prosecdef DESC, proname;
-- Expected: proconfig = {search_path=public} for all 14 rows.

-- ============================================================
-- ROLLBACK (run if something breaks)
-- ============================================================
-- BEGIN;
-- ALTER FUNCTION public.bulk_update_subscription_prices(jsonb)         RESET search_path;
-- ALTER FUNCTION public.search_work_history(text, text)                RESET search_path;
-- ALTER FUNCTION public.get_daily_work_list(date, uuid)                RESET search_path;
-- ALTER FUNCTION public.get_overdue_invoices()                         RESET search_path;
-- ALTER FUNCTION public.generate_subscription_payments(uuid, date)     RESET search_path;
-- ALTER FUNCTION public.get_subscription_stats()                       RESET search_path;
-- ALTER FUNCTION public.generate_proposal_no()                         RESET search_path;
-- ALTER FUNCTION public.generate_account_number()                      RESET search_path;
-- ALTER FUNCTION public.check_proposal_completion()                    RESET search_path;
-- ALTER FUNCTION public.set_subscription_lifecycle_timestamps()        RESET search_path;
-- ALTER FUNCTION public.log_sim_card_history()                         RESET search_path;
-- ALTER FUNCTION public.set_work_order_completed_at()                  RESET search_path;
-- ALTER FUNCTION public.set_task_completed_at()                        RESET search_path;
-- ALTER FUNCTION public.update_updated_at_column()                     RESET search_path;
-- COMMIT;
