# RLS Security Audit — Ornet ERP

> Audited from migration history (migrations 00001–00115).
> Date: 2026-03-14
> Roles in system: `admin`, `field_worker`, `accountant`

---

## Quick Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 3 | Fix immediately — data corruption or total access bypass |
| 🟠 HIGH | 5 | Fix this sprint — wrong-role access to sensitive data |
| 🟡 MEDIUM | 5 | Fix soon — missing policies, overly permissive writes |
| 🟢 LOW | 3 | Address before go-live |

**Anon key exposure:** No table or view is readable by the `anon` role. All policies are `TO authenticated`. ✅

---

## Current Role Matrix (Actual vs. Intended)

| Table / Object | admin | accountant | field_worker | Intended field_worker |
|---|---|---|---|---|
| `profiles` | CRUD | Read | Read | Read (for dropdowns) ✅ |
| `customers` | CRUD | CRUD | **CRUD** | Read only ❌ |
| `customer_sites` | CRUD | CRUD | **CRUD** | Read only ❌ |
| `work_orders` | CRUD | Read | Own only | Own only ✅ |
| `work_order_materials` | CRUD | Read | Own WO only | Own WO only ✅ |
| `tasks` | CRUD | Read+Write own | Own only | Own only ✅ |
| `materials` | CRUD | Read | Read | Read ✅ |
| `subscriptions` | CRUD | **CRUD** | **CRUD** | No access ❌ |
| `subscription_payments` | CRUD | **CRUD** | **CRUD** | No access ❌ |
| `payment_methods` | CRUD | **CRUD** | **CRUD** | No access ❌ |
| `sim_cards` | CRUD | CRUD | **Read** | No access ❌ |
| `proposals` / `proposal_items` | CRUD | CRUD | **Read** | No access ❌ |
| `financial_transactions` | **Broken** | **Blocked** | Blocked | admin+accountant only ❌ |
| `exchange_rates` | CRUD | CRUD | Read | Read ✅ |
| `expense_categories` | CRUD | CRUD | Read | Read ✅ |
| `recurring_expense_templates` | CRUD | CRUD | No access | No access ✅ |
| `notifications` | CRUD | CRUD | No access | ? |
| `site_assets` | CRUD | CRUD | Read | Read ✅ |
| `audit_logs` | Read | No access | **Insert** | No insert ❌ |
| `sim_static_ips` | CRUD (no DELETE policy) | CRUD | Read | No access ⚠️ |
| `work_order_assets` | CRUD (no UPDATE policy) | CRUD | Read | Read ⚠️ |

---

## 🔴 CRITICAL Issues

---

### CRIT-1 — `financial_transactions` SELECT/UPDATE policies use non-existent roles

**File:** `00081_soft_delete_financial_transactions.sql`, `00089_fix_soft_delete_with_check.sql`

**Problem:** After the soft-delete migration, the `ft_select` and `ft_update` policies were rewritten using role names `'admin', 'manager', 'office'`. These roles **do not exist** in the system — the actual roles are `'admin', 'field_worker', 'accountant'`. This means **accountants cannot read or update any financial transaction**.

```sql
-- CURRENT (BROKEN) — ft_select in 00081:
USING (
  deleted_at IS NULL
  AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager', 'office'))
);
-- 'accountant' is NOT in that list → accountants see zero rows
```

**Fix:**
```sql
-- Migration: 001XX_fix_financial_transactions_rls

DROP POLICY IF EXISTS ft_select ON financial_transactions;
CREATE POLICY ft_select ON financial_transactions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  );

DROP POLICY IF EXISTS ft_update ON financial_transactions;
CREATE POLICY ft_update ON financial_transactions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  )
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
```

> Also check `ft_insert` (from 00040) — it uses `get_my_role() IN ('admin', 'accountant')` which is correct. No change needed there.

---

### CRIT-2 — `bulk_update_subscription_prices()` RPC has no role guard

**File:** `00024_bulk_update_subscription_prices.sql`

**Problem:** This `SECURITY DEFINER` RPC directly updates subscription prices and recalculates payment amounts. It is `GRANT EXECUTE TO authenticated`, but has **zero role check inside the function**. Any field_worker can call this via the API and overwrite all subscription prices.

```sql
-- The function has NO role check:
CREATE OR REPLACE FUNCTION bulk_update_subscription_prices(p_updates JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- No auth check here — any authenticated user can do this
  FOR i IN 0..(jsonb_array_length(p_updates) - 1) LOOP
    UPDATE subscriptions SET ...
```

**Fix:**
```sql
-- Add at the top of the function body:
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot update subscription prices', v_role;
  END IF;
  -- ... rest of function
```

---

### CRIT-3 — `subscriptions` and `subscription_payments` INSERT/UPDATE allow all roles

**File:** `00021_fix_subscriptions_insert.sql`

**Problem:** Migration 00021 relaxed INSERT/UPDATE on both `subscriptions` and `subscription_payments` to `WITH CHECK (true)` — meaning any authenticated user including field workers can create subscriptions and modify financial payment records.

```sql
-- CURRENT (from 00021):
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (true);  -- field_workers can insert!

CREATE POLICY "sp_insert" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (true);  -- field_workers can insert!
```

**Fix:**
```sql
DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "sp_insert" ON subscription_payments;
CREATE POLICY "sp_insert" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "sp_update" ON subscription_payments;
CREATE POLICY "sp_update" ON subscription_payments FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
```

---

## 🟠 HIGH Issues

---

### HIGH-1 — `payment_methods` INSERT/UPDATE allow all roles

**File:** `00020_fix_payment_methods_insert.sql`

**Problem:** After migration 00020, any authenticated user can insert and update payment methods (bank accounts, card numbers, etc.). This is financial configuration data.

**Fix:**
```sql
DROP POLICY IF EXISTS "pm_insert" ON payment_methods;
CREATE POLICY "pm_insert" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "pm_update" ON payment_methods;
CREATE POLICY "pm_update" ON payment_methods FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
```

---

### HIGH-2 — `fn_cancel_subscription()` and `record_payment()` RPCs have no role guard

**Files:** `00111_atomic_cancel_subscription.sql`, `00098_atomic_record_payment.sql`

**Problem:** Both RPCs are `SECURITY DEFINER` and `GRANT EXECUTE TO authenticated`, but neither checks the caller's role. A field_worker can cancel active subscriptions or record payments for arbitrary subscription records.

**Fix:** Add a role guard at the start of each function:
```sql
-- In fn_cancel_subscription:
v_role := get_my_role();
IF v_role NOT IN ('admin', 'accountant') THEN
  RAISE EXCEPTION 'Unauthorized: only admin or accountant can cancel subscriptions';
END IF;

-- In fn_record_payment (00098):
v_role := get_my_role();
IF v_role NOT IN ('admin', 'accountant') THEN
  RAISE EXCEPTION 'Unauthorized: only admin or accountant can record payments';
END IF;
```

Also apply the same pattern to `fn_revert_write_off()` (00113).

---

### HIGH-3 — `get_daily_work_list()` leaks all work orders when called without `worker_id`

**File:** `00101_grant_rpc_execute.sql`

**Problem:** When `worker_id IS NULL`, the function returns ALL work orders for the target date to any caller — including field_workers who should only see their own work. The view `work_orders_detail` is `security_invoker` so RLS applies, but the work_order SELECT policy allows `created_by = auth.uid()` as an alternative, and a field_worker who didn't create any work orders still gets all assigned ones — but more importantly, the function's semantics imply it is safe to call without a worker filter when it is not.

**Fix:** Enforce role-based filtering inside the function:
```sql
CREATE OR REPLACE FUNCTION public.get_daily_work_list(
  target_date DATE,
  worker_id UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
  v_uid  UUID;
BEGIN
  v_role := get_my_role();
  v_uid  := auth.uid();

  IF v_role IN ('admin', 'accountant') THEN
    -- Admin/accountant: use requested worker_id filter or return all
    IF worker_id IS NULL THEN
      RETURN QUERY SELECT * FROM work_orders_detail
        WHERE scheduled_date = target_date ORDER BY scheduled_time ASC;
    ELSE
      RETURN QUERY SELECT * FROM work_orders_detail
        WHERE scheduled_date = target_date AND worker_id = ANY(assigned_to)
        ORDER BY scheduled_time ASC;
    END IF;
  ELSE
    -- field_worker: always filter to self, ignore the passed worker_id
    RETURN QUERY SELECT * FROM work_orders_detail
      WHERE scheduled_date = target_date AND v_uid = ANY(assigned_to)
      ORDER BY scheduled_time ASC;
  END IF;
END;
$$;
```

---

### HIGH-4 — `sim_cards` readable by all authenticated users

**File:** `00088_soft_delete_sim_cards.sql`, `00104_sim_cards_rls_use_get_my_role.sql`

**Problem:** The `sim_cards` SELECT policy (`"Authenticated users can read sim_cards"`) allows any authenticated user to read all SIM cards including ICCID numbers, revenue, cost, customer assignments, and operator data. Field workers have no business need for this data.

**Fix:**
```sql
DROP POLICY IF EXISTS "Authenticated users can read sim_cards" ON sim_cards;
CREATE POLICY "sim_cards_select" ON sim_cards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  );
```

> Do the same for `sim_card_history` — it currently has `USING (true)` with no deleted_at check and no role restriction.

---

### HIGH-5 — `proposals` and `proposal_items` readable by all authenticated users

**File:** `00087_soft_delete_proposals.sql`, `00093_fix_proposals_delete_rls.sql`

**Problem:** Any authenticated user can read all proposals including pricing, margin, cost terms. Field workers should not see commercial offer data.

**Fix:**
```sql
DROP POLICY IF EXISTS "Authenticated users can read proposals" ON proposals;
CREATE POLICY "proposals_select" ON proposals
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_my_role() IN ('admin', 'accountant')
  );

DROP POLICY IF EXISTS "Authenticated users can read proposal_items" ON proposal_items;
CREATE POLICY "proposal_items_select" ON proposal_items
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
```

> Note: `proposals_detail` view must remain `security_invoker = true` (already set in 00087/00093) for this to propagate through the view.

---

## 🟡 MEDIUM Issues

---

### MED-1 — `customers` and `customer_sites` INSERT/UPDATE available to field_workers

**Problem:** All authenticated users can create and modify customer and site records. Field workers should only read this data, not change it.

**Fix:**
```sql
-- customers
DROP POLICY IF EXISTS "customers_insert_authenticated" ON customers;
CREATE POLICY "customers_insert_authenticated" ON customers FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "customers_update_authenticated" ON customers;
CREATE POLICY "customers_update_authenticated" ON customers FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

-- customer_sites (same pattern)
DROP POLICY IF EXISTS "customer_sites_insert_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_insert_authenticated" ON customer_sites FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "customer_sites_update_authenticated" ON customer_sites;
CREATE POLICY "customer_sites_update_authenticated" ON customer_sites FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
```

> ⚠️ Before applying: confirm whether field workers need to add notes/update their assigned sites from the mobile view. Adjust accordingly.

---

### MED-2 — `audit_logs` INSERT allows any authenticated user

**Problem:** The `audit_insert` policy uses `WITH CHECK (true)`, so any authenticated user can write arbitrary rows to the audit log. This undermines audit integrity — a malicious user could fabricate or flood the log.

**Fix:**
```sql
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Keep permissive for app writes, but add rate-limit via RPC

-- Better long-term: route all audit writes through a SECURITY DEFINER function
-- that validates the shape of the record before inserting.
```

Short term: The table itself is the lesser risk. The bigger risk is that a field worker with API access can insert fake entries. Consider restricting to `get_my_role() IN ('admin', 'accountant')` if audit writes only happen from admin/accountant actions.

---

### MED-3 — `work_order_assets` is missing an UPDATE policy

**Problem:** The `work_order_assets` table was set up in migration 00074 with SELECT, INSERT, DELETE policies but no UPDATE. If any code tries to update a work_order_asset row, it will silently fail (0 rows affected, no error).

**Fix:**
```sql
CREATE POLICY woa_update ON work_order_assets
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
```

---

### MED-4 — `sim_static_ips` is missing a DELETE policy

**Problem:** The `sim_static_ips` table (created in 00090) has SELECT, INSERT, UPDATE policies but no DELETE policy. Cancelling a static IP (soft-deleting via `cancelled_at`) works via UPDATE, but hard-delete is impossible for any role.

**Fix:**
```sql
CREATE POLICY "sim_static_ips_delete"
  ON sim_static_ips FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
```

---

### MED-5 — `search_work_history()` has no role guard inside the function

**File:** `00101_grant_rpc_execute.sql`

**Problem:** This SECURITY DEFINER function returns from `work_orders_detail` (security_invoker), so RLS applies. However, since field_workers can see work orders they created, a field worker could use this search endpoint to probe data indirectly (e.g., search by account_no to see if a customer exists). For a business application this is a low-medium concern, but worth a role check:

**Fix:**
```sql
-- At the top of search_work_history:
v_role := get_my_role();
IF v_role NOT IN ('admin', 'accountant') THEN
  RAISE EXCEPTION 'Unauthorized: search_work_history requires admin or accountant role';
END IF;
```

---

## 🟢 LOW Issues

---

### LOW-1 — `profiles` SELECT exposes role field to all authenticated users

**Problem:** The `profiles_select_authenticated` policy (`USING (true)`) gives every user access to every other user's `role`, `phone`, and `avatar_url`. The role field is particularly sensitive — a field_worker can determine which accounts are admins.

**Recommended fix:** Either:
- Project out `role` in a view that field_workers query, or
- Restrict with: `USING (id = auth.uid() OR get_my_role() IN ('admin', 'accountant'))`

> Note: The SELECT policy is intentionally permissive for assignment dropdowns. If you restrict it, ensure the dropdowns (`assigned_to` pickers) still work — they may need a dedicated function.

---

### LOW-2 — `get_my_role()` role caching and privilege escalation window

**Problem:** `get_my_role()` is STABLE, meaning it can be cached within a query. If a user's role is changed in `profiles`, the old role is still in their JWT and used by `get_my_role()` until the session expires. There is no session invalidation mechanism.

**Impact:** Low for the current single-tenant use case, but should be noted.

**Recommendation:** For role changes that need immediate effect (e.g., revoking admin), manually expire the user's session via Supabase Auth dashboard or API.

---

### LOW-3 — `notifications` field_workers cannot see any notifications

**Problem:** The `notifications_select` policy requires `get_my_role() IN ('admin', 'accountant')`. If field workers are ever supposed to receive app notifications, they are currently completely blocked.

**Recommendation:** Clarify intent. If field_workers should receive notifications assigned to them:
```sql
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin', 'accountant')
    OR recipient_user_id = auth.uid()  -- if the table has a recipient column
  );
```

---

## Prioritized Fix Order

```
Sprint 1 (this week — correctness + data safety):
  1. CRIT-1  Fix financial_transactions RLS (wrong role names — accountants locked out)
  2. CRIT-3  Fix subscriptions + subscription_payments INSERT/UPDATE policies
  3. CRIT-2  Add role guard to bulk_update_subscription_prices()

Sprint 2 (next week — privilege reduction):
  4. HIGH-2  Add role guards to fn_cancel_subscription() and fn_record_payment()
  5. HIGH-1  Fix payment_methods INSERT/UPDATE (restrict to admin+accountant)
  6. HIGH-4  Restrict sim_cards SELECT to admin+accountant
  7. HIGH-5  Restrict proposals SELECT to admin+accountant

Sprint 3 (before go-live):
  8. HIGH-3  Fix get_daily_work_list() worker_id bypass
  9. MED-1   Restrict customers + customer_sites INSERT/UPDATE
 10. MED-3   Add UPDATE policy to work_order_assets
 11. MED-4   Add DELETE policy to sim_static_ips
 12. MED-2   Harden audit_logs INSERT

Post-launch:
 13. MED-5   Add role guard to search_work_history()
 14. LOW-1   Review profiles SELECT exposure
 15. LOW-3   Clarify notifications for field_workers
```

---

## Anon Key Safety Check

| Check | Result |
|-------|--------|
| All tables have RLS enabled | ✅ |
| All policies use `TO authenticated` (not `TO anon`) | ✅ |
| Views have `REVOKE SELECT FROM anon` | ✅ (done in 00077) |
| No function is `GRANT EXECUTE TO anon` | ✅ |
| Supabase `anon` key cannot access any data | ✅ Safe |

---

## Technician Cross-Data Check

| Scenario | Current Behavior | Correct? |
|----------|------------------|----------|
| Technician sees another technician's work orders | ❌ Cannot (policy: assigned_to or created_by) | ✅ |
| Technician sees another technician's tasks | ❌ Cannot (policy: assigned_to or created_by) | ✅ |
| Technician can read all customers | ✅ Can read (USING: deleted_at IS NULL) | ✅ Acceptable |
| Technician can **edit** customers | ✅ Can edit — no restriction | ❌ Fix (MED-1) |
| Technician can read all SIM cards | ✅ Can read | ❌ Fix (HIGH-4) |
| Technician can read all proposals | ✅ Can read | ❌ Fix (HIGH-5) |
| Technician can create subscriptions | ✅ Can insert | ❌ Fix (CRIT-3) |
| Technician can record payments | ✅ Can call RPC | ❌ Fix (HIGH-2) |
| Technician can cancel subscriptions | ✅ Can call RPC | ❌ Fix (HIGH-2) |
| Technician can read financial_transactions | ❌ Blocked | ✅ |
| Technician can read financial reports (v_profit_and_loss) | ❌ Blocked (security_invoker → ft_select blocks) | ✅ |
