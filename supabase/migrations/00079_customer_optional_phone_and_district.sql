-- Migration: 00079_customer_optional_phone_and_district
-- Description: Make customer phone optional and ensure district exists in customer_sites
-- Date: 2026-02-19

BEGIN;

-- 1. Make phone optional in customers table
ALTER TABLE public.customers ALTER COLUMN phone DROP NOT NULL;

-- 2. Ensure district exists in customer_sites (it already exists in 00007, but we ensure it's here for clarity)
-- If it's already there, this is just a safety check.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_sites' AND column_name='district') THEN
        ALTER TABLE public.customer_sites ADD COLUMN district TEXT;
    END IF;
END $$;

COMMIT;
