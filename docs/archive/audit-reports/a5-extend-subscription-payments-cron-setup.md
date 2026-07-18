# A5 — `extend-subscription-payments` cron setup

> **Date:** 2026-05-31  
> **Scope:** Monthly schedule only for `extend-subscription-payments` (roadmap A5)

---

## Where is the cron defined?

| Source | Before | After `00226` |
|--------|--------|----------------|
| **Repo SQL (`pg_cron`)** | **Not present** — only `fetch-tcmb-rates`, notifications, recurring expenses, SIM finance, pending-payments summary | **`00226_extend_subscription_payments_cron.sql`** — job `extend-subscription-payments-monthly`, schedule `0 2 1 * *` |
| **Supabase Dashboard schedule** | Documented in function comments / audits as the intended path | **Optional legacy** — if one exists, **disable it** after applying `00226` to avoid double runs |

The frontend **never** calls this function. Users do not send `x-cron-secret`.

---

## How auth lines up (no magic link)

1. **Edge Functions → Secrets:** `CRON_SECRET` = your private string (function reads via `Deno.env.get("CRON_SECRET")`).
2. **Vault (database):** `edge_cron_secret` = **the same string** (cron SQL reads it for the HTTP header).
3. **pg_cron job** (`00226`): each month POSTs to  
   `{project_url}/functions/v1/extend-subscription-payments` with header  
   `x-cron-secret: <value from vault edge_cron_secret>`.

Supabase does not sync Edge secrets and Vault automatically — you copy the same value into both places once.

---

## One-time setup (after migration apply)

### 1. Edge (if not done)

- Secret name: `CRON_SECRET`
- Deploy: `supabase functions deploy extend-subscription-payments`

### 2. Vault secret (required for `00226`)

Run in **Supabase SQL Editor** (replace placeholder; do not commit the real value):

```sql
-- Same value as Edge CRON_SECRET. Idempotent: skip if edge_cron_secret already exists.
SELECT vault.create_secret(
  '<PASTE_SAME_VALUE_AS_EDGE_CRON_SECRET>',
  'edge_cron_secret',
  'A5 cron header for extend-subscription-payments'
);
```

Verify:

```sql
SELECT name FROM vault.secrets WHERE name = 'edge_cron_secret';
```

### 3. Apply migration

```bash
supabase db push
# or your usual migration apply path
```

### 4. Remove duplicate Dashboard schedule (if any)

Dashboard → Edge Functions → `extend-subscription-payments` → **Schedules** (or project Cron UI): delete/disable any job that POSTs the same URL on the 1st of the month.

### 5. Smoke test

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/extend-subscription-payments" \
  -H "x-cron-secret: <SAME_AS_CRON_SECRET>" \
  -H "Content-Type: application/json"
```

Expect **200** and `{ "ok": true, "rowsCreated": ... }`. Without header → **401**.

---

## Manual-only path (if you skip `00226`)

If you do not apply `00226`, you must configure **Dashboard** HTTP headers yourself:

- Header: `x-cron-secret`
- Value: same as Edge `CRON_SECRET`

Repo-managed cron is preferred so schedule + header stay in version control (secret value stays in Vault only).

---

## Related repo cron jobs (not this function)

| Job | Migration | Schedule | Target |
|-----|-----------|----------|--------|
| `fetch-tcmb-rates-daily` | `00053` | `0 3 * * *` | `fetch-tcmb-rates` (A8 will add `edge_cron_secret` later) |
| `generate-monthly-sim-finance` | `00202` | `0 2 1 * *` | DB RPC, not this Edge Function |

Same cron expression `0 2 1 * *` as SIM finance is intentional (different jobs, same minute).
