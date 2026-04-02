-- Migration: 00178_fix_cancel_future_payments
-- Description:
-- - On cancellation, always nullify future auto-generated debts by marking
--   future pending subscription_payments as 'skipped'.
-- - If p_write_off_unpaid is true, write off any remaining pending payments
--   (past/current) as 'write_off'.

CREATE OR REPLACE FUNCTION fn_cancel_subscription(
  p_subscription_id  UUID,
  p_reason           TEXT    DEFAULT NULL,
  p_write_off_unpaid BOOLEAN DEFAULT FALSE
)
RETURNS SETOF subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    TEXT;
  v_user_id UUID;
  v_row     subscriptions%ROWTYPE;
  v_current_month_start DATE;
BEGIN
  -- Role guard: only admin and accountant may cancel subscriptions
  v_role := get_my_role();
  IF v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot perform this action', v_role;
  END IF;

  v_current_month_start := date_trunc('month', CURRENT_DATE)::DATE;

  -- Resolve the calling user for the audit log
  SELECT auth.uid() INTO v_user_id;

  -- 1. Cancel the subscription
  UPDATE subscriptions
  SET
    status        = 'cancelled',
    cancel_reason = p_reason,
    cancelled_at  = NOW(),
    updated_at    = NOW()
  WHERE id = p_subscription_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

  -- 2. Always skip future pending payments (future auto-generated debts)
  UPDATE subscription_payments
  SET
    status     = 'skipped',
    updated_at = NOW()
  WHERE subscription_id = p_subscription_id
    AND status          = 'pending'
    AND payment_month   > v_current_month_start;

  -- 3. Optionally write off remaining pending payments (past/current debts)
  IF p_write_off_unpaid THEN
    UPDATE subscription_payments
    SET
      status     = 'write_off',
      updated_at = NOW()
    WHERE subscription_id = p_subscription_id
      AND status          = 'pending';
  END IF;

  -- 4. Audit log (inside the same transaction)
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    description
  )
  VALUES (
    'subscriptions',
    p_subscription_id,
    'cancel',
    NULL,
    jsonb_build_object(
      'reason',           p_reason,
      'write_off_unpaid', p_write_off_unpaid
    ),
    v_user_id,
    'Abonelik iptal edildi'
  );

  RETURN NEXT v_row;
END;
$$;

