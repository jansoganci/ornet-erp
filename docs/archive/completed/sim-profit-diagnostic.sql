-- =============================================================================
-- SIM Profit Discrepancy Diagnostic Queries
-- Run each section in Supabase SQL Editor and paste results for analysis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Zero-Cost SIMs (inflate profit: full sale_price counted as profit)
-- -----------------------------------------------------------------------------
SELECT phone_number, imsi, sale_price, cost_price, (sale_price - COALESCE(cost_price, 0)) AS profit
FROM sim_cards
WHERE deleted_at IS NULL
  AND status = 'active'
  AND (cost_price IS NULL OR cost_price = 0)
  AND COALESCE(sale_price, 0) > 0
ORDER BY (sale_price - COALESCE(cost_price, 0)) DESC;

-- Summary: total profit from zero-cost SIMs
SELECT COUNT(*) AS zero_cost_count,
       COALESCE(SUM(sale_price), 0) AS inflated_profit_from_zero_cost
FROM sim_cards
WHERE deleted_at IS NULL
  AND status = 'active'
  AND (cost_price IS NULL OR cost_price = 0)
  AND COALESCE(sale_price, 0) > 0;


-- -----------------------------------------------------------------------------
-- 2. Top 20 Profit Contributors
-- -----------------------------------------------------------------------------
SELECT phone_number, sale_price, cost_price, (COALESCE(sale_price, 0) - COALESCE(cost_price, 0)) AS profit
FROM sim_cards
WHERE deleted_at IS NULL AND status = 'active'
ORDER BY (COALESCE(sale_price, 0) - COALESCE(cost_price, 0)) DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- 3. View Logic Verification (NULL handling)
-- -----------------------------------------------------------------------------
-- In PostgreSQL: sale_price - NULL = NULL, and SUM ignores NULLs.
-- So rows with NULL cost_price contribute NOTHING to total_monthly_profit.
-- Rows with cost_price=0 contribute full sale_price (inflates profit).
SELECT
  COUNT(*) AS active_count,
  COALESCE(SUM(sale_price), 0) AS sum_revenue,
  COALESCE(SUM(cost_price), 0) AS sum_cost,
  COALESCE(SUM(sale_price - cost_price), 0) AS profit_raw,
  COALESCE(SUM(COALESCE(sale_price, 0) - COALESCE(cost_price, 0)), 0) AS profit_with_coalesce
FROM sim_cards
WHERE deleted_at IS NULL AND status = 'active';


-- -----------------------------------------------------------------------------
-- 4. Missing Rows Audit: Duplicate phone_number in DB (should be 0 with unique index)
-- -----------------------------------------------------------------------------
SELECT phone_number, COUNT(*) AS cnt
FROM sim_cards
WHERE deleted_at IS NULL
GROUP BY phone_number
HAVING COUNT(*) > 1;


-- -----------------------------------------------------------------------------
-- 5. Phone number format variations (could cause "duplicate" skips in import)
-- -----------------------------------------------------------------------------
-- Rows with similar-looking numbers (e.g. 0555 vs +90555 vs 555) - manual check
SELECT phone_number, sale_price, cost_price
FROM sim_cards
WHERE deleted_at IS NULL
ORDER BY REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '+', ''), '0', '')
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 6. Row count vs view_sim_card_financials
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM sim_cards WHERE deleted_at IS NULL AND status = 'active') AS active_sim_count,
  (SELECT active_sim_count FROM view_sim_card_financials) AS view_active_count,
  (SELECT total_monthly_profit FROM view_sim_card_financials) AS view_profit;


-- -----------------------------------------------------------------------------
-- 7. Soft-deleted rows (if any) - view may include these if RLS bypassed
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS soft_deleted_count FROM sim_cards WHERE deleted_at IS NOT NULL;
