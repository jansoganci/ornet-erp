-- SIM Card Financial and Operational Views
-- Path: supabase/migrations/00025_sim_card_financial_views.sql

-- View for overall SIM card statistics
CREATE OR REPLACE VIEW view_sim_card_stats AS
SELECT
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'available') as available_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
    COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
    COUNT(DISTINCT operator) as operator_count
FROM sim_cards;

-- View for financial performance (Monthly Recurring Revenue and Cost)
CREATE OR REPLACE VIEW view_sim_card_financials AS
SELECT
    COALESCE(SUM(sale_price), 0) as total_monthly_revenue,
    COALESCE(SUM(cost_price), 0) as total_monthly_cost,
    COALESCE(SUM(sale_price - cost_price), 0) as total_monthly_profit,
    COUNT(*) as active_sim_count
FROM sim_cards
WHERE status = 'active';

-- View for operator-based distribution
CREATE OR REPLACE VIEW view_sim_card_operator_distribution AS
SELECT
    operator,
    COUNT(*) as count,
    COALESCE(SUM(sale_price - cost_price), 0) as operator_profit
FROM sim_cards
GROUP BY operator;

-- Grant access to authenticated users
GRANT SELECT ON view_sim_card_stats TO authenticated;
GRANT SELECT ON view_sim_card_financials TO authenticated;
GRANT SELECT ON view_sim_card_operator_distribution TO authenticated;
