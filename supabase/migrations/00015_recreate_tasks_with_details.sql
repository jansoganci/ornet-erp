-- Migration: 00015_recreate_tasks_with_details
-- Description: Recreate tasks_with_details view after 00009 (work_orders now has site_id, no customer_id/title)
-- Used by: tasks feature fetchTasks() for list with assigned_to_name, work_order_title, customer_name

CREATE VIEW tasks_with_details AS
SELECT
  t.*,
  p.full_name AS assigned_to_name,
  COALESCE(wo.description, wo.form_no, '')::TEXT AS work_order_title,
  c.company_name AS customer_name
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
LEFT JOIN work_orders wo ON t.work_order_id = wo.id
LEFT JOIN customer_sites s ON wo.site_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id;

GRANT SELECT ON tasks_with_details TO authenticated;
