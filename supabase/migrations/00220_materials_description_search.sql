-- Turkish-normalized search on materials.description (Ornet malzeme adı)
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS description_search text
  GENERATED ALWAYS AS (normalize_tr_for_search(description)) STORED;

CREATE INDEX IF NOT EXISTS idx_materials_description_search
  ON materials (description_search) WHERE deleted_at IS NULL;
