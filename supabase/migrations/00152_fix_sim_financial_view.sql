-- Migration: 00152_fix_sim_financial_view
-- Description: Include SIM cards with status 'subscription' in view_sim_card_financials.
--   Phase 2 G3 from finance-fix-roadmap: subscription-linked SIMs contribute to MRR metrics.

CREATE OR REPLACE VIEW view_sim_card_financials AS
SELECT
    COALESCE(SUM(sale_price), 0) as total_monthly_revenue,
    COALESCE(SUM(cost_price), 0) as total_monthly_cost,
    COALESCE(SUM(sale_price - cost_price), 0) as total_monthly_profit,
    COUNT(*) as active_sim_count
FROM sim_cards
WHERE status IN ('active', 'subscription');
