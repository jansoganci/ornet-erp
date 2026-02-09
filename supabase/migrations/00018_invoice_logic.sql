-- Migration: 00018_invoice_logic
-- Description: Add conditional invoice logic for subscription payments
-- - should_invoice flag (card=always true, cash/bank=user choice)
-- - per-payment vat_rate override
-- - expand invoice_type to include 'kagit'
-- - update get_overdue_invoices to respect should_invoice

-- ============================================================================
-- 1. ADD COLUMNS
-- ============================================================================

ALTER TABLE subscription_payments ADD COLUMN should_invoice BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE subscription_payments ADD COLUMN payment_vat_rate DECIMAL(5,2);

-- ============================================================================
-- 2. EXPAND invoice_type CONSTRAINT TO INCLUDE 'kagit'
-- ============================================================================

ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_invoice_type_check;
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_invoice_type_check
  CHECK (invoice_type IN ('e_fatura', 'e_arsiv', 'kagit'));

-- ============================================================================
-- 3. UPDATE get_overdue_invoices() TO RESPECT should_invoice FLAG
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
LANGUAGE sql
SECURITY DEFINER
AS $$
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
$$;
