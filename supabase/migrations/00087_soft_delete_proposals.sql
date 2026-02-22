-- 00087_soft_delete_proposals.sql
-- Add soft delete support to proposals table

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop the full unique constraint on proposal_no so soft-deleted numbers can be reused
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_proposal_no_key;

-- Replace with a partial unique index: only active (non-deleted) proposals must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_proposal_no_active
  ON proposals (proposal_no)
  WHERE deleted_at IS NULL;

-- Recreate select policy with deleted_at filter
-- proposals_detail is security_invoker so RLS propagates through the view automatically
DROP POLICY IF EXISTS "Authenticated users can read proposals" ON proposals;
CREATE POLICY "Authenticated users can read proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Recreate manage policy with deleted_at filter in USING clause only
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
  );
