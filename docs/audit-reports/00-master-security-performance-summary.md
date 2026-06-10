# Ornet ERP — Master Security & Performance Audit Summary

> **Date:** 2026-05-31  
> **Scope:** Consolidation of Phases 1–10 (`docs/audit-reports/01`–`10`)  
> **Method:** Static audits only — no fixes applied  
> **Build evidence:** Phase 10 `npm run build` (Vite 7.3.1)  
> **Status:** Planning / prioritization document — **do not implement without explicit APPROVE**

---

## Reports Included

| Phase | Report | Status |
|-------|--------|--------|
| 1 | [01-rls-audit.md](./01-rls-audit.md) | ✅ Complete |
| 2 | [02-security-definer-rpc-audit.md](./02-security-definer-rpc-audit.md) | ✅ Complete |
| 3 | [03-finance-access-audit.md](./03-finance-access-audit.md) | ✅ Complete |
| 4 | [04-edge-functions-audit.md](./04-edge-functions-audit.md) | ✅ Complete |
| 5 | [05-frontend-exposure-audit.md](./05-frontend-exposure-audit.md) | ✅ Complete |
| 6 | [06-rls-performance-audit.md](./06-rls-performance-audit.md) | ✅ Complete |
| 7 | [07-index-audit.md](./07-index-audit.md) | ✅ Complete |
| 8 | [08-view-rpc-performance-audit.md](./08-view-rpc-performance-audit.md) | ✅ Complete |
| 9 | [09-react-query-audit.md](./09-react-query-audit.md) | ✅ Complete |
| 10 | [10-bundle-performance-audit.md](./10-bundle-performance-audit.md) | ✅ Complete |

**Missing reports:** None — all ten phase deliverables exist.

---

## 1. Overall Security Verdict

### **NOT SAFE** (for production company / finance / customer data)

- **Tahsilat collection views** (`v_collection_customer_summary`, `v_collection_documents`) lack `security_invoker = true`; the same defect class previously leaked P&L via `v_profit_and_loss` before `00102` / `00150` ([01](./01-rls-audit.md) F-CRIT-01). Any `authenticated` user may read aggregated billing, COGS, and collection totals if views run as owner.
- **SECURITY DEFINER RPCs** expose finance and subscription aggregates to all logged-in users (`get_monthly_revenue_expense`, `get_subscription_stats`, etc.) and allow **`fn_generate_recurring_expenses`** to be invoked by `authenticated` ([02](./02-security-definer-rpc-audit.md) CRITICAL; [03](./03-finance-access-audit.md)).
- **Edge functions** `parasut-reconcile` and `extend-subscription-payments` can be abused with service-role power when `verify_jwt = false` or without in-function secrets ([04](./04-edge-functions-audit.md) CRITICAL).
- **Dashboard (`/`)** is not behind `RoleRoute` and fetches MRR, net profit, revenue/expense series, and overdue payments for **every role**, including `field_worker` ([03](./03-finance-access-audit.md), [05](./05-frontend-exposure-audit.md), [09](./09-react-query-audit.md)).
- **Completion RPCs** (`fn_complete_work_order_with_payment`, `complete_proposal_with_rate`) and several subscription bulk RPCs lack `get_my_role()` / assignment guards ([02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md)).

**Table RLS for core finance tables is largely correct** for `admin` + `accountant` vs `field_worker`; the failures are **bypass paths** (views, RPCs, edge, client), not absence of policies on `financial_transactions`.

---

## 2. Overall Performance Verdict

### **HIGH RISK** (before scale + field rollout on slow networks)

- **Initial JS payload** ~**1.6 MB gzip** on first visit (main chunk **638 KB gzip** + preloaded `pdf-renderer`, `xlsx`, `pdfjs`, `recharts`) because **~44 routes are eager** in `App.jsx`; only invoice analysis is lazy ([10](./10-bundle-performance-audit.md)).
- **Tahsilat views** and **`search_work_history`** can drive unbounded or correlated scans; collection summaries have **no app pagination** ([08](./08-view-rpc-performance-audit.md)).
- **Missing indexes** on `subscription_payments (status, payment_month)` and `financial_transactions.payment_status` will hurt Collection Desk and receivables as history grows ([07](./07-index-audit.md)).
- **RLS policy cost** on `work_order_materials` (correlated `EXISTS` per row) and per-row `get_my_role()` on ledger tables will dominate at volume ([06](./06-rls-performance-audit.md)).
- **React Query** runs heavy dashboard and work-history queries without `enabled: canWrite` / search guards; broad invalidation refetches finance aggregates after routine mutations ([09](./09-react-query-audit.md)).

**Foundation is acceptable for moderate data today:** partial WO indexes (`00100`), global `refetchOnWindowFocus: false`, and some RPC filter improvements (`00221` work history) ([06](./06-rls-performance-audit.md), [09](./09-react-query-audit.md)).

---

## 3. Critical Findings (Merged, Deduplicated)

**Count: 9 unique critical themes** (several appear in multiple reports).

| ID | Title | Source report(s) | File path(s) | Risk | Proposed fix (do not implement yet) |
|----|-------|------------------|--------------|------|-------------------------------------|
| **C-01** | Tahsilat views may bypass finance RLS | [01](./01-rls-audit.md), [03](./03-finance-access-audit.md), [05](./05-frontend-exposure-audit.md), [08](./08-view-rpc-performance-audit.md) | `supabase/migrations/00213_tahsilat_views.sql` L4–84; `00214_collection_customer_summary_profit.sql` L7+; `src/features/finance/api.js` L912, L931 | **CRITICAL** — confidentiality | Migration: `ALTER VIEW v_collection_* SET (security_invoker = true)`; staging test as `field_worker`; narrow `select('*')` in app |
| **C-02** | `get_monthly_revenue_expense` — ledger totals for any authenticated user | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md), [05](./05-frontend-exposure-audit.md) | `00128_dashboard_revenue_rpc.sql` L6–33; `src/features/dashboard/api.js` L119; `RevenueExpenseLineChart.jsx` L15 | **CRITICAL** — confidentiality | `get_my_role() IN ('admin','accountant')` in RPC or SECURITY INVOKER; gate dashboard chart with `canWrite` |
| **C-03** | `fn_generate_recurring_expenses` granted to `authenticated` | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md) | `00070_recurring_expenses.sql` L203–289; `src/features/finance/recurringApi.js` L85–87 | **CRITICAL** — integrity / confidentiality | `REVOKE EXECUTE FROM authenticated`; cron/service_role only; hook `enabled: canWrite` |
| **C-04** | Dashboard loads finance + subscription KPIs for `field_worker` | [03](./03-finance-access-audit.md), [05](./05-frontend-exposure-audit.md), [09](./09-react-query-audit.md) | `src/pages/DashboardPage.jsx` L40–45, L133–205; `src/features/finance/api.js` L420–424; `subscriptions/hooks.js` L329–333 | **CRITICAL** — exposure + load | `enabled: canWrite` on all finance/subscription dashboard queries; role-specific dashboard layout |
| **C-05** | `extend-subscription-payments` — service-role billing extension | [04](./04-edge-functions-audit.md) | `supabase/functions/extend-subscription-payments/index.ts` L23–61; `supabase/config.toml` (no entry) | **CRITICAL** — integrity | Mandatory cron secret in function; document `verify_jwt`; no browser invoke; minimal response body |
| **C-06** | `parasut-reconcile` — anonymous finance + Paraşüt access | [04](./04-edge-functions-audit.md) | `supabase/config.toml` L13–14; `parasut-reconcile/index.ts` L53–124 | **CRITICAL** — confidentiality | `verify_jwt` + cron secret or admin-only; no public CORS |
| **C-07** | `search_work_history` — unbounded RPC on mount | [08](./08-view-rpc-performance-audit.md), [09](./09-react-query-audit.md) | `00221_search_work_history_filters.sql` L6–100; `workHistory/hooks.js` L9–14; `WorkHistoryPage.jsx` L67–73 | **CRITICAL** — performance + DoS | RPC `LIMIT`; `enabled` until search/date criteria; require min query length |
| **C-08** | `v_collection_customer_summary` — correlated subqueries, unbounded fetch | [08](./08-view-rpc-performance-audit.md), [09](./09-react-query-audit.md) | `00213`/`00214`; `finance/hooks.js` L405–409; `TahsilatPage.jsx` L192 | **CRITICAL** — performance at scale | Rewrite view to single-pass aggregates; app pagination; ties to C-01 migration |
| **C-09** | Main bundle preloads PDF + XLSX + charts for all users | [10](./10-bundle-performance-audit.md), [05](./05-frontend-exposure-audit.md) | `src/App.jsx` L26–80; `vite.config.js` L72–88; `dist/index.html` modulepreload | **CRITICAL** — performance + wider exposure surface | Route-level `React.lazy`; dynamic `import()` for xlsx/PDF; split field-worker entry path |

---

## 4. High Findings (Merged by Module)

**Count: 22 unique high themes** (deduplicated across reports).

### RLS

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-RLS-01** | `operations_items` SELECT open to all authenticated | [01](./01-rls-audit.md) | `00160_service_requests.sql` L122–125; `00172` | Restrict SELECT to `admin`/`accountant` |
| **H-RLS-02** | `plan_items` SELECT `USING (true)` | [01](./01-rls-audit.md) | `00174_plan_items.sql` L37–41 | Same role restriction as operations |

### RPC

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-RPC-01** | `fn_complete_work_order_with_payment` — no role/assignment guard | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md) | `00208_complete_work_order_with_payment_rpc.sql` L17–131; `workOrders/api.js` L476–484 | `get_my_role()` OR assigned worker check |
| **H-RPC-02** | `complete_proposal_with_rate` — no role guard | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md) | `00211` L15–64; `proposals/api.js` L460 | Role guard + explicit `GRANT EXECUTE` |
| **H-RPC-03** | `bulk_import_subscriptions` / `generate_subscription_payments` / `ensure_payments_for_year` unguarded | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md) | `00137`, `00148`, `00145` | `get_my_role() IN ('admin','accountant')` |
| **H-RPC-04** | `fn_update_subscription_price` — no role guard | [02](./02-security-definer-rpc-audit.md) | `00151_fix_price_update_rpcs.sql` | Accountant/admin only |
| **H-RPC-05** | Finance/subscription read RPCs unguarded (`get_subscription_stats`, overdue helpers) | [02](./02-security-definer-rpc-audit.md), [03](./03-finance-access-audit.md), [08](./08-view-rpc-performance-audit.md) | `00169`, `00129`, `00018`; `finance/api.js` L422 | Single role-check pattern in each RPC |
| **H-RPC-06** | `fn_upsert_site_asset` / batch — no role guard | [02](./02-security-definer-rpc-audit.md) | `00159_fn_upsert_site_asset.sql` | Match site_assets RLS intent |

### Finance

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-FIN-01** | TRY proposal completion via raw `status` UPDATE (not RPC) | [03](./03-finance-access-audit.md) | `ProposalDetailPage.jsx` L159–163, L580; `proposals/api.js` L442–456 | Route all completions through `complete_proposal_with_rate` |
| **H-FIN-02** | `fetchFinanceDashboardKpis` bundles stats + P&L for dashboard | [03](./03-finance-access-audit.md), [09](./09-react-query-audit.md) | `finance/api.js` L419–448; `DashboardPage.jsx` L42–45 | Dedupe RPC; gate by role |
| **H-FIN-03** | `v_profit_and_loss` / `fetchProfitAndLoss` without period bound | [08](./08-view-rpc-performance-audit.md) | `00150` L15–65; `finance/hooks.js` L240–244; `ReportsPage.jsx` L73 | Default period window; SQL-side aggregates |
| **H-FIN-04** | `v_collection_documents` — per-row payment subqueries | [08](./08-view-rpc-performance-audit.md) | `00213` L49–84; `finance/api.js` L930–958 | Join pre-aggregated FTP sums; invoker (C-01) |
| **H-FIN-05** | Paraşüt FT queries omit `deleted_at` | [03](./03-finance-access-audit.md), [05](./05-frontend-exposure-audit.md) | `finance/parasutApi.js` L15–64 | Add `.is('deleted_at', null)` |

### Edge Functions

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-EF-01** | `fetch-tcmb-rates` — public service-role write to `exchange_rates` | [04](./04-edge-functions-audit.md), [05](./05-frontend-exposure-audit.md) | `config.toml` L7–8; `fetch-tcmb-rates/index.ts`; `CurrencyWidget.jsx` | Cron secret header; restrict browser refresh |
| **H-EF-02** | `parasut-dispatch` `ping` — no `requireRole` | [04](./04-edge-functions-audit.md) | `handlers/ping.ts`; `index.ts` L66–68 | Admin/accountant only or remove |
| **H-EF-03** | Paraşüt handlers return full API payloads | [04](./04-edge-functions-audit.md) | `parasut-dispatch/index.ts`, handlers | Minimal DTOs to client |
| **H-EF-04** | `extend-subscription-payments` logs/returns row payloads | [04](./04-edge-functions-audit.md) | `extend-subscription-payments/index.ts` L46–60 | Count-only logging/response |

### Frontend Exposure

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-FE-01** | Customer detail fetches subscriptions/SIM with pricing without `canWrite` | [05](./05-frontend-exposure-audit.md), [09](./09-react-query-audit.md) | `CustomerDetailPage.jsx` L166–170; `subscriptions/api.js` L187–192; `simCards/api.js` L226–236 | `enabled: canWrite` or role-based selects |
| **H-FE-02** | `ParasutInvoicePanel` on WO detail without `canWrite` | [05](./05-frontend-exposure-audit.md) | `WorkOrderDetailPage.jsx` L391–393 | `canWrite` + `enabled` on hooks |
| **H-FE-03** | Finance `select('*')` on ledger and Tahsilat | [05](./05-frontend-exposure-audit.md) | `finance/api.js` L75, L912, L931 | Column allowlists |
| **H-FE-04** | `updateWorkOrder` debug `console.log` full payload | [05](./05-frontend-exposure-audit.md) | `workOrders/api.js` L366–373, L382 | Remove or DEV-only |
| **H-FE-05** | Action board queries run before admin UI gate | [05](./05-frontend-exposure-audit.md) | `ActionBoardPage.jsx` L200–211; `actionBoard/api.js` L34–53 | `enabled: isAdmin` |

### Database Performance (RLS + indexes)

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-DB-01** | `work_order_materials` correlated `EXISTS` per row | [06](./06-rls-performance-audit.md) | `00010_work_order_materials.sql` L27–88 | Policy rewrite; `wo.deleted_at` in EXISTS; initplan role |
| **H-DB-02** | Per-row `get_my_role()` on FT / subscription_payments | [06](./06-rls-performance-audit.md) | `00116`, `00125`, `00212` | `(SELECT get_my_role())` initplan pattern |
| **H-DB-03** | Missing `(status, payment_month)` on `subscription_payments` | [07](./07-index-audit.md) | `00016` L210–212; `collectionApi.js` L47–116 | Partial composite index migration |
| **H-DB-04** | Missing `payment_status` index on `financial_transactions` | [07](./07-index-audit.md), [08](./08-view-rpc-performance-audit.md) | `00207`/`00212`; `finance/api.js` L847–860 | Partial index on income + payment_status |
| **H-DB-05** | Duplicate GIN on `work_orders.assigned_to` | [07](./07-index-audit.md) | `00009` vs `00100` | Drop redundant index after verify |
| **H-DB-06** | `subscriptions_detail` per-row overdue `EXISTS` | [08](./08-view-rpc-performance-audit.md) | `00143` L350–355; `subscriptions/api.js` L93–95 | Denormalize flag or materialized helper |

### React Query

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-RQ-01** | No `enabled: canWrite` on restricted queries app-wide | [09](./09-react-query-audit.md), [05](./05-frontend-exposure-audit.md) | Dashboard, finance hooks | Shared `useFinanceQueriesEnabled()` |
| **H-RQ-02** | Shared `['collection']` key — Desk + Tahsilat | [09](./09-react-query-audit.md) | `finance/api.js` L905+; `collectionApi.js` L5+ | Split key namespaces |
| **H-RQ-03** | Broad invalidation of `profitAndLossKeys.all`, `financeDashboardKeys.all` | [09](./09-react-query-audit.md) | `finance/hooks.js`, `workOrders/hooks.js` | Scoped invalidation by period |
| **H-RQ-04** | `useTransactions` without default limit | [09](./09-react-query-audit.md) | `IncomePage.jsx` L97–105; `finance/hooks.js` L22–26 | Pagination / default limit |
| **H-RQ-05** | Customer detail — six parallel queries on mount | [09](./09-react-query-audit.md) | `CustomerDetailPage.jsx` L166–185 | Tab-scoped `enabled` |

### Bundle

| ID | Title | Source | File path(s) | Proposed fix |
|----|-------|--------|--------------|--------------|
| **H-BND-01** | ~44 eager routes; proposals pull `@react-pdf` | [10](./10-bundle-performance-audit.md) | `App.jsx` L26–80; `ProposalDetailPage.jsx` L14 | `React.lazy` per module |
| **H-BND-02** | `KpiCard` imports `recharts` on dashboard `/` | [10](./10-bundle-performance-audit.md) | `components/ui/KpiCard.jsx` L4–9; `DashboardPage.jsx` | Lazy sparkline or CSS-only KPIs |
| **H-BND-03** | List pages static `import * as XLSX` | [10](./10-bundle-performance-audit.md) | `CustomersListPage.jsx`, `SimCardsListPage.jsx` | Dynamic import on export |
| **H-BND-04** | `OperationsBoardPage` imports calendar + insights at top level | [10](./10-bundle-performance-audit.md) | `OperationsBoardPage.jsx` L8–9 | Lazy tab components |
| **H-BND-05** | `chunkSizeWarningLimit: 2000` masks regressions | [10](./10-bundle-performance-audit.md) | `vite.config.js` L74 | Lower to 500 after splits |
| **H-BND-06** | PWA precache ~6.9 MB | [10](./10-bundle-performance-audit.md) | `vite.config.js` L43–47 | Precache shell only; runtime-cache feature chunks |

---

## 5. Fix Priority Roadmap

### Phase A — Must fix before production data

| # | Finding | Source | Affected files | Migration? | Impl. risk | Owner / action |
|---|---------|--------|----------------|------------|------------|----------------|
| A1 | Tahsilat view `security_invoker` (C-01) | 01, 03, 05, 08 | `00213`, `00214`; finance API | **Yes** | Low — verify 0 rows for field_worker | **DB Agent** — migration + staging test |
| A2 | RPC role guards: `get_monthly_revenue_expense`, `get_subscription_stats`, overdue RPCs (C-02, H-RPC-05) | 02, 03, 05 | `00128`, `00129`, `00169`, … | **Yes** | Medium — regression on dashboard | **DB Agent** + **API** smoke tests |
| A3 | Revoke `fn_generate_recurring_expenses` from `authenticated` (C-03) | 02, 03 | `00070`; recurring hooks | **Yes** | Medium — cron path must work | **DB Agent** + verify pg_cron |
| A4 | Dashboard `enabled: canWrite` + split widgets (C-04) | 03, 05, 09 | `DashboardPage.jsx`, dashboard hooks | No | Low | **UI/API Agent** |
| A5 | `extend-subscription-payments` auth (C-05) | 04 | Edge function + `config.toml` | No (deploy config) | Medium — cron breakage if wrong | **Auth/Edge Agent** + Supabase Dashboard |
| A6 | `parasut-reconcile` lockdown (C-06) | 04 | Edge + `config.toml` | No | Medium | **Auth/Edge Agent** |
| A7 | WO/proposal completion RPC guards (H-RPC-01, H-RPC-02) | 02, 03 | `00208`, `00211` | **Yes** | High — field completion flows | **DB Agent** + WO/proposal QA |
| A8 | `fetch-tcmb-rates` cron secret (H-EF-01) | 04, 05 | Edge function | No | Medium | **Edge Agent** |
| A9 | TRY proposal completion via RPC (H-FIN-01) | 03 | `ProposalDetailPage.jsx`, RPC | Optional DB | Medium | **UI + DB Agent** |

### Phase B — Should fix before customer rollout

| # | Finding | Source | Affected files | Migration? | Impl. risk | Owner / action |
|---|---------|--------|----------------|------------|------------|----------------|
| B1 | Subscription bulk RPC guards (H-RPC-03, H-RPC-04) | 02 | `00137`, `00148`, `00151` | **Yes** | Medium | **DB Agent** |
| B2 | `operations_items` / `plan_items` SELECT RLS (H-RLS-01/02) | 01 | `00160`, `00174` | **Yes** | Medium — ops visibility | **DB Agent** + product confirm |
| B3 | Customer/SIM/WO exposure gates (H-FE-01, H-FE-02, H-FE-03) | 05, 09 | Customer/WO/finance API | No | Low–medium | **UI/API Agent** |
| B4 | `search_work_history` LIMIT + `enabled` (C-07) | 08, 09 | `00221`, work history hooks | **Yes** + app | Medium | **DB + UI Agent** |
| B5 | Tahsilat view rewrite + pagination (C-08, H-FIN-04) | 08, 09 | `00213`/`00214`, Tahsilat page | **Yes** | High — finance UI | **DB Agent** + **API Agent** |
| B6 | Index: `subscription_payments`, `payment_status` (H-DB-03, H-DB-04) | 07, 08 | New migration | **Yes** | Low–medium write cost | **DB Agent** — EXPLAIN first |
| B7 | Split collection React Query keys (H-RQ-02) | 09 | `finance/api.js`, `collectionApi.js` | No | Low | **API Agent** |
| B8 | Remove WO `console.log` (H-FE-04) | 05 | `workOrders/api.js` | No | Trivial | **Fixer Agent** |
| B9 | `parasut-dispatch` ping + response minimization (H-EF-02, H-EF-03) | 04 | Edge handlers | No | Low | **Edge Agent** |
| B10 | `soft_delete_transaction` stale roles (02 MED) | 02 | `00107` | **Yes** | Low | **DB Agent** |
| B11 | Route lazy-load finance + proposals (H-BND-01) | 10 | `App.jsx` | No | Medium — loading states | **UI Agent** |

### Phase C — Performance improvements after launch

| # | Finding | Source | Affected files | Migration? | Impl. risk | Owner / action |
|---|---------|--------|----------------|------------|------------|----------------|
| C1 | RLS initplan + `work_order_materials` policy (H-DB-01, H-DB-02) | 06 | Policies in new migration | **Yes** | High — policy testing | **DB Agent** + EXPLAIN |
| C2 | `v_profit_and_loss` period defaults (H-FIN-03) | 08 | `finance/hooks.js`, reports | No | Low | **API Agent** |
| C3 | `subscriptions_detail` overdue denorm (H-DB-06) | 08 | View or `subscriptions` column | **Yes** | Medium | **DB Agent** |
| C4 | Dynamic XLSX + lazy charts (H-BND-02, H-BND-03) | 10 | List pages, KpiCard | No | Low | **UI Agent** |
| C5 | Lazy operations tabs (H-BND-04) | 10 | `OperationsBoardPage.jsx` | No | Low | **UI Agent** |
| C6 | Narrow finance invalidation (H-RQ-03) | 09 | Finance/WO hooks | No | Medium | **API Agent** |
| C7 | Customer detail tab-lazy queries (H-RQ-05) | 09 | `CustomerDetailPage.jsx` | No | Low | **UI Agent** |
| C8 | Drop duplicate indexes (H-DB-05) | 07 | Index migration | **Yes** | Medium — measure first | **DB Agent** |
| C9 | PWA precache tuning (H-BND-06) | 10 | `vite.config.js` | No | Medium | **Deploy Agent** |
| C10 | `work_orders_detail` list view split (08 HIGH-8) | 08 | View migration | **Yes** | Medium | **DB Agent** |

### Phase D — Optional / technical debt

| # | Finding | Source | Notes |
|---|---------|--------|-------|
| D1 | `payment_methods` SELECT admin-only vs accountant UI | 01 MED | Product decision |
| D2 | Paraşüt matching: accountant UI vs admin-only RLS | 01 MED | Product decision |
| D3 | `search_customer_sites` global list RPC | 02 MED | Accept or scope |
| D4 | `get_customer_work_history` legacy RPC | 02 MED | Drop or rewrite |
| D5 | CORS `*` on edge functions | 04 MED | Harden when origin list fixed |
| D6 | Materialized views for Tahsilat / monthly P&L | 08 | After C-08 stable |
| D7 | `chunkSizeWarningLimit` documentation | 10 | After bundle split |
| D8 | React Query keys include `role` on logout | 05 MED | Shared-device edge case |
| D9 | Sentry async init | 10 MED | Minor TTI win |

---

## 6. Conflicts or Overlaps

### Repeated across multiple reports (same root cause)

| Theme | Reports | Safer single fix |
|-------|---------|------------------|
| Tahsilat view leak | 01, 03, 05, 08 | **C-01 migration first** — app `select('*')` alone is insufficient |
| Dashboard finance for `field_worker` | 03, 05, 09, 10 | **Server RPC guards (A2) + client `enabled: canWrite` (A4)** — defense in depth |
| `get_monthly_revenue_expense` / stats RPCs | 02, 03, 05, 08, 09 | **DB role guard** beats UI-only hide |
| Collection / Tahsilat performance | 07, 08, 09 | **View rewrite (B5) + indexes (B6)** — indexes alone do not fix correlated subqueries |
| Heavy initial load | 09, 10 | **Lazy routes (B11)** reduces both bytes and accidental finance module load |

### Conflicting or nuanced recommendations

| Topic | Report A | Report B | **Safer choice** |
|-------|----------|----------|------------------|
| `field_worker` WO completion | 02 wants strict admin/accountant OR assigned | Product may want technicians to complete own jobs | **Allow `field_worker` only when `auth.uid() = ANY(assigned_to)`** — not open UUID completion (H-RPC-01) |
| `customers` readable by all roles | 01 intentional for installers | 05 wants less pricing exposure | **Keep customer read RLS**; **gate subscription/SIM pricing in app** (H-FE-01) — do not block customer name/site for field workers without product sign-off |
| `fetch-tcmb-rates` `verify_jwt = false` | 04 needs cron secret | 05 field_worker can click refresh | **Cron secret required**; **hide manual refresh** unless `canWrite` — do not re-enable JWT for anonymous cron without secret |
| `complete_proposal_with_rate` for TRY | 03 wants all via RPC | TRY path uses direct UPDATE today | **Use RPC for all currencies** (H-FIN-01) — aligns with CLAUDE.md |
| Lower `chunkSizeWarningLimit` before lazy routes | 10 suggests 500 after split | Immediate 500 would fail CI | **Lower limit only after B11** (Phase B/C) — document interim 2000 kB debt |

**No report recommended disabling RLS for performance** — Phase 6 and 7 agree: fix policies/indexes, not bypass RLS.

---

## 7. Do-Not-Touch List (Yet)

| Item | Why wait |
|------|----------|
| **Broad finance schema / RLS rewrites** beyond targeted migrations | High regression risk; needs staged rollout |
| **Materialized views** for Tahsilat or P&L | Requires refresh strategy and APPROVE; Phase D |
| **Dropping `subscription_payments` from ops** | CLAUDE.md: still used for Collection Desk — not ledger for P&L |
| **Removing Paraşüt integration** | Active project (`00215`–`00218`); fix auth/minimization only |
| **`payment_methods` RLS expansion** | Needs product call: deprecated vs accountant read (01 MED) |
| **Paraşüt matching accountant access** | Admin-only DB vs `RoleRoute` accountant UI — business decision |
| **Index drops** (`assigned_to` duplicate GIN, legacy FT indexes) | Run **EXPLAIN** on production-like data first (07) |
| **TypeScript migration** | Out of project scope per AGENTS.md |
| **Dependency upgrades** (Vite, React, pdfjs) | Not audit remediation; separate change control |
| **00221–00223 already shipped optimizations** | Do not revert; build on filter-in-RPC pattern |
| **Live `pg_policies` / production data fixes** | Audits are migration-source-based; **verify in Supabase Dashboard** before go-live |

### Requires Supabase Dashboard / ops verification

- Effective `verify_jwt` for **`extend-subscription-payments`** (not in repo `config.toml`)
- Whether **`complete_proposal_with_rate`** has implicit `GRANT EXECUTE` in deployed DB (02 MED)
- pg_cron jobs: TCMB fetch, recurring expenses, SIM finance, subscription extend
- Paraşüt OAuth row and edge secrets present only in project secrets (not repo)

### Requires manual product / business decision

- Should **field_worker** see **any** subscription pricing on customer pages?
- Should **operations** data ever be visible to technicians?
- Is **tax_number** on customer detail acceptable for field installers?
- Accountant access to **Paraşüt matching** vs admin-only RLS

---

## 8. Final Go-Live Checklist

Use after Phase A (minimum) fixes are implemented and deployed to staging.

| Check | Target | Verification |
|-------|--------|--------------|
| **RLS safe** | Core tables deny `field_worker` finance/subscription writes | Staging JWT tests per role on FT, SP, subscriptions, proposals, SIM |
| **Tahsilat views safe** | `field_worker` gets **0 rows** on `v_collection_*` | Post C-01 migration + `select` from app |
| **SECURITY DEFINER safe** | Finance/subscription RPCs reject `field_worker` | Call RPCs with field_worker token; expect error |
| **Finance access safe** | Dashboard + charts gated; completion paths guarded | Manual login as field_worker; no MRR/net profit in network tab |
| **Edge functions safe** | No anonymous reconcile/extend; TCMB cron secret | curl tests without secret fail; cron still succeeds |
| **Sensitive frontend exposure checked** | No finance aggregates in RQ cache for field_worker | DevTools + React Query devtools after A4 |
| **Migrations reviewed** | Only approved migrations applied | Peer review + `supabase db diff` / migration list |
| **Build passes** | `npm run build` clean | CI / local build; review chunk sizes vs Phase 10 baseline |
| **Manual smoke tests done** | Role matrix | Admin: finance, Tahsilat, proposal PDF, WO complete. Accountant: same minus admin-only Paraşüt match. Field: WO, customers, daily work — **no** finance routes/data |

### Recommended smoke paths (minimum)

1. `/` dashboard as **field_worker** — no finance KPIs or chart data.  
2. `/finance/collections` as **accountant** — loads; **field_worker** blocked at route and API.  
3. Complete standalone WO with payment — assigned field worker only.  
4. Complete USD proposal via rate modal — RPC only.  
5. Invoke `get_monthly_revenue_expense` as field_worker — **denied**.  
6. POST `extend-subscription-payments` without cron secret — **denied**.

---

## Appendix — Per-Phase Verdicts

| Phase | Security / access verdict | Performance verdict |
|-------|---------------------------|---------------------|
| 01 RLS | CONDITIONAL PASS | — |
| 02 RPC | FAIL (production finance) | — |
| 03 Finance | FAIL (production finance) | — |
| 04 Edge | FAIL (production) | — |
| 05 Frontend | FAIL (production) | — |
| 06 RLS perf | — | CONDITIONAL PASS |
| 07 Index | — | CONDITIONAL PASS |
| 08 View/RPC | — | CONDITIONAL PASS (pre-scale blockers) |
| 09 React Query | FAIL (role fetch boundaries) | CONDITIONAL PASS (globals) |
| 10 Bundle | Exposure via preload | FAIL (slow networks) |

---

## Recommended First Fix Phase

**Start with Phase A (items A1–A4 + A5–A6):**

1. **A1** — Tahsilat `security_invoker` migration (unblocks honest finance confidentiality).  
2. **A2** — RPC role guards for dashboard finance/subscription stats.  
3. **A4** — Dashboard client `enabled: canWrite` (immediate UX alignment).  
4. **A5–A6** — Edge function auth for extend + reconcile.

Then **A7** (completion RPC guards) before inviting broad field-worker production use.

**Do not load real company ledger or multi-year billing history** until A1, A2, A3, and B6 (indexes) are addressed.

---

*Generated from audit reports 01–10 only. No application code or migrations were modified in producing this summary.*
