-- 00088_soft_delete_sim_cards.sql
-- Add soft delete support to sim_cards table

ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── Unique constraints → partial unique indexes ─────────────────────────────
-- Drop full unique constraints so soft-deleted phone numbers / IMSIs can be
-- reissued to new SIM cards in the future.

ALTER TABLE sim_cards DROP CONSTRAINT IF EXISTS sim_cards_phone_number_key;
ALTER TABLE sim_cards DROP CONSTRAINT IF EXISTS sim_cards_imsi_key;

-- Only active (non-deleted) records must be unique on phone_number and imsi
CREATE UNIQUE INDEX IF NOT EXISTS idx_sim_cards_phone_number_active
  ON sim_cards (phone_number)
  WHERE deleted_at IS NULL;

-- imsi column may not exist in all environments; create index only if it does
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sim_cards' AND column_name = 'imsi'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sim_cards_imsi_active
      ON sim_cards (imsi)
      WHERE deleted_at IS NULL AND imsi IS NOT NULL;
  END IF;
END $$;

-- ── Partial index for common list queries ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sim_cards_active
  ON sim_cards (status, operator)
  WHERE deleted_at IS NULL;

-- ── RLS policies ────────────────────────────────────────────────────────────
-- sim_card_history rows are preserved regardless — the CASCADE from sim_cards
-- will never fire because soft delete is an UPDATE, not a DELETE.

DROP POLICY IF EXISTS "Authenticated users can read sim_cards" ON sim_cards;
CREATE POLICY "Authenticated users can read sim_cards"
  ON sim_cards FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- FOR ALL: deleted_at IS NULL goes in USING only (guards SELECT/UPDATE/DELETE).
-- WITH CHECK is intentionally omitted here (same as original) so INSERT is
-- governed solely by the role check.
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
  );
