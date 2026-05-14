-- Migration: 00213_tahsilat_views
-- Description: Tahsilat screen views — per-customer summary and per-document collection rows

CREATE OR REPLACE VIEW v_collection_customer_summary AS
SELECT
  c.id AS customer_id,
  c.company_name AS customer_name,
  COUNT(ft.id) AS document_count,
  COALESCE(SUM(ft.amount_try), 0) AS total_billed,
  COALESCE(SUM(ft.output_vat), 0) AS total_vat,
  COALESCE(SUM(ft.cogs_try), 0) AS total_cost,
  COALESCE(
    (SELECT SUM(ftp.amount)
     FROM financial_transaction_payments ftp
     WHERE ftp.transaction_id IN (
       SELECT ft2.id FROM financial_transactions ft2
       WHERE ft2.customer_id = c.id
         AND ft2.direction = 'income'
         AND ft2.deleted_at IS NULL
     )
       AND ftp.deleted_at IS NULL),
    0
  ) AS total_collected,
  COALESCE(SUM(ft.amount_try), 0) -
    COALESCE(
      (SELECT SUM(ftp.amount)
       FROM financial_transaction_payments ftp
       WHERE ftp.transaction_id IN (
         SELECT ft2.id FROM financial_transactions ft2
         WHERE ft2.customer_id = c.id
           AND ft2.direction = 'income'
           AND ft2.deleted_at IS NULL
       )
         AND ftp.deleted_at IS NULL),
      0
    ) AS outstanding,
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'unpaid') AS unpaid_count,
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'partial') AS partial_count,
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'paid') AS paid_count
FROM customers c
LEFT JOIN financial_transactions ft ON ft.customer_id = c.id
  AND ft.direction = 'income'
  AND ft.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_name
HAVING COUNT(ft.id) > 0
ORDER BY outstanding DESC;

CREATE OR REPLACE VIEW v_collection_documents AS
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
  COALESCE(
    (SELECT SUM(ftp.amount) FROM financial_transaction_payments ftp
     WHERE ftp.transaction_id = ft.id AND ftp.deleted_at IS NULL),
    0
  ) AS total_collected,
  ft.amount_try - COALESCE(
    (SELECT SUM(ftp.amount) FROM financial_transaction_payments ftp
     WHERE ftp.transaction_id = ft.id AND ftp.deleted_at IS NULL),
    0
  ) AS remaining,
  ft.work_order_id,
  ft.proposal_id,
  ft.subscription_payment_id,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN customers c ON c.id = ft.customer_id
WHERE ft.direction = 'income'
  AND ft.deleted_at IS NULL
ORDER BY ft.transaction_date DESC;
