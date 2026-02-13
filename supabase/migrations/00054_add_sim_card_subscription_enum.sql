-- Migration: 00054_add_sim_card_subscription_enum
-- Description: Add 'subscription' to sim_card_status enum.
-- Must be in a separate migration: PostgreSQL requires new enum values to be committed before use.

DO $$ BEGIN
  ALTER TYPE sim_card_status ADD VALUE 'subscription';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
