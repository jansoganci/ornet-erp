-- Migration: 00133_fix_subscription_payments_proposals_rls
-- Description: Ensure field_worker cannot read subscription_payments or proposals.
--   Drops ALL existing SELECT policies and recreates only the restrictive ones.
--   Fixes TECH-BLOCK-03 and TECH-BLOCK-04 when 00125 policies were not effective
--   (e.g. due to multiple policies, policy name mismatch, or migration order).

-- ============================================================================
-- 1. subscription_payments — drop all SELECT policies, create single restrictive
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_payments' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON subscription_payments', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "sp_select" ON subscription_payments
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- ============================================================================
-- 2. proposals — drop all SELECT policies, create single restrictive
--    (includes deleted_at IS NULL for soft-delete consistency)
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposals' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON proposals', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "proposals_select" ON proposals
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  );
