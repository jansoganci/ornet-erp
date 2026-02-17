-- Migration: 00071_profit_loss_view_exclude_pending
-- Description: P&L view includes only confirmed financial_transactions.
--   Pending (unconfirmed) recurring expenses no longer reduce profit until confirmed.
--   Income and expense from financial_transactions: status = 'confirmed' OR status IS NULL (backwards compatibility).

DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Subscription payments (recurring revenue)
SELECT
  sp.id::TEXT AS source_id,
  'subscription' AS source_type,
  'income' AS direction,
  sp.payment_month AS period_date,
  to_char(sp.payment_month, 'YYYY-MM') AS period,
  cs.customer_id,
  sub.site_id,
  sp.amount AS amount_try,
  sp.vat_amount AS output_vat,
  NULL::DECIMAL AS input_vat,
  sp.should_invoice AS is_official,
  'TRY' AS original_currency,
  sp.amount AS amount_original,
  NULL::DECIMAL AS exchange_rate,
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

-- Financial transactions (income) — only confirmed
SELECT
  ft.id::TEXT,
  COALESCE(ft.income_type, 'other'),
  'income',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL,
  ft.should_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND (ft.status = 'confirmed' OR ft.status IS NULL)

UNION ALL

-- Financial transactions (expense) — only confirmed
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,
  NULL,
  ft.input_vat,
  ft.has_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense'
  AND (ft.status = 'confirmed' OR ft.status IS NULL);

GRANT SELECT ON v_profit_and_loss TO authenticated;
