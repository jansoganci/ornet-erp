-- Migration: 00165_proposal_annual_fixed_costs
-- Optional annual fixed-cost lines per proposal (informational; not in total_amount or COGS).

CREATE TABLE proposal_annual_fixed_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit         TEXT NOT NULL DEFAULT 'adet',
  unit_price   NUMERIC(12, 2) NOT NULL,
  currency     TEXT NOT NULL CHECK (currency IN ('TRY', 'USD', 'EUR'))
);

CREATE INDEX idx_proposal_annual_fixed_costs_proposal_id
  ON proposal_annual_fixed_costs (proposal_id);

CREATE INDEX idx_proposal_annual_fixed_costs_proposal_sort
  ON proposal_annual_fixed_costs (proposal_id, sort_order);

COMMENT ON TABLE proposal_annual_fixed_costs IS
  'Annual recurring cost lines for proposal PDF (informational only; excluded from proposals.total_amount and finance COGS).';

ALTER TABLE proposal_annual_fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_annual_fixed_costs_select
  ON proposal_annual_fixed_costs FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY proposal_annual_fixed_costs_manage
  ON proposal_annual_fixed_costs FOR ALL TO authenticated
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

GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_annual_fixed_costs TO authenticated;
