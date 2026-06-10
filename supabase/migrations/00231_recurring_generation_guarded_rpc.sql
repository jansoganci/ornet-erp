-- Migration: 00231_recurring_generation_guarded_rpc
-- A3 follow-up: keep direct fn_generate_recurring_expenses() revoked from authenticated,
-- while exposing a role-guarded wrapper for admin/accountant manual generation.

BEGIN;

CREATE OR REPLACE FUNCTION fn_generate_recurring_expenses_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot generate recurring expenses', v_role;
  END IF;

  PERFORM fn_generate_recurring_expenses();
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generate_recurring_expenses_guarded() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_generate_recurring_expenses_guarded() TO authenticated;

COMMIT;
