-- Migration: 00021_fix_subscriptions_insert
-- Description: Allow any authenticated user to INSERT/UPDATE subscriptions
-- and subscription_payments so the subscription create flow works for all
-- roles (e.g. field_worker). DELETE remains admin-only.

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Subscription payments (used by create flow via generate_subscription_payments / direct inserts)
DROP POLICY IF EXISTS "sp_insert" ON subscription_payments;
CREATE POLICY "sp_insert" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sp_update" ON subscription_payments;
CREATE POLICY "sp_update" ON subscription_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
