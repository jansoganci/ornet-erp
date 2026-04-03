-- Expose vat_rate and has_tevkifat on proposals_detail (added to proposals in 00155 / 00171).
-- Without these, fetchProposal/select * returns undefined and the form resets on reload.

DROP VIEW IF EXISTS proposals_detail;

CREATE VIEW proposals_detail AS
SELECT
  p.id,
  p.proposal_no,
  p.site_id,
  p.title,
  p.notes,
  p.scope_of_work,
  p.currency,
  p.total_amount_usd,
  p.total_amount,
  p.status,
  p.created_by,
  p.created_at,
  p.sent_at,
  p.accepted_at,
  p.rejected_at,
  p.updated_at,
  p.company_name,
  p.proposal_date,
  p.survey_date,
  p.authorized_person,
  p.installation_date,
  p.customer_representative,
  p.completion_date,
  p.discount_percent,
  p.vat_rate,
  p.has_tevkifat,
  p.terms_engineering,
  p.terms_pricing,
  p.terms_warranty,
  p.terms_other,
  p.terms_attachments,
  cs.site_name,
  cs.address AS site_address,
  cs.city,
  cs.account_no,
  c.id AS customer_id,
  c.company_name AS customer_company_name,
  c.phone AS customer_phone,
  normalize_tr_for_search(p.title) AS title_search,
  normalize_tr_for_search(c.company_name) AS customer_company_name_search,
  normalize_tr_for_search(p.proposal_no) AS proposal_no_search,
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
LEFT JOIN customer_sites cs ON cs.id = p.site_id
LEFT JOIN customers c ON c.id = cs.customer_id;

ALTER VIEW proposals_detail SET (security_invoker = true);
GRANT SELECT ON proposals_detail TO authenticated;
