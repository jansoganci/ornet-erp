-- Migration: Add description to materials table
-- Purpose: Store product descriptions for customer-facing documents (quotes, invoices)

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS description TEXT;
