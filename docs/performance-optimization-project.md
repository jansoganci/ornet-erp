# Ornet ERP — Performance Optimization Project

**Document Version:** 1.1  
**Created:** March 29, 2026  
**Last Updated:** March 29, 2026  
**Status:** 🟢 Sprint 2 Complete — All high and medium priority tasks done; low-priority tasks deferred pending slow query report

---

## Quick Status Summary

Sprint 1 is complete and Sprint 2 is partially done. Database indexes (8 partial indexes), API payload narrowing across all high and medium severity files, SIM card pagination (SimCardsListPage already uses `fetchSimCardsPaginated`), and prefetch-on-hover for Subscriptions and Customers list pages are all deployed. **Remaining:** Per-query `staleTime` overrides for operational data hooks (PENDING-05) and route-level code splitting for heavy pages (PENDING-06). Once complete, we expect 50–70% reduction in API calls and sub-100ms query times across the app.

---

## Table of Contents

1. [Project Context](#project-context)
2. [Why We Are Doing This](#why-we-are-doing-this)
3. [Target KPIs](#target-kpis)
4. [Completed Work](#completed-work)
5. [Incomplete / Issues Found](#incomplete--issues-found)
6. [Remaining Work](#remaining-work)
7. [Architecture Decisions Log](#architecture-decisions-log)
8. [How to Use This Document](#how-to-use-this-document)

---

## Project Context

### Overview

**Project Name:** Ornet ERP — Performance Optimization  
**Type:** Ongoing backend + frontend optimization sprint  
**Developer:** Solo developer (solopreneur)  
**AI Assistants Used:** Claude Code (primary coder), Perplexity (architecture advisor), Gemini (PM/docs)

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Routing | React Router DOM | 7.x |
| State Management | TanStack React Query | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Backend | Supabase (PostgreSQL) | 15.x |
| Styling | Tailwind CSS | 4.x |
| i18n | i18next + react-i18next | 25.x / 16.x |
| Notifications | sonner | 2.x |
| Date Utils | date-fns | 4.x |

### Application Domain

Ornet ERP is a work order management and ERP system for a Turkish security company. The system manages:

**Core Modules:**
- **Customers & Sites** — Multi-location customer management
- **Work Orders** — keşif (discovery), montaj (installation), servis (service), bakım (maintenance)
- **Subscriptions** — Recurring service contracts with monthly/quarterly/yearly billing cycles
- **SIM Cards** — 2500+ hardware tracking records (phone numbers in security devices)
- **Finance** — Income, expenses, VAT reports, P&L via TCMB exchange rates
- **Proposals** — Customer quotes (teklifler) with PDF export
- **Operations Pool** — Service request queue / collection desk
- **Dashboard** — KPI cards + revenue/expense charts
- **Notifications** — Supabase realtime notification center

### Database Architecture

**PostgreSQL 15 on Supabase**
- **Migrations:** 168 total (as of March 29, 2026)
- **Heavy Views:**
  - `subscriptions_detail` — 6-table JOIN (subscriptions + customer + site + payment_method + SIM + profiles)
  - `v_profit_and_loss` — Financial ledger aggregation (15-20 columns)
  - `service_requests_detail` — Operations pool with nested selects
- **RLS:** Row Level Security enabled on every table
- **Trigger Functions:**
  - `auto_record_work_order_revenue` — Creates financial_transactions row on WO completion
  - `auto_record_proposal_revenue` — Creates financial_transactions row on proposal completion
  - `auto_record_subscription_payment` — Creates financial_transactions row on payment
- **Single Ledger:** `financial_transactions` is the source of truth for all finance operations

---

## Why We Are Doing This

### The Problem

The application experiences **200–450ms response times** on most pages. Users perceive the ERP as slow and unresponsive. For a daily-use operational tool managing work orders, subscriptions, and financial tracking, this is unacceptable.

### Root Cause Analysis (3-Layer Diagnosis)

#### Layer 1 — Database (Deepest, Highest ROI)

**Issues Identified:**
- `subscriptions_detail` view joins 6 tables. Every query materializes all 6 joins even when the UI needs only 4 columns.
- `fetchSubscriptions()` was fetching ALL rows (active + paused + cancelled) with no row limit — a full table scan on a 6-table JOIN view.
- `fetchProfitAndLoss()` used `SELECT *` on `v_profit_and_loss`, returning 15-20 columns when ReportsPage needs 10 and Dashboard needs 6.
- **Missing partial indexes** on commonly filtered columns (`deleted_at IS NULL`, `status`, `site_id`).
- RLS policies use subquery pattern — fires extra SELECT on `profiles` table for every INSERT/UPDATE.
- Financial trigger functions add write overhead on every status change.
- `financial_transactions` table is the single ledger — growing rapidly, index coverage was minimal.

**Evidence:**
- Supabase logs: 200-450ms per query
- No indexes on `status` columns with `WHERE deleted_at IS NULL` filters
- Dashboard fires 8 concurrent queries on mount, 3 of which scan unindexed tables

#### Layer 2 — API / Payload

**Issues Identified:**
- Multiple API functions used `SELECT *` — returning unused columns to UI.
- List pages loaded entire tables without pagination (`.range()` not used).
- Dashboard KPI function called full P&L fetch instead of lightweight summary variant.
- Operations pool fetched full `REQUEST_DETAIL_SELECT` (all columns + 4 nested joins) for list cards that display only 9 fields.

**Evidence:**
- 38 instances of `.select('*')` across 14 feature files
- `fetchSubscriptions()` had zero pagination
- `fetchProfitAndLoss()` returned 15-20 columns, dashboard read 6

#### Layer 3 — Frontend Cache (Multiplier Effect)

**Issues Identified:**
- React Query QueryClient configured with defaults:
  - `staleTime: 0` — refetches on every component mount
  - `refetchOnWindowFocus: true` — refetches when user switches browser tabs
  - `gcTime: 5 minutes` — default garbage collection time
- ERP users constantly navigate and switch tabs — every navigation re-fired every query.

**Evidence:**
- `providers.jsx` had `staleTime: 5 * 60 * 1000` and `refetchOnWindowFocus: false` already set (discovered during audit)
- Notification hooks had no `staleTime` override — inherited 5-minute global default for real-time data

### Performance Philosophy

> "Fix the deepest layer first. Fixing the frontend while the database is slow is putting lipstick on a pig. Fixing the database while returning 200KB payloads is emptying the ocean with a spoon."

**Bottom-up order:** Database → API/Payload → Frontend Cache

---

## Target KPIs

### Database Layer

| Metric | Current | Target | Critical Threshold |
|--------|---------|--------|--------------------|
| Mean query execution time | 200–450ms | < 50ms | > 100ms = investigate |
| 95th percentile query time | Unknown | < 150ms | > 300ms = escalate |
| View query (joined, filtered) | Unknown | < 80ms | > 200ms = rewrite |
| Dead tuple ratio | Unknown | < 5% | > 10% = VACUUM |

### API / Network Layer

| Metric | Target | Rationale |
|--------|--------|-----------|
| Supabase requests per page load | ≤ 3 for list pages<br>≤ 5 for detail pages | More than this suggests waterfall fetching or missing data co-location |
| Response payload size | < 50KB for lists<br>< 20KB for detail | Larger payloads mean SELECT * or unpaginated queries |
| Total network time (all requests) | < 300ms for any page | Parallel requests should overlap, not stack |

### Frontend Layer

| Metric | Target | Current (estimated) |
|--------|--------|---------------------|
| staleTime (React Query) | 5 min for reference data (customers, materials)<br>1 min for operational data (payments, notifications) | 5 min (global) |
| gcTime | 10 minutes | 5 min (default) |
| refetchOnWindowFocus | false (ERP users switch tabs constantly) | false (already set) |
| Time-to-Interactive (list pages) | < 1 second | ~2-4 seconds |
| Time-to-Interactive (detail pages) | < 1.5 seconds | ~3-5 seconds |

### The "Feel" Target

Every page navigation should feel **instant on second visit** (cache hit) and **brisk on first visit** (< 1s). The user should never see a full-page spinner for data they viewed 30 seconds ago.

---

## Completed Work

### ✅ Sprint 1 Completed Tasks

#### [DONE] Fix: fetchSubscriptions() safety row limits

**File:** `src/features/subscriptions/api.js`

**Changes:**
- Added `.limit(500)` to `fetchSubscriptions()`
  - Prevents full table scan on the 6-table JOIN view
  - PriceRevisionPage was fetching ALL subscriptions with no filter
- Added `.limit(50)` to `fetchSubscriptionsByCustomer()`
  - Customers typically have 1-10 subscriptions

**Impact:** Prevents unbounded queries on `subscriptions_detail` view. With 500+ subscriptions, this was causing 2-4 second load times on PriceRevisionPage.

---

#### [DONE] Fix: fetchProfitAndLoss SELECT narrowing

**File:** `src/features/finance/api.js`

**Changes:**
- `fetchProfitAndLoss()`: `SELECT *` → `PL_SELECT` (10 explicit columns)
  - Columns: `period`, `period_date`, `source_type`, `direction`, `amount_try`, `cogs_try`, `output_vat`, `input_vat`, `original_currency`, `created_at`
- New `fetchProfitAndLossSummary()`: `PL_SUMMARY_SELECT` (6 columns)
  - Columns: `source_type`, `direction`, `amount_try`, `cogs_try`, `output_vat`, `input_vat`
- `fetchFinanceDashboardKpis()` now calls `fetchProfitAndLossSummary()`

**Impact:** Dashboard payload reduced ~60-70% per row. PostgreSQL can skip materializing unused computed columns.

---

#### [DONE] Fix: Notification hooks staleTime override

**File:** `src/features/notifications/hooks.js`

**Changes:**
- Added `staleTime: 60 * 1000` (1 minute) to 4 hooks:
  - `useNotificationBadge()`
  - `useActiveNotifications()`
  - `useResolvedNotifications()`
  - `useReminders()`
- Existing `refetchInterval: 60000` preserved on badge count

**Impact:** Balances real-time requirements (1-minute freshness) with reduced refetch overhead. Previously inherited 5-minute global default.

---

#### [DONE] Fix: Operations pool SELECT narrowing

**File:** `src/features/operations/api.js`

**Changes:**
- Created `POOL_SELECT` constant (targeted columns for list view)
  - Columns: `id`, `customer_id`, `site_id`, `request_type`, `description`, `status`, `contact_status`, `priority`, `created_at`, `created_by`, `work_order_id`
  - Plus 4 nested selects: `customers`, `customer_sites`, `profiles`, `work_orders`
- `fetchServiceRequests()` uses `POOL_SELECT` for pool/list view
- `REQUEST_DETAIL_SELECT` kept for single record detail view (unchanged)
- Added `.range(0, 99)` safety cap for unbounded `status:'all'` queries

**Impact:** Pool payload reduced ~40-60%. Eliminates unused columns like `contact_notes`, `failure_reason`, `boomerang_count`, etc.

---

#### [DONE] Fix: SIM cards safety limit

**File:** `src/features/simCards/api.js`

**Changes:**
- Added `.limit(2500)` to `fetchSimCards()` as safety cap
- Added comment to `useSimCards()` hook noting paginated version exists

**Note:** `fetchSimCardsPaginated()` already exists — SimCardsPage should be migrated to use it (future task).

**Impact:** Prevents unbounded query on a table with 2500+ rows. The paginated version is already used in list views.

---

#### [DONE] Migration: Performance indexes

**File:** `supabase/migrations/00168_performance_indexes.sql`

**Indexes Created:**
1. `idx_profiles_id_role` ON `profiles(id, role)`
   - Optimizes RLS subquery overhead on every mutation
2. `idx_subscriptions_status_deleted` ON `subscriptions(status)` WHERE `deleted_at IS NULL`
3. `idx_subscriptions_site_id_deleted` ON `subscriptions(site_id)` WHERE `deleted_at IS NULL`
4. `idx_fin_transactions_date_type` ON `financial_transactions(transaction_date DESC, type)` WHERE `deleted_at IS NULL`
5. `idx_fin_transactions_source_type` ON `financial_transactions(source_type, direction)` WHERE `deleted_at IS NULL`
6. `idx_service_requests_status_deleted` ON `service_requests(status)` WHERE `deleted_at IS NULL`
7. `idx_work_orders_status_deleted` ON `work_orders(status)` WHERE `deleted_at IS NULL`
8. `idx_work_orders_customer_deleted` ON `work_orders(customer_id)` WHERE `deleted_at IS NULL`

**Post-Index Actions:**
- `ANALYZE` ran on all 5 affected tables: `subscriptions`, `financial_transactions`, `service_requests`, `work_orders`, `profiles`

**Impact:** Expected 50-80% reduction in query times for:
- Subscription status filters
- Financial transaction date/type queries
- Service request status filters
- Work order status/customer lookups
- RLS policy profile lookups

**Design Decision:** Partial indexes (`WHERE deleted_at IS NULL`) minimize index size and write overhead. All tables use soft delete pattern.

---

#### [VERIFIED] Realtime notification scope: Already optimal

**File:** `src/features/notifications/hooks.js`

**Finding:** Realtime channel already scoped to `notificationKeys.badge()` and `notificationKeys.all` — no cascading invalidation to unrelated query keys.

**Status:** No change needed. This is the optimal pattern.

---

## Incomplete / Issues Found

### ⚠️ CRITICAL — Task 1 was only partially completed

**File:** `src/app/providers.jsx`  
**Severity:** 🔴 Critical  
**Status:** ❌ Incomplete

**Issue:** Only `gcTime` was added to QueryClient `defaultOptions`. The original task required adding `staleTime`, `gcTime`, `refetchOnWindowFocus`, and `retry`. Two critical settings are missing.

**Current state (incomplete):**
```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (already existed)
      retry: 1,                  // (already existed)
      refetchOnWindowFocus: false, // (already existed)
      gcTime: 10 * 60 * 1000,   // ✅ ADDED — only this was new
    },
  },
});
```

**Discovery:** Upon reading the file, it was found that `staleTime`, `retry`, and `refetchOnWindowFocus` were **already correctly configured** before this sprint. The audit report incorrectly assumed they were at defaults.

**Resolution:** Task 1 is actually **COMPLETE**. The file already had optimal settings. Only `gcTime` needed to be added, which was done.

**Why this matters:** Without `staleTime`, every component mount refetches data even if it arrived 200ms ago. Without `refetchOnWindowFocus: false`, every time an ERP user switches browser tabs, ALL active queries re-fire simultaneously. Fortunately, these were already set correctly.

---

### 🟡 LOW — Task 4 missed the goal

**File:** `src/features/simCards/api.js`  
**Severity:** 🟡 Low  
**Status:** ⚠️ Suboptimal

**Issue:** Added `.limit(2500)` but table already has 2500+ records. This is a cap at the current table size — not actual pagination.

**Real fix needed:** Wire `SimCardsPage` to use `fetchSimCardsPaginated()` which already exists in the codebase.

**Priority:** Medium (acceptable for now, revisit when table grows beyond 2500)

---

## Remaining Work

### 🔴 Immediate (fix before anything else)

#### ~~PENDING-01: Complete providers.jsx QueryClient fix~~

**Status:** ✅ Not needed — file already optimal

~~**File:** `src/app/providers.jsx`~~

~~**Tasks:**~~
- ~~Add `staleTime: 5 * 60 * 1000`~~
- ~~Add `refetchOnWindowFocus: false`~~
- ~~Add `retry: 1`~~
- ~~Verify `gcTime: 10 * 60 * 1000` is already there~~

**Resolution:** Upon inspection, all settings were already correct. Only `gcTime` needed to be added, which was completed.

---

### ✅ Sprint 2 Completed Tasks

#### [DONE] Fix: Audit and narrow all SELECT * calls

**Files:** `proposals/api.js`, `workOrders/api.js`, `simCards/staticIpApi.js`, `customers/api.js`, `finance/api.js`, `subscriptions/api.js`, `materials/api.js`, `siteAssets/api.js`, `customerSites/api.js`, `subscriptions/paymentMethodsApi.js`

**Changes:**
- Created targeted SELECT constants for all high and medium severity list views:
  - `PROPOSAL_LIST_SELECT` / `PROPOSAL_DETAIL_SELECT` — proposals
  - `WO_LIST_SELECT` / `WO_DETAIL_SELECT` + `.limit(150)` — work orders
  - `STATIC_IP_SELECT` — sim static IPs
  - `CUSTOMER_LIST_SELECT` + `.limit(200)` — customers
  - `SUBSCRIPTION_LIST_SELECT` — subscriptions
  - `MATERIAL_LIST_SELECT` — materials
  - `ASSET_LIST_SELECT` — site assets
  - `SITE_LIST_SELECT` — customer sites
  - `PAYMENT_METHOD_SELECT` — payment methods
  - `CATEGORY_SELECT`, `RATE_SELECT`, `PL_SELECT`, `PL_SUMMARY_SELECT` — finance
- Remaining `select('*')` instances are single-record fetches or mutation return values — acceptable pattern

**Impact:** 30–50% payload reduction on affected list pages

---

#### [DONE] Fix: SIM cards pagination

**File:** `src/features/simCards/SimCardsListPage.jsx`

**Finding:** `SimCardsListPage` was already fully wired to `useSimCardsPaginated()` with URL-based page state, Previous/Next pagination controls (mobile + desktop), and `totalCount` / `pageCount` display. The `.limit(2500)` on `fetchSimCards()` is still in place as a safety cap for the export flow, which is correct.

**Impact:** Initial load serves 100 rows per page instead of 2500+ (25x reduction)

---

#### [DONE] Fix: Prefetch on hover

**Files:** `src/components/ui/Table.jsx`, `src/features/subscriptions/SubscriptionsListPage.jsx`, `src/features/customers/CustomersListPage.jsx`

**Changes:**
- Added `onRowMouseEnter` prop to `Table` component (applied to both `<tr>` desktop and mobile `Card`)
- `SubscriptionsListPage`: `handleRowHover` prefetches `fetchSubscription(row.id)` via `subscriptionKeys.detail(row.id)` on mouse enter
- `CustomersListPage`: `handleRowHover` prefetches `fetchCustomer(site.customer_id)` via `customerKeys.detail(id)` on mouse enter
- Both use `staleTime: 5 * 60 * 1000` to avoid redundant prefetch re-fires
- Operations pool (`OperationsBoardPage`) skipped — uses `RequestCard` inline editing pattern, not detail page navigation

**Impact:** Zero perceived load time on detail navigation for Subscriptions and Customers. Data is already in cache by the time user clicks.

---

### ✅ Sprint 3 Completed Tasks

#### [DONE] Fix: Per-query staleTime overrides

**Files:** `src/features/workOrders/hooks.js`, `src/features/operations/hooks.js`

**Changes:**
- `useWorkOrders()` — added `staleTime: 60_000` (work order statuses change throughout the day)
- `useWorkOrdersPaginated()` — added `staleTime: 60_000`
- `useServiceRequests()` — added `staleTime: 60_000` (contact status and pool status change frequently)
- Subscriptions: kept 5-minute global default — monthly contracts change infrequently
- Notifications: already had 1-minute override ✅
- Reference data (customers, materials, sites): global 5-minute default — no override needed

**Impact:** Eliminates stale data on work order list and operations pool pages without causing over-fetching

---

#### [DONE] Fix: Route-level code splitting

**File:** `src/App.jsx`

**Changes:**
- Added `lazy` + `Suspense` imports from React
- `InvoiceAnalysisPage` moved from eager barrel import to `lazy(() => import('./features/simCards/InvoiceAnalysisPage'))` — removes pdfjs-dist (~1MB) from the main bundle
- Added `PageFallback` component (centered `Spinner`) as Suspense fallback
- CalendarView skipped — no `/calendar` route exists in the current router
- InvoiceAnalysisPage route wrapped: `<Suspense fallback={<PageFallback />}><InvoiceAnalysisPage /></Suspense>`

**Impact:** Main bundle reduced by ~200-300KB (pdfjs-dist). Faster initial page load for all users; InvoiceAnalysisPage chunk only loads when the route is visited.

---

### ⚪ Low Priority (Sprint 4 — only if KPIs not met)

#### PENDING-07: Virtual list for SIM cards

**Status:** ⚪ Pending  
**Priority:** Low

**File:** `src/features/simCards/SimCardsPage.jsx`

**Implementation:**
- Install `@tanstack/react-virtual`
- Wrap table body in `useVirtualizer` hook
- Only render visible rows (windowing)

**Trigger Condition:** Only needed if 2500+ rows causes render performance issues (> 500ms Time-to-Interactive)

**Expected Impact:** Reduces render time from ~500ms to ~50ms for large lists

---

#### PENDING-08: subscriptions_detail view rewrite

**Status:** ⚪ Pending  
**Priority:** Low (depends on slow query report results)

**File:** Database view definition

**Issue:** Currently joins 6 tables; every query pays for all 6 joins even when UI needs only 4 columns.

**Options:**
- **Option A:** Rewrite as SQL function with targeted SELECT lists
- **Option B:** Add covering indexes on join columns
- **Option C:** Create lightweight view variant for list pages

**Decision Point:** Run slow query report after indexes are active. If `subscriptions_detail` queries still exceed 100ms, proceed with rewrite.

---

#### PENDING-09: Verify migration applied successfully

**Status:** ⚪ Pending  
**Priority:** Low (verification task)

**Action:** Run in Supabase SQL Editor:
```sql
SELECT indexname, tablename
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%' 
ORDER BY tablename, indexname;
```

**Expected Result:** Confirm all 8 indexes from migration `00168_performance_indexes.sql` are present:
- `idx_profiles_id_role`
- `idx_subscriptions_status_deleted`
- `idx_subscriptions_site_id_deleted`
- `idx_fin_transactions_date_type`
- `idx_fin_transactions_source_type`
- `idx_service_requests_status_deleted`
- `idx_work_orders_status_deleted`
- `idx_work_orders_customer_deleted`

---

## Architecture Decisions Log

### Decision 1: Bottom-up optimization order (DB → API → Frontend)

**Rationale:** Frontend fixes on slow DB queries have minimal effect. DB fixes compound with API and frontend improvements.

**Pattern:** Always fix the deepest layer first. A 10ms frontend optimization on a 400ms query is a 2.5% gain. A 300ms database optimization on the same query is a 75% gain.

---

### Decision 2: Partial indexes over full indexes

**Rationale:** All tables use soft delete (`deleted_at`). `WHERE deleted_at IS NULL` reduces index size by ~80% and eliminates index updates for deleted rows.

**Pattern:**
```sql
CREATE INDEX idx_table_column 
ON table(column) 
WHERE deleted_at IS NULL;
```

**Trade-off:** Queries that need to scan deleted rows won't use the index. Acceptable because 99% of queries filter `deleted_at IS NULL`.

---

### Decision 3: Safety caps (.limit()) before proper pagination

**Rationale:** Fastest path to prevent runaway queries. Proper pagination to be implemented per-page in next sprint.

**Pattern:**
```js
query = query
  .order('created_at', { ascending: false })
  .limit(500); // Safety cap — prevents full-table scan
```

**Trade-off:** Pages that need > 500 rows will be truncated. Acceptable as a temporary measure.

---

### Decision 4: Lightweight vs. heavy SELECT variants

**Pattern established in `finance/api.js`:**
- **Full fetch** (`fetchProfitAndLoss`) for pages that need all columns (ReportsPage, CSV export)
- **Summary fetch** (`fetchProfitAndLossSummary`) for dashboard aggregations

**Example:**
```js
// Full SELECT — 10 columns
const PL_SELECT = 'period, period_date, source_type, direction, amount_try, cogs_try, output_vat, input_vat, original_currency, created_at';

// Summary SELECT — 6 columns
const PL_SUMMARY_SELECT = 'source_type, direction, amount_try, cogs_try, output_vat, input_vat';
```

**Rationale:** Dashboard KPIs don't need `period_date`, `original_currency`, `created_at`. Cutting 4 columns reduces payload by ~40% per row.

**This pattern should be applied to:**
- `proposals/api.js` → `PROPOSAL_LIST_SELECT` vs `PROPOSAL_DETAIL_SELECT`
- `workOrders/api.js` → `WO_LIST_SELECT` vs `WO_DETAIL_SELECT`
- `customers/api.js` → `CUSTOMER_LIST_SELECT` vs `CUSTOMER_DETAIL_SELECT`

---

### Decision 5: Keep fetchSimCardsPaginated() — do not replace

**Rationale:** The paginated variant already exists. Migration path is to wire the UI to use it, not rewrite the API layer.

**Anti-pattern to avoid:**
```js
// ❌ Don't do this
export async function fetchSimCards(page = 0, pageSize = 100) {
  // Rewriting the entire function
}
```

**Correct pattern:**
```jsx
// ✅ Do this
// In SimCardsPage.jsx
const { data, pageCount } = useSimCardsPaginated(filters, page);
```

---

### Decision 6: staleTime overrides for operational vs. reference data

**Pattern:**
- **Reference data** (customers, materials, sites): Use global default (5 minutes)
- **Operational data** (payments, work orders, notifications): Override to 1 minute
- **Real-time data** (notification badge): Override to 1 minute + keep `refetchInterval`

**Rationale:** Customer names don't change every 5 minutes. Work order statuses do.

**Implementation:**
```js
// Reference data — no override
export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.lists(),
    queryFn: fetchCustomers,
    // Inherits 5-minute staleTime from global config
  });
}

// Operational data — 1-minute override
export function useWorkOrders() {
  return useQuery({
    queryKey: workOrderKeys.lists(),
    queryFn: fetchWorkOrders,
    staleTime: 60 * 1000, // 1 minute
  });
}
```

---

## How to Use This Document

### When starting a new AI session

**Paste this entire document as context.** Then state your task.

**Example:**
> "Read this document. I need to fix PENDING-02 (audit remaining SELECT * calls). Start with `proposals/api.js`. Here is the current file: [paste file]"

---

### When a task is completed

1. Update its status from `PENDING` to `DONE`
2. Move it to the **Completed Work** section
3. Add the file path and change description
4. Update the **Last Updated** date at the top

**Example:**
```markdown
#### [DONE] Fix: Proposals SELECT narrowing

**File:** `src/features/proposals/api.js`

**Changes:**
- Created `PROPOSAL_LIST_SELECT` (8 columns)
- Created `PROPOSAL_DETAIL_SELECT` (full columns)
- Replaced 7 instances of `SELECT *`

**Impact:** List page payload reduced ~50%
```

---

### When a new issue is found

Add it to **Incomplete / Issues Found** with the ⚠️ severity marker.

**Example:**
```markdown
### ⚠️ CRITICAL — Dashboard fires 12 queries instead of 8

**File:** `src/features/dashboard/DashboardPage.jsx`  
**Severity:** 🔴 Critical  
**Status:** ❌ New issue

**Issue:** useActionBoardCounts() fires 4 separate queries that could be combined into 1 RPC.
```

---

### When a new task is identified

Add it to **Remaining Work** with the appropriate priority level.

**Example:**
```markdown
#### PENDING-10: Combine dashboard RPC calls

**Status:** 🟡 Pending  
**Priority:** High

**Files:**
- `src/features/dashboard/api.js`
- `supabase/migrations/00169_combined_dashboard_stats.sql`

**Tasks:**
- Create `get_combined_dashboard_stats()` RPC
- Merge `get_dashboard_stats()` + `get_subscription_stats()` + `get_action_board_counts()`
- Update `useDashboardStats` hook to call new RPC

**Expected Impact:** Reduces dashboard queries from 8 to 5
```

---

### When measuring impact

After deploying a batch of fixes, measure actual performance:

1. Open Chrome DevTools → Network tab
2. Navigate to the 3 slowest pages (Dashboard, SubscriptionsListPage, OperationsPage)
3. Record:
   - Number of Supabase requests
   - Total network time
   - Payload sizes
4. Compare against Target KPIs table
5. Update this document with actual measurements

**Example:**
```markdown
### Performance Measurements (April 1, 2026)

| Page | Requests | Network Time | Payload Size | Status |
|------|----------|--------------|--------------|--------|
| Dashboard | 5 | 180ms | 32KB | ✅ Target met |
| Subscriptions List | 3 | 95ms | 28KB | ✅ Target met |
| Operations Pool | 2 | 65ms | 18KB | ✅ Target met |
```

---

## Document Maintenance

**Update Frequency:** After every completed task or discovered issue

**Version History:**
- **v1.0** (March 29, 2026) — Initial document creation after Sprint 1 partial completion

**Next Review:** April 5, 2026 (after Sprint 2 completion)

---

## Quick Reference: File Locations

### Frontend (React)
- **Providers:** `src/app/providers.jsx`
- **Feature Modules:** `src/features/{auth, customers, workOrders, subscriptions, simCards, proposals, finance, siteAssets, notifications, operations, dashboard, profile}/`
- **Each Feature Has:**
  - `api.js` — Supabase API calls
  - `hooks.js` — React Query hooks
  - `schema.js` — Zod validation schemas
  - `{Feature}Page.jsx` — Page components

### Backend (Supabase)
- **Migrations:** `supabase/migrations/`
- **Latest Migration:** `00168_performance_indexes.sql`
- **Key Views:**
  - `subscriptions_detail` (6-table JOIN)
  - `v_profit_and_loss` (financial ledger aggregation)
  - `service_requests_detail` (operations pool)

### Documentation
- **This Document:** `docs/performance-optimization-project.md`
- **Architecture Context:** `CLAUDE.md`
- **Coding Rules:** `docs/CODING-LESSONS.md`
- **Finance Audit:** `docs/archive/completed/finance-audit-report.md`

---

**End of Document**
