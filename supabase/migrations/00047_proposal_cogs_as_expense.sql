-- Migration: 00047_proposal_cogs_as_expense
-- Description: Record proposal COGS as separate expense transaction (direction='expense')
-- Bug fix: COGS was only stored as cogs_try on income row; now also creates expense row for P&L correctness

CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_site_id UUID;
  v_total_usd DECIMAL(12,2);
  v_cogs_usd DECIMAL(12,2) := 0;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_cogs_try DECIMAL(12,2);
  v_output_vat DECIMAL(12,2);
  v_input_vat DECIMAL(12,2);
  v_exists BOOLEAN;
  v_item RECORD;
  v_has_detail BOOLEAN;
  v_item_cogs DECIMAL(12,2);
  v_expense_category_id UUID;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE proposal_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Skip if no revenue or no site
  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer_id, site_id from proposal (via customer_sites)
  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;  -- No site, skip
  END IF;

  -- Compute COGS from proposal_items (same logic as computeProposalCogsUsd)
  FOR v_item IN
    SELECT pi.quantity, pi.cost_usd, pi.product_cost_usd, pi.labor_cost_usd,
           pi.material_cost_usd, pi.shipping_cost_usd, pi.misc_cost_usd
    FROM proposal_items pi
    WHERE pi.proposal_id = NEW.id
  LOOP
    v_has_detail :=
      (v_item.product_cost_usd IS NOT NULL AND v_item.product_cost_usd <> 0) OR
      (v_item.labor_cost_usd IS NOT NULL AND v_item.labor_cost_usd <> 0) OR
      (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0) OR
      (v_item.shipping_cost_usd IS NOT NULL AND v_item.shipping_cost_usd <> 0) OR
      (v_item.misc_cost_usd IS NOT NULL AND v_item.misc_cost_usd <> 0);

    IF v_has_detail THEN
      v_item_cogs := COALESCE(v_item.product_cost_usd, 0) + COALESCE(v_item.labor_cost_usd, 0) +
        COALESCE(v_item.material_cost_usd, 0) + COALESCE(v_item.shipping_cost_usd, 0) +
        COALESCE(v_item.misc_cost_usd, 0);
    ELSE
      v_item_cogs := COALESCE(v_item.cost_usd, 0);
    END IF;
    v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
  END LOOP;

  -- Get latest USD rate
  SELECT effective_rate INTO v_rate
  FROM exchange_rates
  WHERE currency = 'USD'
  ORDER BY rate_date DESC
  LIMIT 1;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    v_rate := 1;  -- Fallback to avoid invalid data
  END IF;

  v_amount_try := ROUND(v_total_usd * v_rate, 2);
  v_cogs_try := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
  v_output_vat := ROUND(v_amount_try * 0.20, 2);
  v_input_vat := CASE WHEN v_cogs_try > 0 THEN ROUND(v_cogs_try * 0.20, 2) ELSE NULL END;

  -- 1. Insert income transaction
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
      v_cogs_try, true, v_output_vat, 20,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_proposal_revenue failed for proposal %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- 2. Insert COGS as expense transaction (so P&L and /finance/expenses show it correctly)
  IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories
    WHERE code = 'material'
    LIMIT 1;

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
        true, v_input_vat, 20,
        CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_record_proposal_revenue COGS expense failed for proposal %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: Create COGS expense for existing proposals that have income with cogs_try but no expense
INSERT INTO financial_transactions (
  direction, proposal_id, expense_category_id,
  amount_original, original_currency, amount_try, exchange_rate,
  has_invoice, input_vat, vat_rate,
  transaction_date, customer_id, site_id, payment_method,
  created_at, updated_at
)
SELECT
  'expense',
  ft.proposal_id,
  (SELECT id FROM expense_categories WHERE code = 'material' LIMIT 1),
  ROUND(ft.cogs_try / NULLIF(COALESCE(ft.exchange_rate, 1), 0), 2),
  'USD',
  ft.cogs_try,
  ft.exchange_rate,
  true,
  ROUND(ft.cogs_try * 0.20, 2),
  20,
  ft.transaction_date,
  ft.customer_id,
  ft.site_id,
  ft.payment_method,
  now(),
  now()
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND ft.proposal_id IS NOT NULL
  AND ft.cogs_try IS NOT NULL
  AND ft.cogs_try > 0
  AND NOT EXISTS (
    SELECT 1 FROM financial_transactions e
    WHERE e.proposal_id = ft.proposal_id AND e.direction = 'expense'
  );
