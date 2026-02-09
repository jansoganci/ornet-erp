-- Migration: 00019_fix_subscription_permissions
-- Description: Fix 403 errors on subscription pages
-- 1. Grant EXECUTE on RPC functions to authenticated role
-- 2. Relax payment_methods SELECT RLS to allow all authenticated users (read-only)
--    Write operations remain restricted to admin/accountant

-- ============================================================================
-- 1. GRANT EXECUTE ON RPC FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_overdue_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_subscription_payments(UUID, DATE) TO authenticated;

-- ============================================================================
-- 2. RELAX payment_methods SELECT POLICY
-- ============================================================================
-- The subscriptions_detail view LEFT JOINs payment_methods.
-- All authenticated users need read access; write stays restricted.

DROP POLICY IF EXISTS "pm_select" ON payment_methods;
CREATE POLICY "pm_select" ON payment_methods FOR SELECT
  TO authenticated USING (true);
