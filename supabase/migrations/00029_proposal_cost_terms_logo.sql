-- Migration: Proposal cost tracking, terms, logo, discount
-- Adds columns to proposals and proposal_items per proposals-implementation-plan.md

-- ============================================================
-- 1. proposal_items: cost tracking (internal only, never in PDF)
-- ============================================================
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS product_cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS labor_cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS shipping_cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS material_cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS misc_cost_usd DECIMAL(12,2);

-- ============================================================
-- 2. proposals: logo, header fields, discount, terms
-- ============================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS survey_date DATE,
  ADD COLUMN IF NOT EXISTS authorized_person TEXT,
  ADD COLUMN IF NOT EXISTS installation_date DATE,
  ADD COLUMN IF NOT EXISTS customer_representative TEXT,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS terms_engineering TEXT,
  ADD COLUMN IF NOT EXISTS terms_pricing TEXT,
  ADD COLUMN IF NOT EXISTS terms_warranty TEXT,
  ADD COLUMN IF NOT EXISTS terms_other TEXT,
  ADD COLUMN IF NOT EXISTS terms_attachments TEXT;

-- proposals_detail view uses p.* so new columns are included automatically
