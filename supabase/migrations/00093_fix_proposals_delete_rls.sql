-- 00093_fix_proposals_delete_rls.sql
-- Fix: 403 on proposal soft delete (UPDATE).
--
-- Use get_my_role() instead of direct profiles subquery for consistency
-- with site_assets, sim_cards, and other tables. get_my_role() is
-- SECURITY DEFINER and may resolve edge cases with RLS evaluation.

DROP POLICY IF EXISTS "Admins can manage proposals" ON proposals;
CREATE POLICY "Admins can manage proposals"
  ON proposals FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'accountant')
  );
