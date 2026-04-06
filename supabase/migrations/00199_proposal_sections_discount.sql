-- Per-section discount: each section now has its own discount_percent.
-- Global proposals.discount_percent is deprecated (kept in DB, no longer written).
ALTER TABLE proposal_sections
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
