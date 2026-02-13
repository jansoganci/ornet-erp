-- Migration: 00038_fix_stats_mrr_net
-- Description: Fix get_subscription_stats() MRR calculation
-- Bug: MRR was using GROSS amounts (with VAT) instead of NET (KDV haric)
-- Bug: MRR only handled 'annual' subscription_type, not billing_frequency
-- Fix: Since base_price/sms_fee/line_fee are ALWAYS monthly NET amounts,
--       MRR = SUM(base_price + sms_fee + line_fee) — no CASE, no VAT

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
    'paused_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      -- MRR = Monthly Recurring Revenue (NET, KDV haric)
      -- base_price, sms_fee, line_fee are ALWAYS monthly amounts
      -- regardless of billing_frequency (monthly, 6_month, yearly)
      -- No division needed. No VAT multiplication.
      SELECT COALESCE(SUM(base_price + sms_fee + line_fee), 0)
      FROM subscriptions
      WHERE status = 'active'
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
