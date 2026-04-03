-- 00190_financial_reversal_on_status_change.sql
--
-- Problem: "Ghost Revenue"
--   When a Work Order or Proposal transitions OUT of 'completed' status,
--   the financial_transactions rows already created by the revenue trigger
--   remain in the ledger — inflating reported income and VAT figures.
--
-- Solution: Compensating Reversal Entries (Option B — immutable ledger)
--   No row is ever deleted or soft-deleted from financial_transactions.
--   Instead, an AFTER UPDATE trigger inserts a mirror row with negated
--   amounts, linked back to the original via reversal_of.
--   This preserves full audit history while netting the ledger to zero.
--
-- Changes:
--   1. Add reversal_of + reversal_note columns to financial_transactions.
--   2. Update auto_record_work_order_revenue() idempotency guard:
--      old EXISTS check would block re-completion after a reversal.
--      New guard uses SUM(amount_try) > 0 — if net is zero (reversed),
--      it allows the finance entry to be recreated.
--   3. Update auto_record_proposal_revenue() idempotency guard (same fix).
--   4. AFTER UPDATE trigger on work_orders: fires when status leaves
--      'completed', inserts reversal rows for all linked finance entries.
--   5. AFTER UPDATE trigger on proposals: same pattern.

-- ============================================================
-- 1. Add reversal tracking columns to financial_transactions
-- ============================================================
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS reversal_of   UUID REFERENCES financial_transactions(id),
  ADD COLUMN IF NOT EXISTS reversal_note TEXT;

-- Index: quickly find all reversals of a given original row
CREATE INDEX IF NOT EXISTS idx_ft_reversal_of
  ON financial_transactions (reversal_of)
  WHERE reversal_of IS NOT NULL;

-- ============================================================
-- 2. Update auto_record_work_order_revenue()
--    Replaces the version in 00187.
--    Only change: idempotency guard now checks NET income > 0
--    instead of EXISTS, so a reversed+re-completed WO creates
--    a fresh finance entry correctly.
-- ============================================================
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
  -- Only fire on transition → 'completed' for standalone WOs
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

  -- ── Idempotency guard (NET-based) ─────────────────────────────────────────
  -- Uses SUM instead of EXISTS so that a reversed WO (net = 0) can be
  -- re-completed and create a fresh finance entry.
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

  -- ── Revenue ──────────────────────────────────────────────────────────────
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

  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'service', NEW.id,
      v_amount_orig, v_currency, v_amount_try, v_rate,
      true, v_output_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue (income) failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- ── COGS (expense) ───────────────────────────────────────────────────────
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

-- ============================================================
-- 3. Update auto_record_proposal_revenue()
--    Replaces the version in 00187.
--    Only change: same NET-based idempotency guard.
-- ============================================================
CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id         UUID;
  v_site_id             UUID;
  v_total_usd           DECIMAL(12,2);
  v_cogs_usd            DECIMAL(12,2) := 0;
  v_rate                DECIMAL(10,4);
  v_amount_try          DECIMAL(12,2);
  v_cogs_try            DECIMAL(12,2);
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

  -- ── Idempotency guard (NET-based) ─────────────────────────────────────────
  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE proposal_id = NEW.id
    AND direction   = 'income'
    AND deleted_at  IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  v_vat_rate         := COALESCE(NEW.vat_rate, 20);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  -- ── Per-item COGS ────────────────────────────────────────────────────────
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

  -- Fallback: top-level proposals.cost_usd
  IF v_cogs_usd = 0 THEN
    v_cogs_usd := COALESCE(NEW.cost_usd, 0);
  END IF;

  -- ── Exchange rate as-of completed_at ─────────────────────────────────────
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

  -- ── Income transaction ────────────────────────────────────────────────────
  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, proposal_id,
      amount_original, original_currency, amount_try, exchange_rate,
      cogs_try, should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_total_usd, 'USD', v_amount_try, v_rate,
      v_cogs_try, true, v_output_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue (income) failed for proposal %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- ── COGS expense transaction ──────────────────────────────────────────────
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
      RAISE WARNING 'auto_record_proposal_revenue (COGS) failed for proposal %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Reversal function: Work Orders
--    Fires AFTER a WO leaves 'completed' status.
--    Inserts a negated mirror of every linked finance row.
-- ============================================================
CREATE OR REPLACE FUNCTION reverse_work_order_finance_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  RECORD;
  v_note TEXT;
BEGIN
  v_note := format(
    'Reversal: work_order %s status changed from completed to %s at %s',
    OLD.id, NEW.status, now()
  );

  FOR v_row IN
    SELECT *
    FROM financial_transactions
    WHERE work_order_id = OLD.id
      AND reversal_of   IS NULL   -- never reverse a reversal row
      AND deleted_at    IS NULL
  LOOP
    BEGIN
      INSERT INTO financial_transactions (
        direction,
        income_type,
        expense_category_id,
        work_order_id,
        amount_original,
        original_currency,
        amount_try,
        exchange_rate,
        -- Respect chk_direction_flags constraint:
        -- income row → has_invoice must be NULL
        -- expense row → should_invoice must be NULL
        should_invoice,
        has_invoice,
        output_vat,
        input_vat,
        vat_rate,
        cogs_try,
        transaction_date,
        customer_id,
        site_id,
        payment_method,
        reversal_of,
        reversal_note,
        created_at,
        updated_at
      ) VALUES (
        v_row.direction,
        v_row.income_type,
        v_row.expense_category_id,
        v_row.work_order_id,
        -v_row.amount_original,
        v_row.original_currency,
        -v_row.amount_try,
        v_row.exchange_rate,
        CASE WHEN v_row.direction = 'income'  THEN false ELSE NULL END,
        CASE WHEN v_row.direction = 'expense' THEN false ELSE NULL END,
        CASE WHEN v_row.output_vat IS NOT NULL THEN -v_row.output_vat END,
        CASE WHEN v_row.input_vat  IS NOT NULL THEN -v_row.input_vat  END,
        v_row.vat_rate,
        CASE WHEN v_row.cogs_try IS NOT NULL THEN -v_row.cogs_try END,
        CURRENT_DATE,
        v_row.customer_id,
        v_row.site_id,
        v_row.payment_method,
        v_row.id,
        v_note,
        now(),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_work_order_finance_entries failed for ft row %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_finance_reversal
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  WHEN (OLD.status = 'completed' AND NEW.status <> 'completed')
  EXECUTE FUNCTION reverse_work_order_finance_entries();

-- ============================================================
-- 5. Reversal function: Proposals
--    Same pattern — fires when proposal leaves 'completed'.
-- ============================================================
CREATE OR REPLACE FUNCTION reverse_proposal_finance_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  RECORD;
  v_note TEXT;
BEGIN
  v_note := format(
    'Reversal: proposal %s status changed from completed to %s at %s',
    OLD.id, NEW.status, now()
  );

  FOR v_row IN
    SELECT *
    FROM financial_transactions
    WHERE proposal_id = OLD.id
      AND reversal_of IS NULL
      AND deleted_at  IS NULL
  LOOP
    BEGIN
      INSERT INTO financial_transactions (
        direction,
        income_type,
        expense_category_id,
        proposal_id,
        amount_original,
        original_currency,
        amount_try,
        exchange_rate,
        should_invoice,
        has_invoice,
        output_vat,
        input_vat,
        vat_rate,
        cogs_try,
        transaction_date,
        customer_id,
        site_id,
        payment_method,
        reversal_of,
        reversal_note,
        created_at,
        updated_at
      ) VALUES (
        v_row.direction,
        v_row.income_type,
        v_row.expense_category_id,
        v_row.proposal_id,
        -v_row.amount_original,
        v_row.original_currency,
        -v_row.amount_try,
        v_row.exchange_rate,
        CASE WHEN v_row.direction = 'income'  THEN false ELSE NULL END,
        CASE WHEN v_row.direction = 'expense' THEN false ELSE NULL END,
        CASE WHEN v_row.output_vat IS NOT NULL THEN -v_row.output_vat END,
        CASE WHEN v_row.input_vat  IS NOT NULL THEN -v_row.input_vat  END,
        v_row.vat_rate,
        CASE WHEN v_row.cogs_try IS NOT NULL THEN -v_row.cogs_try END,
        CURRENT_DATE,
        v_row.customer_id,
        v_row.site_id,
        v_row.payment_method,
        v_row.id,
        v_note,
        now(),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_proposal_finance_entries failed for ft row %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER proposal_finance_reversal
  AFTER UPDATE ON proposals
  FOR EACH ROW
  WHEN (OLD.status = 'completed' AND NEW.status <> 'completed')
  EXECUTE FUNCTION reverse_proposal_finance_entries();
