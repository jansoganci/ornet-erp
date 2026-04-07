-- Migration: 00202_monthly_sim_finance_cron
-- Description: Monthly aggregated SIM card income/expense to financial_transactions.
--   Runs on 1st of each month at 02:00 UTC, writes previous month's totals.
--   Replaces per-SIM trigger approach with monthly batch for ~3000 SIM cards.
-- Prerequisites: pg_cron extension (already enabled in 00053)

-- ============================================================================
-- 1. FUNCTION: generate_monthly_sim_finance()
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_monthly_sim_finance()
RETURNS TABLE (
  period_generated TEXT,
  income_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period           TEXT;
  v_period_date      DATE;
  v_month_name       TEXT;
  v_income_sum       DECIMAL(12,2);
  v_expense_sum      DECIMAL(12,2);
  v_expense_cat_id   UUID;
  v_income_exists    BOOLEAN;
  v_expense_exists   BOOLEAN;
  v_active_count     INTEGER;
  v_available_count  INTEGER;
BEGIN
  -- Calculate previous month period (YYYY-MM)
  v_period_date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
  v_period := to_char(v_period_date, 'YYYY-MM');
  
  -- Turkish month name for description (e.g., 'Mart 2026')
  v_month_name := to_char(v_period_date, 'TMMonth YYYY');
  
  RAISE NOTICE 'generate_monthly_sim_finance: Processing period %', v_period;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. IDEMPOTENCY CHECK
  -- ──────────────────────────────────────────────────────────────────────────
  
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE period = v_period
      AND direction = 'income'
      AND income_type = 'sim_rental'
      AND sim_card_id IS NULL
      AND description ILIKE '%SIM Kart Kiralama Geliri%'
    LIMIT 1
  ) INTO v_income_exists;
  
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE period = v_period
      AND direction = 'expense'
      AND expense_category_id IN (SELECT id FROM expense_categories WHERE code = 'sim_operator')
      AND sim_card_id IS NULL
      AND description ILIKE '%SIM Kart Operatör Gideri%'
    LIMIT 1
  ) INTO v_expense_exists;
  
  IF v_income_exists AND v_expense_exists THEN
    RAISE NOTICE 'generate_monthly_sim_finance: Period % already processed, skipping', v_period;
    RETURN QUERY SELECT v_period, 0::DECIMAL(12,2), 0::DECIMAL(12,2), 'skipped (already exists)'::TEXT;
    RETURN;
  END IF;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. CALCULATE INCOME (active SIMs only)
  -- ──────────────────────────────────────────────────────────────────────────
  
  SELECT
    COALESCE(SUM(sale_price), 0),
    COUNT(*)
  INTO v_income_sum, v_active_count
  FROM sim_cards
  WHERE status = 'active'
    AND deleted_at IS NULL
    AND COALESCE(sale_price, 0) > 0;
  
  RAISE NOTICE 'generate_monthly_sim_finance: Active SIMs: %, Total income: %', v_active_count, v_income_sum;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 4. CALCULATE EXPENSE (active + available SIMs)
  -- ──────────────────────────────────────────────────────────────────────────
  
  SELECT
    COALESCE(SUM(cost_price), 0),
    COUNT(*)
  INTO v_expense_sum, v_available_count
  FROM sim_cards
  WHERE status IN ('active', 'available')
    AND deleted_at IS NULL
    AND COALESCE(cost_price, 0) > 0;
  
  RAISE NOTICE 'generate_monthly_sim_finance: Active+Available SIMs: %, Total expense: %', v_available_count, v_expense_sum;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 5. GET EXPENSE CATEGORY ID
  -- ──────────────────────────────────────────────────────────────────────────
  
  SELECT id INTO v_expense_cat_id
  FROM expense_categories
  WHERE code = 'sim_operator'
  LIMIT 1;
  
  IF v_expense_cat_id IS NULL THEN
    RAISE WARNING 'generate_monthly_sim_finance: expense_category "sim_operator" not found, skipping expense record';
  END IF;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 6. INSERT INCOME RECORD (if not exists and amount > 0)
  -- ──────────────────────────────────────────────────────────────────────────
  
  IF NOT v_income_exists AND v_income_sum > 0 THEN
    INSERT INTO financial_transactions (
      direction,
      income_type,
      sim_card_id,
      amount_original,
      original_currency,
      amount_try,
      exchange_rate,
      should_invoice,
      output_vat,
      vat_rate,
      transaction_date,
      customer_id,
      site_id,
      description,
      created_at,
      updated_at
    ) VALUES (
      'income',
      'sim_rental',
      NULL,  -- Toplu kayıt, tek SIM'e ait değil
      v_income_sum,
      'TRY',
      v_income_sum,
      NULL,
      true,
      0,  -- SIM vat_rate = 0 (00182)
      0,
      v_period_date,
      NULL,  -- Toplu kayıt, tek müşteriye ait değil
      NULL,
      'SIM Kart Kiralama Geliri - ' || v_month_name || ' (' || v_active_count || ' adet)',
      now(),
      now()
    );
    
    RAISE NOTICE 'generate_monthly_sim_finance: Income record created: % TRY', v_income_sum;
  ELSE
    RAISE NOTICE 'generate_monthly_sim_finance: Income record skipped (exists: %, amount: %)', v_income_exists, v_income_sum;
  END IF;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 7. INSERT EXPENSE RECORD (if not exists and amount > 0)
  -- ──────────────────────────────────────────────────────────────────────────
  
  IF NOT v_expense_exists AND v_expense_sum > 0 AND v_expense_cat_id IS NOT NULL THEN
    INSERT INTO financial_transactions (
      direction,
      expense_category_id,
      sim_card_id,
      amount_original,
      original_currency,
      amount_try,
      exchange_rate,
      has_invoice,
      input_vat,
      vat_rate,
      transaction_date,
      customer_id,
      site_id,
      description,
      created_at,
      updated_at
    ) VALUES (
      'expense',
      v_expense_cat_id,
      NULL,  -- Toplu kayıt
      v_expense_sum,
      'TRY',
      v_expense_sum,
      NULL,
      false,  -- İç maliyet, gerçek fatura yok
      NULL,   -- İç maliyet için input_vat NULL (proje kuralı)
      0,
      v_period_date,
      NULL,
      NULL,
      'SIM Kart Operatör Gideri - ' || v_month_name || ' (' || v_available_count || ' adet)',
      now(),
      now()
    );
    
    RAISE NOTICE 'generate_monthly_sim_finance: Expense record created: % TRY', v_expense_sum;
  ELSE
    RAISE NOTICE 'generate_monthly_sim_finance: Expense record skipped (exists: %, amount: %, cat_id: %)', v_expense_exists, v_expense_sum, v_expense_cat_id;
  END IF;
  
  -- ──────────────────────────────────────────────────────────────────────────
  -- 8. RETURN SUMMARY
  -- ──────────────────────────────────────────────────────────────────────────
  
  RETURN QUERY SELECT
    v_period,
    v_income_sum,
    v_expense_sum,
    'completed'::TEXT;
END;
$$;

COMMENT ON FUNCTION generate_monthly_sim_finance() IS 
  'Monthly batch: writes aggregated SIM income (active) and expense (active+available) to financial_transactions. Runs on 1st of month at 02:00 UTC via pg_cron.';

-- Grant execute to postgres (cron runs as postgres)
GRANT EXECUTE ON FUNCTION generate_monthly_sim_finance() TO postgres;

-- ============================================================================
-- 2. SCHEDULE CRON JOB
-- ============================================================================

-- Unschedule existing job if present (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('generate-monthly-sim-finance');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job may not exist
END $$;

-- Schedule: 1st of every month at 02:00 UTC
SELECT cron.schedule(
  'generate-monthly-sim-finance',
  '0 2 1 * *',  -- minute hour day month weekday
  $$
  SELECT generate_monthly_sim_finance();
  $$
);

-- ============================================================================
-- 3. VERIFY CRON JOB
-- ============================================================================

-- Check scheduled jobs (run this in SQL Editor after migration)
-- SELECT * FROM cron.job WHERE jobname = 'generate-monthly-sim-finance';

-- ============================================================================
-- 4. BACKFILL / MANUAL TRIGGER
-- ============================================================================

-- To manually generate records for the previous month (e.g., for testing or backfill):
-- SELECT * FROM generate_monthly_sim_finance();

-- To backfill multiple past months (run one by one, adjust period manually):
/*
-- Example: Generate for March 2026
INSERT INTO financial_transactions (
  direction, income_type, sim_card_id,
  amount_original, original_currency, amount_try, exchange_rate,
  should_invoice, output_vat, vat_rate,
  transaction_date, customer_id, site_id, description,
  created_at, updated_at
)
SELECT
  'income',
  'sim_rental',
  NULL,
  COALESCE(SUM(sale_price), 0),
  'TRY',
  COALESCE(SUM(sale_price), 0),
  NULL,
  true,
  0,
  0,
  '2026-03-01'::DATE,
  NULL,
  NULL,
  'SIM Kart Kiralama Geliri - Mart 2026 (' || COUNT(*) || ' adet)',
  now(),
  now()
FROM sim_cards
WHERE status = 'active'
  AND deleted_at IS NULL
  AND COALESCE(sale_price, 0) > 0;

INSERT INTO financial_transactions (
  direction, expense_category_id, sim_card_id,
  amount_original, original_currency, amount_try, exchange_rate,
  has_invoice, input_vat, vat_rate,
  transaction_date, customer_id, site_id, description,
  created_at, updated_at
)
SELECT
  'expense',
  (SELECT id FROM expense_categories WHERE code = 'sim_operator' LIMIT 1),
  NULL,
  COALESCE(SUM(cost_price), 0),
  'TRY',
  COALESCE(SUM(cost_price), 0),
  NULL,
  false,
  NULL,
  0,
  '2026-03-01'::DATE,
  NULL,
  NULL,
  'SIM Kart Operatör Gideri - Mart 2026 (' || COUNT(*) || ' adet)',
  now(),
  now()
FROM sim_cards
WHERE status IN ('active', 'available')
  AND deleted_at IS NULL
  AND COALESCE(cost_price, 0) > 0;
*/

-- ============================================================================
-- 5. MONITORING
-- ============================================================================

-- View cron job execution history (last 10 runs)
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-monthly-sim-finance')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- Check if current month already has SIM finance records
-- SELECT 
--   period,
--   direction,
--   income_type,
--   expense_category_id,
--   amount_try,
--   description
-- FROM financial_transactions
-- WHERE period = to_char(date_trunc('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
--   AND sim_card_id IS NULL
--   AND (
--     (direction = 'income' AND income_type = 'sim_rental')
--     OR
--     (direction = 'expense' AND expense_category_id IN (SELECT id FROM expense_categories WHERE code = 'sim_operator'))
--   )
-- ORDER BY direction;
