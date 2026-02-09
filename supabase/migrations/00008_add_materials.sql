-- Migration: 00008_add_materials
-- Description: Create materials table for product catalog
-- Part of Work Order System Implementation

-- 1. Create Table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- Product code (e.g., DK230)
  name TEXT NOT NULL,                   -- Product name
  category TEXT,                        -- e.g., Dedektör, Siren, Panel
  unit TEXT DEFAULT 'adet',             -- adet, metre, paket
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(is_active) WHERE is_active = true;

-- 3. Updated_at Trigger
-- Ensure the function exists first
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_materials_updated_at ON materials;
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security (RLS)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active materials
CREATE POLICY "materials_select_authenticated"
  ON materials FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage the catalog
CREATE POLICY "materials_manage_admin"
  ON materials FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
