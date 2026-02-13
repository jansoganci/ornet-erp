-- Migration: 00040_financial_transactions
-- Description: Finance Module 1 - Core ledger table for income and expenses
-- Module 1: Finance Core Tables

CREATE TABLE financial_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Direction
  direction             TEXT NOT NULL CHECK (direction IN ('income', 'expense')),

  -- For income: type of revenue
  income_type           TEXT CHECK (income_type IN (
    'subscription', 'sim_rental', 'sale', 'service', 'installation', 'maintenance', 'other'
  )),

  -- Amount (dual storage) — ALWAYS NET (KDV haric)
  amount_original       DECIMAL(12,2) NOT NULL,
  original_currency     TEXT NOT NULL DEFAULT 'TRY' CHECK (original_currency IN ('USD', 'TRY')),
  amount_try            DECIMAL(12,2) NOT NULL,
  exchange_rate         DECIMAL(10,4),

  -- VAT (direction-dependent, see convention below)
  -- Income: should_invoice is used, has_invoice must be NULL
  -- Expense: has_invoice is used, should_invoice must be NULL
  should_invoice        BOOLEAN,
  has_invoice           BOOLEAN,
  output_vat            DECIMAL(12,2),
  input_vat             DECIMAL(12,2),
  vat_rate              DECIMAL(5,2) DEFAULT 20,

  -- COGS (for income only — Option A: per-sale from proposal_items)
  cogs_try              DECIMAL(12,2),

  -- Period (auto-derived from transaction_date; extract+lpad is immutable)
  period                TEXT GENERATED ALWAYS AS (
    extract(year from transaction_date)::text || '-' || lpad(extract(month from transaction_date)::text, 2, '0')
  ) STORED,

  -- Core fields
  transaction_date      DATE NOT NULL,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  site_id               UUID REFERENCES customer_sites(id) ON DELETE SET NULL,
  description           TEXT,
  payment_method        TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),
  reference_no          TEXT,

  -- Links
  work_order_id         UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  proposal_id           UUID REFERENCES proposals(id) ON DELETE SET NULL,

  -- Invoice (Module 13+)
  invoice_no            TEXT,
  invoice_type          TEXT CHECK (invoice_type IN ('e_fatura', 'e_arsiv', 'kagit')),
  parasut_invoice_id    TEXT,

  -- Meta
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Direction-based flag convention:
  -- Income rows:  should_invoice = true/false, has_invoice = NULL
  -- Expense rows: has_invoice = true/false, should_invoice = NULL
  CONSTRAINT chk_direction_flags CHECK (
    (direction = 'income'  AND has_invoice IS NULL)
    OR
    (direction = 'expense' AND should_invoice IS NULL)
  )
);

CREATE INDEX idx_ft_direction ON financial_transactions(direction);
CREATE INDEX idx_ft_period ON financial_transactions(period);
CREATE INDEX idx_ft_date ON financial_transactions(transaction_date);
CREATE INDEX idx_ft_customer ON financial_transactions(customer_id);
CREATE INDEX idx_ft_work_order ON financial_transactions(work_order_id);
CREATE INDEX idx_ft_proposal ON financial_transactions(proposal_id);
CREATE INDEX idx_ft_should_invoice ON financial_transactions(should_invoice) WHERE should_invoice IS NOT NULL;
CREATE INDEX idx_ft_has_invoice ON financial_transactions(has_invoice) WHERE has_invoice IS NOT NULL;

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: admin and accountant have full access; field_worker cannot see financial data
CREATE POLICY "ft_select" ON financial_transactions FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_insert" ON financial_transactions FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_update" ON financial_transactions FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_delete" ON financial_transactions FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
