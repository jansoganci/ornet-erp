-- 00128_dashboard_revenue_rpc.sql
-- RPC: get_monthly_revenue_expense(months_back INT)
-- Returns last N months of income/expense totals from financial_transactions.
-- Used by Dashboard RevenueExpenseLineChart and sparkline cards.

CREATE OR REPLACE FUNCTION get_monthly_revenue_expense(months_back INT DEFAULT 7)
RETURNS TABLE (
  month   TEXT,
  revenue DECIMAL(12,2),
  expense DECIMAL(12,2)
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(d.month, 'YYYY-MM')                                                        AS month,
    COALESCE(SUM(CASE WHEN ft.direction = 'income'  THEN ft.amount_try ELSE 0 END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN ft.direction = 'expense' THEN ft.amount_try ELSE 0 END), 0) AS expense
  FROM (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE) - ((months_back - 1) || ' months')::INTERVAL,
      date_trunc('month', CURRENT_DATE),
      '1 month'::INTERVAL
    ) AS month
  ) d
  LEFT JOIN financial_transactions ft
    ON  date_trunc('month', ft.transaction_date) = d.month
    AND ft.deleted_at IS NULL
  GROUP BY d.month
  ORDER BY d.month ASC;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_revenue_expense(INT) TO authenticated;
