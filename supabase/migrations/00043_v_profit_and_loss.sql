-- Migration: 00043_v_profit_and_loss
-- Description: Finance Module 1 - P&L UNION view (subscription_payments + financial_transactions)
-- Module 1: Finance Core Tables
-- Includes 6-month billing COGS (cost × 6 for 6_month, cost × 12 for yearly)

CREATE OR REPLACE VIEW v_profit_and_loss AS
-- Subscription payments (recurring revenue)
SELECT
  sp.id::TEXT AS source_id,
  'subscription' AS source_type,
  'income' AS direction,
  sp.payment_month AS period_date,
  to_char(sp.payment_month, 'YYYY-MM') AS period,
  cs.customer_id,
  sub.site_id,
  sp.amount AS amount_try,           -- NET (KDV haric)
  sp.vat_amount AS output_vat,
  NULL::DECIMAL AS input_vat,
  sp.should_invoice AS is_official,
  'TRY' AS original_currency,
  sp.amount AS amount_original,
  NULL::DECIMAL AS exchange_rate,
  -- COGS: cost is always monthly, multiply by billing period months
  CASE
    WHEN sub.billing_frequency = 'yearly' THEN sub.cost * 12
    WHEN sub.billing_frequency = '6_month' THEN sub.cost * 6
    ELSE sub.cost
  END AS cogs_try,
  sp.payment_method,
  sp.created_at
FROM subscription_payments sp
JOIN subscriptions sub ON sp.subscription_id = sub.id
JOIN customer_sites cs ON sub.site_id = cs.id
WHERE sp.status = 'paid'

UNION ALL

-- Financial transactions (income)
SELECT
  ft.id::TEXT,
  COALESCE(ft.income_type, 'other'),
  'income',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,                     -- NET (KDV haric)
  ft.output_vat,
  NULL,
  ft.should_invoice,                 -- is_official for income
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,                       -- Per-sale COGS (Option A)
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'

UNION ALL

-- Financial transactions (expense)
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,                    -- Negative for P&L summation
  NULL,
  ft.input_vat,
  ft.has_invoice,                    -- is_official for expense
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,                              -- No COGS on expenses
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense';

GRANT SELECT ON v_profit_and_loss TO authenticated;
