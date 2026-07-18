# Phase 6 — RLS Performance Audit Report

> **Date:** 2026-05-31  
> **Scope:** RLS policy expressions and related indexes on high-volume tables (`work_orders`, finance, subscriptions, customers, SIM, proposals, materials)  
> **Method:** Static analysis of all migrations containing `CREATE POLICY` / `ALTER POLICY` / `DROP POLICY`, `get_my_role()`, `auth.uid()`, `EXISTS`, and `ANY(assigned_to)` — **no live `EXPLAIN ANALYZE`** (recommend staging samples before production load)  
> **Prior reports:** [01-rls-audit.md](./01-rls-audit.md) through [05-frontend-exposure-audit.md](./05-frontend-exposure-audit.md)  
> **Status:** Audit only — no policy or index changes

---

## Executive Summary

RLS on hot tables is **mostly simple role gates** (`get_my_role() IN ('admin','accountant')`) on finance and subscriptions — predictable but **still evaluated per row** unless wrapped in a subselect initplan. **Work-order scoping** uses **`OR` expressions** combining `get_my_role()`, `auth.uid() = ANY(assigned_to)`, and `created_by`, which complicates index-only plans for `field_worker` list queries (mitigated partly by `idx_work_orders_assigned_to_gin` in `00100`).

The **largest performance risk** is **`work_order_materials`**: every policy uses a **correlated `EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = …)`** with **up to two `get_my_role()` calls** and **no `wo.deleted_at IS NULL`**, so bulk material lines per WO multiply parent lookups. Secondary risks: **uncached `get_my_role()`** on **`financial_transactions`** and **`subscription_payments`** at ledger scale, and **duplicate `profiles` subqueries** on `operations_items`, `materials`, and `plan_items` mutations instead of `get_my_role()`.

**Positive:** `00100_optimize_work_orders_view.sql` adds partial indexes on `deleted_at IS NULL`, GIN trigram search, and **`idx_work_orders_assigned_to_gin`**; `00168_performance_indexes.sql` adds **`idx_profiles_id_role`** and **`idx_fin_transactions_date_direction`** aligned with soft-delete filters.

**Overall verdict:** **CONDITIONAL PASS** — acceptable at current scale; **plan hardening before large fleet / years of ledger history** (initplan role pattern, child-table policy simplification, staging `EXPLAIN`).

---

## `get_my_role()` Helper

| Property | Detail |
|----------|--------|
| **Definition** | `00001_profiles.sql` L117–125 |
| **Language** | `SQL STABLE SECURITY DEFINER` |
| **Body** | `SELECT role FROM profiles WHERE id = auth.uid();` |
| **Index support** | `idx_profiles_id_role` on `(id, role)` — `00168` L10–11 |

**Performance note:** Postgres may **re-execute** a stable function per row in RLS unless written as `(SELECT get_my_role())` (initplan / single evaluation per statement). Most policies call `get_my_role()` **bare** — repeated profile lookups at high row counts.

**Policies with multiple `get_my_role()` in one policy (same row check):**

| Table | Policy | Calls per evaluation | Migration |
|-------|--------|----------------------|-----------|
| `work_orders` | `work_orders_update` | **3** (USING: admin; WITH CHECK: admin + implicit paths) | `00083` L28–43 |
| `subscriptions` | `subscriptions_update` (legacy) | **2** USING + WITH CHECK | `00016` L56–58 |
| `customers` | `customers_update_authenticated` | **2** | `00126` L22–25 |
| `sim_cards` | `Admins can manage sim_cards` | **2** USING + WITH CHECK | `00104` L10–16 |
| `financial_transactions` | `ft_update` | **2** | `00116` L18–24 |
| `financial_transaction_payments` | `ftp_update` | **2** | `00212` L163–164 |

---

## Hot Table Policy Summary (Effective State)

| Table | SELECT policy | Expensive pattern? | Partial / supporting indexes |
|-------|---------------|--------------------|------------------------------|
| `work_orders` | Role OR `ANY(assigned_to)` OR `created_by` + `deleted_at` | **OR-heavy** | `idx_work_orders_*` partial, GIN `assigned_to` (`00100`) |
| `work_order_materials` | `EXISTS` → `work_orders` | **Correlated subquery** | `idx_wo_materials_wo_id` (`00010`) |
| `financial_transactions` | `deleted_at` + `get_my_role()` | Per-row role | `idx_financial_transactions_active`, `idx_fin_transactions_date_direction` (`00081`, `00168`) |
| `financial_transaction_payments` | `get_my_role()` only | Per-row role | FK indexes on `transaction_id` (implicit) |
| `subscription_payments` | `get_my_role()` only | Per-row role | `idx_sub_payments_subscription`, `status`, `month` (`00016`) |
| `subscriptions` | `get_my_role()` | Per-row role | `idx_subscriptions_status_active` (`00168`) |
| `customers` | `deleted_at IS NULL` only | Light | `idx_customers_active` (`00085`) |
| `customer_sites` | `deleted_at IS NULL` | Light | `idx_customer_sites_active` (`00082`) |
| `proposals` | `deleted_at` + `get_my_role()` | Per-row role | Proposal FK indexes (`00027`) |
| `sim_cards` | `deleted_at` (read); manage: `get_my_role()` | Per-row role on write | `idx_sim_cards_active` (`00088`) |
| `materials` | `deleted_at` | Light SELECT | `idx_materials_code_active` (`00086`) |
| `tasks` | `deleted_at` + role OR `assigned_to` / `created_by` | OR + role | Task indexes (`00004`) |
| `operations_items` | `deleted_at IS NULL` only | Light SELECT | `idx_operations_items_status_deleted` (`00168`) |
| `plan_items` | `USING (true)` | None (open read) | `idx_pi_plan_date` (`00174`) |

---

## Findings

### F6-CRIT-01 — `work_order_materials`: correlated `EXISTS` on parent `work_orders` per child row

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** |
| **Table** | `work_order_materials` |
| **Policies** | `wo_materials_select`, `wo_materials_insert`, `wo_materials_update`, `wo_materials_delete` |
| **Migration** | `00010_work_order_materials.sql` L27–88 |
| **Expression (select)** | `EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_materials.work_order_id AND (get_my_role() IN ('admin','accountant') OR auth.uid() = ANY(wo.assigned_to) OR wo.created_by = auth.uid()))` |
| **Why slow** | Each material line triggers a **nested lookup** on `work_orders` plus **1× `get_my_role()`** inside the subquery; bulk list/export of materials scans **all visible rows × EXISTS**. No `wo.deleted_at IS NULL` — may join soft-deleted parents. |
| **Suggested fix** | Denormalize `site_id` / `assigned_to` on `work_order_materials`, or use security-invoker view joining WO once; add `AND wo.deleted_at IS NULL`; wrap role as `(SELECT get_my_role())`; ensure planner uses `idx_wo_materials_wo_id` + PK on `work_orders.id`. |
| **Index needed?** | **Yes** — `idx_wo_materials_wo_id` exists; verify composite `(work_order_id)` INCLUDE on hot paths; parent `work_orders` PK sufficient if EXISTS not repeated inefficiently. |

---

### F6-CRIT-02 — Ledger-scale tables: per-row `get_my_role()` without initplan caching

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** (at high row counts) |
| **Tables** | `financial_transactions`, `subscription_payments`, `financial_transaction_payments` |
| **Policies** | `ft_select` / `ft_update`; `sp_select`; `ftp_select` |
| **Migrations** | `00116_fix_financial_transactions_rls.sql` L10–24; `00125` / `00133` L11–13; `00212_tahsilat_core.sql` L159–166 |
| **Expression (ft_select)** | `deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant')` |
| **Expression (sp_select)** | `get_my_role() IN ('admin', 'accountant')` |
| **Why slow** | Accountant **full ledger** or **payment schedule** scans evaluate RLS on **every row**; bare `get_my_role()` may hit `profiles` repeatedly (millions of FT rows over years). |
| **Suggested fix** | Rewrite as `(SELECT get_my_role()) IN ('admin','accountant')`; consider JWT custom claim `role` to avoid table lookup; keep partial indexes on `deleted_at IS NULL`. |
| **Index needed?** | **Partial indexes exist** (`idx_fin_transactions_date_direction`, `idx_financial_transactions_active`); add **`payment_status` / `transaction_id`** partial indexes if Tahsilat filters grow (Phase 7). |

---

### F6-HIGH-01 — `work_orders_select` / `work_orders_update`: OR policy + multiple role checks

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `work_orders` |
| **Policies** | `work_orders_select`, `work_orders_update` |
| **Migration** | `00083_soft_delete_work_orders.sql` L14–43 |
| **Expression (select)** | `deleted_at IS NULL AND (get_my_role() IN ('admin','accountant') OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid())` |
| **Why slow** | **OR** prevents single index-only path; planner may combine **GIN on `assigned_to`**, **`created_by`**, or sequential scan. **Update** calls `get_my_role()` up to **three times** per row (USING admin branch + WITH CHECK). |
| **Suggested fix** | Split policies per role via `TO authenticated` + restrictive checks, or `(SELECT get_my_role())` once; partial index on `(created_by) WHERE deleted_at IS NULL` if `created_by` filter is hot. |
| **Index needed?** | **Partially covered** — `idx_work_orders_assigned_to_gin`, `idx_work_orders_scheduled_date_desc`, `idx_work_orders_active`; consider **`created_by`** partial index. |

---

### F6-HIGH-02 — `work_order_assets` UPDATE: `EXISTS` + `get_my_role()` + `ANY(assigned_to)`

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `work_order_assets` |
| **Policy** | `woa_update` |
| **Migration** | `00126_fix_medium_rls_issues.sql` L59–76 |
| **Expression** | `get_my_role() IN ('admin','accountant') OR EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_assets.work_order_id AND auth.uid() = ANY(wo.assigned_to))` (duplicated in WITH CHECK) |
| **Why slow** | Same correlated WO pattern as materials; **double** EXISTS on UPDATE; field_worker asset edits on busy WOs amplify lookups. |
| **Suggested fix** | Mirror `work_orders` visibility in a view; add `wo.deleted_at IS NULL`; initplan role subselect. |
| **Index needed?** | **FK index** on `work_order_assets.work_order_id` (verify exists); reuse `idx_work_orders_assigned_to_gin`. |

---

### F6-HIGH-03 — `audit_select_work_orders`: nested `EXISTS` + role + array membership

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `audit_logs` |
| **Policy** | `audit_select_work_orders` |
| **Migration** | `00162_work_orders_audit_logs.sql` L94–111 |
| **Expression** | `table_name = 'work_orders' AND EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = audit_logs.record_id AND wo.deleted_at IS NULL AND (get_my_role() IN (...) OR auth.uid() = ANY(wo.assigned_to) OR wo.created_by = auth.uid()))` |
| **Why slow** | Customer detail audit tab: each log row **probes `work_orders`** with full OR expression; audit volume grows with WO churn. |
| **Suggested fix** | Scope audit reads via RPC (like `search_work_history`); or store `work_order_id` + precomputed visibility flag on audit row. |
| **Index needed?** | **`audit_logs(record_id)`** + **`work_orders(id)`** PK; index on `(table_name, record_id)`. |

---

### F6-HIGH-04 — `materials_manage_admin`: `EXISTS (SELECT 1 FROM profiles …)` per row

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `materials` |
| **Policy** | `materials_manage_admin` |
| **Migration** | `00086_soft_delete_materials.sql` L27–40 |
| **Expression** | `deleted_at IS NULL AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')` |
| **Why slow** | **Profiles subquery** per row on INSERT/UPDATE/DELETE instead of cached `get_my_role()`; materials catalog bulk import touches many rows. |
| **Suggested fix** | Replace with `(SELECT get_my_role()) = 'admin'` or `get_my_role() = 'admin'`. |
| **Index needed?** | **`idx_profiles_id_role`** already supports lookup. |

---

### F6-HIGH-05 — `operations_items_update`: duplicate `profiles` EXISTS (USING + WITH CHECK)

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `operations_items` |
| **Policy** | `operations_items_update` |
| **Migration** | `00176_fix_operations_items_soft_delete_rls.sql` L14–34 |
| **Expression** | `deleted_at IS NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','accountant'))` (+ duplicate in WITH CHECK) |
| **Why slow** | Soft-delete updates on operations board run **two** profile subqueries per row; pool can be large. |
| **Suggested fix** | `get_my_role() IN ('admin','accountant')` with initplan subselect. |
| **Index needed?** | `idx_profiles_id_role`; `idx_operations_items_status_deleted`. |

---

### F6-HIGH-06 — `plan_items` mutations: `auth.uid() IN (SELECT id FROM profiles …)` 

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `plan_items` |
| **Policies** | `plan_items_insert`, `plan_items_update`, `plan_items_delete` |
| **Migration** | `00174_plan_items.sql` L43–71 |
| **Expression** | `auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'accountant'))` |
| **Why slow** | Subquery form may not cache as well as `(SELECT get_my_role())`; evaluated on **each inserted/updated** plan row. SELECT is `USING (true)` — cheap. |
| **Suggested fix** | Align with `get_my_role() IN ('admin','accountant')`. |
| **Index needed?** | `idx_profiles_id_role`. |

---

### F6-HIGH-07 — `proposal_annual_fixed_costs_manage`: dual `profiles` EXISTS

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `proposal_annual_fixed_costs` |
| **Policy** | `proposal_annual_fixed_costs_manage` |
| **Migration** | `00165_proposal_annual_fixed_costs.sql` L30–45 |
| **Expression** | `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'accountant'))` (USING + WITH CHECK) |
| **Why slow** | Per-line cost rows on large proposals double profile lookups. |
| **Suggested fix** | Use `get_my_role()` initplan pattern. |
| **Index needed?** | `idx_proposal_annual_fixed_costs_proposal_id` exists. |

---

### F6-MED-01 — `tasks_select` / `tasks_update`: OR + `get_my_role()` (scalar `assigned_to`)

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `tasks` |
| **Policies** | `tasks_select`, `tasks_update` |
| **Migration** | `00097_fix_rls_tasks_and_views.sql` L31–68 |
| **Expression** | `deleted_at IS NULL AND (get_my_role() IN ('admin','accountant') OR assigned_to = auth.uid() OR created_by = auth.uid())` |
| **Why slow** | OR expression; **two** `get_my_role()` on update WITH CHECK; task volume moderate vs WOs. |
| **Suggested fix** | Initplan role; index `(assigned_to, created_by) WHERE deleted_at IS NULL`. |
| **Index needed?** | **Optional** partial indexes on `assigned_to` / `created_by`. |

---

### F6-MED-02 — `subscriptions` / `subscription_payments`: simple role gate at scale

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Tables** | `subscriptions`, `subscription_payments` |
| **Policies** | `subscriptions_select`; `sp_select` |
| **Migrations** | `00119` L8–10; `00133` L23–25 |
| **Expression** | `get_my_role() IN ('admin', 'accountant')` (+ `deleted_at` on proposals only) |
| **Why slow** | Payment schedule rows grow **~12 × subscriptions × years**; per-row role check on collection desk queries. |
| **Suggested fix** | Initplan `(SELECT get_my_role())`; ensure filters use `idx_sub_payments_subscription` / `payment_month`. |
| **Index needed?** | **Existing** `idx_sub_payments_*`; consider composite `(subscription_id, status, payment_month)`. |

---

### F6-MED-03 — `sim_cards` FOR ALL policy: double `get_my_role()` + `deleted_at`

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `sim_cards` |
| **Policy** | `Admins can manage sim_cards` |
| **Migration** | `00104_sim_cards_rls_use_get_my_role.sql` L7–16 |
| **Expression** | `deleted_at IS NULL AND get_my_role() IN ('admin','accountant')` / WITH CHECK `get_my_role() IN (...)` |
| **Why slow** | Fleet list pages paginate; write paths hit role twice. SELECT policy is cheap (`deleted_at` only — `00088` L41–44). |
| **Suggested fix** | Initplan role subselect. |
| **Index needed?** | **`idx_sim_cards_active`**, trigram indexes (`00099`). |

---

### F6-MED-04 — Open SELECT policies: `plan_items`, `operations_items`, `customers`, `customer_sites`

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** (security noted in Phase 1; perf is cheap) |
| **Tables** | `plan_items`, `operations_items`, `customers`, `customer_sites` |
| **Migrations** | `00174` L37–41; `00160` L122–125; `00085` L16–19; `00082` L13–16 |
| **Expression** | `USING (true)` or `deleted_at IS NULL` only |
| **Why slow** | **Low RLS CPU** — risk is **wide visibility**, not per-row function cost. Large `customers` scans rely on app `limit` + search indexes (`00100` trigram). |
| **Suggested fix** | Performance OK; restrict SELECT in security pass if required. |
| **Index needed?** | **Partial indexes** on `deleted_at` align (`idx_customers_active`, etc.). |

---

### F6-LOW-01 — `customers` / `materials` SELECT: `deleted_at IS NULL` only

| Field | Value |
|-------|-------|
| **Risk** | **LOW** |
| **Tables** | `customers`, `materials` |
| **Policies** | `customers_select_authenticated`, `materials_select_authenticated` |
| **Migrations** | `00085` L16–19; `00086` L19–22 |
| **Why slow** | Minimal predicate; pairs with partial indexes. |
| **Suggested fix** | None required for RLS perf. |
| **Index needed?** | **Already present.** |

---

### F6-LOW-02 — No `ILIKE` / search functions inside RLS policies

| Field | Value |
|-------|-------|
| **Risk** | **LOW** (positive) |
| **Finding** | Search normalization runs in **RPC/views** (`search_work_history`, generated columns), not in policy expressions. |
| **Suggested fix** | Keep search out of RLS. |

---

## `auth.uid() = ANY(assigned_to)` / GIN Index

| Item | Status |
|------|--------|
| **Policies using `ANY(assigned_to)`** | `work_orders_select/update` (`00083`); `wo_materials_*` (`00010`); `woa_update` (`00126`); `audit_select_work_orders` (`00162`); RPCs `search_work_history` (`00126`, `00221`) |
| **Index** | `idx_work_orders_assigned_to_gin` — `00100` L92–94, `USING gin (assigned_to) WHERE deleted_at IS NULL` |
| **Assessment** | **Appropriate** for `@>` / `ANY` membership on UUID arrays; reverse lookup `uuid = ANY(assigned_to)` can use GIN. |

---

## Soft-delete (`deleted_at IS NULL`) vs Partial Indexes

| Table | Policy uses `deleted_at`? | Partial index |
|-------|---------------------------|---------------|
| `work_orders` | Yes | Yes (`00100`, `00083`) |
| `financial_transactions` | Yes | Yes (`00081`, `00168`) |
| `customers` / `customer_sites` | Yes | Yes (`00085`, `00082`) |
| `materials` / `sim_cards` | Yes | Yes |
| `proposals` | Yes (select) | Unique partial on code |
| `subscriptions` | No (status-based) | `idx_subscriptions_status_active` |
| `subscription_payments` | No | Status/month indexes |
| `work_order_materials` EXISTS | **No `wo.deleted_at` in EXISTS** | Child FK index only |

---

## Parent/Child Bulk Operations

| Pattern | Impact |
|---------|--------|
| Loading WO with materials | Each `work_order_materials` row re-evaluates **EXISTS → work_orders** (F6-CRIT-01) |
| Tahsilat FTP inserts | Child `ftp_*` policies only `get_my_role()` — cheap; parent FT RLS on join selects |
| Subscription payment lists | Single-table `sp_select` — role per row on large schedules |

---

## Question Checklist (Phase 6 plan)

| # | Question | Result |
|---|----------|--------|
| 1 | Policies calling `get_my_role()` more than once? | **Yes** — `work_orders_update`, `ft_update`, `sim_cards` manage, `customers_update`, etc. |
| 2 | `(SELECT get_my_role())` initplan? | **Not used** in policies — recommended |
| 3 | `EXISTS` on unindexed FK paths? | **`work_order_materials` → `work_orders`** indexed but still correlated per child row |
| 4 | `deleted_at` + partial indexes aligned? | **Mostly yes**; gap in **wo_materials EXISTS** |
| 5 | `assigned_to` indexed for `ANY`? | **Yes** — GIN `00100` |
| 6 | Parent RLS forcing nested loops on children? | **Yes** — materials/assets child policies |

---

## EXPLAIN Samples

**Not run** in this audit (no staging DB access). Recommended templates before go-live:

```sql
-- As field_worker JWT:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM work_order_materials WHERE work_order_id = '<uuid>';

-- As accountant JWT:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM financial_transactions
WHERE deleted_at IS NULL AND transaction_date >= '2025-01-01'
ORDER BY transaction_date DESC LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM subscription_payments
WHERE status = 'pending' AND payment_month < '2026-05-01';
```

---

## Findings Count

| Severity | Count |
|----------|-------|
| **CRITICAL** | **2** |
| **HIGH** | **7** |
| **MEDIUM** | **4** |
| **LOW** | **2** |

---

## Policies Needing Immediate Performance Review

1. **`wo_materials_select`** (and insert/update/delete) — `00010_work_order_materials.sql`  
2. **`work_orders_select`** / **`work_orders_update`** — `00083_soft_delete_work_orders.sql`  
3. **`ft_select`** / **`ft_update`** — `00116_fix_financial_transactions_rls.sql`  
4. **`sp_select`** — `00125` / `00133`  
5. **`woa_update`** — `00126_fix_medium_rls_issues.sql`  
6. **`audit_select_work_orders`** — `00162_work_orders_audit_logs.sql`  
7. **`operations_items_update`** — `00176_fix_operations_items_soft_delete_rls.sql`  

---

## Recommended Next Actions

1. **Staging `EXPLAIN ANALYZE`** on the templates above with realistic row counts (WO × materials, FT years, subscription_payments).  
2. **Policy hardening (after APPROVE):** adopt `(SELECT get_my_role())` across hot policies; add `wo.deleted_at IS NULL` to all WO-linked `EXISTS`; replace `profiles` subqueries with `get_my_role()`.  
3. **Phase 7 (Index audit):** validate composite indexes for Tahsilat/collection filters and `created_by` on `work_orders`.  
4. **Do not disable RLS** for speed — align with Phase 1–5 security fixes first.

---

## Overall Verdict

**CONDITIONAL PASS**

RLS is **not an immediate blocker** for early production volume, but **`work_order_materials` correlated policies** and **uncached per-row `get_my_role()` on ledger tables** will become **dominant costs** as work orders, materials lines, and `financial_transactions` / `subscription_payments` grow. Index work in `00100` and `00168` is a good foundation; **policy expression refactors** should precede large historical imports or multi-year billing expansion.
