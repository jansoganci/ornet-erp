-- 00089_fix_soft_delete_with_check.sql
-- Fix: UPDATE policies that lacked an explicit WITH CHECK clause.
--
-- Background:
--   When no WITH CHECK is specified for a FOR UPDATE or FOR ALL policy,
--   PostgreSQL defaults WITH CHECK to the USING expression evaluated against
--   the NEW row. Soft delete sets deleted_at to a non-null timestamp, so the
--   `deleted_at IS NULL` guard in USING evaluates to false on the new row →
--   WITH CHECK fails → the UPDATE is silently rejected (no error, 0 rows
--   affected). The fix is an explicit WITH CHECK that omits `deleted_at IS NULL`
--   while keeping the permission check intact.

-- ── tasks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
      OR assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
    OR assigned_to = auth.uid()
  );

-- ── financial_transactions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS ft_update ON financial_transactions;
CREATE POLICY ft_update ON financial_transactions
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
  );

-- ── site_assets ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS site_assets_update ON site_assets;
CREATE POLICY site_assets_update ON site_assets
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- ── proposals ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage proposals" ON proposals;
CREATE POLICY "Admins can manage proposals"
  ON proposals FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  );

-- ── sim_cards ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage sim_cards" ON sim_cards;
CREATE POLICY "Admins can manage sim_cards"
  ON sim_cards FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  );
