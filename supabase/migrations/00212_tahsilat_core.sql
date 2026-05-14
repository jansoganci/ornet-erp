-- Migration: 00212_tahsilat_core
-- Description: Tahsilat core — service_category, payment tracking, trigger categorization

-- ============================================================================
-- 1. Create enum type
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE service_category_enum AS ENUM (
    'kira', 'merkez', 'montaj', 'servis', 'satis', 'mal_gonderme', 'diger'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. Add columns to financial_transactions
-- ============================================================================

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS service_category service_category_enum,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- Align legacy hybrid-payment values from 00207
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transactions'
      AND column_name = 'payment_status'
  ) THEN
  UPDATE financial_transactions
  SET payment_status = 'partial'
  WHERE payment_status = 'partially_paid';

  ALTER TABLE financial_transactions
    DROP CONSTRAINT IF EXISTS financial_transactions_payment_status_check;

  ALTER TABLE financial_transactions
    ADD CONSTRAINT financial_transactions_payment_status_check
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;

-- ============================================================================
-- 3. Create financial_transaction_payments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_transaction_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  amount            DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  paid_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer', 'check', 'other')),
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ftp_transaction ON financial_transaction_payments(transaction_id);

ALTER TABLE financial_transaction_payments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Bridge 00207 hybrid-payment column names when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transaction_payments'
      AND column_name = 'amount_try'
  ) THEN
    ALTER TABLE financial_transaction_payments
      ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2);

    UPDATE financial_transaction_payments
    SET amount = amount_try
    WHERE amount IS NULL
      AND amount_try IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transaction_payments'
      AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE financial_transaction_payments
      ADD COLUMN IF NOT EXISTS paid_date DATE;

    UPDATE financial_transaction_payments
    SET paid_date = paid_at
    WHERE paid_date IS NULL
      AND paid_at IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. Create function to update payment_status
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid DECIMAL(12,2);
  v_amount_try DECIMAL(12,2);
BEGIN
  SELECT amount_try INTO v_amount_try
  FROM financial_transactions
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT COALESCE(SUM(COALESCE(ftp.amount, ftp.amount_try)), 0) INTO v_total_paid
  FROM financial_transaction_payments ftp
  WHERE ftp.transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
    AND ftp.deleted_at IS NULL;

  UPDATE financial_transactions
  SET payment_status = CASE
    WHEN v_total_paid >= v_amount_try THEN 'paid'
    WHEN v_total_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_transaction_payment_status ON financial_transaction_payments;

CREATE OR REPLACE TRIGGER trg_update_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON financial_transaction_payments
  FOR EACH ROW EXECUTE FUNCTION fn_update_payment_status();

-- ============================================================================
-- 5. RLS for financial_transaction_payments (same pattern as financial_transactions)
-- ============================================================================

ALTER TABLE financial_transaction_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ftp_select_authenticated" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_insert_canwrite" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_update_canwrite" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_select" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_insert" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_update" ON financial_transaction_payments;
DROP POLICY IF EXISTS "ftp_delete" ON financial_transaction_payments;

CREATE POLICY "ftp_select" ON financial_transaction_payments FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ftp_insert" ON financial_transaction_payments FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ftp_update" ON financial_transaction_payments FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ftp_delete" ON financial_transaction_payments FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================================
-- 6. Update trigger functions: service_category + customer_id on inserts
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_subscription_payment_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub                 RECORD;
  v_customer_id         UUID;
  v_site_id             UUID;
  v_cogs_try            DECIMAL(12,2);
  v_multiplier          INTEGER;
  v_vat_rate            DECIMAL(5,2);
  v_output_vat          DECIMAL(12,2);
  v_expense_category_id UUID;
  v_exists              BOOLEAN;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE subscription_payment_id = NEW.id LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sub FROM subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = v_sub.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_vat_rate := COALESCE(v_sub.vat_rate, 20);

  IF COALESCE(v_sub.official_invoice, true) THEN
    v_output_vat := COALESCE(NEW.vat_amount, 0);
  ELSE
    v_output_vat := 0;
  END IF;

  IF v_sub.billing_frequency = 'yearly' THEN
    v_multiplier := 12;
  ELSIF v_sub.billing_frequency = '6_month' THEN
    v_multiplier := 6;
  ELSIF v_sub.billing_frequency = '3_month' THEN
    v_multiplier := 3;
  ELSE
    v_multiplier := 1;
  END IF;

  v_cogs_try := COALESCE(v_sub.cost, 0) * v_multiplier;

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, subscription_payment_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate, cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      service_category,
      pos_code,
      created_at, updated_at
    ) VALUES (
      'income', 'subscription', NEW.id,
      COALESCE(NEW.amount, 0), 'TRY', COALESCE(NEW.amount, 0), NULL,
      COALESCE(NEW.should_invoice, true), v_output_vat, v_vat_rate,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      COALESCE(NEW.payment_date, NEW.payment_month), v_customer_id, v_site_id,
      COALESCE(NEW.payment_method, 'cash'),
      'kira',
      NEW.pos_code,
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_subscription_payment_to_finance income failed for payment %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  IF v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories
    WHERE code = 'subscription_cogs'
    LIMIT 1;

    IF v_expense_category_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financial_transactions (
          direction, subscription_payment_id, expense_category_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id, payment_method,
          pos_code,
          created_at, updated_at
        ) VALUES (
          'expense', NEW.id, v_expense_category_id,
          v_cogs_try, 'TRY', v_cogs_try, NULL,
          false, NULL, NULL,
          COALESCE(NEW.payment_date, NEW.payment_month), v_customer_id, v_site_id,
          COALESCE(NEW.payment_method, 'cash'),
          NEW.pos_code,
          now(), now()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_subscription_payment_to_finance expense failed for payment %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_monthly_sim_finance()
RETURNS TABLE (
  period_generated TEXT,
  income_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  result_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period           TEXT;
  v_period_date      DATE;
  v_month_name       TEXT;
  v_income_sum       DECIMAL(12,2);
  v_expense_sum      DECIMAL(12,2);
  v_expense_cat_id   UUID;
  v_income_exists    BOOLEAN;
  v_expense_exists   BOOLEAN;
  v_active_count     INTEGER;
  v_available_count  INTEGER;
BEGIN
  v_period_date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
  v_period := to_char(v_period_date, 'YYYY-MM');
  v_month_name := to_char(v_period_date, 'TMMonth YYYY');

  RAISE NOTICE 'generate_monthly_sim_finance: Processing period %', v_period;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE period = v_period
      AND direction = 'income'
      AND income_type = 'sim_rental'
      AND sim_card_id IS NULL
      AND description ILIKE '%SIM Kart Kiralama Geliri%'
    LIMIT 1
  ) INTO v_income_exists;

  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE period = v_period
      AND direction = 'expense'
      AND expense_category_id IN (SELECT id FROM expense_categories WHERE code = 'sim_operator')
      AND sim_card_id IS NULL
      AND description ILIKE '%SIM Kart Operatör Gideri%'
    LIMIT 1
  ) INTO v_expense_exists;

  IF v_income_exists AND v_expense_exists THEN
    RAISE NOTICE 'generate_monthly_sim_finance: Period % already processed, skipping', v_period;
    RETURN QUERY SELECT v_period, 0::DECIMAL(12,2), 0::DECIMAL(12,2), 'skipped (already exists)'::TEXT;
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(sale_price), 0),
    COUNT(*)
  INTO v_income_sum, v_active_count
  FROM sim_cards
  WHERE status = 'active'
    AND deleted_at IS NULL
    AND COALESCE(sale_price, 0) > 0;

  RAISE NOTICE 'generate_monthly_sim_finance: Active SIMs: %, Total income: %', v_active_count, v_income_sum;

  SELECT
    COALESCE(SUM(cost_price), 0),
    COUNT(*)
  INTO v_expense_sum, v_available_count
  FROM sim_cards
  WHERE status IN ('active', 'available')
    AND deleted_at IS NULL
    AND COALESCE(cost_price, 0) > 0;

  RAISE NOTICE 'generate_monthly_sim_finance: Active+Available SIMs: %, Total expense: %', v_available_count, v_expense_sum;

  SELECT id INTO v_expense_cat_id
  FROM expense_categories
  WHERE code = 'sim_operator'
  LIMIT 1;

  IF v_expense_cat_id IS NULL THEN
    RAISE WARNING 'generate_monthly_sim_finance: expense_category "sim_operator" not found, skipping expense record';
  END IF;

  IF NOT v_income_exists AND v_income_sum > 0 THEN
    INSERT INTO financial_transactions (
      direction,
      income_type,
      sim_card_id,
      amount_original,
      original_currency,
      amount_try,
      exchange_rate,
      should_invoice,
      output_vat,
      vat_rate,
      transaction_date,
      customer_id,
      site_id,
      service_category,
      description,
      created_at,
      updated_at
    ) VALUES (
      'income',
      'sim_rental',
      NULL,
      v_income_sum,
      'TRY',
      v_income_sum,
      NULL,
      true,
      0,
      0,
      v_period_date,
      NULL,
      NULL,
      'kira',
      'SIM Kart Kiralama Geliri - ' || v_month_name || ' (' || v_active_count || ' adet)',
      now(),
      now()
    );

    RAISE NOTICE 'generate_monthly_sim_finance: Income record created: % TRY', v_income_sum;
  ELSE
    RAISE NOTICE 'generate_monthly_sim_finance: Income record skipped (exists: %, amount: %)', v_income_exists, v_income_sum;
  END IF;

  IF NOT v_expense_exists AND v_expense_sum > 0 AND v_expense_cat_id IS NOT NULL THEN
    INSERT INTO financial_transactions (
      direction,
      expense_category_id,
      sim_card_id,
      amount_original,
      original_currency,
      amount_try,
      exchange_rate,
      has_invoice,
      input_vat,
      vat_rate,
      transaction_date,
      customer_id,
      site_id,
      description,
      created_at,
      updated_at
    ) VALUES (
      'expense',
      v_expense_cat_id,
      NULL,
      v_expense_sum,
      'TRY',
      v_expense_sum,
      NULL,
      false,
      NULL,
      0,
      v_period_date,
      NULL,
      NULL,
      'SIM Kart Operatör Gideri - ' || v_month_name || ' (' || v_available_count || ' adet)',
      now(),
      now()
    );

    RAISE NOTICE 'generate_monthly_sim_finance: Expense record created: % TRY', v_expense_sum;
  ELSE
    RAISE NOTICE 'generate_monthly_sim_finance: Expense record skipped (exists: %, amount: %, cat_id: %)', v_expense_exists, v_expense_sum, v_expense_cat_id;
  END IF;

  RETURN QUERY SELECT
    v_period,
    v_income_sum,
    v_expense_sum,
    'completed'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id         UUID;
  v_site_id             UUID;
  v_currency            TEXT;
  v_total_usd           DECIMAL(12,2);
  v_cogs_usd            DECIMAL(12,2) := 0;
  v_rate                DECIMAL(10,4);
  v_amount_try          DECIMAL(12,2);
  v_cogs_try            DECIMAL(12,2);
  v_revenue_try         DECIMAL(12,2);
  v_cogs_total_try      DECIMAL(12,2) := 0;
  v_vat_rate            DECIMAL(5,2);
  v_output_vat          DECIMAL(12,2);
  v_input_vat           DECIMAL(12,2);
  v_net_income          DECIMAL(12,2);
  v_item                RECORD;
  v_has_detail          BOOLEAN;
  v_item_cogs           DECIMAL(12,2);
  v_expense_category_id UUID;
  v_transaction_date    DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE proposal_id = NEW.id
    AND direction   = 'income'
    AND deleted_at  IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_currency := UPPER(COALESCE(NEW.currency, 'USD'));
  v_vat_rate := COALESCE(NEW.vat_rate, 20);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  IF v_currency = 'TRY' THEN
    v_revenue_try := ROUND(COALESCE(NEW.total_amount, 0), 2);
    IF v_revenue_try <= 0 OR NEW.site_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
    FROM customer_sites cs WHERE cs.id = NEW.site_id;
    IF v_site_id IS NULL THEN RETURN NEW; END IF;

    FOR v_item IN
      SELECT pi.quantity, pi.cost,
             pi.product_cost, pi.labor_cost,
             pi.material_cost, pi.shipping_cost, pi.misc_cost
      FROM proposal_items pi
      WHERE pi.proposal_id = NEW.id
    LOOP
      v_has_detail :=
        (v_item.product_cost  IS NOT NULL AND v_item.product_cost  <> 0) OR
        (v_item.labor_cost    IS NOT NULL AND v_item.labor_cost    <> 0) OR
        (v_item.material_cost IS NOT NULL AND v_item.material_cost <> 0) OR
        (v_item.shipping_cost IS NOT NULL AND v_item.shipping_cost <> 0) OR
        (v_item.misc_cost     IS NOT NULL AND v_item.misc_cost     <> 0);

      IF v_has_detail THEN
        v_item_cogs :=
          COALESCE(v_item.product_cost,  0) +
          COALESCE(v_item.labor_cost,    0) +
          COALESCE(v_item.material_cost, 0) +
          COALESCE(v_item.shipping_cost, 0) +
          COALESCE(v_item.misc_cost,     0);
      ELSE
        v_item_cogs := COALESCE(v_item.cost, 0);
      END IF;

      v_cogs_total_try := v_cogs_total_try + (v_item_cogs * COALESCE(v_item.quantity, 1));
    END LOOP;

    IF v_cogs_total_try = 0 THEN
      v_cogs_total_try := COALESCE(NEW.cost_usd, 0);
    END IF;

    v_output_vat := ROUND(v_revenue_try * v_vat_rate / 100, 2);
    v_input_vat  := CASE WHEN v_cogs_total_try > 0
                         THEN ROUND(v_cogs_total_try * v_vat_rate / 100, 2)
                         ELSE NULL END;

    BEGIN
      INSERT INTO financial_transactions (
        direction, income_type, proposal_id,
        amount_original, original_currency, amount_try, exchange_rate,
        cogs_try, should_invoice, output_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        service_category,
        payment_status,
        created_at, updated_at
      ) VALUES (
        'income', 'sale', NEW.id,
        v_revenue_try, 'TRY', v_revenue_try, NULL,
        CASE WHEN v_cogs_total_try > 0 THEN v_cogs_total_try ELSE NULL END,
        true, v_output_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
        'montaj',
        'unpaid',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_proposal_revenue (income TRY) failed for proposal %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;

    IF v_cogs_total_try > 0 THEN
      SELECT id INTO v_expense_category_id
      FROM expense_categories WHERE code = 'material' LIMIT 1;

      BEGIN
        INSERT INTO financial_transactions (
          direction, proposal_id, expense_category_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id, payment_method,
          created_at, updated_at
        ) VALUES (
          'expense', NEW.id, v_expense_category_id,
          v_cogs_total_try, 'TRY', v_cogs_total_try, NULL,
          true, v_input_vat, v_vat_rate,
          v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
          now(), now()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'auto_record_proposal_revenue (COGS TRY) failed for proposal %: %', NEW.id, SQLERRM;
      END;
    END IF;

    RETURN NEW;
  END IF;

  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  FOR v_item IN
    SELECT pi.quantity, pi.cost_usd,
           pi.product_cost_usd, pi.labor_cost_usd,
           pi.material_cost_usd, pi.shipping_cost_usd, pi.misc_cost_usd
    FROM proposal_items pi
    WHERE pi.proposal_id = NEW.id
  LOOP
    v_has_detail :=
      (v_item.product_cost_usd  IS NOT NULL AND v_item.product_cost_usd  <> 0) OR
      (v_item.labor_cost_usd    IS NOT NULL AND v_item.labor_cost_usd    <> 0) OR
      (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0) OR
      (v_item.shipping_cost_usd IS NOT NULL AND v_item.shipping_cost_usd <> 0) OR
      (v_item.misc_cost_usd     IS NOT NULL AND v_item.misc_cost_usd     <> 0);

    IF v_has_detail THEN
      v_item_cogs :=
        COALESCE(v_item.product_cost_usd,  0) +
        COALESCE(v_item.labor_cost_usd,    0) +
        COALESCE(v_item.material_cost_usd, 0) +
        COALESCE(v_item.shipping_cost_usd, 0) +
        COALESCE(v_item.misc_cost_usd,     0);
    ELSE
      v_item_cogs := COALESCE(v_item.cost_usd, 0);
    END IF;

    v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
  END LOOP;

  IF v_cogs_usd = 0 THEN
    v_cogs_usd := COALESCE(NEW.cost_usd, 0);
  END IF;

  SELECT effective_rate INTO v_rate
  FROM exchange_rates
  WHERE currency = 'USD'
    AND rate_date <= v_transaction_date
  ORDER BY rate_date DESC
  LIMIT 1;

  IF v_rate IS NULL OR v_rate = 0 THEN
    RAISE WARNING
      'auto_record_proposal_revenue: no USD rate on or before % for proposal %. '
      'Finance entry skipped.',
      v_transaction_date, NEW.id;
    RETURN NEW;
  END IF;

  v_amount_try := ROUND(v_total_usd * v_rate, 2);
  v_cogs_try   := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);
  v_input_vat  := CASE WHEN v_cogs_try IS NOT NULL AND v_cogs_try > 0
                       THEN ROUND(v_cogs_try * v_vat_rate / 100, 2)
                       ELSE NULL END;

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, proposal_id,
      amount_original, original_currency, amount_try, exchange_rate,
      cogs_try, should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      service_category,
      payment_status,
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_total_usd, 'USD', v_amount_try, v_rate,
      v_cogs_try, true, v_output_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      'montaj',
      'unpaid',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue (income USD) failed for proposal %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories WHERE code = 'material' LIMIT 1;

    BEGIN
      INSERT INTO financial_transactions (
        direction, proposal_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        v_cogs_usd, 'USD', v_cogs_try, v_rate,
        true, v_input_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_proposal_revenue (COGS USD) failed for proposal %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_record_work_order_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id         UUID;
  v_site_id             UUID;
  v_currency            TEXT;
  v_amount_orig         DECIMAL(12,2);
  v_rate                DECIMAL(10,4);
  v_amount_try          DECIMAL(12,2);
  v_vat_rate            DECIMAL(5,2);
  v_output_vat          DECIMAL(12,2);
  v_cogs_try            DECIMAL(12,2);
  v_input_vat           DECIMAL(12,2);
  v_net_income          DECIMAL(12,2);
  v_discount_pct        DECIMAL(5,2);
  v_expense_category_id UUID;
  v_transaction_date    DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.site_id IS NULL THEN RETURN NEW; END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE work_order_id = NEW.id
    AND direction     = 'income'
    AND deleted_at    IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_currency         := UPPER(COALESCE(NEW.currency, 'TRY'));
  v_vat_rate         := COALESCE(NEW.vat_rate, 20);
  v_discount_pct     := COALESCE(NEW.materials_discount_percent, 0);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  IF v_currency = 'USD' THEN
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0)
    INTO v_amount_orig
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
    IF v_amount_orig <= 0 THEN RETURN NEW; END IF;

    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
      AND rate_date <= v_transaction_date
    ORDER BY rate_date DESC
    LIMIT 1;

    IF v_rate IS NULL OR v_rate = 0 THEN
      RAISE WARNING
        'auto_record_work_order_revenue: no USD rate on or before % for work_order %. '
        'Finance entry skipped.',
        v_transaction_date, NEW.id;
      RETURN NEW;
    END IF;

    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
  ELSE
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price), 0)
    INTO v_amount_orig
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
    IF v_amount_orig <= 0 THEN RETURN NEW; END IF;

    v_rate       := NULL;
    v_amount_try := v_amount_orig;
  END IF;

  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);

  IF v_currency = 'USD' THEN
    SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0)
    INTO v_cogs_try
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

    IF v_cogs_try > 0 THEN
      v_cogs_try := ROUND(v_cogs_try * v_rate, 2);
    END IF;
  ELSE
    SELECT COALESCE(SUM(wom.quantity * wom.cost), 0)
    INTO v_cogs_try
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.cost IS NOT NULL AND wom.cost > 0;
  END IF;

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      service_category,
      created_at, updated_at
    ) VALUES (
      'income', 'service', NEW.id,
      v_amount_orig, v_currency, v_amount_try, v_rate,
      true, v_output_vat, v_vat_rate,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      'servis',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue (income) failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  IF v_cogs_try > 0 THEN
    v_input_vat := ROUND(v_cogs_try * v_vat_rate / 100, 2);

    SELECT id INTO v_expense_category_id
    FROM expense_categories WHERE code = 'material' LIMIT 1;

    BEGIN
      INSERT INTO financial_transactions (
        direction, work_order_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        CASE WHEN v_currency = 'USD' THEN ROUND(v_cogs_try / NULLIF(v_rate, 0), 2)
             ELSE v_cogs_try END,
        v_currency, v_cogs_try, v_rate,
        true, v_input_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_work_order_revenue (COGS) failed for work_order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
