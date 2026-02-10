-- Migration: Remove logo_url column from proposals
-- Logo is now static (ornet.logo.png and falan.png in public/ folder)
-- Note: proposals_detail view already excludes logo_url (updated in 00030)

-- Remove logo_url column from proposals table
ALTER TABLE proposals DROP COLUMN IF EXISTS logo_url;
