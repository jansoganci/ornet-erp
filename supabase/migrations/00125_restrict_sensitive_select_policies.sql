-- Migration: 00125_restrict_sensitive_select_policies
-- Description: Restrict SELECT on 6 sensitive tables that were still open to all
--   authenticated users. Field workers (technicians) must not be able to read
--   financial payment records, proposal pricing, SIM card history, or static IP data.
--   All 6 policies are replaced with get_my_role() IN ('admin', 'accountant').

-- ── 1. subscription_payments ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "sp_select" ON subscription_payments;

CREATE POLICY "sp_select" ON subscription_payments
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ── 2. proposals ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read proposals" ON proposals;

CREATE POLICY "proposals_select" ON proposals
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ── 3. proposal_items ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read proposal_items" ON proposal_items;

CREATE POLICY "proposal_items_select" ON proposal_items
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ── 4. proposal_work_orders ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read proposal_work_orders" ON proposal_work_orders;

CREATE POLICY "proposal_work_orders_select" ON proposal_work_orders
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ── 5. sim_card_history ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read sim_card_history" ON sim_card_history;

CREATE POLICY "sim_card_history_select" ON sim_card_history
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ── 6. sim_static_ips ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sim_static_ips_select" ON sim_static_ips;

CREATE POLICY "sim_static_ips_select" ON sim_static_ips
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
