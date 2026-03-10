# TCMB Currency Rates – Deployment Guide

## Overview

- **Edge Function**: `fetch-tcmb-rates` – Fetches **USD ForexSelling** from TCMB today.xml, stores in `exchange_rates`
- **Source**: `https://www.tcmb.gov.tr/kurlar/today.xml` – public, no API key, no IP blocking
- **Schedule**: Daily 06:00 Turkey time (03:00 UTC) via pg_cron
- **Manual**: "TCMB'dan Getir" button on Döviz Kurları page (admin/accountant only)

---

## 1. Edge Function Deployment

```bash
# Deploy the function (from project root)
supabase functions deploy fetch-tcmb-rates
```

**Important:** `verify_jwt = false` in `supabase/config.toml` allows the function to be called from:
- **Frontend** (logged-in admin/accountant)
- **pg_cron** (uses anon key)

Without this, Supabase returns **401 Unauthorized** before the function runs. If 401 persists after deploy, run:
```bash
supabase functions deploy fetch-tcmb-rates --no-verify-jwt
```

**No API key needed** – the function uses the public TCMB XML feed.

---

## 2. Database Migration

```bash
# Apply migration (enables pg_cron, pg_net, schedules daily job)
supabase db push
```

Or run the migration manually in **Supabase Dashboard > SQL Editor**:
- Enable **pg_cron** and **pg_net** under Database > Extensions first
- Then run the contents of `supabase/migrations/00053_tcmb_cron_setup.sql`

---

## 3. Vault Secrets (for Cron Only)

The **cron job** needs project URL and anon key in **Vault** (different from Edge Function Secrets). Run once in **SQL Editor**:

```sql
-- Replace with your actual values
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');
```

Find these in: **Supabase Dashboard > Settings > API** (Project URL, anon/public key)

---

## 4. Verify

- **Manual**: Go to Finans > Döviz Kurları, click "TCMB'dan Getir". Success toast = working.
- **Cron**: Check `cron.job_run_details` or `exchange_rates` after 06:00 Turkey time.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No rates" from TCMB | TCMB may not publish on weekends/holidays; XML feed may be empty |
| Cron not firing | Ensure vault secrets exist; check Extensions (pg_cron, pg_net) |
