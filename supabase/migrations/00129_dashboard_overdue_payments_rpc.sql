-- 00129_dashboard_overdue_payments_rpc.sql
-- RPC: get_overdue_subscription_payments()
-- Returns up to 20 subscription payments that are past-due (still pending/failed
-- but belong to a month before the current calendar month).
-- Used by Dashboard OverduePaymentsList card.

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
LANGUAGE sql
SECURITY DEFINER
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION get_overdue_subscription_payments() TO authenticated;
