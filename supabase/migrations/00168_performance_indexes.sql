-- Performance indexes for Ornet ERP
-- Addresses: slow filtered queries, RLS overhead, financial queries
--
-- Schema notes (why some column names differ from generic templates):
-- - subscriptions: no deleted_at; use status (active/paused/cancelled) and cancelled_at
-- - financial_transactions: direction + income_type (not "type" or "source_type" on the table)
-- - work_orders: customer_id was dropped in 00009_rebuild_work_orders.sql; link is site_id → customer_sites

-- 1. RLS policy optimization — profiles lookup fires on every mutation
CREATE INDEX IF NOT EXISTS idx_profiles_id_role 
ON public.profiles(id, role);

-- 2. Subscriptions — most filtered by status and site
-- Note: subscriptions uses 'status' for filtering, not deleted_at
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_active
ON public.subscriptions(status)
WHERE status IN ('active', 'paused');

CREATE INDEX IF NOT EXISTS idx_subscriptions_site_id_active
ON public.subscriptions(site_id)  
WHERE status IN ('active', 'paused');

-- 3. financial_transactions — core ledger, filtered by date and direction
CREATE INDEX IF NOT EXISTS idx_fin_transactions_date_direction
ON public.financial_transactions(transaction_date DESC, direction)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fin_transactions_direction_income
ON public.financial_transactions(direction, income_type)
WHERE deleted_at IS NULL AND direction = 'income';

-- 4. service_requests — operations pool filters by status
CREATE INDEX IF NOT EXISTS idx_service_requests_status_deleted
ON public.service_requests(status)
WHERE deleted_at IS NULL;

-- 5. work_orders — filtered by status and site (customer is via customer_sites)
CREATE INDEX IF NOT EXISTS idx_work_orders_status_deleted
ON public.work_orders(status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_site_deleted
ON public.work_orders(site_id)
WHERE deleted_at IS NULL;

-- Run ANALYZE after index creation to update query planner statistics
ANALYZE public.subscriptions;
ANALYZE public.financial_transactions;
ANALYZE public.service_requests;
ANALYZE public.work_orders;
ANALYZE public.profiles;
