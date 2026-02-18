-- Migration: 00075_proposals_detail_add_city
-- Description: Add city field to proposals_detail view for filtering and display

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
  p.survey_date,
  p.authorized_person,
  p.installation_date,
  p.customer_representative,
  p.completion_date,
  p.discount_percent,
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
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
LEFT JOIN customer_sites cs ON cs.id = p.site_id
LEFT JOIN customers c ON c.id = cs.customer_id;

GRANT SELECT ON proposals_detail TO authenticated;
