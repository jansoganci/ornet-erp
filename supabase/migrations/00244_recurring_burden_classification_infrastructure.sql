-- 00244_recurring_burden_classification_infrastructure.sql
--
-- Phase 4 / Step 1: recurring expense burden classification infrastructure only.
--
-- Scope:
-- 1. Add burden_type classification to recurring templates.
-- 2. Snapshot burden_type onto recurring-generated financial_transactions rows.
-- 3. Backfill existing recurring templates / recurring-generated rows as unassigned.
-- 4. Preserve current recurring generation behavior and role-guard model.

BEGIN;

ALTER TABLE public.recurring_expense_templates
  ADD COLUMN IF NOT EXISTS burden_type TEXT NOT NULL DEFAULT 'unassigned';

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS burden_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_expense_templates_burden_type_check'
      AND conrelid = 'public.recurring_expense_templates'::regclass
  ) THEN
    ALTER TABLE public.recurring_expense_templates
      ADD CONSTRAINT recurring_expense_templates_burden_type_check
      CHECK (burden_type IN ('labor_burden', 'vehicle_burden', 'general_overhead', 'unassigned'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_transactions_burden_type_check'
      AND conrelid = 'public.financial_transactions'::regclass
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_burden_type_check
      CHECK (burden_type IN ('labor_burden', 'vehicle_burden', 'general_overhead', 'unassigned'));
  END IF;
END $$;

UPDATE public.recurring_expense_templates
SET burden_type = 'unassigned'
WHERE burden_type IS DISTINCT FROM 'unassigned'
  OR burden_type IS NULL;

UPDATE public.financial_transactions
SET burden_type = 'unassigned'
WHERE recurring_template_id IS NOT NULL
  AND burden_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_ret_burden_type
  ON public.recurring_expense_templates (burden_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ft_burden_type
  ON public.financial_transactions (burden_type)
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.fn_generate_recurring_expenses();

CREATE FUNCTION public.fn_generate_recurring_expenses()
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
    SELECT * FROM public.recurring_expense_templates
    WHERE is_active = true AND deleted_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.financial_transactions
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

    INSERT INTO public.financial_transactions (
      direction, original_currency, amount_original, amount_try,
      transaction_date, expense_category_id, payment_method,
      has_invoice, input_vat, vat_rate, description,
      status, recurring_template_id, burden_type
    ) VALUES (
      'expense', 'TRY', v_amount, v_amount,
      v_tx_date, v_template.expense_category_id, v_template.payment_method,
      v_template.has_invoice, v_input_vat, v_template.vat_rate, v_template.description_template,
      'confirmed', v_template.id, v_template.burden_type
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() TO service_role;

COMMIT;

-- REVERT:
-- BEGIN;
--
-- DROP FUNCTION IF EXISTS public.fn_generate_recurring_expenses();
--
-- CREATE FUNCTION public.fn_generate_recurring_expenses()
-- RETURNS INTEGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_template RECORD;
--   v_tx_date DATE;
--   v_last_day INTEGER;
--   v_current_month TEXT;
--   v_amount DECIMAL(12,2);
--   v_input_vat DECIMAL(12,2);
--   v_count INTEGER := 0;
-- BEGIN
--   v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');
--   v_last_day := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'));
--
--   FOR v_template IN
--     SELECT * FROM recurring_expense_templates
--     WHERE is_active = true AND deleted_at IS NULL
--   LOOP
--     IF EXISTS (
--       SELECT 1 FROM financial_transactions
--       WHERE recurring_template_id = v_template.id
--         AND period = v_current_month
--     ) THEN
--       CONTINUE;
--     END IF;
--
--     v_tx_date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 day' * (LEAST(v_template.day_of_month, v_last_day) - 1))::DATE;
--     v_amount := v_template.amount;
--
--     v_input_vat := NULL;
--     IF v_template.has_invoice = true THEN
--       v_input_vat := ROUND(v_amount * v_template.vat_rate / 100, 2);
--     END IF;
--
--     INSERT INTO financial_transactions (
--       direction, original_currency, amount_original, amount_try,
--       transaction_date, expense_category_id, payment_method,
--       has_invoice, input_vat, vat_rate, description,
--       status, recurring_template_id
--     ) VALUES (
--       'expense', 'TRY', v_amount, v_amount,
--       v_tx_date, v_template.expense_category_id, v_template.payment_method,
--       v_template.has_invoice, v_input_vat, v_template.vat_rate, v_template.description_template,
--       'confirmed', v_template.id
--     );
--
--     v_count := v_count + 1;
--   END LOOP;
--
--   RETURN v_count;
-- END;
-- $$;
--
-- REVOKE EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() FROM PUBLIC;
-- REVOKE EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() FROM authenticated;
-- GRANT EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() TO postgres;
-- GRANT EXECUTE ON FUNCTION public.fn_generate_recurring_expenses() TO service_role;
--
-- DROP INDEX IF EXISTS public.idx_ft_burden_type;
-- DROP INDEX IF EXISTS public.idx_ret_burden_type;
--
-- ALTER TABLE public.financial_transactions
--   DROP CONSTRAINT IF EXISTS financial_transactions_burden_type_check;
--
-- ALTER TABLE public.recurring_expense_templates
--   DROP CONSTRAINT IF EXISTS recurring_expense_templates_burden_type_check;
--
-- ALTER TABLE public.financial_transactions
--   DROP COLUMN IF EXISTS burden_type;
--
-- ALTER TABLE public.recurring_expense_templates
--   DROP COLUMN IF EXISTS burden_type;
--
-- COMMIT;
