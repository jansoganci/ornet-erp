-- Migration: 00070_recurring_expenses
-- Description: Recurring expense templates + auto-generation cron + pending/confirmed status on transactions
-- Phase 1 of recurring expenses feature

-- ============================================================================
-- 1. ADD STATUS + RECURRING_TEMPLATE_ID TO FINANCIAL_TRANSACTIONS
-- ============================================================================

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed'));

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS recurring_template_id UUID;

CREATE INDEX IF NOT EXISTS idx_ft_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ft_recurring_template ON financial_transactions(recurring_template_id);

-- ============================================================================
-- 2. CREATE RECURRING_EXPENSE_TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_expense_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  expense_category_id   UUID NOT NULL REFERENCES expense_categories(id),
  is_variable           BOOLEAN NOT NULL DEFAULT false,
  amount                DECIMAL(12,2) NOT NULL,
  day_of_month          INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  payment_method        TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),
  has_invoice           BOOLEAN NOT NULL DEFAULT true,
  vat_rate              DECIMAL(5,2) NOT NULL DEFAULT 20,
  description_template  TEXT,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK from financial_transactions → recurring_expense_templates
ALTER TABLE financial_transactions
  ADD CONSTRAINT fk_ft_recurring_template
    FOREIGN KEY (recurring_template_id)
    REFERENCES recurring_expense_templates(id)
    ON DELETE SET NULL;

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_recurring_template_updated_at
  BEFORE UPDATE ON recurring_expense_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. RLS FOR RECURRING_EXPENSE_TEMPLATES
-- ============================================================================

ALTER TABLE recurring_expense_templates ENABLE ROW LEVEL SECURITY;

-- Select: admin + accountant
CREATE POLICY recurring_templates_select ON recurring_expense_templates
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- Insert: admin + accountant
CREATE POLICY recurring_templates_insert ON recurring_expense_templates
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- Update: admin + accountant
CREATE POLICY recurring_templates_update ON recurring_expense_templates
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- Delete: admin only
CREATE POLICY recurring_templates_delete ON recurring_expense_templates
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_expense_templates TO authenticated;

-- ============================================================================
-- 4. ADD NEW EXPENSE CATEGORIES
-- ============================================================================

INSERT INTO expense_categories (code, name_tr, name_en, is_system, sort_order)
VALUES
  ('sgk',             'SGK Primi',              'Social Security Premium', true, 11),
  ('tax_withholding', 'Stopaj',                 'Tax Withholding',        true, 12),
  ('accounting',      'Muhasebe Hizmeti',       'Accounting Service',     true, 13),
  ('insurance',       'Sigorta',                'Insurance',              true, 14),
  ('software',        'Yazılım Abonelikleri',   'Software Subscriptions', true, 15),
  ('food_transport',  'Yemek / Ulaşım',        'Food / Transport',       true, 16),
  ('office_supplies', 'Kırtasiye / Ofis',       'Office Supplies',        true, 17)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 5. UPDATE V_PROFIT_AND_LOSS VIEW — EXCLUDE PENDING TRANSACTIONS
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
-- 6. EXPAND NOTIFICATION CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'subscription_cancelled', 'subscription_paused', 'payment_due_soon',
  'renewal_due_soon', 'work_order_assigned', 'task_due_soon', 'user_reminder',
  'sim_card_cancelled', 'recurring_expense_pending'
));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_entity_type_check CHECK (related_entity_type IN (
  'work_order', 'proposal', 'subscription', 'subscription_payment', 'task', 'reminder',
  'sim_card', 'recurring_template'
));

-- ============================================================================
-- 7. CRON FUNCTION: FN_GENERATE_RECURRING_EXPENSES()
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
  v_pending_count INTEGER;
BEGIN
  v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  v_last_day := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'));

  FOR v_template IN
    SELECT * FROM recurring_expense_templates WHERE is_active = true
  LOOP
    -- Skip if transaction already exists for this month + template
    IF EXISTS (
      SELECT 1 FROM financial_transactions
      WHERE recurring_template_id = v_template.id
        AND period = v_current_month
    ) THEN
      CONTINUE;
    END IF;

    -- Calculate transaction date: LEAST(day_of_month, last_day_of_month)
    v_tx_date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 day' * (LEAST(v_template.day_of_month, v_last_day) - 1))::DATE;

    -- Amount
    v_amount := v_template.amount;

    -- Input VAT (only if has_invoice)
    v_input_vat := NULL;
    IF v_template.has_invoice = true THEN
      v_input_vat := ROUND(v_amount * v_template.vat_rate / 100, 2);
    END IF;

    -- Insert pending transaction
    INSERT INTO financial_transactions (
      direction, original_currency, amount_original, amount_try,
      transaction_date, expense_category_id, payment_method,
      has_invoice, input_vat, vat_rate, description,
      status, recurring_template_id
    ) VALUES (
      'expense', 'TRY', v_amount, v_amount,
      v_tx_date, v_template.expense_category_id, v_template.payment_method,
      v_template.has_invoice, v_input_vat, v_template.vat_rate, v_template.description_template,
      'pending', v_template.id
    );
  END LOOP;

  -- Create/update notification if any pending exist
  SELECT COUNT(*) INTO v_pending_count
  FROM financial_transactions
  WHERE status = 'pending'
    AND period = v_current_month
    AND recurring_template_id IS NOT NULL;

  IF v_pending_count > 0 THEN
    INSERT INTO notifications (type, title, body, related_entity_type, dedup_key)
    VALUES (
      'recurring_expense_pending',
      v_pending_count || ' adet bekleyen tekrarlı ödeme var',
      to_char(CURRENT_DATE, 'TMMonth YYYY') || ' — ' || v_pending_count || ' ödeme onay bekliyor',
      'recurring_template',
      'recurring_expense_pending::' || v_current_month
    )
    ON CONFLICT (dedup_key) DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      resolved_at = NULL;
  ELSE
    -- Auto-resolve if all are confirmed
    UPDATE notifications
    SET resolved_at = now()
    WHERE dedup_key = 'recurring_expense_pending::' || v_current_month
      AND resolved_at IS NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses() TO authenticated;

-- ============================================================================
-- 8. SCHEDULE CRON JOB
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('recurring-expenses-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'recurring-expenses-daily',
  '0 1 * * *',
  $$ SELECT fn_generate_recurring_expenses(); $$
);
