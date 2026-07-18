# Phase 2 — SECURITY DEFINER RPC Audit Report

> **Date:** 2026-05-31  
> **Scope:** All `SECURITY DEFINER` functions in `supabase/migrations/` (00001–00223)  
> **Method:** Migration history + `GRANT EXECUTE` inventory; no live `pg_proc` query  
> **Related:** [01-rls-audit.md](./01-rls-audit.md) (Tahsilat views + table RLS)  
> **Status:** Audit only — no code or migration changes

---

## Executive Summary

The codebase contains **many** `SECURITY DEFINER` objects: frontend RPCs, soft-delete helpers, finance completion paths, subscription bulk tools, search/list RPCs, and trigger/cron bodies. Several high-risk gaps from the 2026-03 era are **fixed** (`bulk_update_subscription_prices`, `fn_cancel_subscription`, `fn_record_payment`, `get_daily_work_list`, `search_work_history` field_worker scope).

**Remaining gaps:** Multiple `GRANT EXECUTE TO authenticated` functions **read or write finance/subscription data without `get_my_role()` checks**, bypassing table RLS by design. The most severe are **`get_monthly_revenue_expense`** (ledger aggregates for any logged-in user) and **`fn_generate_recurring_expenses`** (inserts `financial_transactions` + notifications, granted to `authenticated`). Finance completion RPCs **`fn_complete_work_order_with_payment`** and **`complete_proposal_with_rate`** lack role and ownership guards while mutating proposals/work orders and downstream finance rows.

**Overall verdict:** **FAIL for production finance data** until critical/high RPC guards are added and verified in staging.

---

## Role Model Reference

| Role | `canWrite` (app) | Expected finance/subscription RPC access |
|------|------------------|----------------------------------------|
| `admin` | Yes | Full |
| `accountant` | Yes | Full |
| `field_worker` | No | Work-order scoped reads/completion only; **no** subscription/finance bulk |

Helper: `get_my_role()` — `SECURITY DEFINER`, `SET search_path = public` (`00001_profiles.sql` lines 117–128).

---

## Inventory Summary

| Category | Approx. count | Callable by `authenticated`? |
|----------|---------------|------------------------------|
| Trigger functions (`RETURNS TRIGGER`) | ~40+ | No (not direct RPC) |
| Cron / internal (`generate_monthly_sim_finance`, `extend_active_subscription_payments`) | 2+ | **Revoked** from `authenticated` (`00110`, `00181`, `00182`) |
| Frontend RPCs (`GRANT EXECUTE … TO authenticated`) | **~35** | Yes — primary audit surface |
| `get_my_role()` | 1 | Yes (read-only role string) |

Full trigger/cron list omitted here; they run as definer on DML but are not PostgREST RPC entry points.

---

## Frontend-Callable SECURITY DEFINER RPCs

Derived from `GRANT EXECUTE … TO authenticated` across migrations (latest signature wins).

| Function | Grant (migration) | Mutates? | `get_my_role()` / guard | `search_path` | Bypasses RLS |
|----------|-------------------|----------|-------------------------|---------------|--------------|
| `get_my_role()` | `00001` L128 | No | N/A (returns role) | ✅ | No |
| `get_dashboard_stats()` | `00014` L66 | No | ✅ Scoped in SQL | ✅ | Yes (counts) |
| `get_today_schedule()` | `00014` L117 | No | Partial | ✅ | Yes |
| `get_my_pending_tasks(int)` | `00014` L174 | No | Partial | ✅ | Yes |
| `get_customer_work_history(uuid)` | `00005` L230 | No | ❌ None | ✅ | Yes — **legacy schema refs** |
| `get_monthly_revenue_expense(int)` | `00128` L33 | No | ❌ None | ❌ Missing | **Yes — full FT scan** |
| `get_overdue_subscription_payments()` | `00129` L47 | No | ❌ None | ❌ Missing | **Yes — subscription payments** |
| `get_subscription_stats()` | `00169` L110 | No | ❌ None | ✅ | **Yes — MRR JSON** |
| `get_overdue_invoices()` | `00019` L12 | No | ❌ None | ❌ Missing | **Yes — paid amounts** |
| `get_subscription_year_schedule(uuid, int)` | `00167` L196 | No | ❌ None | ✅ | Yes |
| `generate_subscription_payments(uuid, date)` | `00019`+ | **Yes** | ❌ None | ❌ Often missing | **Yes — inserts payments** |
| `ensure_payments_for_year(uuid, int)` | `00145` L229 | **Yes** | ❌ None | ✅ | **Yes** |
| `fn_record_payment(...)` | `00098`/`00170` | **Yes** | ✅ `00122` | ✅ | Yes — guarded |
| `fn_update_subscription_price(...)` | `00098` L220 | **Yes** | ❌ None | ✅ | **Yes** |
| `fn_cancel_subscription(...)` | `00111` L75 | **Yes** | ✅ `00122` | ✅ | Yes — guarded |
| `bulk_update_subscription_prices(jsonb)` | `00024` L132 | **Yes** | ✅ `00117` | ✅ | Yes — guarded |
| `bulk_import_subscriptions(jsonb, uuid)` | `00137` L114 | **Yes** | ❌ Weak (`p_user_id` only) | ✅ | **Yes** |
| `fn_complete_work_order_with_payment(...)` | `00208` L130 | **Yes** | ❌ None | ✅ | **Yes — FT + FTP** |
| `complete_proposal_with_rate(...)` | *(no GRANT in repo)* | **Yes** | ❌ None | ✅ | **Yes — proposals + trigger** |
| `soft_delete_transaction(uuid)` | `00107` L28 | **Yes** | ⚠️ Stale roles | ✅ | Yes |
| `soft_delete_customer(uuid)` | `00141` L63 | **Yes** | ✅ admin+accountant | ✅ | Yes |
| `soft_delete_proposal(uuid)` | `00161` L25 | **Yes** | ✅ admin+accountant | ✅ | Yes |
| `soft_delete_sim_card(uuid)` | `00105` L26 | **Yes** | ✅ admin+accountant | ✅ | Yes |
| `soft_delete_work_order(uuid)` | `00192` L25 | **Yes** | ✅ admin only | ✅ | Yes |
| `soft_delete_recurring_template(uuid)` | `00108` L25 | **Yes** | ✅ admin+accountant | ✅ | Yes |
| `soft_delete_operations_item(uuid)` | `00177` L24 | **Yes** | ✅ admin+accountant | ✅ | Yes |
| `bulk_upsert_materials(jsonb)` | `00222` L64 | **Yes** | ✅ admin only | ✅ | Yes |
| `search_work_history(...)` | `00221` L103 | No | ✅ field_worker scope | ✅ | Yes — read WOD |
| `get_daily_work_list(date, uuid)` | `00195` L174 | No | ✅ `00123` | ✅ | Yes — read WOD |
| `search_customer_sites(text)` | `00138` L51 | No | ❌ None | ✅ | Yes — all sites |
| `fn_upsert_site_asset(...)` | `00159` L57 | **Yes** | ❌ None | ✅ | Yes |
| `fn_upsert_site_assets_batch(jsonb)` | `00159` L58 | **Yes** | ❌ None | ✅ | Yes |
| `fn_generate_recurring_expenses()` | `00070` L289 | **Yes** | ❌ None | ✅ | **Yes — inserts FT** |
| `fn_revert_write_off(uuid)` | `00180` L184 | **Yes** | ❌ Not re-audited in body | ✅ | Yes |
| `get_notification_badge_count()` | `00066` L241 | No | View-level filter | ✅ | Partial |
| `fn_resolve_notification(uuid)` | `00066` L265 | **Yes** | ❌ Not verified | ✅ | Yes |

**Note:** `complete_proposal_with_rate` is invoked from `src/features/proposals/api.js` but **no `GRANT EXECUTE` appears in migrations** (`00210`/`00211`). Assume staging DB has grant via manual/default; treat as exposed RPC.

---

## Focus Area Reviews

### Finance completion RPCs

| RPC | File:lines | Role check | Ownership check | Risk |
|-----|------------|------------|-----------------|------|
| `fn_complete_work_order_with_payment(uuid, text, date, numeric)` | `00208` L17–128 | ❌ | ❌ Any `in_progress` WO | **HIGH** — mutates `work_orders`, `financial_transactions`, `financial_transaction_payments` |
| `complete_proposal_with_rate(uuid, decimal, decimal)` | `00211` L15–64 (latest body) | ❌ | ❌ Any `accepted` proposal | **HIGH** — completes proposal → revenue trigger |

### Payment / write-off RPCs

| RPC | Guard | Notes |
|-----|-------|-------|
| `fn_record_payment` | ✅ `00122` L115–118 | Definer UPDATE on `subscription_payments`; audit uses `p_user_id` param |
| `fn_cancel_subscription` | ✅ `00122` L27–31 | |
| `fn_revert_write_off` | ⚠️ Grant `00180`; body not re-read — verify role in Phase 3 |
| `fn_write_off_to_finance` | Trigger only | Definer on payment status change |

### Soft-delete RPCs

| RPC | Role guard | Stale roles? |
|-----|------------|--------------|
| `soft_delete_transaction` | `manager`/`office` in check | ⚠️ `00107` L17 |
| Others (customer, proposal, sim, WO, recurring, ops) | ✅ `get_my_role()` | No |

### Bulk import / update

| RPC | Guard |
|-----|-------|
| `bulk_update_subscription_prices` | ✅ `00117` |
| `bulk_import_subscriptions` | ❌ only `p_user_id IS NOT NULL` |
| `bulk_upsert_materials` | ✅ admin only `00222` L14 |

### Search / list RPCs

| RPC | Data exposure | Scoping |
|-----|---------------|---------|
| `search_work_history` | `work_orders_detail` | ✅ field_worker: `assigned_to` (`00221` L29–40) |
| `get_daily_work_list` | `work_orders_detail` | ✅ field_worker forced to self (`00123` L25–30) |
| `search_customer_sites` | All customer sites | ❌ no role filter (`00138` L39–44) |

### Cron / internal

| Function | Grant |
|----------|-------|
| `generate_monthly_sim_finance()` | `postgres` only `00202` L224 |
| `extend_active_subscription_payments()` | **REVOKE** from `authenticated` `00110`/`00181` |
| `fn_generate_recurring_expenses()` | ⚠️ **`GRANT` to `authenticated`** `00070` L289 — should be cron-only |

### New functions (requested)

| Function | Migration | Guard | Notes |
|----------|-----------|-------|-------|
| `search_work_history(text, text, uuid, date, date, text, uuid)` | `00221` | ✅ Role branch | Replaces 2-arg overload; `GRANT` L103 |
| `bulk_upsert_materials(jsonb)` | `00222` | ✅ Admin only | Materials import |

---

## Findings

### CRITICAL

#### F-CRIT-01 — `get_monthly_revenue_expense` exposes ledger totals to all authenticated users

| Field | Detail |
|-------|--------|
| **Function** | `get_monthly_revenue_expense(months_back INT DEFAULT 7)` |
| **Migration** | `00128_dashboard_revenue_rpc.sql` lines 6–33 |
| **GRANT** | `authenticated` line 33 |
| **Bypasses RLS** | Yes — direct aggregate on `financial_transactions` |
| **Mutates** | No |
| **Role check** | None |
| **search_path** | Not set (SQL function) |
| **Why risky** | `field_worker` can call RPC from browser and receive **monthly revenue and expense** totals despite finance table RLS. Used for dashboard charts. |
| **Proposed fix** | Add `get_my_role() IN ('admin','accountant')` wrapper or convert to `SECURITY INVOKER` + rely on RLS; restrict dashboard hook to `canWrite`. |

#### F-CRIT-02 — `fn_generate_recurring_expenses` granted to `authenticated` and inserts finance rows

| Field | Detail |
|-------|--------|
| **Function** | `fn_generate_recurring_expenses()` |
| **Migration** | `00070_recurring_expenses.sql` lines 203–289 |
| **GRANT** | `GRANT EXECUTE … TO authenticated` line 289 |
| **Bypasses RLS** | Yes — INSERT into `financial_transactions`, `notifications` |
| **Mutates** | Yes |
| **Role check** | None |
| **Why risky** | Any logged-in user (including `field_worker`) can invoke the **cron job function** and create pending expense documents. |
| **Proposed fix** | `REVOKE EXECUTE FROM authenticated`; grant only to `service_role` / `postgres`; invoke via pg_cron or edge function only. |

---

### HIGH

#### F-HIGH-01 — `fn_complete_work_order_with_payment` — no role or assignment guard

| Field | Detail |
|-------|--------|
| **Function** | `fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)` |
| **Migration** | `00208_complete_work_order_with_payment_rpc.sql` lines 17–128, grant 130–131 |
| **Bypasses RLS** | Yes — UPDATE `work_orders`, INSERT/UPDATE `financial_transactions`, INSERT `financial_transaction_payments` |
| **Role check** | Only `auth.uid() IS NOT NULL` (L36–39) |
| **Why risky** | Any authenticated user who knows a WO UUID can complete it and create **paid/unpaid finance documents**. No check that caller is assigned, admin, or accountant. |
| **Proposed fix** | Require `get_my_role() IN ('admin','accountant')` **OR** (`field_worker` AND `auth.uid() = ANY(assigned_to)`). |

#### F-HIGH-02 — `complete_proposal_with_rate` — no role guard; triggers finance

| Field | Detail |
|-------|--------|
| **Function** | `complete_proposal_with_rate(UUID, DECIMAL, DECIMAL)` |
| **Migration** | `00211_fix_complete_proposal_with_rate_recalc.sql` lines 15–64 (latest) |
| **GRANT** | Not in repo — app calls `src/features/proposals/api.js` ~L460 |
| **Bypasses RLS** | Yes — UPDATE `proposals`; `auto_record_proposal_revenue` trigger inserts income |
| **Role check** | None |
| **Proposed fix** | `get_my_role() IN ('admin','accountant')` at function entry; add explicit `GRANT EXECUTE` after guard. |

#### F-HIGH-03 — `bulk_import_subscriptions` — no role guard

| Field | Detail |
|-------|--------|
| **Function** | `bulk_import_subscriptions(jsonb, uuid)` |
| **Migration** | `00137_bulk_import_subscriptions_rpc.sql` lines 8–114 |
| **GRANT** | Line 114 |
| **Role check** | `p_user_id IS NOT NULL` only (L27–29) |
| **Why risky** | `field_worker` can bulk-insert subscriptions and call `generate_subscription_payments` inside loop. |
| **Proposed fix** | `get_my_role() IN ('admin','accountant')`. |

#### F-HIGH-04 — `generate_subscription_payments` / `ensure_payments_for_year` — no role guard

| Field | Detail |
|-------|--------|
| **Functions** | `generate_subscription_payments(UUID, DATE)` — `00148` L6+; `ensure_payments_for_year(UUID, INT)` — `00146` L7+ |
| **GRANT** | `00019`, `00145`, etc. |
| **Why risky** | Definer reads `subscriptions` and INSERTs into `subscription_payments` regardless of subscription RLS. |
| **Proposed fix** | Restrict to `admin`/`accountant`; optionally verify caller can see subscription row. |

#### F-HIGH-05 — `fn_update_subscription_price` — no role guard

| Field | Detail |
|-------|--------|
| **Function** | `fn_update_subscription_price(...)` (10 params) |
| **Migration** | `00151_fix_price_update_rpcs.sql` lines 13–94 |
| **GRANT** | `00098` L220+ |
| **Role check** | None — uses `p_user_id` for audit only |
| **Proposed fix** | `get_my_role() IN ('admin','accountant')`. |

#### F-HIGH-06 — Subscription/finance **read** RPCs without role guards

| Function | Migration | Exposure |
|----------|-----------|----------|
| `get_subscription_stats()` | `00169` L8–110 | MRR, counts, unpaid aggregates |
| `get_overdue_subscription_payments()` | `00129` L7–47 | Payment amounts, customer names |
| `get_overdue_invoices()` | `00018` L27–59 | Paid totals, company names |

**Proposed fix:** Single pattern: abort unless `get_my_role() IN ('admin','accountant')`.

#### F-HIGH-07 — `fn_upsert_site_asset` / `fn_upsert_site_assets_batch` — no role guard

| Field | Detail |
|-------|--------|
| **Migration** | `00159_fn_upsert_site_asset.sql` lines 4–58 |
| **GRANT** | Lines 57–58 |
| **Why risky** | Any user can upsert equipment rows for arbitrary `site_id`. |
| **Proposed fix** | `get_my_role() IN ('admin','accountant')` or match site_assets RLS intent. |

---

### MEDIUM

#### F-MED-01 — `soft_delete_transaction` uses obsolete roles

| Field | Detail |
|-------|--------|
| **Migration** | `00107_soft_delete_transaction_rpc.sql` lines 17–18, 35–48 |
| **Check** | `get_my_role() IN ('admin', 'accountant', 'manager', 'office')` |
| **Proposed fix** | Align with `00116` — `admin`, `accountant` only. |

#### F-MED-02 — `search_customer_sites` returns all sites for any authenticated user

| Field | Detail |
|-------|--------|
| **Migration** | `00138_search_customer_sites_rpc.sql` lines 29–45 |
| **Note** | View uses `security_invoker`; RPC is still definer read over full list |
| **Proposed fix** | Accept for customer UX or add role/scoping if needed. |

#### F-MED-03 — `get_customer_work_history` — definer + legacy columns

| Field | Detail |
|-------|--------|
| **Migration** | `00005_dashboard_functions.sql` lines 193–228 |
| **Issue** | References `wo.customer_id`, `wo.type`, `wo.title` — may not match post-`00009` schema; if repaired without guard, leaks customer WOs |
| **Proposed fix** | Rewrite against `work_orders_detail` + role scope; or drop RPC. |

#### F-MED-04 — `complete_proposal_with_rate` missing `GRANT EXECUTE` in migrations

| Field | Detail |
|-------|--------|
| **Migration** | `00210`/`00211` — no grant stanza |
| **Proposed fix** | Add `GRANT EXECUTE … TO authenticated` after role guard (avoid implicit grants). |

#### F-MED-05 — Several SQL definer RPCs missing `SET search_path`

| Functions | Migration |
|-----------|-----------|
| `get_monthly_revenue_expense` | `00128` |
| `get_overdue_subscription_payments` | `00129` |
| `get_overdue_invoices` | `00018` |
| `generate_subscription_payments` (latest) | `00148` |

**Proposed fix** | `ALTER FUNCTION … SET search_path = public` per `00078` pattern. |

#### F-MED-06 — `fn_get_operations_stats` — definer read of all `operations_items`

| Field | Detail |
|-------|--------|
| **Migration** | `00175_operations_stats_outcomes.sql` lines 6–71 |
| **GRANT** | Not found in migrations — verify if exposed |
| **Proposed fix** | If callable: require `admin`/`accountant`. |

---

### LOW

#### F-LOW-01 — `get_dashboard_stats` exposes `total_customers` count to all roles

| Field | Detail |
|-------|--------|
| **Migration** | `00014_fix_dashboard_functions.sql` line 58 |
| **Proposed fix** | Optional — acceptable for ops dashboard. |

#### F-LOW-02 — `bulk_upsert_materials` limited to admin (not accountant)

| Field | Detail |
|-------|--------|
| **Migration** | `00222` line 14 — `get_my_role() <> 'admin'` |
| **Note** | May be intentional; materials RLS allows accountant manage via policy name |
| **Proposed fix** | Align with `materials_manage` policy if accountants should import. |

---

## Direct Answers to Phase 2 Checklist

| Question | Answer |
|----------|--------|
| Any write RPC without `get_my_role()`? | **Yes** — see CRITICAL/HIGH (finance completion, bulk import, subscription payments, recurring generator, site asset upsert, price update) |
| `GRANT EXECUTE TO authenticated` too broad? | **Yes** — finance aggregates, subscription stats, `fn_generate_recurring_expenses` |
| Missing `search_path`? | **Yes** — several SQL RPCs (MED-05); most plpgsql RPCs after `00078` are pinned |
| Arbitrary UUID/JSONB without validation? | **Yes** — bulk JSONB RPCs; WO/proposal completion by ID only |
| `field_worker` mutate finance/subscriptions/customers? | **Yes** via RPC bypass (not via table RLS) |
| Service-role logic exposed? | **`fn_generate_recurring_expenses`** behaves like cron but granted to `authenticated` |

---

## Well-Guarded Patterns (Reference)

- `bulk_update_subscription_prices` — `00117` L43–47  
- `fn_cancel_subscription` / `fn_record_payment` — `00122`  
- `search_work_history` / `get_daily_work_list` — field_worker scoping `00126`, `00123`, `00221`  
- `bulk_upsert_materials` — admin-only `00222`  
- Soft deletes (except `soft_delete_transaction` stale roles) — `00105`–`00192`  
- `extend_active_subscription_payments` — revoked from `authenticated`  

---

## Finding Counts

| Severity | Count |
|----------|-------|
| CRITICAL | **2** |
| HIGH | **7** |
| MEDIUM | **6** |
| LOW | **2** |

---

## Functions Needing Immediate Review

1. `get_monthly_revenue_expense(INT)`  
2. `fn_generate_recurring_expenses()`  
3. `fn_complete_work_order_with_payment(UUID, TEXT, DATE, NUMERIC)`  
4. `complete_proposal_with_rate(UUID, DECIMAL, DECIMAL)`  
5. `bulk_import_subscriptions(JSONB, UUID)`  
6. `generate_subscription_payments(UUID, DATE)`  
7. `fn_update_subscription_price(...)`  
8. `get_subscription_stats()`  
9. `get_overdue_subscription_payments()`  
10. `get_overdue_invoices()`  

---

## Recommended Staging Verification

```sql
-- As field_worker JWT:
SELECT * FROM get_monthly_revenue_expense(7);        -- must fail or return 0 rows policy
SELECT fn_generate_recurring_expenses();            -- must fail
SELECT get_subscription_stats();                    -- must fail
-- Attempt RPC with known WO UUID not assigned to user
SELECT fn_complete_work_order_with_payment(...);
```

---

*End of Phase 2 report. No implementation performed.*
