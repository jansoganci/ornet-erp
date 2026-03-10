-- Migration: 00096_recurring_generation_return_count
-- Description: Recurring generation: return count + partial unique index for race-condition safety (optional but recommended)
--   1. Modify fn_generate_recurring_expenses to RETURN INTEGER (count of inserted rows)
--   2. Add partial unique index on (recurring_template_id, period) to prevent duplicates

-- ============================================================================
-- 1. PARTIAL UNIQUE INDEX — PREVENT RACE-CONDITION DUPLICATES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_recurring_template_period
ON financial_transactions (recurring_template_id, period)
WHERE recurring_template_id IS NOT NULL;

-- ============================================================================
-- 2. UPDATE FUNCTION — RETURN COUNT OF INSERTED ROWS
-- ============================================================================
-- Must DROP first because PostgreSQL cannot change return type with CREATE OR REPLACE

DROP FUNCTION IF EXISTS fn_generate_recurring_expenses();

CREATE FUNCTION fn_generate_recurring_expenses()
RETURNS INTEGER
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
  v_count INTEGER := 0;
BEGIN
  v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  v_last_day := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'));

  FOR v_template IN
    SELECT * FROM recurring_expense_templates
    WHERE is_active = true AND deleted_at IS NULL
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
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO authenticated;
