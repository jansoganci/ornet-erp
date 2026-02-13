-- Migration: 00053_tcmb_cron_setup
-- Description: pg_cron + pg_net to fetch TCMB rates daily at 06:00 Turkey time (03:00 UTC)
-- Prerequisites: Enable pg_cron and pg_net in Supabase Dashboard > Database > Extensions
-- After migration: Run vault secrets (see DEPLOYMENT below)

-- Enable extensions (if allowed by project)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres (cron runs as postgres)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Unschedule existing job if present (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('fetch-tcmb-rates-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job may not exist
END $$;

-- Schedule daily fetch at 03:00 UTC = 06:00 Turkey time
-- Requires vault secrets: project_url, anon_key (create via Dashboard SQL)
SELECT cron.schedule(
  'fetch-tcmb-rates-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/fetch-tcmb-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
