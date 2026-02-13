-- Migration: Add optional material_id to proposal_items
-- Purpose: Link proposal items to materials catalog to show description in PDFs

ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_items_material_id
  ON proposal_items(material_id)
  WHERE material_id IS NOT NULL;
