-- Migration: 00116_fix_financial_transactions_rls
-- Description: Fix broken ft_select and ft_update policies that referenced
--   non-existent roles ('manager', 'office'). The actual roles in this system
--   are 'admin', 'field_worker', 'accountant'. The broken policies (written in
--   00081 and 00089) locked accountants out of all financial data entirely.
--   Replace with get_my_role() IN ('admin', 'accountant') to match all other
--   finance-restricted policies in this codebase.

DROP POLICY IF EXISTS ft_select ON financial_transactions;
CREATE POLICY ft_select ON financial_transactions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  );

DROP POLICY IF EXISTS ft_update ON financial_transactions;
CREATE POLICY ft_update ON financial_transactions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  )
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
