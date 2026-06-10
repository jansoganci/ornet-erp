# Ornet ERP Final Security & Performance Fix Roadmap

> **Date:** 2026-05-31 (status updated 2026-06-09 — Batch 4 doc sync)  
> **Source:** [00-master-security-performance-summary.md](./00-master-security-performance-summary.md) and audit reports [01](./01-rls-audit.md)–[10](./10-bundle-performance-audit.md)  
> **Status:** **In progress** — first security batch implemented locally; **not production-complete** until migrations are applied to remote Supabase and staging verification passes.  
> **Project rules:** [CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md)

---

## Executive Summary

Ten static audits (Phases 1–10) concluded the app is **NOT SAFE** for production company, customer, and finance data, and **HIGH RISK** for performance at scale and on slow networks. Table-level RLS on `financial_transactions`, subscriptions, and proposals is largely correct; failures concentrate on **bypass paths**: Tahsilat views without `security_invoker`, unguarded `SECURITY DEFINER` RPCs, public or weakly authenticated edge functions, and the home dashboard fetching finance aggregates for every role including `field_worker`.

**Fix order:** **Phase A** (security blockers) → **Phase B** (pre-rollout hardening) → **Phase C** (performance after launch) → **Phase D** (debt / product decisions). Do **not** load multi-year ledger or full billing history until **A1, A2, A3** are **applied and verified on staging**, and **B6** (indexes) is done.

**Branch progress (local only):** **A1–A4, A7–A9, B1, B3, B4, B5, B7, B8, B10** implemented in repo. **R1** fixed locally (`cronAuth.ts`); **R2** fixed locally (`00234`); **B3** remainder fixed locally. **A5/A8** implemented locally — deploy + live verify pending. **A6, B9** **CANCELLED** (Paraşüt not used; see below). Migrations **`00224`–`00234`** exist locally but are **not applied to remote Supabase** yet.

**What can wait:** Bundle lazy-loading (**B11**, **C4–C5**), RLS policy micro-optimizations (**C1**), materialized views (**D6**), product decisions on `payment_methods` / Paraşüt matching (**D1–D2**).

---

## Completed so far (local branch — not production-complete)

| ID | Status | Evidence | Remote apply | Staging verification |
|----|--------|----------|--------------|----------------------|
| **A1** | **DONE** (local) | `supabase/migrations/00224_tahsilat_views_security_invoker.sql` | **Pending** | **Pending** — field_worker 0 rows on Tahsilat views; accountant Tahsilat parity |
| **A2** | **DONE** (local) | `supabase/migrations/00225_finance_rpc_role_guards.sql` — guards on `get_monthly_revenue_expense`, `get_subscription_stats`, `get_overdue_subscription_payments`, `get_overdue_invoices` (NULL-safe: `IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant')`) | **Pending** | **Pending** — RPC deny for field_worker; admin/accountant dashboard + subscriptions |
| **A3** | **DONE** (local) | `00225` — `REVOKE` from `authenticated`/`PUBLIC`; `GRANT` to `postgres`, `service_role` | **Pending** | **Pending** — cron `recurring-expenses-daily`; browser RPC denied; manual recurring UI regression expected |
| **A4** | **DONE** (local) | `src/pages/DashboardPage.jsx`; `src/features/subscriptions/hooks.js`; `src/features/dashboard/hooks.js`; `src/features/dashboard/components/RevenueExpenseLineChart.jsx`; `src/features/dashboard/components/OverduePaymentsList.jsx` — `canWrite` / `enabled` gating | N/A (app) | **Pending** — field_worker no finance KPI/chart/overdue network calls |
| **B8** | **DONE** (local) | `src/features/workOrders/api.js` — debug `console.log` removed from `updateWorkOrder` | N/A (app) | **Pending** — save WO; no payload dump in console |
| **B10** | **DONE** (local) | `00225` — `soft_delete_transaction` allows `admin`/`accountant` only; NULL-safe guard | **Pending** | **Pending** — soft-delete as accountant; field_worker denied |
| **B3** | **DONE** (local) | `CustomerDetailPage.jsx` — `useCustomerSubscriptions(canWrite ? id : null)` + prior gates (SIM, payment methods, Paraşüt panel, Tahsilat allowlists) | N/A (app) | **Pending** — field_worker no subscription pricing fetch |

**Production-complete definition:** Remote migration apply + manual tests above passed on **staging** (and production apply per release process). Local file presence alone does **not** close an item.

---

## Remaining work (high level)

**Phase A — still required before production finance data:**

| ID | Status | Notes |
|----|--------|-------|
| **A5** | **DONE** (local) | R1 fixed: `cronAuth.ts` `assertCronAuthorized()` validates `x-cron-secret`; `00226`/`00227`, `config.toml` | **Pending** deploy | **Pending** — curl 401/200 smoke |
| **A6** | **CANCELLED** | Paraşüt not used — do not implement lockdown; verify functions not deployed (Batch 5) | N/A | N/A |
| **A7** | **DONE** (local) | `00230_completion_rpc_role_guards.sql` | **Pending** | **Pending** — WO/proposal role matrix |
| **A8** | **DONE** (local) | `00228`, `fetch-tcmb-rates/index.ts`, `CurrencyWidget.jsx` | **Pending** deploy | **Pending** — cron + role smoke |
| **A9** | **DONE** (local) | `ProposalDetailPage.jsx` TRY → `complete_proposal_with_rate` | N/A (app) | **Pending** — TRY completion smoke |

**Apply + verify completed SQL (not optional):** Run **`00224`** through **`00234`** on staging; execute role-matrix tests from [00-master-security-performance-summary.md](./00-master-security-performance-summary.md) §8.

**Phase B — notable remainders:** **B2, B6, B11**; **B2** blocked on product confirmation. **B9 CANCELLED** (Paraşüt not used / not deployed).

**Follow-up product/security (A3-related):** Manual recurring generation on `/finance/recurring` (`src/features/finance/recurringApi.js` → `fn_generate_recurring_expenses`) will **fail from the browser** after **A3** is applied; needs a follow-up guarded RPC, edge path, or UX change (not implemented in current branch).

---

## Fix Priority Table

| Priority | ID | **Impl. status** | Finding title | Source report | Risk | Sec / Perf | Affected files | Migration? | Impl. risk | Recommended action |
|----------|-----|------------------|---------------|---------------|------|------------|----------------|------------|------------|-------------------|
| **A** | A1 | **DONE**† | Tahsilat views `security_invoker` | 01, 03, 05, 08 | CRITICAL | Security | `00224`; `00213`, `00214` | **Yes** | Low | Apply `00224` + staging test |
| **A** | A2 | **DONE**† | Finance/subscription stats RPC role guards | 02, 03, 05 | CRITICAL | Security | `00225` | **Yes** | Medium | Apply `00225` + RPC role tests |
| **A** | A3 | **DONE**† | Revoke `fn_generate_recurring_expenses` from `authenticated` | 02, 03 | CRITICAL | Security | `00225`; `recurringApi.js` | **Yes** | Medium | Apply `00225`; verify cron; UI follow-up |
| **A** | A4 | **DONE**‡ | Dashboard finance queries `enabled: canWrite` | 03, 05, 09 | CRITICAL | Security + Perf | `DashboardPage.jsx`, dashboard hooks | No | Low | Staging verify field_worker dashboard |
| **A** | A5 | **DONE**‡ | `extend-subscription-payments` auth (R1 fixed) | 04 | CRITICAL | Security | `cronAuth.ts`; `00226`; `config.toml` | No* | Medium | Deploy + curl smoke |
| **A** | A6 | **CANCELLED** | `parasut-reconcile` lockdown | 04 | — | — | Edge; `config.toml` | No* | — | Paraşüt not used; verify not deployed |
| **A** | A7 | **DONE**† | WO/proposal completion RPC guards | 02, 03 | HIGH | Security | `00230`; WO/proposal API | **Yes** | **High** | Apply `00230` + smoke |
| **A** | A8 | **DONE**‡ | `fetch-tcmb-rates` cron secret | 04, 05 | HIGH | Security | `00228`; Edge; `CurrencyWidget.jsx` | No* | Medium | Deploy + cron smoke |
| **A** | A9 | **DONE**‡ | TRY proposal completion via RPC | 03 | HIGH | Security + Finance | `ProposalDetailPage.jsx`; `00230` | **Yes**† | Medium | Staging verify TRY path |
| **B** | B1 | **DONE**† | Subscription bulk/payment RPC guards | 02 | HIGH | Security | `00229` | **Yes** | Medium | Apply `00229` + smoke |
| **B** | B2 | **REMAINING** | Operations/plan_items SELECT RLS | 01 | HIGH | Security | `00160`, `00174` | **Yes** | Medium | Product confirm then tighten |
| **B** | B3 | **DONE**‡ | Customer/SIM/WO exposure gates | 05, 09 | HIGH | Security | `CustomerDetailPage.jsx`; `WorkOrderDetailPage.jsx`; `finance/api.js` | No | Low–Med | Staging verify field_worker |
| **B** | B4 | **DONE**†‡ | `search_work_history` LIMIT + `enabled` | 08, 09 | CRITICAL‡ | Perf + DoS | `00232`; work history hooks | **Yes** + app | Medium | Apply + smoke |
| **B** | B5 | **DONE**†‡ | Tahsilat view rewrite + pagination (R2: apply `00234`) | 08, 09 | CRITICAL‡ | Perf | `00233`, `00234`; Tahsilat | **Yes** | **High** | Apply + totals parity |
| **B** | B6 | **REMAINING** | Indexes: `subscription_payments`, `payment_status` | 07, 08 | HIGH | Perf | New migration | **Yes** | Low–Med | EXPLAIN then partial indexes |
| **B** | B7 | **DONE**‡ | Split `collection` React Query keys | 09 | HIGH | Both | `finance/api.js`, `collectionApi.js` | No | Low | Staging verify invalidation |
| **B** | B8 | **DONE**‡ | Remove WO debug `console.log` | 05 | HIGH | Security | `workOrders/api.js` | No | **Low** | Staging smoke: save WO |
| **B** | B9 | **CANCELLED** | Paraşüt `ping` + response minimization | 04 | — | — | Edge handlers | No* | — | Paraşüt not used; not deployed |
| **B** | B10 | **DONE**† | `soft_delete_transaction` stale roles | 02 | MEDIUM | Security | `00225` | **Yes** | Low | Apply `00225`; soft-delete smoke |
| **B** | B11 | **NOT STARTED** | Lazy-load finance + proposals routes | 10 | HIGH | Perf | `App.jsx` | No | Medium | `React.lazy` + Suspense |
| **C** | C1 | **NOT STARTED** | RLS initplan + `work_order_materials` | 06 | CRITICAL§ | Perf | `00010` policies | **Yes** | **High** | Policy rewrite + EXPLAIN |
| **C** | C2 | **NOT STARTED** | P&L default period window | 08 | HIGH | Perf | `finance/hooks.js` | No | Low | Require period in app |
| **C** | C3 | **NOT STARTED** | `subscriptions_detail` overdue denorm | 08 | HIGH | Perf | `00143` / `subscriptions` | **Yes** | Medium | Column or view simplify |
| **C** | C4 | **NOT STARTED** | Dynamic XLSX import | 10 | HIGH | Perf | List/import pages | No | Low | `import()` on export |
| **C** | C5 | **NOT STARTED** | Lazy operations tabs | 10 | MEDIUM | Perf | `OperationsBoardPage.jsx` | No | Low | Lazy tab imports |
| **C** | C6 | **NOT STARTED** | Narrow finance query invalidation | 09 | HIGH | Perf | Finance/WO hooks | No | Medium | Scoped keys |
| **C** | C7 | **NOT STARTED** | Customer detail tab-lazy queries | 09 | HIGH | Perf | `CustomerDetailPage.jsx` | No | Low | `enabled` per tab |
| **C** | C8 | **NOT STARTED** | Drop duplicate indexes | 07 | HIGH | Perf | Index migration | **Yes** | Medium | Measure first |
| **C** | C9 | **NOT STARTED** | PWA precache tuning | 10 | HIGH | Perf | `vite.config.js` | No | Medium | Smaller precache |
| **C** | C10 | **NOT STARTED** | `work_orders_detail` list split | 08 | HIGH | Perf | View migration | **Yes** | Medium | List view without LATERAL |
| **D** | D1–D9 | **NOT STARTED** | Product/debt items | 01, 02, 04, 05, 08, 10 | LOW–MED | Mixed | Various | Maybe | Low | See Phase D section |

\*Deploy/config + edge code, not SQL migration.  
†**DONE (local)** = migration/SQL in repo; **remote apply + staging verification still pending** — not production-complete.  
‡**DONE (local)** = app change in repo; **staging verification still pending**.  
§RLS perf CRITICAL at scale, not immediate confidentiality blocker if A1–A4 are **applied and verified**.

---

## Phase A — Must Fix Before Production Data

> **Gate:** No real company ledger, Tahsilat production use, or broad field-worker rollout until **all Phase A items** are verified on **staging**.  
> **Branch note:** **A1, A2, A3, A4** implemented locally; **A5–A9** not started. Apply **`00224`** + **`00225`** on staging before treating A1/A2/A3/B10 as closed.

---

### A1 — Tahsilat collection views: `security_invoker`

| **Implementation status** | **DONE (local)** — not production-complete until remote apply + staging verification |
|---------------------------|----------------------------------------------------------------------------------------|
| **Evidence** | `supabase/migrations/00224_tahsilat_views_security_invoker.sql` (`ALTER VIEW … SET (security_invoker = true)` on `v_collection_customer_summary`, `v_collection_documents`) |
| **Remote Supabase apply** | **Pending** |
| **Staging verification** | **Pending** — field_worker `SELECT` on both views → 0 rows; accountant `/finance/collections` unchanged |

| Field | Detail |
|-------|--------|
| **Problem** | `v_collection_customer_summary` and `v_collection_documents` created without `security_invoker = true` ([01](./01-rls-audit.md) F-CRIT-01). |
| **Why it matters** | `field_worker` may read aggregated billing, COGS, margins, and collection totals via PostgREST even when `financial_transactions` RLS denies direct access. |
| **Files affected** | `supabase/migrations/00213_tahsilat_views.sql`; `00214_collection_customer_summary_profit.sql`; `src/features/finance/api.js` (L912, L931) |
| **Required change** | New migration: `ALTER VIEW … SET (security_invoker = true)` on both views; optional explicit `GRANT SELECT`; narrow Tahsilat `select('*')` in app (can pair with B3). |
| **Migration needed?** | **Yes** |
| **Rollback risk** | **Low** — revert migration restores prior view options; accountants may see fewer rows if RLS was accidentally bypassing before (verify expected). |
| **Manual test plan** | As `field_worker` JWT: `select` from both views → 0 rows or policy error. As `accountant`: Tahsilat page still loads. Regression on `/finance/collections`. |
| **Approval needed?** | **YES** |

---

### A2 — Unguarded finance/subscription read RPCs

| **Implementation status** | **DONE (local)** — not production-complete until remote apply + staging verification |
|---------------------------|----------------------------------------------------------------------------------------|
| **Evidence** | `supabase/migrations/00225_finance_rpc_role_guards.sql` — role guards on `get_monthly_revenue_expense(INT)`, `get_subscription_stats()`, `get_overdue_subscription_payments()`, `get_overdue_invoices()`; NULL-safe `IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant')`; `SET search_path = public` |
| **Remote Supabase apply** | **Pending** (same migration as A3, B10) |
| **Staging verification** | **Pending** — field_worker RPC calls fail; admin/accountant dashboard and subscription stats unchanged |

| Field | Detail |
|-------|--------|
| **Problem** | `get_monthly_revenue_expense`, `get_subscription_stats`, `get_overdue_subscription_payments`, `get_overdue_invoices` callable by any `authenticated` user ([02](./02-security-definer-rpc-audit.md) F-CRIT-01, F-HIGH-06). |
| **Why it matters** | Bypasses table RLS; exposes MRR, revenue/expense totals, overdue amounts to `field_worker` via browser/RPC. |
| **Files affected** | `00128_dashboard_revenue_rpc.sql`; `00129_dashboard_overdue_payments_rpc.sql`; `00169_fix_subscription_stats_mrr_include_sim_amount.sql`; `00018` overdue invoices; `src/features/dashboard/api.js`; `src/features/finance/api.js` L422 |
| **Required change** | Add `get_my_role() IN ('admin','accountant')` (or equivalent) at start of each function; set `search_path = public` where missing ([02](./02-security-definer-rpc-audit.md) MED-05). |
| **Migration needed?** | **Yes** |
| **Rollback risk** | **Medium** — dashboard/widgets break for field_worker (intended); verify accountant/admin unchanged. |
| **Manual test plan** | RPC calls with field_worker session → error. Admin dashboard KPIs and revenue chart still work. |
| **Approval needed?** | **YES** |

---

### A3 — `fn_generate_recurring_expenses` granted to `authenticated`

| **Implementation status** | **DONE (local)** — not production-complete until remote apply + staging verification |
|---------------------------|----------------------------------------------------------------------------------------|
| **Evidence** | `00225` — `REVOKE EXECUTE … FROM PUBLIC, authenticated`; `GRANT EXECUTE … TO postgres, service_role`; function body unchanged |
| **Remote Supabase apply** | **Pending** |
| **Staging verification** | **Pending** — browser `rpc('fn_generate_recurring_expenses')` denied; pg_cron job `recurring-expenses-daily` (`00070`) still runs as postgres |
| **Known follow-up** | Manual generate on `/finance/recurring` (`recurringApi.js`) will fail after apply — product/security decision not implemented in this branch |

| Field | Detail |
|-------|--------|
| **Problem** | Any logged-in user can execute cron-style function that INSERTs into `financial_transactions` ([02](./02-security-definer-rpc-audit.md) F-CRIT-02). |
| **Why it matters** | Integrity and confidentiality: unauthorized expense document generation. |
| **Files affected** | `00070_recurring_expenses.sql`; `src/features/finance/recurringApi.js` L85–87; `recurringHooks.js` |
| **Required change** | `REVOKE EXECUTE ON FUNCTION fn_generate_recurring_expenses() FROM authenticated`; grant to `service_role` / cron only; app: `enabled: canWrite` on trigger hook. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | **Medium** — recurring generation from UI fails until cron path confirmed; verify pg_cron still runs. |
| **Manual test plan** | Field_worker cannot invoke RPC; admin recurring UI still works via allowed path; cron job creates rows. |
| **Approval needed?** | **YES** |

---

### A4 — Dashboard loads finance for all roles

| **Implementation status** | **DONE (local)** — staging verification pending |
|---------------------------|--------------------------------------------------|
| **Evidence** | `src/pages/DashboardPage.jsx` (`useRole`, `enabled: canWrite`, hide finance widgets for non-writers); `src/features/subscriptions/hooks.js` (`useSubscriptionStats({ enabled })`); `src/features/dashboard/hooks.js`; `src/features/dashboard/components/RevenueExpenseLineChart.jsx`; `OverduePaymentsList.jsx` |
| **Remote Supabase apply** | N/A (app-only) |
| **Staging verification** | **Pending** — field_worker `/` must not call finance/subscription aggregate RPCs on mount |

| Field | Detail |
|-------|--------|
| **Problem** | `/` fetches `useSubscriptionStats`, `fetchFinanceDashboardKpis`, revenue chart, overdue list without `canWrite` ([03](./03-finance-access-audit.md) F-CRIT-02, [05](./05-frontend-exposure-audit.md) F5-CRIT-01). |
| **Why it matters** | Data in network tab and React Query cache for `field_worker`; duplicates RPC load even after A2. |
| **Files affected** | `src/pages/DashboardPage.jsx` L40–45, L133–205; `src/features/dashboard/hooks.js`; `src/features/dashboard/components/RevenueExpenseLineChart.jsx`; `OverduePaymentsList.jsx` |
| **Required change** | `enabled: canWrite` (from `useRole()`) on finance/subscription dashboard queries; optional role-specific dashboard layout (WO/tasks only for field_worker). |
| **Migration needed?** | **No** |
| **Rollback risk** | **Low** |
| **Manual test plan** | Login as field_worker: no finance KPIs/chart/overdue requests on mount. Accountant: unchanged. `npm run build`. |
| **Approval needed?** | **YES** |

---

### A5 — `extend-subscription-payments` edge authentication

| **Implementation status** | **DONE (local)** — R1 fixed in `cronAuth.ts`; deploy + live verify pending |

| Field | Detail |
|-------|--------|
| **Problem** | Service-role function extends subscription payment schedule; no in-function auth; `config.toml` has no entry ([04](./04-edge-functions-audit.md) F-CRIT-01). |
| **Why it matters** | Anyone who can POST the URL may create billing rows; bypasses RPC revoke on `extend_active_subscription_payments`. |
| **Files affected** | `supabase/functions/extend-subscription-payments/index.ts`; Supabase Dashboard cron + `verify_jwt`; add `[functions.extend-subscription-payments]` to `config.toml` |
| **Required change** | Mandatory shared secret header checked in handler; `verify_jwt = false` only for cron with secret; return `{ ok, rowsCreated }` not full rows (pairs with B9 H-EF-04). |
| **Migration needed?** | **No** (deploy + secrets) |
| **Rollback risk** | **Medium** — monthly cron fails if secret misconfigured; **Needs verification** of current Dashboard `verify_jwt`. |
| **Manual test plan** | curl without secret → 401. Cron with secret → success. Browser cannot trigger extension. |
| **Approval needed?** | **YES** |

---

### A6 — `parasut-reconcile` anonymous access

| **Implementation status** | **CANCELLED** — Paraşüt not used; do not implement. Verify function not deployed (Batch 5). |

| Field | Detail |
|-------|--------|
| **Problem** | `verify_jwt = false` in `config.toml`; no in-function auth ([04](./04-edge-functions-audit.md) F-CRIT-02). |
| **Why it matters** | Anonymous caller can read confirmed finance aggregates and call Paraşüt API with company OAuth. |
| **Files affected** | `supabase/config.toml` L13–14; `supabase/functions/parasut-reconcile/index.ts` |
| **Required change** | Require cron secret and/or admin role; narrow response body; restrict CORS for non-browser callers. |
| **Migration needed?** | **No** (deploy + config) |
| **Rollback risk** | **Medium** — reconcile cron must be updated with same secret as A5 pattern. |
| **Manual test plan** | Anon POST with anon key only → rejected. Authorized cron → success. |
| **Approval needed?** | **YES** |

---

### A7 — Work order and proposal completion RPC guards

| **Implementation status** | **REMAINING** |

| Field | Detail |
|-------|--------|
| **Problem** | `fn_complete_work_order_with_payment` and `complete_proposal_with_rate` lack `get_my_role()` / assignment checks ([02](./02-security-definer-rpc-audit.md) F-HIGH-01/02). |
| **Why it matters** | Any authenticated user with a UUID can complete WOs and trigger finance rows; proposals complete without accountant guard. |
| **Files affected** | `00208_complete_work_order_with_payment_rpc.sql`; `00211_fix_complete_proposal_with_rate_recalc.sql`; `src/features/workOrders/api.js` L476+; `src/features/proposals/api.js` L460 |
| **Required change** | WO: `admin`/`accountant` OR `auth.uid() = ANY(assigned_to)`. Proposal: `admin`/`accountant` only. Add explicit `GRANT EXECUTE` on proposal RPC ([02](./02-security-definer-rpc-audit.md) MED-04). **Check CLAUDE.md** completion paths. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | **High** — field technicians may be blocked if assignment logic wrong; test proposal-linked WO path (`completed_proposal_linked`). |
| **Manual test plan** | Field_worker completes **assigned** WO → success. Field_worker completes **unassigned** WO → fail. Accountant completes proposal → success. |
| **Approval needed?** | **YES** — **extra review** for assignment rules |

---

### A8 — `fetch-tcmb-rates` public write

| **Implementation status** | **REMAINING** |

| Field | Detail |
|-------|--------|
| **Problem** | `verify_jwt = false`; service role upserts `exchange_rates` ([04](./04-edge-functions-audit.md) F-HIGH-01). |
| **Why it matters** | Unauthenticated or field_worker can trigger exchange rate writes; affects USD proposal completion. |
| **Files affected** | `supabase/config.toml` L7–8; `fetch-tcmb-rates/index.ts`; `src/features/dashboard/components/CurrencyWidget.jsx`; `finance/api.js` L311+ |
| **Required change** | Cron secret header; hide/disable manual refresh unless `canWrite`. |
| **Migration needed?** | **No** (edge + app) |
| **Rollback risk** | **Medium** — pg_cron job `00053` must send secret. |
| **Manual test plan** | Public invoke without secret → fail. Accountant refresh → works. Cron still updates rates. |
| **Approval needed?** | **YES** |

---

### A9 — TRY proposal completion bypasses RPC

| **Implementation status** | **REMAINING** |

| Field | Detail |
|-------|--------|
| **Problem** | TRY proposals use `updateProposalStatus({ status: 'completed' })` instead of `complete_proposal_with_rate` ([03](./03-finance-access-audit.md) F-HIGH-01). |
| **Why it matters** | Violates CLAUDE.md completion discipline; audit trail and rate handling inconsistent with USD path. |
| **Files affected** | `src/features/proposals/ProposalDetailPage.jsx` L159–163, L580; `src/features/proposals/api.js` L442–456 |
| **Required change** | Route TRY completions through `complete_proposal_with_rate` (NULL or fixed rate per product); optional DB guard blocking direct `completed` transition. |
| **Migration needed?** | **Yes** if DB enforcement added; **No** if app-only |
| **Rollback risk** | **Medium** — TRY completion UX must be retested; revenue trigger behavior unchanged if status still reaches `completed`. |
| **Manual test plan** | Complete TRY proposal → single RPC path; verify income row in `financial_transactions`. |
| **Approval needed?** | **YES** — **finance logic review** against CLAUDE.md |

---

## Phase B — Should Fix Before Customer Rollout

> **Gate:** Complete before external customer-facing rollout or large fleet / multi-year history import.  
> **Approval before implementation:** **YES** for each item.

---

### B1 — Subscription bulk and payment RPC role guards

| Field | Detail |
|-------|--------|
| **Problem** | `bulk_import_subscriptions`, `generate_subscription_payments`, `ensure_payments_for_year`, `fn_update_subscription_price` lack role guards ([02](./02-security-definer-rpc-audit.md) F-HIGH-03–05). |
| **Why it matters** | Prevents subscription billing manipulation by non-finance roles. |
| **Files affected** | `00137`, `00148`, `00145`, `00151` migrations |
| **Required change** | `get_my_role() IN ('admin','accountant')` in each function body. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | Medium |
| **Manual test plan** | Import and payment generation as accountant; denied as field_worker. |
| **Approval needed?** | **YES** |

---

### B2 — Operations and plan_items SELECT RLS

| Field | Detail |
|-------|--------|
| **Problem** | All `authenticated` users can SELECT `operations_items` and `plan_items` ([01](./01-rls-audit.md) F-HIGH-01/02). |
| **Why it matters** | Ops pipeline data exposed despite `RoleRoute` on `/operations`. |
| **Files affected** | `00160_service_requests.sql`; `00174_plan_items.sql` |
| **Required change** | Restrict SELECT to `admin`/`accountant` (or scoped subset — **product decision**). |
| **Migration needed?** | **Yes** |
| **Rollback risk** | Medium — confirm no legitimate field_worker need |
| **Manual test plan** | field_worker API read → denied; accountant ops board works. |
| **Approval needed?** | **YES** — **product confirm** |

---

### B3 — Frontend exposure: customer, SIM, Tahsilat selects

| **Implementation status** | **PARTIAL (local)** — remainder **REMAINING** |
|---------------------------|------------------------------------------------|
| **Completed (local)** | `WorkOrderDetailPage.jsx` — `ParasutInvoicePanel` gated with `canWrite`; `parasutApi.js` — `.is('deleted_at', null)` on all Paraşüt `financial_transactions` selects |
| **Remaining** | `CustomerDetailPage.jsx` subscription/SIM pricing `enabled` gates; `simCards/api.js` exposure; Tahsilat `select('*')` / column allowlists in `finance/api.js` |
| **Staging verification** | **Pending** for completed slice |

| Field | Detail |
|-------|--------|
| **Problem** | Customer detail fetches pricing without `canWrite`; Paraşüt panel on WO; `select('*')` on finance ([05](./05-frontend-exposure-audit.md) F5-HIGH-01–04). |
| **Why it matters** | Defense in depth when RLS holds; reduces leak surface if views/RLS regress. |
| **Files affected** | `CustomerDetailPage.jsx`; `simCards/api.js`; `WorkOrderDetailPage.jsx`; `finance/api.js`; `parasutApi.js` |
| **Required change** | `enabled: canWrite` on sensitive hooks; column allowlists; `deleted_at` on Paraşüt queries (H-FIN-05). **Partial:** Paraşüt panel + `deleted_at` done; customer/SIM/Tahsilat selects not done. |
| **Migration needed?** | **No** |
| **Rollback risk** | Low–medium |
| **Manual test plan** | field_worker customer page: no subscription prices in UI; accountant unchanged. |
| **Approval needed?** | **YES** |

---

### B4 — Work history: unbounded RPC + mount fetch

| Field | Detail |
|-------|--------|
| **Problem** | `search_work_history` has no LIMIT; `useSearchWorkHistory` has `enabled: true` on mount ([08](./08-view-rpc-performance-audit.md) CRITICAL-1, [09](./09-react-query-audit.md) CRITICAL-2). |
| **Why it matters** | DoS risk and slow queries on `/work-history`. |
| **Files affected** | `00221_search_work_history_filters.sql`; `workHistory/hooks.js`; `WorkHistoryPage.jsx` |
| **Required change** | Add `p_limit`/`p_offset` to RPC; client `enabled` when search/date criteria met. |
| **Migration needed?** | **Yes** + app |
| **Rollback risk** | Medium |
| **Manual test plan** | Empty search does not query; filtered search returns capped rows. |
| **Approval needed?** | **YES** |

---

### B5 — Tahsilat view performance rewrite + pagination

| Field | Detail |
|-------|--------|
| **Problem** | Correlated subqueries per customer; `fetchCollectionSummaries` unbounded ([08](./08-view-rpc-performance-audit.md) CRITICAL-2). |
| **Why it matters** | Tahsilat unusable at scale; depends on A1 for correct RLS. |
| **Files affected** | `00213`/`00214`; `finance/hooks.js` L405–409; `TahsilatPage.jsx` |
| **Required change** | Rewrite view to aggregate FTP in one pass; app `.range()` or top-N. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | **High** — finance UI totals must match prior behavior |
| **Manual test plan** | Tahsilat parent/child rows; compare totals on staging copy. |
| **Approval needed?** | **YES** — **finance + DB review** |

---

### B6 — Critical indexes (Collection Desk + receivables)

| Field | Detail |
|-------|--------|
| **Problem** | Missing composite on `subscription_payments (status, payment_month)` and `financial_transactions.payment_status` ([07](./07-index-audit.md) F7-CRIT-01/02). |
| **Why it matters** | Required before large payment history and receivables load. |
| **Files affected** | New migration; `collectionApi.js`; `finance/api.js` receivables |
| **Required change** | Partial indexes per [07](./07-index-audit.md) suggested DDL; run EXPLAIN on staging first. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | Low–medium (write amplification) |
| **Manual test plan** | Collection Desk filters; receivables page latency on seed data. |
| **Approval needed?** | **YES** — **DB review** |

---

### B7 — Split React Query `collection` keys

| Field | Detail |
|-------|--------|
| **Problem** | Subscription Collection Desk and Tahsilat share `['collection']` root ([09](./09-react-query-audit.md) CRITICAL-3). |
| **Why it matters** | Over-invalidation and cache collisions. |
| **Files affected** | `src/features/finance/api.js`; `src/features/finance/collectionApi.js`; invalidation call sites |
| **Required change** | `collectionDeskKeys` vs `tahsilatKeys` namespaces. |
| **Migration needed?** | **No** |
| **Rollback risk** | Low |
| **Manual test plan** | Record payment on Desk → Tahsilat cache not fully stale incorrectly. |
| **Approval needed?** | **YES** |

---

### B8 — Remove work order debug logging

| **Implementation status** | **DONE (local)** — staging verification pending |
|---------------------------|--------------------------------------------------|
| **Evidence** | `src/features/workOrders/api.js` — removed debug `console.log` from `updateWorkOrder` |

| Field | Detail |
|-------|--------|
| **Problem** | `console.log` of full WO payload and DB result ([05](./05-frontend-exposure-audit.md) F5-HIGH-05). |
| **Why it matters** | Sensitive fields in browser console. |
| **Files affected** | `src/features/workOrders/api.js` L366–373, L382 |
| **Required change** | Remove or wrap in `import.meta.env.DEV`. |
| **Migration needed?** | **No** |
| **Rollback risk** | **Low** — safe small change |
| **Manual test plan** | Save WO; no console dump in prod build. |
| **Approval needed?** | **YES** |

---

### B9 — Paraşüt dispatch hardening

| **Implementation status** | **CANCELLED** — Paraşüt not used; not deployed. Reopen only if `parasut-dispatch` must stay deployed. |

| Field | Detail |
|-------|--------|
| **Problem** | `ping` without `requireRole`; full Paraşüt JSON returned ([04](./04-edge-functions-audit.md) F-HIGH-02/03). |
| **Why it matters** | OAuth abuse and over-exposure in network tab. |
| **Files affected** | `supabase/functions/parasut-dispatch/**` |
| **Required change** | `requireRole` on ping; map responses to minimal DTOs. |
| **Migration needed?** | **No** |
| **Rollback risk** | Low |
| **Manual test plan** | field_worker ping → 403; invoice flow still works for accountant. |
| **Approval needed?** | **YES** |

---

### B10 — `soft_delete_transaction` role list cleanup

| **Implementation status** | **DONE (local)** — not production-complete until remote apply + staging verification |
|---------------------------|----------------------------------------------------------------------------------------|
| **Evidence** | `00225` — `soft_delete_transaction` allows `admin`/`accountant` only; NULL-safe guard; soft-delete `UPDATE` unchanged |

| Field | Detail |
|-------|--------|
| **Problem** | Stale `manager`/`office` roles in RPC ([02](./02-security-definer-rpc-audit.md) F-MED-01). |
| **Why it matters** | Misconfiguration risk; auditor flags. |
| **Files affected** | `00107_soft_delete_transaction_rpc.sql` |
| **Required change** | `admin`, `accountant` only. |
| **Migration needed?** | **Yes** |
| **Rollback risk** | Low |
| **Manual test plan** | Soft-delete transaction as accountant. |
| **Approval needed?** | **YES** |

---

### B11 — Lazy-load finance and proposals routes

| Field | Detail |
|-------|--------|
| **Problem** | ~44 eager routes; PDF/XLSX/recharts preloaded ([10](./10-bundle-performance-audit.md) CRITICAL-1/2). |
| **Why it matters** | Field workers download finance/proposal code on first paint. |
| **Files affected** | `src/App.jsx` |
| **Required change** | `React.lazy` for `/finance/*`, `/proposals/*`, imports; keep Suspense fallbacks. |
| **Migration needed?** | **No** |
| **Rollback risk** | Medium — loading flashes |
| **Manual test plan** | field_worker first load: smaller initial JS; navigate to finance → chunk loads. `npm run build` compare sizes. |
| **Approval needed?** | **YES** |

---

## Phase C — Performance Improvements After Launch

> **Gate:** After Phase A–B on staging/production with real moderate data. Not confidentiality blockers if A complete.  
> **Approval before implementation:** **YES**

| ID | Summary | Problem | Why | Files | Change | Migration? | Rollback | Tests | Approval |
|----|---------|---------|-----|-------|--------|------------|----------|-------|----------|
| **C1** | RLS policy perf | Correlated EXISTS on materials; per-row `get_my_role()` | Slow at volume | `00010`, `00116`, `00212` | Initplan `(SELECT get_my_role())`; EXISTS + `deleted_at` | **Yes** | **High** | EXPLAIN on materials bulk | **YES** |
| **C2** | P&L period bounds | Unbounded `fetchProfitAndLoss` when period null | Full ledger scan | `finance/hooks.js`, Reports | Default period; guard null | No | Low | Reports with/without period | **YES** |
| **C3** | Subscription list perf | Per-row overdue EXISTS in view | 200 rows × EXISTS | `00143`, subscriptions API | Denormalize `has_overdue_pending` | **Yes** | Medium | List filter perf | **YES** |
| **C4** | Dynamic XLSX | Static import on list pages | Preloads xlsx chunk | Customers/SIM list pages | Dynamic import on export | No | Low | Export still works | **YES** |
| **C5** | Lazy ops tabs | Calendar/insights in main ops bundle | Heavy index chunk | `OperationsBoardPage.jsx` | `lazy(() => import('./CalendarTab'))` | No | Low | Ops tabs | **YES** |
| **C6** | Query invalidation | `profitAndLossKeys.all` on small edits | Refetch storms | finance/WO hooks | Narrow invalidation | No | Medium | Mutation → one screen | **YES** |
| **C7** | Customer tab queries | 6 parallel queries on mount | Slow customer open | `CustomerDetailPage.jsx` | Tab-scoped `enabled` | No | Low | Per-tab navigation | **YES** |
| **C8** | Index cleanup | Duplicate GIN, FTP indexes | Write/read cost | New migration | DROP after EXPLAIN | **Yes** | Medium | WO list perf | **YES** |
| **C9** | PWA precache | ~6.9 MB precache | Slow install | `vite.config.js` | Precache shell only | No | Medium | PWA install | **YES** |
| **C10** | WO list view | LATERAL profiles on list | Heavy search/history | `00195`, view migration | Split list view | **Yes** | Medium | WO list/search | **YES** |

---

## Phase D — Optional / Technical Debt

> **Approval:** **YES** where implementation is chosen; many items need **product decision** only.

| ID | Item | Source | Why defer | Action when ready |
|----|------|--------|-----------|-------------------|
| **D1** | `payment_methods` SELECT admin-only vs accountant UI | [01](./01-rls-audit.md) MED-02 | Product: deprecate vs expose | Align RLS or remove JOIN |
| **D2** | Paraşüt matching accountant vs admin RLS | [01](./01-rls-audit.md) MED-03 | Business rule | Grant or hide nav |
| **D3** | `search_customer_sites` global RPC | [02](./02-security-definer-rpc-audit.md) MED-02 | May be intentional UX | Scope or accept |
| **D4** | `get_customer_work_history` legacy RPC | [02](./02-security-definer-rpc-audit.md) MED-03 | **Needs verification** if still called | Drop or rewrite |
| **D5** | CORS `*` on edge functions | [04](./04-edge-functions-audit.md) MED-01 | After auth fixed | Restrict origins |
| **D6** | Materialized views (Tahsilat/P&L) | [08](./08-view-rpc-performance-audit.md) | After B5 stable | Design refresh job |
| **D7** | Document `chunkSizeWarningLimit: 2000` | [10](./10-bundle-performance-audit.md) | Until after B11 | Lower to 500 |
| **D8** | RQ keys include `role` on logout | [05](./05-frontend-exposure-audit.md) MED-01 | Shared-device edge case | `queryClient.clear()` on logout |
| **D9** | Async Sentry init | [10](./10-bundle-performance-audit.md) MED | Minor TTI | Defer entry init |

---

## Implementation Rules

1. **One fix per branch** (or one clearly scoped commit per ID). Do not mix A1 with bundle lazy-load in the same PR unless explicitly approved as a batch.
2. **No migration applied without review** — DB Agent documents intent, rollback, and staging apply; user **APPROVE** before `supabase db push` / production.
3. **No `SECURITY DEFINER` change without role-check review** — every RPC change must state allowed roles and field_worker assignment rules ([02](./02-security-definer-rpc-audit.md)).
4. **No finance logic change without CLAUDE.md check** — completion RPCs, `payment_status`, P&L sources, proposal-linked WO revenue ([CLAUDE.md](../../CLAUDE.md) Finance module rules).
5. **Always run `npm run build`** after frontend changes; compare chunk sizes to [10](./10-bundle-performance-audit.md) baseline when touching `App.jsx` or imports.
6. **Manual smoke tests** per item’s test plan; full role matrix from [00-master-security-performance-summary.md](./00-master-security-performance-summary.md) §8 before go-live.
7. **Do not include unrelated dirty files** in commits (audit docs, user WIP, `.hermes` state).
8. **Do not revert** `00221`–`00223` optimizations ([docs/supabase-query-optimization-analysis.md](../supabase-query-optimization-analysis.md)).
9. **Edge deploys** require Supabase secrets and Dashboard cron updates documented in PR — not only git diff.
10. **Separate security PRs from performance PRs** when possible (e.g. A1–A3 SQL vs B11 lazy routes).

---

## Recommended First Implementation Batch

**Status:** The batch below was **implemented locally** on the current branch (see **Completed so far**). **Next step:** apply **`00224`** + **`00225`** on staging and run verification — not production-complete until done.

| Order | ID | Batch role | Local status |
|-------|-----|------------|--------------|
| 1 | **A1** | Tahsilat `security_invoker` | **DONE** — `00224`; apply + verify **pending** |
| 2 | **A4** | Dashboard `canWrite` gating | **DONE** — app files listed above; verify **pending** |
| 3 | **B8** | Remove WO debug logs | **DONE** — `workOrders/api.js`; verify **pending** |
| 4 | **B3** (partial) | Paraşüt panel + `deleted_at` | **PARTIAL** — remainder **REMAINING** |
| 5 | **A2** + **A3** + **B10** | Finance RPC lockdown | **DONE** — `00225`; apply + verify **pending** |

**Not in first batch (still REMAINING):** **B7**, **A5–A6**, **A7**, **A9**, **B5**, **B2** (product), **B11**, and other Phase B/C items.

**Defer to dedicated PRs with extra review:** **A7**, **A5–A6**, **A9**, **B5**, **B2** (product), **B11** (UX loading).

---

## Deferred Items

| Item | Phase | Why not yet |
|------|-------|-------------|
| Tahsilat view full rewrite | B5 | Do **A1** first; B5 is high regression risk on finance totals |
| RLS policy rewrite (`work_order_materials`) | C1 | Security fixes first; policy changes need EXPLAIN on production-like volume |
| Materialized views | D6 | Requires refresh design and APPROVE |
| Drop duplicate indexes | C8 | Risk without metrics; after B6 added |
| `payment_methods` / Paraşüt matching RLS | D1–D2 | **Product decision** required |
| `operations_items` field_worker access | B2 | **Product confirm** — may break undocumented workflows |
| Full bundle split (all routes) | B11+ | Do finance/proposals lazy first; avoid big-bang `App.jsx` |
| TypeScript / dependency upgrades | — | Out of scope per AGENTS.md |
| Production `pg_policies` diff | — | Audits are migration-file-based; **verify in Supabase Dashboard** |
| `complete_proposal_with_rate` GRANT in DB | A9/B1 | **Needs verification** on deployed DB ([02](./02-security-definer-rpc-audit.md) MED-04) |
| `fn_get_operations_stats` exposure | 02 MED-06 | **Needs verification** if granted to `authenticated` |
| Lower `chunkSizeWarningLimit` to 500 | D7 | Only after B11; otherwise CI noise |

---

## Items Requiring Migration Review

All items marked **Migration needed? = Yes** require explicit **APPROVE** and peer review before apply:

| ID | Migration type | Review focus |
|----|----------------|--------------|
| **A1** | `ALTER VIEW` security_invoker | **Local file `00224` ready** — apply on staging; field_worker 0 rows; accountant parity |
| **A2** | RPC body replace | **Local file `00225` ready** — apply on staging; dashboard + finance RPC errors for roles |
| **A3** | `REVOKE` / GRANT | **Local file `00225` ready** — apply on staging; cron still runs `fn_generate_recurring_expenses` |
| **A7** | RPC guards | WO completion flows; assignment edge cases |
| **A9** | Optional RPC/RLS | TRY proposal revenue unchanged |
| **B1** | Multiple RPC guards | Import flows |
| **B2** | `CREATE POLICY` replace | Ops board for accountants |
| **B4** | `search_work_history` signature | App must pass limit/offset; 00221 overload |
| **B5** | View rewrite | Tahsilat numeric parity |
| **B6** | `CREATE INDEX` partial | Write cost; EXPLAIN plans |
| **B10** | RPC role fix | **Local file `00225` ready** — apply on staging; soft delete still works |
| **C1** | RLS policy replace | Materials/WO access unchanged |
| **C3** | Column or trigger | Subscription list correctness |
| **C8** | `DROP INDEX` | No planner regression |
| **C10** | View recreate | WO list/search fields |

**Not SQL migrations but require deploy review:** **A5**, **A6**, **A8**, **B9** (edge functions + secrets + `config.toml`).

---

## Suggested PR Sequence (After Approval)

```text
PR1  A1  — tahsilat-security-invoker
PR2  A4 + B8 + B7 — dashboard-gates-and-hygiene (app only)
PR3  A2 + A3 + B10 — finance-rpc-lockdown (SQL)
PR4  A5 + A6 + A8 — edge-auth (functions + config + secrets)
PR5  A7  — completion-rpc-guards (SQL + smoke WO/proposal)
PR6  A9  — proposal-completion-rpc-only (app + optional SQL)
PR7  B1 + B2 — subscription-ops-rls (SQL; B2 after product OK)
PR8  B3 + B6 — frontend-exposure-and-indexes
PR9  B4 — work-history-limit (SQL + app)
PR10 B5 — tahsilat-view-performance (SQL + app)
PR11 B9 + B11 — parasut-edge-and-lazy-routes
PR12+ Phase C items — performance (separate PRs per C1/C8/C10)
```

---

*Roadmap status reflects the current branch: migrations `00224`–`00225` and app changes for A1, A2, A3, A4, B8, B10, and partial B3 are present locally. Remote Supabase apply and staging verification are **pending** for all DONE SQL items. Not production-complete until apply + tests pass.*
