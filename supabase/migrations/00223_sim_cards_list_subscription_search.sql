-- Extend sim_cards_list with normalized phone + buyer search columns for subscription SIM picker.

CREATE OR REPLACE VIEW public.sim_cards_list AS
SELECT
  sc.*,
  cc.company_name_search AS customer_company_name_search,
  normalize_tr_for_search(sc.customer_label) AS customer_label_search,
  normalize_tr_for_search(sc.phone_number) AS phone_search,
  bc.company_name_search AS buyer_company_name_search
FROM public.sim_cards sc
LEFT JOIN public.customers cc
  ON cc.id = sc.customer_id
  AND cc.deleted_at IS NULL
LEFT JOIN public.customers bc
  ON bc.id = sc.buyer_id
  AND bc.deleted_at IS NULL;

COMMENT ON VIEW public.sim_cards_list IS
  'Read-only list helper: customer, label, phone, and buyer search columns for /sim-cards and subscription SIM picker.';

ALTER VIEW public.sim_cards_list SET (security_invoker = true);

GRANT SELECT ON public.sim_cards_list TO authenticated;
