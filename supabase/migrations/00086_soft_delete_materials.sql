-- 00086_soft_delete_materials.sql
-- Add soft delete support to materials table

ALTER TABLE materials ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop the full unique constraint on code so soft-deleted codes can be reused
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_key;

-- Replace with a partial unique index: only active (non-deleted) records must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_code_active
  ON materials (code)
  WHERE deleted_at IS NULL;

-- Drop old non-unique index on code (superseded by the unique index above)
DROP INDEX IF EXISTS idx_materials_code;

-- Recreate select policy with deleted_at filter
DROP POLICY IF EXISTS "materials_select_authenticated" ON materials;
CREATE POLICY "materials_select_authenticated"
  ON materials FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Recreate manage_admin policy with deleted_at filter in USING clause only
-- (USING guards SELECT/UPDATE/DELETE; WITH CHECK guards INSERT/UPDATE — no deleted_at on INSERT)
DROP POLICY IF EXISTS "materials_manage_admin" ON materials;
CREATE POLICY "materials_manage_admin"
  ON materials FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
