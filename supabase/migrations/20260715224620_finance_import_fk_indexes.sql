-- Cover foreign keys introduced by the legacy finance import pipeline.
-- These keep parent-row updates/deletes and audit lookups indexed.
CREATE INDEX IF NOT EXISTS idx_finance_import_batches_created_by
  ON public.finance_import_batches (created_by);

CREATE INDEX IF NOT EXISTS idx_finance_import_links_payment
  ON public.finance_import_transaction_links (payment_id);
