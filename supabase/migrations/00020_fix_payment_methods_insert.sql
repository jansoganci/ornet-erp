-- Migration: 00020_fix_payment_methods_insert
-- Description: Allow any authenticated user to INSERT/UPDATE payment_methods
-- so subscription flow (e.g. field_worker adding recurring payment) can add
-- payment methods. DELETE remains admin-only.

DROP POLICY IF EXISTS "pm_insert" ON payment_methods;
CREATE POLICY "pm_insert" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pm_update" ON payment_methods;
CREATE POLICY "pm_update" ON payment_methods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
