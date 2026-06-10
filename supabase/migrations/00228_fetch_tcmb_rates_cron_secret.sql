-- Migration: 00228_fetch_tcmb_rates_cron_secret
-- A8: Reschedule fetch-tcmb-rates-daily to send x-cron-secret instead of anon Bearer.
--
-- Prerequisites:
--   - Vault secret project_url (from 00053)
--   - Vault secret edge_cron_secret (same value as Edge CRON_SECRET — A5 setup)
--   - fetch-tcmb-rates Edge function deployed with A8 dual auth

DO $$
BEGIN
  PERFORM cron.unschedule('fetch-tcmb-rates-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'fetch-tcmb-rates-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/fetch-tcmb-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
