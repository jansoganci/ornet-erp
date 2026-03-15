-- Migration: 00120_fix_payment_methods_rls
-- Description: Restrict INSERT and UPDATE on payment_methods to admin and
--   accountant only. Migration 00020 had loosened both policies to WITH CHECK (true),
--   allowing field_workers to create and modify payment method records.
--   SELECT (pm_select) and DELETE (pm_delete) policies are not changed.

DROP POLICY IF EXISTS "pm_insert" ON payment_methods;
CREATE POLICY "pm_insert" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "pm_update" ON payment_methods;
CREATE POLICY "pm_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
