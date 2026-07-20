-- Migration: 00256_sim_card_financials_active_only
-- Description: SIM dashboard profit/MRR from view_sim_card_financials counts only
--   status = 'active'. Subscription-status lines are billed via subscriptions module.

CREATE OR REPLACE VIEW view_sim_card_financials AS
SELECT
    COALESCE(SUM(sale_price), 0) AS total_monthly_revenue,
    COALESCE(SUM(cost_price), 0) AS total_monthly_cost,
    COALESCE(SUM(sale_price - cost_price), 0) AS total_monthly_profit,
    COUNT(*) AS active_sim_count
FROM sim_cards
WHERE status = 'active';
