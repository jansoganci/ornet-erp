-- 00253_revoke_anon_security_definer_execute_grants.sql
--
-- Batch A1 (docs/audit-reports/11 + 12): close PostgREST EXECUTE surface on
-- SECURITY DEFINER functions.
--
-- Rules:
--   1) Trigger / cron / internal / dead helpers:
--        REVOKE EXECUTE FROM PUBLIC, anon, authenticated
--      (owner postgres still runs triggers; grant service_role where Edge/cron needs it)
--   2) Intentional SPA RPCs + get_my_role:
--        REVOKE EXECUTE FROM PUBLIC, anon
--        keep / restore GRANT EXECUTE TO authenticated
--
-- Does NOT change function bodies, RLS policies, or Auth settings.
-- Does NOT tighten work_orders_insert (Batch A3) or search_path (Batch A4).

BEGIN;

DO $$
DECLARE
  r RECORD;
  -- Trigger / cron / internal / unused: not callable via anon or authenticated RPC
  internal_names text[] := ARRAY[
    'auto_record_proposal_revenue',
    'auto_record_work_order_revenue',
    'reverse_proposal_finance_entries',
    'reverse_work_order_finance_entries',
    'fn_subscription_payment_to_finance',
    'fn_sim_card_to_finance',
    'fn_write_off_to_finance',
    'fn_update_payment_status',
    'fn_update_transaction_payment_status',
    'site_has_active_subscription',
    'handle_new_user',
    'log_work_order_audit',
    'fn_sync_work_order_to_operations',
    'fn_subscription_sim_status_on_insert',
    'fn_subscription_sim_status_on_update',
    'fn_set_subscription_parasut_ready',
    'fn_upsert_site_assets_from_rental_proposal',
    'fn_notify_subscription_status_change',
    'fn_notify_work_order_assigned',
    'fn_notify_work_order_completed',
    'fn_notify_sim_card_cancelled',
    'fn_resolve_notification_on_entity_close',
    'fn_create_scheduled_notifications',
    'fn_process_reminders',
    'fn_notification_cleanup',
    'fn_create_pending_payments_summary_notification',
    'fn_generate_recurring_expenses',
    'extend_active_subscription_payments',
    'generate_monthly_sim_finance',
    'get_customer_work_history',
    'fn_upsert_site_asset',
    'ensure_payments_for_year'
  ];
  -- Edge / cron callers that use service_role client
  service_role_names text[] := ARRAY[
    'fn_generate_recurring_expenses',
    'extend_active_subscription_payments',
    'generate_monthly_sim_finance'
  ];
  -- SPA + RLS helper: authenticated OK, anon/PUBLIC not OK
  spa_names text[] := ARRAY[
    'bulk_import_subscriptions',
    'bulk_update_subscription_prices',
    'bulk_upsert_materials',
    'complete_proposal_with_rate',
    'fn_boomerang_failed_item',
    'fn_cancel_subscription',
    'fn_complete_work_order_with_payment',
    'fn_convert_item_to_work_order',
    'fn_generate_recurring_expenses_guarded',
    'fn_get_operations_stats',
    'fn_record_payment',
    'fn_resolve_notification',
    'fn_revert_write_off',
    'fn_save_proposal_package',
    'fn_update_subscription_price',
    'fn_upsert_site_assets_batch',
    'generate_subscription_payments',
    'get_daily_work_list',
    'get_dashboard_stats',
    'get_linked_work_order_proposal_scope',
    'get_monthly_revenue_expense',
    'get_my_pending_tasks',
    'get_my_role',
    'get_notification_badge_count',
    'get_overdue_invoices',
    'get_overdue_subscription_payments',
    'get_selectable_linked_work_order_proposals',
    'get_subscription_stats',
    'get_subscription_year_schedule',
    'get_today_schedule',
    'revise_proposal_package',
    'search_customer_sites',
    'search_work_history',
    'soft_delete_customer',
    'soft_delete_operations_item',
    'soft_delete_proposal',
    'soft_delete_recurring_template',
    'soft_delete_sim_card',
    'soft_delete_transaction',
    'soft_delete_work_order'
  ];
BEGIN
  -- 1) Internal / trigger / cron / dead
  FOR r IN
    SELECT p.oid::regprocedure AS regproc, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (internal_names)
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      r.regproc
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO postgres',
      r.regproc
    );
    IF r.proname = ANY (service_role_names) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        r.regproc
      );
    END IF;
  END LOOP;

  -- 2) SPA RPCs + get_my_role: close anon/PUBLIC, keep authenticated
  FOR r IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (spa_names)
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',
      r.regproc
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated',
      r.regproc
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      r.regproc
    );
  END LOOP;
END $$;

COMMIT;
