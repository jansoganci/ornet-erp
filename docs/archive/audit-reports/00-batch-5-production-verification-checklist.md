# Batch 5 — Staging → Production Verification Checklist

> **Date:** 2026-06-09  
> **Source:** [00-production-remediation-plan.md](./00-production-remediation-plan.md) Batch 5  
> **Prerequisite:** Batches 1–4 complete locally (R1 `cronAuth.ts`, R2 `00234`, B3 customer detail gate, docs synced).  
> **Scope:** Apply and verify migrations **`00224`–`00234`**, Edge deploys, secrets, pg_cron, role-matrix tests.  
> **Out of scope:** A6/B9 Paraşüt implementation — **cancelled**. Only confirm Paraşüt functions are **not deployed** (or remove if deployed).  
> **Rule:** Run **staging first**. Do not promote to production until every staging step passes. Obtain explicit **APPROVE** before `supabase db push` or production deploys.

---

## Variables (fill before starting)

| Variable | Staging | Production |
|----------|---------|------------|
| `PROJECT_REF` | `________________` | `________________` |
| `SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | same pattern |
| `CRON_SECRET` | *(Edge secret; never commit)* | same or env-specific |
| `ANON_KEY` | from Dashboard → Settings → API | same pattern |
| Operator | name + date | name + date |

**Test users (must exist on target env):**

| Role | Email / user id |
|------|-----------------|
| `admin` | |
| `accountant` | |
| `field_worker` | |

---

## 1. Pre-flight checks

| # | Step | Command / action | Expected result | If it fails |
|---|------|------------------|-----------------|-------------|
| 1.1 | Confirm local branch has Batches 1–3 code | `git status`; verify `cronAuth.ts` validates secret; `00234` exists; `CustomerDetailPage.jsx` uses `useCustomerSubscriptions(canWrite ? id : null)` | All three present | Stop — merge/fix Batches 1–3 first |
| 1.2 | Confirm explicit APPROVE for staging db push + deploys | Written approval from project owner | APPROVE recorded | Do not proceed |
| 1.3 | Link CLI to **staging** project | `supabase link --project-ref <STAGING_REF>` | Linked successfully | Fix credentials / project ref |
| 1.4 | List pending migrations vs remote | `supabase migration list` | Shows `00224`–`00234` as **not yet applied** on staging (or note which are already applied) | If some applied, skip only those; never re-edit applied files |
| 1.5 | Snapshot Tahsilat totals **before** `00233`/`00234` apply | SQL Editor (see §3.1) — export/save row counts and sums | Baseline saved to file | Required for B5 parity check later |
| 1.6 | Confirm frontend build for Batch 3 app change | `npm run build` | Exit 0 | Fix build before UI verification |
| 1.7 | Confirm test users and roles | SQL: `SELECT id, email, role FROM profiles WHERE role IN ('admin','accountant','field_worker');` | Three distinct users | Create/fix test accounts |
| 1.8 | Paraşüt disposition (cancelled — verify only) | `supabase functions list` | **`parasut-dispatch` and `parasut-reconcile` NOT listed** | If listed → delete (§2.8); do not implement auth hardening |

---

## 2. Staging execution steps

Execute in order. Do not skip secrets before deploy.

| # | Step | Command / action | Expected result | If it fails |
|---|------|------------------|-----------------|-------------|
| 2.1 | Set Edge secret `CRON_SECRET` (staging) | Dashboard → Edge Functions → Secrets → add/update `CRON_SECRET` **or** `supabase secrets set CRON_SECRET=<value> --project-ref <STAGING_REF>` | Secret visible in Dashboard | Redeploy functions after setting |
| 2.2 | Ensure Vault `project_url` (staging) | SQL Editor — see §3.2 | Row exists | Create per `00053` / A5 doc if missing |
| 2.3 | Ensure Vault `edge_cron_secret` matches `CRON_SECRET` | SQL Editor — see §3.3 | Secret exists; value equals Edge `CRON_SECRET` | `vault.create_secret(...)` or update; values must match exactly |
| 2.4 | Deploy `extend-subscription-payments` (includes Batch 1 fix) | `supabase functions deploy extend-subscription-payments --project-ref <STAGING_REF>` | Deploy success | Check function logs; verify `cronAuth.ts` in deployed bundle |
| 2.5 | Deploy `fetch-tcmb-rates` | `supabase functions deploy fetch-tcmb-rates --project-ref <STAGING_REF>` | Deploy success | Same as above |
| 2.6 | Apply migrations (staging) | `supabase db push --project-ref <STAGING_REF>` | All `00224`–`00234` apply without error | Read error; do not force; fix migration conflict on branch |
| 2.7 | Verify migration list clean | `supabase migration list` | All through `00234` marked applied on staging | Re-run push or apply missing migration individually |
| 2.8 | Paraşüt functions — remove if deployed | `supabase functions delete parasut-reconcile --project-ref <STAGING_REF>` and `supabase functions delete parasut-dispatch --project-ref <STAGING_REF>` (only if step 1.8 found them) | Functions gone from list | If delete blocked, document blocker; do **not** implement A6/B9 |
| 2.9 | Remove duplicate Dashboard cron for extend | Dashboard → Edge Functions → `extend-subscription-payments` → **Schedules** → delete/disable any job on `0 2 1 * *` | No Dashboard schedule remains | pg_cron job alone should trigger monthly extension |
| 2.10 | Deploy frontend (staging) with Batch 3 | Your normal Cloudflare Pages staging deploy | Staging URL serves updated `CustomerDetailPage` | Redeploy from correct branch |
| 2.11 | Run §4 Edge smoke tests (staging) | curl commands | All pass | Fix secrets/deploy before SQL/cron checks |
| 2.12 | Run §3 SQL verification (staging) | SQL Editor | All pass | See rollback §9 |
| 2.13 | Run §5 role-matrix tests (staging) | UI + RPC | All pass | Do not promote; fix or rollback |
| 2.14 | Record staging sign-off | Checklist §10 | All staging criteria met | Remediate before production |

---

## 3. Staging SQL commands

Run in **Supabase SQL Editor** (staging). Replace nothing with committed secrets in docs.

### 3.1 Tahsilat baseline snapshot (run **before** `db push` if not already applied)

```sql
-- Save output before applying 00233/00234
SELECT COUNT(*) AS customer_rows, SUM(outstanding) AS total_outstanding
FROM v_collection_customer_summary;

SELECT COUNT(*) AS document_rows, SUM(sale_price_net) AS total_billed
FROM v_collection_documents;
```

**Expected:** Query succeeds; save numbers for parity check after migration.  
**If fails:** Views may not exist yet — note state; baseline optional only if `00213` never applied.

### 3.2 Vault secrets presence

```sql
SELECT name FROM vault.secrets WHERE name IN ('project_url', 'edge_cron_secret');
```

**Expected:** Both names returned.  
**If fails:** Create missing secrets (do not commit values):

```sql
-- project_url example (if missing):
SELECT vault.create_secret(
  'https://<STAGING_PROJECT_REF>.supabase.co',
  'project_url',
  'Base URL for pg_cron HTTP posts'
);

-- edge_cron_secret (if missing) — same string as Edge CRON_SECRET:
SELECT vault.create_secret(
  '<PASTE_SAME_AS_EDGE_CRON_SECRET>',
  'edge_cron_secret',
  'Cron header for extend-subscription-payments and fetch-tcmb-rates'
);
```

### 3.3 pg_cron jobs

```sql
SELECT jobname, schedule, active
FROM cron.job
ORDER BY jobname;
```

**Expected (minimum):**

| jobname | schedule |
|---------|----------|
| `extend-subscription-payments-monthly` | `0 2 1 * *` |
| `fetch-tcmb-rates-daily` | `0 3 * * *` |
| `recurring-expenses-daily` | `0 1 * * *` |
| `generate-monthly-sim-finance` | `0 2 1 * *` |

Also expect notification jobs from `00067`.  
**If fails:** Re-apply `00226` / `00228` blocks manually or fix Vault secrets then re-run migration sections.

### 3.4 Tahsilat `security_invoker` (R2)

```sql
SELECT c.relname, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('v_collection_customer_summary', 'v_collection_documents');
```

**Expected:** Both rows include `security_invoker=true` in `reloptions`.  
**If fails:** Confirm `00224` and `00234` applied; run manually:

```sql
ALTER VIEW public.v_collection_documents SET (security_invoker = true);
ALTER VIEW public.v_collection_customer_summary SET (security_invoker = true);
```

### 3.5 Tahsilat field_worker isolation (A1)

Run as **service role is not valid** — use PostgREST with field_worker JWT or SQL with `SET request.jwt.claims` if available. Preferred: **Supabase client with field_worker session**:

```sql
-- Alternative: direct RPC/table test via app; or use Dashboard Table Editor with RLS preview
SELECT COUNT(*) FROM v_collection_customer_summary;
SELECT COUNT(*) FROM v_collection_documents;
```

**Expected (field_worker JWT):** **0 rows** on both views (or policy error).  
**Expected (accountant JWT):** Rows match pre-migration business data.  
**If fails:** `security_invoker` not set — fix §3.4; check `financial_transactions` RLS.

### 3.6 Tahsilat totals parity (B5)

```sql
-- Run AFTER 00233/00234 applied; compare to §3.1 baseline
SELECT COUNT(*) AS customer_rows, SUM(outstanding) AS total_outstanding
FROM v_collection_customer_summary;

SELECT COUNT(*) AS document_rows, SUM(sale_price_net) AS total_billed
FROM v_collection_documents;
```

**Expected:** Counts and sums match baseline within rounding (rewrite should not change totals).  
**If fails:** Stop production promotion; finance review of `00233` view logic.

### 3.7 Recurring expenses cron grant (A3)

```sql
SELECT has_function_privilege('authenticated', 'fn_generate_recurring_expenses()', 'EXECUTE') AS auth_can_direct;
SELECT has_function_privilege('authenticated', 'fn_generate_recurring_expenses_guarded()', 'EXECUTE') AS auth_can_guarded;
```

**Expected:** `auth_can_direct` = **false**; `auth_can_guarded` = **true**.  
**If fails:** Re-apply `00225` / `00231`.

### 3.8 `complete_proposal_with_rate` grant (record only)

```sql
SELECT has_function_privilege('authenticated', 'complete_proposal_with_rate(uuid, numeric, numeric)', 'EXECUTE') AS auth_can_complete;
```

**Expected:** Record result; in-function guard in `00230` is authoritative. `true` is acceptable if guard works.  
**If fails (RPC unreachable for accountant):** `GRANT EXECUTE` may be missing — add in follow-up migration (do not block if accountant UI works).

### 3.9 Recent cron run health (optional)

```sql
SELECT jobid, jobname, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

**Expected:** No repeated failures for `fetch-tcmb-rates-daily` / `recurring-expenses-daily`.  
**If fails:** Check Vault secrets, Edge deploy, function logs.

---

## 4. Staging Edge smoke tests

Replace `<STAGING_REF>`, `<CRON_SECRET>`, `<ANON_KEY>`, `<ACCOUNTANT_JWT>`, `<FIELD_WORKER_JWT>`.

### 4.1 `extend-subscription-payments` (A5 / R1)

```bash
# No secret — expect 401
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/extend-subscription-payments" \
  -H "Content-Type: application/json"

# Wrong secret — expect 401
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/extend-subscription-payments" \
  -H "x-cron-secret: wrong" \
  -H "Content-Type: application/json"

# Correct secret — expect 200
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/extend-subscription-payments" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

**Expected:** 401, 401, 200 with body like `{"ok":true,"rowsCreated":N,...}`.  
**If fails:** 503 → `CRON_SECRET` not set on Edge; 200 without header → redeploy Batch 1 fix; 500 → check `extend_active_subscription_payments` (`00227`) in DB logs.

### 4.2 `fetch-tcmb-rates` (A8)

```bash
# Anon only — expect 401
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json"

# Cron secret — expect 200 (502 acceptable on TCMB holiday/weekend)
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json"

# field_worker JWT — expect 403
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "Authorization: Bearer <FIELD_WORKER_JWT>" \
  -H "Content-Type: application/json"

# accountant JWT — expect 200
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "https://<STAGING_REF>.supabase.co/functions/v1/fetch-tcmb-rates" \
  -H "Authorization: Bearer <ACCOUNTANT_JWT>" \
  -H "Content-Type: application/json"
```

**Expected:** 401, 200 or 502, 403, 200.  
**If fails:** Same secret/deploy checks as §4.1; JWT tests require fresh session tokens from staging login.

**Obtain JWT for curl:** Log in as test user in staging app → DevTools → Application/localStorage or Network → copy access token from Supabase auth response.

---

## 5. Staging role-matrix tests

### 5.1 RPC denials — `field_worker`

Use Supabase SQL Editor **with field_worker JWT** (Dashboard SQL may use service role — prefer **app DevTools → Network** or `supabase-js` REPL with field_worker session).

| RPC | Call | Expected |
|-----|------|----------|
| `get_monthly_revenue_expense` | `rpc('get_monthly_revenue_expense', { months_back: 7 })` | Error / Unauthorized |
| `get_subscription_stats` | `rpc('get_subscription_stats')` | Error |
| `get_overdue_subscription_payments` | `rpc('get_overdue_subscription_payments')` | Error |
| `get_overdue_invoices` | `rpc('get_overdue_invoices')` | Error |
| `fn_generate_recurring_expenses` | direct call | Error (revoked) |
| `fn_generate_recurring_expenses_guarded` | direct call | Error |
| `generate_subscription_payments` | with valid subscription uuid | Error |
| `bulk_import_subscriptions` | `{ items: [], p_user_id: '<uid>' }` | Error |
| `fn_update_subscription_price` | valid args | Error |
| `complete_proposal_with_rate` | valid proposal uuid | Error |
| `soft_delete_transaction` | valid transaction uuid | Error |

**If fails:** Confirm `00225`, `00229`, `00230`, `00231` applied.

### 5.2 RPC allow — `admin` / `accountant`

| RPC | Expected |
|-----|----------|
| `get_monthly_revenue_expense(7)` | Returns rows |
| `get_subscription_stats()` | Returns JSON |
| `fn_generate_recurring_expenses_guarded()` | Success on `/finance/recurring` manual generate |

**If fails:** Check role in `profiles`; check migration apply.

### 5.3 Work order completion (A7)

| Scenario | User | Expected |
|----------|------|----------|
| Complete **assigned** WO (`in_progress`) | `field_worker` on `assigned_to` | Success via `fn_complete_work_order_with_payment` |
| Complete **unassigned** WO | `field_worker` | Denied |
| Complete proposal | `field_worker` | Denied |
| Complete proposal | `accountant` | Success via `complete_proposal_with_rate` (USD modal or TRY rate 1) |

**If fails:** Verify `00230`; check `assigned_to` array on WO.

### 5.4 Dashboard — `field_worker` (A4)

1. Log in as `field_worker` → open `/`.
2. DevTools → Network → filter `rpc` / `rest`.

**Expected:** No calls to `get_monthly_revenue_expense`, `get_subscription_stats`, `get_overdue_subscription_payments`, finance dashboard KPI endpoints.  
**If fails:** Confirm staging frontend deploy includes Batch 3 + prior A4 gating.

### 5.5 Customer detail — `field_worker` (B3)

1. Log in as `field_worker` → open `/customers/<id>` for customer with active subscriptions.
2. DevTools → Network.

**Expected:** **No** fetch to `subscriptions` / subscription list API for that customer; no SIM/pricing queries (SIM and payment methods already gated). Page renders without error (empty subscription section acceptable).  
**Expected (`accountant`):** Subscriptions load with pricing; unchanged UX.

**If fails:** Redeploy frontend; verify `useCustomerSubscriptions(canWrite ? id : null)`.

### 5.6 Tahsilat UI — `accountant`

1. Open `/finance/collections`.
2. Compare totals to §3.6 / baseline.
3. Paginate — confirm ≤50 per page (app default).

**Expected:** Loads; totals parity; pagination works.  
**If fails:** Finance review + `00233`/`00234`.

### 5.7 Work history (B4)

1. Open `/work-history` with empty search.

**Expected:** No `search_work_history` RPC in network tab.  
2. Enter ≥2 char search or set date filter.

**Expected:** RPC fires; ≤200 rows returned.  
**If fails:** Confirm `00232` + frontend `shouldRunSearch` deployed.

### 5.8 Soft delete (B10)

**Accountant:** soft-delete a test transaction → success.  
**Field worker:** attempt same → denied.

---

## 6. Production execution steps

**Gate:** All §2–§5 staging steps passed and §10 staging sign-off recorded.

| # | Step | Command / action | Expected result | If it fails |
|---|------|------------------|-----------------|-------------|
| 6.1 | Obtain **APPROVE** for production | Written approval | Recorded | Stop |
| 6.2 | Link CLI to **production** project | `supabase link --project-ref <PROD_REF>` | Linked | Do not apply to wrong project |
| 6.3 | Set production `CRON_SECRET` (may differ from staging) | Dashboard or `supabase secrets set` | Secret set | Match Vault `edge_cron_secret` on prod |
| 6.4 | Vault secrets on production | §7.2–7.3 SQL | Both exist; values match prod Edge secret | Create before cron jobs run |
| 6.5 | Deploy Edge functions (production) | `supabase functions deploy extend-subscription-payments --project-ref <PROD_REF>` and `fetch-tcmb-rates` | Success | Rollback §9 |
| 6.6 | Apply migrations (production) | `supabase db push --project-ref <PROD_REF>` | `00224`–`00234` applied | Stop; do not partial-apply without plan |
| 6.7 | Paraşüt check (production) | `supabase functions list` | No `parasut-*` deployed | Delete if present (§2.8) |
| 6.8 | Remove duplicate Dashboard cron (production) | Dashboard Schedules | None for extend-subscription-payments | Same as §2.9 |
| 6.9 | Deploy frontend (production) | Cloudflare Pages prod deploy | Batch 3 live | Rollback frontend if UI tests fail |
| 6.10 | Run §8 Edge smoke (production) | curl | All pass | Rollback §9 |
| 6.11 | Run §7 SQL verification (production) | SQL Editor | All pass | Rollback §9 |
| 6.12 | Spot-check §5 role-matrix on production | Subset: field_worker dashboard, customer detail, extend curl, Tahsilat reloptions | Pass | Full staging matrix optional if prod data sensitive — minimum smoke required |
| 6.13 | Production sign-off | §10 | All production criteria met | Incident response |

---

## 7. Production SQL commands

Same as §3. Run on **production** SQL Editor. Skip §3.1 baseline if migrations already applied on prod without snapshot (compare accountant Tahsilat UI to pre-change export if available).

| Section | Purpose |
|---------|---------|
| §3.2 | Vault secrets |
| §3.3 | pg_cron jobs |
| §3.4 | `security_invoker` |
| §3.5 | field_worker 0 rows on Tahsilat views |
| §3.6 | Totals parity (if baseline exists) |
| §3.7 | Recurring grant state |
| §3.8 | `complete_proposal_with_rate` grant record |
| §3.9 | Cron run health |

**Expected / failure handling:** Identical to §3.

---

## 8. Production Edge smoke tests

Same commands as §4, replacing `<STAGING_REF>` with `<PROD_REF>` and production `CRON_SECRET` / JWTs.

Minimum production smoke (must all pass):

1. extend: no secret → **401**; correct secret → **200**
2. fetch-tcmb: anon → **401**; cron secret → **200** or **502**
3. Paraşüt functions **not** in `supabase functions list`

**If fails:** Do not announce go-live; execute §9 rollback for affected component.

---

## 9. Rollback notes

| Component | Rollback action | Risk |
|-----------|-----------------|------|
| Edge `extend-subscription-payments` | Redeploy previous function version from git tag; or temporarily disable pg_cron job: `SELECT cron.unschedule('extend-subscription-payments-monthly');` | Monthly billing extension stops until fixed |
| Edge `fetch-tcmb-rates` | Redeploy previous version; unschedule `fetch-tcmb-rates-daily` if needed | Rates stale until restored |
| Migrations `00224`–`00234` | **Do not** delete migration history casually. Prefer forward-fix migration. Tahsilat views: revert to pre-`00233` definition only with finance-approved SQL. `security_invoker`: `ALTER VIEW ... SET (security_invoker = false)` only if emergency — restores RLS bypass (**avoid**). | High for finance views |
| Vault / Edge secret mismatch | Align `CRON_SECRET` = `edge_cron_secret`; redeploy functions | Cron 401 until aligned |
| Frontend Batch 3 | Redeploy previous Cloudflare Pages deployment | Low |
| Duplicate cron | Re-enable Dashboard schedule only if pg_cron broken — never run both intentionally | Double billing rows (mitigated by ON CONFLICT) |

**Emergency stop:** Unschedule `extend-subscription-payments-monthly` and block public Edge URL at WAF/Dashboard if auth regression confirmed (200 without secret).

---

## 10. Final go / no-go criteria

### Staging GO (required before production)

- [ ] Migrations **`00224`–`00234`** applied on staging (`supabase migration list`)
- [ ] **`security_invoker=true`** on both Tahsilat views (§3.4)
- [ ] field_worker: **0 rows** on Tahsilat views (§3.5)
- [ ] extend-subscription-payments: **401** without secret, **200** with secret (§4.1)
- [ ] fetch-tcmb-rates: **401** anon, **403** field_worker JWT, **200** accountant/cron (§4.2)
- [ ] field_worker RPC matrix denied (§5.1); accountant/admin allowed (§5.2)
- [ ] WO completion: assigned OK / unassigned denied (§5.3)
- [ ] field_worker `/`: no finance RPCs (§5.4)
- [ ] field_worker customer detail: **no subscription pricing fetch** (§5.5)
- [ ] Tahsilat totals parity (§3.6) OR finance sign-off on acceptable delta
- [ ] Work history: no query on empty search; capped results (§5.7)
- [ ] pg_cron jobs present (§3.3); **no duplicate** Dashboard extend schedule (§2.9)
- [ ] **`parasut-dispatch` / `parasut-reconcile` not deployed** (§1.8)
- [ ] Staging operator sign-off: name, date, notes

### Production GO (release)

- [ ] All staging GO items repeated or spot-checked on production (§6.12)
- [ ] Production Edge smoke (§8) passed
- [ ] Production SQL checks (§7) passed
- [ ] Frontend prod deploy includes Batch 3
- [ ] No open **CRITICAL** security failures from this checklist
- [ ] Production operator sign-off: name, date

### NO-GO (stop release)

- extend-subscription-payments returns **200** without `x-cron-secret`
- Tahsilat views missing `security_invoker=true`
- field_worker sees Tahsilat aggregates or subscription pricing on customer detail
- Tahsilat totals materially wrong vs baseline without finance approval
- Paraşüt Edge functions deployed and reachable (unless explicitly deleted)
- Migrations failed or partially applied with unresolved errors

---

*Checklist only — no operations were performed in creating this document.*
