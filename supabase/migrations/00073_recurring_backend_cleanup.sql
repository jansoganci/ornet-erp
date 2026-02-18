-- Migration: 00073_recurring_backend_cleanup
-- Description: Backend cleanup for recurring payments feature.
--   1. Remove dead OR ft.status IS NULL from P&L view (status is NOT NULL DEFAULT 'confirmed')
--   2. Remove unused recurring_expense_pending notification type
--   3. Add soft delete (deleted_at) to recurring_expense_templates
--   4. Update cron function to skip soft-deleted templates
--   5. Update RLS to exclude soft-deleted templates

-- ============================================================================
-- 1. FIX P&L VIEW — REMOVE DEAD NULL CHECK
-- ============================================================================

DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Subscription payments (recurring revenue)
SELECT
  sp.id::TEXT AS source_id,
  'subscription' AS source_type,
  'income' AS direction,
  sp.payment_month AS period_date,
  to_char(sp.payment_month, 'YYYY-MM') AS period,
  cs.customer_id,
  sub.site_id,
  sp.amount AS amount_try,
  sp.vat_amount AS output_vat,
  NULL::DECIMAL AS input_vat,
  sp.should_invoice AS is_official,
  'TRY' AS original_currency,
  sp.amount AS amount_original,
  NULL::DECIMAL AS exchange_rate,
  CASE
    WHEN sub.billing_frequency = 'yearly' THEN sub.cost * 12
    WHEN sub.billing_frequency = '6_month' THEN sub.cost * 6
    ELSE sub.cost
  END AS cogs_try,
  sp.payment_method,
  sp.created_at
FROM subscription_payments sp
JOIN subscriptions sub ON sp.subscription_id = sub.id
JOIN customer_sites cs ON sub.site_id = cs.id
WHERE sp.status = 'paid'

UNION ALL

-- Financial transactions (income) — only confirmed
SELECT
  ft.id::TEXT,
  COALESCE(ft.income_type, 'other'),
  'income',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL,
  ft.should_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND ft.status = 'confirmed'

UNION ALL

-- Financial transactions (expense) — only confirmed
SELECT
  ft.id::TEXT,
  ec.code,
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
WHERE ft.direction = 'expense'
  AND ft.status = 'confirmed';

GRANT SELECT ON v_profit_and_loss TO authenticated;

-- ============================================================================
-- 2. REMOVE UNUSED NOTIFICATION TYPE
-- ============================================================================

-- Remove recurring_expense_pending from type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'subscription_cancelled', 'subscription_paused', 'payment_due_soon',
  'renewal_due_soon', 'work_order_assigned', 'task_due_soon', 'user_reminder',
  'sim_card_cancelled'
));

-- Remove recurring_template from entity type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_entity_type_check CHECK (related_entity_type IN (
  'work_order', 'proposal', 'subscription', 'subscription_payment', 'task', 'reminder',
  'sim_card'
));

-- ============================================================================
-- 3. SOFT DELETE FOR RECURRING_EXPENSE_TEMPLATES
-- ============================================================================

ALTER TABLE recurring_expense_templates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index: fast lookups for non-deleted templates
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active
  ON recurring_expense_templates(is_active)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. UPDATE RLS — EXCLUDE SOFT-DELETED TEMPLATES
-- ============================================================================

-- Recreate SELECT policy to exclude deleted
DROP POLICY IF EXISTS recurring_templates_select ON recurring_expense_templates;
CREATE POLICY recurring_templates_select ON recurring_expense_templates
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'));

-- Recreate UPDATE policy to exclude deleted
DROP POLICY IF EXISTS recurring_templates_update ON recurring_expense_templates;
CREATE POLICY recurring_templates_update ON recurring_expense_templates
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'));

-- DELETE policy stays as-is (admin only) — hard delete is still possible for admins
-- INSERT policy stays as-is — new templates are always created without deleted_at

-- ============================================================================
-- 5. UPDATE CRON FUNCTION — SKIP SOFT-DELETED TEMPLATES
-- ============================================================================

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
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO authenticated;
