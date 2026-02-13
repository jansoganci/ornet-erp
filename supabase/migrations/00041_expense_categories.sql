-- Migration: 00041_expense_categories
-- Description: Finance Module 1 - Expense categories with 10 defaults + FK on financial_transactions
-- Module 1: Finance Core Tables

CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name_tr     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  icon        TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 10 default categories
INSERT INTO expense_categories (code, name_tr, name_en, is_system, sort_order) VALUES
  ('material', 'Malzeme / Ekipman', 'Material / Equipment', true, 1),
  ('sim_operator', 'Operator Faturaları', 'SIM Card Operator Bills', true, 2),
  ('fuel', 'Yakıt', 'Fuel', true, 3),
  ('payroll', 'Personel Maaşı', 'Payroll', true, 4),
  ('rent', 'Kira', 'Rent / Office', true, 5),
  ('utilities', 'Elektrik / Su / Doğalgaz', 'Utilities', true, 6),
  ('communication', 'Haberleşme', 'Communication', true, 7),
  ('vehicle', 'Araç Giderleri', 'Vehicle Expenses', true, 8),
  ('fixed_assets', 'Demirbaş', 'Fixed Assets', true, 9),
  ('other', 'Diğer', 'Other', true, 10);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_select" ON expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec_manage" ON expense_categories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- Add category to financial_transactions (expense only)
ALTER TABLE financial_transactions ADD COLUMN expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_ft_expense_category ON financial_transactions(expense_category_id);
