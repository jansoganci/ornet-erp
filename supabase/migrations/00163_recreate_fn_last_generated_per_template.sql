-- Re-apply fn_last_generated_per_template which was defined in 00116
-- but appears to be missing from the remote database (404 on RPC call).

CREATE OR REPLACE FUNCTION fn_last_generated_per_template()
RETURNS TABLE(recurring_template_id uuid, last_date date)
LANGUAGE sql
STABLE
AS $$
  SELECT recurring_template_id, MAX(transaction_date)::date
  FROM financial_transactions
  WHERE recurring_template_id IS NOT NULL
  GROUP BY recurring_template_id;
$$;
