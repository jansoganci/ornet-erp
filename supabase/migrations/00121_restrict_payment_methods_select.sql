-- Migration: 00121_restrict_payment_methods_select
-- Description: Restrict the payment_methods SELECT policy to admin only.
--   Bank and card data is no longer tracked through the app and should not
--   be readable by any role other than admin.

DROP POLICY IF EXISTS "pm_select" ON payment_methods;

CREATE POLICY "pm_select" ON payment_methods
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
