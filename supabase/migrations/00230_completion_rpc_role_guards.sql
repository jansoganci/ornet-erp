-- Migration: 00230_completion_rpc_role_guards
-- A7: Guard completion RPCs by role/assignment.
--
-- Rules:
-- - fn_complete_work_order_with_payment:
--     admin/accountant always allowed
--     field_worker allowed only if assigned to the work order
-- - complete_proposal_with_rate:
--     admin/accountant only

BEGIN;

CREATE OR REPLACE FUNCTION fn_complete_work_order_with_payment(
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
  v_user_id        UUID;
  v_user_role      TEXT;
  v_wo_status      TEXT;
  v_proposal_id    UUID;
  v_wo_vat_rate    NUMERIC;
  v_assigned_to    UUID[];
  v_transaction_id UUID;
  v_amount_try     DECIMAL(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_user_role := get_my_role();

  IF p_payment_method NOT IN ('cash', 'card', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_payment_method: %', p_payment_method;
  END IF;

  SELECT status, proposal_id, COALESCE(vat_rate, 0), assigned_to
  INTO   v_wo_status, v_proposal_id, v_wo_vat_rate, v_assigned_to
  FROM   work_orders
  WHERE  id = p_work_order_id;

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

  UPDATE work_orders
  SET    status       = 'completed',
         completed_at = p_collection_date::TIMESTAMPTZ
  WHERE  id = p_work_order_id;

  IF v_proposal_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed_proposal_linked');
  END IF;

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

  IF p_vat_rate IS NOT NULL AND p_vat_rate IS DISTINCT FROM v_wo_vat_rate THEN
    UPDATE financial_transactions
    SET    output_vat = ROUND(amount_try * p_vat_rate / 100, 2),
           vat_rate   = p_vat_rate
    WHERE  id = v_transaction_id;
  END IF;

  UPDATE financial_transactions
  SET    payment_method = p_payment_method
  WHERE  id = v_transaction_id;

  IF p_payment_method IN ('cash', 'card') THEN
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

CREATE OR REPLACE FUNCTION complete_proposal_with_rate(
  p_proposal_id    UUID,
  p_exchange_rate  DECIMAL,
  p_rate_suggested DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed_usd DECIMAL(12,2);
  v_role         TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot complete proposal with rate', v_role;
  END IF;

  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'exchange_rate must be greater than zero';
  END IF;

  SELECT COALESCE(
    SUM(COALESCE(NULLIF(pi.total_usd, 0), pi.unit_price_usd * pi.quantity)),
    0
  )
  INTO v_computed_usd
  FROM proposal_items pi
  WHERE pi.proposal_id = p_proposal_id;

  UPDATE proposals
  SET
    status                    = 'completed',
    completed_at              = now(),
    completed_by              = auth.uid(),
    completion_exchange_rate  = p_exchange_rate,
    completion_rate_suggested = p_rate_suggested,
    total_amount_usd          = CASE
                                  WHEN COALESCE(total_amount_usd, 0) <= 0
                                   AND v_computed_usd > 0
                                  THEN v_computed_usd
                                  ELSE total_amount_usd
                                END
  WHERE id         = p_proposal_id
    AND status     = 'accepted'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal % not found or not in accepted status', p_proposal_id;
  END IF;
END;
$$;

COMMIT;
