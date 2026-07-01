-- Migration: 00238_disable_sim_finance_ledger_generation
-- Description: Decouple SIM operational tracking from finance ledger generation.
--   - Unschedule pg_cron job generate-monthly-sim-finance
--   - Redefine generate_monthly_sim_finance() as summary-only / no-op
--
-- Business rule:
--   SIM module remains operational, but must not automatically mutate
--   financial_transactions. Real operator invoices are entered separately
--   through finance recurring expenses.

BEGIN;

DO $$
BEGIN
  PERFORM cron.unschedule('generate-monthly-sim-finance');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION generate_monthly_sim_finance()
RETURNS TABLE (
  period_generated TEXT,
  income_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  result_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period      TEXT;
  v_period_date DATE;
BEGIN
  v_period_date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
  v_period := to_char(v_period_date, 'YYYY-MM');

  RETURN QUERY
  SELECT
    v_period,
    0::DECIMAL(12,2),
    0::DECIMAL(12,2),
    'disabled_no_ledger_write'::TEXT;
END;
$$;

COMMENT ON FUNCTION generate_monthly_sim_finance() IS
  'SIM finance ledger generation disabled. Function returns a summary-only status and does not write to financial_transactions.';

COMMIT;
