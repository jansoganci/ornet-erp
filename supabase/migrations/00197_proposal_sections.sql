-- Revert section_label added in 00196 (Smart Category approach — not used)
ALTER TABLE proposal_items DROP COLUMN IF EXISTS section_label;

-- Flexible Sections: first-class section entities
CREATE TABLE proposal_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposal_sections_proposal_id
  ON proposal_sections(proposal_id, sort_order);

-- Items reference their section; null = ungrouped
ALTER TABLE proposal_items
  ADD COLUMN section_id UUID REFERENCES proposal_sections(id) ON DELETE SET NULL;
