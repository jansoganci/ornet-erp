-- Migration: 00119_restrict_subscriptions_select_rls
-- Description: Restrict the subscriptions SELECT policy to admin and accountant.
--   The original policy from 00016 used USING (true), exposing all subscription
--   data to field_workers. Only finance roles need to read subscription records.

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;

CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
