-- 00207_fix_pl_view_and_hybrid_payment_schema.sql
--
-- Bug Fix G1: Remove subscription_payments UNION from v_profit_and_loss.
--   Subscription revenue is captured by fn_subscription_payment_to_finance into
--   financial_transactions. Including subscription_payments in the UNION caused
--   double-counting in every P&L and dashboard aggregate.
--
-- Bug Fix G2: Add deleted_at IS NULL guard to both financial_transactions branches.
--   Soft-deleted rows were leaking into P&L totals.
--
-- Hybrid Payment Schema:
--   - ADD payment_status to financial_transactions (DEFAULT 'paid' for backward compat)
--   - CREATE financial_transaction_payments (1:many payment events per document)
--   - Trigger: recalculate payment_status on parent whenever a payment row changes

-- ── 1. Fix v_profit_and_loss ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_profit_and_loss AS

-- Income transactions
SELECT
  ft.id::TEXT                         AS source_id,
  COALESCE(ft.income_type, 'other')   AS source_type,
  'income'                            AS direction,
  ft.transaction_date                 AS period_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL::DECIMAL                       AS input_vat,
  ft.should_invoice                   AS is_official,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction  = 'income'
  AND ft.deleted_at IS NULL

UNION ALL

-- Expense transactions
SELECT
  ft.id::TEXT,
  COALESCE(ec.code, 'other'),
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
WHERE ft.direction  = 'expense'
  AND ft.deleted_at IS NULL;

GRANT SELECT ON v_profit_and_loss TO authenticated;

-- ── 2. Add payment_status to financial_transactions ───────────────────────────

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid'));

COMMENT ON COLUMN financial_transactions.payment_status IS
  'Hybrid payment model: paid = collected (default/historical); unpaid = bank transfer pending; partially_paid = one or more payments recorded but not fully settled.';

-- ── 3. Create financial_transaction_payments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_transaction_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID          NOT NULL
                               REFERENCES financial_transactions(id)
                               ON DELETE CASCADE,
  amount_try     DECIMAL(12,2) NOT NULL CHECK (amount_try > 0),
  payment_method TEXT          NOT NULL
                               CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
  paid_at        DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_by     UUID          REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ftp_transaction_id
  ON financial_transaction_payments(transaction_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ftp_paid_at
  ON financial_transaction_payments(paid_at)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE financial_transaction_payments IS
  'Payment events against a financial_transactions document. Supports partial payments and storno (soft-delete a payment row to reverse it). Trigger recalculates parent payment_status on every change.';

-- ── 4. RLS on financial_transaction_payments ──────────────────────────────────

ALTER TABLE financial_transaction_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ftp_select_authenticated" ON financial_transaction_payments;
CREATE POLICY "ftp_select_authenticated"
  ON financial_transaction_payments FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "ftp_insert_canwrite" ON financial_transaction_payments;
CREATE POLICY "ftp_insert_canwrite"
  ON financial_transaction_payments FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "ftp_update_canwrite" ON financial_transaction_payments;
CREATE POLICY "ftp_update_canwrite"
  ON financial_transaction_payments FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- ── 5. Trigger: maintain payment_status on parent document ────────────────────

CREATE OR REPLACE FUNCTION fn_update_transaction_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_id     UUID;
  v_doc_amount DECIMAL(12,2);
  v_paid_sum   DECIMAL(12,2);
  v_status     TEXT;
BEGIN
  -- Use transaction_id from whichever record is available
  v_doc_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  -- Fetch the document's net amount
  SELECT COALESCE(amount_try, 0)
  INTO v_doc_amount
  FROM financial_transactions
  WHERE id = v_doc_id;

  -- Sum all active (not soft-deleted) payments
  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_paid_sum
  FROM financial_transaction_payments
  WHERE transaction_id = v_doc_id
    AND deleted_at     IS NULL;

  -- Derive new status
  IF v_paid_sum <= 0 THEN
    v_status := 'unpaid';
  ELSIF v_doc_amount > 0 AND v_paid_sum >= v_doc_amount THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  UPDATE financial_transactions
  SET payment_status = v_status
  WHERE id = v_doc_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_transaction_payment_status
  ON financial_transaction_payments;

CREATE TRIGGER trg_update_transaction_payment_status
AFTER INSERT OR UPDATE OR DELETE ON financial_transaction_payments
FOR EACH ROW EXECUTE FUNCTION fn_update_transaction_payment_status();
