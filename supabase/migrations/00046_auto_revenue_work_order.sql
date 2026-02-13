-- Migration: 00046_auto_revenue_work_order
-- Description: Module 1.5 Part 2 - Auto-record financial_transaction when standalone work order status becomes 'completed'
-- Trigger: work_orders status -> completed (only when proposal_id IS NULL)

-- ============================================================
-- Function: auto_record_work_order_revenue()
-- Fires when standalone work order (no proposal link) status becomes 'completed'
-- ============================================================
CREATE OR REPLACE FUNCTION auto_record_work_order_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_site_id UUID;
  v_amount_orig DECIMAL(12,2);
  v_currency TEXT;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_output_vat DECIMAL(12,2);
  v_exists BOOLEAN;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Only standalone work orders (no proposal link)
  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE work_order_id = NEW.id AND direction = 'income' LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  v_amount_orig := COALESCE(NEW.amount, 0);
  IF v_amount_orig <= 0 THEN
    RETURN NEW;
  END IF;

  -- Need site for customer_id lookup
  IF NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer_id, site_id from work order (via customer_sites)
  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_currency := CASE WHEN UPPER(COALESCE(NEW.currency, 'TRY')) = 'USD' THEN 'USD' ELSE 'TRY' END;

  IF v_currency = 'USD' THEN
    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
    ORDER BY rate_date DESC
    LIMIT 1;
    IF v_rate IS NULL OR v_rate <= 0 THEN
      v_rate := 1;
    END IF;
    v_amount_try := ROUND(v_amount_orig * v_rate, 2);
  ELSE
    v_rate := NULL;
    v_amount_try := v_amount_orig;
  END IF;

  v_output_vat := ROUND(v_amount_try * 0.20, 2);

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
      true, v_output_vat, 20,
      CURRENT_DATE, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_record_work_order_revenue failed for work_order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_record_work_order_revenue
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_record_work_order_revenue();
