-- 00210_complete_proposal_with_rate_rpc.sql
--
-- 1. Add completion rate audit columns to proposals
-- 2. Modify auto_record_proposal_revenue: for USD proposals, use
--    proposals.completion_exchange_rate when set (user-confirmed via RPC)
--    instead of auto-querying exchange_rates table.
-- 3. New RPC complete_proposal_with_rate — atomically marks proposal
--    as completed and stores the user-confirmed exchange rate so the
--    trigger above picks it up.

-- ============================================================
-- 1. New columns on proposals
-- ============================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS completion_exchange_rate  DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS completion_rate_suggested DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS completed_by              UUID REFERENCES profiles(id);

-- ============================================================
-- 2. Updated trigger function (only USD rate-lookup line changed)
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

  -- Idempotency guard
  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE proposal_id = NEW.id
    AND direction   = 'income'
    AND deleted_at  IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_currency         := UPPER(COALESCE(NEW.currency, 'USD'));
  v_vat_rate         := COALESCE(NEW.vat_rate, 20);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  -- ── TRY proposals (unchanged) ────────────────────────────────────────────
  IF v_currency = 'TRY' THEN
    v_revenue_try := ROUND(COALESCE(NEW.total_amount, 0), 2);
    IF v_revenue_try <= 0 OR NEW.site_id IS NULL THEN RETURN NEW; END IF;

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
        created_at, updated_at
      ) VALUES (
        'income', 'sale', NEW.id,
        v_revenue_try, 'TRY', v_revenue_try, NULL,
        CASE WHEN v_cogs_total_try > 0 THEN v_cogs_total_try ELSE NULL END,
        true, v_output_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
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

  -- ── USD proposals ────────────────────────────────────────────────────────
  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN RETURN NEW; END IF;

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

  -- ── KEY CHANGE: prefer user-confirmed rate over auto-lookup ──────────────
  IF NEW.completion_exchange_rate IS NOT NULL AND NEW.completion_exchange_rate > 0 THEN
    v_rate := NEW.completion_exchange_rate;
  ELSE
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
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

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
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_total_usd, 'USD', v_amount_try, v_rate,
      v_cogs_try, true, v_output_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
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

-- ============================================================
-- 3. RPC: complete_proposal_with_rate
--    Atomically sets status + audit columns. Trigger fires on
--    the resulting UPDATE and reads completion_exchange_rate.
-- ============================================================
CREATE OR REPLACE FUNCTION complete_proposal_with_rate(
  p_proposal_id     UUID,
  p_exchange_rate   DECIMAL,
  p_rate_suggested  DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'exchange_rate must be greater than zero';
  END IF;

  UPDATE proposals
  SET
    status                    = 'completed',
    completed_at              = now(),
    completed_by              = auth.uid(),
    completion_exchange_rate  = p_exchange_rate,
    completion_rate_suggested = p_rate_suggested
  WHERE id         = p_proposal_id
    AND status     = 'accepted'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal % not found or not in accepted status', p_proposal_id;
  END IF;
END;
$$;
