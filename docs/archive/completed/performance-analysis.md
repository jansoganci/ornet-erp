
Here’s an inventory based on a repo-wide search for `.select('*'` in `src/features/**/*.js` (plus the same pattern embedded in longer select strings where it matters).

---

## Scope note

- **Counted:** `.select('*')`, `.select('*', { count: … })`, `.select('*', { count: 'exact', head: true })`.
- **Also listed separately:** selects whose **first token is `*`** (e.g. `'*, materials(...)'`), because they behave like `SELECT *` on the base table.
- **Not expanded:** bare `.select()` (PostgREST default row shape on insert/update) — not literal `'*'`.
- **Excluded from the main table:** `workOrders/api.js` `fetchWorkOrder` / `fetchWorkOrderMaterials` use `'*'` only inside a longer string — covered in the **“Leading `*`”** section.

---

# By severity (highest risk first)

## High

| File | Function | Table / view | Usage | Pagination | Risk | Why | Replacement |
|------|----------|--------------|--------|------------|------|-----|-------------|
| `workOrders/api.js` | `fetchWorkOrders` | `work_orders_detail` | **List** (main WO list / filters) | **None** | **High** | Heavy view, **unbounded rows**, full `*`. | `WO_LIST_SELECT` + **paginate or cap**; keep `fetchWorkOrdersPaginated` + narrow columns; deprecate unpaginated list for UI. |
| `subscriptions/api.js` | `fetchSubscriptions` | `subscriptions_detail` | **List** (e.g. price revision, filters) | **`.limit(500)`** only | **High** | **6+ join view**, all columns; up to **500 rows** × wide JSON. | `SUBSCRIPTION_LIST_SELECT` + prefer **only** `fetchSubscriptionsPaginated`; avoid non-paginated list in UI. |
| `subscriptions/api.js` | `fetchSubscriptionsPaginated` | `subscriptions_detail` | **List** | **`.range()` + `count: 'exact'`** | **High** | Same view/join cost per row; every page still ships **all** view columns. | **`LIST_SELECT`** (columns the table cards need) + keep pagination; detail page keeps `*` or wider set. |
| `proposals/api.js` | `fetchProposals` | `proposals_detail` | **List** | **None** | **High** | Joined detail view, **full list**, `*`. | `PROPOSAL_LIST_SELECT` + **`.range()` / pagination**; `fetchProposal(id)` stays heavy. |
| `customers/api.js` | `fetchCustomers` | `customers` | **List** | None | **High** | **`*, customer_sites(...)`** — for each customer, nested `subscriptions(status)` + `work_orders(status)` multiplies work and payload. | Narrow **customer columns** + **tighter embed** (or RPC/counts); optional **paginated** list. |
| `siteAssets/api.js` | `fetchAssets` | `site_assets_detail` | **List** | None | **High** | Detail view, **unbounded** `*`. | `ASSET_LIST_SELECT` + pagination or stricter filters; detail single-row OK. |

## Medium

| File | Function | Table / view | Usage | Pagination | Risk | Why | Replacement |
|------|----------|--------------|--------|------------|------|-----|-------------|
| `tasks/api.js` | `fetchTasks` | `tasks_with_details` | **List** | None | **Medium** | View + `*`, unbounded; usually smaller than WO/subscriptions but can grow. | Explicit columns + optional **limit/pagination**. |
| `tasks/api.js` | `fetchTasksByDateRange` | `tasks_with_details` | **List** (calendar / range) | None | **Medium** | Same as above, date-bounded but still fat rows. | Same. |
| `notifications/api.js` | `fetchActiveNotifications` | `v_active_notifications` | **List** | **`.range()` ~20/page** | **Medium** | View + `*`; **pagination helps**; still more columns than UI may need. | Column list matching notification cards / center UI. |
| `notifications/api.js` | `fetchResolvedNotifications` | `notifications` | **List** | **`.range()`** | **Medium** | `*` then map to subset in JS — extra bytes over the wire. | Select only `id, type, title, body, related_entity_type, related_entity_id, resolved_at, created_at`. |
| `materials/api.js` | `fetchMaterials` | `materials` | **List** | None | **Medium** | Full catalog `*`; table moderate size, used in many comboboxes/pages. | List: `id, code, name, category, is_active, unit, …`; detail: full row. |
| `materials/api.js` | `fetchActiveMaterials` | `materials` | **List** (active only) | None | **Medium** | Same, subset of rows but still `*`. | Narrow columns for comboboxes. |
| `customerSites/api.js` | `fetchSitesByCustomer` | `customer_sites` | **List** (per customer) | None | **Medium** | `*` on sites; typically **few rows per customer**. | Explicit columns for forms/lists. |
| `workOrders/api.js` | `fetchWorkOrdersBySite` | `work_orders_detail` | **Scoped list** | None | **Medium** | Heavy view; bounded by site, still wide rows. | Narrow columns + **limit**. |
| `workOrders/api.js` | `fetchWorkOrdersByCustomer` | `work_orders_detail` | **Scoped list** | None | **Medium** | Same. | Same. |
| `workOrders/api.js` | `fetchWorkOrdersPaginated` | `work_orders_detail` | **List** | **`.range()` + count** | **Medium** | Pagination limits rows; **`*`** still widens each row. | `WO_LIST_SELECT` + keep pagination. |
| `subscriptions/api.js` | `fetchSubscriptionsByCustomer` | `subscriptions_detail` | **Scoped list** | **`.limit(50)`** | **Medium** | Same view; cap helps. | List column subset. |
| `subscriptions/api.js` | `fetchSubscription` | `subscriptions_detail` | **Detail** | N/A (single) | **Medium** | One row `*` is OK for bandwidth; still heavy **join** on server. | Optional: **split** “header” vs “billing” queries later; not urgent vs lists. |
| `subscriptions/api.js` | `updateSubscription` (prefetch `current`) | `subscriptions` | **Background** (read for audit) | `.single()` | **Medium** | Full row for diff; low frequency. | Select only fields needed for audit/status transition. |
| `proposals/api.js` | `fetchProposal` | `proposals_detail` | **Detail** | `.single()` | **Medium** | Acceptable for one row; join cost remains. | Trim if PDF/editor use subset; otherwise acceptable. |
| `proposals/api.js` | `fetchProposalAnnualFixedCosts` | `proposal_annual_fixed_costs` | **Detail / editor** | By `proposal_id` | **Medium** | Child table, usually few rows; `*` mild. | Explicit columns for editor. |
| `proposals/api.js` | `duplicateProposal` | `proposals`, `proposal_items`, `proposal_annual_fixed_costs` | **Background** (copy workflow) | N/A | **Medium** | Needs **most** columns to clone; `*` justified but wide. | **Leave as-is** or explicit “clone” column set. |
| `proposals/api.js` | `fetchProposalWorkOrders` | `work_orders_detail` | **Detail adjunct** | `.in('id', …)` | **Medium** | Few WO IDs typical; still fat per row. | Narrow WO fields for proposal tab. |
| `siteAssets/api.js` | `fetchAsset` | `site_assets_detail` | **Detail** | `.single()` | **Medium** | One row OK. | Column list if view is very wide. |
| `customers/api.js` | `fetchCustomer` | `customers` | **Detail** | `.single()` | **Medium** | **`*, customer_sites(*)`** — can be large for multi-site customers. | `customer_sites` explicit columns. |
| `simCards/api.js` | `fetchSimFinancialStats` | `view_sim_card_stats`, `view_sim_card_financials` | **Dashboard / KPI** | `.single()` each | **Medium** (DB **often > payload**) | Two aggregate **views**; JSON row small, **view execution** can be costly. | Prefer **single RPC** returning only KPI fields, or materialized summary — **not** only “smaller select”. |

## Low

| File | Function | Table / view | Usage | Pagination | Risk | Why | Replacement |
|------|----------|--------------|--------|------------|------|-----|-------------|
| `finance/api.js` | `fetchCategories` | `expense_categories` | **Reference / list** | None | **Low** | Small, stable dimension table. | Explicit columns or **leave as-is**. |
| `finance/api.js` | `fetchRates` | `exchange_rates` | **List / history** | None | **Low** | Can grow over time but still moderate; mostly numeric/date. | Date-range + column list if history gets huge. |
| `finance/api.js` | `getLatestRate` | `exchange_rates` | **Background** (latest FX) | **`.limit(1)`** | **Low** | One row. | **Leave as-is**. |
| `subscriptions/paymentMethodsApi.js` | `fetchPaymentMethods` | `payment_methods` | **List** (per customer) | None | **Low** | Few rows per customer, sensitive fields already “needed”. | Optional explicit columns (masking in UI). |
| `subscriptions/paymentsApi.js` | `fetchPendingPaymentsCount` | `subscription_payments` | **Count only** | **`head: true`** | **Low** | **No row payload**; `*` is only for PostgREST. | **Leave as-is** or `select('id', { count: 'exact', head: true })`. |
| `notifications/api.js` | `fetchReminders` | `user_reminders` | **List** | None | **Low** | Typically small per user. | Column list if reminders grow. |
| `materials/api.js` | `fetchMaterial` | `materials` | **Detail** | `.single()` | **Low** | Single catalog row. | **Leave as-is**. |
| `siteAssets/api.js` | `createAsset` / `updateAsset` | `site_assets` | **Write + return** | `.single()` | **Low** | Base table, thin. | **Leave as-is**. |
| `customers/api.js` | `fetchCustomerRelatedAuditLogs` | `audit_logs` (×2) | **Detail / admin-adjacent** | **`.limit(40/80)`** | **Low** | JSON blobs in row; limits cap blast radius. | Explicit columns (`id, action, old_values, …`) if payload matters. |
| `simCards/staticIpApi.js` | `fetchActiveStaticIp` | `sim_static_ips` | **Detail** | `maybeSingle()` | **Low** | Narrow table, one active row. | **Leave as-is**. |
| `simCards/staticIpApi.js` | `fetchStaticIpHistory` | `sim_static_ips` | **List** (history) | None | **Low** | Few rows per SIM typically. | **Leave as-is** unless history is huge. |

---

# Leading `*` (not a lone `'.select('*')'`, same payload class)

| File | Function | Pattern | Risk | Note |
|------|----------|---------|------|------|
| `customers/api.js` | `fetchCustomers` | `'*, customer_sites(...)'` | **High** | See High table. |
| `customers/api.js` | `fetchCustomer` | `'*, customer_sites(*)'` | **Medium** | Deep embed on detail. |
| `customerSites/api.js` | `fetchSiteByAccountNo`, `fetchSite`, `searchSites` | `'*, customers(*)'` or mixed | **Medium** | `searchSites` **`.limit(10)`** helps. |
| `proposals/api.js` | `fetchProposalItems` | `'*, materials(…)'` | **Medium** | Line items + material embed; bound by proposal size. | Tighten `proposal_items` columns + keep materials subset. |
| `workOrders/api.js` | `fetchWorkOrder` | `'*, work_order_materials(*, materials(...))'` | **Medium** | **Detail**; nested `*` explodes payload. | `WO_DETAIL_SELECT` + explicit materials columns. |
| `workOrders/api.js` | `fetchWorkOrderMaterials` | `'*, materials(*)'` | **Medium** | Materials `*` is unnecessary if UI shows code/name only. | Replace `materials(*)` with explicit fields. |
| `simCards/api.js` | `SIM_CARD_SELECT` (used by `fetchSimCards`, paginated fetch, etc.) | `` `*, …` `` | **High** for **list** | Large `sim_cards` table; **pagination** exists on paginated path; `*` still wide. | List variant without `*`; keep heavy select for edit/detail. |

---

# Top 10 worst remaining payload / query offenders

1. **`fetchWorkOrders`** — `work_orders_detail`, `*`, **no pagination**.  
2. **`fetchSubscriptions`** — `subscriptions_detail`, `*`, **up to 500 rows**.  
3. **`fetchSubscriptionsPaginated`** — same view, `*` on **every page**.  
4. **`fetchProposals`** — `proposals_detail`, `*`, **full list**.  
5. **`fetchCustomers`** — `*` + **nested** sites / subscriptions / work_orders.  
6. **`fetchAssets`** — `site_assets_detail`, `*`, **unbounded list**.  
7. **`SIM_CARD_SELECT` / `fetchSimCards`** — `sim_cards` + embeds, `*`, **2500-row scale** (mitigated by `.limit(2500)` / paginated API elsewhere).  
8. **`fetchTasks` + `fetchTasksByDateRange`** — `tasks_with_details`, `*`, unbounded.  
9. **`fetchWorkOrdersPaginated`** — same as #1 but **page-sized**; still fat **per row**.  
10. **`fetchWorkOrdersByCustomer` / `fetchWorkOrdersBySite`** — heavy view, `*`, no row cap.

---

If you want this turned into a checklist in `docs/performance-optimization-project.md` (without touching app code), say the word and we can align the doc’s “PENDING-02” list with this table.

analysis 2: 

## Pagination audit — Ornet ERP list-style data

Sources: `*ListPage.jsx`, `*Page.jsx` list UIs, matching `hooks.js` / `api.js`, and `.range` / `page` usage in `src/features`.

---

### Legend

- **Pagination:** server-side slicing of rows (user-visible pages, load-more, or infinite scroll backed by `range`/`limit`).
- **Row volume risk:** **tiny** &lt;50 · **medium** 50–500 · **large** 500+ (typical ERP growth; not exact counts).

---

## Focus modules (subscriptions, work orders, service requests, sim cards, customers, proposals, finance, notifications, dashboard)

| File path | Page / component | API function | Data source | Pagination? | Type / notes | Row volume risk | Problem if none | Recommended fix |
|-----------|------------------|--------------|-------------|-------------|--------------|-----------------|-----------------|-----------------|
| `subscriptions/SubscriptionsListPage.jsx` | `SubscriptionsListPage` | `fetchSubscriptionsPaginated` | `subscriptions_detail` | **Yes** | **PostgREST `.range(from, to)`** + **`count: 'exact'`** | medium–large | — | Keep; optional smaller `select` list. |
| `subscriptions/PriceRevisionPage.jsx` | `PriceRevisionPage` | `fetchSubscriptions` via `useSubscriptions` | `subscriptions_detail` | **No** (only **`.limit(500)`** in API) | Cap, not pages | **large** (hits cap) | Bulk edit loads up to 500 rows at once; slow, easy to miss rows beyond 500. | Server **pagination** + page controls; or filters + export for “all”. |
| `subscriptions/hooks.js` | (aux) `useSubscriptionsBySite` on detail | `fetchSubscriptions` | `subscriptions_detail` | **No** | **`.limit(500)`** | medium | Same pattern on site-scoped lists. | Scoped query + **`limit`** or small paginated API if many subs per site. |
| `workOrders/WorkOrdersListPage.jsx` | `WorkOrdersListPage` | `fetchWorkOrdersPaginated` | `work_orders_detail` | **Yes** | **`.range`** + **`count: 'exact'`** (page size from hook, e.g. 50) | medium–large | — | Keep. |
| `operations/components/RequestPoolTab.jsx` | `RequestPoolTab` (`OperationsBoardPage` pool tab) | `fetchServiceRequests` | `service_requests` + embeds | **Partial** | **Fixed `.range(0, 99)`** in API — not user-driven pages | **medium** (open pool usually &lt;100) | **“All open” capped at 100** with no “next page”; filters still clip silently. | True **pagination** or higher cap + UI when `status === 'all'` / insights need full history. |
| `simCards/SimCardsListPage.jsx` | `SimCardsListPage` | `fetchSimCardsPaginated` | `sim_cards` (+ embed) | **Yes** | **`.range`** + **`count: 'exact'`** (e.g. 100/page) | **large** (2500+ SIMs) | — | Keep. (Export/import paths may still call `fetchSimCards`; that’s separate.) |
| `customers/CustomersListPage.jsx` | `CustomersListPage` | `fetchAllSites` | `customer_sites` (+ `customers(...)`) | **No** | Full table / RPC search only when `search` non-empty | **large** (sites ≈ customers × locations) | One response for **all** sites when search empty; grows with business. | **Paginated** `fetchAllSites` + URL `page` / `range`; or default `search` required for full list. |
| `proposals/ProposalsListPage.jsx` | `ProposalsListPage` | `fetchProposals` | `proposals_detail` | **No** | — | medium–**large** | Loads **every** proposal row for tab filters; JSON and DB cost scale with years of quotes. | **`fetchProposalsPaginated`** + `range` + `count`; align filters server-side (already mostly). |
| `finance/IncomePage.jsx` | `IncomePage` | `fetchTransactions` via `useTransactions` | `financial_transactions` (+ joins in `TRANSACTION_SELECT`) | **No** | **`limit` only if passed in filters** — page **does not** pass `limit` | **medium–large** | One month can still be **hundreds+** ledger lines; table + KPIs over full array. | **`limit` + offset paging** or cursor; or cap + “load more”. |
| `finance/ExpensesPage.jsx` | `ExpensesPage` | same `fetchTransactions` | same | **No** | same | **medium–large** | same | same |
| `finance/ReportsPage.jsx` | `ReportsPage` | `fetchProfitAndLoss` | `v_profit_and_loss` | **Bounded by period** | One **month** (or filter) — not classic page nav | **medium** per month | Month-wide P&amp;L row count can still be large; usually acceptable vs full table scan lists. | Optional pagination if single-month row count &gt; ~500; or aggregate RPC for summary view. |
| `finance/VatReportPage.jsx` | `VatReportPage` | `fetchVatReport` (hook) | `vat_report` / P&amp;L-derived | **Aggregated by period** | Not a raw row list in the same sense | **small–medium** | Less critical than ledger lists. | Paginate only if UI shows huge tables. |
| `finance/CollectionDeskPage.jsx` | `CollectionDeskPage` | `fetchCollectionPayments` | `subscription_payments` (+ nested joins) | **No** | Fetches **all** `status = 'pending'` (optional month filter) | **medium–large** | Pending queue across months can be **big**; single payload. | **Server pagination** + filters; keep stats in separate **count RPC**. |
| `notifications/NotificationsCenterPage.jsx` | `NotificationsCenterPage` | `fetchActiveNotifications` / `fetchResolvedNotifications` | `v_active_notifications` / `notifications` | **Yes** | **`.range(from, to)`** with **page state**; **load more** when page full (20) | medium (growth over time) | — | Adequate pattern; tune `pageSize` if needed. |
| `pages/DashboardPage.jsx` | `DashboardPage` + children | Various | — | **N/A (not full list pages)** | **RPCs** / small lists: e.g. `get_my_pending_tasks({ limit_count: 5 })`, `get_today_schedule`, `get_overdue_subscription_payments` | **tiny** (widgets) | Overdue RPC could return many rows — **server** should cap or dashboard should slice. | Ensure **SQL limit** on `get_overdue_subscription_payments`; keep widgets **small**. |
| `dashboard/components/TodayTaskChecklist.jsx` | Widget | `fetchPendingTasks` → `get_my_pending_tasks` | RPC | **Yes (server limit)** | **`limit_count: 5`** | **tiny** | — | OK. |
| `dashboard/components/TodayScheduleFeed.jsx` | Widget | `fetchTodaySchedule` → `get_today_schedule` | RPC | **Implicit (today)** | Not client paginated | **tiny** | — | OK if RPC bounds rows. |
| `dashboard/components/OverduePaymentsList.jsx` | Widget | `fetchOverduePayments` → `get_overdue_subscription_payments` | RPC | **Unknown without migration** | No client `range` | **small–medium** | If RPC returns unbounded rows, card could be heavy. | **Limit in RPC** + link to collection desk. |

---

## Other notable list pages (still ERP lists)

| File path | Page | API | Source | Pagination? | Risk | Notes |
|-----------|------|-----|--------|--------------|------|--------|
| `siteAssets/SiteAssetsListPage.jsx` | `SiteAssetsListPage` | `fetchAssets` | `site_assets_detail` | **No** | **medium–large** | All assets in view unless filtered. |
| `materials/MaterialsListPage.jsx` | `MaterialsListPage` | `fetchMaterials` | `materials` | **No** | **medium** | Whole catalog for combobox-heavy app. |
| `tasks/TasksPage.jsx` | `TasksPage` | `fetchTasks` | `tasks_with_details` | **No** | **medium** | Grows with usage. |
| `workHistory/WorkHistoryPage.jsx` | `WorkHistoryPage` | `searchWorkHistory` | **`search_work_history` RPC** | **No** | **medium–large** | RPC returns set; **extra client-side filtering** — still one big round-trip. |
| `finance/RecurringExpensesPage.jsx` | `RecurringExpensesPage` | `useRecurringTemplates` | templates table | **No** | **tiny** | Low priority. |
| `workOrders/DailyWorkListPage.jsx` | `DailyWorkListPage` | `useDailyWorkList` → RPC | **date-scoped** | **Implicit** | **tiny** | Week/day bounded. |

---

## Prioritized: paginate **first** (biggest pain × traffic)

1. **`CustomersListPage`** — `fetchAllSites` loads **all** sites with embeds when search is empty (**large** exposure).  
2. **`ProposalsListPage`** — full **`proposals_detail`** list, no **`range`** (**large** over time).  
3. **`CollectionDeskPage`** — **`fetchCollectionPayments`** can return **all** pending payments across months (**large**).  
4. **`IncomePage` / `ExpensesPage`** — **`fetchTransactions`** for a period with **no** default **`limit`** (**large** ledger months).  
5. **`SiteAssetsListPage`** — **`fetchAssets`** unbounded (**medium–large**).  
6. **`PriceRevisionPage` (useSubscriptions)** — **500-row cap** is not pagination; risk of **wrong/incomplete** data (**large** if &gt;500 subs).  
7. **`MaterialsListPage`** — full **`materials`** pull (**medium**).  
8. **`TasksPage`** — **`tasks_with_details`** unbounded (**medium**).  
9. **`WorkHistoryPage`** — RPC + client filter; needs **server-side paging** if history is long (**medium–large**).  
10. **`RequestPoolTab` / operations** — replace fixed **`.range(0, 99)`** with real **pagination** or documented “max 100” UX (**medium**).

**Already in good shape for list UX:** **`SubscriptionsListPage`**, **`WorkOrdersListPage`**, **`SimCardsListPage`**, **`NotificationsCenterPage`** (range + load more).

**Dashboard list widgets:** rely on **RPC limits** — verify **`get_overdue_subscription_payments`** (and similar) have a **SQL LIMIT** so the dashboard never pulls an unbounded list.

---

No code was changed; scope stays list fetching and pagination only.

analysis 3:


## React Query waterfall audit (read-only)

Below, **“serialized”** means network for query B effectively starts only after A has produced an input (via `enabled`, derived IDs, or the child not mounting until after a loading gate).

---

### 1. `src/features/subscriptions/SubscriptionDetailPage.jsx` — **SubscriptionDetailPage**

| Item | Detail |
|------|--------|
| **Query keys** | `subscriptionKeys.detail(id)`, `subscriptionKeys.revisionNotes(id)`, `subscriptionKeys.detail(id) + 'pendingCount'`, `['currentProfile']`, `subscriptionKeys.list({ site_id })`, `workOrderKeys…`, `customerSites? / assets…` via `useAssetsBySite` |
| **Why serialized** | `useSubscriptionsBySite`, `useWorkOrdersBySite`, `useAssetsBySite` use `subscription?.site_id` with **`enabled: !!siteId`** in hooks — `site_id` only exists after `useSubscription` resolves. Tabs get `siteId` from loaded `subscription` too. **`if (isLoading) return <DetailSkeleton />`** also defers mounting **MonthlyPaymentGrid** and **StaticIpCard**, so **`useSubscriptionYearSchedule`** and static-IP queries start later than they could (route already has `id`). |
| **Acceptable?** | Partially. Needing `site_id` for site-scoped lists is a real data dependency unless the URL or a lighter endpoint provides it. Deferring the whole page body is a UX choice but it **extends** time-to-first-byte for schedule/static IP. |
| **Strategy** | **Parallel fetch**: expose `site_id` without waiting for full subscription row (e.g. `siteId` query param from list links, or minimal `fetchSubscriptionMeta`). **Prefetch** subscription detail from the list row. **Split**: tiny “header” query + heavier joins. Render **MonthlyPaymentGrid** with `subscriptionId={id}` from `useParams` above the loading gate so schedule runs in parallel with `useSubscription`. |

---

### 2. `src/features/customers/CustomerDetailPage.jsx` — **CustomerDetailPage**

| Item | Detail |
|------|--------|
| **Query keys** | `customerKeys.detail(id)`, `siteKeys…`, `workOrderKeys.byCustomer`, `simCards…`, `subscriptionKeys.listByCustomer`, `assets…`, `paymentMethodKeys…`, `[…'pendingInsights', sortedKey]`, `[…'auditLogs', sortedIds]` |
| **Why serialized** | **`usePendingPaymentInsights(subscriptionIdsAll)`** — `enabled` requires non-empty `subscriptionIds`; IDs come from **`useCustomerSubscriptions`**, so insights run **after** subscriptions load. **`useCustomerAuditLogs`** is enabled with `!!customerId && isAdmin` but **does not** wait for subscriptions; the **queryKey includes `sortedIds`**, so it first runs with **empty ids**, then **refetches** when `customerSubscriptions` arrives (double work / staggered completion). |
| **Acceptable?** | Insights dependency on subscription IDs is **avoidable** at API level. Audit double-fetch is **avoidable**. |
| **Strategy** | **Derived / API**: `fetchPendingPaymentInsightsForCustomer(customerId)` so one query parallels the rest. **Fix audit**: enable audit only when subscriptions settled, or **one** `fetchCustomerRelatedAuditLogs(customerId)` without needing client-side id list for the key. |

---

### 3. `src/features/workOrders/WorkOrderDetailPage.jsx` — **WorkOrderDetailPage**

| Item | Detail |
|------|--------|
| **Query keys** | `workOrderKeys.detail(id)`; **`workOrderKeys.auditLogs(id)`** only inside **WorkOrderActivityTimeline** |
| **Why serialized** | **`if (isLoading) return <WorkOrderDetailSkeleton />`** — **`WorkOrderActivityTimeline`** (and thus **`useWorkOrderAuditLogs(workOrderId)`**) is **not mounted** until `useWorkOrder` succeeds, even though **`id` from `useParams`** is enough to enable the audit query. |
| **Acceptable?** | Slight UX simplification; **performance-wise avoidable**. |
| **Strategy** | **Parallel fetch**: call **`useWorkOrderAuditLogs(id)`** at page level (same as detail) or render timeline with `id` above the gate. |

---

### 4. `src/features/subscriptions/components/MonthlyPaymentGrid.jsx` — **MonthlyPaymentGrid**

| Item | Detail |
|------|--------|
| **Query keys** | `subscriptionKeys.schedule(subscriptionId, year)` |
| **Why serialized** | On detail page, grid is under **`if (isLoading) return …`** on parent, so schedule fetch starts only after main subscription query completes (not because of `enabled`, because of **mount order**). |
| **Acceptable?** | **Avoidable** for latency; business logic does not require full subscription row to call **`get_subscription_year_schedule(id, year)`**. |
| **Strategy** | **Parallel fetch**: mount grid with **`subscriptionId` from route** before parent finishes loading. |

---

### 5. `src/features/subscriptions/components/StaticIpCard.jsx` — **StaticIpCard**

| Item | Detail |
|------|--------|
| **Query keys** | `['staticIp', simCardId]`, `['staticIpHistory', simCardId]` (history gated on `showHistory`) |
| **Why serialized** | `simCardId` comes from **`subscription.sim_card_id`**, so static IP queries start after subscription is loaded; card is also **not rendered** until past parent loading gate. |
| **Acceptable?** | Only if SIM must be validated against subscription; otherwise **prefetch** or parallel if `sim_card_id` can be known earlier (e.g. denormalized on list → detail navigation). |
| **Strategy** | **Prefetch** on subscription list row if SIM id is present; or **split** subscription payload so `sim_card_id` arrives in a fast first field (same as #1). |

---

### 6. `src/features/subscriptions/tabs/SubscriptionWorkOrdersTab.jsx` / **SubscriptionAssetsTab** (same pattern)

| Item | Detail |
|------|--------|
| **Query keys** | `workOrderKeys.bySite(siteId)` / assets equivalent |
| **Why serialized** | `siteId` is **`subscription.site_id`** after main subscription loads (same as page-level `useWorkOrdersBySite(subscription?.site_id)` — React Query **dedupes**, but work still **starts** only once `site_id` is known). |
| **Acceptable?** | Same as subscription detail **site_id** dependency. |
| **Strategy** | Same as #1 (**siteId in URL**, lighter meta, **prefetch**). |

---

### 7. `src/features/proposals/ProposalDetailPage.jsx` — **ProposalDetailPage**

| Item | Detail |
|------|--------|
| **Query keys** | `proposalKeys.detail(id)`, `proposalKeys.items(id)`, `proposalKeys.annualFixed(id)`, `proposalKeys.workOrders(id)` |
| **Why serialized** | **`if (isLoading)`** only keys off **`useProposal`**; **items / annual / work orders** use the same **`id`** and **`enabled: !!id`** — they **run in parallel** with the main proposal query. |
| **Acceptable?** | **Yes** — good pattern. |
| **Strategy** | None required for waterfalls; optional **single** heavier `select` / combined endpoint only if optimizing round-trips. |

---

### 8. `src/features/finance/FinanceDashboardPage.jsx` + **`OverviewTab`**

| Item | Detail |
|------|--------|
| **Query keys** | `dashboardV2Keys.overview(…)`, `dashboardV2Keys.channel(…)`, `dashboardV2Keys.generalExpenses(…)`, `financeDashboardKeys.revenueExpenses(…)` |
| **Why serialized** | **Overview**: `useOverviewTotals`, `useGeneralExpenses`, `useRevenueExpensesByMonth` — **parallel** (all need `year`). **`useChannelMetrics`** — **`enabled: !!channel && !!year`**; on **overview** tab `channel` is null so channel query is idle — **intentional**, not a waterfall bug. |
| **Acceptable?** | **Yes**. |
| **Strategy** | Prefetch channel data when user hovers sub-tabs if you want snappier tab switches. |

---

### 9. `src/features/finance/ReportsPage.jsx` / **`VatReportPage.jsx`**

| Item | Detail |
|------|--------|
| **Query keys** | `profitAndLossKeys…`, `vatReportKeys…` |
| **Why serialized** | Single main **`useProfitAndLoss` / `useVatReport`** per page; no A→B chain in the shell. |
| **Acceptable?** | **Yes**. |

---

### 10. `src/features/finance/CollectionDeskPage.jsx` — **CollectionDeskPage**

| Item | Detail |
|------|--------|
| **Query keys** | `collectionKeys.list(filters)`, `collectionKeys.stat(filters)` |
| **Why serialized** | Both use the same **`filters` object`; both **run together** — **no** dependency chain. |
| **Acceptable?** | **Yes**. |

---

### 11. `src/features/operations/components/QuickEntryRow.jsx` — **QuickEntryRow**

| Item | Detail |
|------|--------|
| **Query keys** | `customerKeys.list({ search })`, `customerSites` / **`useSitesByCustomer(selectedCustomer?.id)`** |
| **Why serialized** | Sites **`enabled: !!customerId`** — must pick customer first. |
| **Acceptable?** | **Yes** (UX / data dependency). |

---

### 12. `src/features/operations/OperationsBoardPage` / **service request “detail”**

| Item | Detail |
|------|--------|
| **Query keys** | `serviceRequestKeys.list(filters)` etc.; **`useServiceRequest(id)`** exists in hooks but **is not used** in `src` (no dedicated service-request detail route). |
| **Why serialized** | N/A for a detail page waterfall; board is list-centric. |
| **Acceptable?** | **Yes**. |

---

### 13. `src/features/simCards/SimCardFormPage.jsx` / **`SubscriptionFormPage`**, **`WorkOrderFormPage`**

| Item | Detail |
|------|--------|
| **Query keys** | **`useSitesByCustomer(selectedCustomerId)`**, **`useSite(selectedSiteId)`**, **`useSimCard(simCardId)`**, etc. |
| **Why serialized** | **`enabled`** tied to **form `watch`** — intentional. |
| **Acceptable?** | **Yes** for forms. |

---

## Top 10 waterfall bottlenecks (ranked)

1. **CustomerDetailPage** — subscription list → **pending payment insights**; **audit logs** refetch when subscription IDs appear; **many parallel** queries already ⇒ perceived slowness + extra round-trip.  
2. **SubscriptionDetailPage** — **`site_id`** gates **site subscriptions + work orders + assets** (three lanes) after main subscription.  
3. **SubscriptionDetailPage** — **loading gate** defers **year schedule** (`MonthlyPaymentGrid`) and **static IP** unnecessarily relative to route `id  
4. **WorkOrderDetailPage** — **audit timeline** starts only after **`useWorkOrder`** due to **mount order**, not data dependency.  
5. **Subscription tabs** (work/  

---  

I need to fix item 5 rank - SubscriptionWorkOrdersTab is duplicate of #2 essentially. Let me merge: rank 2 = site_id trio, rank 3 = grid/static delayed mount.

6. **StaticIpCard** on subscription detail (subset of #3/#2 but worth noting SIM-specific latency).  
7. **QuickEntryRow** sites-after-customer (acceptable, lower traffic than detail pages).  
8. **SimCardFormPage** / **SubscriptionFormPage** watch-gated queries (acceptable).  
9. **Finance dashboard** channel query off on overview (by design).  
10. **Proposal detail** — **least concern** (parallel sub-queries); listed last as “baseline good” to contrast.

I'll output clean top 10 without duplicate - combine subscription site trio and monthly grid into one entry or split:

Refined top 10:
1. CustomerDetailPage insights + audit double-fetch  
2. SubscriptionDetailPage site_id → 3 parallel but delayed queries  
3. SubscriptionDetailPage / MonthlyPaymentGrid + StaticIpCard mount delay  
4. WorkOrderDetailPage audit logs mount delay  
5. SubscriptionWorkOrdersTab / AssetsTab (same site_id - already in 2, so skip or note as "same root cause as #2")  
6. QuickEntryRow  
7. ProposalFormPage useCustomer(selectedCustomerId) - only when creating - low  
8. SimCardFormPage  
9. Operations board - no major waterfall  
10. Finance - parallel OK

Actually top 10 should be bottlenecks only:

1. Customer detail - insights + audits  
2. Subscription detail - site_id cascade  
3. Subscription detail - deferred schedule + static IP  
4. Work order detail - audit logs  
5. (Combine) duplicate site-scoped fetches conceptually same as 2  
I'll put **ProposalFormPage parallel proposal/items/annual** as non-issue

Fill 5-10 with smaller issues:

5. **SubscriptionFormPage** `useSite` / `useSimCard` after form hydration from `useSubscription` (edit mode: subscription loads then site/sim - minor)  
6. **WorkOrderFormPage** `useSite(selectedSiteId)` after work order load  
7. **QuickEntryRow**  
8. **StaticIpCard** history lazy `showHistory` - intentional lazy load OK  
9. **useCustomer(selectedCustomerId)** in ProposalForm create flow  
10. **InsightsTab** single `useOperationsStats` - no waterfall

Let me verify SubscriptionFormPage edit: useSubscription loads, then reset sets site_id - useSite(selectedSiteId) enables after - that's a small waterfall on edit.

I'll deliver the refined list 1-10 for the user.
`</think>`
## React Query waterfall audit — `ornet-erp`

**Goal:** Map serialized (A → B) fetching, `enabled: !!dataFromA`, and “could be parallel but isn’t” cases on high-traffic surfaces. **No code changes.**

---

### Case studies (prioritized)

**1. `src/features/customers/CustomerDetailPage.jsx` · `CustomerDetailPage`**  
- **Keys:** `customerKeys.detail(id)`, `subscriptionKeys.listByCustomer(id)` (+ other parallel `id`-scoped lists), `[..., 'pendingInsights', sortedKey]`, `[..., 'auditLogs', sortedIds]`.  
- **Serialized:** `usePendingPaymentInsights` only runs when `subscriptionIdsAll.length > 0`, so it waits on `useCustomerSubscriptions`. `useCustomerAuditLogs` is enabled from `customerId` + `isAdmin` but the **key includes subscription ids**, so you get an early run with **empty** ids and a **second** fetch when subscriptions arrive.  
- **Verdict:** Insights chain is **avoidable** with a customer-scoped API; audit pattern is **avoidable** (stabilize key or gate until subscriptions are ready).  
- **Strategy:** **Derived / one query** by `customer_id`; fix **audit** enabling/keying so you don’t double-fetch.

**2. `src/features/subscriptions/SubscriptionDetailPage.jsx` · `SubscriptionDetailPage`**  
- **Keys:** `subscriptionKeys.detail(id)` then `subscriptionKeys.list({ site_id })`, `workOrderKeys.bySite(site_id)`, assets-by-site; parallel: `subscriptionKeys.revisionNotes(id)`, `[..., 'pendingCount']`, `['currentProfile']`.  
- **Serialized:** `site_id` only exists after `useSubscription`, and hooks use `enabled: !!siteId` → **three list queries start after** the header query.  
- **Verdict:** **Partly acceptable** (true dependency on `site_id`), **partly avoidable** if `site_id` is passed from list navigation or a lighter/meta fetch.  
- **Strategy:** **Prefetch** from list; **parallel** via **URL `siteId`** or **split** “meta + heavy” subscription fetch.

**3. Same file · deferred children (schedule + static IP)**  
- **Keys:** `subscriptionKeys.schedule(id, year)`, `['staticIp', simCardId]`.  
- **Serialized:** Parent **`if (isLoading) return <DetailSkeleton />`** prevents mounting `MonthlyPaymentGrid` / `StaticIpCard` until `useSubscription` finishes, even though **`id` is already in the route** and schedule only needs `subscriptionId + year`. Static IP waits on `subscription.sim_card_id`.  
- **Verdict:** Schedule vs route `id` is **avoidable**; SIM id **avoidable** only if you can know it earlier (payload, list row, param).  
- **Strategy:** **Parallel fetch** by mounting grid with **`id` from `useParams`** above the gate; **prefetch** subscription on link hover.

**4. `src/features/workOrders/WorkOrderDetailPage.jsx` · `WorkOrderDetailPage`**  
- **Keys:** `workOrderKeys.detail(id)`; `workOrderKeys.auditLogs(id)` inside `WorkOrderActivityTimeline`.  
- **Serialized:** Early return while `useWorkOrder` is loading **unmounts** the timeline, so **`useWorkOrderAuditLogs` does not start** until the main query completes — **not required** for correctness because **`id` from `useParams` is available immediately**.  
- **Verdict:** **Avoidable** structural waterfall.  
- **Strategy:** **Parallel fetch:** run `useWorkOrderAuditLogs(id)` at page level or render timeline with `id` before the loading gate.

**5. `src/features/subscriptions/tabs/SubscriptionWorkOrdersTab.jsx` / `SubscriptionAssetsTab`**  
- **Keys:** `workOrderKeys.bySite(siteId)` / site assets.  
- **Serialized:** `siteId` comes from loaded `subscription` (same root cause as **#2**; React Query may **dedupe** with page-level `useWorkOrdersBySite(subscription?.site_id)` but **start time** is still after `site_id` exists).  
- **Verdict:** Same as **#2**.  
- **Strategy:** Same as **#2**.

**6. `src/features/proposals/ProposalDetailPage.jsx` · `ProposalDetailPage`**  
- **Keys:** `proposalKeys.detail(id)`, `proposalKeys.items(id)`, `proposalKeys.annualFixed(id)`, `proposalKeys.workOrders(id)` — all use route `id`.  
- **Serialized:** Skeleton only waits on **`useProposal`**; **other queries run in parallel** (`enabled: !!id`).  
- **Verdict:** **Acceptable**; strong pattern.  
- **Strategy:** Optional **single** combined endpoint only if you want fewer HTTP calls.

**7. `src/features/finance/FinanceDashboardPage.jsx` (+ `components/dashboard/OverviewTab.jsx`)**  
- **Keys:** `dashboardV2Keys.overview`, `dashboardV2Keys.generalExpenses`, `financeDashboardKeys.revenueExpenses`, `dashboardV2Keys.channel(…)`.  
- **Serialized:** **None** between overview KPIs and expenses/month series — they run **together**. Channel metrics use `enabled: !!channel` → **idle on overview tab** by design.  
- **Verdict:** **Acceptable**.  
- **Strategy:** Optional **prefetch** channel when hovering sub-tabs.

**8. `src/features/finance/ReportsPage.jsx` · `VatReportPage.jsx` · `CollectionDeskPage.jsx`**  
- **Keys:** P&amp;L / VAT / `collectionKeys.list` + `collectionKeys.stat`.  
- **Serialized:** **None** meaningful (collection **payments + stats** are **parallel**).  
- **Verdict:** **Acceptable**.

**9. `src/features/operations/components/QuickEntryRow.jsx` · `QuickEntryRow`**  
- **Keys:** `customerKeys.list(…)`, then sites via **`useSitesByCustomer(selectedCustomer?.id)`** (`enabled: !!customerId`).  
- **Serialized:** **Yes** — pick customer → load sites.  
- **Verdict:** **Acceptable** (real dependency + low frequency vs detail pages).  

**10. `src/features/operations/hooks.js` · `useServiceRequest(id)`**  
- **Note:** **No** detail page in the app uses it (only the hook exists); the board is list-driven. **No** service-request detail waterfall to report.

**11. Forms: `SimCardFormPage.jsx`, `SubscriptionFormPage.jsx`, `WorkOrderFormPage.jsx`, `ProposalFormPage.jsx`**  
- **Serialized:** `useSitesByCustomer`, `useSite`, `useSimCard`, `useCustomer` tied to **`watch`/selection** — **acceptable** for forms. **ProposalFormPage** still loads `useProposal` + `useProposalItems` + `useProposalAnnualFixedCosts` **in parallel** on edit.

**12. `src/features/subscriptions/components/StaticIpCard.jsx` · `StaticIpCard`**  
- **Keys:** `['staticIp', simCardId]`; history with `enabled: !!simCardId && showHistory`.  
- **Serialized:** Depends on parent providing `simCardId` (see **#3**). History gating is **lazy-by-design**.  
- **Verdict:** Parent timing **matters**; expander lazy load **acceptable**.

---

## Top 10 waterfall bottlenecks (ranked)

| Rank | Location | Main issue |
|------|----------|------------|
| 1 | `CustomerDetailPage.jsx` | **Pending insights** wait on subscription list; **audit logs** likely **double-fetch** when subscription IDs appear. |
| 2 | `SubscriptionDetailPage.jsx` | **`site_id`** unlocks **site subscriptions + work orders + assets** — full second wave after primary subscription query. |
| 3 | `SubscriptionDetailPage.jsx` | **Loading gate** delays **year schedule** and **static IP** despite route **`id`** (structural delay). |
| 4 | `WorkOrderDetailPage.jsx` | **Audit logs** only mount after **work order** loads; **`id` was already known**. |
| 5 | Subscription tabs (`SubscriptionWorkOrdersTab` / `SubscriptionAssetsTab`) | Same **`site_id`** dependency as rank **2** (deduped cache, late start). |
| 6 | `SubscriptionFormPage.jsx` (edit) | **`useSite` / `useSimCard`** follow **`watch`** after `useSubscription` hydrates the form — secondary wave. |
| 7 | `WorkOrderFormPage.jsx` (edit) | **`useSite(selectedSiteId)`** follows loaded / changed site — minor cascade. |
| 8 | `SimCardFormPage.jsx` | **`useSitesByCustomer` + `useCustomer`** after SIM/customer fields — form-driven, smaller impact. |
| 9 | `QuickEntryRow.jsx` | Customer → sites — **acceptable** sequential UX. |
| 10 | `FinanceDashboardPage.jsx` | **Channel** query off on overview — **not** a bug; small **tab-switch** latency only. |

**Bright spot:** **`ProposalDetailPage`** already runs **proposal + items + annual fixed + linked work orders** in **parallel** on the same `id` — use it as the reference pattern for other detail shells.

analysis 4:

Here is a **database-only** optimization review based on your migrations and view/RLS definitions (no SQL changes).

---

## 1. Heavy views (definitions & shape)

### `public.v_active_notifications` (`00066_notification_views_functions.sql`)
- **Shape:** Large `UNION ALL` of **many** branches: **three** separate `work_orders` scans (open future, overdue, today not started), **four** `proposals` scans (all with `customer_sites` + `customers`), one `NOT EXISTS` on `proposal_work_orders`, plus `notifications` and `user_reminders`.
- **Joins:** Repeated `work_orders → customer_sites → customers` and `proposals → customer_sites → customers`.
- **Select:** Derives title/body strings in SQL (fine for correctness, but work is repeated per branch).
- **Filtering / indexes:** Predicates use `status`, `scheduled_date`, `sent_at`, `resolved_at`, etc. Individual indexes exist on some columns, but the view **does not share work** between branches — each arm is planned separately.
- **RLS:** Outer filter `WHERE get_my_role() IN ('admin', 'accountant')` — **all UNION arms still run** for eligible roles; for others you still evaluate the inner union then drop rows (role filter is cheap; **base scans are not**).
- **Symptom:** Slow **notification center / badge** loads; rising CPU as `work_orders` / `proposals` grow.
- **Severity:** **Critical**
- **Fix direction:** Replace monolithic view with **targeted queries** or **materialized snapshot** / scheduled job; collapse duplicate WO scans into **one CTE** with conditional flags; ensure badge RPC does **not** run the full union when only counts are needed.

---

### `public.subscriptions_detail` (`00143_add_payment_start_month.sql` — latest redefine found)
- **Shape:** `sub.*` plus ~6 joins (`customer_sites`, `customers`, `payment_methods`, three `profiles`, `sim_cards`) and **two correlated subqueries per row**:
  - `static_ip_address` → `sim_static_ips` filtered by `sim_card_id`
  - `has_overdue_pending` → `subscription_payments` by `subscription_id` + `status` + `payment_month`
- **Joins:** Many; profile joins multiply row width.
- **Select:** **`sub.*`** forces **all** base columns on every list/detail read — typical ORM `select('*')` from this view is **maximally wide**.
- **Indexes:** `subscriptions(site_id)`, `subscription_payments(subscription_id)`, `sim_static_ips(sim_card_id)` help nested lookups; **correlated EXISTS** still scales with **subscriptions × payments** unless planner uses very selective paths.
- **Partial `deleted_at`:** `subscriptions` has **no** `deleted_at` in current design; filtering is by `status` — your **`00168`** partial indexes on `status` / `(site_id)` for active-ish rows are the right idea.
- **Symptom:** Slow **subscription list**, collection views, exports; high I/O when many rows are fetched.
- **Severity:** **High**
- **Fix direction:** **Narrow projections** (replace `sub.*` with explicit column lists in API/view variants); **precompute** overdue flag or static IP on table or **small side view**; **list vs detail** split.

---

### `public.site_assets_detail` (`00157_phase2_new_site_assets_schema.sql`)
- **Shape:** `LEFT JOIN LATERAL` to pick **one** `subscriptions` row per asset (`WHERE site_id = sa.site_id` + `ORDER BY` status priority + `created_at` + `LIMIT 1`).
- **Joins:** `site_assets → customer_sites → customers` + **per-row lateral** subscription probe.
- **Risk:** **O(assets × lateral subscription sort)** — hot path on sites with many equipment rows.
- **Symptom:** Slow **equipment / site asset** screens when quantity of rows grows.
- **Severity:** **High** (for large sites)
- **Fix direction:** **Denormalize** `subscription_id` / status on `site_assets` if business allows; or **single** grouped subquery / DISTINCT ON in a **CTE** instead of per-row LATERAL; or **defer** subscription columns to a second query.

---

### `public.proposals_detail` (`00092_turkish_search_normalization.sql` — latest full redefine found)
- **Shape:** Explicit proposal columns + `LEFT JOIN` sites/customers + **correlated** `COUNT` / `bool_all` subqueries on `proposal_work_orders` + `work_orders`.
- **Joins:** Moderate; subqueries dominate per-row cost.
- **Select:** Recomputes `normalize_tr_for_search(...)` on **title / company / proposal_no** in the view (unlike `work_orders_detail`, which was refactored to use **stored generated** columns for index-friendly search — see `00100`).
- **Symptom:** Slow **proposal list** when many rows; search may not use trigram indexes if expressions are not stored columns.
- **Severity:** **Medium–High**
- **Fix direction:** Mirrors **`00100` pattern**: stored generated search columns + trigram; **replace correlated subqueries** with aggregated joins or **maintenance columns** (counts / “all complete” flags).

---

### `public.work_orders_detail` (`00100_optimize_work_orders_view.sql`)
- **Shape:** Fixed earlier pain: **LATERAL** instead of correlated JSON agg; uses **stored** `company_name_search`, `account_no_search`, `form_no_search`; trigram + partial indexes on `deleted_at IS NULL`.
- **Remaining risk:** Still **one LATERAL** over `profiles` per WO row; **RLS** on `work_orders` uses `auth.uid() = ANY(assigned_to)` — mitigated by **GIN on `assigned_to`** in same migration.
- **Symptom:** Usually acceptable; regressions if lists **stop using** indexed columns or add unsargable filters.
- **Severity:** **Medium** (mostly under control)
- **Fix direction:** Keep list queries **sargable**; consider **narrow** list view if `assigned_workers` JSON not needed in tables.

---

### `public.v_profit_and_loss` (`00150_fix_v_pnl_double_counting.sql`)
- **Shape:** `UNION ALL` of **income** and **expense** arms, both from **`financial_transactions`**; expense arm **`LEFT JOIN expense_categories`**.
- **Risk:** **Large ledger** → both branches scan filtered `financial_transactions`; **`00168`** `(transaction_date DESC, direction)` and partial income indexes align with typical reporting filters.
- **Symptom:** Slow **P&amp;L / reports** for wide date ranges if stats are stale or filters don’t match indexes.
- **Severity:** **Medium–High** (grows with time)
- **Fix direction:** **Partitioning** or **rolling aggregates** for very large history; confirm app filters match index leading columns; **`ANALYZE`** after bulk loads.

---

### `public.service_requests_detail` (`00160_service_requests.sql`)
- **Shape:** 4 **`LEFT JOIN`s** (`customers`, `customer_sites`, `profiles`, `work_orders`); view embeds `WHERE sr.deleted_at IS NULL` (redundant with RLS but keeps planner hints).
- **Severity:** **Low–Medium** (pool is often range-limited in app)
- **Fix direction:** Ensure list API uses **indexed filters** (`status`, `region`, etc. — migration adds several); avoid `SELECT *` from view for cards.

---

### `public.customer_sites_list` + `search_customer_sites` (`00138_search_customer_sites_rpc.sql`)
- **Shape:** `cs.*` + join to `customers`; RPC does **multi-column `ILIKE '%'||query||'%'`** — needs **trigram** support (you have search columns / indexes elsewhere; verify they cover these three columns together).
- **Symptom:** Slow **combobox search** under load.
- **Severity:** **Medium**
- **Fix direction:** Confirm **GIN (pg_trgm)** on `account_no_search`, `site_name_search`, `company_name_search`; consider **ranked / limit** strategy only (already `ORDER BY created_at DESC`).

---

### `public.view_sim_card_financials` (`00152_fix_sim_financial_view.sql`)
- **Shape:** Single **`SUM`/`COUNT`** over `sim_cards` with `status IN ('active','subscription')`.
- **Severity:** **Low** at current scale (~2.5k rows); becomes **Medium** if SIM inventory grows large without partial index on `(status)` including financial columns.
- **Fix direction:** Partial index on **`status`** for reporting slice if needed.

---

### `public.tasks_with_details` (`00015` + `00097` security invoker)
- **Shape:** `t.*` + 4 joins — moderate; OK for task volume.
- **Severity:** **Low**

---

## 2. Partial indexes and `deleted_at`

- **Strong pattern:** Many tables use **`WHERE deleted_at IS NULL`** partial indexes (`work_orders`, `customers`, `financial_transactions`, `tasks`, etc.) — appropriate for soft-delete + “active only” queries.
- **`subscriptions`:** No `deleted_at`; **`00168`** correctly uses **`status IN ('active','paused')`** partials — align all subscription list queries with these predicates where possible.
- **Gap risk:** Any query that filters **`deleted_at IS NULL`** on a table **without** matching partial index still **scans**; audit app SQL for consistency (not done in migrations alone).

---

## 3. RLS overhead

### `get_my_role()` (`00001_profiles.sql`)
- **Definition:** `STABLE` **`SECURITY DEFINER`** `SELECT role FROM profiles WHERE id = auth.uid()`.
- **Impact:** One indexed lookup per “policy evaluation context”; **`00168`** `idx_profiles_id_role (id, role)` directly targets this.
- **Symptom:** Noticeable only with **very high row counts** per statement if PostgreSQL doesn’t fold repeated calls (usually acceptable).
- **Severity:** **Low** (after `00168`)
- **Fix direction:** Keep **single** role helper; avoid duplicating **`EXISTS (SELECT … FROM profiles …)`** patterns elsewhere.

### `service_requests` (`00160`)
- **INSERT/UPDATE** policies use **`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (...))`** instead of **`get_my_role()`** — **extra pattern**, same cost class, **harder to optimize consistently**.
- **Severity:** **Low**
- **Fix direction:** Standardize on **`get_my_role()`** for parity with the rest of the schema.

### `work_orders` (`00083`)
- **`USING (deleted_at IS NULL AND (get_my_role() … OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid()))`** — **`ANY`** on arrays benefits from **GIN** (you have it in `00100` / `00009`).
- **Severity:** **Low–Medium** if `assigned_to` arrays grow huge (unusual).

### `financial_transactions` (`00116`)
- **`deleted_at IS NULL AND get_my_role() IN (...)`** — simple; **partial indexes** on `financial_transactions` plus **role** check are a good combo.

### Finance-locked tables (`00119`–`00125`, etc.)
- Heavy use of **`get_my_role() IN ('admin','accountant')`** on **wide reads** (subscriptions, payments, proposals) — cost is dominated by **base table access**, not the role check, once **`profiles`** index exists.

---

## 4. Large tables & VACUUM / ANALYZE / bloat risk (by workload)

| Table | Why risky | User-visible symptom | Note |
|--------|-----------|----------------------|------|
| **`financial_transactions`** | Constant inserts/updates from triggers, payments, recurring, WO/proposal flows | Reports / dashboard lag, autovacuum backlog | **ANALYZE** after bulk backfills; watch dead tuples |
| **`subscription_payments`** | Status flips, collection desk, schedule RPC | Slow payment grid / overdue queries | HOT updates possible on narrow rows |
| **`audit_logs`** | Append-heavy | Slower admin audit UIs; table bloat over years | **Partitioning** or archiving strategy long-term |
| **`work_orders`** | High read/write, soft deletes | List/search sluggish | Already well indexed in `00100` |
| **`sim_cards`** | Large imports, 2500+ rows | List/invoice analysis slow if unindexed filter | Trigram + status indexes exist |
| **`notifications` / `user_reminders`** | Frequent badge-related reads | Notification UI delay | Partial index on `resolved_at IS NULL` exists |
| **`profiles`** | RLS **on every** protected row | Global multiplier if role check were slow | Mitigated by **`00168`** |

**Best direction:** Prioritize **`financial_transactions`**, **`subscription_payments`**, and **`audit_logs`** for monitoring **dead tuple ratio**, **last autovacuum**, and **ANALYZE** after large migrations or imports.

---

## 5. Top 10 database bottlenecks (ranked)

1. **`v_active_notifications`** — many redundant **full passes** over **`work_orders`** / **`proposals`** in one view.  
2. **`subscriptions_detail`** — **`sub.*`**, heavy joins, **two correlated subqueries per row**, worst with `select *`.  
3. **`site_assets_detail`** — **per-asset LATERAL** subscription resolution.  
4. **`financial_transactions` at scale** — ledger growth + reporting scans (mitigated but not removed by **`00168`**).  
5. **`proposals_detail`** — correlated **COUNT / bool_all** + non-stored **normalize** expressions vs modern **`work_orders` search pattern**.  
6. **`subscription_payments` + overdue / collection patterns** — **`has_overdue_pending`**-style filters may need a **stronger composite partial** strategy as data grows (beyond existing single-column indexes).  
7. **`customer_sites_list` / `search_customer_sites`** — triple **`ILIKE '%…%`**`; depends on **trigram coverage** of all three search columns.  
8. **`work_orders_detail`** — acceptable after **`00100`**, but **LATERAL profiles** + RLS still a **per-row** cost on huge lists.  
9. **RLS inconsistency** — **`service_requests`** **`EXISTS(profiles)`** vs **`get_my_role()`** elsewhere (maintenance + micro-overhead).  
10. **`audit_logs` longevity** — not a “slow view” but a **bloat / scan** risk for admin features over time.

---

**Files referenced (migrations):** `00066`, `00143`, `00157`, `00092`, `00100`, `00150`, `00160`, `00138`, `00152`, `00083`, `00116`, `00168`, `00001`, `00016`.

No SQL was written, per your request. If you want a follow-up, the highest ROI next step is usually **`EXPLAIN (ANALYZE, BUFFERS)`** on production-like data for **`v_active_notifications`**, **`subscriptions_detail` list query**, and **P&amp;L date-range** reads.

analysis 5:

Below is a **solo-developer backlog** grounded in the performance doc, the DB audit (`v_active_notifications`, `subscriptions_detail`, `site_assets_detail`, RLS, indexes), the React Query waterfall audit, and known follow-ups (pagination, `select('*')` inventory).

---

# Ornet ERP — Performance & scale backlog (solo dev)

**How to use:** Track by **Task ID** in your tool of choice. **Dependencies** list IDs that should ship first. **Effort:** S ≈ &lt;0.5 day, M ≈ 0.5–1 day, L ≈ 2–4 days, XL ≈ 1+ week.

---

## Already completed (do not reschedule)

| ID / area | What shipped | Evidence / files |
|-----------|----------------|------------------|
| **RQ-GLOBAL-01** | React Query defaults: `staleTime`, `refetchOnWindowFocus: false`, `retry`, extended `gcTime` | `src/app/providers.jsx` |
| **FC-NOTIF-01** | Notification queries: `staleTime: 60s` on badge / feeds / reminders | `src/features/notifications/hooks.js` |
| **API-SUB-01** | `fetchSubscriptions` / `fetchSubscriptionsByCustomer` row caps | `src/features/subscriptions/api.js` |
| **API-FIN-01** | P&amp;L column narrowing + dashboard summary select | `src/features/finance/api.js` |
| **API-OPS-01** | Operations pool `POOL_SELECT` + `.range(0, 99)` cap | `src/features/operations/api.js` |
| **API-SIM-01** | `fetchSimCards` safety `.limit(2500)` | `src/features/simCards/api.js` |
| **DB-IDX-01** | Performance indexes + `ANALYZE` (subscriptions, `financial_transactions`, `service_requests`, `work_orders`, `profiles`) | `supabase/migrations/00168_performance_indexes.sql` |

**Note:** If `docs/performance-optimization-project.md` still lists old index names or claims `providers.jsx` is broken, treat **documentation sync** as backlog item **CL-DOC-01** (Low).

---

## Quick wins vs structural work

| Tier | Meaning | Examples in this backlog |
|------|---------|---------------------------|
| **Quick win** | Small change, high confidence, minimal migration risk | RQ-WO-01, API-GREP-01 batches, DB-ANALYZE-01 |
| **Structural** | Schema/view/RPC changes, new endpoints, or multi-file refactors | DB-VNOTIF-01, DB-SUBVIEW-01, RQ-SUB-01 + API split |

---

# 1. Database

*Ordered by typical user-visible impact.*

---

### DB-VNOTIF-01 — Replace or narrow `v_active_notifications` monolith  
- **Title:** Decompose heavy notification view / badge data path  
- **Problem:** `v_active_notifications` unions many branches with **repeated scans** of `work_orders` and `proposals` (open WO, overdue WO, today WO, multiple proposal states, etc.). Every refresh pays full cost.  
- **Why it matters:** Notification center and badge are hit often; cost grows linearly with WO/proposal volume.  
- **Scope:** Design replacement: **CTE-based single pass**, separate **small RPCs** per concern, or **SECURITY DEFINER** functions that return **counts only** for badge vs full rows for feed. Migration + any GRANT changes.  
- **Files likely affected:** New or replaced migration(s) under `supabase/migrations/`; possibly `00066_notification_views_functions.sql` lineage; `get_notification_badge_count` and dependents.  
- **Dependencies:** None for investigation; implementation may need **FC-NOTIF** coordination if RPC shape changes.  
- **Effort:** **L** (investigation S, implementation L)  
- **Priority:** **Critical**  
- **Acceptance criteria:** `EXPLAIN (ANALYZE)` on badge path shows **no triple scan** of `work_orders` for one request; p95 badge RPC &lt; 100ms on realistic data (or documented target); behavior parity for admin/accountant roles.  
- **Notes / risks:** Easiest mistake is optimizing view only — **badge** should not build full union. RLS role filter at end of view remains a design smell.

---

### DB-SUBVIEW-01 — Reduce `subscriptions_detail` cost (correlated subqueries + `sub.*`)  
- **Title:** Slim subscription list/read model  
- **Problem:** View uses **`sub.*`**, many joins, and **per-row** subqueries (`static_ip`, overdue `subscription_payments` EXISTS). List pages that select wide rows amplify I/O.  
- **Why it matters:** Subscriptions are core; collection desk and lists already stressed before API caps.  
- **Scope:** Option A: **second view** `subscriptions_list` (fixed column list, no scalar subqueries). Option B: **materialized columns** on `subscriptions` for overdue/static IP (maintenance triggers). Option C: RPC returning only needed fields per screen.  
- **Files likely affected:** `supabase/migrations/*` (view recreate); possibly `src/features/subscriptions/api.js` to swap target.  
- **Dependencies:** **API-SUB-02** (narrow select in app) pairs naturally; can run after quick API wins.  
- **Effort:** **L**  
- **Priority:** **Critical**  
- **Acceptance criteria:** List query for “default subscription list” uses **no `select *`** from a fat view in production code paths; correlated subqueries **eliminated or measured** &lt; X ms per row budget; migrations apply clean on staging.  
- **Notes / risks:** `DROP VIEW` ordering / dependents; coordinate with any RPCs reading `subscriptions_detail`.

---

### DB-ASSET-01 — Fix `site_assets_detail` per-row LATERAL subscription lookup  
- **Title:** Remove per-asset subscription probe  
- **Problem:** `LEFT JOIN LATERAL` resolves “latest subscription per site” **once per asset row** — O(assets × subscription sort).  
- **Why it matters:** Sites with many equipment rows get slow asset tabs.  
- **Scope:** Denormalize `subscription_id` / status on `site_assets` if business rules allow, or **one** grouped subquery / `DISTINCT ON` in a CTE keyed by `site_id`, joined once.  
- **Files likely affected:** `supabase/migrations/*`; `src/features/siteAssets/api.js` if columns added.  
- **Dependencies:** Product rule check: **one “primary” subscription per site** must be defined.  
- **Effort:** **M**–**L**  
- **Priority:** **High**  
- **Acceptance criteria:** Asset list query plan shows **one** subscription resolution per `site_id` (or explicit denorm read); no per-row LATERAL on large result sets.  
- **Notes / risks:** Wrong subscription attribution if multiple active subs per site — needs explicit precedence (already in `ORDER BY` in LATERAL — preserve semantics).

---

### DB-PROPVIEW-01 — Align `proposals_detail` with indexed search pattern  
- **Title:** Cut correlated aggregates + index-friendly search  
- **Problem:** Correlated `COUNT` / `bool_all` over `proposal_work_orders` + `work_orders` per proposal; `normalize_tr_for_search` in view vs stored columns (unlike optimized `work_orders_detail`).  
- **Why it matters:** Proposal list and search scale with proposal count.  
- **Scope:** Stored generated search columns + trigram indexes (mirror `00100`); optional **maintained** `work_order_count` / `all_installations_complete` or single aggregate join.  
- **Files likely affected:** `supabase/migrations/*`; `src/features/proposals/api.js`.  
- **Dependencies:** None critical.  
- **Effort:** **M**  
- **Priority:** **High**  
- **Acceptance criteria:** Search uses indexed columns; proposal list **eliminates N correlated subqueries** or proves negligible in `EXPLAIN`; PDF/detail unchanged.  
- **Notes / risks:** View column list may drift from `proposals` table (`contract_type` etc.) — reconcile with app expectations.

---

### DB-FT-01 — Monitor and plan for `financial_transactions` growth  
- **Title:** Ledger hygiene (stats, bloat, long-term shape)  
- **Problem:** Single ledger table grows forever; reporting ranges may widen scans even with indexes.  
- **Why it matters:** Finance dashboard, P&amp;L, VAT — trust and speed.  
- **Scope:** Document **retention/archival** policy; optional **partitioning** by `transaction_date` (future); ensure **autovacuum** health after bulk imports.  
- **Files likely affected:** Ops runbooks / migrations if partitioning; no app change for phase 1.  
- **Dependencies:** **DB-ANALYZE-01**.  
- **Effort:** **M** (analysis + doc); **XL** if partitioning.  
- **Priority:** **Medium**  
- **Acceptance criteria:** Dashboard has **dead-tuple / table size** check cadence; post-import `ANALYZE` checklist; decision record on partition vs not.  
- **Notes / risks:** Partitioning is structural — defer until size warrants.

---

### DB-ANALYZE-01 — Routine ANALYZE after bulk operations  
- **Title:** Post-migration / post-import stats refresh  
- **Problem:** Planner drift after large imports or migrations skews index choice.  
- **Why it matters:** “We added indexes but it’s still slow” often bad stats.  
- **Scope:** Checklist: run `ANALYZE` on `financial_transactions`, `subscription_payments`, `work_orders`, `audit_logs` after bulk jobs; optional pg_cron later.  
- **Files likely affected:** Internal runbook; optional `supabase` SQL snippet folder (not code).  
- **Dependencies:** None.  
- **Effort:** **S**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Doc or script exists; you run it once after SIM import / migration batch and record timestamp.  
- **Notes / risks:** None.

---

### DB-RLS-01 — Standardize `service_requests` policies on `get_my_role()`  
- **Title:** Remove duplicate `EXISTS (profiles…)` pattern on service_requests mutating policies  
- **Problem:** Insert/update policies use raw `EXISTS` on `profiles` instead of **`get_my_role()`**, inconsistent with rest of schema.  
- **Why it matters:** Minor CPU + maintenance debt; `00168` already optimizes `profiles` lookup.  
- **Scope:** One migration: replace `USING`/`WITH CHECK` bodies with `get_my_role() IN (…)`.  
- **Files likely affected:** `supabase/migrations/00160_service_requests.sql` follow-up migration.  
- **Dependencies:** None.  
- **Effort:** **S**  
- **Priority:** **Low**  
- **Acceptance criteria:** Policies behave identically for admin/accountant/field_worker tests.  
- **Notes / risks:** Low; still test conversion RPC and pool list.

---

### DB-SPINDEX-01 — Composite index for overdue / pending `subscription_payments`  
- **Title:** Support `has_overdue_pending`-style filters in one index  
- **Problem:** EXISTS filters on `(subscription_id, status, payment_month)` may not hit an ideal composite partial index as data grows.  
- **Why it matters:** Subscription detail / list overdue flags and collection paths.  
- **Scope:** Measure `EXPLAIN` on worst query; add **partial** index e.g. `WHERE status = 'pending'` with leading `(subscription_id, payment_month)` if justified.  
- **Files likely affected:** New migration.  
- **Dependencies:** **DB-SUBVIEW-01** optional (if subquery removed, priority drops).  
- **Effort:** **S**–**M**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Target query switches from seq scan to index on staging dataset.  
- **Notes / risks:** Avoid index sprawl — prove with `EXPLAIN` first.

---

# 2. API / Payload

---

### API-SUB-02 — Stop using `select('*')` on `subscriptions_detail` where unnecessary *(Quick win batch)*  
- **Title:** Explicit column lists for subscription fetches  
- **Problem:** Fat rows over the network; DB still joins everything in view even if you trim columns (some savings in JSON parse only) — pairs with **DB-SUBVIEW-01** for real DB win.  
- **Why it matters:** Immediate payload reduction; prepares for list view split.  
- **Scope:** `fetchSubscription`, `fetchSubscriptions`, collection-related calls — align with UI columns.  
- **Files likely affected:** `src/features/subscriptions/api.js`, `paymentsApi.js`, `collectionApi.js`; call sites if shapes change.  
- **Dependencies:** None to start; **DB-SUBVIEW-01** for full effect.  
- **Effort:** **M**  
- **Priority:** **High**  
- **Acceptance criteria:** Grep shows no `.select('*')` on subscription list/detail paths you touched; no TS/runtime field regressions (zod/schemas updated if needed).  
- **Notes / risks:** Missed column breaks edit forms — test subscription edit + detail.

---

### API-PAG-01 — Paginate high-traffic lists still unbounded  
- **Title:** Wire list pages to `.range` / `limit` + count  
- **Problem:** Doc called out customers, proposals, collection desk, income/expense transactions as candidates. SIM page still capped at 2500 not truly paginated.  
- **Why it matters:** Memory, TTI, and Supabase timeouts as data grows.  
- **Scope:** Prioritize: **Customers**, **Proposals**, **CollectionDesk**, **Transactions** lists, **SimCards** → `fetchSimCardsPaginated`.  
- **Files likely affected:** `src/features/customers/api.js` + list page; `src/features/proposals/api.js` + list; `src/features/finance/collectionApi.js` + `CollectionDeskPage.jsx`; `src/features/simCards/SimCardsListPage.jsx` (or equivalent); hooks.  
- **Dependencies:** None per module; may need **DB** indexes for sort/filter columns.  
- **Effort:** **L** (several pages)  
- **Priority:** **High**  
- **Acceptance criteria:** Each targeted list has **page size**, **next/prev or infinite scroll**, and **total count** where UX requires; no request loads full table on open.  
- **Notes / risks:** URL state for page number; keep filters stable across page changes.

---

### API-GREP-01 — Continue `select('*')` inventory closure *(Quick wins)*  
- **Title:** Burn down remaining `.select('*')` in feature APIs  
- **Problem:** 30+ occurrences across features inflate payloads and hide real column needs.  
- **Why it matters:** Cheap cumulative win for bandwidth and JS parse.  
- **Scope:** File-by-file pass using existing inventory; batch by feature week.  
- **Files likely affected:** `src/features/**/*.js` per audit list.  
- **Dependencies:** None.  
- **Effort:** **M** per batch (whole inventory **L**).  
- **Priority:** **Medium**  
- **Acceptance criteria:** Inventory doc updated; each changed fetch has **comment or const** listing columns for the consumer.  
- **Notes / risks:** Regression only if a hidden UI field needed a dropped column.

---

### API-CUST-01 — Customer-scoped pending payment insights RPC (optional structural pair to RQ-CUST-01)  
- **Title:** Backend support for `customer_id`-based overdue insights  
- **Problem:** Frontend waits for subscription IDs to call `fetchPendingPaymentInsightsForSubscriptions`.  
- **Why it matters:** Removes waterfall on **CustomerDetailPage**.  
- **Scope:** New RPC or view: input `customer_id`, output same shape as current insights.  
- **Files likely affected:** `supabase/migrations/*`; `src/features/finance/api.js` or `subscriptions/api.js`; hooks.  
- **Dependencies:** Product confirmation on RLS (same as current insights).  
- **Effort:** **M**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Customer detail loads insights **without** first fetching full subscription list for IDs only; RLS matches accountant/admin rules.  
- **Notes / risks:** Duplicates business logic — single source function in DB preferred.

---

# 3. Frontend caching

---

### FC-PREFETCH-01 — List-row prefetch for hot detail routes *(Quick win where high impact)*  
- **Title:** Prefetch subscription (and optionally customer) detail on hover / visible row  
- **Problem:** First navigation always cold; complements DB/API work.  
- **Why it matters:** “Instant” feel for power users clicking through lists.  
- **Scope:** `queryClient.prefetchQuery` on link hover or virtualization `onVisible` for subscriptions list, operations pool (if detail route exists later), work orders.  
- **Files likely affected:** List row components; shared `Link` wrappers; feature hooks export `queryFn` keys.  
- **Dependencies:** Stable **query keys** in hooks.  
- **Effort:** **S**–**M**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Second click to same detail is cache hit in DevTools/React Query Devtools; no duplicate inflight requests.  
- **Notes / risks:** Mobile has no hover — use “press in” or skip.

---

### FC-STALE-02 — Per-feature `staleTime` where global 5m is wrong  
- **Title:** Tune cache for operational vs reference data  
- **Problem:** Finance and collection may need shorter staleness than materials catalog; global default may hide issues.  
- **Scope:** After pagination, set **collection** and **dashboard** hooks to explicit `staleTime` / `gcTime` where product requires.  
- **Files likely affected:** `src/features/finance/hooks.js`, `collectionHooks.js`, dashboard tabs.  
- **Dependencies:** **API-PAG-01** for lists that refetch too often.  
- **Effort:** **S**  
- **Priority:** **Low**–**Medium**  
- **Acceptance criteria:** Documented table of feature vs staleTime; accountants validate “numbers feel fresh.”  
- **Notes / risks:** Over-tuning causes stale money screens — test with real users.

---

# 4. React Query / network patterns

---

### RQ-SUB-01 — Subscription detail: parallelize site-scoped data *(Structural + FE)*  
- **Title:** Remove `site_id` waterfall on `SubscriptionDetailPage`  
- **Problem:** `useSubscriptionsBySite`, `useWorkOrdersBySite`, `useAssetsBySite` wait for **`useSubscription`** to supply `site_id`. Early loading gate also delays **MonthlyPaymentGrid** and static IP despite route `id`.  
- **Why it matters:** High-traffic detail page; three dependent waves.  
- **Scope:** Pass **`siteId` via router state or query param** from list rows; mount **MonthlyPaymentGrid** with `id` from `useParams` before main subscription resolves; keep error handling if `siteId` mismatches subscription.  
- **Files likely affected:** `src/features/subscriptions/SubscriptionDetailPage.jsx`, list links (`SubscriptionsListPage` or similar), `MonthlyPaymentGrid.jsx` parent usage, maybe `api.js` for “meta” fetch if you add it.  
- **Dependencies:** List pages must know `site_id` (they usually do). **DB** optional (minimal meta endpoint).  
- **Effort:** **M**  
- **Priority:** **Critical**  
- **Acceptance criteria:** Network panel shows **schedule + subscription + site lists** overlapping in time on first load (not strictly serial); no wrong-site data when tampering query string (validate or ignore param).  
- **Notes / risks:** Deep-link bookmarks without `siteId` — fallback to current behavior.

---

### RQ-CUST-01 — Customer detail: insights + audit log fetch pattern  
- **Title:** Eliminate double fetch and insights gate  
- **Problem:** `usePendingPaymentInsights` waits on subscription IDs; `useCustomerAuditLogs` can run with empty ids then refetch.  
- **Why it matters:** Customer hub is heavy already with parallel queries.  
- **Scope:** FE: gate audit query until subscriptions loaded **or** change keying; BE: **API-CUST-01**.  
- **Files likely affected:** `src/features/customers/CustomerDetailPage.jsx`, `src/features/customers/hooks.js`, `src/features/subscriptions/hooks.js`.  
- **Dependencies:** **API-CUST-01** for full fix of insights chain.  
- **Effort:** **M** (FE only) / **M**+ with BE.  
- **Priority:** **High**  
- **Acceptance criteria:** One audit fetch per navigation (or intentional invalidate only); insights request fires **in parallel** with other customer queries when BE ready.  
- **Notes / risks:** Audit content must include subscription-scoped rows — confirm API if key changes.

---

### RQ-WO-01 — Work order detail: audit timeline parallel to main fetch *(Quick win)*  
- **Title:** Mount `useWorkOrderAuditLogs(id)` at page level  
- **Problem:** Activity timeline mounts only after `useWorkOrder` finishes because of loading early-return.  
- **Why it matters:** Cheap parallel shave on WO detail.  
- **Files likely affected:** `src/features/workOrders/WorkOrderDetailPage.jsx`, possibly `WorkOrderActivityTimeline.jsx`.  
- **Dependencies:** None.  
- **Effort:** **S**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Audit and detail requests **start together**; timeline still handles missing WO (error state unchanged).  
- **Notes / risks:** Slight flash if audit arrives before WO — UI should tolerate.

---

### RQ-INVALID-01 — Tighten invalidation after pagination  
- **Title:** Avoid `invalidateQueries` too broad once lists are paginated  
- **Problem:** `subscriptionKeys.all`-style nukes every list page cache.  
- **Why it matters:** Pagination + broad invalidation = thundering herd.  
- **Scope:** After **API-PAG-01**, audit mutations for `invalidateQueries` scope.  
- **Files likely affected:** `src/features/**/hooks.js` mutations.  
- **Dependencies:** **API-PAG-01**.  
- **Effort:** **M**  
- **Priority:** **Medium**  
- **Acceptance criteria:** Mutations invalidate **detail + affected list query keys** only; document pattern in one comment or internal note.  
- **Notes / risks:** Under-invalidation bugs — test payment record and subscription edit.

---

# 5. Cleanup / validation

---

### CL-EXPLAIN-01 — `EXPLAIN (ANALYZE, BUFFERS)` checklist for top DB paths  
- **Title:** Measure before next migration wave  
- **Problem:** Without baselines, index/view work is guesswork.  
- **Scope:** Run on staging: `v_active_notifications` (or replacement), `subscriptions_detail` list, P&amp;L date range, asset list for large `site_id`. Save plans in `docs/` or private.  
- **Files likely affected:** Docs only (optional).  
- **Dependencies:** Staging data volume representative.  
- **Effort:** **S**  
- **Priority:** **High** (before **DB-VNOTIF-01** / **DB-SUBVIEW-01**)  
- **Acceptance criteria:** Three stored before/after snapshots for any structural DB task you ship.  
- **Notes / risks:** Production `EXPLAIN` during peak — avoid; use staging.

---

### CL-DOC-01 — Sync `performance-optimization-project.md` with repo reality  
- **Title:** Fix Quick Status and `00168` index naming in doc  
- **Problem:** Doc may still claim broken `providers.jsx` or wrong index column names.  
- **Why it matters:** Solo dev loses trust in the single source of truth.  
- **Scope:** Edit doc only; align Completed / Remaining with this backlog.  
- **Files likely affected:** `docs/performance-optimization-project.md`.  
- **Dependencies:** None.  
- **Effort:** **S**  
- **Priority:** **Low**  
- **Acceptance criteria:** Quick Status matches `providers.jsx` + real migration file; no obsolete “critical blocker” if resolved.  
- **Notes / risks:** None.

---

### CL-LINT-01 — Add lightweight performance guardrails *(optional)*  
- **Title:** ESLint or CI grep for `.select('*')` in new PRs  
- **Problem:** Regression after cleanup.  
- **Scope:** Optional script `rg` in CI or comment-based convention.  
- **Files likely affected:** `package.json`, `.github/workflows/*` if any.  
- **Dependencies:** **API-GREP-01** baseline done first or allowlist noise.  
- **Effort:** **S**  
- **Priority:** **Low**  
- **Acceptance criteria:** New `select('*')` in `api.js` fails CI or weekly report.  
- **Notes / risks:** False positives — tune allowed files.

---

## Suggested implementation order (solo dev, impact-first)

1. **CL-EXPLAIN-01** (baseline)  
2. **DB-VNOTIF-01** or **RQ-SUB-01** (pick one “big rock” — notify if badge Complaints exist; subscription if daily pain higher)  
3. **API-SUB-02** + **DB-SUBVIEW-01** (pair for subscriptions)  
4. **RQ-CUST-01** / **API-CUST-01**  
5. **API-PAG-01** (chunk by module: Customers → Proposals → Collection → SIM)  
6. **DB-ASSET-01**, **DB-PROPVIEW-01**  
7. **RQ-WO-01**, **FC-PREFETCH-01**, **API-GREP-01** batches  
8. **DB-FT-01**, **DB-ANALYZE-01**, **DB-RLS-01**, **CL-DOC-01**, **FC-STALE-02**, **CL-LINT-01**

---

**End of backlog.** No code was written per your request.