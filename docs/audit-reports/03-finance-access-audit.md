# Phase 3 — Finance Access Audit Report

> **Date:** 2026-05-31  
> **Scope:** Role-based finance data access, mutation paths, CLAUDE.md finance rules, app route guards vs DB  
> **Method:** `CLAUDE.md`, migrations `00040`–`00218`, `src/App.jsx`, `src/lib/roles.js`, `src/features/finance/**`, subscriptions, proposals, workOrders  
> **Related:** [01-rls-audit.md](./01-rls-audit.md) (table RLS), [02-security-definer-rpc-audit.md](./02-security-definer-rpc-audit.md) (full RPC inventory — **not duplicated here**)  
> **Status:** Audit only — no code or migration changes

---

## Executive Summary

**Finance table RLS is correctly scoped** to `admin` and `accountant` for `financial_transactions` and `financial_transaction_payments` (`00116`, `00212`). Finance module routes (`/finance/*`), subscriptions, proposals, and subscription Collection Desk are behind `RoleRoute` (`canWrite` = admin OR accountant). **P&L and VAT reporting use `v_profit_and_loss` → `financial_transactions` only** (`00150`); the app does not aggregate `subscription_payments` into ledger totals.

**Production gaps are access-path and process-rule issues**, not missing finance routes for field workers:

1. **Tahsilat views** (`v_collection_customer_summary`, `v_collection_documents`) lack `security_invoker` — direct PostgREST can expose margins/COGS/collections to any authenticated role (see 01-rls F-CRIT-01).
2. **Dashboard `/`** is not role-gated and calls **SECURITY DEFINER** RPCs that return MRR, net profit, revenue/expense series, and overdue subscription amounts to **field_worker** despite FT/subscription table RLS denial.
3. **Proposal TRY completion** uses raw `proposals.status` UPDATE instead of `complete_proposal_with_rate` (CLAUDE.md completion-RPC rule).
4. Several **finance-adjacent RPCs** lack `get_my_role()` guards (details cross-referenced to Phase 2; impact summarized below).

**Overall verdict:** **FAIL** — finance confidentiality and CLAUDE completion rules are not fully enforced end-to-end until view invoker mode, dashboard gating, RPC role guards, and proposal completion paths are fixed.

---

## How This Differs From Phase 2

| Phase 2 | Phase 3 (this report) |
|---------|----------------------|
| Full SECURITY DEFINER RPC inventory | **Who** can reach finance data and **how** (UI route → API → table/view/RPC) |
| `search_path`, grant lists | **CLAUDE.md** ledger rules, mutation paths, double-count checks |
| Generic RPC risk | **Role × object matrix** for finance module surfaces |

---

## Audit Plan — Direct Answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Can `field_worker` CRUD `financial_transactions` / `financial_transaction_payments`? | **No** via table RLS (`00116`, `00212`). **Yes** indirectly via unguarded definer RPCs (dashboard, recurring generate) and Tahsilat views without invoker. |
| 2 | Are receivables (`payment_status` unpaid) limited to correct roles? | **UI:** `/finance/receivables` behind `RoleRoute`. **DB:** FT SELECT admin/accountant only; receivables query filters unpaid (`api.js` L847–852). **Bypass:** Tahsilat views if definer. |
| 3 | Is `payment_status` set directly from app on FT? | **No** in app JS. Tahsilat inserts `financial_transaction_payments`; trigger `fn_update_transaction_payment_status` (`00207`). WO RPC sets status server-side (`00208` L117–118) — acceptable server path, not app PATCH. |
| 4 | Do completion RPCs enforce role checks? | **`fn_complete_work_order_with_payment`:** auth only, no `get_my_role()` (`00208`). **`complete_proposal_with_rate`:** no role guard (`00210`/`00211`). |
| 5 | Can field_worker call finance RPCs (soft delete, record payment, write-off)? | **`fn_record_payment` / `fn_revert_write_off`:** guarded (`00122`, `00180`). **`soft_delete_transaction`:** blocked for field_worker (stale role list still allows accountant). **`fn_generate_recurring_expenses`:** **any authenticated** — CRITICAL. |
| 6 | Are P&L/collection views restricted at DB? | **`v_profit_and_loss`:** yes (`security_invoker` `00150`). **`v_collection_*`:** **no** invoker (`00213`/`00214`). |
| 7 | Subscription payment → finance trigger respects `official_invoice`/VAT? | **Yes** in DB (`00201`, `00212` trigger body). App passes `vat_rate` into `fn_record_payment` (`paymentsApi.js` L38–62). |
| 8 | Proposal-linked WO revenue single-path? | **Yes** — `auto_record_work_order_revenue` skips when `proposal_id IS NOT NULL` (`00200` L33–35); completion RPC returns `completed_proposal_linked` (`00208` L67–69). |
| 9 | Tahsilat exposes cross-customer data to restricted roles? | **UI:** filtered by customer on Tahsilat page. **DB:** views aggregate **all** customers; without invoker, any authenticated caller sees full dataset. |

---

## Role Model

| Role | `canWrite` (`src/lib/roles.js` L18) | Intended finance access |
|------|-------------------------------------|-------------------------|
| `admin` | Yes | Full ledger, Tahsilat, subscriptions billing, Paraşüt |
| `accountant` | Yes | Same as admin for finance modules |
| `field_worker` | No | Work orders, customers, daily work — **no** ledger/subscription billing UI |

`RoleRoute` (`src/App.jsx` L18–22): redirects non-`canWrite` users to `/work-orders`.

---

## Role × Finance Surface Matrix

| Surface | admin | accountant | field_worker | UI guard | DB / RPC guard |
|---------|-------|------------|--------------|----------|----------------|
| `/finance/*` (dashboard, income, expenses, VAT, recurring, receivables, Tahsilat) | ✅ | ✅ | ❌ redirect | `RoleRoute` L152–159 | FT/FTP RLS deny |
| `/subscriptions` + `/subscriptions/collection` (Collection Desk) | ✅ | ✅ | ❌ | `RoleRoute` L135–137 | `subscription_payments` RLS `00133` |
| `/proposals/*` | ✅ | ✅ | ❌ | `RoleRoute` L146–149 | `proposals` SELECT `00133` |
| `/` Dashboard finance widgets | ✅ shown | ✅ shown | **⚠️ data loads** | **None** (L105) | RPC bypass |
| `/action-board` subscription overdue | ⚠️ | ⚠️ | query runs | None | RLS → empty/error |
| `financial_transactions` | ✅ | ✅ | ❌ | — | `00116` SELECT/UPDATE |
| `financial_transactions` INSERT | ✅ | ✅ | ❌ | — | `ft_insert` `00107` (stale role names; FW still denied) |
| `financial_transaction_payments` | ✅ | ✅ | ❌ | — | `00212` |
| `v_profit_and_loss` | ✅ | ✅ | ❌* | Finance routes | `security_invoker` `00150` |
| `v_collection_customer_summary` / `v_collection_documents` | ⚠️ leak | ⚠️ leak | ⚠️ **leak** | Tahsilat route only | **No invoker** `00213` |
| `subscription_payments` (desk / schedule) | ✅ | ✅ | ❌ | RoleRoute | `00133` |
| Standalone WO complete + payment | ✅ | ✅ | **can complete**† | WO page (all roles) | RPC `00208` no role check |
| Proposal-linked WO → `completed` | ✅ | ✅ | **can complete**† | WO page | Trigger skips FT revenue |
| TRY proposal → `completed` | ✅ | ✅ | ❌ route | RoleRoute | Raw UPDATE + trigger |
| USD proposal → `completed` | ✅ | ✅ | ❌ route | Rate modal | `complete_proposal_with_rate` RPC |
| Paraşüt FT columns / edge sync | ✅ | ✅ | ❌‡ | Mostly RoleRoute | FT RLS; tokens `00216` deny client |

\*Empty result set for field_worker when invoker is on.  
†Field workers may complete assigned WOs by design; finance RPC should still validate assignment.  
‡`ParasutInvoicePanel` on completed standalone WO has no `canWrite` wrapper (`WorkOrderDetailPage.jsx` L391–393).

---

## CLAUDE.md Finance Rules — Compliance Checklist

| Rule | Status | Evidence |
|------|--------|----------|
| **`financial_transactions` is reporting source of truth** | ✅ | `fetchProfitAndLoss`, VAT, `fetchFinanceDashboardKpis` use `v_profit_and_loss` (`api.js` L334–374, L420–448); view = FT only `00150` |
| **Do not use `subscription_payments` as P&L ledger** | ✅ | No UNION in `v_profit_and_loss` since `00150`; dashboard P&L leg uses view/RPC on FT |
| **`subscription_payments` for collection/scheduling only** | ✅ | `collectionApi.js` (Collection Desk); `paymentsApi.js` schedule; distinct from Tahsilat (`financial_transaction_payments`) |
| **`deleted_at IS NULL` on FT reads** | ⚠️ Mostly | `fetchTransactions` L81, `fetchReceivables` L853; view SQL; **gap:** `parasutApi.js` L15–64 |
| **Do not set `payment_status` from app on FT** | ✅ | No app `.update({ payment_status })`; Tahsilat INSERT to FTP + trigger (`api.js` L961–971, `00207`) |
| **Complete WO/proposals via RPCs, not raw status** | ⚠️ Partial | WO standalone: `completeWorkOrderWithPayment` ✅; WO proposal-linked: status UPDATE ✅ (no WO revenue); **TRY proposals: `updateProposalStatus`** ❌ |
| **No double revenue for proposal-linked WOs** | ✅ | `00200` L33–35; `00208` L67–69 |
| **Dynamic VAT / `official_invoice` in DB** | ✅ | `00201` subscription trigger; `fn_record_payment` uses subscription context |
| **Avoid magic 0.20 in app for ledger** | ⚠️ Minor | Form defaults `vat_rate: 20` in `schema.js` / `QuickEntryModal.jsx` — UI default only |

### Rules violated or at risk

1. **Completion via RPC** — TRY proposals use raw `proposals` UPDATE (F-HIGH-01).  
2. **Finance data limited to admin/accountant** — dashboard + definer RPCs + Tahsilat views break defense-in-depth (F-CRIT-01/02).  
3. **Views must respect RLS** — Tahsilat views (F-CRIT-01).

---

## Mutation Path Analysis

### A. Work order completion

| Path | App | DB | Finance effect | CLAUDE |
|------|-----|-----|----------------|--------|
| Standalone | `WorkOrderCompletionModal` → `completeWorkOrderWithPayment` (`api.js` L476) | RPC `00208` | Income + optional FTP; RPC may set `payment_status` | ✅ Intended |
| Proposal-linked | `updateWorkOrder({ status: 'completed' })` (`WorkOrderDetailPage.jsx` L502) | Trigger skip | No WO income row | ✅ No duplicate |
| Risk | Any authenticated + WO UUID | No role/assignment in `00208` | Cross-user completion + finance | ❌ |

### B. Proposal completion

| Currency | App (`ProposalDetailPage.jsx`) | DB |
|----------|-------------------------------|-----|
| USD | L167–178 → `completeProposalWithRate` | RPC sets rate columns; trigger records revenue |
| TRY / other | L159–163, L580 → `updateProposalStatus` | Direct `UPDATE proposals SET status = 'completed'`; trigger runs |

`complete_proposal_with_rate` requires `p_exchange_rate > 0` (`00210` L288–290) — cannot be used for TRY without API/DB change.

### C. Subscription payments → ledger

| Path | Guard | Ledger |
|------|-------|--------|
| `recordPayment` → `fn_record_payment` | ✅ `00122` | Trigger `fn_subscription_payment_to_finance` (`00201` VAT/`official_invoice`) |
| Collection Desk KPIs | RoleRoute | Reads `subscription_payments` only — **not** P&L |
| Write-off | DB trigger `00180` | Creates FT via definer trigger |
| `revertWriteOff` | RPC `00180` grant | Restores pending payment |

### D. Manual ledger / recurring / soft delete

| Path | Guard |
|------|-------|
| `createTransaction` / `updateTransaction` | RLS insert/update admin/accountant |
| `deleteTransaction` → `soft_delete_transaction` | RPC: accountant allowed; stale `manager`/`office` in check `00107` L17 |
| `triggerRecurringGeneration` | ❌ **No role** — `00096` grant + `recurringApi.js` L85–87 |

### E. Tahsilat (hybrid payment / `/finance/collections`)

- **Reads:** `fetchCollectionSummaries` / `fetchCollectionDocuments` → `v_collection_*` (`api.js` L911–958).  
- **Writes:** `recordPayment` → INSERT `financial_transaction_payments`; parent status via trigger only.  
- **Paraşüt:** optional `parasut-dispatch` after insert (`api.js` L975–985).

### F. Paraşüt finance sync

| Asset | Client access | Notes |
|-------|---------------|-------|
| `financial_transactions.parasut_*` | Via FT RLS | `00217` |
| `financial_transaction_payments.parasut_*` | Via FTP RLS | `00218` |
| `parasut_oauth_tokens` | Denied | `00216` — edge only |
| `parasutApi.js` | RoleRoute contexts | Missing `deleted_at` filter |

---

## App Route vs Database

| Scenario | UI | DB/API |
|----------|-----|--------|
| field_worker → `/finance` | Redirect to `/work-orders` | ✅ |
| field_worker → `/` | MRR, uncollected, net profit, chart | ❌ RPCs return data |
| field_worker → PostgREST `financial_transactions` | — | 0 rows |
| field_worker → `v_collection_customer_summary` | — | **Full aggregate today** |
| accountant → Tahsilat | ✅ | ✅ after invoker fix |
| accountant → TRY complete proposal | Confirm modal | Revenue via trigger, not RPC |

---

## Findings

### CRITICAL

#### F-CRIT-01 — Tahsilat views expose ledger aggregates without RLS invoker

| Field | Detail |
|-------|--------|
| **Risk** | CRITICAL |
| **Files** | `supabase/migrations/00213_tahsilat_views.sql` L4–84; `00214_collection_customer_summary_profit.sql` |
| **Objects** | `v_collection_customer_summary`, `v_collection_documents` |
| **Roles** | **field_worker** (+ any authenticated direct API call) |
| **Current** | App: `api.js` L912, L931 behind `RoleRoute`; PostgREST not blocked at view layer |
| **Why risky** | Per-customer billed/collected/outstanding, COGS, profit — full company collection picture |
| **Proposed fix** | `ALTER VIEW … SET (security_invoker = true)`; verify field_worker SELECT returns 0 rows |

#### F-CRIT-02 — Dashboard loads finance and subscription aggregates for all roles

| Field | Detail |
|-------|--------|
| **Risk** | CRITICAL |
| **Files** | `src/pages/DashboardPage.jsx` L40–45, L133–178, L186; `src/features/finance/api.js` L420–424; `src/features/dashboard/api.js` L119; `RevenueExpenseLineChart.jsx` L46 |
| **Objects** | `get_subscription_stats`, `get_monthly_revenue_expense`, `fetchFinanceDashboardKpis` → `v_profit_and_loss` |
| **Roles** | **field_worker** |
| **Current** | Net profit card links to `/finance` (L177) but KPI value visible without `canWrite` |
| **Why risky** | UI not behind `RoleRoute`; definer RPCs bypass `00116` / `00133` RLS |
| **Proposed fix** | Wrap finance KPIs/chart in `canWrite`; add `get_my_role()` guards in RPCs (see Phase 2) |

#### F-CRIT-03 — `fn_generate_recurring_expenses` callable by any authenticated user

| Field | Detail |
|-------|--------|
| **Risk** | CRITICAL |
| **Files** | `supabase/migrations/00096_recurring_generation_return_count.sql`; `src/features/finance/recurringApi.js` L85–87 |
| **Objects** | `financial_transactions`, notifications |
| **Roles** | **field_worker** (direct RPC) |
| **Current** | Inserts expense rows as SECURITY DEFINER |
| **Proposed fix** | Role guard + REVOKE from `authenticated` except cron/service role; gate UI button with `canWrite` |

---

### HIGH

#### F-HIGH-01 — TRY proposal completion bypasses `complete_proposal_with_rate`

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `src/features/proposals/ProposalDetailPage.jsx` L159–163, L166–171, L580; `src/features/proposals/api.js` L442–456 |
| **Objects** | `proposals.status` UPDATE |
| **Roles** | admin, accountant (process rule) |
| **Why risky** | CLAUDE.md mandates completion RPC; no `completed_by` / rate audit on TRY path |
| **Proposed fix** | Extend RPC for TRY (NULL or 1.0 rate) or DB trigger blocking direct `completed` transition |

#### F-HIGH-02 — `fn_complete_work_order_with_payment` lacks role and assignment checks

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `supabase/migrations/00208_complete_work_order_with_payment_rpc.sql` L17–131; `src/features/workOrders/api.js` L476–484 |
| **Roles** | field_worker (intended) + any user with arbitrary WO UUID |
| **Why risky** | Sets FT `payment_status` and inserts FTP without verifying assignee or `canWrite` for finance side effects |
| **Proposed fix** | `get_my_role() IN ('admin','accountant') OR auth.uid() = ANY(assigned_to) OR created_by = auth.uid()` |

#### F-HIGH-03 — Dashboard finance RPCs lack role guards

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `00128_dashboard_revenue_rpc.sql`; `00129_dashboard_overdue_payments_rpc.sql`; `00130_subscription_stats_unpaid_amount.sql` |
| **Functions** | `get_monthly_revenue_expense`, `get_overdue_subscription_payments`, `get_subscription_stats` |
| **Roles** | field_worker |
| **Proposed fix** | `IF get_my_role() NOT IN ('admin','accountant') THEN RAISE …` (Phase 2 F-CRIT-01/02) |

#### F-HIGH-04 — `fetchFinanceDashboardKpis` bundles subscription RPC + P&L for unguarded dashboard

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `src/features/finance/api.js` L419–481 |
| **Roles** | All authenticated via `DashboardPage` |
| **Proposed fix** | Split helpers; call finance KPI helper only when `canWrite` |

#### F-HIGH-05 — Subscription finance mutation RPCs without role guards

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `generate_subscription_payments` (`00148`); `bulk_import_subscriptions` (`00137`); `fn_update_subscription_price` (`00151`) |
| **Roles** | field_worker if invoked directly |
| **Proposed fix** | `get_my_role() IN ('admin','accountant')` — see Phase 2 |

#### F-HIGH-06 — `complete_proposal_with_rate` has no role guard

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `00210_complete_proposal_with_rate_rpc.sql` L277–307 |
| **Roles** | Any authenticated with EXECUTE |
| **Proposed fix** | Role check at RPC entry |

---

### MEDIUM

#### F-MED-01 — `ParasutInvoicePanel` rendered without `canWrite`

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `src/features/workOrders/WorkOrderDetailPage.jsx` L391–393 |
| **Roles** | field_worker on completed standalone WO |
| **Proposed fix** | Wrap with `canWrite` |

#### F-MED-02 — Paraşüt FT queries omit `deleted_at IS NULL`

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `src/features/finance/parasutApi.js` L15–64 |
| **Proposed fix** | Add `.is('deleted_at', null)` |

#### F-MED-03 — Stale comment implies `subscription_payments` in P&L view

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM (regression risk) |
| **Files** | `src/features/finance/api.js` L319 |
| **Proposed fix** | Update comment to FT-only per `00150` |

#### F-MED-04 — `actionBoard` queries `subscription_payments` without `canWrite`

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `src/features/actionBoard/api.js` L34–52 |
| **Roles** | field_worker — blocked by RLS today |
| **Proposed fix** | Skip query or use role-scoped RPC when board should show overdue for writers only |

#### F-MED-05 — `soft_delete_transaction` and `ft_insert` use obsolete role names

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `00107_soft_delete_transaction_rpc.sql` L17–18, L39–40; `00116` fixed SELECT/UPDATE only |
| **Note** | `manager`/`office` do not exist; accountant still works |
| **Proposed fix** | Align all FT policies/RPC checks with `('admin','accountant')` |

#### F-MED-06 — Default `vat_rate: 20` in finance form schemas

| Field | Detail |
|-------|--------|
| **Risk** | LOW–MEDIUM |
| **Files** | `src/features/finance/schema.js` L33, L73; `QuickEntryModal.jsx` |
| **Proposed fix** | Default from row or `finance_settings` |

---

### LOW

#### F-LOW-01 — Collection Desk uses `subscription_payments` (not a P&L violation)

| Field | Detail |
|-------|--------|
| **Files** | `src/features/finance/collectionApi.js`; route `App.jsx` L137 |
| **Note** | Operational tahsilat for subscriptions; ledger still via trigger to FT |

#### F-LOW-02 — `exchange_rates` readable by all roles

| Field | Detail |
|-------|--------|
| **Files** | `CurrencyWidget` on dashboard |
| **Note** | Acceptable for operational USD pricing |

---

## Two Collection Systems (Clarification)

| UI | Path | Data source | Ledger? |
|----|------|-------------|---------|
| **Collection Desk** | `/subscriptions/collection` | `subscription_payments` | No — schedule/billing ops |
| **Tahsilat** | `/finance/collections` | `v_collection_*` on `financial_transactions` | Yes — hybrid payment / receivables |

Both are `RoleRoute`-gated; field_worker cannot open either in UI, but Tahsilat **views** remain a direct API risk (F-CRIT-01).

---

## Finding Counts

| Severity | Count |
|----------|-------|
| CRITICAL | **3** |
| HIGH | **6** |
| MEDIUM | **6** |
| LOW | **2** |

---

## Recommended Staging Tests (Finance Access)

1. **field_worker** JWT: `SELECT * FROM financial_transactions` → 0 rows.  
2. Same: `SELECT * FROM v_collection_customer_summary` → 0 rows after invoker fix; document current leak before fix.  
3. Same: `rpc('get_subscription_stats')` / `rpc('get_monthly_revenue_expense', { months_back: 7 })` → must fail after guards.  
4. Same: `rpc('fn_generate_recurring_expenses')` → must fail.  
5. **accountant**: Tahsilat `recordPayment` → verify `payment_status` changes only via FTP trigger.  
6. **accountant**: complete TRY proposal → compare audit columns vs USD RPC path.  
7. Complete proposal-linked WO → confirm no WO income row; income only on proposal completion.

---

*End of Phase 3 report. Implementation requires explicit approval.*
