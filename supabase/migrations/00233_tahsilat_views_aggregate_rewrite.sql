-- Migration: 00233_tahsilat_views_aggregate_rewrite
-- B5: rewrite Tahsilat views to avoid correlated payment subqueries.
-- Keeps existing output columns while aggregating payments in one pass.

CREATE OR REPLACE VIEW v_collection_documents AS
WITH payment_totals AS (
  SELECT
    ftp.transaction_id,
    COALESCE(SUM(ftp.amount), 0) AS total_collected
  FROM financial_transaction_payments ftp
  WHERE ftp.deleted_at IS NULL
  GROUP BY ftp.transaction_id
)
SELECT
  ft.id AS transaction_id,
  c.id AS customer_id,
  c.company_name AS customer_name,
  ft.service_category,
  ft.income_type,
  ft.transaction_date,
  ft.description,
  ft.amount_try AS sale_price_net,
  ft.output_vat AS vat_amount,
  ft.amount_try + COALESCE(ft.output_vat, 0) AS total_with_vat,
  ft.cogs_try AS cost,
  ft.amount_try - COALESCE(ft.cogs_try, 0) AS profit,
  ft.original_currency,
  ft.amount_original,
  ft.payment_status,
  COALESCE(pt.total_collected, 0) AS total_collected,
  ft.amount_try - COALESCE(pt.total_collected, 0) AS remaining,
  ft.work_order_id,
  ft.proposal_id,
  ft.subscription_payment_id,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN customers c ON c.id = ft.customer_id
LEFT JOIN payment_totals pt ON pt.transaction_id = ft.id
WHERE ft.direction = 'income'
  AND ft.deleted_at IS NULL
ORDER BY ft.transaction_date DESC;

CREATE OR REPLACE VIEW v_collection_customer_summary AS
WITH payment_totals AS (
  SELECT
    ftp.transaction_id,
    COALESCE(SUM(ftp.amount), 0) AS total_collected
  FROM financial_transaction_payments ftp
  WHERE ftp.deleted_at IS NULL
  GROUP BY ftp.transaction_id
),
income_docs AS (
  SELECT
    ft.id,
    ft.customer_id,
    ft.amount_try,
    ft.output_vat,
    ft.cogs_try,
    ft.payment_status,
    COALESCE(pt.total_collected, 0) AS total_collected
  FROM financial_transactions ft
  LEFT JOIN payment_totals pt ON pt.transaction_id = ft.id
  WHERE ft.direction = 'income'
    AND ft.deleted_at IS NULL
),
customer_agg AS (
  SELECT
    customer_id,
    COUNT(id) AS document_count,
    COALESCE(SUM(amount_try), 0) AS total_billed,
    COALESCE(SUM(output_vat), 0) AS total_vat,
    COALESCE(SUM(cogs_try), 0) AS total_cost,
    COALESCE(SUM(total_collected), 0) AS total_collected,
    COALESCE(SUM(amount_try), 0) - COALESCE(SUM(total_collected), 0) AS outstanding,
    COUNT(id) FILTER (WHERE payment_status = 'unpaid') AS unpaid_count,
    COUNT(id) FILTER (WHERE payment_status = 'partial') AS partial_count,
    COUNT(id) FILTER (WHERE payment_status = 'paid') AS paid_count,
    COALESCE(SUM(amount_try - COALESCE(cogs_try, 0)), 0) AS total_profit
  FROM income_docs
  GROUP BY customer_id
)
SELECT
  c.id AS customer_id,
  c.company_name AS customer_name,
  ca.document_count,
  ca.total_billed,
  ca.total_vat,
  ca.total_cost,
  ca.total_collected,
  ca.outstanding,
  ca.unpaid_count,
  ca.partial_count,
  ca.paid_count,
  ca.total_profit
FROM customers c
JOIN customer_agg ca ON ca.customer_id = c.id
WHERE c.deleted_at IS NULL
ORDER BY ca.outstanding DESC;
