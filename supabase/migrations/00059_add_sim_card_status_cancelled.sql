-- Migration: 00059_add_sim_card_status_cancelled
-- Description: Add 'cancelled' to sim_card_status enum.
-- Must be separate: PostgreSQL requires new enum values to be committed before use.
-- Run 00060 after this for data migration and trigger update.

DO $$ BEGIN
  ALTER TYPE sim_card_status ADD VALUE 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
