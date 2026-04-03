-- Migration: 00188_create_finance_health_check_view.sql
-- Description: Create a view to audit financial integrity between Work Orders/Proposals and Financial Transactions.

DROP VIEW IF EXISTS view_finance_health_check;

CREATE OR REPLACE VIEW view_finance_health_check AS
WITH completed_items AS (
  -- Standalone Work Orders (not linked to a proposal)
  SELECT 
    'work_order'::TEXT as source_type,
    wo.id as source_id,
    wo.form_no as reference_no,
    wo.status,
    wo.currency,
    wo.amount as expected_income,
    wo.completed_at as event_date,
    cs.customer_id,
    wo.site_id
  FROM work_orders wo
  JOIN customer_sites cs ON cs.id = wo.site_id
  WHERE wo.status = 'completed' 
    AND wo.proposal_id IS NULL
    AND wo.deleted_at IS NULL

  UNION ALL

  -- Proposals
  SELECT 
    'proposal'::TEXT as source_type,
    p.id as source_id,
    p.proposal_no as reference_no,
    p.status,
    p.currency,
    CASE 
      WHEN p.currency = 'USD' THEN p.total_amount_usd 
      ELSE p.total_amount 
    END as expected_income,
    p.accepted_at as event_date,
    cs.customer_id,
    p.site_id
  FROM proposals p
  JOIN customer_sites cs ON cs.id = p.site_id
  WHERE p.status = 'completed'
    AND p.deleted_at IS NULL
),
item_transactions AS (
  SELECT 
    work_order_id,
    proposal_id,
    direction,
    amount_original,
    original_currency,
    amount_try
  FROM financial_transactions
  WHERE deleted_at IS NULL
)
SELECT
  ci.source_type,
  ci.source_id,
  ci.reference_no,
  ci.event_date,
  ci.expected_income,
  ci.currency as expected_currency,
  ci.customer_id,
  ci.site_id,
  
  -- Income Audit
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE (it.work_order_id = ci.source_id OR it.proposal_id = ci.source_id)
        AND it.direction = 'income'
    ) THEN 'MISSING_INCOME'
    WHEN EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE (it.work_order_id = ci.source_id OR it.proposal_id = ci.source_id)
        AND it.direction = 'income'
        AND it.amount_original = 0
    ) THEN 'ZERO_VALUE_INCOME'
    WHEN EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE (it.work_order_id = ci.source_id OR it.proposal_id = ci.source_id)
        AND it.direction = 'income'
        AND it.original_currency <> ci.currency
    ) THEN 'CURRENCY_MISMATCH'
    ELSE 'OK'
  END as income_status,

  -- Expense Audit (COGS)
  -- We only flag missing expense if there are materials with cost > 0
  CASE 
    WHEN ci.source_type = 'work_order' AND EXISTS (
      SELECT 1 FROM work_order_materials wom 
      WHERE wom.work_order_id = ci.source_id 
        AND (wom.cost > 0 OR wom.cost_usd > 0)
    ) AND NOT EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE it.work_order_id = ci.source_id AND it.direction = 'expense'
    ) THEN 'MISSING_EXPENSE'
    
    WHEN ci.source_type = 'proposal' AND EXISTS (
      SELECT 1 FROM proposal_items pi 
      WHERE pi.proposal_id = ci.source_id 
        AND (pi.cost > 0 OR pi.cost_usd > 0 OR pi.product_cost > 0 OR pi.product_cost_usd > 0)
    ) AND NOT EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE it.proposal_id = ci.source_id AND it.direction = 'expense'
    ) THEN 'MISSING_EXPENSE'
    
    ELSE 'OK'
  END as expense_status

FROM completed_items ci
WHERE 
  -- Filter for only problematic records
  (
    NOT EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE (it.work_order_id = ci.source_id OR it.proposal_id = ci.source_id)
        AND it.direction = 'income'
    )
    OR EXISTS (
      SELECT 1 FROM item_transactions it 
      WHERE (it.work_order_id = ci.source_id OR it.proposal_id = ci.source_id)
        AND it.direction = 'income'
        AND (it.amount_original = 0 OR it.original_currency <> ci.currency)
    )
    OR (
      ci.source_type = 'work_order' AND EXISTS (
        SELECT 1 FROM work_order_materials wom 
        WHERE wom.work_order_id = ci.source_id 
          AND (wom.cost > 0 OR wom.cost_usd > 0)
      ) AND NOT EXISTS (
        SELECT 1 FROM item_transactions it 
        WHERE it.work_order_id = ci.source_id AND it.direction = 'expense'
      )
    )
    OR (
      ci.source_type = 'proposal' AND EXISTS (
        SELECT 1 FROM proposal_items pi 
        WHERE pi.proposal_id = ci.source_id 
          AND (pi.cost > 0 OR pi.cost_usd > 0 OR pi.product_cost > 0 OR pi.product_cost_usd > 0)
      ) AND NOT EXISTS (
        SELECT 1 FROM item_transactions it 
        WHERE it.proposal_id = ci.source_id AND it.direction = 'expense'
      )
    )
  );
