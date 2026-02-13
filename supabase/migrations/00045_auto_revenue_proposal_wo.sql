-- Migration: 00045_auto_revenue_proposal_wo
-- Description: Module 1.5 Part 1 - Auto-record financial_transaction when proposal status becomes 'completed'
-- Trigger: proposals status -> completed (set by check_proposal_completion when last WO done)

-- ============================================================
-- Function: auto_record_proposal_revenue()
-- Fires when proposal status becomes 'completed' (set by check_proposal_completion when last WO done)
-- ============================================================
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
  v_exists BOOLEAN;
  v_item RECORD;
  v_has_detail BOOLEAN;
  v_item_cogs DECIMAL(12,2);
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
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_record_proposal_revenue
  AFTER UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION auto_record_proposal_revenue();
