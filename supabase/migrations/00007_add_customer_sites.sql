-- Migration: 00007_add_customer_sites
-- Description: Create customer_sites table for multi-location support
-- Part of Work Order System Implementation

-- 1. Create Table
CREATE TABLE IF NOT EXISTS customer_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Site Identification
  account_no TEXT,                      -- Alarm monitoring account number
  site_name TEXT,                       -- Branch name (e.g., "Nişantaşı Şubesi")
  
  -- Location Info
  address TEXT NOT NULL,
  city TEXT,
  district TEXT,
  
  -- Contact Info
  contact_name TEXT,
  contact_phone TEXT,
  
  -- Technical Info
  panel_info TEXT,                      -- Security panel model/info
  
  -- Additional Info
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_customer_sites_customer_id ON customer_sites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sites_account_no ON customer_sites(account_no) WHERE account_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_sites_city ON customer_sites(city);

-- 3. Updated_at Trigger
-- Ensure the function exists first (it's usually in 00001_profiles.sql)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customer_sites_updated_at ON customer_sites;
CREATE TRIGGER update_customer_sites_updated_at
  BEFORE UPDATE ON customer_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security (RLS)
ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all sites
CREATE POLICY "customer_sites_select_authenticated"
  ON customer_sites FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert sites
CREATE POLICY "customer_sites_insert_authenticated"
  ON customer_sites FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update sites
CREATE POLICY "customer_sites_update_authenticated"
  ON customer_sites FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admins can delete sites
CREATE POLICY "customer_sites_delete_admin"
  ON customer_sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
