-- Migration: 00002_customers
-- Description: Create customers table
-- Single-tenant CRM - All authenticated users can access customers

-- ============================================
-- 1. CUSTOMERS TABLE
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  account_number TEXT UNIQUE,           -- Internal code (e.g., M-2024-001)
  name TEXT NOT NULL,                   -- Customer or company name

  -- Contact information
  phone TEXT,                           -- Primary phone
  phone_secondary TEXT,                 -- Secondary phone
  email TEXT,                           -- Email address

  -- Address (single for MVP, can extend later)
  address TEXT,                         -- Full address
  city TEXT,                            -- City (optional, for filtering)
  district TEXT,                        -- District/ilce (optional)

  -- Additional info
  notes TEXT,                           -- Free-form notes

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. INDEXES
-- ============================================

-- For search by name (text search)
CREATE INDEX idx_customers_name ON customers(name);

-- For search by phone
CREATE INDEX idx_customers_phone ON customers(phone);

-- For sorting by creation date
CREATE INDEX idx_customers_created ON customers(created_at DESC);

-- For filtering by city
CREATE INDEX idx_customers_city ON customers(city) WHERE city IS NOT NULL;

-- ============================================
-- 3. UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
-- All authenticated users can view/edit customers
-- (Single-tenant: no org_id filtering needed)

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

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
  USING (get_my_role() = 'admin');

-- ============================================
-- 5. ACCOUNT NUMBER GENERATION (OPTIONAL)
-- ============================================
-- Function to generate next account number
-- Format: M-YYYY-XXX (e.g., M-2024-001)

CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_account_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Get the highest number for this year
  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(account_number, '^M-' || current_year || '-', ''),
        account_number
      )::INT
    ),
    0
  ) + 1
  INTO next_number
  FROM customers
  WHERE account_number LIKE 'M-' || current_year || '-%';

  new_account_number := 'M-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');

  RETURN new_account_number;
END;
$$;
