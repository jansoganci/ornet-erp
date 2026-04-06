-- Add section_label to proposal_items for grouping in editor and PDF
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS section_label TEXT;

-- No index needed — only used for display/grouping, not filtering
