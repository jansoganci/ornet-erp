-- Migration: 00225_finance_rpc_role_guards
-- Audit fixes: A2 (finance/subscription read RPC role guards), A3 (recurring generation
-- revoke from authenticated), B10 (soft_delete_transaction stale roles).
-- Bodies and return shapes unchanged except authorization wrappers.

BEGIN;

-- ============================================================================
-- A2 — get_monthly_revenue_expense (plpgsql wrapper for role guard + search_path)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_monthly_revenue_expense(months_back INT DEFAULT 7)
RETURNS TABLE (
  month   TEXT,
  revenue DECIMAL(12,2),
  expense DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', COALESCE(v_role, 'unknown');
  END IF;

  RETURN QUERY
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
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_revenue_expense(INT) TO authenticated;

-- ============================================================================
-- A2 — get_subscription_stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role           TEXT;
  v_result         JSON;
  v_last_month_end DATE;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', COALESCE(v_role, 'unknown');
  END IF;

  v_last_month_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::DATE;

  SELECT json_build_object(
    'active_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'distinct_customer_count', (
      SELECT COUNT(DISTINCT cs.customer_id)
      FROM subscriptions s
      JOIN customer_sites cs ON s.site_id = cs.id
      WHERE s.status = 'active'
    ),
    'paused_count',    (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      SELECT COALESCE(
        SUM(
          base_price
          + sms_fee
          + line_fee
          + static_ip_fee
          + COALESCE(sim_amount, 0)
        ),
        0
      )
      FROM subscriptions
      WHERE status = 'active'
    ),
    'mrr_previous_month', (
      SELECT COALESCE(
        SUM(
          s.base_price
          + s.sms_fee
          + s.line_fee
          + s.static_ip_fee
          + COALESCE(s.sim_amount, 0)
        ),
        0
      )
      FROM subscriptions s
      WHERE s.start_date <= v_last_month_end
        AND (s.end_date IS NULL OR s.end_date >= v_last_month_end)
        AND (s.cancelled_at IS NULL OR s.cancelled_at::date > v_last_month_end)
        AND (
          s.paused_at IS NULL
          OR s.paused_at::date > v_last_month_end
          OR (s.reactivated_at IS NOT NULL AND s.reactivated_at::date <= v_last_month_end)
        )
    ),
    'active_count_previous_month', (
      SELECT COUNT(*)
      FROM subscriptions s
      WHERE s.start_date <= v_last_month_end
        AND (s.end_date IS NULL OR s.end_date >= v_last_month_end)
        AND (s.cancelled_at IS NULL OR s.cancelled_at::date > v_last_month_end)
        AND (
          s.paused_at IS NULL
          OR s.paused_at::date > v_last_month_end
          OR (s.reactivated_at IS NOT NULL AND s.reactivated_at::date <= v_last_month_end)
        )
    ),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'paid'
        AND should_invoice = TRUE
        AND invoice_no IS NULL
        AND payment_date < CURRENT_DATE - INTERVAL '7 days'
    ),
    'unpaid_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status IN ('pending', 'failed')
        AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    ),
    'unpaid_total_amount', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM subscription_payments
      WHERE status IN ('pending', 'failed')
        AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_stats() TO authenticated;

-- ============================================================================
-- A2 — get_overdue_subscription_payments
-- ============================================================================

CREATE OR REPLACE FUNCTION get_overdue_subscription_payments()
RETURNS TABLE (
  payment_id      UUID,
  subscription_id UUID,
  payment_month   DATE,
  amount          DECIMAL(10,2),
  total_amount    DECIMAL(10,2),
  customer_id     UUID,
  company_name    TEXT,
  site_name       TEXT,
  account_no      TEXT,
  months_overdue  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', COALESCE(v_role, 'unknown');
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.subscription_id,
    sp.payment_month,
    sp.amount,
    sp.total_amount,
    c.id,
    c.company_name,
    cs.site_name,
    cs.account_no,
    (
      EXTRACT(YEAR  FROM AGE(date_trunc('month', CURRENT_DATE), sp.payment_month))::INTEGER * 12 +
      EXTRACT(MONTH FROM AGE(date_trunc('month', CURRENT_DATE), sp.payment_month))::INTEGER
    ) AS months_overdue
  FROM subscription_payments sp
  JOIN subscriptions       sub ON sp.subscription_id = sub.id
  JOIN customer_sites      cs  ON sub.site_id        = cs.id
  JOIN customers           c   ON cs.customer_id     = c.id
  WHERE sp.status IN ('pending', 'failed')
    AND sp.payment_month < date_trunc('month', CURRENT_DATE)
  ORDER BY sp.payment_month ASC, c.company_name ASC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION get_overdue_subscription_payments() TO authenticated;

-- ============================================================================
-- A2 — get_overdue_invoices
-- ============================================================================

CREATE OR REPLACE FUNCTION get_overdue_invoices()
RETURNS TABLE (
  payment_id UUID,
  subscription_id UUID,
  payment_month DATE,
  payment_date DATE,
  total_amount DECIMAL(10,2),
  days_overdue INTEGER,
  company_name TEXT,
  account_no TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', COALESCE(v_role, 'unknown');
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.subscription_id,
    sp.payment_month,
    sp.payment_date,
    sp.total_amount,
    (CURRENT_DATE - sp.payment_date)::INTEGER,
    c.company_name,
    s.account_no
  FROM subscription_payments sp
  JOIN subscriptions sub ON sp.subscription_id = sub.id
  JOIN customer_sites s ON sub.site_id = s.id
  JOIN customers c ON s.customer_id = c.id
  WHERE sp.status = 'paid'
    AND sp.should_invoice = TRUE
    AND sp.invoice_no IS NULL
    AND sp.payment_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY sp.payment_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_overdue_invoices() TO authenticated;

-- ============================================================================
-- A3 — fn_generate_recurring_expenses: cron/service only (no authenticated)
-- pg_cron job recurring-expenses-daily (00070) runs as postgres — grant postgres.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION fn_generate_recurring_expenses() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_generate_recurring_expenses() FROM authenticated;

GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO postgres;
GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO service_role;

-- ============================================================================
-- B10 — soft_delete_transaction: admin/accountant only (drop manager/office)
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete_transaction(transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE financial_transactions
  SET deleted_at = now()
  WHERE id = transaction_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_transaction(UUID) TO authenticated;

COMMIT;
