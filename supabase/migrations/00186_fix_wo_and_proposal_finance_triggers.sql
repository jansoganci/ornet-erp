-- 00186_fix_wo_and_proposal_finance_triggers.sql
--
-- Root causes fixed:
--
-- WORK ORDERS:
--   1. form always saves amount=NULL → trigger fell back to unit_price_usd which is 0 for TRY WOs.
--   2. COGS path read cost_usd which is 0 for TRY WOs; api.js saves cost (TRY column) instead.
--   3. VAT hardcoded at 0.20 instead of using vat_rate.
--   Fix: when currency=TRY use unit_price/cost directly; keep USD path as-is.
--
-- PROPOSALS:
--   1. COGS was computed only from proposal_items per-item cost columns; proposals.cost_usd
--      (top-level manual cost field) was never read → expense row silently skipped.
--   2. VAT hardcoded at 0.20.
--   Fix: after item loop, fall back to NEW.cost_usd if v_cogs_usd is still 0.

-- ============================================================
-- 1. Work Order Revenue + COGS trigger
-- ============================================================
CREATE OR REPLACE FUNCTION auto_record_work_order_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id        UUID;
  v_site_id            UUID;
  v_currency           TEXT;
  v_amount_orig        DECIMAL(12,2);
  v_rate               DECIMAL(10,4);
  v_amount_try         DECIMAL(12,2);
  v_vat_rate           DECIMAL(5,2);
  v_output_vat         DECIMAL(12,2);
  v_cogs_try           DECIMAL(12,2);
  v_input_vat          DECIMAL(12,2);
  v_exists             BOOLEAN;
  v_discount_pct       DECIMAL(5,2);
  v_expense_category_id UUID;
BEGIN
  -- Only fire on transition → 'completed' for standalone WOs
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE work_order_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;

  IF NEW.site_id IS NULL THEN RETURN NEW; END IF;

  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  v_currency    := UPPER(COALESCE(NEW.currency, 'TRY'));
  v_vat_rate    := COALESCE(NEW.vat_rate, 20);
  v_discount_pct := COALESCE(NEW.materials_discount_percent, 0);

  -- ── Revenue ──────────────────────────────────────────────────────────────
  IF v_currency = 'USD' THEN
    -- USD work order: use unit_price_usd column
    SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0)
    INTO v_amount_orig
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id;

    v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);

    IF v_amount_orig <= 0 THEN RETURN NEW; END IF;

    SELECT effective_rate INTO v_rate
    FROM exchange_rates WHERE currency = 'USD'
    ORDER BY rate_date DESC LIMIT 1;
    v_rate       := COALESCE(NULLIF(v_rate, 0), 1);
    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
  ELSE
    -- TRY work order: use unit_price (TRY) column directly
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
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue (income) failed for work_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- ── COGS (expense) ───────────────────────────────────────────────────────
  IF v_currency = 'USD' THEN
    SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0)
    INTO v_cogs_try  -- reuse variable; will convert below
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

    IF v_cogs_try > 0 THEN
      v_cogs_try := ROUND(v_cogs_try * v_rate, 2);
    END IF;
  ELSE
    -- TRY work order: use cost (TRY) column
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
        v_currency,
        v_cogs_try,
        v_rate,
        true, v_input_vat, v_vat_rate,
        CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
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
-- 2. Proposal Revenue + COGS trigger
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
  v_exists              BOOLEAN;
  v_item                RECORD;
  v_has_detail          BOOLEAN;
  v_item_cogs           DECIMAL(12,2);
  v_expense_category_id UUID;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE proposal_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;

  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  v_vat_rate := COALESCE(NEW.vat_rate, 20);

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

  -- ── Fallback: top-level proposals.cost_usd ───────────────────────────────
  -- If no per-item COGS was found, use the manually-entered proposal-level cost.
  IF v_cogs_usd = 0 THEN
    v_cogs_usd := COALESCE(NEW.cost_usd, 0);
  END IF;

  -- ── Exchange rate ─────────────────────────────────────────────────────────
  SELECT effective_rate INTO v_rate
  FROM exchange_rates WHERE currency = 'USD'
  ORDER BY rate_date DESC LIMIT 1;
  v_rate := COALESCE(NULLIF(v_rate, 0), 1);

  v_amount_try := ROUND(v_total_usd * v_rate, 2);
  v_cogs_try   := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);
  v_input_vat  := CASE WHEN v_cogs_try IS NOT NULL AND v_cogs_try > 0
                       THEN ROUND(v_cogs_try * v_vat_rate / 100, 2)
                       ELSE NULL END;

  -- ── 1. Income transaction ─────────────────────────────────────────────────
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
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue (income) failed for proposal %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- ── 2. COGS expense transaction ───────────────────────────────────────────
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
        CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
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
-- 3. Recovery: backfill last 10 days of completed work orders
--    with no income entry (standalone, TRY currency)
-- ============================================================
DO $$
DECLARE
  r               RECORD;
  v_customer_id   UUID;
  v_currency      TEXT;
  v_amount_orig   DECIMAL(12,2);
  v_amount_try    DECIMAL(12,2);
  v_cogs_try      DECIMAL(12,2);
  v_rate          DECIMAL(10,4);
  v_vat_rate      DECIMAL(5,2);
  v_discount_pct  DECIMAL(5,2);
  v_ec_id         UUID;
BEGIN
  SELECT id INTO v_ec_id FROM expense_categories WHERE code = 'material' LIMIT 1;
  SELECT effective_rate INTO v_rate
  FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
  v_rate := COALESCE(NULLIF(v_rate, 0), 1);

  FOR r IN
    SELECT wo.id, wo.site_id, wo.currency, wo.materials_discount_percent, wo.vat_rate,
           wo.completed_at
    FROM work_orders wo
    WHERE wo.status = 'completed'
      AND wo.proposal_id IS NULL
      AND wo.site_id IS NOT NULL
      AND wo.deleted_at IS NULL
      AND wo.completed_at >= now() - INTERVAL '10 days'
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft
        WHERE ft.work_order_id = wo.id AND ft.direction = 'income'
      )
  LOOP
    SELECT cs.customer_id INTO v_customer_id
    FROM customer_sites cs WHERE cs.id = r.site_id;
    IF v_customer_id IS NULL THEN CONTINUE; END IF;

    v_currency    := UPPER(COALESCE(r.currency, 'TRY'));
    v_vat_rate    := COALESCE(r.vat_rate, 20);
    v_discount_pct := COALESCE(r.materials_discount_percent, 0);

    IF v_currency = 'USD' THEN
      SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0) INTO v_amount_orig
      FROM work_order_materials wom WHERE wom.work_order_id = r.id;
      v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
      IF v_amount_orig <= 0 THEN CONTINUE; END IF;
      v_amount_try := ROUND(v_amount_orig * v_rate, 2);
    ELSE
      SELECT COALESCE(SUM(wom.quantity * wom.unit_price), 0) INTO v_amount_orig
      FROM work_order_materials wom WHERE wom.work_order_id = r.id;
      v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);
      IF v_amount_orig <= 0 THEN CONTINUE; END IF;
      v_amount_try := v_amount_orig;
    END IF;

    INSERT INTO financial_transactions (
      direction, income_type, work_order_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'income', 'service', r.id,
      v_amount_orig, v_currency, v_amount_try,
      CASE WHEN v_currency = 'USD' THEN v_rate ELSE NULL END,
      true, ROUND(v_amount_try * v_vat_rate / 100, 2), v_vat_rate,
      COALESCE(r.completed_at::date, CURRENT_DATE), v_customer_id, r.site_id,
      'bank_transfer', now(), now()
    );

    -- COGS
    IF v_currency = 'USD' THEN
      SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0) INTO v_cogs_try
      FROM work_order_materials wom
      WHERE wom.work_order_id = r.id AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;
      v_cogs_try := ROUND(v_cogs_try * v_rate, 2);
    ELSE
      SELECT COALESCE(SUM(wom.quantity * wom.cost), 0) INTO v_cogs_try
      FROM work_order_materials wom
      WHERE wom.work_order_id = r.id AND wom.cost IS NOT NULL AND wom.cost > 0;
    END IF;

    IF v_cogs_try > 0 THEN
      INSERT INTO financial_transactions (
        direction, work_order_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', r.id, v_ec_id,
        CASE WHEN v_currency = 'USD' THEN ROUND(v_cogs_try / v_rate, 2) ELSE v_cogs_try END,
        v_currency, v_cogs_try,
        CASE WHEN v_currency = 'USD' THEN v_rate ELSE NULL END,
        true, ROUND(v_cogs_try * v_vat_rate / 100, 2), v_vat_rate,
        COALESCE(r.completed_at::date, CURRENT_DATE), v_customer_id, r.site_id,
        'bank_transfer', now(), now()
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Recovery: backfill last 10 days of completed proposals
--    with no COGS expense entry
-- ============================================================
DO $$
DECLARE
  r               RECORD;
  ft              RECORD;
  v_cogs_usd      DECIMAL(12,2);
  v_cogs_try      DECIMAL(12,2);
  v_vat_rate      DECIMAL(5,2);
  v_rate          DECIMAL(10,4);
  v_ec_id         UUID;
  v_item          RECORD;
  v_has_detail    BOOLEAN;
  v_item_cogs     DECIMAL(12,2);
BEGIN
  SELECT id INTO v_ec_id FROM expense_categories WHERE code = 'material' LIMIT 1;
  SELECT effective_rate INTO v_rate
  FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
  v_rate := COALESCE(NULLIF(v_rate, 0), 1);

  -- Find completed proposals (last 10 days) that have an income entry but no expense entry
  FOR r IN
    SELECT p.id, p.vat_rate, p.cost_usd, ft_in.transaction_date,
           ft_in.customer_id, ft_in.site_id, ft_in.exchange_rate
    FROM proposals p
    JOIN financial_transactions ft_in
      ON ft_in.proposal_id = p.id AND ft_in.direction = 'income'
    WHERE p.status = 'completed'
      AND p.deleted_at IS NULL
      AND p.updated_at >= now() - INTERVAL '10 days'
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions e
        WHERE e.proposal_id = p.id AND e.direction = 'expense'
      )
  LOOP
    v_rate     := COALESCE(NULLIF(r.exchange_rate, 0), v_rate);
    v_vat_rate := COALESCE(r.vat_rate, 20);
    v_cogs_usd := 0;

    -- Per-item COGS
    FOR v_item IN
      SELECT pi.quantity, pi.cost_usd,
             pi.product_cost_usd, pi.labor_cost_usd,
             pi.material_cost_usd, pi.shipping_cost_usd, pi.misc_cost_usd
      FROM proposal_items pi WHERE pi.proposal_id = r.id
    LOOP
      v_has_detail :=
        (v_item.product_cost_usd  IS NOT NULL AND v_item.product_cost_usd  <> 0) OR
        (v_item.labor_cost_usd    IS NOT NULL AND v_item.labor_cost_usd    <> 0) OR
        (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0) OR
        (v_item.shipping_cost_usd IS NOT NULL AND v_item.shipping_cost_usd <> 0) OR
        (v_item.misc_cost_usd     IS NOT NULL AND v_item.misc_cost_usd     <> 0);

      IF v_has_detail THEN
        v_item_cogs :=
          COALESCE(v_item.product_cost_usd, 0) + COALESCE(v_item.labor_cost_usd, 0) +
          COALESCE(v_item.material_cost_usd, 0) + COALESCE(v_item.shipping_cost_usd, 0) +
          COALESCE(v_item.misc_cost_usd, 0);
      ELSE
        v_item_cogs := COALESCE(v_item.cost_usd, 0);
      END IF;
      v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
    END LOOP;

    -- Fallback to top-level cost_usd
    IF v_cogs_usd = 0 THEN
      v_cogs_usd := COALESCE(r.cost_usd, 0);
    END IF;

    IF v_cogs_usd <= 0 THEN CONTINUE; END IF;

    v_cogs_try := ROUND(v_cogs_usd * v_rate, 2);

    INSERT INTO financial_transactions (
      direction, proposal_id, expense_category_id,
      amount_original, original_currency, amount_try, exchange_rate,
      has_invoice, input_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'expense', r.id, v_ec_id,
      v_cogs_usd, 'USD', v_cogs_try, v_rate,
      true, ROUND(v_cogs_try * v_vat_rate / 100, 2), v_vat_rate,
      r.transaction_date, r.customer_id, r.site_id,
      'bank_transfer', now(), now()
    );
  END LOOP;
END;
$$;
