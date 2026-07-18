# Phase 8 — View/RPC Performance Audit Report

> **Date:** 2026-05-31  
> **Scope:** Definition and runtime cost of views and RPCs used by `src/features/**/api.js`, with emphasis on dashboard, finance/Tahsilat, work history, work orders, subscriptions, SIM, and completion RPCs (performance only)  
> **Method:** Static analysis of view/RPC definitions in `supabase/migrations/` cross-referenced with app call sites; **no live `EXPLAIN (ANALYZE, BUFFERS)`** (recommend staging with production-like row counts)  
> **Prior reports:** [01-rls-audit.md](./01-rls-audit.md) through [07-index-audit.md](./07-index-audit.md)  
> **Query-optimization batch:** Migrations `00221`–`00223` and [docs/supabase-query-optimization-analysis.md](../supabase-query-optimization-analysis.md)  
> **Status:** Audit only — no view/RPC rewrites, indexes, or materialized views applied

---

## Executive Summary

The highest **runtime cost** objects are **Tahsilat collection views** (`v_collection_customer_summary`, `v_collection_documents`) with **per-customer / per-row correlated subqueries** into `financial_transaction_payments`, **`search_work_history`** returning **unbounded `work_orders_detail` rows** (each row includes a **LATERAL `json_agg` on `profiles`**), and **finance P&L reads** against **`v_profit_and_loss`** when the app omits a **period filter** (full ledger UNION scan).

**Positive:** `00221` correctly pushes work-history filters into SQL; the app no longer post-filters large RPC sets (`workHistory/api.js`). `fetchRevenueExpensesByMonth` now bounds `v_profit_and_loss` by period window (`finance/api.js` L488–493). `sim_cards_list` uses `security_invoker` and normalized search columns (`00219`, `00223`). List surfaces for work orders and subscriptions use **server limits/pagination** (150 / 50-page / 200 cap).

**Index coupling (Phase 7):** Tahsilat and receivables filter **`payment_status`** without a dedicated index; `get_subscription_stats` / overdue RPCs hit **`subscription_payments (status, payment_month)`** without a composite index. These amplify view/RPC cost as history grows.

**Overall verdict:** **CONDITIONAL PASS** — acceptable at moderate data volume; **treat collection views, unbounded search RPC, and unfiltered P&L fetches as pre-scale blockers**.

| Severity | Count |
|----------|-------|
| **CRITICAL** | **2** |
| **HIGH** | **8** |
| **MEDIUM** | **9** |
| **LOW** | **6** |

---

## Query-Optimization Batch (00221–00223) — Reflection Check

| Migration | Object | App alignment | Performance note |
|-----------|--------|---------------|------------------|
| **00221** | `search_work_history(...)` | `src/features/workHistory/api.js` L7–15 passes `p_site_id`, `p_date_from`, `p_date_to`, `p_work_type`, `p_worker_id` | Filters moved off the client — **good**. RPC still has **no `LIMIT`**, returns **`SETOF work_orders_detail`** (heavy row shape). |
| **00222** | `bulk_upsert_materials` | `src/features/materials/api.js` (import path) | Write-path batch RPC — **out of hot read path**; not a list/dashboard perf risk. |
| **00223** | `sim_cards_list` (+ subscription search columns) | `src/features/simCards/api.js` L34–46, L52–54 | Search on generated columns — **good**. Non-paginated path still **`.limit(2500)`** L87. |

---

## Cost-Ranked Objects (Summary Table)

| Rank | Object | Type | Typical caller | Dominant cost driver |
|------|--------|------|----------------|----------------------|
| 1 | `v_collection_customer_summary` | View | Tahsilat parent list | Per-customer **2× correlated** FTP sums via `IN (SELECT ft2.id…)` |
| 2 | `search_work_history` | RPC | `/work-history` | **Unbounded** `work_orders_detail` + `%LIKE%` + LATERAL profiles |
| 3 | `v_profit_and_loss` | View | Finance dashboard, P&L, VAT, KPI hooks | **Full-table** income∪expense on `financial_transactions` when period unset |
| 4 | `subscriptions_detail` | View | Subscriptions list | **6-table JOIN** + **EXISTS** overdue check **per row** |
| 5 | `get_subscription_stats` | RPC | Dashboard + finance KPI bundle | **~8 separate aggregates** on `subscriptions` / `subscription_payments` |
| 6 | `v_collection_documents` | View | Tahsilat document drill-down | Per-row FTP subquery; app caps **500** |
| 7 | `work_orders_detail` | View | WO list/calendar/search RPC | LATERAL `json_agg(profiles)` per row; mitigated by **column prune + limits** |
| 8 | `sim_cards_list` | View | SIM list/export | `sc.*` + 2 customer joins; **2500** export cap |
| 9 | `get_monthly_revenue_expense` | RPC | Dashboard chart | FT scan joined to month series (bounded `months_back`) |
| 10 | Completion RPCs | RPC | WO/proposal complete | Write triggers + item loops — **low read-path impact** |

---

## Detailed Findings

### CRITICAL-1 — `search_work_history` returns unbounded heavy rows

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **View/RPC** | `search_work_history` |
| **Migration** | `supabase/migrations/00221_search_work_history_filters.sql` L6–100 (replaces `00126` scope) |
| **App** | `src/features/workHistory/api.js` L7–18 |
| **Current risk** | Admin/accountant branches can return **all matching work orders** with **no `LIMIT`**; each row is full `work_orders_detail` including **LATERAL profile aggregation** (`00195` L59–64). |
| **Why slow** | Leading-wildcard `LIKE '%…%'` on search columns prevents index-only plans; result set size is unbounded; PostgREST serializes large JSON `assigned_workers` per row. |
| **Suggested fix (do not implement)** | Add `p_limit` / `p_offset` (or cursor) to RPC; return narrowed column set (not `SELECT *`); require minimum search length or date window for empty query; consider dedicated lightweight search view without LATERAL. |
| **Remediation type** | RPC rewrite + pagination + optional slimmer view |

---

### CRITICAL-2 — `v_collection_customer_summary` nested correlated aggregates, unbounded app fetch

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **View/RPC** | `v_collection_customer_summary` |
| **Migration** | `supabase/migrations/00213_tahsilat_views.sql` L4–47; profit column `00214_collection_customer_summary_profit.sql` L7–51 |
| **App** | `src/features/finance/api.js` L911–927 (`select('*')`, **no `.limit()`**) |
| **Current risk** | View computes, **per customer row**, two identical subqueries: `SUM(ftp.amount)` where `transaction_id IN (SELECT ft2.id …)` (L15–21 duplicated L26–34). Filters on `payment_status` (L37–39) lack Phase 7 index. Full customer summary loaded on every Tahsilat page open. |
| **Why slow** | Planner may execute **O(customers × documents × payments)** nested loops; `HAVING COUNT(ft.id) > 0` still scans joined FT set; outstanding sort forces aggregate completion before return. |
| **Suggested fix (do not implement)** | Rewrite as single-pass `GROUP BY customer_id` with `LEFT JOIN` pre-aggregated FTP sums; add partial index on `(customer_id, direction)` WHERE `deleted_at IS NULL` and `payment_status`; paginate summaries in app; **materialized view** refreshed on payment insert (candidate). |
| **Remediation type** | View rewrite + index on `payment_status` / customer FT + pagination + materialized view (later) |

---

### HIGH-1 — `v_profit_and_loss` full ledger scan when period omitted

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `v_profit_and_loss` |
| **Migration** | `supabase/migrations/00150_fix_v_pnl_double_counting.sql` L15–65; `security_invoker` L220 |
| **App** | `fetchProfitAndLoss` L334–352; `fetchProfitAndLossSummary` L358–374; `fetchExpenseByCategory` L528–543; `FinanceDashboardPage.jsx` L174 via `fetchProfitAndLoss(period, viewMode)` |
| **Current risk** | View is **two scans** of `financial_transactions` (income UNION expense) with `deleted_at IS NULL`. When `period` argument is **null/undefined**, queries pull **all history** for client-side aggregation. |
| **Why slow** | Row count grows linearly with years of ledger; TanStack Query refetch on focus multiplies load. |
| **Suggested fix** | Require default period window in app (e.g. current year); add RPC `get_pl_summary(period_from, period_to)`; partial index already helps date filters (`00168`) when period set. |
| **Remediation type** | App guard + RPC aggregate or materialized monthly rollup |

---

### HIGH-2 — `fetchCollectionSummaries` — no pagination on expensive view

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `v_collection_customer_summary` (consumer) |
| **Migration** | `00213` / `00214` (definition) |
| **App** | `src/features/finance/api.js` L911–927 |
| **Current risk** | Entire view materialized per request; only light post-filters (`ilike`, `unpaid_count > 0`). |
| **Why slow** | Customer count × correlated subqueries (see CRITICAL-2). |
| **Suggested fix** | `.range()` pagination; server-side RPC returning top-N by `outstanding`; cache `staleTime` (Phase 9). |
| **Remediation type** | Pagination + view rewrite |

---

### HIGH-3 — `v_collection_documents` per-row payment subqueries (×2)

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `v_collection_documents` |
| **Migration** | `supabase/migrations/00213_tahsilat_views.sql` L49–84 |
| **App** | `src/features/finance/api.js` L930–958 (`.limit(500)` L954) |
| **Current risk** | Each FT row runs **two** identical subqueries on `financial_transaction_payments` (L66–74). View has **no `security_invoker`** (defaults to definer/owner semantics — see Phase 1; can affect effective row set). |
| **Why slow** | 500 rows × 2 subqueries = up to 1000 FTP probes per page; `ORDER BY transaction_date DESC` on full income set before limit applied at view level (PostgREST limit helps but view still expensive). |
| **Suggested fix** | Replace subqueries with join to `SUM(amount) GROUP BY transaction_id`; filter `customer_id` in app already — push into view parameter via RPC; index `ftp.transaction_id` exists but duplicate indexes noted in Phase 7. |
| **Remediation type** | View rewrite + `ALTER VIEW … SET (security_invoker = true)` |

---

### HIGH-4 — `get_subscription_stats` — multiple full-table scans on dashboard

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `get_subscription_stats()` |
| **Migration** | `supabase/migrations/00169_fix_subscription_stats_mrr_include_sim_amount.sql` L8–107 |
| **App** | `src/features/finance/api.js` L422 (`fetchFinanceDashboardKpis`); subscriptions dashboard hooks |
| **Current risk** | JSON built from **8+ subqueries**: counts on `subscriptions`, DISTINCT customer join, MRR sums, previous-month snapshot logic, two aggregates on `subscription_payments` (L84–103). |
| **Why slow** | Called on finance dashboard mount; `subscription_payments` filters `status IN ('pending','failed') AND payment_month < month_start` without composite index (Phase 7 HIGH). |
| **Suggested fix** | Single SQL statement with CTEs; partial indexes on `(status, payment_month)`; optional materialized KPI table refreshed nightly. |
| **Remediation type** | RPC rewrite + index |

---

### HIGH-5 — `subscriptions_detail` per-row `EXISTS` on `subscription_payments`

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `subscriptions_detail` |
| **Migration** | `supabase/migrations/00143_add_payment_start_month.sql` L332–388 (`has_overdue_pending` L350–355) |
| **App** | `src/features/subscriptions/api.js` L55–95 (`.limit(200)` L95) |
| **Current risk** | Each of up to **200 rows** may run correlated `EXISTS` on `subscription_payments`; view joins **6 tables** + optional `sim_static_ips` subquery L344–348. |
| **Why slow** | List load = 200 EXISTS checks; `security_invoker = true` (`00143` not re-set here but `00204` L15–17 restores invoker on recreate paths). |
| **Suggested fix** | Denormalize `has_overdue_pending` on `subscriptions` maintained by trigger; or lateral join pre-aggregated overdue flags; keep pagination-only list path. |
| **Remediation type** | View simplify + column denormalization |

---

### HIGH-6 — `fetchExpenseByCategory` — unbounded expense scan

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `v_profit_and_loss` (expense leg) |
| **Migration** | `00150` L42–65 |
| **App** | `src/features/finance/api.js` L528–543 |
| **Current risk** | When `period` omitted, loads **all expense rows** from view for JS aggregation. |
| **Why slow** | Same as HIGH-1 for expense-only direction. |
| **Suggested fix** | Default period; SQL `GROUP BY source_type` RPC. |
| **Remediation type** | App guard + RPC |

---

### HIGH-7 — `fetchReceivables` — table scan on `payment_status` without index

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | Direct `financial_transactions` (not a view) |
| **Migration** | Hybrid payment schema `00207` / `00212` (column); **no** `payment_status` index (Phase 7) |
| **App** | `src/features/finance/api.js` L847–860 (`.limit(200)`) |
| **Current risk** | `.in('payment_status', ['unpaid','partial','partially_paid'])` on all income rows; embeds joins to customers/WO/proposals. |
| **Why slow** | Sequential scan on growing ledger as receivables count rises. |
| **Suggested fix** | Partial index `WHERE direction='income' AND deleted_at IS NULL AND payment_status IN (...)`; optional `v_receivables_list` view with narrow columns. |
| **Remediation type** | Index + optional view |

---

### HIGH-8 — `work_orders_detail` LATERAL profile aggregation on list/search paths

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **View/RPC** | `work_orders_detail` |
| **Migration** | `supabase/migrations/00195_work_orders_detail_status_rank.sql` L6–64; `security_invoker` L66 |
| **App** | `src/features/workOrders/api.js` L75–109 (`limit 150`), L115–186 (paginated), consumed by `search_work_history` |
| **Current risk** | List select omits `assigned_workers` in `WO_LIST_SELECT` (L41–60) — **good**; detail fetch L189–198 loads full row + materials. Search RPC still uses `SELECT *`. |
| **Why slow** | LATERAL runs per row whenever `assigned_to` populated; GIN on `assigned_to` helps filter not aggregation. |
| **Suggested fix** | Split `work_orders_list` view without LATERAL; fetch worker names only on detail page. |
| **Remediation type** | View split |

---

### MEDIUM-1 — `get_monthly_revenue_expense` scans FT across month grid

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00128_dashboard_revenue_rpc.sql` L6–31 |
| **App** | `src/features/dashboard/api.js` L119 |
| **Risk** | Bounded by `months_back` (default 7) but joins all FT in window without `direction` index slice per month. |
| **Fix** | Use `period` column + `idx_ft_period` / `idx_financial_transactions_active`; or reuse pre-aggregated RPC. |
| **Type** | RPC rewrite + index use verification |

---

### MEDIUM-2 — `get_overdue_subscription_payments` — join chain, limited

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00129_dashboard_overdue_payments_rpc.sql` |
| **App** | `src/features/dashboard/api.js` L127 |
| **Risk** | Joins sp→subscription→site→customer; **`LIMIT 20`** caps payload; still benefits from `(status, payment_month)` composite (Phase 7). |
| **Type** | Index |

---

### MEDIUM-3 — `sim_cards_list` export path up to 2500 rows with `sc.*`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00219_sim_cards_list_view.sql`, `00223_sim_cards_list_subscription_search.sql` |
| **App** | `src/features/simCards/api.js` L43–91; paginated path L98+ |
| **Risk** | `SELECT *` via `sc.*` over-expands columns; 2500 cap prevents runaway but is heavy for export. |
| **Type** | Column pruning + pagination-only export |

---

### MEDIUM-4 — `get_subscription_year_schedule` — per-month payment lookup loop

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00167_get_subscription_year_schedule.sql` L29–191 |
| **App** | `src/features/subscriptions/paymentsApi.js` |
| **Risk** | WHILE loop ≤12 iterations × `SELECT` from `subscription_payments` — acceptable per detail page, not dashboard-hot. |
| **Type** | Acceptable; index on `(subscription_id, payment_month)` exists (`00016`) |

---

### MEDIUM-5 — `fn_get_operations_stats` — full pool scan + period filter

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00172_rename_service_requests.sql` L274–331; outcomes in `00175` |
| **App** | `src/features/operations/api.js` |
| **Risk** | Two passes over `operations_items` (open pool + date-range period); table smaller than ledger. |
| **Type** | Acceptable; optional single-pass aggregate RPC later |

---

### MEDIUM-6 — `get_dashboard_stats` — multiple WO/task counts

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00014_fix_dashboard_functions.sql` L10–63 |
| **App** | Dashboard hooks |
| **Risk** | Six counted subqueries with role OR on `work_orders`; uses `get_my_role()` once — better than per-row RLS on counts. |
| **Type** | Acceptable with `00100` WO partial indexes |

---

### MEDIUM-7 — `proposals_detail` — multi-join list view

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | `00193_proposals_detail_vat_and_tevkifat.sql` L6+ |
| **App** | `src/features/proposals/api.js` |
| **Risk** | Lighter than `subscriptions_detail` (no per-row EXISTS); paginated list typical. |
| **Type** | Monitor; index `proposals (status, created_at)` gap per Phase 7 |

---

### MEDIUM-8 — `view_finance_health_check` — audit view

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **Migration** | Recreated in `00204_security_invoker_detail_views.sql` L11–13 |
| **App** | `src/features/finance/api.js` L811–826 (count head + **limit 100**) |
| **Risk** | Underlying view complexity depends on definition migration; capped reads — admin-only surface. |
| **Type** | Acceptable with limits |

---

### MEDIUM-9 — Tahsilat views missing `security_invoker`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** (performance + security coupling) |
| **Migration** | `00213`, `00214` — **no** `ALTER VIEW … security_invoker` (unlike `00204` batch) |
| **App** | `finance/api.js` L912, L931 |
| **Risk** | View runs as owner; may **over-include rows** vs invoker+RLS, increasing work; aligns with Phase 1 CRITICAL on access, not just perf. |
| **Suggested fix** | `ALTER VIEW v_collection_* SET (security_invoker = true)` after verifying RLS on `financial_transactions` / `customers`. |
| **Type** | View option + access review |

---

### LOW — Completion RPCs (write path, performance-only)

| Object | Migration | App | Note |
|--------|-----------|-----|------|
| `fn_complete_work_order_with_payment` | `00208` | `workOrders/api.js` L477 | Single WO update + payment insert + triggers — **not list-hot** |
| `complete_proposal_with_rate` | `00210`, fix `00211` | `proposals/api.js` L460 | Trigger `auto_record_proposal_revenue` loops `proposal_items` — **acceptable on human-paced completion** |
| `bulk_upsert_materials` | `00222` | materials import | Batch write — monitor import size only |

---

## `security_invoker` Status (RLS-sensitive views)

| View | `security_invoker` | Migration reference |
|------|-------------------|---------------------|
| `v_profit_and_loss` | **true** | `00150` L220, `00102` |
| `work_orders_detail` | **true** | `00195` L66 |
| `sim_cards_list` | **true** | `00219` L17, `00223` L21 |
| `subscriptions_detail` | **true** | `00204` L15–17 (batch) |
| `proposals_detail` | **true** | `00193` L59 |
| `v_collection_customer_summary` | **missing** | `00213`, `00214` |
| `v_collection_documents` | **missing** | `00213` |

---

## Materialized View Candidates (future, needs approval)

| Candidate | Rationale | Refresh trigger |
|-----------|-----------|-----------------|
| Monthly P&L rollup | Replace repeated full scans of `v_profit_and_loss` for dashboard KPIs | On FT insert/update (or nightly) |
| `v_collection_customer_summary` | Correlated subqueries dominate Tahsilat load | On FT/FTP/payment_status change |
| Subscription KPI snapshot | `get_subscription_stats` multi-scan | pg_cron / payment status change |

---

## Frequency Map (app → DB hot path)

| Surface | Objects | Refetch risk |
|---------|---------|--------------|
| Dashboard `/` | `get_monthly_revenue_expense`, `get_overdue_subscription_payments`, `get_dashboard_stats`, `get_subscription_stats` (via finance KPIs for `canWrite`) | High — multiple roles, window focus |
| Finance dashboard / P&L | `v_profit_and_loss`, `get_subscription_stats` | High when period unset |
| Tahsilat `/finance/collections` | `v_collection_customer_summary`, `v_collection_documents` | High — unbounded summary |
| Work history | `search_work_history` → `work_orders_detail` | Medium–High on broad search |
| Work orders list | `work_orders_detail` | Medium — paginated OK |
| Subscriptions list | `subscriptions_detail` | Medium — 200 cap |
| SIM cards | `sim_cards_list` | Medium — paginated OK; export 2500 |
| Receivables | `financial_transactions` + embeds | Medium — needs `payment_status` index |

---

## EXPLAIN Recommendations (staging)

Run with realistic row counts (multi-year `financial_transactions`, 10k+ `subscription_payments`, 5k+ `work_orders`):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM v_collection_customer_summary LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM v_profit_and_loss WHERE period = '2026-05';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM search_work_history('', 'both', NULL, '2024-01-01', '2026-12-31', NULL, NULL);

EXPLAIN (ANALYZE, BUFFERS)
SELECT get_subscription_stats();
```

Compare **Nested Loop** / **SubPlan** counts before/after proposed view rewrites.

---

## Views/RPCs Needing Immediate Review

1. **`v_collection_customer_summary`** — correlated FTP subqueries + unbounded app load  
2. **`search_work_history`** — no LIMIT, full `work_orders_detail` rows  
3. **`v_profit_and_loss`** + **`fetchProfitAndLoss` / `fetchExpenseByCategory`** when period omitted  
4. **`get_subscription_stats`** — dashboard multi-scan + Phase 7 payment indexes  
5. **`v_collection_documents`** — per-row subqueries (500-row cap helps but does not fix view cost)  
6. **`subscriptions_detail.has_overdue_pending`** — per-row EXISTS at list scale  

---

## Recommended Next Action

1. **APPROVE** a focused fix batch (separate from this audit): Tahsilat view rewrite + `security_invoker` on collection views + `payment_status` partial index (Phase 7 dependency).  
2. Add **`LIMIT`/pagination** to `search_work_history` and `fetchCollectionSummaries` in app + RPC.  
3. Run staging **`EXPLAIN (ANALYZE, BUFFERS)`** on the six statements above before production ledger growth.  
4. Proceed to **Phase 9 — Frontend Query / React Query Audit** to align `staleTime`, refetch-on-focus, and duplicate dashboard fetches with these hot paths.

---

## What Was Not Changed

- No view or RPC definitions modified  
- No migrations applied  
- No app code edited  
- No commits or pushes
