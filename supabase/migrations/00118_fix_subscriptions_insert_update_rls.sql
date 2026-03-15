-- Migration: 00118_fix_subscriptions_insert_update_rls
-- Description: Restrict INSERT and UPDATE on subscriptions and subscription_payments
--   to admin and accountant only. Migration 00021 loosened these policies to
--   WITH CHECK (true), which allowed field_workers to create and modify subscription
--   and payment records. This migration restores the intended access control.

-- ── subscriptions ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- ── subscription_payments ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sp_insert" ON subscription_payments;
CREATE POLICY "sp_insert" ON subscription_payments
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "sp_update" ON subscription_payments;
CREATE POLICY "sp_update" ON subscription_payments
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
