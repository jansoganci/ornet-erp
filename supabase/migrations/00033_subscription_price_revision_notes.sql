-- Migration: 00033_subscription_price_revision_notes
-- Description: Table for yearly price revision notes per subscription (timeline).
-- Used by: Price Revision page and Subscription Detail page.

CREATE TABLE subscription_price_revision_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  revision_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES profiles(id)
);

CREATE INDEX idx_revision_notes_subscription_date
  ON subscription_price_revision_notes (subscription_id, revision_date DESC);

ALTER TABLE subscription_price_revision_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revision_notes_select" ON subscription_price_revision_notes FOR SELECT
  TO authenticated USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "revision_notes_insert" ON subscription_price_revision_notes FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));
