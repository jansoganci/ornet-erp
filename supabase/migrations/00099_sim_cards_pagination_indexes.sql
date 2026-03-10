-- Migration: 00099_sim_cards_pagination_indexes
-- Description: Add indexes to support efficient paginated queries on sim_cards.
--
-- Problem: fetchSimCards does a full-table scan on every list render.
--   With 2,500+ rows and ilike search on phone_number this becomes O(n) on
--   every keystroke. Adding pg_trgm + GIN index makes substring search fast.
--   Partial indexes on status and operator speed up the common filtered queries.
--
-- All indexes are partial (WHERE deleted_at IS NULL) to exclude soft-deleted
-- rows from the index entirely — keeping index size small.

-- ============================================================================
-- 1. Enable pg_trgm (required for GIN trigram index)
-- ============================================================================
-- Supabase includes pg_trgm by default; this is a no-op if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. Trigram index on phone_number — speeds up ilike '%term%' search
-- ============================================================================
-- A standard B-tree index cannot accelerate leading-wildcard ilike queries.
-- GIN + gin_trgm_ops breaks the string into 3-character trigrams, letting
-- Postgres use the index for any substring match.
CREATE INDEX IF NOT EXISTS idx_sim_cards_phone_number_trgm
  ON sim_cards USING gin (phone_number gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. B-tree index on status — used by status filter (eq)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sim_cards_status
  ON sim_cards (status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. B-tree index on operator — used by operator filter (eq)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sim_cards_operator
  ON sim_cards (operator)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. B-tree index on activation_date — used by date range filter
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sim_cards_activation_date
  ON sim_cards (activation_date)
  WHERE deleted_at IS NULL;
