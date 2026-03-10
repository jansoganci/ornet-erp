# Backend Audit Report — Ornet ERP
**Audited by:** Claude (Principal Engineer perspective)
**Date:** 2026-03-10
**Scope:** All api.js, hooks.js, schema.js files + Supabase migrations

---

## Executive Summary

This is a **moderately mature but significantly underdeveloped backend** with concerning gaps in production-readiness. The codebase demonstrates good foundational patterns (Zod validation, React Query structure, RLS policies) but has **critical vulnerabilities in data integrity, RLS completeness, and query efficiency**.

- **Overall Score: 6.2 / 10**
- **Production Readiness: 55–60% — NOT READY**
- **Estimated effort to production-ready: 3–4 weeks**

---

## Ratings Summary

| Dimension | Score | Status |
|-----------|-------|--------|
| Schema Design | 6.5 / 10 | Needs Work |
| API Layer | 6.0 / 10 | Needs Work |
| React Query | 7.0 / 10 | Good |
| Security | 6.5 / 10 | **Critical** |
| Data Integrity | 6.0 / 10 | Needs Work |
| Scalability | 5.0 / 10 | **Critical** |
| Code Consistency | 7.5 / 10 | Good |
| Error Handling | 6.0 / 10 | Needs Work |
| Zod Schemas | 7.5 / 10 | Good |
| Migrations | 7.0 / 10 | Good |

---

## 1. Database Schema Design — 6.5 / 10

### Strengths
- Strong normalization with proper FK relationships (ON DELETE CASCADE/RESTRICT correctly applied)
- Comprehensive indexes on frequently queried columns (status, date ranges, customer_id)
- Unique constraint on active subscriptions per site (`00016_subscriptions.sql`)
- Soft deletes implemented comprehensively across all 8 major tables
- DECIMAL storage for all currency fields — no float rounding errors
- Generated computed columns for Turkish search normalization (`00092_turkish_search_normalization.sql`)
- RLS policies present on all major sensitive tables

### Critical Issues

**🔴 No RLS on Tasks and Notifications tables**
Any authenticated user can read and write every other user's tasks and notifications.
- `src/features/tasks/api.js` — no auth checks on any query
- `src/features/notifications/api.js` — no RLS policy enforced

**🟡 Payment Methods RLS too permissive**
Any accountant can view ALL customers' payment methods without customer_id filtering.
- `00016_subscriptions.sql` line 50: policy checks role but not customer_id
- PCI compliance concern

**🟡 No audit trail on key changes**
`insertAuditLog()` exists in subscriptions but is not called anywhere else. Financial transactions, customer changes, work order deletions, and material price changes have no audit log.

**🟡 Orphaned records risk**
Deleting a customer does not cascade soft-delete to their sites, subscriptions, or work orders. Child records remain visible in queries.

**🟡 Search columns not composite-indexed**
OR queries across multiple `_search` columns cannot use individual column indexes efficiently. Search degrades linearly with data growth.

---

## 2. API Layer Quality — 6.0 / 10

### Strengths
- Consistent query structure across all modules
- Errors thrown immediately — no silent failures
- Proper use of `.single()` for guaranteed single-row responses
- Payload cleaning functions in subscriptions and finance modules
- Multi-step insert operations attempt error checks between steps

### Critical Issues

**🔴 Unbounded fetches on large datasets**
- `simCards/api.js` — `fetchAllTurkcellSimCards()` returns all 2500+ records with no limit
- `subscriptions/api.js` — `fetchSubscriptions()` no pagination
- `materials/api.js` — no pagination on list fetch
- Risk: Dashboard DoS; data exfiltration

**🔴 No transactions for multi-step operations**
`createWorkOrderFromProposal()` makes 3 separate Supabase calls. If call 2 or 3 fails, the work order is created but incomplete with no rollback.
- `src/features/workOrders/api.js` lines 99–171

**🟡 N+1 risk in views**
`work_orders_detail` view runs a subquery per row to fetch assigned profiles. At 1000 work orders this runs 1000 subqueries.

**🟡 Missing input validation at API layer**
Raw IDs passed without null/UUID checks. Supabase silently returns empty arrays, masking bugs.
- `src/features/workOrders/api.js` — `fetchWorkOrderMaterials(workOrderId)` no validation

**🟡 Incomplete soft-delete filtering**
`materials/api.js` — `fetchMaterialUsageHistory()` filters work orders for `deleted_at` but not materials themselves. Deleted materials still appear in usage history.

**🟡 Currency duplication in proposals**
`proposals/api.js` — `unit_price_usd` and `unit_price` set to same value with no conversion logic. Incorrect totals in multi-currency scenarios.

---

## 3. React Query Usage — 7.0 / 10

### Strengths
- Correct query key factory pattern across all modules
- `enabled` conditions properly used to skip queries on missing dependencies
- Proper cache invalidation on mutations (list + detail keys)
- `staleTime` set appropriately for TCMB exchange rates (1 hour)

### Issues

**🟡 Over-invalidation**
`useUpdateWorkOrder()` invalidates `workOrderKeys.all`, `siteKeys.all`, and `customerKeys.all` — 3 full cache busts for one edit.
- `src/features/workOrders/hooks.js` lines 129–131
- Fix: Invalidate only `workOrderKeys.lists()` and the specific detail key

**🟡 Filter object reference instability**
`useSubscriptions(filters = {})` includes the filters object in the queryKey. A new object reference (even with identical contents) triggers a cache miss and re-fetch.
- `src/features/subscriptions/hooks.js` lines 82–87

**🟡 No staleTime on list queries**
All list queries have default `staleTime = 0`. Switching between pages re-fetches the entire list every time.
- Fix: Set `staleTime: 5 * 60 * 1000` on list queries

---

## 4. Security — 6.5 / 10

### Strengths
- RLS present on all major tables
- No SQL injection surface (parameterized queries throughout)
- Anon key never exposed; authenticated-only access
- Role-based RLS: admin, accountant, field_worker enforced
- PCI compliance: only last4 of card stored, no full card numbers

### Critical Issues

**🔴 RLS not enabled on Tasks and Notifications**
Any authenticated user can read/write any other user's tasks and notifications.
- `src/features/tasks/api.js`
- `src/features/notifications/api.js`
- **Immediate action required**

**🟡 Payment Methods RLS — no customer_id filter**
Any accountant can view any customer's payment method data. Missing row-level customer scoping.
- `00016_subscriptions.sql` line 50

**🟡 No rate limiting**
Unbounded fetches (2500+ SIM cards) with no per-user API rate limits in Supabase config. Risk of bulk data exfiltration.

**🟡 Audit logs not protected**
`audit_logs` table has no RLS policy. Any authenticated user could modify or delete the audit trail.

**🟡 All user profiles readable by all users**
`00001_profiles.sql` — `profiles_select_authenticated` policy allows all users to view all profiles (names, roles, phone numbers).
- Acceptable for small team; not acceptable for multi-tenant or large organizations

**🔵 Wildcard injection in search**
`%` and `_` characters in search strings are passed directly to ILIKE. Unlikely to be exploited but not best practice.
- `src/features/customers/api.js` line 14–16

---

## 5. Data Integrity — 6.0 / 10

### Strengths
- Foreign key constraints enforce referential integrity throughout
- CHECK constraints prevent invalid enum values
- DECIMAL precision for all financial calculations
- Unique index on active subscriptions per site prevents duplicates

### Critical Issues

**🔴 Race condition on payment recording**
`recordPayment()` assumes the payment is still pending between fetch and update. Two simultaneous requests could record the same payment twice. No `SELECT FOR UPDATE` lock.
- Referenced in `src/features/subscriptions/hooks.js`

**🟡 No transaction for multi-step subscription price updates**
When a price changes, subscription is updated and pending payments recalculated in separate calls. Network failure between them leaves inconsistent state.
- `src/features/subscriptions/api.js` lines 250–270

**🟡 Soft-delete not cascading**
Deleting a customer does not soft-delete their child records. Subscriptions and work orders remain active and visible.
- `src/features/customers/api.js` lines 87–95

**🟡 Currency mismatch in proposals**
No constraint enforcing all proposal_items share the same currency as the proposal. Mixed-currency totals produce incorrect amounts.
- `src/features/proposals/api.js`

---

## 6. Scalability — 5.0 / 10 ⚠️ Worst Area

### Critical Issues

**🔴 Unbounded fetches on large tables**
- `fetchAllTurkcellSimCards()` — 2500+ records, no limit, no pagination
- `fetchSubscriptions()` — no limit
- `fetchMaterials()` — no limit
- At current growth rates, these will cause visible performance degradation

**🔴 O(n) subquery in work_orders_detail view**
```sql
SELECT COALESCE(json_agg(...), '[]'::json)
FROM profiles p
WHERE p.id = ANY(wo.assigned_to)
```
This subquery runs once per work order row. 1000 work orders = 1000 profile subqueries.
- `00092_turkish_search_normalization.sql` lines 120–123
- Fix: Replace with `LEFT JOIN + array_agg`

**🟡 OR search queries cannot use indexes efficiently**
`.or('company_name_search.ilike...phone_search.ilike...')` cannot use individual column indexes. Full scan likely.
- `src/features/customers/api.js` line 16

**🟡 No staleTime caching on list queries**
Every tab switch re-fetches the full list from Supabase. No caching benefit from React Query.

**🟡 Subscription payment generation not batched**
Creating 100 subscriptions triggers 100 × 12 = 1200 individual DB writes synchronously.

---

## 7. Code Consistency — 7.5 / 10

### Strengths
- Consistent naming: `fetch*`, `create*`, `update*`, `delete*`
- Consistent hook patterns: `useQuery` + `useMutation`
- All soft deletes filter `.is('deleted_at', null)`
- Error throwing is consistent

### Issues

**🟡 Inconsistent pagination**
- Notifications: uses `.range(from, to)` cursor pagination
- Subscriptions: no pagination
- Finance: no pagination
- Three different approaches across the codebase

**🟡 Inconsistent payload cleaning**
Some modules clean empty strings to null (subscriptions, finance). Others pass raw form data directly (customers, work orders). Results in inconsistent null vs. empty string storage.

**🟡 Inconsistent soft-delete filtering**
Some modules filter in API, some in view, some in both. Unclear which layer is authoritative.

---

## 8. Error Handling — 6.0 / 10

### Strengths
- All Supabase errors thrown immediately
- User-facing toast notifications on errors
- Error messages localized via i18n
- Specific handling for FK constraint violations in finance module

### Issues

**🟡 No operation context in errors**
User sees "Unexpected error" with no indication of what operation failed or why.
- `src/lib/errorHandler.js` lines 11–35

**🟡 Network timeout not distinguished from JS TypeError**
`error.name === 'TypeError'` catches both network errors and real code bugs.

**🟡 No retry on transient failures**
Single timeout = immediate error. No exponential backoff configured.

**🟡 No server-side re-validation**
Frontend Zod validation can be bypassed by intercepting the network request. No server-side validation layer.

---

## 9. Zod Schema Validation — 7.5 / 10

### Strengths
- Comprehensive schemas for customers, work orders, subscriptions, proposals
- Custom refinements for conditional validation (payment method logic)
- Proper type coercion (string → number)
- Default values provided throughout
- Internationalized error messages

### Issues

**🟡 No schema for SIM cards**
`src/features/simCards/schema.js` does not exist. SIM card form data goes to Supabase without schema validation.

**🟡 Currency not enum-validated**
`z.string().default('TRY')` allows any string. Should be `z.enum(['TRY', 'USD', 'EUR', 'CHF'])`.

**🟡 VAT rate is a range, not an enum**
`z.number().min(0).max(100)` allows 37% or 99% VAT. Turkish VAT rates are only: 0%, 1%, 8%, 18%.

**🟡 No max length on text fields**
`notes`, `description`, and similar fields have no `.max()` constraint. Could accept 1MB+ strings.

---

## 10. Migration Quality — 7.0 / 10

### Strengths
- 95+ migrations with clear sequential naming
- RLS policies consistently applied in migrations
- Indexes created on all foreign keys and common filter columns
- Soft-delete pattern systematically applied (migrations 00080–00088)
- Trigger functions for auto-timestamp maintenance

### Issues

**🟡 No DOWN migrations**
No rollback plan for any migration. If `00092` fails partway through (it drops and recreates views), there is no recovery path.

**🟡 CASCADE drops in 00092 are risky**
`DROP VIEW IF EXISTS work_orders_detail CASCADE` silently drops dependent functions. If migration fails midway, those functions are gone.
- `00092_turkish_search_normalization.sql` line 81

**🟡 No data validation before adding constraints**
Migrations that add CHECK constraints don't verify existing data first. If legacy data violates a new constraint, the migration fails in production.

**🟡 Long-running migrations not batched**
Soft-delete migrations add columns sequentially. On large tables, each `ALTER TABLE` locks the table. Could cause downtime.

---

## Priority Fix List — What to Do First

### Week 1 — Critical Blockers

| # | Task | Effort | Risk if skipped |
|---|------|--------|-----------------|
| 1 | Enable RLS on tasks and notifications tables | 2 hrs | Data leakage across all users |
| 2 | Fix payment recording race condition (SELECT FOR UPDATE) | 4 hrs | Duplicate payments |
| 3 | Add pagination to all unbounded fetches | 6 hrs | Dashboard DoS at scale |
| 4 | Cascading soft-delete triggers at DB level | 8 hrs | Orphaned child records |

### Week 2 — High Impact

| # | Task | Effort | Risk if skipped |
|---|------|--------|-----------------|
| 5 | Audit logging on financial_transactions | 4 hrs | Regulatory / tax compliance |
| 6 | Wrap multi-step operations in RPC transactions | 6 hrs | Incomplete data on network failure |
| 7 | UUID/null input validation in API layer | 4 hrs | Silent bugs |
| 8 | Standardize pagination + shared cleanPayload utility | 8 hrs | Maintenance burden |

### Week 3 — Medium Impact

| # | Task | Effort | Risk if skipped |
|---|------|--------|-----------------|
| 9 | Fix React Query over-invalidation | 4 hrs | Poor UX, unnecessary re-fetches |
| 10 | Add customer_id filter to payment methods RLS | 2 hrs | PCI compliance |
| 11 | Create SIM card Zod schema | 2 hrs | Unvalidated data |
| 12 | Replace O(n) subquery in work_orders_detail view | 4 hrs | Slow work orders list at scale |

---

## Final Verdict

The backend architecture is **viable for a small-team MVP** but is **not production-ready** without addressing the critical blockers above.

**What's genuinely good:** Zod + React Query + api.js separation is clean. Soft deletes are thorough. DECIMAL for currency is correct. Migration discipline is solid at 95+ migrations.

**What's dangerous:** RLS gaps mean data leakage today. Race condition on payments means financial integrity is at risk. Unbounded fetches will cause performance failure as data grows.

**Go / No-Go:** 🔴 **No-Go for production** until Week 1 items are resolved.

---

---

# Strategic Roadmap — Deep Dive on Three Critical Areas
**Session:** Architect / Engineer review — 2026-03-10
**Scope:** Security (RLS), Data Integrity (Race Conditions), Scalability (Pagination)
**Status:** Analysis only — no code written yet

---

## AREA 1: Security — Row Level Security (RLS)

### The actual situation (corrected from initial audit)

After reading the migration files directly, the picture is more nuanced than the first audit suggested. There are **two separate problems**, not one.

---

### Problem 1A — The `tasks` table has a silent policy corruption bug

**Migration trail:**
- `00004_tasks.sql` — Creates the tasks table and enables RLS correctly. The policy is well-designed: admin sees all, field_worker sees tasks they are `assigned_to` OR `created_by`.
- `00080_soft_delete_tasks.sql` — Adds `deleted_at` column and **overwrites** both `tasks_select` and `tasks_update` policies.

**The bug introduced by 00080:**

```sql
-- What 00080 wrote:
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
      OR assigned_to = auth.uid()
    )
  );
```

Two things went wrong here:

1. **Roles `'manager'` and `'office'` do not exist.** The profiles table has a `CHECK (role IN ('admin', 'field_worker', 'accountant'))` constraint defined in `00001_profiles.sql`. No user can ever have role `'manager'` or `'office'`. The subquery `SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office')` therefore only ever returns admin users. Accountants are silently excluded from seeing all tasks — this was probably unintentional.

2. **`created_by = auth.uid()` was silently dropped.** The original 00004 policy let users see tasks they created. The 00080 rewrite lost this condition. A field_worker who creates a task but assigns it to someone else can no longer see their own task.

**How a Technician sees a Manager's task today:**
They can't — the policy is actually more restrictive than intended, not more permissive. The real leak is the other direction: accountants cannot see tasks at all (unless assigned), even though they should be able to for operational oversight.

---

### Problem 1B — The `tasks_with_details` view bypasses RLS entirely

**Migration trail:**
- `00004_tasks.sql` creates `tasks_with_details` view (joins tasks + profiles + work_orders + customers)
- `00015_recreate_tasks_with_details.sql` drops and recreates the same view
- Both migrations end with: `GRANT SELECT ON tasks_with_details TO authenticated`

**Why this is dangerous:**

In PostgreSQL, views run with the **security context of the view owner**, not the calling user. When Supabase migrations run, the owner is the `postgres` superuser. A view owned by `postgres` executes with superuser privileges, which means **RLS policies on the underlying `tasks` table are bypassed entirely when querying through the view**.

`src/features/tasks/api.js` queries `tasks_with_details`, not `tasks` directly:
```js
// api.js line 81
let query = supabase.from('tasks_with_details').select('*');
```

This means every `fetchTasks()` call in the application is currently returning **all tasks for all users**, regardless of the RLS policies on the `tasks` table. The policies in 00004 and 00080 protect direct table access but the application never queries the table directly.

**How a Technician actually sees a Manager's tasks:**
They navigate to the Tasks page. The frontend calls `fetchTasks()` → `tasks_with_details` view → all rows returned (no RLS filter applies) → filtered only by whatever `status`/`assigned_to` the UI passes. If those filters are not applied, every task is visible to every user.

---

### Problem 1C — Notifications: the audit was partially wrong

`00064_notifications.sql` DOES enable RLS and DOES have correct policies — only admin and accountant can see notifications, field_workers cannot. This is intentional (notifications are operational alerts, not personal messages). The `user_reminders` table also has correct RLS (`created_by = auth.uid() OR get_my_role() = 'admin'`).

However, there is one real issue: `notifications/api.js` queries the `v_active_notifications` view, not the table directly. Same view ownership problem as tasks — if the view is owned by postgres, RLS on the underlying `notifications` table is bypassed.

---

### Implementation Plan for RLS Fixes

**Migration: `00097_fix_rls_tasks_and_views.sql`**

The fixes must address both layers: the policy bug and the view security model.

**Step 1 — Fix the tasks_select and tasks_update policies**

Drop the broken 00080 policies and write a single correct policy that covers all three role scenarios:
- `admin` → sees all non-deleted tasks
- `accountant` → sees all non-deleted tasks (operational visibility needed)
- `field_worker` → sees only tasks where `assigned_to = auth.uid()` OR `created_by = auth.uid()`

The correct pattern uses `get_my_role()` (the existing helper function from `00001_profiles.sql`) rather than a subquery against profiles, which is slower and fragile:

```
USING (
  deleted_at IS NULL
  AND (
    get_my_role() IN ('admin', 'accountant')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
)
```

**Step 2 — Convert views to SECURITY INVOKER**

PostgreSQL 15+ supports `ALTER VIEW ... SET (security_invoker = true)`. Supabase runs PostgreSQL 15, so this is available. This makes the view run with the calling user's permissions, meaning RLS on the underlying tables applies correctly.

For `tasks_with_details`:
```sql
ALTER VIEW tasks_with_details SET (security_invoker = true);
```

For `v_active_notifications` and any other views that expose sensitive data.

**Step 3 — Audit all views across the schema**

Every view that exposes user-scoped data (tasks, notifications, reminders) needs the security_invoker flag. Views that aggregate anonymized data (dashboard stats, financial summaries) can remain as security definer since RLS is not meaningful there.

**What we do NOT need to change:**
- The notifications table policies (already correct)
- The user_reminders table policies (already correct)
- The tasks INSERT and DELETE policies (still valid from 00004)

---

### Role model clarification needed before implementation

The current role set is: `admin`, `field_worker`, `accountant`. The 00080 migration referenced `manager` and `office` — these don't exist. Before writing the new policies, we need a decision:

- Should `accountant` see all tasks? (Recommended: yes, read-only)
- Should `field_worker` see tasks assigned to their team, or only to themselves? (Current: only themselves)
- Is there a future `manager` role planned? If yes, build the policy to accommodate it now.

This decision shapes the exact `USING` clause we write.

---

## AREA 2: Data Integrity — Race Conditions in Payment Recording

### The exact scenario where double-payment occurs

`paymentsApi.js` → `recordPayment(paymentId, paymentData)` executes this sequence:

```
1. SELECT * FROM subscription_payments WHERE id = paymentId   → sees status = 'pending'
2. Check: is status='paid' AND invoice_no set?                → no → proceed
3. UPDATE subscription_payments SET status='paid' WHERE id = paymentId
4. INSERT INTO audit_logs ...
```

**The race condition:**

Imagine two office staff members (User A and User B) both have the MonthlyPaymentGrid open for the same subscription. The customer calls and says they paid. Both users click "Ödeme Kaydet" within 2 seconds of each other.

```
Timeline:
T=0ms   User A: Step 1 — SELECT → status='pending'
T=50ms  User B: Step 1 — SELECT → status='pending'  (A's UPDATE not committed yet)
T=100ms User A: Step 2 — check passes → proceed
T=110ms User B: Step 2 — check passes → proceed
T=200ms User A: Step 3 — UPDATE → status='paid' ✓  committed
T=210ms User B: Step 3 — UPDATE → status='paid' ✓  committed AGAIN
T=300ms User A: Step 4 — audit_log inserted
T=310ms User B: Step 4 — audit_log inserted
```

Result: Two audit log entries for the same payment, two potential finance_transactions records created, and no error surfaced to either user. The immutability check (`status='paid' AND invoice_no set`) only blocks if the row was already invoiced — it doesn't block a second simultaneous payment recording.

**Why the current immutability check is insufficient:**

```js
// paymentsApi.js line 33
if (current.status === 'paid' && current.invoice_no) {
  throw new Error('Bu ödeme faturalanmış ve değiştirilemez.');
}
```

This only catches the case where the payment is BOTH paid AND invoiced. A payment that is paid but not yet invoiced can still be overwritten. And in the race condition, both requests see `status='pending'` at step 1 — neither check fires.

---

### Why this also triggers a finance_transaction duplicate

`00050_subscription_payment_to_finance.sql` (referenced in migrations) creates a trigger on `subscription_payments` that fires `AFTER UPDATE` when `status` changes to `'paid'`. This trigger inserts a `financial_transactions` record.

In the race condition, both UPDATEs change status from `'pending'` to `'paid'`. Both trigger fires. Two `financial_transactions` rows are inserted for the same payment. The P&L report is now double-counting this revenue.

---

### Implementation Plan — Atomic Payment Recording via RPC

**The correct fix is to move `recordPayment` into a PostgreSQL function (RPC) and use optimistic locking.**

**Migration: `00098_atomic_record_payment.sql`**

**Approach: Conditional UPDATE with status guard (optimistic lock)**

Instead of SELECT then UPDATE (two round-trips, race window between them), we do a single UPDATE with the status condition embedded in the WHERE clause:

```sql
UPDATE subscription_payments
SET status = 'paid', payment_date = ..., ...
WHERE id = p_payment_id
  AND status = 'pending'           -- ← this is the lock
  AND deleted_at IS NULL
RETURNING *;
```

If the row was already updated to `'paid'` by a concurrent request, this UPDATE matches zero rows and returns nothing. The function then raises an exception: "Bu ödeme zaten kaydedilmiş." The second user sees an error instead of silently double-recording.

**The full RPC function structure (`fn_record_payment`):**

```
BEGIN
  1. UPDATE subscription_payments SET status='paid', ... WHERE id=? AND status='pending'
     RETURNING * INTO v_payment;

  2. IF NOT FOUND THEN
       -- Either already paid, or doesn't exist
       SELECT status FROM subscription_payments WHERE id=? INTO v_current_status;
       IF v_current_status = 'paid' THEN
         RAISE EXCEPTION 'ALREADY_PAID';
       ELSE
         RAISE EXCEPTION 'NOT_FOUND';
       END IF;
     END IF;

  3. INSERT INTO audit_logs ...  (uses v_payment from step 1)

  4. RETURN v_payment;
END
```

The entire block runs inside an implicit PostgreSQL transaction. Steps 1–3 are atomic. If any step fails, the entire transaction rolls back. No partial state is possible.

**What changes in the application layer:**

`paymentsApi.js` → `recordPayment()` replaces its SELECT + immutability check + UPDATE sequence with a single `supabase.rpc('fn_record_payment', { p_payment_id, p_payment_data })` call. The immutability logic (paid+invoiced = locked) also moves into the RPC, checked before the conditional UPDATE.

**The finance_transaction duplicate problem is solved automatically** because the trigger only fires once — the second UPDATE matches zero rows and never executes, so the trigger never fires for the second request.

---

### Secondary race condition: bulk price update

`updateSubscription()` in `api.js` at lines 250–270 does:
```
1. UPDATE subscriptions SET base_price=... WHERE id=?
2. UPDATE subscription_payments SET amount=... WHERE subscription_id=? AND status='pending'
```

If a user records a payment between calls 1 and 2, the payment they just recorded (now `status='paid'`) is excluded from the bulk update — correct. But if they record it during call 2's execution window, the payment amount update and the payment recording are fighting for the same row. This is lower risk but follows the same pattern.

**Fix:** Move the price update + payment recalculation into a second RPC (`fn_update_subscription_price`) that wraps both UPDATEs in one transaction.

---

## AREA 3: Scalability — Unified Pagination Strategy

### The worst offenders (ranked by impact)

**Rank 1 — `fetchSubscriptions()` (`subscriptions/api.js` line 42)**

No `.limit()`. No pagination parameters. Returns the full `subscriptions_detail` view which joins subscriptions + customers + sites + payment methods. Each row is wide (~30 columns). With 500 subscriptions this is a 15,000-cell JSON payload on every list page load and every search keystroke (search is triggered on the same query).

**Rank 2 — `fetchAllTurkcellSimCards()` (`simCards/api.js`)**

Explicitly designed to bypass pagination for the invoice analysis feature. Currently has no limit at all (we removed the `.range(0, 9999)` cap). Returns 2,500+ rows on every invoice upload. This is acceptable for the invoice analysis use case (needs all cards to compare), but the function is named and positioned as a general utility, which is dangerous. If it gets called from somewhere other than the invoice page, the damage is unlimited.

**Rank 3 — `fetchSimCards()` (`simCards/api.js` line 11)**

The main SIM card list query also has no pagination. With 2,500+ cards in the database, the SimCardsListPage fetches all of them on every mount. The UI filters client-side. This is already slow and gets worse with every new SIM card added.

**Rank 4 — `fetchSubscriptionsByCustomer()` (`subscriptions/api.js` line 101)**

No limit. A customer with many historical subscriptions (cancelled, paused, active) will return all of them on the CustomerDetailPage. Currently low risk (customers have <20 subscriptions each) but unbounded.

**Rank 5 — `fetchWorkOrders()` (implied by `work_orders_detail` view)**

The view joins work orders + materials + assigned profiles (via O(n) subquery). No pagination parameter in the list hooks. With 1,000+ work orders the list query degrades significantly.

---

### The unified pagination strategy

The goal is a single consistent interface across all list endpoints so the UI layer doesn't need to know each module's quirks.

**The contract — every list API function should accept:**

```js
fetchSubscriptions(filters = {}, pagination = { page: 1, pageSize: 50 })
```

And return:
```js
{
  data: [...],
  count: 1247,     // total matching rows (from Supabase count header)
  page: 1,
  pageSize: 50,
  totalPages: 25
}
```

**How Supabase supports this natively:**

Supabase's `.range(from, to)` maps directly to PostgreSQL's `LIMIT/OFFSET`. The total count is available via `.select('*', { count: 'exact' })` which adds a `Content-Range` header without fetching all rows. This means we get both the page of data AND the total count in a single network round-trip.

```js
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

const { data, count, error } = await supabase
  .from('subscriptions_detail')
  .select('*', { count: 'exact' })
  .range(from, to);
```

**React Query integration — the shape of paginated hooks:**

```js
export function useSubscriptions(filters, page = 1) {
  return useQuery({
    queryKey: subscriptionKeys.list({ ...filters, page }),
    queryFn: () => fetchSubscriptions(filters, { page, pageSize: 50 }),
    placeholderData: keepPreviousData,  // prevents flash during page change
    staleTime: 2 * 60 * 1000,          // 2 min cache on list pages
  });
}
```

The `keepPreviousData` option (TanStack Query v5: `placeholderData: keepPreviousData`) keeps the current page visible while the next page loads, preventing the white flash that kills UX.

---

### Special case: `fetchAllTurkcellSimCards()` must stay unbounded

The invoice analysis feature legitimately needs all 2,500+ Turkcell SIM cards to build the comparison map. Pagination would break the matching logic. This function should:

1. **Stay unbounded but be clearly isolated** — rename it to make the intent explicit. The current name is already clear.
2. **Be called only from `InvoiceAnalysisPage`** — never from a list hook.
3. **Have a hard safety cap added at the DB level**, not the API level — a PostgreSQL function or view that returns a maximum of 10,000 rows prevents accidental misuse even if someone imports the function in the wrong place.

For this specific function, document the exception explicitly in the code with a comment explaining why pagination is intentionally absent.

---

### Migration changes needed for scalability

**Indexes for paginated queries:**

Pagination with `OFFSET` degrades on large tables if the ORDER BY column isn't indexed. Currently:

- `subscriptions_detail` orders by `created_at DESC` → `created_at` is indexed on the base table ✓
- `sim_cards` orders by `phone_number ASC` → `phone_number` is not indexed → needs `CREATE INDEX idx_sim_cards_phone ON sim_cards(phone_number) WHERE deleted_at IS NULL`
- `work_orders` orders by `scheduled_date DESC` → needs verification

**The O(n) subquery in `work_orders_detail` view:**

This must be fixed before adding pagination, otherwise every page of 50 work orders still executes 50 profile subqueries. Replace:

```sql
-- Current (O(n) subquery):
SELECT COALESCE(json_agg(p.*), '[]'::json) FROM profiles p WHERE p.id = ANY(wo.assigned_to)

-- Target (single JOIN):
LEFT JOIN (
  SELECT unnest(wo.assigned_to) AS user_id, json_agg(p.*) AS profiles_json
  FROM profiles p GROUP BY user_id
) assigned ON true
```

Or simpler: remove the profiles join from the view and fetch assigned user names in a separate query from the frontend (already cached in React Query from the profiles hook).

---

### Rollout order for pagination

The rollout should be incremental — not a big-bang refactor of all endpoints at once:

1. **Subscriptions first** — highest row count, most frequently visited list page
2. **SIM Cards second** — 2,500+ rows already causing slowness
3. **Work Orders third** — after fixing the O(n) subquery in the view
4. **Materials and Tasks last** — lower row counts, lower urgency

Each module needs: API function update → hook update → UI component update (add page controls). The UI work is the longest part — we need a reusable `Pagination` component that all list pages can share.

---

## Summary: What We Build in What Order

| # | What | Why first | Migration needed |
|---|------|-----------|-----------------|
| 1 | Fix `tasks_select` policy (drop 00080 roles bug, restore `created_by`) | Silent data access bug for accountants | `00097_fix_rls_tasks_views.sql` |
| 2 | Set `security_invoker = true` on `tasks_with_details` and `v_active_notifications` | Views bypass RLS entirely right now | Same migration |
| 3 | Create `fn_record_payment` RPC with conditional UPDATE lock | Race condition causes duplicate revenue | `00098_atomic_record_payment.sql` |
| 4 | Create `fn_update_subscription_price` RPC | Same atomicity gap for price changes | Same migration |
| 5 | Add pagination to `fetchSubscriptions` + hook + UI | Worst unbounded fetch in the app | No migration needed |
| 6 | Add pagination to `fetchSimCards` + hook + UI | 2,500+ rows on list mount | Add phone_number index |
| 7 | Fix O(n) subquery in `work_orders_detail` view | Prerequisite for WO pagination | `00099_fix_work_orders_view.sql` |
| 8 | Add pagination to `fetchWorkOrders` + hook + UI | After view fix | No migration needed |

**Decision needed before #1:** Confirm the role model — should `accountant` see all tasks? This determines the exact policy we write.
