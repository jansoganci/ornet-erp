-- Migration: 00006_rebuild_customers
-- Description: Modify customers table (remove address/account_no, add company_name)
-- Part of Work Order System Implementation

-- 1. Drop existing view that depends on customers table
-- This view will be rebuilt or replaced in later migrations (00009 and 00011)
DROP VIEW IF EXISTS work_orders_with_customer CASCADE;

-- 2. Drop existing policies to avoid conflicts during modification
DROP POLICY IF EXISTS "customers_select_authenticated" ON customers;
DROP POLICY IF EXISTS "customers_insert_authenticated" ON customers;
DROP POLICY IF EXISTS "customers_update_authenticated" ON customers;
DROP POLICY IF EXISTS "customers_delete_admin" ON customers;

-- 3. Modify columns
-- Rename 'name' to 'company_name' if 'name' exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='name') THEN
        ALTER TABLE customers RENAME COLUMN name TO company_name;
    END IF;
END $$;

-- Add new columns safely
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='phone_secondary') THEN
        ALTER TABLE customers ADD COLUMN phone_secondary TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tax_number') THEN
        ALTER TABLE customers ADD COLUMN tax_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='created_by') THEN
        ALTER TABLE customers ADD COLUMN created_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Remove columns that are moving to customer_sites
-- CASCADE is not used here because we want to be careful, but we already dropped the view
ALTER TABLE customers DROP COLUMN IF EXISTS account_number;
ALTER TABLE customers DROP COLUMN IF EXISTS address;
ALTER TABLE customers DROP COLUMN IF EXISTS city;
ALTER TABLE customers DROP COLUMN IF EXISTS district;

-- 4. Re-create RLS policies (matching the new structure)
-- All authenticated users can view all customers
CREATE POLICY "customers_select_authenticated"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert customers
CREATE POLICY "customers_insert_authenticated"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update customers
CREATE POLICY "customers_update_authenticated"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admins can delete customers
CREATE POLICY "customers_delete_admin"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 5. Update indexes
DROP INDEX IF EXISTS idx_customers_name;
DROP INDEX IF EXISTS idx_customers_city; -- City removed

CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);

-- 6. Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
