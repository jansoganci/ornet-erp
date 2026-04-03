-- 00189_add_proposal_completed_at.sql
--
-- Context:
--   The proposal finance trigger (00187) already reads NEW.completed_at for its
--   exchange rate date lookup, but the column never existed on proposals — so it
--   always resolved to NULL and fell back to CURRENT_DATE, applying the wrong rate.
--
-- Changes:
--   1. Add completed_at column to proposals.
--   2. BEFORE UPDATE trigger that auto-sets/clears completed_at, mirroring the
--      identical pattern used by set_work_order_completed_at() in 00003.
--   3. Backfill existing completed proposals using updated_at as the best available
--      approximation of when the completion event occurred.
--   4. Composite index on exchange_rates(currency, rate_date DESC) used by both
--      finance triggers for the date-accurate rate lookup.
--
-- No changes to auto_record_proposal_revenue() are required — it already contains
-- the correct logic in 00187. This migration simply makes the column it relies on exist.

-- ============================================================
-- 1. Add completed_at column
-- ============================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================
-- 2. Trigger function: auto-set/clear completed_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_proposal_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set when transitioning into 'completed'
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at := now();
  END IF;

  -- Clear when leaving 'completed' (status reversal)
  IF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER proposal_status_change
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION set_proposal_completed_at();

-- ============================================================
-- 3. Backfill: existing completed proposals
--    updated_at is the closest available proxy for the actual
--    completion timestamp for rows already in 'completed' status.
-- ============================================================
UPDATE proposals
SET    completed_at = updated_at
WHERE  status       = 'completed'
  AND  completed_at IS NULL
  AND  deleted_at   IS NULL;

-- ============================================================
-- 4. Index: exchange_rates(currency, rate_date DESC)
--    Ensures the <= rate_date ORDER BY rate_date DESC LIMIT 1
--    pattern in both finance triggers uses an index scan, not
--    a sequential scan.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_date
  ON exchange_rates (currency, rate_date DESC);
