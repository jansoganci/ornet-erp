-- 00208_complete_work_order_with_payment_rpc.sql
--
-- RPC: fn_complete_work_order_with_payment
--
-- Atomically completes a standalone work order and records how it was paid.
-- Business rules:
--   cash / card  → income document created by trigger; insert payment row → status 'paid'
--   bank_transfer → income document created by trigger; no payment row → status 'unpaid'
--                   (appears on /finance/receivables for later collection)
--
-- Proposal-linked WOs: trigger auto_record_work_order_revenue skips them (proposal_id guard).
--   The RPC still completes the WO; the caller receives 'completed_proposal_linked'.
--
-- Idempotency: if the WO trigger found no materials and created no finance row,
--   returns 'completed_no_finance' so the caller can surface an informational message.

CREATE OR REPLACE FUNCTION fn_complete_work_order_with_payment(
  p_work_order_id   UUID,
  p_payment_method  TEXT,              -- 'cash' | 'card' | 'bank_transfer'
  p_collection_date DATE    DEFAULT CURRENT_DATE,
  p_vat_rate        NUMERIC DEFAULT NULL  -- NULL = keep trigger value; 0 = override to no VAT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_wo_status      TEXT;
  v_proposal_id    UUID;
  v_wo_vat_rate    NUMERIC;
  v_transaction_id UUID;
  v_amount_try     DECIMAL(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Validate payment method
  IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
  END IF;

  -- Validate work order
  SELECT status, proposal_id, COALESCE(vat_rate, 0)
  INTO   v_wo_status, v_proposal_id, v_wo_vat_rate
  FROM   work_orders
  WHERE  id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order_not_found: %', p_work_order_id;
  END IF;

  IF v_wo_status <> 'in_progress' THEN
    RAISE EXCEPTION 'work_order_not_in_progress: current status is %', v_wo_status;
  END IF;

  -- Complete the WO; auto_record_work_order_revenue fires for standalone WOs.
  -- completed_at drives the transaction_date and USD exchange-rate lookup inside the trigger.
  UPDATE work_orders
  SET    status       = 'completed',
         completed_at = p_collection_date::TIMESTAMPTZ
  WHERE  id = p_work_order_id;

  -- Proposal-linked WOs: trigger skips them; nothing to do for payments.
  IF v_proposal_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed_proposal_linked');
  END IF;

  -- Find the freshly inserted income row (may not exist if no materials / zero amount).
  SELECT id, amount_try
  INTO   v_transaction_id, v_amount_try
  FROM   financial_transactions
  WHERE  work_order_id = p_work_order_id
    AND  direction     = 'income'
    AND  deleted_at    IS NULL
  ORDER  BY created_at DESC
  LIMIT  1;

  IF v_transaction_id IS NULL THEN
    RETURN jsonb_build_object('status', 'completed_no_finance');
  END IF;

  -- If the user overrode VAT in the completion modal, correct the finance row.
  -- The trigger used the WO's stored vat_rate; we recompute output_vat with the chosen rate.
  IF p_vat_rate IS NOT NULL AND p_vat_rate IS DISTINCT FROM v_wo_vat_rate THEN
    UPDATE financial_transactions
    SET    output_vat = ROUND(amount_try * p_vat_rate / 100, 2),
           vat_rate   = p_vat_rate
    WHERE  id = v_transaction_id;
  END IF;

  -- Stamp the payment method the operator chose on the income document.
  UPDATE financial_transactions
  SET    payment_method = p_payment_method
  WHERE  id = v_transaction_id;

  IF p_payment_method IN ('cash', 'card') THEN
    -- Immediate collection: insert payment row.
    -- Trigger fn_update_transaction_payment_status recalculates status → 'paid'.
    INSERT INTO financial_transaction_payments (
      transaction_id, amount_try, payment_method, paid_at, created_by
    ) VALUES (
      v_transaction_id, v_amount_try, p_payment_method, p_collection_date, v_user_id
    );

    RETURN jsonb_build_object(
      'status',          'paid',
      'transaction_id',  v_transaction_id,
      'payment_status',  'paid'
    );

  ELSE
    -- Bank transfer: mark document as unpaid; no payment row yet.
    UPDATE financial_transactions
    SET    payment_status = 'unpaid'
    WHERE  id = v_transaction_id;

    RETURN jsonb_build_object(
      'status',          'unpaid',
      'transaction_id',  v_transaction_id,
      'payment_status',  'unpaid'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)
  TO authenticated;
