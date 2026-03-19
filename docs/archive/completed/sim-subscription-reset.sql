-- =============================================================================
-- Safe database reset: SIM cards and subscriptions
-- Run this in Supabase SQL Editor when you want to clear all subscription and
-- SIM card data and start fresh. Views will show 0/NULL after the reset.
-- =============================================================================

BEGIN;

-- 1. Subscription-related data (order matters for FKs)
--    subscription_payments references subscriptions; financial_transactions
--    references subscription_payments (ON DELETE SET NULL), so we can delete
--    payments first.
DELETE FROM subscription_payments;

--    subscriptions is referenced by subscription_price_revision_notes
--    (ON DELETE CASCADE) and site_assets (ON DELETE SET NULL). Deleting
--    subscriptions will CASCADE-delete revision notes and SET NULL on site_assets.
DELETE FROM subscriptions;

-- 2. SIM-related data
--    sim_static_ips references sim_cards with no ON DELETE (RESTRICT), so we
--    must remove static IP rows before touching sim_cards.
DELETE FROM sim_static_ips;

--    sim_card_history references sim_cards (ON DELETE CASCADE). We can delete
--    history first so sim_cards truncate/delete is simpler, or rely on CASCADE.
DELETE FROM sim_card_history;

--    sim_cards: financial_transactions.sim_card_id is ON DELETE SET NULL, so
--    deleting sim_cards is allowed and will null out those columns.
DELETE FROM sim_cards;

COMMIT;

-- =============================================================================
-- Verify: views should show zeros after reset
-- =============================================================================
-- Run these in the SQL Editor after the block above to confirm:
--
--   SELECT * FROM view_sim_card_stats;
--   -- Expected: total_count=0, available_count=0, active_count=0,
--   --           subscription_count=0, cancelled_count=0
--
--   SELECT * FROM view_sim_card_financials;
--   -- Expected: total_monthly_revenue=0, total_monthly_cost=0,
--   --           total_monthly_profit=0, active_sim_count=0
-- =============================================================================
