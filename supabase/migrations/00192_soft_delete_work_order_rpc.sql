-- 00192_soft_delete_work_order_rpc.sql
-- SECURITY DEFINER RPC for soft-deleting a work order.
-- Mirrors 00161_soft_delete_proposal_rpc: direct UPDATE under RLS returns 403/42501
-- when get_my_role() + WITH CHECK interact badly with the planner.
-- Role is enforced inside the function (admin only).

CREATE OR REPLACE FUNCTION soft_delete_work_order(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE work_orders
  SET deleted_at = now()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_work_order(UUID) TO authenticated;
