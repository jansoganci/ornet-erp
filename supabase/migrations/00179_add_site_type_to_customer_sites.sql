-- Migration: 00179_add_site_type_to_customer_sites
-- Description: Optional customer site type (residential/business) for segmentation.

BEGIN;

ALTER TABLE public.customer_sites
  ADD COLUMN IF NOT EXISTS site_type TEXT;

-- Optional field: NULL allowed; when present must be one of the supported values.
ALTER TABLE public.customer_sites
  DROP CONSTRAINT IF EXISTS chk_customer_sites_site_type;

ALTER TABLE public.customer_sites
  ADD CONSTRAINT chk_customer_sites_site_type
  CHECK (site_type IS NULL OR site_type IN ('residential', 'business'));

COMMIT;

