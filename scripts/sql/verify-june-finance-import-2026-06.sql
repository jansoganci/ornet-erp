-- Verification queries for the June 2026 historical finance import.
-- Keep the batch marker in sync with scripts/june-finance-import.mjs output.

\set batch_marker 'june-historical-import-2026-06-v1'

-- 1. Batch rows by direction and period
SELECT
  period,
  direction,
  COUNT(*) AS row_count,
  ROUND(COALESCE(SUM(amount_try), 0)::numeric, 2) AS amount_try_total,
  ROUND(COALESCE(SUM(output_vat), 0)::numeric, 2) AS output_vat_total,
  ROUND(COALESCE(SUM(input_vat), 0)::numeric, 2) AS input_vat_total
FROM public.financial_transactions
WHERE reference_no LIKE :'batch_marker' || ':%'
  AND deleted_at IS NULL
GROUP BY period, direction
ORDER BY period, direction;

-- 2. Confirm the batch stayed inside June 2026
SELECT
  COUNT(*) AS outside_period_count
FROM public.financial_transactions
WHERE reference_no LIKE :'batch_marker' || ':%'
  AND deleted_at IS NULL
  AND period <> '2026-06';

-- 3. Income rows by payment status
SELECT
  payment_status,
  COUNT(*) AS row_count,
  ROUND(COALESCE(SUM(amount_try), 0)::numeric, 2) AS net_sales_total,
  ROUND(COALESCE(SUM(output_vat), 0)::numeric, 2) AS output_vat_total
FROM public.financial_transactions
WHERE reference_no LIKE :'batch_marker' || ':income:%'
  AND deleted_at IS NULL
GROUP BY payment_status
ORDER BY payment_status;

-- 4. Income rows by income_type / service_category
SELECT
  income_type,
  service_category,
  COUNT(*) AS row_count,
  ROUND(COALESCE(SUM(amount_try), 0)::numeric, 2) AS net_sales_total,
  ROUND(COALESCE(SUM(cogs_try), 0)::numeric, 2) AS cogs_try_total
FROM public.financial_transactions
WHERE reference_no LIKE :'batch_marker' || ':income:%'
  AND deleted_at IS NULL
GROUP BY income_type, service_category
ORDER BY income_type, service_category;

-- 5. Expense rows should all map to the material category
SELECT
  ec.code AS expense_category_code,
  COUNT(*) AS row_count,
  ROUND(COALESCE(SUM(ft.amount_try), 0)::numeric, 2) AS amount_try_total,
  ROUND(COALESCE(SUM(ft.input_vat), 0)::numeric, 2) AS input_vat_total
FROM public.financial_transactions ft
LEFT JOIN public.expense_categories ec
  ON ec.id = ft.expense_category_id
WHERE ft.reference_no LIKE :'batch_marker' || ':expense:%'
  AND ft.deleted_at IS NULL
GROUP BY ec.code
ORDER BY ec.code;

-- 6. Payment rows created for paid income documents
SELECT
  COUNT(*) AS payment_row_count,
  ROUND(COALESCE(SUM(ftp.amount), 0)::numeric, 2) AS collected_gross_total
FROM public.financial_transaction_payments ftp
JOIN public.financial_transactions ft
  ON ft.id = ftp.transaction_id
WHERE ft.reference_no LIKE :'batch_marker' || ':income:%'
  AND ft.deleted_at IS NULL;

-- 7. Compare paid income docs to inserted payment rows
SELECT
  ft.reference_no,
  ft.transaction_date,
  ft.amount_try AS net_amount,
  COALESCE(ft.output_vat, 0) AS output_vat,
  ROUND(ft.amount_try + COALESCE(ft.output_vat, 0), 2) AS expected_gross_collection,
  ROUND(COALESCE(SUM(ftp.amount), 0)::numeric, 2) AS actual_payment_total
FROM public.financial_transactions ft
LEFT JOIN public.financial_transaction_payments ftp
  ON ftp.transaction_id = ft.id
 AND ftp.deleted_at IS NULL
WHERE ft.reference_no LIKE :'batch_marker' || ':income:%'
  AND ft.deleted_at IS NULL
  AND ft.payment_status = 'paid'
GROUP BY ft.reference_no, ft.transaction_date, ft.amount_try, ft.output_vat
ORDER BY ft.transaction_date, ft.reference_no;

-- 8. Spot-check imported rows
SELECT
  period,
  transaction_date,
  direction,
  income_type,
  service_category,
  amount_try,
  output_vat,
  input_vat,
  cogs_try,
  payment_status,
  reference_no,
  description
FROM public.financial_transactions
WHERE reference_no LIKE :'batch_marker' || ':%'
  AND deleted_at IS NULL
ORDER BY transaction_date, reference_no;
