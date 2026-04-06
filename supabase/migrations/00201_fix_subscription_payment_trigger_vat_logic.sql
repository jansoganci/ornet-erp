-- Migration: 00201_fix_subscription_payment_trigger_vat_logic
-- Description: Fix fn_subscription_payment_to_finance() trigger function
--   Issue 1: output_vat should be 0 when subscription.official_invoice = false
--   Issue 2: expense row should not have input_vat (internal cost, not supplier invoice)
-- Note: subscription_cogs expense category already exists (created in 00050)
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
  -- Sadece 'paid' statüsüne geçişte çalış
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: bu ödeme için zaten kayıt var mı?
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE subscription_payment_id = NEW.id LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Abonelik bilgilerini çek
  SELECT * INTO v_sub FROM subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Müşteri ve site bilgilerini çek
  SELECT cs.customer_id, cs.id INTO v_customer_id, v_site_id
  FROM customer_sites cs
  WHERE cs.id = v_sub.site_id;
  IF v_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_vat_rate := COALESCE(v_sub.vat_rate, 20);

  -- FIX 1: official_invoice = false ise output_vat = 0
  IF COALESCE(v_sub.official_invoice, true) THEN
    v_output_vat := COALESCE(NEW.vat_amount, 0);
  ELSE
    v_output_vat := 0;
  END IF;

  -- Dönem çarpanı (aylık maliyet × dönem = toplam COGS)
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

  -- ── Gelir kaydı ────────────────────────────────────────────────────────────
  BEGIN
    INSERT INTO financial_transactions (
      direction, income_type, subscription_payment_id,
      amount_original, original_currency, amount_try, exchange_rate,
      should_invoice, output_vat, vat_rate, cogs_try,
      transaction_date, customer_id, site_id, payment_method,
      pos_code,
      created_at, updated_at
    ) VALUES (
      'income', 'subscription', NEW.id,
      COALESCE(NEW.amount, 0), 'TRY', COALESCE(NEW.amount, 0), NULL,
      COALESCE(NEW.should_invoice, true), v_output_vat, v_vat_rate,
      CASE WHEN v_cogs_try > 0 THEN v_cogs_try ELSE NULL END,
      COALESCE(NEW.payment_date, NEW.payment_month), v_customer_id, v_site_id,
      COALESCE(NEW.payment_method, 'cash'),
      NEW.pos_code,
      now(), now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_subscription_payment_to_finance income failed for payment %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- ── Gider kaydı (COGS) ─────────────────────────────────────────────────────
  -- FIX 2: input_vat = NULL (iç maliyet, tedarikçi faturası değil)
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