-- 00242_payment_vat_settlement_consistency.sql
--
-- Align standalone work-order completion payments and payment-status settlement
-- with the confirmed finance contract:
-- - financial_transactions.amount_try = net amount excluding VAT
-- - financial_transactions.output_vat = collectible VAT
-- - collectible total = amount_try + COALESCE(output_vat, 0)
-- - financial_transaction_payments.amount_try = collected customer payment amount
--
-- Scope:
-- 1. Cash/card completion inserts the collectible total into payment rows.
-- 2. Payment-status recalculation settles against collectible total, not net-only.
-- 3. Preserve existing role guards, VAT override semantics, proposal-linked skip,
--    and bank-transfer unpaid behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_complete_work_order_with_payment(
  p_work_order_id   UUID,
  p_payment_method  TEXT,
  p_collection_date DATE    DEFAULT CURRENT_DATE,
  p_vat_rate        NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id              UUID;
  v_user_role            TEXT;
  v_wo_status            TEXT;
  v_proposal_id          UUID;
  v_assigned_to          UUID[];
  v_transaction_id       UUID;
  v_amount_try           DECIMAL(12,2);
  v_output_vat           DECIMAL(12,2);
  v_collectible_amount   DECIMAL(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_user_role := get_my_role();

  IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
  END IF;

  SELECT status, proposal_id, assigned_to
  INTO v_wo_status, v_proposal_id, v_assigned_to
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order_not_found: %', p_work_order_id;
  END IF;

  IF v_user_role IS NULL OR (
    v_user_role NOT IN ('admin', 'accountant')
    AND NOT (v_user_role = 'field_worker' AND v_user_id = ANY(COALESCE(v_assigned_to, ARRAY[]::UUID[])))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot complete this work order', v_user_role;
  END IF;

  IF v_wo_status <> 'in_progress' THEN
    RAISE EXCEPTION 'work_order_not_in_progress: current status is %', v_wo_status;
  END IF;

  UPDATE public.work_orders
  SET
    status = 'completed',
    completed_at = p_collection_date::TIMESTAMPTZ,
    vat_rate = CASE
      WHEN p_vat_rate IS NOT NULL THEN p_vat_rate
      ELSE vat_rate
    END,
    has_vat = CASE
      WHEN p_vat_rate IS NOT NULL THEN p_vat_rate > 0
      ELSE has_vat
    END
  WHERE id = p_work_order_id;

  IF v_proposal_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed_proposal_linked');
  END IF;

  SELECT id, amount_try, COALESCE(output_vat, 0)
  INTO v_transaction_id, v_amount_try, v_output_vat
  FROM public.financial_transactions
  WHERE work_order_id = p_work_order_id
    AND direction = 'income'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_transaction_id IS NULL THEN
    RETURN jsonb_build_object('status', 'completed_no_finance');
  END IF;

  UPDATE public.financial_transactions
  SET payment_method = p_payment_method
  WHERE id = v_transaction_id;

  IF p_payment_method IN ('cash', 'card') THEN
    v_collectible_amount := COALESCE(v_amount_try, 0) + COALESCE(v_output_vat, 0);

    INSERT INTO public.financial_transaction_payments (
      transaction_id,
      amount_try,
      payment_method,
      paid_at,
      created_by
    ) VALUES (
      v_transaction_id,
      v_collectible_amount,
      p_payment_method,
      p_collection_date,
      v_user_id
    );

    RETURN jsonb_build_object(
      'status', 'paid',
      'transaction_id', v_transaction_id,
      'payment_status', 'paid'
    );
  END IF;

  UPDATE public.financial_transactions
  SET payment_status = 'unpaid'
  WHERE id = v_transaction_id;

  RETURN jsonb_build_object(
    'status', 'unpaid',
    'transaction_id', v_transaction_id,
    'payment_status', 'unpaid'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_update_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid         DECIMAL(12,2);
  v_amount_try         DECIMAL(12,2);
  v_output_vat         DECIMAL(12,2);
  v_collectible_total  DECIMAL(12,2);
BEGIN
  SELECT
    COALESCE(amount_try, 0),
    COALESCE(output_vat, 0)
  INTO
    v_amount_try,
    v_output_vat
  FROM public.financial_transactions
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  v_collectible_total := v_amount_try + v_output_vat;

  SELECT COALESCE(SUM(COALESCE(ftp.amount, ftp.amount_try)), 0)
  INTO v_total_paid
  FROM public.financial_transaction_payments ftp
  WHERE ftp.transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
    AND ftp.deleted_at IS NULL;

  UPDATE public.financial_transactions
  SET payment_status = CASE
    WHEN v_total_paid >= v_collectible_total THEN 'paid'
    WHEN v_total_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;

-- REVERT:
-- BEGIN;
--
-- CREATE OR REPLACE FUNCTION public.fn_complete_work_order_with_payment(
--   p_work_order_id   UUID,
--   p_payment_method  TEXT,
--   p_collection_date DATE    DEFAULT CURRENT_DATE,
--   p_vat_rate        NUMERIC DEFAULT NULL
-- )
-- RETURNS JSONB
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_user_id        UUID;
--   v_user_role      TEXT;
--   v_wo_status      TEXT;
--   v_proposal_id    UUID;
--   v_assigned_to    UUID[];
--   v_transaction_id UUID;
--   v_amount_try     DECIMAL(12,2);
-- BEGIN
--   v_user_id := auth.uid();
--   IF v_user_id IS NULL THEN
--     RAISE EXCEPTION 'not_authenticated';
--   END IF;
--
--   v_user_role := get_my_role();
--
--   IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
--     RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
--   END IF;
--
--   SELECT status, proposal_id, assigned_to
--   INTO v_wo_status, v_proposal_id, v_assigned_to
--   FROM public.work_orders
--   WHERE id = p_work_order_id
--   FOR UPDATE;
--
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'work_order_not_found: %', p_work_order_id;
--   END IF;
--
--   IF v_user_role IS NULL OR (
--     v_user_role NOT IN ('admin', 'accountant')
--     AND NOT (v_user_role = 'field_worker' AND v_user_id = ANY(COALESCE(v_assigned_to, ARRAY[]::UUID[])))
--   ) THEN
--     RAISE EXCEPTION 'Unauthorized: role % cannot complete this work order', v_user_role;
--   END IF;
--
--   IF v_wo_status <> 'in_progress' THEN
--     RAISE EXCEPTION 'work_order_not_in_progress: current status is %', v_wo_status;
--   END IF;
--
--   UPDATE public.work_orders
--   SET
--     status = 'completed',
--     completed_at = p_collection_date::TIMESTAMPTZ,
--     vat_rate = CASE
--       WHEN p_vat_rate IS NOT NULL THEN p_vat_rate
--       ELSE vat_rate
--     END,
--     has_vat = CASE
--       WHEN p_vat_rate IS NOT NULL THEN p_vat_rate > 0
--       ELSE has_vat
--     END
--   WHERE id = p_work_order_id;
--
--   IF v_proposal_id IS NOT NULL THEN
--     RETURN jsonb_build_object('status', 'completed_proposal_linked');
--   END IF;
--
--   SELECT id, amount_try
--   INTO v_transaction_id, v_amount_try
--   FROM public.financial_transactions
--   WHERE work_order_id = p_work_order_id
--     AND direction = 'income'
--     AND deleted_at IS NULL
--   ORDER BY created_at DESC
--   LIMIT 1;
--
--   IF v_transaction_id IS NULL THEN
--     RETURN jsonb_build_object('status', 'completed_no_finance');
--   END IF;
--
--   UPDATE public.financial_transactions
--   SET payment_method = p_payment_method
--   WHERE id = v_transaction_id;
--
--   IF p_payment_method IN ('cash', 'card') THEN
--     INSERT INTO public.financial_transaction_payments (
--       transaction_id,
--       amount_try,
--       payment_method,
--       paid_at,
--       created_by
--     ) VALUES (
--       v_transaction_id,
--       v_amount_try,
--       p_payment_method,
--       p_collection_date,
--       v_user_id
--     );
--
--     RETURN jsonb_build_object(
--       'status', 'paid',
--       'transaction_id', v_transaction_id,
--       'payment_status', 'paid'
--     );
--   END IF;
--
--   UPDATE public.financial_transactions
--   SET payment_status = 'unpaid'
--   WHERE id = v_transaction_id;
--
--   RETURN jsonb_build_object(
--     'status', 'unpaid',
--     'transaction_id', v_transaction_id,
--     'payment_status', 'unpaid'
--   );
-- END;
-- $$;
--
-- GRANT EXECUTE ON FUNCTION public.fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)
--   TO authenticated;
--
-- CREATE OR REPLACE FUNCTION public.fn_update_payment_status()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_total_paid DECIMAL(12,2);
--   v_amount_try DECIMAL(12,2);
-- BEGIN
--   SELECT amount_try INTO v_amount_try
--   FROM financial_transactions
--   WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
--
--   SELECT COALESCE(SUM(COALESCE(ftp.amount, ftp.amount_try)), 0) INTO v_total_paid
--   FROM financial_transaction_payments ftp
--   WHERE ftp.transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
--     AND ftp.deleted_at IS NULL;
--
--   UPDATE financial_transactions
--   SET payment_status = CASE
--     WHEN v_total_paid >= v_amount_try THEN 'paid'
--     WHEN v_total_paid > 0 THEN 'partial'
--     ELSE 'unpaid'
--   END
--   WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
--
--   RETURN COALESCE(NEW, OLD);
-- END;
-- $$;
--
-- COMMIT;
