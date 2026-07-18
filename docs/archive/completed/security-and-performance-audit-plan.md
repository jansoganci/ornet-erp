# Ornet ERP Security & Performance Audit Plan

> Created: 2026-05-31  
> Status: **Planning only** — no implementation, no migrations, no code changes  
> Scope: Security and performance before production company/customer/finance data is loaded  
> Related (completed separately): [`docs/supabase-query-optimization-analysis.md`](./supabase-query-optimization-analysis.md)  
> Historical reference (may be stale): [`docs/archive/completed/RLS-AUDIT.md`](./archive/completed/RLS-AUDIT.md) (migrations 00001–00115)

---

## Executive Summary

Ornet ERP will hold **real Turkish security-company data**: customers, sites, work orders, subscriptions, SIM inventory, proposals, and a **finance ledger** (`financial_transactions`, collections/Tahsilat, Paraşüt sync). The React app uses route guards (`RoleRoute`, `canWrite` in `src/lib/roles.js`), but **Supabase is accessed with the anon key in the browser** — any gap in Row Level Security (RLS), `SECURITY DEFINER` RPCs, or edge functions can expose or mutate data regardless of UI.

This plan defines **ten separate audit phases** to run **before go-live**. Each phase produces a markdown report under `docs/` with findings (file path, line number, risk, proposed fix). **No fixes** are applied during audit unless explicitly approved. Query-pattern optimization work is tracked separately and is **out of scope** for re-audit unless a security finding depends on it.

---

## Audit Priority Order

| Priority | Audit phase | Why it matters | Risk if ignored | Expected output |
|----------|-------------|----------------|-----------------|-----------------|
| P0 | 1 — Supabase RLS Audit | Last line of defense for all tenant data in the browser | Wrong role reads/writes customers, finance, subscriptions via PostgREST | `docs/audit-reports/01-rls-audit.md` |
| P0 | 2 — SECURITY DEFINER RPC Audit | RPCs can bypass RLS; broad `GRANT EXECUTE` = API surface | Field worker mutates prices, completes WOs with wrong payment state, bulk finance writes | `docs/audit-reports/02-security-definer-rpc-audit.md` |
| P0 | 3 — Finance Access Audit | Ledger integrity and confidentiality | Revenue/COGS leakage, unauthorized Tahsilat, double-counting paths | `docs/audit-reports/03-finance-access-audit.md` |
| P1 | 4 — Edge Function Security Audit | Service role + secrets; often no RLS | Public cron abuse, Paraşüt token theft, unauthenticated writes | `docs/audit-reports/04-edge-functions-audit.md` |
| P1 | 5 — Frontend Data Exposure Audit | UI hides routes but client still fetches | Sensitive columns in network tab; `select('*')` over-fetch | `docs/audit-reports/05-frontend-exposure-audit.md` |
| P1 | 6 — RLS Performance Audit | Bad policies slow every query at scale | Timeouts on large tables with `get_my_role()` subqueries | `docs/audit-reports/06-rls-performance-audit.md` |
| P2 | 7 — Database Index Audit | Missing indexes → full scans as data grows | Slow lists, reports, imports after real data volume | `docs/audit-reports/07-index-audit.md` |
| P2 | 8 — View/RPC Performance Audit | Heavy views power dashboards and search | P&L, Tahsilat, work history degrade under load | `docs/audit-reports/08-view-rpc-performance-audit.md` |
| P2 | 9 — Frontend Query / React Query Audit | Duplicate/unbounded client calls | Redundant load, stale cache, memory pressure | `docs/audit-reports/09-react-query-audit.md` |
| P3 | 10 — Bundle / Frontend Performance Audit | UX and mobile; not data breach | Large initial bundle, slow first paint | `docs/audit-reports/10-bundle-performance-audit.md` |

---

## Phase 1 — Supabase RLS Audit

### Objective

Verify every application table has RLS enabled, policies align with roles (`admin`, `accountant`, `field_worker`), and **database enforcement matches** app route guards — especially finance and customer write paths.

### Files/migrations to inspect

- All `supabase/migrations/*.sql` containing `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `DROP POLICY`
- Role helper: `00001_profiles.sql` (`get_my_role()`), `00104_sim_cards_rls_use_get_my_role.sql`
- Finance RLS: `00040_financial_transactions.sql`, `00116_fix_financial_transactions_rls.sql`, `00207_fix_pl_view_and_hybrid_payment_schema.sql` (`financial_transaction_payments`)
- Subscriptions: `00016_subscriptions.sql`, `00119_restrict_subscriptions_select_rls.sql`
- Customers/sites: `00002_customers.sql`, `00126_fix_medium_rls_issues.sql`
- Work orders: `00003_work_orders.sql`, `00009_rebuild_work_orders.sql`, `00097_fix_rls_tasks_and_views.sql`
- Proposals: `00027_proposals.sql`, `00093_fix_proposals_delete_rls.sql`, `00198_proposal_sections_rls.sql`
- SIM: `00023_sim_card_management.sql`, `00104_sim_cards_rls_use_get_my_role.sql`
- Paraşüt: `00215_parasut_customer_matching.sql`, `00216_parasut_oauth_audit.sql`
- Tahsilat: `00212_tahsilat_core.sql`, `00213_tahsilat_views.sql`
- Views: `00077_fix_security_definer_views.sql`, `00102_fix_v_profit_and_loss_security_invoker.sql`, `00204_security_invoker_detail_views.sql`
- Historical findings: `docs/archive/completed/RLS-AUDIT.md` (re-verify fixes landed)

### Exact questions to answer

1. Which tables in `public` have RLS **disabled** or no policies for `authenticated`?
2. For each sensitive table, what can `field_worker` **SELECT / INSERT / UPDATE / DELETE**?
3. Do `customers` / `customer_sites` policies still allow field_worker **writes** anywhere (INSERT/UPDATE)?
4. Are `subscriptions`, `subscription_payments`, `payment_methods` restricted to `admin` + `accountant` for read and write?
5. Are `financial_transactions` and `financial_transaction_payments` limited to `admin` + `accountant` (including soft-deleted rows)?
6. Can `field_worker` read `proposals`, `proposal_items`, `sim_cards`, or finance **views** (`v_profit_and_loss`, `v_collection_*`)?
7. Are policies `TO authenticated` only (no unintended `anon` grants on tables/views)?
8. Do `RoleRoute` / `canWrite` routes in `src/App.jsx` have a **matching** DB deny for `field_worker` on the same resources?
9. Are there tables where **SELECT is open** to all authenticated users but columns contain PII/finance (need column-level review in Phase 5)?

### Red flags

- `USING (true)` or `auth.uid() IS NOT NULL` without role check on sensitive tables
- Policies referencing obsolete roles (`manager`, `office`) — see historical CRIT-1 in archived RLS audit
- `field_worker` INSERT/UPDATE on `customers`, `subscriptions`, `financial_transactions`
- Missing policies on new tables (Paraşüt: `parasut_oauth_tokens`, `parasut_*` audit tables)
- Views marked `SECURITY DEFINER` without `security_invoker` where underlying RLS should apply

### Expected deliverable

`docs/audit-reports/01-rls-audit.md` containing:

- Table inventory: RLS on/off, policy names, per-role effective access matrix
- Mismatch list: UI guard vs DB access
- Prioritized findings (CRITICAL / HIGH / MEDIUM / LOW)

### What NOT to change yet

- No `CREATE POLICY` / migration edits
- No RLS disable “for testing”
- No policy broadening to fix app bugs

---

## Phase 2 — SECURITY DEFINER RPC Audit

### Objective

Inventory all `SECURITY DEFINER` functions, confirm explicit role checks on mutating RPCs, safe `search_path`, and justified `GRANT EXECUTE TO authenticated`.

### Files/migrations to inspect

- Grep: `SECURITY DEFINER` across `supabase/migrations/`
- `search_path` fixes: `00078_fix_function_search_path.sql`
- Grants: `00101_grant_rpc_execute.sql`, `00122_guard_cancel_and_payment_rpcs.sql`, `00117_guard_bulk_update_subscription_prices.sql`
- Finance completion: `00208_complete_work_order_with_payment_rpc.sql`, `00210_complete_proposal_with_rate_rpc.sql`
- Soft deletes / writes: `00107_soft_delete_transaction_rpc.sql`, `00141_soft_delete_customer_rpc.sql`, `00192_soft_delete_work_order_rpc.sql`
- Search RPCs: `00092_turkish_search_normalization.sql`, `00138_search_customer_sites_rpc.sql`, `00221_search_work_history_filters.sql`
- Bulk/import: `00137_bulk_import_subscriptions_rpc.sql`, `00222_bulk_upsert_materials.sql`
- Cron/internal: `00202_monthly_sim_finance_cron.sql`, `00096_recurring_generation_return_count.sql`

### Exact questions to answer

1. Full list of `SECURITY DEFINER` functions (name, args, migration file, grants)?
2. Which are callable from the frontend (`GRANT EXECUTE TO authenticated`)?
3. Which **write** or **bulk** functions lack `get_my_role()` / role guard at function entry?
4. Does each function set `SET search_path = public` (or stricter)?
5. Which RPCs return data **without** scoping field_worker (e.g. `search_work_history`, `get_daily_work_list`)?
6. Which triggers are `SECURITY DEFINER` and can they be invoked indirectly?
7. Can any RPC update finance rows while bypassing `financial_transactions` RLS?
8. Are service-role-only operations incorrectly exposed to `authenticated`?

### Red flags

- `GRANT EXECUTE TO authenticated` on bulk price/subscription/finance RPCs without role check
- Missing `search_path` on SECURITY DEFINER (search_path hijack)
- RPC returns `SETOF` wide views (`work_orders_detail`) without worker scope
- Functions that accept arbitrary UUID/JSONB without ownership validation

### Expected deliverable

`docs/audit-reports/02-security-definer-rpc-audit.md` with RPC inventory table: function, grant, role check Y/N, RLS bypass Y/N, risk.

### What NOT to change yet

- No function body edits
- No REVOKE/GRANT changes in production

---

## Phase 3 — Finance Access Audit

### Objective

Confirm finance data and mutations are limited to **admin** and **accountant**, align with `CLAUDE.md` finance rules, and that field workers cannot read/write ledger, collections, or subscription billing unless explicitly intended.

### Files/migrations to inspect

- `CLAUDE.md` — Finance module rules (accrual, `payment_status`, completion RPCs, four income paths)
- Tables: `financial_transactions`, `financial_transaction_payments`, `expense_categories`, `exchange_rates`, `recurring_expense_templates`
- Triggers: `00201_fix_subscription_payment_trigger_vat_logic.sql`, `00209_update_proposal_trigger_unpaid.sql`, `00200_auto_record_work_order_revenue_income_cogs_try.sql`, `00190_financial_reversal_on_status_change.sql`
- Views: `v_profit_and_loss`, `v_collection_customer_summary`, Tahsilat views (`00213`, `00214`)
- App: `src/features/finance/**`, `src/App.jsx` finance routes, `src/features/subscriptions/collection*`
- Archived: `docs/archive/completed/finance-audit-report.md` (re-verify)

### Exact questions to answer

1. Can `field_worker` SELECT/INSERT/UPDATE/DELETE on `financial_transactions` or `financial_transaction_payments`?
2. Are receivables (`payment_status = 'unpaid'`) visible only to roles that should see them?
3. Is `payment_status` ever set directly from app code (anti-pattern per `CLAUDE.md`)?
4. Do completion RPCs (`fn_complete_work_order_with_payment`, `complete_proposal_with_rate`) enforce role checks?
5. Can field_worker call finance-related RPCs (soft delete transaction, record payment, write-off)?
6. Are P&L and collection views restricted at DB level, not only UI?
7. Does subscription payment → finance trigger respect `official_invoice` / VAT rules?
8. Is proposal-linked WO revenue still single-path (no double count)?
9. Does Tahsilat (`collectionApi.js`) expose data cross-customer for restricted roles?

### Red flags

- Field worker read access to amounts, margins, COGS, or customer collection summaries
- Direct `.update({ payment_status })` from `src/features/finance/api.js`
- `subscription_payments` used for P&L totals in app code
- Missing `deleted_at IS NULL` filters in finance queries

### Expected deliverable

`docs/audit-reports/03-finance-access-audit.md` with role × object matrix for finance module and CLAUDE.md rule compliance checklist.

### What NOT to change yet

- No trigger/RPC changes to revenue recognition
- No alteration of VAT or `official_invoice` logic

---

## Phase 4 — Edge Function Security Audit

### Objective

Review Supabase Edge Functions for secret handling, service role usage, public invoke surface, and authorization consistent with ERP roles.

### Files/migrations to inspect

- `supabase/functions/parasut-dispatch/**` (especially `core/auth.ts`, `index.ts`, handlers)
- `supabase/functions/parasut-reconcile/index.ts`
- `supabase/functions/fetch-tcmb-rates/index.ts`
- `supabase/functions/extend-subscription-payments/index.ts`
- Supabase dashboard config (document in report): JWT verification, cron secrets, function URLs
- DB: `00216_parasut_oauth_audit.sql` (`parasut_oauth_tokens`)

### Exact questions to answer

1. Which functions are invokable anonymously vs require valid user JWT?
2. Where is `SUPABASE_SERVICE_ROLE_KEY` used — is it scoped to server-only code paths?
3. Does `parasut-dispatch` call `requireRole()` (or equivalent) on every mutating handler?
4. Can `fetch-tcmb-rates` be abused to write arbitrary rows to `exchange_rates`?
5. Can `extend-subscription-payments` extend schedules without admin/accountant intent?
6. Are Paraşüt OAuth tokens ever logged or returned in responses?
7. CORS: is `Access-Control-Allow-Origin: *` acceptable for each function?
8. Cron/pg_net callers: separate auth from browser?
9. Idempotency and audit tables — who can read/write via RLS?

### Red flags

- Service role client created without verifying `Authorization` JWT + role
- Secrets in repo, logs, or error payloads
- Public POST without rate limit on finance-adjacent writers
- `console.log` of tokens, payment payloads, or customer tax IDs

### Expected deliverable

`docs/audit-reports/04-edge-functions-audit.md` per function: auth model, secrets, role checks, recommended hardening.

### What NOT to change yet

- No deploy of edge functions
- No rotation of secrets during audit (document only)

---

## Phase 5 — Frontend Data Exposure Audit

### Objective

Find client-side patterns that leak customer/finance data: over-fetching, debug logs, and queries from pages that UI restricts by role.

### Files/migrations to inspect

- `src/features/**/api.js` (all modules)
- `src/features/finance/**`, `src/features/customers/**`, `src/features/subscriptions/**`
- `src/pages/DashboardPage.jsx`, `src/features/dashboard/**`
- Grep targets: `select('*')`, `console.log`, `.from('financial_transactions')`, `.rpc(`
- `src/lib/roles.js`, `src/App.jsx`, `src/components/layout/navItems.js`
- Hooks: `src/features/subscriptions/hooks.js` (`useCurrentProfile`)

### Exact questions to answer

1. Which `select('*')` calls hit sensitive tables/views?
2. Any `console.log` of customer, payment, invoice, or ledger payloads?
3. Do components used on **non-RoleRoute** pages still fetch finance/subscription/SIM data?
4. Are explicit column lists used for large tables (materials, customers, work orders)?
5. Does `CustomerDetailPage` gate finance hooks with `canWrite` consistently?
6. Are Supabase errors surfaced to users containing raw SQL or row data?
7. Is `VITE_*` exposing secrets in the client bundle?

### Red flags

- Finance API imported in work-order-only flows without role guard
- Dashboard aggregations fetched for all roles including field_worker
- React Query `queryKey` shared across roles without invalidation on role change

### Expected deliverable

`docs/audit-reports/05-frontend-exposure-audit.md` with file:line list of exposures and severity.

### What NOT to change yet

- No removal of logging without approval
- No query rewrites (tracked in Phase 9 if performance-related)

---

## Phase 6 — RLS Performance Audit

### Objective

Identify RLS policies that will degrade at production row counts: repeated `get_my_role()`, uncorrelated subqueries, and policies that prevent index use.

### Files/migrations to inspect

- All policies using `get_my_role()`, `EXISTS (SELECT 1 FROM work_orders …)`, `auth.uid() = ANY(assigned_to)`
- `00126_fix_medium_rls_issues.sql` (work_order_assets EXISTS pattern)
- Supabase Postgres best practices skill / `EXPLAIN` templates for sampled queries
- Large tables: `work_orders`, `financial_transactions`, `subscription_payments`, `customers`

### Exact questions to answer

1. Which policies call `get_my_role()` more than once per check?
2. Can `get_my_role()` be replaced with a stable session claim or `(SELECT get_my_role())` subquery pattern for planner cache?
3. Which policies use `EXISTS` on unindexed FK paths?
4. Do soft-delete policies (`deleted_at IS NULL`) align with partial indexes?
5. For field_worker “own work order” policies, is `assigned_to` GIN/indexed?
6. Does RLS on parent tables force nested loop on child bulk operations?

### Red flags

- Per-row profile lookup inside EXISTS on hot tables
- `ILIKE '%…%'` in policies (prefer generated search columns + RPC, per query optimization doc)
- OR-heavy policy expressions defeating index scans

### Expected deliverable

`docs/audit-reports/06-rls-performance-audit.md` with policy hot-spot ranking and EXPLAIN samples (staging or anonymized).

### What NOT to change yet

- No policy rewrites for performance without security review
- No disabling RLS for speed

---

## Phase 7 — Database Index Audit

### Objective

Compare indexes on high-volume tables to application filter/sort/join patterns; find missing partial indexes especially for `deleted_at IS NULL`.

### Files/migrations to inspect

- Table definitions and `CREATE INDEX` in migrations for:
  - `financial_transactions`, `financial_transaction_payments`
  - `work_orders`, `subscription_payments`
  - `sim_cards`, `customers`, `materials`, `proposals`
- Recent search columns: `00220_materials_description_search.sql`, `00219_sim_cards_list_view.sql`
- Finance filters: `payment_status`, `direction`, `transaction_date`, `customer_id`, `deleted_at`
- `docs/supabase-query-optimization-analysis.md` (avoid duplicating completed RPC/view work)

### Exact questions to answer

1. Current index list per table (from `\d+` or `pg_indexes` export)?
2. Do list pages filter on columns without indexes (date ranges, status, customer_id)?
3. Are partial indexes `WHERE deleted_at IS NULL` present for soft-deleted tables?
4. Foreign keys used in JOINs — supporting indexes on both sides?
5. `subscription_payments` — indexes for due date, status, subscription_id?
6. `financial_transaction_payments` — parent `financial_transaction_id` + payment date?
7. Duplicate/redundant indexes increasing write amplification?

### Red flags

- Sequential scans on `financial_transactions` for dated finance dashboards
- Missing index on `work_orders (scheduled_date)` / `status` for daily work
- Full table index without partial `deleted_at` on large tables

### Expected deliverable

`docs/audit-reports/07-index-audit.md` with recommended indexes (DDL proposals only, not applied).

### What NOT to change yet

- No migration files
- No `CREATE INDEX CONCURRENTLY` on production without approval

---

## Phase 8 — View/RPC Performance Audit

### Objective

Analyze definition and runtime cost of critical views and RPCs; find full scans, heavy joins, and repeated aggregates.

### Files/migrations to inspect

- `v_profit_and_loss` — `00102`, `00150`, `00207`
- `v_collection_customer_summary` — `00213`, `00214`
- `work_orders_detail` — `00194`, `00195`, `00204`
- `sim_cards_list` — `00219`, `00223`
- `search_work_history` — `00221` (and `00126` field_worker scope)
- Dashboard RPCs: `00128_dashboard_revenue_rpc.sql`, `00129_dashboard_overdue_payments_rpc.sql`, `00175_operations_stats_outcomes.sql`

### Exact questions to answer

1. `EXPLAIN (ANALYZE, BUFFERS)` on representative calls with realistic row counts?
2. Does `v_profit_and_loss` scan all `financial_transactions` history?
3. Do collection views aggregate per customer in one pass or nested loops?
4. Does `work_orders_detail` join too many tables for list/search?
5. Does `search_work_history` apply filters in SQL (post-00221) or still over-return?
6. Are views `security_invoker` where RLS must apply (`00204`)?
7. Materialized view candidates vs live views for dashboards?

### Red flags

- View definitions with subqueries per row
- RPC returning full `work_orders_detail` without `LIMIT` for search
- Aggregates on unindexed columns in views used on every page load

### Expected deliverable

`docs/audit-reports/08-view-rpc-performance-audit.md` with cost-ranked objects and EXPLAIN evidence.

### What NOT to change yet

- No view redefinitions
- No new materialized views without approval

---

## Phase 9 — Frontend Query / React Query Audit

### Objective

Audit TanStack Query usage for duplicate fetches, unstable keys, missing pagination, and over-fetching in feature `api.js` modules.

### Files/migrations to inspect

- `src/features/**/hooks.js`, `**/api.js`
- Query key factories per feature
- List pages: customers, work orders, materials, sim cards, finance, subscriptions
- Cross-feature hooks: `src/features/tasks`, `src/features/calendar`, dashboard
- Completed optimizations: `docs/supabase-query-optimization-analysis.md` (verify fixes, don’t re-litigate)

### Exact questions to answer

1. Duplicate queries for same entity on mount (parent + child)?
2. `queryKey` includes non-serializable or frequently changing values?
3. List endpoints without `.range()` / limit — unbounded rows?
4. `staleTime` / `gcTime` appropriate for reference vs live data?
5. Invalidation scope — over- or under-invalidation after mutations?
6. Prefetch on nav for restricted data?
7. Parallel queries that could be one RPC/view?

### Red flags

- `useQuery` with `enabled: true` for finance on global layout
- Refetch on window focus for heavy finance aggregates
- Same customer detail fetched N times via different hooks

### Expected deliverable

`docs/audit-reports/09-react-query-audit.md` with module-by-module query map and recommendations.

### What NOT to change yet

- No hook refactors
- No API signature changes

---

## Phase 10 — Bundle / Frontend Performance Audit

### Objective

Investigate Vite bundle size, lazy-loading gaps, and splittable heavy dependencies before field workers use the app on slower networks.

### Files/migrations to inspect

- `vite.config.js` (`chunkSizeWarningLimit`, `manualChunks`)
- `src/App.jsx` (existing `lazy()` for `InvoiceAnalysisPage` only)
- `package.json` — heavy deps: `@react-pdf/renderer`, `pdfjs-dist`, `recharts`, `react-big-calendar`, `xlsx`, `framer-motion`
- Build output: `npm run build` → Rollup chunk report
- `src/features/**` page imports (eager vs lazy)

### Exact questions to answer

1. Which chunks exceed 500 KB / 1 MB after build?
2. Which routes are eagerly imported in `App.jsx` or barrel files?
3. Can finance, proposals, SIM analysis, operations, PDF export be lazy-loaded?
4. Are chart libraries imported only on dashboard/finance pages?
5. Is `pdfjs-dist` loaded on initial route?
6. PWA `workbox` caching large chunks appropriately?
7. Tree-shaking failures (lodash full import, icon packs)?

### Red flags

- Single main chunk containing PDF + charts + calendar
- Feature barrel `index.js` re-exporting heavy modules into critical path
- `chunkSizeWarningLimit: 2000` masking regressions without documenting accepted debt

### Expected deliverable

`docs/audit-reports/10-bundle-performance-audit.md` with chunk table and prioritized lazy-load list.

### What NOT to change yet

- No vite config changes
- No dependency upgrades

---

## Recommended Execution Order

Run phases in this order; **complete each phase and publish its report before starting the next**.

| Order | Phase | Rationale |
|-------|-------|-----------|
| 1 | **Phase 1 — RLS** | Foundational; catches role leaks that invalidate UI-only reviews |
| 2 | **Phase 2 — SECURITY DEFINER RPCs** | Second bypass path; often explains “RLS looks fine but API still leaks” |
| 3 | **Phase 3 — Finance Access** | Deep dive on highest-business-risk data using RLS + RPC context from 1–2 |
| 4 | **Phase 4 — Edge Functions** | Service role and secrets; Paraşüt/finance adjacent |
| 5 | **Phase 5 — Frontend Exposure** | Validates what actually reaches the browser given DB posture |
| 6 | **Phase 6 — RLS Performance** | Safe only after policies are understood (avoid optimizing insecure policies) |
| 7 | **Phase 7 — Index Audit** | Schema-level; depends on query patterns from 8–9 |
| 8 | **Phase 8 — View/RPC Performance** | DB read path cost |
| 9 | **Phase 9 — React Query** | Client efficiency; cross-check with Phase 8 |
| 10 | **Phase 10 — Bundle** | UX; lowest security risk but improves field rollout |

**Parallelization note:** Phases 7–8 can share `EXPLAIN` sessions; Phase 5 can start after Phase 3 for finance-specific files only — but still publish separate reports per phase.

---

## Rules for Future Audit Tasks

1. **One phase per task** — Run phases separately; do not combine RLS + RPC + finance in a single implementation PR.
2. **No code changes unless explicitly approved** — Audit tasks produce reports only; fixes require `APPROVE` per `AGENTS.md`.
3. **Report location** — Every phase writes to `docs/audit-reports/<phase>-<short-name>.md` (create directory on first run).
4. **Finding format** — Each finding MUST include:
   - File path (and migration name if SQL)
   - Line number(s)
   - Risk level (CRITICAL / HIGH / MEDIUM / LOW)
   - Proposed fix (description only; no implementation)
5. **Security fixes** — Require dedicated review before implementation; prefer DB + app defense in depth.
6. **Migrations** — Must not be created or applied without explicit approval.
7. **Re-verify archived audits** — Treat `docs/archive/completed/RLS-AUDIT.md` and `finance-audit-report.md` as historical; confirm current migration head (`00223+`) supersedes them.
8. **Query optimization** — Do not duplicate closed items in `docs/supabase-query-optimization-analysis.md` unless a security audit reveals they are still exploitable.
9. **Commits** — Audit reports may be committed when the user requests; planning doc changes do not imply approval to fix.
10. **Roles reference** — `admin`, `accountant`, `field_worker`; `canWrite` = admin OR accountant (`src/lib/roles.js`).

---

## Appendix — Quick Reference

| Item | Location |
|------|----------|
| Roles / canWrite | `src/lib/roles.js`, `src/App.jsx` (`RoleRoute`) |
| Route map | `CLAUDE.md`, `src/App.jsx` |
| Migrations | `supabase/migrations/` (latest numbered files through `00223`) |
| Edge functions | `supabase/functions/` |
| Prior RLS audit | `docs/archive/completed/RLS-AUDIT.md` |
| Prior query audit | `docs/supabase-query-optimization-analysis.md` |
| Finance rules | `CLAUDE.md` — Finance module rules |

---

*End of plan — implementation and migrations are out of scope for this document.*
