-- Fix: proposal_sections table was created in 00197 without RLS or grants.
-- Pattern mirrors proposal_annual_fixed_costs (00165).

ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_sections_select
  ON proposal_sections FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY proposal_sections_manage
  ON proposal_sections FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'accountant')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_sections TO authenticated;
