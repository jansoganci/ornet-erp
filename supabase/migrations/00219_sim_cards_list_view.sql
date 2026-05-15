-- SIM list: expose Turkish-normalized search columns (same rules as customers.company_name_search)
-- so list queries can filter by phone OR linked customer name OR free-text customer_label.

CREATE OR REPLACE VIEW public.sim_cards_list AS
SELECT
  sc.*,
  cc.company_name_search AS customer_company_name_search,
  normalize_tr_for_search(sc.customer_label) AS customer_label_search
FROM public.sim_cards sc
LEFT JOIN public.customers cc
  ON cc.id = sc.customer_id
  AND cc.deleted_at IS NULL;

COMMENT ON VIEW public.sim_cards_list IS
  'Read-only list helper: customer + label search columns for /sim-cards. RLS on sim_cards applies (security_invoker).';

ALTER VIEW public.sim_cards_list SET (security_invoker = true);

GRANT SELECT ON public.sim_cards_list TO authenticated;
