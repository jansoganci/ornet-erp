# Phase 1 — Supabase RLS Audit Report

> **Date:** 2026-05-31  
> **Scope:** Row Level Security on `public` tables and finance/collection views  
> **Method:** Migration history analysis (00001–00223); no live DB `pg_policies` query  
> **Status:** Audit only — no code or migration changes

---

## Executive Summary

Ornet ERP’s RLS posture is **substantially improved** since the archived 2026-03 RLS audit (`docs/archive/completed/RLS-AUDIT.md`). Finance tables, subscriptions, proposals, SIM inventory, and subscription payments are **restricted to `admin` + `accountant`** at the database layer. Customer **writes** align with `canWrite` after `00126` and `00215`.

**Blocking issue before production:** Tahsilat views `v_collection_customer_summary` and `v_collection_documents` (`00213`, `00214`) are created **without** `security_invoker = true`. The same class of bug previously affected `v_profit_and_loss` (`00102`). If these views run as owner/definer, **`field_worker` can read aggregated finance/collection data via PostgREST** even though `financial_transactions` RLS denies direct table access.

**Overall verdict:** **CONDITIONAL PASS** — fix Tahsilat view invoker mode (and verify in staging) before loading real company/finance data.

---

## Role Model Reference

| Role | App (`src/lib/roles.js`) | DB helper |
|------|--------------------------|-----------|
| `admin` | `isAdmin`, `canWrite` | `get_my_role() = 'admin'` |
| `accountant` | `isAccountant`, `canWrite` | `get_my_role() = 'accountant'` |
| `field_worker` | `isFieldWorker`, no `canWrite` | `get_my_role() = 'field_worker'` |

`RoleRoute` in `src/App.jsx` (lines 18–22) redirects non-`canWrite` users away from finance, subscriptions, proposals, SIM, and operations UI — **not a security boundary by itself**.

---

## Table Inventory (RLS Enabled)

All core application tables found with `ENABLE ROW LEVEL SECURITY` in migrations:

| Table | RLS enabled (migration) | Policies (final names) |
|-------|-------------------------|-------------------------|
| `profiles` | `00001` | select all auth; update own; insert/delete admin |
| `customers` | `00002` | select active rows all auth; insert/update canWrite; delete admin |
| `customer_sites` | `00007` | select active all auth; insert/update canWrite; delete admin |
| `work_orders` | `00003`/`00009` | scoped select/update; insert all auth; delete admin |
| `work_order_materials` | `00010` | scoped via `work_orders` |
| `materials` | `00008` | select all auth; manage admin only |
| `tasks` | `00004` | role-scoped (`00097`, `00205`) |
| `subscriptions` | `00016` | select/insert/update canWrite; delete admin |
| `subscription_payments` | `00016` | select canWrite (`00125`/`00133`); writes canWrite |
| `payment_methods` | `00016` | **select admin only** (`00121`); insert/update canWrite |
| `audit_logs` | `00016` | select admin + WO-scoped (`00162`); insert admin |
| `financial_transactions` | `00040` | select/update canWrite + soft-delete (`00116`); insert see note; delete admin |
| `financial_transaction_payments` | `00212` | select/insert/update canWrite; delete admin |
| `expense_categories` | `00041` | select all auth; manage canWrite |
| `exchange_rates` | `00042` | select all auth; manage canWrite |
| `recurring_expense_templates` | `00070` | canWrite / delete admin |
| `finance_settings` | `00171` | select/update canWrite; insert/delete admin |
| `proposals` / `proposal_items` | `00027` | select canWrite; manage admin+accountant |
| `proposal_work_orders` | `00028` | select canWrite (`00125`) |
| `proposal_sections` | `00198` | select canWrite; manage admin+accountant |
| `proposal_annual_fixed_costs` | `00165` | select canWrite; manage admin+accountant |
| `sim_cards` / `sim_card_history` | `00023` | select canWrite (`00124`/`00125`); manage canWrite (`00104`) |
| `sim_static_ips` | `00090` | select canWrite; write/delete restricted |
| `site_assets` / `work_order_assets` | `00074` | assets read all auth; writes canWrite / WO-scoped |
| `notifications` | `00064` | canWrite only |
| `user_reminders` | `00064` | per-user + admin |
| `operations_items` (ex `service_requests`) | `00160` | **select all auth**; insert/update canWrite |
| `plan_items` | `00174` | **select all auth**; writes canWrite |
| `provider_companies` | `00103` | read all auth; manage admin |
| `parasut_match_candidates` | `00215` | **admin only** |
| `parasut_oauth_tokens` | `00216` | deny all client (`USING (false)`) |
| `parasut_idempotency` / `parasut_audit_log` | `00216` | select admin |
| `subscription_price_revision_notes` | `00033` | canWrite |

**Anon access:** `00077` and `00205` revoke/drop permissive anon policies on app tables. No intentional anon read/write on core ERP tables in current migrations.

---

## Focus Tables — Effective Access Matrix

Legend: ✅ allowed · ❌ denied · 🔶 scoped (own WO / assigned)

| Object | admin | accountant | field_worker | Matches `RoleRoute`? |
|--------|-------|------------|--------------|----------------------|
| **customers** SELECT | ✅ | ✅ | ✅ | N/A (routes open) — **intentional read** |
| **customers** INSERT/UPDATE | ✅ | ✅ | ❌ | Partial — UI allows `/customers/new` without `RoleRoute` |
| **customer_sites** SELECT | ✅ | ✅ | ✅ | Same as customers |
| **customer_sites** INSERT/UPDATE | ✅ | ✅ | ❌ | `00126` |
| **work_orders** SELECT | ✅ all | ✅ all | 🔶 assigned/created | OK |
| **work_orders** INSERT | ✅ | ✅ | ✅ | OK (field creates jobs) |
| **work_orders** UPDATE | ✅ | 🔶 | 🔶 | OK |
| **subscriptions** SELECT/WRITE | ✅ | ✅ | ❌ | ✅ `App.jsx` 135–143 |
| **subscription_payments** SELECT/WRITE | ✅ | ✅ | ❌ | ✅ |
| **financial_transactions** SELECT/WRITE | ✅ | ✅ | ❌ | ✅ finance routes |
| **financial_transaction_payments** | ✅ | ✅ | ❌ | ✅ |
| **proposals** (+ items, sections) SELECT | ✅ | ✅ | ❌ | ✅ |
| **sim_cards** SELECT/WRITE | ✅ | ✅ | ❌ | ✅ |
| **payment_methods** SELECT | ✅ | ❌ | ❌ | ⚠️ accountant UI may expect read |
| **parasut_match_candidates** | ✅ | ❌ | ❌ | ⚠️ `RoleRoute` allows accountant to page |
| **parasut_oauth_tokens** (client) | ❌ | ❌ | ❌ | ✅ |
| **v_collection_* views** | ✅* | ✅* | **⚠️ CRITICAL if definer** | ✅ UI — **DB gap** |
| **v_profit_and_loss** | ✅* | ✅* | ❌* | ✅ (`security_invoker` `00150`) |

\*With `security_invoker = true`, access follows underlying table RLS (empty result for `field_worker` on finance).

---

## App Route vs DB Enforcement

| UI area | `RoleRoute`? (`src/App.jsx`) | DB blocks `field_worker`? |
|---------|------------------------------|---------------------------|
| Finance (`/finance/*`) | Yes (152–159) | ✅ `financial_transactions`, `ftp_*` |
| Subscriptions | Yes (135–143) | ✅ `subscriptions`, `subscription_payments` |
| Proposals | Yes (146–149) | ✅ `proposals`, `proposal_items`, … |
| SIM cards | Yes (168–172) | ✅ `sim_cards` |
| Operations | Yes (109–110) | ❌ **`operations_items` SELECT open** |
| Customers | **No** (113–118) | Writes ❌; reads ✅ (by design) |
| Work orders / daily work / history | No | Scoped ✅ |
| Materials / equipment | No | Read ✅; material writes admin-only |
| Dashboard | No | Depends on queries/RPCs (Phase 2) |

---

## View / `security_invoker` Status

| View | `security_invoker` set in migrations? | Risk |
|------|--------------------------------------|------|
| `v_profit_and_loss` | ✅ `00150`, `00102` | Low |
| `work_orders_detail` | ✅ `00100`, `00195`, … | Low |
| `subscriptions_detail` | ✅ `00204`, `00139`, … | Low |
| `proposals_detail` | ✅ `00193`, `00092` | Low |
| `sim_cards_list` | ✅ `00219`, `00223` | Low |
| `operations_items_detail` | ✅ `00204` | Low (but base table SELECT is open) |
| **`v_collection_customer_summary`** | ❌ **Not set** (`00213`, `00214`) | **CRITICAL** |
| **`v_collection_documents`** | ❌ **Not set** (`00213`) | **CRITICAL** |
| `v_active_notifications` | Intentionally not invoker (`00097` comment) | Documented; filters in view SQL |

---

## Findings

### CRITICAL

#### F-CRIT-01 — Tahsilat collection views may bypass finance RLS

| Field | Detail |
|-------|--------|
| **Risk** | CRITICAL |
| **Files** | `supabase/migrations/00213_tahsilat_views.sql` (lines 4–47, 49–84); `00214_collection_customer_summary_profit.sql` (lines 7+) |
| **Currently allowed** | Views join `financial_transactions`, `financial_transaction_payments`, and `customers` without `ALTER VIEW … SET (security_invoker = true)`. Pattern matches pre-`00102` `v_profit_and_loss` bug. |
| **Why risky** | Any `authenticated` role (including `field_worker`) calling `supabase.from('v_collection_customer_summary')` or `v_collection_documents` may see **company-wide billing, COGS, margins, and collection totals** if the view runs as owner. App uses these views in `src/features/finance/api.js` (lines 912, 931). |
| **Proposed fix** | New migration: `ALTER VIEW v_collection_customer_summary SET (security_invoker = true);` and same for `v_collection_documents`. Re-run Supabase “Security Definer View” lint. Confirm `field_worker` receives 0 rows / permission error in staging. Optionally `REVOKE` + `GRANT SELECT` explicitly to `authenticated`. **Do not implement without approval.** |

---

### HIGH

#### F-HIGH-01 — `operations_items` readable by all authenticated users

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `supabase/migrations/00160_service_requests.sql` (lines 122–125); renamed in `00172_rename_service_requests.sql` (policy `operations_items_select`) |
| **Currently allowed** | `SELECT` with `USING (deleted_at IS NULL)` — no `get_my_role()` check. `field_worker` can read all operations board rows via API. |
| **Why risky** | UI hides `/operations` behind `RoleRoute` (`App.jsx` 109–110), but **API is not UI**. Exposes customer links, priorities, regions, and ops pipeline data to technicians. |
| **Proposed fix** | Tighten `operations_items_select` to `get_my_role() IN ('admin', 'accountant')` (or narrower scope if field workers need subset). Align with `plan_items` if same module. |

#### F-HIGH-02 — `plan_items` readable by all authenticated users

| Field | Detail |
|-------|--------|
| **Risk** | HIGH |
| **Files** | `supabase/migrations/00174_plan_items.sql` (lines 37–41) |
| **Currently allowed** | `plan_items_select` → `USING (true)` for all `authenticated`. |
| **Why risky** | Operations calendar/plan data visible to `field_worker` despite `RoleRoute` on operations routes. |
| **Proposed fix** | Restrict SELECT to `admin` + `accountant`, matching `operations_items` policy intent. |

---

### MEDIUM

#### F-MED-01 — `financial_transactions` INSERT policy still references obsolete roles

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `supabase/migrations/00107_soft_delete_transaction_rpc.sql` (lines 38–40); `00116_fix_financial_transactions_rls.sql` fixed SELECT/UPDATE only (lines 9–24) |
| **Currently allowed** | `ft_insert` `WITH CHECK (get_my_role() IN ('admin', 'accountant', 'manager', 'office'))`. Roles `manager`/`office` do not exist (`00001_profiles.sql` lines 13–14). Effective access: admin + accountant only. |
| **Why risky** | Stale policy text; future typo could re-open access. Auditors flag as misconfiguration. |
| **Proposed fix** | Migration: replace `ft_insert` (and `soft_delete_transaction` role check line 17) with `('admin', 'accountant')` only. |

#### F-MED-02 — `payment_methods` SELECT is admin-only; accountants blocked at DB

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `supabase/migrations/00121_restrict_payment_methods_select.sql` (lines 8–10); `00120` leaves insert/update as canWrite |
| **Currently allowed** | Only `admin` can `SELECT` `payment_methods`. Accountants have `canWrite` in app and subscription routes. |
| **Why risky** | `subscriptions_detail` uses `security_invoker` and JOINs `payment_methods` — accountants may get incomplete subscription detail or errors. `CustomerDetailPage` uses `usePaymentMethods(canWrite ? id : null)`. |
| **Proposed fix** | Confirm product intent: if payment methods are deprecated, remove UI queries; else allow `accountant` SELECT or drop JOIN from views for accountants. |

#### F-MED-03 — Paraşüt matching: UI `RoleRoute` vs DB admin-only

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `00215_parasut_customer_matching.sql` (lines 91–94); `src/App.jsx` line 115 |
| **Currently allowed** | `parasut_match_candidates_*` policies: `get_my_role() = 'admin'` only. Route wrapped in `RoleRoute` (admin **or** accountant). |
| **Why risky** | Accountants reach the page but cannot read/write staging rows — broken feature, not a data leak. |
| **Proposed fix** | Either restrict nav/route to `isAdmin` only, or extend RLS to `admin` + `accountant` if accountants should match contacts. |

#### F-MED-04 — Customer / import routes lack `RoleRoute`; DB write guard only

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `src/App.jsx` (113–118, 129–130); `00215` (lines 35–44) |
| **Currently allowed** | `field_worker` can open customer/material import URLs; INSERT on customers/sites fails at DB. |
| **Why risky** | Confusing UX; client still sends requests. Defense-in-depth relies entirely on RLS (OK today). |
| **Proposed fix** | Add `RoleRoute` or `canWrite` guards on import/new customer routes for consistency. |

#### F-MED-05 — Full customer PII visible to `field_worker` (by policy)

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM (accept if business-intended) |
| **Files** | `00085_soft_delete_customers.sql` (lines 16–19); `00082` customer_sites |
| **Currently allowed** | All authenticated users read active customers/sites, including Paraşüt columns added in `00215`. |
| **Why risky** | Technicians see full customer list, tax metadata, all sites — broader than “assigned work order” scoping. |
| **Proposed fix** | If policy should narrow: scope SELECT to customers/sites linked to assigned work orders (complex policy) or accept risk and document. |

#### F-MED-06 — `tasks` INSERT allows non-existent `supervisor` role

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `00205_fix_rls_policies.sql` (lines 74–78) |
| **Currently allowed** | `tasks_insert` → `get_my_role() IN ('admin', 'accountant', 'supervisor')`. `supervisor` ∉ `profiles.role` CHECK. |
| **Why risky** | Dead role name; `field_worker` still cannot insert (good). Maintenance hazard. |
| **Proposed fix** | Remove `supervisor` or add role to enum if product requires it. |

#### F-MED-07 — No explicit `GRANT SELECT` on Tahsilat views in repo

| Field | Detail |
|-------|--------|
| **Risk** | MEDIUM |
| **Files** | `00213_tahsilat_views.sql` — no `GRANT`; compare `00150` for `v_profit_and_loss` |
| **Currently allowed** | App queries views; may rely on Supabase defaults. |
| **Why risky** | Deploy drift between environments. |
| **Proposed fix** | Add explicit `GRANT SELECT ON v_collection_* TO authenticated` after invoker fix; verify in staging. |

---

### LOW

#### F-LOW-01 — `exchange_rates` / `expense_categories` SELECT open to all authenticated

| Field | Detail |
|-------|--------|
| **Risk** | LOW |
| **Files** | `00042_exchange_rates.sql` (21–22); `00041_expense_categories.sql` (32–33) |
| **Currently allowed** | All roles can read rate history and category catalog. |
| **Why risky** | Minor information disclosure; finance pages are `RoleRoute`-gated. |
| **Proposed fix** | Optional: restrict SELECT to canWrite roles if field workers must not see rates. |

#### F-LOW-02 — `profiles` SELECT open (assignment dropdowns)

| Field | Detail |
|-------|--------|
| **Risk** | LOW |
| **Files** | `00001_profiles.sql` (78–81) |
| **Proposed fix** | Accept or limit columns via view if phone numbers are sensitive. |

#### F-LOW-03 — `soft_delete_transaction` RPC role list includes `manager`/`office`

| Field | Detail |
|-------|--------|
| **Risk** | LOW |
| **Files** | `00107_soft_delete_transaction_rpc.sql` (line 17) |
| **Proposed fix** | Align with `00116` role set in Phase 2 RPC audit. |

---

## Direct Answers to Phase 1 Checklist

| Question | Answer |
|----------|--------|
| Can `field_worker` read/write finance tables? | **Read/write denied** on `financial_transactions` and `financial_transaction_payments` (policies `00116`, `00212`). **Exception:** Tahsilat **views** if not `security_invoker` (F-CRIT-01). |
| Can `field_worker` write customers/subscriptions/SIM/proposals? | **No** — writes require `admin`/`accountant` on those tables (latest migrations). |
| Sensitive tables open to all authenticated? | **Yes** for customers/sites (read), operations/plan_items (read), exchange_rates/expense_categories (read). Finance **tables** are not open. |
| Tables missing RLS? | None found among tables that enable RLS in migrations; `proposal_sections` fixed in `00198`. |
| Outdated roles in policies? | **`ft_insert`** still lists `manager`/`office` (F-MED-01). Fixed for `ft_select`/`ft_update` in `00116`. |
| `RoleRoute` enforced at DB? | **Yes** for finance, subscriptions, proposals, SIM. **No** for operations/plan_items reads; customers read intentionally broader than write. |
| Views use `security_invoker` where needed? | **Mostly yes**; **Tahsilat views NO** (critical). |

---

## Finance / Tahsilat / Paraşüt Summary

- **`financial_transactions`:** SELECT/UPDATE — `deleted_at IS NULL` + `get_my_role() IN ('admin','accountant')` (`00116`). INSERT — `00107` (stale role names). DELETE — admin (`00107`).
- **`financial_transaction_payments`:** Final policies in `00212` (lines 159–166) — canWrite only; supersedes permissive `00207` `ftp_select_authenticated`.
- **Tahsilat views:** High-sensitivity aggregates; **must** use `security_invoker` (F-CRIT-01).
- **Paraşüt:** OAuth table locked down (`00216` lines 79–83). Audit/idempotency admin-read. Match candidates admin-only.

---

## Historical Regression Notes

Issues from `docs/archive/completed/RLS-AUDIT.md` **addressed in migrations**:

- `financial_transactions` broken roles → **fixed** `00116`
- Customers/sites field_worker write → **fixed** `00126`, reaffirmed `00215`
- Subscriptions/subscription_payments open SELECT → **fixed** `00119`, `00125`, `00133`
- SIM/proposals open SELECT → **fixed** `00124`, `00125`
- `search_work_history` scope → **fixed** `00126`, preserved `00221`

**Not fully closed:** Tahsilat views (new since archive audit), operations/plan_items read scope.

---

## Verification Steps (Staging — Not Run Here)

1. As `field_worker` JWT: `SELECT * FROM financial_transactions` → 0 rows.  
2. Same: `SELECT * FROM v_collection_customer_summary` → **must be 0 rows** after fix.  
3. `SELECT reloptions FROM pg_class WHERE relname = 'v_collection_customer_summary'` → `security_invoker=true`.  
4. As `accountant`: `SELECT * FROM payment_methods` → confirm expected behavior (F-MED-02).  
5. Run Supabase Security Advisor / `security_definer_view` lint.

---

## Finding Counts

| Severity | Count |
|----------|-------|
| CRITICAL | **1** |
| HIGH | **2** |
| MEDIUM | **7** |
| LOW | **3** |

---

*End of Phase 1 report. Implementation requires explicit approval per `AGENTS.md`.*
