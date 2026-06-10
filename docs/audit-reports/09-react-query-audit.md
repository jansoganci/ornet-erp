# Phase 9 — Frontend Query / React Query Audit Report

> **Date:** 2026-05-31  
> **Scope:** TanStack Query usage in `src/features/**/hooks.js`, `api.js`, `src/app/providers.jsx`, `src/app/AppLayout.jsx`, `src/pages/DashboardPage.jsx`, and layout shells  
> **Method:** Static review of query keys, `enabled` guards, pagination, invalidation, and mount-time fetch graphs — cross-referenced with Phases 5 (exposure), 8 (view/RPC cost), and `00221`–`00223` app alignment  
> **Status:** Audit only — no hook or API changes

---

## Executive Summary

Global React Query defaults are **sensible for an ERP** (`staleTime` 5 minutes, `refetchOnWindowFocus: false` in `providers.jsx`). Most feature modules use **stable key factories** and **pagination** on primary list pages (work orders, subscriptions, SIM cards, proposals).

**Critical gaps:** The **home dashboard (`/`)** mounts **subscription stats**, **finance dashboard KPIs** (P&L summary + duplicate `get_subscription_stats` RPC), **monthly revenue RPC**, and **overdue payments** with **no `enabled: canWrite`** — so **`field_worker` sessions still fetch restricted aggregates** (Phase 5 exposure; Phase 8 cost). **Work history** runs `search_work_history` on **every mount** (`enabled: true`) even with **empty search** and **no date bound**, matching Phase 8 unbounded RPC risk.

**Invalidation:** Finance and work-order mutations routinely invalidate **`profitAndLossKeys.all`**, **`financeDashboardKeys.all`**, and **`subscriptionKeys.all`**, causing **broad refetches** across unrelated screens. **Two different features share the root key `['collection']`** (Subscription Collection Desk vs Tahsilat), so **`invalidateQueries({ queryKey: collectionKeys.all })` affects both**.

**Positive:** `useCurrentProfile` dedupes across layout/`useRole` via `['currentProfile']`; `useFinanceHealthCheckRecords` uses `enabled: false` by default; `useCollectionDocuments` requires `customer_id`; `usePendingPaymentInsights` / `usePaymentMethods` gate on `canWrite`; work-history **RPC params** match **00221** (filters in SQL, not client-side).

**Overall verdict:** **FAIL for production** on role-gated fetch boundaries; **CONDITIONAL PASS** on global cache tuning and list pagination patterns once dashboard/work-history guards land.

| Severity | Count |
|----------|-------|
| **CRITICAL** | **3** |
| **HIGH** | **8** |
| **MEDIUM** | **10** |
| **LOW** | **6** |

---

## Global Query Client Defaults

| Setting | Location | Value | Assessment |
|---------|----------|-------|------------|
| `staleTime` | `src/app/providers.jsx` L8 | 5 min | Good default for ERP |
| `gcTime` | L9 | 10 min | Adequate |
| `refetchOnWindowFocus` | L10 | **false** | **Mitigates** Phase 8 heavy-query refetch risk |
| `retry` | L11 | 1 | Reasonable |

Per-hook overrides: exchange rates / finance health / notifications use shorter `staleTime` where appropriate.

---

## Module Query Map (Summary)

| Module | Key factory | Pagination | Role `enabled` | Notes |
|--------|-------------|------------|----------------|-------|
| `dashboard/hooks.js` | `dashboardKeys.*` | RPC limits (20 overdue) | **None** | Mounted on `/` for all roles |
| `finance/hooks.js` | `transactionKeys`, `profitAndLossKeys`, `financeDashboardKeys`, `collectionKeys` (Tahsilat) | Receivables 200; collection docs 500 | **None** on queries | Broad invalidation on mutations |
| `finance/collectionHooks.js` | `collectionKeys` (Desk) | Desk API filters | **None** | **Same `['collection']` root as Tahsilat** |
| `subscriptions/hooks.js` | `subscriptionKeys` | Paginated list 50; list cap 200 | Partial (`paymentMethods`, `pendingInsights`) | `useSubscriptionStats` unguarded |
| `workOrders/hooks.js` | `workOrderKeys` | 50/page; list 150 | **None** | WO mutations invalidate finance keys |
| `workHistory/hooks.js` | `workHistoryKeys.search(filters)` | **None** | **None** | `enabled: true` always |
| `customers/hooks.js` | `customerKeys` | List search only | Audit logs `enabled: isAdmin` | Detail page **6+ parallel queries** |
| `simCards/hooks.js` | `simCardKeys` | Paginated 100; export 2500 | **None** | Aligns with 00223 view |
| `materials/hooks.js` | `materialKeys` | API-dependent | **None** | Import uses 00222 RPC |
| `operations/hooks.js` | `operationsItemKeys` | Stats RPC date range | **None** | `RoleRoute` only |
| `notifications/hooks.js` | `notificationKeys` | Page size 20 | Badge: `isSupabaseConfigured` | 60s poll on badge |
| `tasks/hooks.js` | `taskKeys` | — | **None** | `useProfiles` on work history page |
| `calendar/hooks.js` | `calendarKeys` | WO fetch limit 150 via API | `enabled: dateFrom && dateTo` | Good date guard |

---

## Detailed Findings

### CRITICAL-1 — Dashboard mounts finance + subscription aggregates without `enabled` guard

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **Files** | `src/pages/DashboardPage.jsx` L40–45, L186–205; `src/features/dashboard/components/RevenueExpenseLineChart.jsx` L15; `src/features/dashboard/components/OverduePaymentsList.jsx` L8 |
| **Hooks** | `useSubscriptionStats`, inline `useQuery` → `fetchFinanceDashboardKpis`, `useMonthlyRevenue`, `useOverduePayments` |
| **Current behavior** | On every visit to `/`, all authenticated roles fetch MRR, uncollected totals, net profit (via `v_profit_and_loss` summary + `get_subscription_stats`), 7-month revenue/expense RPC, and overdue payment rows. |
| **Why risky** | **Exposure:** Phase 2/3/5 — RPCs/views not role-guarded; data lands in React Query cache. **Performance:** Phase 8 — multiple heavy RPCs per home-page load. **No `RoleRoute`** on dashboard (`App.jsx`). |
| **Proposed fix** | `enabled: canWrite` (from `useRole()`) on finance-related queries; split dashboard KPIs for `field_worker` (WO/task-only). Optionally single combined dashboard RPC. |
| **Depends on** | [05-frontend-exposure-audit.md](./05-frontend-exposure-audit.md), [08-view-rpc-performance-audit.md](./08-view-rpc-performance-audit.md), Phase 2 RPC guards |

---

### CRITICAL-2 — `useSearchWorkHistory` always enabled; fires unbounded RPC on mount

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **Files** | `src/features/workHistory/hooks.js` L9–14; `src/features/workHistory/WorkHistoryPage.jsx` L67–73 |
| **Hook** | `useSearchWorkHistory` |
| **Current behavior** | `enabled: true` with default filters (`search: ''`, `datePreset: 'all'`) → RPC runs on page load without user action. |
| **Why risky** | Phase 8 — `search_work_history` has **no LIMIT**; returns full `work_orders_detail` rows. Debounced search still retriggers query; inline `filters` object may churn cache keys (see HIGH-3). |
| **Proposed fix** | `enabled: Boolean(debouncedSearch?.length >= 2 \|\| filters.siteId \|\| filters.dateFrom)`; require date window for empty search; add `staleTime` 60s+. |
| **Depends on** | [08-view-rpc-performance-audit.md](./08-view-rpc-performance-audit.md) CRITICAL-1; **00221** SQL filters are correct — guard is client-side only |

---

### CRITICAL-3 — Shared `['collection']` query-key namespace (Desk + Tahsilat)

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** (cache correctness + over-invalidation) |
| **Files** | `src/features/finance/api.js` L905–908; `src/features/finance/collectionApi.js` L5–10; `src/features/finance/hooks.js` L405–417; `src/features/finance/collectionHooks.js` L40; `src/features/finance/components/TahsilatModal.jsx` L44 |
| **Hooks** | `useCollectionSummaries`, `useCollectionDocuments`, `useCollectionPayments`, `useCollectionStats`, `useRecordPayment` / `useCollectionRecordPayment` |
| **Current behavior** | Both **Subscription Collection Desk** and **Tahsilat** use root `['collection']`. `invalidateQueries({ queryKey: collectionKeys.all })` from Tahsilat payment, desk payment, and `useRecordPayment` clears **all** collection caches. |
| **Why risky** | Unrelated screens refetch together; risk of **stale cross-feature data** if shapes differ; harder to tune `staleTime` per surface. |
| **Proposed fix** | Split keys: `['collectionDesk', …]` vs `['tahsilat', …]`; narrow invalidation to `summaries` / `documents` / `list` subtrees. |
| **Depends on** | Phase 8 Tahsilat view cost (invalidation amplifies refetch pain) |

---

### HIGH-1 — Duplicate `get_subscription_stats` on same dashboard load

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/pages/DashboardPage.jsx` L40, L42–45; `src/features/finance/api.js` L420–424 |
| **Hooks** | `useSubscriptionStats` + `fetchFinanceDashboardKpis` (internal `supabase.rpc('get_subscription_stats')`) |
| **Current behavior** | Two parallel calls to the same RPC on one page (different query keys: `subscriptionKeys.stats()` vs `finance_dashboard` KPI bundle). React Query **does not dedupe** different keys. |
| **Proposed fix** | Remove stats RPC from `fetchFinanceDashboardKpis`; compose KPIs from cached `useSubscriptionStats` data or one shared query. |
| **Depends on** | Phase 8 HIGH-4 |

---

### HIGH-2 — Customer detail: six parallel queries on mount regardless of tab

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **File** | `src/features/customers/CustomerDetailPage.jsx` L166–185 |
| **Hooks** | `useCustomer`, `useSitesByCustomer`, `useWorkOrdersByCustomer`, `useSimCardsByCustomer`, `useCustomerSubscriptions`, `useAssetsByCustomer` (+ conditional `usePaymentMethods`, `usePendingPaymentInsights`, `useCustomerAuditLogs`) |
| **Current behavior** | All tabs’ data fetched up front; only payment methods / insights gated by `canWrite`. |
| **Why risky** | 6+ network round-trips per customer open; subscriptions/SIM pricing visible in cache for roles UI hides (Phase 5). |
| **Proposed fix** | Tab-scoped `enabled: activeTab === '…'`; lazy-load audit logs (already `enabled: isAdmin`). |
| **Depends on** | [05-frontend-exposure-audit.md](./05-frontend-exposure-audit.md) |

---

### HIGH-3 — Unstable `filters` objects in `queryKey` (cache churn)

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/features/workHistory/WorkHistoryPage.jsx` L67–73; pattern repeated in list pages passing inline `filters` to hooks |
| **Hooks** | `workHistoryKeys.search(filters)`, `workOrderKeys.list(filters)`, `subscriptionKeys.list(filters)`, etc. |
| **Current behavior** | New object literal each render → key serializes nested fields but **reference churn** if parent recreates filters; work history spreads computed date range inline every render. |
| **Why risky** | Duplicate fetches, cache misses, loading flicker on unrelated parent re-renders. |
| **Proposed fix** | `useMemo` for filter objects; normalize keys (sorted keys, primitives only). |
| **Depends on** | — |

---

### HIGH-4 — Broad finance invalidation on routine mutations

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/features/finance/hooks.js` L44–50, L66–73, L88–95; `src/features/workOrders/hooks.js` L41–44, L140–167; `src/features/finance/recurringHooks.js` L92–98; `src/features/subscriptions/hooks.js` (payment mutations → `subscriptionKeys.all`) |
| **Pattern** | `invalidateQueries({ queryKey: profitAndLossKeys.all })`, `financeDashboardKeys.all`, `dashboardV2Keys.all`, `subscriptionKeys.all` |
| **Current behavior** | Single transaction or WO status change invalidates **all** P&L, finance dashboard V2, and often **all** subscription caches app-wide. |
| **Why risky** | Next navigation to finance/subscription pages triggers full refetch storms (Phase 8 views). |
| **Proposed fix** | Invalidate scoped keys: `profitAndLossKeys.list(period, viewMode)`, `financeDashboardKeys.kpis(period, viewMode)`; use `setQueryData` for detail rows where possible. |
| **Depends on** | Phase 8 |

---

### HIGH-5 — `useCollectionSummaries` — no limit, no `staleTime`, no role guard

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/features/finance/hooks.js` L405–409; `src/features/finance/TahsilatPage.jsx` L192 |
| **Hook** | `useCollectionSummaries` |
| **Current behavior** | Fetches entire `v_collection_customer_summary` when Tahsilat page mounts (`RoleRoute` only — route guard OK, invalidation still broad). |
| **Why risky** | Phase 8 CRITICAL-2 view cost; refetch after any `collectionKeys.all` invalidation. |
| **Proposed fix** | Pagination; longer `staleTime`; split collection key namespace (CRITICAL-3). |
| **Depends on** | Phase 8 |

---

### HIGH-6 — Finance income/expense lists: `useTransactions` without default limit

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/features/finance/hooks.js` L22–26; `src/features/finance/IncomePage.jsx` L97–105; `src/features/finance/ExpensesPage.jsx` (same pattern) |
| **Hook** | `useTransactions` |
| **Current behavior** | Fetches all matching `financial_transactions` rows for selected period (optional) with `TRANSACTION_SELECT` embeds — no `.limit()` unless caller passes `filters.limit`. |
| **Why risky** | Large months → large payload + client aggregation. |
| **Proposed fix** | Default `limit` + “load more”; paginate with `.range()`. |
| **Depends on** | Phase 7/8 ledger growth |

---

### HIGH-7 — `FinanceDashboardPage` parallel heavy queries on mount

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **File** | `src/features/finance/FinanceDashboardPage.jsx` L118–124 |
| **Hooks** | `useOverviewTotals`, `useIncomeBySource`, `useExpensesBySource`, `useRevenueExpensesByMonth`, `useFinanceHealthCheck` (banner) |
| **Current behavior** | Four+ queries fire together; each hits `v_profit_and_loss` or derived aggregates (Phase 8). |
| **Why risky** | Acceptable behind `RoleRoute` but expensive on every finance hub visit and after broad invalidation. |
| **Proposed fix** | Single dashboard RPC; stagger below-the-fold tabs; raise `staleTime` for overview. |
| **Depends on** | Phase 8 |

---

### HIGH-8 — No `enabled: canWrite` anywhere in codebase for restricted queries

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** (exposure pattern) |
| **Evidence** | Repo-wide grep: **zero** `enabled: canWrite` / `enabled: hasFinance` on `useQuery` |
| **Exceptions** | `usePaymentMethods(canWrite ? id : null)`, `usePendingPaymentInsights(..., canWrite)`, `useFinanceHealthCheckRecords({ enabled })`, Paraşüt `VITE_PARASUT_ENABLED` |
| **Proposed fix** | Shared `useFinanceQueriesEnabled()` hook wrapping `canWrite`; apply to dashboard, and any hook calling finance RPCs/stats. |
| **Depends on** | [05-frontend-exposure-audit.md](./05-frontend-exposure-audit.md) |

---

### MEDIUM-1 — `useSubscriptionStats` shared cache across dashboard, subscriptions list, finance tab

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Files** | `src/pages/DashboardPage.jsx` L40; `src/features/subscriptions/SubscriptionsListPage.jsx` L81; `src/features/finance/components/dashboard/SubscriptionsTab.jsx` L20 |
| **Behavior** | Same `subscriptionKeys.stats()` — **good deduplication** when navigating between these pages within `staleTime`. |
| **Issue** | Still unguarded for `field_worker`; duplicate with `fetchFinanceDashboardKpis` on dashboard (HIGH-1). |

---

### MEDIUM-2 — `useCurrentProfile` fetched from layout + `useRole` + dropdown (triple hook call)

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** (low perf impact) |
| **Files** | `src/app/AppLayout.jsx` L26; `src/components/layout/Sidebar.jsx` L46; `src/lib/roles.js` L10; `UserProfileDropdown.jsx` L17 |
| **Behavior** | Single query key `['currentProfile']` — **deduped** by React Query. |
| **Issue** | Role not in key — **correct** (one profile per session). Wait for profile before finance `enabled` to avoid race. |

---

### MEDIUM-3 — `useNotificationsList` puts raw `filters` object in key

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/notifications/hooks.js` L40, L49 |
| **Issue** | `filters` memoized in wrapper L57 — OK there; pattern fragile if callers pass inline objects. |

---

### MEDIUM-4 — `useSubscriptionStats` / dashboard stats not keyed by role or user

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/subscriptions/hooks.js` L329–333 |
| **Issue** | Global stats in cache — safe if identical for all accountants; **wrong** if RPC later scopes by role. Prefer `['subscriptions','stats', role]` if server-side filtering is added. |

---

### MEDIUM-5 — Work history: `useProfiles()` always on page mount

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/workHistory/WorkHistoryPage.jsx` L74 |
| **Hook** | `useProfiles` from `tasks/hooks.js` |
| **Issue** | Extra query for worker filter dropdown; could lazy-load when filter opens. |

---

### MEDIUM-6 — Subscriptions list row `prefetchQuery` on hover

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/subscriptions/SubscriptionsListPage.jsx` L102–107 |
| **Behavior** | Prefetches full `fetchSubscription` detail — good UX, many hovers = many requests. |
| **Proposed fix** | Debounce hover prefetch; cap concurrent prefetches. |

---

### MEDIUM-7 — `ParasutHealthCard` ad-hoc `useQuery` (not in `hooks.js`)

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/finance/components/ParasutHealthCard.jsx` L27–30 |
| **Behavior** | Scans `financial_transactions` last 24h when Paraşüt enabled on finance dashboard. |
| **Issue** | No shared key factory; gated by env only, not role (page is `RoleRoute`). |

---

### MEDIUM-8 — WO completion invalidates finance + receivables + operations

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/workOrders/hooks.js` (completion mutation blocks) |
| **Behavior** | Correctness-first; causes cross-module refetch. |
| **Depends on** | HIGH-4 |

---

### MEDIUM-9 — `useProfitAndLoss` / `useFinanceDashboardKpis` lack extra `staleTime`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/finance/hooks.js` L240–260 |
| **Behavior** | Inherit 5 min global — OK with `refetchOnWindowFocus: false`. |
| **Issue** | Invalidation still forces immediate refetch after mutations. |

---

### MEDIUM-10 — Materials / customers list hooks: no paginated variant in hooks

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Files** | `src/features/materials/hooks.js`; `src/features/customers/hooks.js` |
| **Behavior** | `useCustomers({ search })` — depends on API limit in `customers/api.js` (verify API cap in Phase 7/8). |

---

### LOW-1 — Global `refetchOnWindowFocus: false` masks focus-refetch debt

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/app/providers.jsx` L10 |
| **Note** | Positive for Phase 8; if enabled globally later, finance queries need per-hook `false`. |

---

### LOW-2 — `useExchangeRates` 1h `staleTime` — good pattern

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/features/finance/hooks.js` L166–171 |

---

### LOW-3 — `useFinanceHealthCheckRecords({ enabled: false })` — good pattern

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/features/finance/hooks.js` L356–362 |

---

### LOW-4 — Calendar hooks use `enabled: Boolean(dateFrom && dateTo)`

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/features/calendar/hooks.js` L42 |

---

### LOW-5 — `keepPreviousData` on paginated WO / subscriptions / SIM / proposals

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** (positive) |
| **Files** | `workOrders/hooks.js`, `subscriptions/hooks.js`, `simCards/hooks.js`, `proposals/hooks.js` |

---

### LOW-6 — Action board: three queries with 2 min `staleTime`

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/features/actionBoard/hooks.js` L12–27 |

---

## 00221–00223 Alignment (React Query layer)

| Change | Hook / page | Status |
|--------|-------------|--------|
| **00221** `search_work_history` filters | `workHistory/api.js` passes all RPC params; `useSearchWorkHistory` uses them in `queryFn` | **Correct** — no client post-filter |
| **00221** | `enabled: true` on empty search | **Gap** — still fires on mount (CRITICAL-2) |
| **00222** `bulk_upsert_materials` | `materials` import mutation invalidates `materialKeys` | Out of scope for hot read paths |
| **00223** `sim_cards_list` | `simCards/hooks.js` uses `simCardKeys.list(filters)` + paginated variant | **Correct** |

---

## Refetch-on-Focus Assessment

| Finding | Status |
|---------|--------|
| Global `refetchOnWindowFocus: false` | **No app-wide focus refetch storm** |
| Per-query override to `true` | **None found** on finance/dashboard |
| `useNotificationBadge` `refetchInterval: 60000` | Intentional polling — acceptable |

**Residual risk:** Manual `refetch()` buttons and **invalidation-driven** refetch remain the main cost (HIGH-4).

---

## Role / Cache Mixing

| Scenario | Risk |
|----------|------|
| Same browser, role change (rare) | `['currentProfile']` updates; finance caches may hold prior role data until invalidated |
| `field_worker` visits `/` | Finance/subscription stats cached under unguarded keys |
| Shared PC, logout/login different user | Standard React Query — **no `userId` in keys**; rely on logout clearing cache (verify auth flow outside this audit) |

**Proposed fix:** On auth logout, `queryClient.clear()`; include `user?.id` in sensitive keys if multi-user same browser is a concern.

---

## Hooks / Files Needing Immediate Review

1. `src/pages/DashboardPage.jsx` — unguarded finance + subscription queries  
2. `src/features/workHistory/hooks.js` + `WorkHistoryPage.jsx` — `enabled` + filter memoization  
3. `src/features/finance/api.js` + `collectionApi.js` — split `collectionKeys`  
4. `src/features/finance/api.js` `fetchFinanceDashboardKpis` — remove duplicate stats RPC  
5. `src/features/customers/CustomerDetailPage.jsx` — tab-lazy queries  
6. `src/features/finance/hooks.js` — mutation invalidation scope + `useTransactions` limits  

---

## Recommended Next Action

1. **APPROVE** a frontend query hardening batch: dashboard `enabled: canWrite`, work-history search guard, split collection query keys, dedupe dashboard stats RPC.  
2. Pair with Phase 2/3 **server-side role guards** so blocked queries are not merely hidden in UI.  
3. Proceed to **Phase 10 — Bundle / Frontend Performance Audit** (`npm run build` chunk analysis).  

---

## What Was Not Changed

- No `hooks.js` / `api.js` edits  
- No migrations or commits
