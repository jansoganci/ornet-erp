-- Migration: 00072_recurring_direct_confirm
-- Description: Recurring expenses are created directly as confirmed (no pending step).
--   Template creation = user approval. Cron creates status='confirmed'.
--   Removes notification logic for pending recurring expenses.

-- 1. Confirm any existing pending recurring expenses
UPDATE financial_transactions
SET status = 'confirmed'
WHERE status = 'pending'
  AND recurring_template_id IS NOT NULL;

-- 2. Resolve any existing pending notifications (no longer relevant)
UPDATE notifications
SET resolved_at = now()
WHERE dedup_key LIKE 'recurring_expense_pending::%'
  AND resolved_at IS NULL;

-- 3. Update cron function: insert status='confirmed', remove notification logic
CREATE OR REPLACE FUNCTION fn_generate_recurring_expenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_tx_date DATE;
  v_last_day INTEGER;
  v_current_month TEXT;
  v_amount DECIMAL(12,2);
  v_input_vat DECIMAL(12,2);
BEGIN
  v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  v_last_day := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'));

  FOR v_template IN
    SELECT * FROM recurring_expense_templates WHERE is_active = true
  LOOP
    IF EXISTS (
      SELECT 1 FROM financial_transactions
      WHERE recurring_template_id = v_template.id
        AND period = v_current_month
    ) THEN
      CONTINUE;
    END IF;

    v_tx_date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 day' * (LEAST(v_template.day_of_month, v_last_day) - 1))::DATE;
    v_amount := v_template.amount;

    v_input_vat := NULL;
    IF v_template.has_invoice = true THEN
      v_input_vat := ROUND(v_amount * v_template.vat_rate / 100, 2);
    END IF;

    INSERT INTO financial_transactions (
      direction, original_currency, amount_original, amount_try,
      transaction_date, expense_category_id, payment_method,
      has_invoice, input_vat, vat_rate, description,
      status, recurring_template_id
    ) VALUES (
      'expense', 'TRY', v_amount, v_amount,
      v_tx_date, v_template.expense_category_id, v_template.payment_method,
      v_template.has_invoice, v_input_vat, v_template.vat_rate, v_template.description_template,
      'confirmed', v_template.id
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO authenticated;
