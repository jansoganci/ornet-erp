# Phase 5 — Frontend Data Exposure Audit Report

> **Date:** 2026-05-31  
> **Scope:** Client-side over-fetching, debug logging, role-gated UI vs fetch timing, React Query cache keys, `VITE_*` exposure  
> **Method:** Static review of `src/App.jsx`, `src/lib/roles.js`, all `src/features/**/api.js` and `hooks.js`, dashboard/customer/work-order/finance surfaces  
> **Prior reports:** [01-rls-audit.md](./01-rls-audit.md), [02-security-definer-rpc-audit.md](./02-security-definer-rpc-audit.md), [03-finance-access-audit.md](./03-finance-access-audit.md), [04-edge-functions-audit.md](./04-edge-functions-audit.md)  
> **Status:** Audit only — no code changes

---

## Executive Summary

**`RoleRoute` only blocks rendering and navigation** — it does not stop React Query from firing on other routes. The **dashboard (`/`)** is available to every authenticated role and **unconditionally fetches** subscription MRR, uncollected totals, net profit KPIs, a **7-month revenue/expense series**, and **overdue subscription payment rows**. Those calls use **SECURITY DEFINER RPCs** or views documented in Phases 2–3 as **unguarded**, so **`field_worker` browsers can hold finance aggregates in memory and DevTools** even when finance nav is hidden.

**UI gating is inconsistent:** `CustomerDetailPage` hides finance cards for `field_worker` (`canWrite` L865–958) but still **runs** `useCustomerSubscriptions` and shows **subscription subtotals** in the profile column when RLS allows (L773–858). **`ParasutInvoicePanel`** on **`WorkOrderDetailPage`** mounts for completed standalone WOs **without** `canWrite`, triggering `financial_transactions` queries with tax/Paraşüt columns.

**Positive patterns:** `CUSTOMER_LIST_SELECT` and `SUBSCRIPTION_LIST_SELECT` narrow list columns; `usePendingPaymentInsights` and `usePaymentMethods` use `enabled` tied to `canWrite`; `getErrorMessage` maps common Postgres codes; **no Paraşüt OAuth secrets** in `VITE_*` (`.env.example` L11–19). **`console.log` of full payment/ledger objects** is limited to one work-order debug path.

**Overall verdict:** **FAIL for production** until dashboard and cross-role hooks are gated, Tahsilat view invoker is fixed (Phase 1), RPC role guards land (Phase 2), and Paraşüt/finance selects are minimized.

---

## Role Model & Route Guards (Reference)

| Mechanism | Location | Effect |
|-----------|----------|--------|
| `canWrite` | `src/lib/roles.js` L18 | `admin` \|\| `accountant` |
| `RoleRoute` | `src/App.jsx` L18–22 | Redirect non-`canWrite` to `/work-orders` for wrapped routes |
| **No `RoleRoute`** | `src/App.jsx` L105 | **`DashboardPage`** — all authenticated roles |
| Nav filter | `src/components/layout/navItems.js` L49–52, L80+ | Hides finance/subscription links; **not a fetch guard** |

**Answer:** UI guards **prevent rendering** on many pages; they **do not prevent fetching** unless hooks use `enabled: canWrite` (rare — see below).

---

## `select('*')` on Sensitive Surfaces

| File | Line(s) | Table / view | Sensitive columns at risk | Route / role |
|------|---------|--------------|---------------------------|--------------|
| `finance/api.js` | 912 | `v_collection_customer_summary` | `total_billed`, `collected`, `total_profit`, COGS-style fields | Tahsilat (`RoleRoute`); **+ definer leak** |
| `finance/api.js` | 931 | `v_collection_documents` | Per-doc margin, VAT, collected, `customer_name` | Same |
| `finance/api.js` | 75, 129 | `financial_transactions` | `TRANSACTION_SELECT` = `*` + joins (all FT + `parasut_*`) | Finance pages |
| `finance/parasutApi.js` | 17–36, 47, 61 | `financial_transactions` | `*`, `tax_number`, `parasut_contact_id` | Finance + WO panel |
| `subscriptions/api.js` | 189, 246, 316 | `subscriptions_detail` | Pricing, `cost`, `vat_rate`, margins | Subscriptions; **customer detail L189** |
| `customers/api.js` | 61, 135, 145 | `customers`, `audit_logs` | `tax_number`, `parasut_contact_id`, audit payloads | Customer detail (tax intentional) |
| `simCards/api.js` | 229–236, 342–347 | `sim_cards` | `cost_price`, `sale_price`, phone | Customer detail; SIM module |
| `proposals/api.js` | 151 | `proposal_annual_fixed_costs` | Cost rows | Proposals (`RoleRoute`) |
| `materials/api.js` | 64 | `materials` | Cost fields | Materials (all auth read) |
| `operations/planItemsApi.js` | 12–90 | `plan_items` / ops tables | Ops data | Operations (`RoleRoute`) |
| `notifications/api.js` | 9, 32, 92 | `notifications` | Payload JSON | All auth |
| `customerSites/api.js` | 22 | `customer_sites` | Site PII | Customers |
| `siteAssets/api.js` | 95, 130 | Site assets | Asset metadata | Equipment |

**Explicit column lists (good):** `CUSTOMER_LIST_SELECT` (`customers/api.js` L7–10), `SUBSCRIPTION_LIST_SELECT` (L43–49), narrowed `v_profit_and_loss` / P&L queries in `finance/api.js` L491+.

---

## `console.log` / Debug Logging

| Risk | File | Line(s) | Data exposed | Who triggers |
|------|------|---------|--------------|--------------|
| **HIGH** | `workOrders/api.js` | 366–373, 382 | Full `updateWorkOrder` payload (`vat_rate`, `scheduled_date`, entire `updatePayload`) and DB result | Any user saving a work order |
| LOW | `proposals/ProposalDetailPage.jsx` | 218, 253 | Export errors only | Accountant route |
| LOW | `materials/MaterialImportPage.jsx` | 72, 82 | Parse/file errors | Materials import |
| LOW | `ErrorBoundary.jsx` | 18 | Error message | Global |

**No** `console.log` of Paraşüt tokens, OAuth, or full Tahsilat ledgers found in `src/`.

---

## `VITE_*` Environment Variables

| Variable | Exposure | Assessment |
|----------|----------|------------|
| `VITE_SUPABASE_URL` | Bundled | Expected |
| `VITE_SUPABASE_ANON_KEY` | Bundled | Expected (RLS boundary) |
| `VITE_SENTRY_DSN` | Bundled | Public DSN — expected |
| `VITE_PARASUT_ENABLED` | Bundled | Feature flag only — **not** secrets |

`.env.example` L11–19 documents Paraşüt credentials as **Supabase Edge secrets**, not `VITE_*`. **No service role or Paraşüt client secret** in frontend env grep.

---

## React Query Cache Keys (Role Mixing)

| Key factory | Example | Includes role? | Risk |
|-------------|---------|----------------|------|
| `financeDashboardKeys` | `['financeDashboard','kpis', period, viewMode]` | **No** | field_worker + accountant on same browser profile share cached KPIs until stale |
| `subscriptionKeys.stats` | `['subscriptions','stats']` | **No** | MRR/unpaid totals cached across roles |
| `dashboardKeys.revenue` | `['dashboard','revenue', months]` | **No** | Monthly P&L series |
| `parasutFinanceKeys` | `['parasutFinance', 'workOrder', id]` | **No** | Invoice rows if ever loaded |
| `currentProfile` | `['currentProfile']` | User-specific via API | OK |
| `collectionKeys` | `['collection','summaries', filters]` | **No** | Tahsilat aggregates |

**Proposed fix:** Prefix query keys with `profile?.role` or `canWrite`, and `invalidateQueries` on logout / role change.

---

## Supabase Error Surfacing

| Pattern | File | Line(s) | Issue |
|---------|------|---------|-------|
| `getErrorMessage` fallback | `lib/errorHandler.js` | 80–81 | Returns raw `error.message` for unmapped codes → possible SQL fragment in toast |
| Direct `error.message` | `finance/parasutHooks.js` | 56 | Paraşüt/HTTP errors verbatim |
| Direct `error.message` | `finance/components/TahsilatModal.jsx` | 66, 92 | Tahsilat mutations |
| Direct `error.message` | `finance/components/ParasutPaymentsList.jsx` | 28 | Payment sync |
| Direct `error.message` | `customers/parasutMatchingHooks.js` | 35, 50, 64, 78 | Matching |
| `err.message` + code | `workOrders/WorkOrderFormPage.jsx` | 314–315 | May append `err.code`; message can be PostgREST detail |

Mapped codes (23505, 23502, 403, 401) are handled safely (L20–78).

---

## Non-RoleRoute Pages That Fetch Restricted Data

### Dashboard (`src/pages/DashboardPage.jsx`) — **CRITICAL cluster**

| Hook / query | API | Data in browser | `field_worker` |
|--------------|-----|-----------------|----------------|
| `useSubscriptionStats()` L40 | `get_subscription_stats` | MRR, active count, unpaid total | **Fetched** (no `enabled`) |
| `useQuery` finance KPIs L42–45 | `fetchFinanceDashboardKpis` → `get_subscription_stats` + `v_profit_and_loss` | Net profit, margins, VAT payable | **Fetched** |
| `RevenueExpenseLineChart` | `useMonthlyRevenue(7)` → `get_monthly_revenue_expense` | 7 months revenue + expense | **Fetched** |
| `OverduePaymentsList` | `get_overdue_subscription_payments` | Company, site, amount, overdue days | **Fetched** |
| `CurrencyWidget` | `useLatestRate` + `useFetchTcmbRates` | Exchange rates; **edge invoke** (Phase 4) | Rates read OK; **can trigger TCMB edge** |

KPI cards L133–178 render values for all roles; links point to `/subscriptions` and `/finance` (redirect for field_worker).

### Customer detail (`CustomerDetailPage.jsx`) — open to all auth

| Hook | Line | `enabled` / UI gate | Data |
|------|------|---------------------|------|
| `useCustomer(id)` | 166 | Always | `customers.*` incl. `tax_number`, `parasut_contact_id` |
| `useCustomerSubscriptions(id)` | 170 | **Always** | `subscriptions_detail.select('*')` — pricing, cost |
| `usePendingPaymentInsights(..., canWrite)` | 179 | **Gated** | Overdue totals |
| `usePaymentMethods(canWrite ? id : null)` | 172 | **Gated** | Card last4 |
| `useSimCardsByCustomer(id)` | 169 | Always | `sim_cards.*` incl. cost/sale |
| Financial cards | 865+ | **UI: `canWrite` only** | Hidden for field_worker |
| Subscription column | 773–858 | **Rendered for all roles** | Shows `sub.subtotal` when data returned |

If subscription RLS holds, query fails/empty; **any RLS regression immediately exposes pricing in UI**.

### Work order detail (`WorkOrderDetailPage.jsx`)

| Component | Line | Gate | Fetch |
|-----------|------|------|-------|
| `ParasutInvoicePanel` | 391–393 | **Only** `isStandalone && completed` | `useWorkOrderParasutTransactions` — no `canWrite` |

### Action board (`ActionBoardPage.jsx`)

| Behavior | Line | Issue |
|----------|------|-------|
| `useActionBoardData()` | 200 | Runs **before** admin check L211 |
| Admin gate | 211–227 | UI blocked for non-admin |

Non-admin users still trigger `fetchOverduePayments` → direct `subscription_payments` SELECT (`actionBoard/api.js` L34–53) on mount — **wasted request**; data only if RLS fails.

### App layout (`AppLayout.jsx`)

| Item | Gate | Note |
|------|------|------|
| `QuickEntryModal` | Keyboard/sheet: `hasFinanceAccess` L82, L293 | Modal mounted L304; field_worker cannot open via UX |
| `NotificationBell` | `hasNotificationAccess = canWrite` L30 | OK |

---

## Finance / Paraşüt Over-Fetch (RoleRoute pages)

| Area | File | Issue |
|------|------|-------|
| Ledger list | `finance/api.js` L75 | `TRANSACTION_SELECT` pulls all FT columns + relations |
| Paraşüt panel | `parasutApi.js` L16–36 | `select('*, customers(tax_number, …)')` without `deleted_at` |
| Tahsilat | `finance/api.js` L912, L931 | `select('*')` on collection views |
| Health card | `ParasutHealthCard.jsx` L10–11 | Status-only select — OK |

---

## Findings

### F5-CRIT-01 — Dashboard loads finance and subscription aggregates for `field_worker`

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** |
| **Files** | `src/pages/DashboardPage.jsx` L40–45, L133–178, L186, L205; `src/features/subscriptions/hooks.js` L329–333; `src/features/finance/api.js` L420–424 |
| **Data exposed** | MRR, uncollected subscription total, **net profit**, revenue/expense trend, overdue payment list (customer names + amounts) |
| **Role** | **`field_worker`** (and any authenticated user on `/`) |
| **Why risky** | Fetches run on mount with **no `canWrite` check**; RPCs bypass table RLS (Phase 2 F-CRIT-01/02, Phase 3 F-CRIT-02); data visible in UI and React Query cache / Network tab |
| **Proposed fix** | `enabled: canWrite` on all finance/subscription dashboard hooks; split `DashboardPage` by role; add RPC `get_my_role()` guards server-side |

---

### F5-CRIT-02 — Revenue/expense chart uses unguarded `get_monthly_revenue_expense`

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** |
| **Files** | `src/features/dashboard/components/RevenueExpenseLineChart.jsx` L15, L51; `src/features/dashboard/hooks.js` L34–38; `src/features/dashboard/api.js` L119 |
| **Data exposed** | Monthly company revenue and expense totals (7 months) |
| **Role** | **`field_worker`** via dashboard |
| **Why risky** | Direct read of `financial_transactions` inside definer RPC without role check (Phase 2) |
| **Proposed fix** | Same as F5-CRIT-01; or move chart behind `RoleRoute` finance dashboard only |

---

### F5-CRIT-03 — Tahsilat UI uses `select('*')` on definer collection views

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** (with Phase 1 view invoker gap) |
| **Files** | `src/features/finance/api.js` L912, L931; migrations `00213`, `00214` |
| **Data exposed** | Per-customer profit, billed/collected totals; per-document margin, COGS, VAT |
| **Role** | Intended admin/accountant; **`field_worker` if view runs as definer** or API invoked directly |
| **Why risky** | Frontend requests **all view columns**; maximizes leak surface if RLS not applied on view |
| **Proposed fix** | `security_invoker = true` on views; replace `select('*')` with explicit column list for Tahsilat grid |

---

### F5-HIGH-01 — `useCustomerSubscriptions` + subscription pricing UI without `canWrite` fetch gate

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/customers/CustomerDetailPage.jsx` L170, L773–858; `src/features/subscriptions/api.js` L187–192 |
| **Data exposed** | `subtotal`, `base_price`, `cost`, billing frequency, site names |
| **Role** | **`field_worker`** on `/customers/:id` |
| **Why risky** | Query always runs (`select('*')` on `subscriptions_detail`); profile column **renders prices** when rows exist |
| **Proposed fix** | `enabled: canWrite` on hook; field_worker-specific column without pricing; narrow `select` to non-financial columns |

---

### F5-HIGH-02 — `useSimCardsByCustomer` over-fetches SIM cost/sale on customer page

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/simCards/api.js` L226–236; `CustomerDetailPage.jsx` L169 |
| **Data exposed** | `cost_price`, `sale_price`, phone, operator fields |
| **Role** | **`field_worker`** (SIM tab hidden L978, but hook still runs) |
| **Why risky** | `select('*')` on `sim_cards`; SIM RLS denies field_worker (Phase 1) — defense relies on DB only |
| **Proposed fix** | `enabled: !isFieldWorker` or role-based column list; skip fetch when SIM tab unavailable |

---

### F5-HIGH-03 — `ParasutInvoicePanel` on work order detail without `canWrite`

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/workOrders/WorkOrderDetailPage.jsx` L391–393; `src/features/finance/components/ParasutInvoicePanel.jsx` L28–40; `src/features/finance/parasutApi.js` L56–64 |
| **Data exposed** | Income `financial_transactions.*`, customer `tax_number`, `parasut_*` sync fields |
| **Role** | **`field_worker`** on completed standalone WO |
| **Why risky** | Panel mounts when `VITE_PARASUT_ENABLED`; hooks lack `canWrite`; queries fire even if RLS returns empty |
| **Proposed fix** | Wrap panel with `canWrite`; add `enabled: canWrite` to `useWorkOrderParasutTransactions` |

---

### F5-HIGH-04 — Finance/Paraşüt APIs use `select('*')` on ledger rows

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/finance/api.js` L75; `src/features/finance/parasutApi.js` L16–36, L47, L61 |
| **Data exposed** | Full ledger row + Paraşüt metadata + tax identity |
| **Role** | admin/accountant (routes); over-fetch if role bypass |
| **Why risky** | Browser holds more than UI needs; DevTools/session compromise gets full row |
| **Proposed fix** | DTO selects per screen; add `.is('deleted_at', null)` on parasut FT queries |

---

### F5-HIGH-05 — `updateWorkOrder` debug `console.log` of full payload and result

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/workOrders/api.js` L366–373, L382 |
| **Data exposed** | WO financial fields, schedule, full DB row on update |
| **Role** | All roles editing work orders |
| **Why risky** | Persists in browser console and log aggregators if console captured |
| **Proposed fix** | Remove debug logs or guard with `import.meta.env.DEV` |

---

### F5-HIGH-06 — Raw Supabase messages shown in Paraşüt/Tahsilat toasts

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/finance/parasutHooks.js` L56; `TahsilatModal.jsx` L66, L92; `ParasutPaymentsList.jsx` L28; `parasutMatchingHooks.js` L35+ |
| **Data exposed** | Unfiltered `error.message` (may include constraint/detail text) |
| **Role** | admin/accountant |
| **Why risky** | Inconsistent with `getErrorMessage` used elsewhere |
| **Proposed fix** | Route all through `getErrorMessage`; never toast `error.details` / `hint` |

---

### F5-HIGH-07 — Action board hooks fetch subscription payments before admin UI gate

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Files** | `src/features/actionBoard/ActionBoardPage.jsx` L200–211; `src/features/actionBoard/hooks.js` L11–28; `src/features/actionBoard/api.js` L27–53 |
| **Data exposed** | Pending subscription payment amounts + customer/site names |
| **Role** | **Non-admin** still executes queries on page load |
| **Why risky** | UI-only admin gate; relies on RLS; unnecessary exposure surface |
| **Proposed fix** | `enabled: profile?.role === 'admin'` on `useActionBoardData`; or move route behind admin-only wrapper |

---

### F5-MED-01 — React Query keys omit role; cross-role cache reuse

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Files** | `src/features/finance/api.js` (key factories); `src/features/subscriptions/hooks.js` L44–54; `src/features/dashboard/hooks.js` L4–10 |
| **Data exposed** | Stale finance KPIs / MRR after role switch on shared device |
| **Role** | Any |
| **Proposed fix** | Include `role` in `queryKey`; clear cache on logout |

---

### F5-MED-02 — `CurrencyWidget` on dashboard allows `field_worker` to invoke TCMB edge function

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Files** | `src/features/dashboard/components/CurrencyWidget.jsx` L15–16, L66–67; `src/features/finance/api.js` L311–316 |
| **Data exposed** | Not ledger; triggers public edge upsert (Phase 4) |
| **Role** | **`field_worker`** |
| **Proposed fix** | Hide refresh button unless `canWrite`; server-side cron-only TCMB |

---

### F5-MED-03 — `fetchCustomer` returns full customer row including Paraşüt/tax fields

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** (often by design) |
| **Files** | `src/features/customers/api.js` L58–64 |
| **Data exposed** | `tax_number`, `tax_office`, `parasut_contact_id`, `identity_type` |
| **Role** | All authenticated on customer pages |
| **Why risky** | field_worker sees tax ID in hero/overview; may be acceptable for installers |
| **Proposed fix** | Role-based `CUSTOMER_DETAIL_SELECT` omitting Paraşüt fields for field_worker |

---

### F5-MED-04 — `getErrorMessage` returns raw message for unknown errors

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Files** | `src/lib/errorHandler.js` L80–81 |
| **Data exposed** | Postgres/PostgREST text in toasts |
| **Role** | Any |
| **Proposed fix** | Default to generic `errors:common.unexpected`; log details to Sentry only |

---

### F5-LOW-01 — `select('*')` on low-sensitivity modules

| Field | Value |
|-------|-------|
| **Risk** | **LOW** |
| **Files** | `notifications/api.js`, `materials/api.js`, `customerSites/api.js`, `operations/planItemsApi.js` |
| **Data exposed** | Module-specific; mostly non-finance |
| **Proposed fix** | Narrow when touching those modules |

---

### F5-LOW-02 — `VITE_*` does not leak backend secrets

| Field | Value |
|-------|-------|
| **Risk** | **LOW** (positive) |
| **Files** | `.env.example`, `src/lib/supabase.js`, Paraşüt components |
| **Proposed fix** | Keep Paraşüt credentials in Edge secrets only; document in onboarding |

---

## Question Checklist (Phase 5 plan)

| # | Question | Result |
|---|----------|--------|
| 1 | `select('*')` on sensitive tables? | **Yes** — finance views, FT, subscriptions_detail, sim_cards, customers (detail) |
| 2 | `console.log` of finance/customer payloads? | **Yes** — `workOrders/api.js` update payload (HIGH) |
| 3 | Non-RoleRoute pages fetch finance/subscription data? | **Yes** — **Dashboard** (CRITICAL); customer detail partial |
| 4 | Explicit column lists on large tables? | **Partial** — customers/subscriptions lists yes; detail pages often `*` |
| 5 | `CustomerDetailPage` gates finance hooks with `canWrite`? | **Partial** — payment insights yes; subscriptions/SIM hooks **no** |
| 6 | Supabase errors with raw SQL/details? | **Sometimes** — `getErrorMessage` fallback + direct `error.message` toasts |
| 7 | `VITE_*` exposing secrets? | **No** |

---

## `field_worker` Summary

| Can reach finance/subscription/customer-private data in browser? | Path |
|----------------------------------------------------------------|------|
| **Yes — aggregates** | Dashboard KPIs, revenue chart, overdue list (RPC bypass) |
| **Yes — if RLS/view broken** | Tahsilat `select('*')` via direct client |
| **Attempt — likely blocked by RLS** | Customer subscriptions pricing, SIM costs, Paraşüt FT panel |
| **Yes — customer tax** | `fetchCustomer` `*` (business choice) |
| **Yes — exchange rates** | `CurrencyWidget` read + TCMB refresh button |

---

## Findings Count

| Severity | Count |
|----------|-------|
| **CRITICAL** | **3** |
| **HIGH** | **7** |
| **MEDIUM** | **4** |
| **LOW** | **2** |

---

## Files Needing Immediate Review

1. `src/pages/DashboardPage.jsx`
2. `src/features/dashboard/components/RevenueExpenseLineChart.jsx`
3. `src/features/dashboard/components/OverduePaymentsList.jsx`
4. `src/features/subscriptions/hooks.js` (`useSubscriptionStats`, `useCustomerSubscriptions`)
5. `src/features/finance/api.js` (`fetchFinanceDashboardKpis`, Tahsilat `select('*')`, `TRANSACTION_SELECT`)
6. `src/features/customers/CustomerDetailPage.jsx`
7. `src/features/workOrders/WorkOrderDetailPage.jsx` + `src/features/finance/parasutApi.js`
8. `src/features/workOrders/api.js` (debug logging)

---

## Recommended Next Actions

1. **After APPROVE:** Gate dashboard and customer-detail hooks with `enabled: canWrite` (or role-specific dashboards); remove work-order `console.log`; narrow Tahsilat/Parasut selects.  
2. **Coordinate with Phases 1–2:** Fix Tahsilat `security_invoker` and RPC role guards — frontend gating alone is insufficient.  
3. **Phase 6:** RLS performance (separate).  
4. **Phase 9:** Query optimization can align column lists with performance work.

---

## Overall Verdict

**FAIL for production**

The frontend **fetches sensitive aggregates for `field_worker` on the home dashboard** without waiting for `canWrite`, and **relies on route redirects** instead of **`enabled` guards** on hooks. Combined with **unguarded RPCs** and **Tahsilat view invoker** issues from earlier phases, company financial data can reach the browser even when finance UI is hidden.
