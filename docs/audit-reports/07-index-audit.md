# Phase 7 — Database Index Audit Report

> **Date:** 2026-05-31  
> **Scope:** Compare migration-defined indexes to query patterns in `src/features/**/api.js` and hot tables from Phases 1–6  
> **Method:** Static inventory of `CREATE INDEX` / `CREATE UNIQUE INDEX` / `DROP INDEX` in `supabase/migrations/` cross-referenced with app filters, sorts, and joins  
> **Related:** [06-rls-performance-audit.md](./06-rls-performance-audit.md), [docs/supabase-query-optimization-analysis.md](../supabase-query-optimization-analysis.md) (RPC/view work — not re-audited here)  
> **Status:** Audit only — no migrations or DDL applied

---

## Executive Summary

Index coverage is **strong on work orders** (`00100`, `00083`, `00168`) and **adequate on core finance date/direction scans** (`00168` `idx_fin_transactions_date_direction`, `00081` partial active index). **Gaps** appear on **hybrid-payment / Tahsilat paths** (`payment_status` on `financial_transactions`), **Collection Desk** (`subscription_payments` status + `payment_month` together), **SIM-by-customer** lookups, and **proposals list** (`status` + `created_at` with soft delete).

**Redundancy:** duplicate GIN on `work_orders.assigned_to` (`00009` vs `00100`), overlapping `financial_transactions` date/direction indexes (`00040` vs `00168`), and duplicate `financial_transaction_payments(transaction_id)` indexes (`00207` vs `00212`).

**Overall verdict:** **CONDITIONAL PASS** — ship with current indexes for moderate data; **plan composite/partial indexes** before large subscription payment history and multi-year ledger growth.

---

## Index Inventory by Focus Table

### `financial_transactions`

| Index | Migration | Predicate / columns |
|-------|-----------|---------------------|
| `idx_ft_direction` | `00040` L71 | `direction` (full table) |
| `idx_ft_period` | `00040` L72 | `period` |
| `idx_ft_date` | `00040` L73 | `transaction_date` |
| `idx_ft_customer` | `00040` L74 | `customer_id` |
| `idx_ft_work_order`, `idx_ft_proposal`, … | `00040`, `00050`, `00058`, `00041` | FK lookups |
| `idx_financial_transactions_active` | `00081` L7–9 | `(period, direction)` **WHERE deleted_at IS NULL** |
| `idx_fin_transactions_date_direction` | `00168` L24–26 | `(transaction_date DESC, direction)` **WHERE deleted_at IS NULL** |
| `idx_fin_transactions_direction_income` | `00168` L28–30 | `(direction, income_type)` **WHERE deleted_at IS NULL AND direction = 'income'`** |
| `idx_ft_parasut_sync_status` | `00217` L29–31 | `parasut_sync_status` partial (ready/draft/sent) |
| `idx_ft_status`, `idx_ft_recurring_template` | `00070` | recurring / status |

**No index on `payment_status`** (added `00207` / `00212`).

---

### `financial_transaction_payments`

| Index | Migration |
|-------|-----------|
| `idx_ftp_transaction_id` | `00207` L97–99 **WHERE deleted_at IS NULL** |
| `idx_ftp_paid_at` | `00207` L101–103 **WHERE deleted_at IS NULL** |
| `idx_ftp_transaction` | `00212` L63 (duplicate name/column) |
| `idx_ftp_parasut_payment` | `00218` L9 |

---

### `work_orders`

| Index | Migration | Notes |
|-------|-----------|-------|
| Partial `deleted_at IS NULL` | `00083`, `00100` | status, scheduled_date, site, GIN `assigned_to` |
| `idx_work_orders_assigned_to_gin` | `00100` L92–94 | **`ANY(assigned_to)`** + RLS |
| `idx_work_orders_assigned_array` | `00009` L97 | **Redundant GIN** |
| `idx_work_orders_site` / `idx_work_orders_site_deleted` | `00009`, `00168` | site filters |
| Trigram `form_no_search` | `00100` | search |

**Missing:** partial index on **`created_by`** (RLS OR branch — Phase 6).

---

### `subscription_payments`

| Index | Migration |
|-------|-----------|
| `idx_sub_payments_subscription` | `00016` L210 |
| `idx_sub_payments_status` | `00016` L211 |
| `idx_sub_payments_month` | `00016` L212 |
| `idx_sub_payments_overdue_invoice` | `00016` L213–215 | paid + null `invoice_no` only |

**Missing:** composite **`(status, payment_month)`** or **`(status, payment_month, subscription_id)`**.

---

### `subscriptions`

| Index | Migration |
|-------|-----------|
| `idx_subscriptions_status`, `idx_subscriptions_site`, … | `00016` |
| `idx_subscriptions_status_active`, `idx_subscriptions_site_id_active` | `00168` **WHERE status IN ('active','paused')** |
| `idx_subscriptions_sim_card` | `00055` |
| `idx_subscriptions_active_site_service` | `00036` unique partial |

No `deleted_at` (status-based lifecycle).

---

### `customers` / `customer_sites`

| Index | Migration |
|-------|-----------|
| `idx_customers_active` | `00085` **WHERE deleted_at IS NULL** |
| `idx_customers_company_name_search` + trgm | `00092`, `00100` |
| `idx_customer_sites_active` | `00082` `(customer_id) WHERE deleted_at IS NULL` |
| `idx_customer_sites_customer_id` | `00007` L36 |

---

### `sim_cards`

| Index | Migration |
|-------|-----------|
| `idx_sim_cards_active` | `00088` `(status, operator) WHERE deleted_at IS NULL` |
| Trgm phone / search via `sim_cards_list` | `00099`, `00219` view |
| `idx_sim_cards_buyer_id`, `provider_company_id` | `00068`, `00103` |

**Missing:** **`customer_id`** (Customer detail tab, `fetchSimCardsByCustomer`).

---

### `materials`

| Index | Migration |
|-------|-----------|
| `idx_materials_code_active` | `00086` unique partial |
| `idx_materials_name_search` | `00092` |
| `idx_materials_description_search` | `00220` |
| `idx_materials_category` | `00008` (not partial on `deleted_at`) |

---

### `proposals`

| Index | Migration |
|-------|-----------|
| `idx_proposals_proposal_no_active` | `00087` unique partial |

**Missing:** **`status`**, **`created_at DESC`**, **`site_id`** for list/detail filters.

---

### Paraşüt-related

| Table | Indexes |
|-------|---------|
| `customers` | `idx_customers_parasut_contact` unique partial `00215` |
| `parasut_match_candidates` | status, customer `00215` |
| `parasut_audit_log`, `parasut_idempotency` | correlation, operation `00216` |
| `financial_transactions` | `idx_ft_parasut_sync_status` `00217` |

---

## App Query Patterns vs Indexes

| Pattern | Source (file:line) | Indexed? |
|---------|-------------------|----------|
| FT list: `deleted_at`, `direction`, `period`, `customer_id`, `order transaction_date` | `finance/api.js` L77–82 | **Partial** — date+direction yes; `period`/`customer_id` separate btree |
| Receivables: `direction=income`, `payment_status IN (…)`, `deleted_at`, `order transaction_date` | `finance/api.js` L847–854 | **`payment_status` missing** |
| FTP by `transaction_id`, `deleted_at`, `order paid_at` | `finance/api.js` L872–878 | **Yes** `00207` |
| Collection views: `customer_id`, `payment_status`, `transaction_date`, ilike search | `finance/api.js` L911–954 | **Views** — base FT needs `payment_status` + date |
| P&L / dashboards: `v_profit_and_loss` period, `is_official` | `finance/api.js` L334+ | View-backed (Phase 8) |
| WO list: status, work_type, priority, `scheduled_date`, search | `workOrders/api.js` L77–180 | **Yes** `00100` |
| WO by `site_id` / `customer_id` (view) | `workOrders/api.js` L444–459 | site yes; customer via join |
| Sub payments: `status=pending`, `payment_month` range/lte | `collectionApi.js` L47–73, L84–116 | **Separate indexes only** |
| Sub payments: `subscription_id` + `status` + `payment_month` | `subscriptions/api.js` L217–220, L429–433 | subscription_id yes |
| Subscriptions list: `status`, `site_id`, `has_overdue_pending`, `created_at` | `subscriptions/api.js` L54–173 | status/site yes; overdue is **computed in view** |
| SIM list: `deleted_at`, status, operator, activation_date, search | `simCards/api.js` L43–120 | status/phone yes |
| SIM by customer | `simCards/api.js` L226–236 | **`customer_id` missing** |
| Materials: `deleted_at`, category, search, `order name` | `materials/api.js` L20–55 | search yes |
| Proposals list: `status`, `created_at`, year/month | `proposals/api.js` L274–307 | **Weak** (only proposal_no unique) |
| Paraşüt health: `updated_at`, `parasut_sync_status` not null | `ParasutHealthCard.jsx` L9–13 | partial sync status only; **not `updated_at`** |

---

## Findings

### F7-CRIT-01 — Missing composite index on `subscription_payments (status, payment_month)`

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** (at collection scale) |
| **Table** | `subscription_payments` |
| **Query pattern** | Collection Desk: `.eq('status','pending').lte('payment_month', boundary)` + optional month range; stats twin queries (`collectionApi.js` L47–116) |
| **App reference** | `src/features/finance/collectionApi.js` L47–73, L84–116 |
| **Existing indexes** | Separate `idx_sub_payments_status`, `idx_sub_payments_month` (`00016` L211–212) |
| **Missing** | Combined partial index for pending + month scans |
| **Suggested DDL** | `CREATE INDEX idx_sub_payments_pending_month ON subscription_payments (payment_month, subscription_id) WHERE status = 'pending';` (or `(status, payment_month)` if paid queries need same index) |
| **Expected benefit** | Index-only scans for monthly collection board and overdue pool instead of bitmap-AND of two single-column indexes or seq scan |
| **Write cost** | Medium — every payment status/month change maintains index; acceptable for core billing table |

---

### F7-CRIT-02 — No index on `financial_transactions.payment_status` (receivables / Tahsilat / views)

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** (ledger + hybrid payment scale) |
| **Table** | `financial_transactions` |
| **Query pattern** | `fetchReceivables`: `direction=income`, `payment_status IN ('unpaid','partial',…)`, `deleted_at IS NULL`, `ORDER BY transaction_date DESC` (`finance/api.js` L847–854); Tahsilat views aggregate/filter on `payment_status` (`00213`, `00214`) |
| **Migration gap** | Column `00207` / `00212`; **no** `CREATE INDEX` on `payment_status` |
| **Suggested DDL** | `CREATE INDEX idx_ft_income_payment_status ON financial_transactions (transaction_date DESC, customer_id) WHERE deleted_at IS NULL AND direction = 'income' AND payment_status IN ('unpaid','partial','paid');` — tune enum set to match check constraint |
| **Expected benefit** | Receivables page and collection document queries avoid filtering large income row sets in memory |
| **Write cost** | Low–medium — updated when FTP trigger changes parent status |

---

### F7-HIGH-01 — Redundant GIN indexes on `work_orders.assigned_to`

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** (write amplification) |
| **Table** | `work_orders` |
| **Indexes** | `idx_work_orders_assigned_array` (`00009_rebuild_work_orders.sql` L97); `idx_work_orders_assigned_to_gin` (`00100` L92–94) |
| **Query pattern** | `auth.uid() = ANY(assigned_to)` RLS + field_worker lists (`00083` L21; Phase 6) |
| **Suggested fix** | **Drop one** GIN after confirming identical opclass (`gin__uuid_ops`); keep `00100` partial index |
| **Expected benefit** | Faster WO updates when `assigned_to` changes; less storage |
| **Write cost** | N/A (reducing indexes lowers write cost) |

---

### F7-HIGH-02 — Overlapping `financial_transactions` date/direction indexes

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** (redundancy) |
| **Table** | `financial_transactions` |
| **Indexes** | `idx_ft_date`, `idx_ft_direction`, `idx_ft_period` (`00040` L71–73, full table); `idx_financial_transactions_active` (`00081`); `idx_fin_transactions_date_direction` (`00168`) |
| **Query pattern** | `fetchTransactions` + P&L helpers filter `deleted_at`, `direction`, `transaction_date` (`finance/api.js` L77–82, L491+) |
| **Suggested fix** | After EXPLAIN, consider **dropping** non-partial `idx_ft_date` / `idx_ft_direction` if `00168` partial indexes cover plans; keep `customer_id` / FK indexes |
| **Expected benefit** | Less duplicate maintenance on high-insert ledger |
| **Write cost** | Lower if redundant indexes removed |

---

### F7-HIGH-03 — Missing `sim_cards(customer_id)` partial index

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `sim_cards` |
| **Query pattern** | `fetchSimCardsByCustomer`: `.eq('customer_id', customerId).is('deleted_at', null)` (`simCards/api.js` L226–236); `CustomerDetailPage` hook |
| **Existing** | `idx_sim_cards_active (status, operator)` — not customer |
| **Suggested DDL** | `CREATE INDEX idx_sim_cards_customer_active ON sim_cards (customer_id) WHERE deleted_at IS NULL;` |
| **Expected benefit** | Customer detail SIM tab O(log n) vs seq scan per customer |
| **Write cost** | Low — SIM row updates per card |

---

### F7-HIGH-04 — Missing proposals list indexes (`status`, `created_at`, `site_id`)

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `proposals` |
| **Query pattern** | `proposals_detail` list: `.eq('status')`, `.gte('created_at', …)`, `.order('created_at', { ascending: false })` (`proposals/api.js` L274–307); `.eq('site_id', siteId)` L548–552 |
| **Existing** | Only `idx_proposals_proposal_no_active` (`00087` L10–12) |
| **Suggested DDL** | `CREATE INDEX idx_proposals_list ON proposals (created_at DESC, status) WHERE deleted_at IS NULL;` + `CREATE INDEX idx_proposals_site_active ON proposals (site_id) WHERE deleted_at IS NULL;` |
| **Expected benefit** | Proposal list and site-scoped queries scale past thousands of rows |
| **Write cost** | Medium on proposal status churn |

---

### F7-HIGH-05 — Duplicate `financial_transaction_payments(transaction_id)` indexes

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** (redundancy) |
| **Table** | `financial_transaction_payments` |
| **Indexes** | `idx_ftp_transaction_id` (`00207` L97–99); `idx_ftp_transaction` (`00212` L63) |
| **Query pattern** | `fetchTransactionPayments` `.eq('transaction_id', …)` (`finance/api.js` L876) |
| **Suggested fix** | Drop one duplicate; keep partial `WHERE deleted_at IS NULL` version |
| **Expected benefit** | Reduced write amplification on Tahsilat payment inserts |
| **Write cost** | Lower after drop |

---

### F7-HIGH-06 — Paraşüt health query: `updated_at` + `parasut_sync_status` filter

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Table** | `financial_transactions` |
| **Query pattern** | `.gte('updated_at', since).not('parasut_sync_status', 'is', null)` (`ParasutHealthCard.jsx` L9–13) |
| **Existing** | `idx_ft_parasut_sync_status` — status values only, no `updated_at` |
| **Suggested DDL** | `CREATE INDEX idx_ft_parasut_health ON financial_transactions (updated_at DESC) WHERE parasut_sync_status IS NOT NULL AND deleted_at IS NULL;` |
| **Expected benefit** | Finance dashboard health card avoids scanning recent FT changes |
| **Write cost** | Medium — Paraşüt sync updates `updated_at` frequently on touched rows |

---

### F7-MED-01 — Missing `work_orders(created_by)` partial index (RLS + app filters)

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `work_orders` |
| **Query pattern** | RLS `created_by = auth.uid()` (`00083` L22–23); supports Phase 6 policy OR branch |
| **Suggested DDL** | `CREATE INDEX idx_work_orders_created_by_active ON work_orders (created_by) WHERE deleted_at IS NULL;` |
| **Expected benefit** | Faster field_worker visibility checks when not using `assigned_to` GIN |
| **Write cost** | Low |

---

### F7-MED-02 — `materials` category filter without `deleted_at` partial composite

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `materials` |
| **Query pattern** | `.eq('category', …).is('deleted_at', null)` (`materials/api.js` L27–28) |
| **Existing** | `idx_materials_category` (`00008` L21) — not partial on active rows |
| **Suggested DDL** | `CREATE INDEX idx_materials_category_active ON materials (category) WHERE deleted_at IS NULL;` |
| **Expected benefit** | Smaller index for category-filtered catalog |
| **Write cost** | Low |

---

### F7-MED-03 — Tahsilat / collection document search uses `ilike` on view columns

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `v_collection_documents` (backed by `financial_transactions` + joins) |
| **Query pattern** | `customer_name.ilike.%…%`, `description.ilike.%…%` (`finance/api.js` L942–945) |
| **Indexes** | Customer name search on `customers` trigram (`00100`); **no** trgm on FT `description` |
| **Suggested fix** | Push search to normalized column on FT or restrict to `customer_id` + date index; optional `description_search` generated column + GIN (like materials `00220`) |
| **Expected benefit** | Tahsilat search at 500-row limit stays sub-second with growth |
| **Write cost** | Medium if generated search column added |

---

### F7-MED-04 — `subscriptions_detail.has_overdue_pending` filter

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Table** | `subscriptions_detail` (view) |
| **Query pattern** | `.eq('has_overdue_pending', true)` (`subscriptions/api.js` L151) |
| **Root cause** | Computed subquery in view (`00114` family) — **not indexable on view column** |
| **Suggested fix** | Index underlying `subscription_payments (subscription_id)` pending rows (see F7-CRIT-01); optional materialized flag on `subscriptions` if filter stays hot |
| **Expected benefit** | Subscription list “overdue” filter without scanning all subs |
| **Write cost** | Depends on approach |

---

### F7-LOW-01 — Strong coverage: work orders, customers, WO materials FK

| Field | Value |
|-------|-------|
| **Risk** | **LOW** (positive) |
| **Tables** | `work_orders`, `customers`, `work_order_materials` |
| **Evidence** | `00100` partial + trigram; `idx_wo_materials_wo_id` (`00010` L20) supports child lookups |
| **Note** | RLS EXISTS on materials still expensive (Phase 6) — index does not remove correlated policy |

---

### F7-LOW-02 — `00221` work history RPC aligned with WO indexes

| Field | Value |
|-------|-------|
| **Risk** | **LOW** (positive) |
| **Evidence** | Filters pushed into `search_work_history` (`00221`); uses `work_orders_detail` + `assigned_to` / search columns backed by `00100` |
| **App** | `workHistory/api.js` (per query optimization doc) |

---

## Soft-delete partial index alignment

| Table | App `deleted_at IS NULL` | Partial index |
|-------|--------------------------|---------------|
| `financial_transactions` | Yes (`finance/api.js` L81+) | Yes (`00081`, `00168`) |
| `work_orders` | Via view/RLS | Yes (`00083`, `00100`) |
| `customers`, `customer_sites`, `materials`, `sim_cards`, `proposals` | Yes | Yes |
| `financial_transaction_payments` | Yes (`finance/api.js` L877) | Yes (`00207`) |
| `subscription_payments` | N/A | N/A (status-based) |
| `subscriptions` | N/A | Status partial (`00168`) |

---

## RLS-related index notes (Phase 6 cross-ref)

| Policy need | Index support |
|-------------|---------------|
| `ANY(assigned_to)` | **GIN** `idx_work_orders_assigned_to_gin` |
| `EXISTS (… work_orders.id = child.work_order_id)` | **`idx_wo_materials_wo_id`**, `idx_woa_work_order` |
| `get_my_role()` | **`idx_profiles_id_role`** — not a table index but helps profile lookup |
| `created_by = auth.uid()` | **Gap** — F7-MED-01 |

---

## Duplicate / redundant index summary

| Pair | Recommendation |
|------|----------------|
| `idx_work_orders_assigned_array` + `idx_work_orders_assigned_to_gin` | Drop one |
| `idx_ftp_transaction` + `idx_ftp_transaction_id` | Drop one |
| `idx_ft_date` / `idx_ft_direction` vs `idx_fin_transactions_date_direction` | Review with EXPLAIN; likely drop legacy full-table |
| `idx_work_orders_status` + `idx_work_orders_status_deleted` + `idx_work_orders_active` | Overlapping status indexes — consolidate after metrics |

---

## Findings Count

| Severity | Count |
|----------|-------|
| **CRITICAL** | **2** |
| **HIGH** | **6** |
| **MEDIUM** | **4** |
| **LOW** | **2** |

---

## Recommended Indexes Needing Review (priority order)

1. **`subscription_payments`** — composite `(status, payment_month)` partial pending (F7-CRIT-01)  
2. **`financial_transactions`** — `payment_status` + income + `transaction_date` partial (F7-CRIT-02)  
3. **`work_orders`** — drop duplicate GIN on `assigned_to` (F7-HIGH-01)  
4. **`sim_cards(customer_id)`** partial active (F7-HIGH-03)  
5. **`proposals`** — list `(created_at DESC, status)` + `site_id` partial (F7-HIGH-04)  
6. **`financial_transaction_payments`** — dedupe `transaction_id` indexes (F7-HIGH-05)  
7. **`financial_transactions`** — Paraşüt health `(updated_at)` partial (F7-HIGH-06)  

---

## Recommended Next Actions

1. **Staging `EXPLAIN (ANALYZE, BUFFERS)`** on: Collection Desk pending query, `fetchReceivables`, proposals list, SIM-by-customer — with production-like row counts.  
2. **After APPROVE:** single migration with **2 CRITICAL** composites + redundant index drops (measure write rate on `subscription_payments` / FT first).  
3. **Phase 8:** View/RPC cost for `subscriptions_detail.has_overdue_pending` and `v_collection_*` (indexes alone may not fix view subqueries).  
4. **Do not** add broad catch-all indexes without EXPLAIN — prefer partial indexes matching exact app `WHERE` clauses.

---

## Overall Verdict

**CONDITIONAL PASS**

Existing migrations (**especially `00100` + `00168`**) match most **work order** and **basic finance date** access patterns. **Collection billing** and **hybrid payment / receivables** paths are the main **index gaps**; addressing **F7-CRIT-01** and **F7-CRIT-02** should precede large historical payment imports or multi-year ledger use.
