-- Migration: 00044_fix_arpc_distinct_customers
-- Description: ARPC = MRR / distinct customers (not subscription count)
-- Fix: Add distinct_customer_count to get_subscription_stats()

CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'active_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'distinct_customer_count', (
      SELECT COUNT(DISTINCT cs.customer_id)
      FROM subscriptions s
      JOIN customer_sites cs ON s.site_id = cs.id
      WHERE s.status = 'active'
    ),
    'paused_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      SELECT COALESCE(SUM(base_price + sms_fee + line_fee), 0)
      FROM subscriptions WHERE status = 'active'
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
      WHERE status = 'pending' AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
