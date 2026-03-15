-- 00130_subscription_stats_unpaid_amount.sql
-- Add unpaid_total_amount to get_subscription_stats():
-- SUM(total_amount) of subscription_payments rows that are still
-- pending/failed and belong to a past calendar month.
-- Used by Dashboard "Tahsil Edilemeyen" KPI card.

CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result         JSON;
  v_last_month_end DATE;
BEGIN
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
      SELECT COALESCE(SUM(base_price + sms_fee + line_fee + static_ip_fee), 0)
      FROM subscriptions WHERE status = 'active'
    ),
    'mrr_previous_month', (
      SELECT COALESCE(SUM(s.base_price + s.sms_fee + s.line_fee + s.static_ip_fee), 0)
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
      SELECT COALESCE(SUM(total_amount), 0) FROM subscription_payments
      WHERE status IN ('pending', 'failed')
        AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_stats() TO authenticated;
