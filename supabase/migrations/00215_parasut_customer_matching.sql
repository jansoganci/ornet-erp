-- Migration: 00215_parasut_customer_matching
-- Description: Paraşüt customer matching foundation

-- Customer-side Paraşüt metadata.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS parasut_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS identity_type TEXT,
  ADD COLUMN IF NOT EXISTS tax_office TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_identity_type_check'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_identity_type_check
      CHECK (identity_type IS NULL OR identity_type IN ('vkn', 'tckn'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_parasut_contact
  ON public.customers (parasut_contact_id)
  WHERE parasut_contact_id IS NOT NULL;

-- Tighten customer writes to the app's canWrite roles. The UI already blocks
-- field workers from the customer form; this aligns the database boundary.
DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_update_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_can_write" ON public.customers;
DROP POLICY IF EXISTS "customers_update_can_write" ON public.customers;

CREATE POLICY "customers_insert_can_write"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "customers_update_can_write"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (public.get_my_role() IN ('admin', 'accountant'));

-- Staging table for bulk Paraşüt contact matching results. Accepted rows will
-- copy parasut_contact_id onto customers in a later PR.
CREATE TABLE IF NOT EXISTS public.parasut_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  parasut_contact_id TEXT NOT NULL,
  parasut_contact_name TEXT,
  parasut_tax_number TEXT,
  match_type TEXT NOT NULL
    CHECK (match_type IN ('exact_vkn', 'exact_tckn', 'name_only')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  score NUMERIC(5, 2),
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parasut_match_candidates_customer_contact
  ON public.parasut_match_candidates (customer_id, parasut_contact_id)
  ;

CREATE INDEX IF NOT EXISTS idx_parasut_match_candidates_customer
  ON public.parasut_match_candidates (customer_id);

CREATE INDEX IF NOT EXISTS idx_parasut_match_candidates_status
  ON public.parasut_match_candidates (status);

DROP TRIGGER IF EXISTS update_parasut_match_candidates_updated_at
  ON public.parasut_match_candidates;

CREATE TRIGGER update_parasut_match_candidates_updated_at
  BEFORE UPDATE ON public.parasut_match_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.parasut_match_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parasut_match_candidates_select_admin" ON public.parasut_match_candidates;
DROP POLICY IF EXISTS "parasut_match_candidates_insert_admin" ON public.parasut_match_candidates;
DROP POLICY IF EXISTS "parasut_match_candidates_update_admin" ON public.parasut_match_candidates;
DROP POLICY IF EXISTS "parasut_match_candidates_delete_admin" ON public.parasut_match_candidates;

CREATE POLICY "parasut_match_candidates_select_admin"
  ON public.parasut_match_candidates FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "parasut_match_candidates_insert_admin"
  ON public.parasut_match_candidates FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "parasut_match_candidates_update_admin"
  ON public.parasut_match_candidates FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "parasut_match_candidates_delete_admin"
  ON public.parasut_match_candidates FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin');
