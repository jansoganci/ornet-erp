-- Migration: MA-C1-API — Materials reject malformed body at DB layer
-- Ensures empty or invalid inserts return 400/422 (NOT NULL + CHECK).
-- code and name are already NOT NULL; add CHECK to reject empty strings.

-- ============================================================
-- 1. Add CHECK constraints for non-empty code and name
-- ============================================================
ALTER TABLE materials
  DROP CONSTRAINT IF EXISTS materials_code_non_empty,
  DROP CONSTRAINT IF EXISTS materials_name_non_empty;

ALTER TABLE materials
  ADD CONSTRAINT materials_code_non_empty CHECK (trim(code) <> ''),
  ADD CONSTRAINT materials_name_non_empty CHECK (trim(name) <> '');
