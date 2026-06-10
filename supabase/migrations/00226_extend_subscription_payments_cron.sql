-- Migration: 00226_extend_subscription_payments_cron
-- A5: Repo-managed pg_cron job for extend-subscription-payments Edge Function.
--
-- Schedule: 02:00 UTC on the 1st of each month (0 2 1 * *)
-- Auth: x-cron-secret header from Vault (name: edge_cron_secret) — must match
--       Edge Function secret CRON_SECRET (never commit the value).
--
-- Prerequisites:
--   - pg_cron + pg_net (see 00053_tcmb_cron_setup.sql)
--   - Vault secret project_url (existing, from 00053)
--   - Vault secret edge_cron_secret (one-time manual — see docs/audit-reports/a5-extend-subscription-payments-cron-setup.md)
--   - Edge function extend-subscription-payments deployed with A5 cronAuth
--
-- If Supabase Dashboard also has a schedule for the same function, disable it
-- to avoid duplicate monthly invocations.

DO $$
BEGIN
  PERFORM cron.unschedule('extend-subscription-payments-monthly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'extend-subscription-payments-monthly',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/extend-subscription-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
