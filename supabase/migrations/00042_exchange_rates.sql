-- Migration: 00042_exchange_rates
-- Description: Finance Module 1 - TCMB exchange rate cache for USD/TRY conversion
-- Module 1: Finance Core Tables

CREATE TABLE exchange_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency        TEXT NOT NULL DEFAULT 'USD',
  buy_rate        DECIMAL(10,4),
  sell_rate       DECIMAL(10,4),
  effective_rate  DECIMAL(10,4) NOT NULL,
  rate_date       DATE NOT NULL,
  source          TEXT DEFAULT 'TCMB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency, rate_date)
);

CREATE INDEX idx_exchange_rate_date ON exchange_rates(rate_date DESC);
CREATE INDEX idx_exchange_currency ON exchange_rates(currency);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "er_select" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "er_manage" ON exchange_rates FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
