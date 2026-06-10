# Production Remediation Plan — Ornet ERP

> **Date:** 2026-06-09
> **Source audit:** [00-roadmap-implementation-status-audit.md](./00-roadmap-implementation-status-audit.md)
> **Purpose:** Sequenced, low-risk batches to make the app production-safe. **Planning only — nothing here is implemented yet.**
> **Implementer:** Cursor Auto (later session). Each batch is small, independently testable, and follows AGENTS.md rules (separate branch per batch, APPROVE before migrations, no scope creep).
> **Project rules that bind every batch:** [CLAUDE.md](../../CLAUDE.md) finance rules, [AGENTS.md](../../AGENTS.md) approval gates, `.hermes/*` checklists.

---

## 1. Executive Verdict

The branch is one small code fix, one small migration, and one ops-verification pass away from closing all open **security blockers**:

- **R1** — `assertCronAuthorized()` never validates `x-cron-secret`; `extend-subscription-payments` is effectively unauthenticated (CRITICAL).
- **R2** — `00233` very likely resets `security_invoker` on both Tahsilat views, regressing A1 (CRITICAL).
- **B3 remainder** — `useCustomerSubscriptions(id)` still exposes subscription pricing to `field_worker` on customer detail (HIGH, defense-in-depth).

Everything else already implemented locally (`00224`–`00233`, edge auth for TCMB, completion RPC guards, work-history limits, Tahsilat rewrite) needs **remote apply + staging verification**, not new code. Performance work (B6, B11, Phase C) follows after the production gate. Paraşüt items (A6, and conditionally B9) are **cancelled** — Paraşüt is not used.

**Production gate = Batches 1–5 complete.** Batches 6+ are post-gate.

---

## 2. Cancelled / Not Applicable Items

| ID | Status | Reason / Required follow-through |
|----|--------|----------------------------------|
| **A6** — `parasut-reconcile` lockdown | **CANCELLED** | Paraşüt integration is not used. Do **not** implement auth hardening for it. Instead, Batch 5 verifies the function is **not deployed** remotely (or deletes the deployment). Repo code may remain dormant; `config.toml` `verify_jwt = false` entry for it is only dangerous if deployed. |
| **B9** — `parasut-dispatch` ping guard + DTO minimization | **CANCELLED, conditional** | Cancelled together with A6 **if** Batch 5 confirms `parasut-dispatch` / `parasut-reconcile` are not deployed (or removes them from the remote project). If they must stay deployed for any reason, B9 reverts to ACTIVE and gets its own small batch (add `requireRole` to `ping`, minimal DTOs). |
| **D2** — Paraşüt matching RLS decision | **NOT APPLICABLE** | Paraşüt not used; no decision needed. Optionally hide `/customers/parasut-matching` nav later (cosmetic, Phase D). |
| Paraşüt-related staging smoke tests | **REMOVED** from the release checklist (§6). |

> Note: `00215`–`00218` Paraşüt migrations and `parasut*` frontend modules stay in the repo untouched. Removing them is a separate product decision, not part of this plan.

---

## 3. Production Blockers (must close before real ledger / rollout)

| # | Blocker | Batch |
|---|---------|-------|
| 1 | R1 — broken cron secret validation in `cronAuth.ts` | Batch 1 |
| 2 | R2 — `security_invoker` regression on Tahsilat views after `00233` | Batch 2 |
| 3 | B3 remainder — ungated subscription pricing on customer detail | Batch 3 |
| 4 | Migrations `00224`–`00234` not applied to remote Supabase | Batch 5 |
| 5 | Edge/Vault secrets, pg_cron jobs, duplicate Dashboard cron unverified | Batch 5 |
| 6 | Role-matrix staging verification never run | Batch 5 |

---

## 4. Implementation Batches (overview)

| Batch | Scope | Type | Approval needed |
|-------|-------|------|-----------------|
| **1** | R1 — fix `assertCronAuthorized()` | Edge code (1 file) | YES (security) |
| **2** | R2 — restore `security_invoker` on Tahsilat views | New migration `00234` | YES (migration) |
| **3** | B3 remainder — gate `useCustomerSubscriptions` | App code (1 file) | YES |
| **4** | Docs — mark A6/B9 cancelled, sync roadmap statuses | Docs only | No |
| **5** | Production verification — apply migrations, secrets, cron, role-matrix tests | Ops (no repo code) | YES (db push + deploys) |
| **6** | B6 — indexes, EXPLAIN-first | Staging analysis → migration `00235` | YES (migration) |
| **7** | B2 — operations/plan_items RLS | Migration, **blocked on product confirmation** | YES (product + migration) |
| **8** | B11 — lazy-load finance/proposals routes | App code | YES |
| **9** | Phase C quick wins (C2, C4, C5, C7, C6) | App code, small PRs | YES per item |
| **10** | Phase C SQL + Phase D decisions (C1, C3, C8, C10, D1–D9) | Mixed, post-launch | YES per item |

One branch per batch. Do not mix batches in one PR.

---

## 5. Batch Details

### Batch 1 — R1: Fix `assertCronAuthorized()` secret validation

- **Objective:** Make `extend-subscription-payments` actually reject requests without a valid `x-cron-secret`.
- **Files likely touched:**
  - `supabase/functions/_shared/cronAuth.ts` (only file)
- **Exact expected changes:**
  - In `assertCronAuthorized()` (currently L39–47): after the existing `CRON_SECRET` missing → 503 check, validate the provided secret and return 401 JSON when invalid. The correct pattern already exists in the same file — reuse `timingSafeEqual` (L18) and the header constant (L8). Recommended shape:
    - read provided value via the existing `extractProvidedSecret(req)` (header `x-cron-secret`, Bearer fallback per function doc comment) — or tighten to header-only to match `00226`/`00228` callers; header-only is the safer choice since both pg_cron jobs send `x-cron-secret`,
    - `if (!provided || !timingSafeEqual(provided, expected)) return json({ ok: false, error: "Unauthorized" }, 401);`
  - No changes to `assertCronOrFinanceRole` (already correct), no changes to `extend-subscription-payments/index.ts` (already calls the helper at L30), no config.toml changes.
  - If the Bearer fallback is dropped, also delete the now-unused `extractProvidedSecret` and update the doc comment in `extend-subscription-payments/index.ts` L10 (“or Bearer token”) — keep the diff minimal.
- **Test commands:**
  - `deno check supabase/functions/_shared/cronAuth.ts supabase/functions/extend-subscription-payments/index.ts`
  - Local serve test (optional): `supabase functions serve extend-subscription-payments --env-file <file with CRON_SECRET=test123>` then:
    - `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:54321/functions/v1/extend-subscription-payments` → expect **401**
    - same with `-H "x-cron-secret: test123"` → expect **200**
    - same with `-H "x-cron-secret: wrong"` → expect **401**
  - Remote smoke happens in Batch 5 after deploy.
- **Rollback risk:** **Low** — single function; worst case the monthly cron 401s, which is loud and recoverable (re-check Vault `edge_cron_secret` = Edge `CRON_SECRET`).
- **Done criteria:** All three curl cases behave as above; `deno check` clean; no other files changed.

---

### Batch 2 — R2: Restore `security_invoker` on Tahsilat views

- **Objective:** Guarantee `v_collection_customer_summary` and `v_collection_documents` run with `security_invoker = true` regardless of `00233`’s `CREATE OR REPLACE VIEW`.
- **Files likely touched:**
  - New migration: `supabase/migrations/00234_tahsilat_views_security_invoker_reassert.sql`
  - Optionally also amend `00233` (add `WITH (security_invoker = true)` to both `CREATE OR REPLACE VIEW` statements) **only if** `00233` has not been applied to any remote environment yet — Batch 5 confirms; if already applied anywhere, do **not** edit it, ship `00234` only.
- **Exact expected changes (new migration, mirrors `00224`):**

```sql
ALTER VIEW public.v_collection_documents SET (security_invoker = true);
ALTER VIEW public.v_collection_customer_summary SET (security_invoker = true);
```

  - Plus comments noting it must always be re-run after any future `CREATE OR REPLACE VIEW` on these views. No view body changes, no grants changes.
- **Test commands (staging, after Batch 5 apply):**
  - `SELECT relname, reloptions FROM pg_class WHERE relname IN ('v_collection_customer_summary','v_collection_documents');` → both must contain `security_invoker=true`
  - As `field_worker` JWT: `select` on both views → **0 rows / RLS error**
  - As `accountant`: `/finance/collections` loads with identical totals to before.
- **Rollback risk:** **Low** — `ALTER VIEW SET` only; reverting restores prior options. Accountant parity must be eyeballed (RLS now genuinely applies).
- **Done criteria:** `reloptions` check passes on staging; field_worker 0 rows; accountant Tahsilat unchanged.

---

### Batch 3 — B3 remainder: gate customer-detail subscription pricing

- **Objective:** Stop `field_worker` from fetching subscription pricing (base_price/subtotal etc.) on `/customers/:id`, consistent with the existing SIM/payment-method gates.
- **Files likely touched:**
  - `src/features/customers/CustomerDetailPage.jsx` (L170 + render fallbacks)
- **Exact expected changes:**
  - Change `useCustomerSubscriptions(id)` → `useCustomerSubscriptions(canWrite ? id : null)` (hook already has `enabled: !!customerId`, `src/features/subscriptions/hooks.js` L109–115 — no hook change needed).
  - Verify dependent UI degrades gracefully for `field_worker` with an empty list (all already null-safe `(customerSubscriptions || [])`):
    - `subscriptionIdsAll` (L174), `subscriptionsBySite` (L189), `counts.activeSubscriptions` (L199), `visibleSubscriptions` (L208), `accountManagerName` (L247), and the subscription cards section showing `fmtMoney(sub.subtotal)` (~L832).
  - The subscriptions section for field_worker should show the existing empty state (or be hidden behind `canWrite` if an empty card looks broken — keep whichever is the smaller diff; do not redesign).
  - **Product note (do not block batch):** master summary §7 flags “should field_worker see any subscription existence?” — this batch hides pricing AND existence. If product wants existence visible without prices, that is a follow-up (narrow column select), not this batch.
- **Test commands:**
  - `npm run build`
  - Manual: login as `field_worker` → open a customer with active subscriptions → network tab has **no** `subscriptions` query for that customer; page renders without errors. Login as `accountant` → unchanged.
- **Rollback risk:** **Low** — one-line query gate + cosmetic fallback; revert restores old behavior.
- **Done criteria:** No subscription fetch for field_worker on customer detail; accountant view unchanged; build clean.

---

### Batch 4 — Docs: cancel A6/B9, sync statuses

- **Objective:** Make the roadmap and status audit reflect reality so no future agent implements cancelled work.
- **Files likely touched:**
  - `docs/audit-reports/00-final-fix-roadmap.md` — mark **A6 = CANCELLED (Paraşüt not used)**, **B9 = CANCELLED (conditional, see §2 of this plan)**; update stale “REMAINING” statuses for A5, A7, A8, A9, B1, B4, B5, B7 per the status audit.
  - `docs/audit-reports/00-roadmap-implementation-status-audit.md` — append A6/B9 cancellation note.
- **Exact expected changes:** Status-cell and note edits only. No new findings, no restructuring.
- **Test commands:** None (docs). Markdown preview sanity check.
- **Rollback risk:** **None.**
- **Done criteria:** No doc still lists A6/B9 as pending work; statuses match the audit + Batches 1–3 outcomes.

---

### Batch 5 — Production verification (ops; no repo code changes)

- **Objective:** Apply everything to staging→production and prove the security posture live. This batch closes audit items A1–A3, A5, A7, A8, B1, B4, B5, B10 from “DONE (local)” to “production-complete”.
- **Files/migrations involved (apply, not edit):** `00224`–`00233` + new `00234`; Edge functions `extend-subscription-payments`, `fetch-tcmb-rates`; `supabase/config.toml`.
- **Exact expected steps:**
  1. **Secrets first** (per `a5-extend-subscription-payments-cron-setup.md`):
     - Edge secret `CRON_SECRET` set; Vault secrets `project_url` and `edge_cron_secret` exist; `edge_cron_secret` value == `CRON_SECRET`.
     - `SELECT name FROM vault.secrets WHERE name IN ('project_url','edge_cron_secret');`
  2. **Deploy edge functions** (with Batch 1 fix): `supabase functions deploy extend-subscription-payments` and `supabase functions deploy fetch-tcmb-rates`.
     - **A6/B9 disposition:** `supabase functions list` — if `parasut-dispatch` / `parasut-reconcile` appear deployed, delete them (`supabase functions delete parasut-reconcile`, `... parasut-dispatch`) per the cancellation. If they cannot be deleted, reopen B9 as a new batch.
  3. **Apply migrations:** `supabase db push` (after explicit APPROVE; staging first).
  4. **Cron verification:**
     - `SELECT jobname, schedule FROM cron.job ORDER BY jobname;` → expect `extend-subscription-payments-monthly` (`0 2 1 * *`), `fetch-tcmb-rates-daily` (`0 3 * * *`), `recurring-expenses-daily`, `generate-monthly-sim-finance`, notification jobs.
     - **Duplicate cron removal:** Supabase Dashboard → Edge Functions → `extend-subscription-payments` → Schedules → delete/disable any legacy schedule (doc §4). Confirm only the pg_cron job remains.
  5. **Edge smoke (production URLs):**
     - `curl -s -o /dev/null -w "%{http_code}" -X POST https://<ref>.supabase.co/functions/v1/extend-subscription-payments` → **401**
     - with `-H "x-cron-secret: <CRON_SECRET>"` → **200**, body `{ ok: true, rowsCreated: N }`
     - `fetch-tcmb-rates`: no auth → **401**; with secret → **200**; with accountant JWT → **200**; with field_worker JWT → **403**.
  6. **View options:** the `pg_class.reloptions` check from Batch 2.
  7. **Role-matrix tests** (master summary §8, Paraşüt rows removed):
     - field_worker RPC denials: `get_monthly_revenue_expense`, `get_subscription_stats`, `get_overdue_subscription_payments`, `get_overdue_invoices`, `fn_generate_recurring_expenses` (direct), `generate_subscription_payments`, `bulk_import_subscriptions`, `fn_update_subscription_price`, `complete_proposal_with_rate`, `soft_delete_transaction`.
     - field_worker completes **assigned** WO via `fn_complete_work_order_with_payment` → success; **unassigned** → denied.
     - admin `/finance/recurring` manual generate (uses `fn_generate_recurring_expenses_guarded`) → works; field_worker → denied.
     - field_worker `/` dashboard → no finance/subscription RPCs in network tab.
     - accountant: dashboard KPIs, `/finance/collections` (totals parity vs pre-`00233` snapshot — B5 requirement), receivables, soft-delete smoke.
     - `/work-history`: empty search fires no query; filtered search returns ≤200 rows.
  8. Verify `GRANT EXECUTE` state of `complete_proposal_with_rate` on deployed DB (deferred roadmap item): guarded in-function, so `authenticated` grant is acceptable; record finding.
- **Test commands:** as listed inline above.
- **Rollback risk:** **Medium** — migration apply is the risky moment; mitigations: staging first, Tahsilat totals snapshot before `00233`/`00234`, each migration is re-runnable (`CREATE OR REPLACE` / `ALTER` / idempotent cron blocks).
- **Done criteria:** All smoke checks pass on staging, then production; every checklist row in §6 ticked; audit doc updated from “DONE (local)” to “VERIFIED”.

---

### Batch 6 — B6: Indexes (EXPLAIN-first)

- **Objective:** Add the two missing hot-path indexes before any large payment-history/receivables data load.
- **Files likely touched:**
  - New migration: `supabase/migrations/00235_collection_receivables_indexes.sql` (number may shift)
- **Exact expected changes (EXPLAIN-first — do not skip step 1):**
  1. On staging with representative data, run `EXPLAIN (ANALYZE, BUFFERS)` for: Collection Desk query (`collectionApi.js` `COLLECTION_SELECT` filters on `subscription_payments.status` + `payment_month`) and receivables query (`finance/api.js` income + `payment_status = 'unpaid'`). Record plans in the PR.
  2. Only if seq scans confirm need, add per audit 07 suggested DDL, e.g.:
     - `CREATE INDEX CONCURRENTLY idx_sub_payments_status_month ON subscription_payments (status, payment_month);` (or partial `WHERE status IN ('pending','failed')`)
     - `CREATE INDEX CONCURRENTLY idx_ft_unpaid_income ON financial_transactions (payment_status) WHERE direction = 'income' AND deleted_at IS NULL;`
  3. Re-run EXPLAIN; include before/after in PR. **No index drops** (that is C8, post-launch).
  - Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction — keep the migration non-transactional or apply via SQL editor per Supabase guidance.
- **Test commands:** the EXPLAIN pairs; Collection Desk + receivables page latency spot-check.
- **Rollback risk:** **Low–Medium** — write amplification only; `DROP INDEX CONCURRENTLY` reverts cleanly.
- **Done criteria:** Index used in plans (Index/Bitmap scan), no regression in insert-heavy flows, PR contains plans.

---

### Batch 7 — B2: operations/plan_items SELECT RLS (**product-confirmation pending**)

- **Objective:** Restrict `operations_items` / `plan_items` SELECT to admin/accountant — **only after** product confirms field_workers have no legitimate read need.
- **Gate:** Written product confirmation recorded in the PR. If product says field_workers need scoped access, this becomes a different (scoped-policy) design task — stop and re-plan.
- **Files likely touched:** new migration replacing SELECT policies from `00160_service_requests.sql` / `00174_plan_items.sql`.
- **Exact expected changes:** `DROP POLICY` + `CREATE POLICY` restricting SELECT to `get_my_role() IN ('admin','accountant')` (initplan-wrapped `(SELECT get_my_role())` to pre-empt C1 concerns).
- **Test commands:** field_worker API read → denied; accountant `/operations` board fully functional.
- **Rollback risk:** **Medium** — may break undocumented field workflows; that is exactly why the product gate exists.
- **Done criteria:** Product sign-off attached; role tests pass; ops board regression-free.

---

### Batch 8 — B11: Lazy-load finance + proposals routes (post-gate)

- **Objective:** Cut initial JS for field workers; remove finance/proposal code from first paint.
- **Files likely touched:** `src/App.jsx` (pattern already exists: `InvoiceAnalysisPage` at L66).
- **Exact expected changes:** Convert `/finance/*` and `/proposals/*` route components to `lazy(() => import(...))` with the existing Suspense fallback pattern. No other route changes; no `vite.config.js` changes in this batch.
- **Test commands:** `npm run build` — record chunk sizes vs audit 10 baseline (main chunk should drop measurably); manual: navigate to `/finance` and `/proposals/:id` (PDF export) as accountant; field_worker first load has no finance chunks in network tab.
- **Rollback risk:** **Medium** — loading flashes / Suspense edge cases; revert is a plain import swap.
- **Done criteria:** Build passes, smaller initial chunk documented in PR, all finance/proposal pages reachable.

---

### Batch 9 — Phase C quick wins (app-only, one PR each)

Order within batch: **C2 → C4 → C5 → C7 → C6** (lowest risk first).

| Item | Objective | Files | Expected change | Test | Risk |
|------|-----------|-------|-----------------|------|------|
| C2 | P&L period guard | `finance/hooks.js` (`useProfitAndLoss` L240), Reports page | Default period window; skip query when period null | Reports with/without period | Low |
| C4 | Dynamic XLSX | `CustomersListPage.jsx`, `SimCardsListPage.jsx`, import pages | `const XLSX = await import('xlsx')` inside export handlers | Export still produces file; xlsx chunk lazy in build | Low |
| C5 | Lazy ops tabs | operations board page | `lazy()` for calendar/insights tabs | Ops tabs load on click | Low |
| C7 | Customer tab-lazy queries | `CustomerDetailPage.jsx` | `enabled` per active tab for the 6 mount queries | Per-tab navigation, no duplicate fetches | Low |
| C6 | Narrow finance invalidation | `finance/hooks.js`, `workOrders/hooks.js` | Scope `profitAndLossKeys`/`collectionKeys` invalidation by period/customer | Mutation refetches only its screen | Medium |

- **Done criteria per item:** `npm run build` clean + the listed manual test.

---

### Batch 10 — Phase C SQL + Phase D (post-launch, measure-first)

- **C1** (RLS initplan + `work_order_materials` policy rewrite), **C3** (`subscriptions_detail` overdue denorm), **C8** (drop duplicate indexes), **C10** (`work_orders_detail` list split): each is its own migration PR with EXPLAIN evidence on production-like volume; **do not start before Batch 6 metrics exist**.
- **C9** (PWA precache) — `vite.config.js`, after B11.
- **D1** (`payment_methods` RLS), **D3/D4** (legacy RPC scope/drop) — product decisions; record outcomes, implement only if chosen.
- **D5** (CORS) — restrict origins on remaining deployed edge functions (only TCMB + extend remain after A6/B9 cancellation).
- **D7** (`chunkSizeWarningLimit` → 500) — only after B11 + C4/C5.
- **D8** (`queryClient.clear()` on logout), **D9** (async Sentry init in `src/main.jsx`) — trivial standalone PRs, any time after the gate.

---

## 6. Final Production Release Checklist

All rows must pass on **staging**, then production. Paraşüt rows removed (cancelled).

| # | Check | How |
|---|-------|-----|
| 1 | `cronAuth.ts` validates secret (R1) | curl 401/200/401 triple on `extend-subscription-payments` |
| 2 | Tahsilat views `security_invoker=true` (R2) | `pg_class.reloptions` query; field_worker 0 rows on both views |
| 3 | Migrations `00224`–`00234` applied | `supabase migration list` / `supabase db diff` clean |
| 4 | Finance/subscription RPCs deny field_worker | RPC matrix (Batch 5 step 7) |
| 5 | Completion RPCs: assigned-WO success / unassigned denial; proposal admin+accountant only | Manual flows |
| 6 | Recurring: cron runs as postgres; guarded RPC works for admin, denied for field_worker | `cron.job_run_details` + UI |
| 7 | Dashboard as field_worker: zero finance/subscription requests | DevTools network tab on `/` |
| 8 | Customer detail as field_worker: no SIM, payment-method, or subscription pricing queries (Batch 3) | DevTools network tab |
| 9 | TCMB: cron secret 200, no-auth 401, field_worker JWT 403, accountant refresh works | curl + UI |
| 10 | Single subscription-extension schedule (no Dashboard duplicate) | `cron.job` + Dashboard Schedules empty |
| 11 | `parasut-dispatch`/`parasut-reconcile` **not deployed** | `supabase functions list` |
| 12 | Tahsilat totals parity post-`00233` rewrite | Accountant compares pre/post snapshot on staging copy |
| 13 | Work history: empty search fires nothing; results capped at 200 | UI + network tab |
| 14 | `npm run build` clean | CI / local |
| 15 | B6 indexes in place before bulk history import | EXPLAIN evidence in PR |

---

## 7. Recommended Order for Cursor Auto

```text
1. Batch 1  — R1 cronAuth fix            (code, 1 file, immediate)
2. Batch 2  — R2 security_invoker 00234  (migration file, immediate)
3. Batch 3  — B3 subscription gate       (code, 1 file)
4. Batch 4  — docs: cancel A6/B9, sync   (docs)
5. Batch 5  — production verification    (ops; requires user APPROVE for db push + deploys)
────────────── production gate ──────────────
6. Batch 6  — B6 indexes (EXPLAIN-first)
7. Batch 7  — B2 RLS (blocked on product confirmation — may run any time after gate)
8. Batch 8  — B11 lazy routes
9. Batch 9  — C2, C4, C5, C7, C6 (one PR each)
10. Batch 10 — C1/C3/C8/C10 + D items (measure-first, post-launch)
```

**Hard rules for the implementer:** one batch per branch; APPROVE before any migration apply or edge deploy; never edit `00224`–`00233` if already applied remotely (use `00234+`); no Paraşüt work (A6/B9 cancelled); no refactors beyond the exact changes listed.

---

*Planning document only. No code, migrations, deployments, or commits were made in producing this plan.*
