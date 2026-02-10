-- Migration: Proposals Module (Phase 1)
-- Tables: proposals, proposal_items
-- View: proposals_detail
-- Function: generate_proposal_no()

-- ============================================================
-- Function: generate_proposal_no()
-- ============================================================
CREATE OR REPLACE FUNCTION generate_proposal_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  today_str TEXT;
  seq INT;
BEGIN
  today_str := to_char(CURRENT_DATE, 'DD.MM.YYYY');
  SELECT count(*) + 1 INTO seq FROM proposals WHERE created_at::date = CURRENT_DATE;
  RETURN today_str || '-' || lpad(seq::text, 4, '0');
END;
$$;

-- ============================================================
-- Table: proposals
-- ============================================================
CREATE TABLE proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_no       TEXT NOT NULL UNIQUE,
  site_id           UUID NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  notes             TEXT,
  scope_of_work     TEXT,
  currency          TEXT NOT NULL DEFAULT 'USD',
  total_amount_usd  DECIMAL(12,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','accepted','rejected','cancelled')),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  rejected_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: proposal_items
-- ============================================================
CREATE TABLE proposal_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,
  description       TEXT NOT NULL,
  quantity          DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit              TEXT DEFAULT 'adet',
  unit_price_usd    DECIMAL(12,2) NOT NULL,
  total_usd         DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price_usd) STORED,
  cost_usd          DECIMAL(12,2),
  margin_percent    DECIMAL(5,2)
);

-- ============================================================
-- View: proposals_detail
-- ============================================================
CREATE OR REPLACE VIEW proposals_detail AS
SELECT
  p.*,
  cs.site_name,
  cs.address AS site_address,
  cs.account_no,
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone
FROM proposals p
JOIN customer_sites cs ON cs.id = p.site_id
JOIN customers c ON c.id = cs.customer_id;

-- ============================================================
-- RLS: proposals
-- ============================================================
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposals"
    ON proposals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage proposals"
    ON proposals FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'accountant')
        )
    );

-- ============================================================
-- RLS: proposal_items
-- ============================================================
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal_items"
    ON proposal_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage proposal_items"
    ON proposal_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'accountant')
        )
    );

-- ============================================================
-- Trigger: updated_at on proposals
-- ============================================================
CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
