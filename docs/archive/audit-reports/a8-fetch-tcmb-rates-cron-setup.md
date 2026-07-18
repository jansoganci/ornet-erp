# A8 — `fetch-tcmb-rates` cron and browser auth setup

> **Date:** 2026-05-31  
> **Scope:** TCMB Edge Function lockdown (roadmap A8)

---

## Auth model

| Caller | How it authenticates |
|--------|----------------------|
| **pg_cron** (`fetch-tcmb-rates-daily`) | HTTP header `x-cron-secret` = Vault `edge_cron_secret` = Edge `CRON_SECRET` |
| **Browser (admin/accountant)** | Session JWT in `Authorization: Bearer` → `profiles.role` ∈ `admin`, `accountant` |
| **Everyone else** | **401** or **403** |

Gateway: `verify_jwt = false` in [`supabase/config.toml`](../../supabase/config.toml) — auth is enforced **inside** the function.

Field workers see USD/TRY on the dashboard but **no refresh button** ([`CurrencyWidget.jsx`](../../src/features/dashboard/components/CurrencyWidget.jsx)).

---

## Secrets (reuse A5 — no new secret name)

| Location | Name | Value |
|----------|------|--------|
| Edge Functions → Secrets | `CRON_SECRET` | Your private string |
| Vault | `edge_cron_secret` | **Same string** as `CRON_SECRET` |
| Vault | `project_url` | Already from `00053` |

If A5 Vault setup is done, A8 needs **no new secret** — only deploy + migration `00228`.

---

## Repo changes

| File | Purpose |
|------|---------|
| [`supabase/functions/_shared/cronAuth.ts`](../../supabase/functions/_shared/cronAuth.ts) | `assertCronOrFinanceRole` |
| [`supabase/functions/fetch-tcmb-rates/index.ts`](../../supabase/functions/fetch-tcmb-rates/index.ts) | Dual auth at handler start |
| [`supabase/migrations/00228_fetch_tcmb_rates_cron_secret.sql`](../../supabase/migrations/00228_fetch_tcmb_rates_cron_secret.sql) | pg_cron sends `x-cron-secret` |

---

## Deploy checklist

1. Deploy function:
   ```bash
   supabase functions deploy fetch-tcmb-rates
   ```
2. Apply migration `00228` (reschedules `fetch-tcmb-rates-daily`).
3. Confirm Edge `CRON_SECRET` and Vault `edge_cron_secret` match.

---

## Smoke tests

```bash
# 1) No auth — expect 401
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json"

# 2) Cron secret — expect 200 (weekday; TCMB may 502 on holidays)
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

| Scenario | Expected |
|----------|----------|
| Anon key only | 401 |
| `x-cron-secret` correct | 200 (or 502 if TCMB unavailable) |
| field_worker dashboard | Rates visible, no refresh button |
| admin/accountant refresh (widget or `/finance/exchange`) | 200 |

---

## Duplicate schedulers (optional follow-up)

Two independent daily paths may still exist:

| Scheduler | Path |
|-----------|------|
| pg_cron `fetch-tcmb-rates-daily` | Edge function (secured after A8) |
| [`.github/workflows/fetch-tcmb-rates.yml`](../../.github/workflows/fetch-tcmb-rates.yml) | `scripts/fetch-tcmb-rates.mjs` with service role (bypasses Edge) |

Not changed in A8. Consider disabling GitHub Actions if pg_cron is sufficient to avoid double daily upserts.

---

## Rollback

1. Redeploy previous `fetch-tcmb-rates` function version.
2. Re-run schedule from [`00053_tcmb_cron_setup.sql`](../../supabase/migrations/00053_tcmb_cron_setup.sql) (anon Bearer) if cron must work before redeploy.
