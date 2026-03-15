-- Migration: 00124_restrict_sim_cards_select_rls
-- Description: Restrict the sim_cards SELECT policy to admin and accountant only.
--   The previous policy ("Authenticated users can read sim_cards") exposed all
--   SIM card data — ICCID, revenue, cost, customer assignments, operator info —
--   to every authenticated user including field_workers. Technicians have no
--   business need to access SIM card records.

DROP POLICY IF EXISTS "Authenticated users can read sim_cards" ON sim_cards;

CREATE POLICY "sim_cards_select" ON sim_cards
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
