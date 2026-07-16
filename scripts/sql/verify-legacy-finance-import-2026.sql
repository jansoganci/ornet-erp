-- Read-only verification for the audited 2026 legacy finance import.
-- Run after post_finance_import_batch() with the intended import key.

WITH batch AS (
  SELECT id, import_key, status, source_row_count, validation_summary, posting_summary
  FROM public.finance_import_batches
  WHERE import_key = 'legacy-finance-2026-v1'
)
SELECT
  b.import_key,
  b.status,
  b.source_row_count,
  COUNT(r.id) AS staged_rows,
  COUNT(r.id) FILTER (WHERE r.row_status = 'posted') AS posted_rows,
  COUNT(r.id) FILTER (WHERE r.collection_status = 'collected') AS collected_rows,
  COUNT(r.id) FILTER (WHERE r.collection_status = 'unknown') AS unknown_rows,
  COUNT(r.id) FILTER (
    WHERE r.collection_status = 'collected'
      AND r.amount_try + r.output_vat = 0
  ) AS zero_gross_collected_rows,
  COUNT(r.id) FILTER (WHERE r.cogs_try > 0) AS cogs_rows,
  COALESCE(SUM(r.amount_try), 0) AS net_total_try,
  COALESCE(SUM(r.output_vat), 0) AS output_vat_total_try,
  COALESCE(SUM(r.input_vat), 0) AS input_vat_total_try,
  COALESCE(SUM(r.cogs_try), 0) AS cogs_total_try,
  COALESCE(SUM(r.amount_try + r.output_vat), 0) AS gross_total_try,
  COALESCE(SUM(r.amount_try + r.output_vat) FILTER (WHERE r.collection_status = 'collected'), 0) AS collected_gross_total_try,
  b.posting_summary
FROM batch b
LEFT JOIN public.finance_import_rows r ON r.batch_id = b.id
GROUP BY b.id, b.import_key, b.status, b.source_row_count, b.posting_summary;

WITH batch AS (
  SELECT id
  FROM public.finance_import_batches
  WHERE import_key = 'legacy-finance-2026-v1'
)
SELECT
  COUNT(*) AS transaction_links,
  COUNT(l.income_transaction_id) AS income_transactions,
  COUNT(l.cogs_transaction_id) AS cogs_transactions,
  COUNT(l.payment_id) AS payment_links,
  COUNT(*) FILTER (WHERE income.payment_status = 'paid') AS paid_income_transactions,
  COUNT(*) FILTER (WHERE income.payment_status = 'unknown') AS unknown_income_transactions,
  COUNT(*) FILTER (WHERE income.should_invoice IS TRUE) AS official_income_transactions,
  COUNT(*) FILTER (WHERE income.parasut_sync_status = 'not_required') AS parasut_not_required_income,
  COUNT(*) FILTER (WHERE cogs.has_invoice IS TRUE) AS official_cogs_transactions,
  COUNT(*) FILTER (WHERE cogs.payment_status = 'paid') AS paid_cogs_transactions,
  COALESCE(SUM(income.amount_try), 0) AS linked_net_total_try,
  COALESCE(SUM(income.output_vat), 0) AS linked_output_vat_total_try,
  COALESCE(SUM(cogs.amount_try), 0) AS linked_cogs_total_try,
  COALESCE(SUM(cogs.input_vat), 0) AS linked_input_vat_total_try,
  COALESCE(SUM(income.amount_try + COALESCE(income.output_vat, 0)), 0) AS linked_gross_total_try,
  COALESCE(SUM(ftp.amount_try), 0) AS linked_payment_total_try
FROM public.finance_import_transaction_links l
JOIN batch b ON b.id = l.batch_id
JOIN public.financial_transactions income ON income.id = l.income_transaction_id
LEFT JOIN public.financial_transactions cogs ON cogs.id = l.cogs_transaction_id
LEFT JOIN public.financial_transaction_payments ftp
  ON ftp.id = l.payment_id
 AND ftp.deleted_at IS NULL;

-- This query must return zero rows. It validates the full paired ledger shape,
-- collection state, and the special zero-gross collected source line.
WITH batch AS (
  SELECT id
  FROM public.finance_import_batches
  WHERE import_key = 'legacy-finance-2026-v1'
)
SELECT
  r.source_row,
  r.collection_status,
  r.amount_try,
  r.output_vat,
  r.cogs_try,
  r.input_vat,
  income.reference_no AS income_reference_no,
  cogs.reference_no AS cogs_reference_no,
  income.payment_status AS income_payment_status,
  cogs.payment_status AS cogs_payment_status,
  ftp.amount_try AS payment_amount_try
FROM public.finance_import_rows r
JOIN batch b ON b.id = r.batch_id
JOIN public.finance_import_transaction_links l ON l.import_row_id = r.id
LEFT JOIN public.financial_transactions income ON income.id = l.income_transaction_id
LEFT JOIN public.financial_transactions cogs ON cogs.id = l.cogs_transaction_id
LEFT JOIN public.financial_transaction_payments ftp
  ON ftp.id = l.payment_id
 AND ftp.deleted_at IS NULL
LEFT JOIN public.expense_categories ec ON ec.id = cogs.expense_category_id
WHERE
  income.id IS NULL
  OR income.direction <> 'income'
  OR income.amount_try <> r.amount_try
  OR COALESCE(income.output_vat, 0) <> r.output_vat
  OR COALESCE(income.cogs_try, 0) <> r.cogs_try
  OR income.should_invoice IS DISTINCT FROM TRUE
  OR income.parasut_sync_status <> 'not_required'
  OR (r.collection_status = 'collected' AND income.payment_status <> 'paid')
  OR (r.collection_status = 'unknown' AND income.payment_status <> 'unknown')
  OR (r.collection_status = 'unknown' AND l.payment_id IS NOT NULL)
  OR (
    r.collection_status = 'collected'
    AND r.amount_try + r.output_vat = 0
    AND l.payment_id IS NOT NULL
  )
  OR (
    r.collection_status = 'collected'
    AND r.amount_try + r.output_vat > 0
    AND (
      ftp.id IS NULL
      OR ftp.amount_try <> r.amount_try + r.output_vat
    )
  )
  OR (
    r.cogs_try > 0
    AND (
      cogs.id IS NULL
      OR cogs.direction <> 'expense'
      OR cogs.amount_try <> r.cogs_try
      OR COALESCE(cogs.input_vat, 0) <> r.input_vat
      OR cogs.has_invoice IS DISTINCT FROM TRUE
      OR cogs.payment_status <> 'paid'
      OR ec.code <> 'material'
    )
  )
  OR (r.cogs_try = 0 AND l.cogs_transaction_id IS NOT NULL)
ORDER BY r.source_row;

-- This query must return zero rows. All mappings remain current exact canonical
-- matches, not fuzzy matches or auto-created customers.
WITH batch AS (
  SELECT id
  FROM public.finance_import_batches
  WHERE import_key = 'legacy-finance-2026-v1'
)
SELECT
  m.customer_raw,
  m.matched_customer_name,
  m.match_status,
  c.company_name AS live_customer_name
FROM public.customer_import_mappings m
JOIN batch b ON b.id = m.batch_id
LEFT JOIN public.customers c
  ON c.id = m.customer_id
 AND c.deleted_at IS NULL
WHERE m.match_status <> 'matched'
   OR c.id IS NULL
   OR c.company_name_search <> public.normalize_tr_for_search(m.matched_customer_name)
ORDER BY m.customer_raw;

-- This query must return zero rows. Unknown legacy collection records must not
-- leak into collection/receivable views.
WITH batch AS (
  SELECT id
  FROM public.finance_import_batches
  WHERE import_key = 'legacy-finance-2026-v1'
)
SELECT
  r.source_row,
  income.reference_no,
  income.payment_status
FROM public.finance_import_rows r
JOIN batch b ON b.id = r.batch_id
JOIN public.finance_import_transaction_links l ON l.import_row_id = r.id
JOIN public.financial_transactions income ON income.id = l.income_transaction_id
JOIN public.v_collection_documents d ON d.transaction_id = income.id
WHERE r.collection_status = 'unknown'
ORDER BY r.source_row;

-- This query must return zero rows. It covers both income and paired COGS
-- reference numbers, which are protected by the partial legacy-reference index.
SELECT reference_no, COUNT(*) AS active_count
FROM public.financial_transactions
WHERE deleted_at IS NULL
  AND reference_no LIKE 'LEGACY-2026-%'
GROUP BY reference_no
HAVING COUNT(*) > 1;
