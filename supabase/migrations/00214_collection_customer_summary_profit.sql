-- Migration: collection customer summary total_profit column
-- For /finance/collections parent row: summed margin per customer (Σ net − Σ COGS TRY)
--
-- Note: PostgreSQL CREATE OR REPLACE VIEW cannot reorder/rename columns vs the existing view.
-- total_profit is appended last so positions 1..n match v_collection_customer_summary from 00213.

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
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'paid') AS paid_count,
  COALESCE(SUM(ft.amount_try - COALESCE(ft.cogs_try, 0)), 0) AS total_profit
FROM customers c
LEFT JOIN financial_transactions ft ON ft.customer_id = c.id
  AND ft.direction = 'income'
  AND ft.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_name
HAVING COUNT(ft.id) > 0
ORDER BY outstanding DESC;
