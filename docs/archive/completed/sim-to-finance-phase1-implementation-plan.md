# Phase 1: SIM-to-Finance Trigger — Implementation Plan

**Date:** 2025-02-12  
**Status:** Plan only — no code yet

---

## 1. Migration Strategy

### 1.1 Number of Migration Files

**Recommendation: One migration file**

- Single migration `00058_sim_card_to_finance.sql` containing all steps
- Keeps related changes together; easier to rollback as one unit

**Alternative:** Split into two if you prefer smaller units:
- `00058_add_sim_card_id_to_financial_transactions.sql`
- `00059_sim_card_finance_trigger.sql`

### 1.2 Order of Changes (within single migration)

| Step | Change | Purpose |
|------|--------|---------|
| 1 | Add `sim_card_id` column to `financial_transactions` | Traceability; required for trigger |
| 2 | Create index on `sim_card_id` | Query performance for idempotency check |
| 3 | Create `site_has_active_subscription(p_site_id)` function | Reusable; no side effects |
| 4 | Create `fn_sim_card_to_finance()` trigger function | Logic |
| 5 | Create trigger `trg_sim_card_to_finance` on `sim_cards` | AFTER UPDATE |

**Dependencies:** Step 2 depends on 1. Steps 3–4–5 are independent of each other but must run after 1.

### 1.3 Rollback Strategy

**If migration fails:**
- Fix the migration file and run again (Supabase tracks applied migrations)
- Or: manually run `DROP TRIGGER`, `DROP FUNCTION`, `ALTER TABLE DROP COLUMN` in reverse order

**If migration succeeds but trigger causes issues:**
- `DROP TRIGGER trg_sim_card_to_finance ON sim_cards;`
- `DROP FUNCTION fn_sim_card_to_finance();`
- Optionally: `ALTER TABLE financial_transactions DROP COLUMN sim_card_id;` (only if no transactions reference it)

**Rollback migration:** Create `00059_rollback_sim_card_finance.sql` containing the DROP statements above, to be run manually if needed.

---

## 2. Idempotency Design

### 2.1 `period` Column

- **Type:** GENERATED ALWAYS AS (...) STORED
- **Source:** Derived from `transaction_date` (YYYY-MM)
- **Stored:** Yes — can be used in WHERE, JOIN, EXISTS
- **Unique constraint:** Not needed for idempotency; we use EXISTS check instead

### 2.2 Idempotency Approach

**Use:** `EXISTS (SELECT 1 FROM financial_transactions WHERE sim_card_id = X AND period = Y AND direction = Z)`

- **Before inserting expense:** Check if expense already exists for this `sim_card_id` + `period`
- **Before inserting income:** Check if income already exists for this `sim_card_id` + `period`
- **`v_period`:** `to_char(CURRENT_DATE, 'YYYY-MM')` — current month
- **`transaction_date`:** First day of current month: `date_trunc('month', CURRENT_DATE)::DATE`

### 2.3 Alternative: `transaction_date` + `sim_card_id`

- Works the same: `period` is derived from `transaction_date`
- Using `period` is clearer and matches how other triggers (e.g. subscription_payment) group by period

### 2.4 Trigger Runs Twice Same Month

- Same `status` change (e.g. available → active): Idempotency check prevents duplicate; second run does nothing
- Multiple status changes in same month (e.g. active → inactive → active): Each transition creates different rows; idempotency is per `sim_card_id` + `period` + `direction`. For → active we create income + expense for this month. If we already have them, we skip. For → inactive we create expense only for this month. If we already have it, we skip.

**Note:** If SIM goes active → inactive → active in same month, we'd have:
- First transition: income + expense (active)
- Second transition: expense (inactive) — idempotency: do we already have expense for this period? Yes, from first transition. So we'd skip. But that expense was for "active" — now we're "inactive". The cost is the same. So one expense per period is correct. For income: we had income when active, then we went inactive (no new income), then active again. We'd try to create income again — idempotency would block it (we already have income for this period). So we'd have one income, one expense. Correct.

---

## 3. Edge Cases

| Edge Case | Action |
|-----------|--------|
| **SIM has no customer_id or site_id** | Skip trigger logic (RETURN NEW). Cannot attribute transactions. |
| **cost_price is NULL or 0** | Expense: skip if `COALESCE(cost_price, 0) <= 0` |
| **sale_price is NULL or 0** | Income: skip if `COALESCE(sale_price, 0) <= 0` |
| **expense_category 'sim_operator' doesn't exist** | Skip expense insert; log warning or return (don't fail trigger) |
| **SIM changes status multiple times same day** | Idempotency: one expense per sim_card + period; one income per sim_card + period. Same-day transitions → same period; duplicates blocked. |
| **Bulk update (multiple SIMs)** | Trigger fires per row. Each row gets its own idempotency check. No issue. |
| **Status not in ('active','inactive')** | Exit early (RETURN NEW). No transactions for status = available, sold, subscription. |
| **TG_OP = INSERT** | Exit early (implementation is UPDATE-only). If needed later, add INSERT handling. |

---

## 4. Testing Approach

### 4.1 Test Data Needed

- At least one SIM with `status = 'available'`, `customer_id`, `site_id`, `cost_price > 0`, `sale_price > 0`
- A site with active subscription (to test wholesale vs subscription)
- A site with no subscription (wholesale)

### 4.2 Status Transitions to Test

| Transition | Expected | Verify |
|------------|----------|--------|
| available → active (wholesale site) | 1 income + 1 expense | Check financial_transactions for sim_card_id, income_type='sim_rental', expense_category=sim_operator |
| available → active (subscription site) | 1 expense only | No income row |
| active → inactive | 1 expense | Check financial_transactions |
| active → available | No new rows | Idempotency or no-op |
| available → subscription | No rows | Trigger skips subscription |

### 4.3 Verification Steps

1. **Before migration:** Count `financial_transactions` where `income_type = 'sim_rental'` (should be 0)
2. **After migration:** Run one status change (available → active)
3. **Query:** `SELECT * FROM financial_transactions WHERE sim_card_id = :id ORDER BY created_at DESC`
4. **Check:** Income row has `amount_try = sale_price`, expense has `amount_try = cost_price`
5. **Check:** Income row has `customer_id`, `site_id` from SIM
6. **Run same change again:** No new rows (idempotency)

### 4.4 Rollback If Issues Found

1. Run `DROP TRIGGER trg_sim_card_to_finance ON sim_cards;`
2. Run `DROP FUNCTION fn_sim_card_to_finance();`
3. Optionally delete test rows: `DELETE FROM financial_transactions WHERE sim_card_id IS NOT NULL`
4. Deploy fix; re-run migration or create new migration to fix

---

## 5. Subscription Check Logic

### 5.1 What if site_id is NULL?

- **Action:** Skip trigger logic (RETURN NEW). Same as no customer_id — cannot attribute.

### 5.2 What if subscription is 'paused' (not 'active')?

- **Current design:** `status = 'active'` only. Paused = NOT active.
- **Effect:** Site with only paused subscription → treated as wholesale → sim_rental income created
- **Decision:** Keep as-is. Paused = subscription on hold; no subscription revenue; SIM rental could apply. If business decides otherwise, change to `status IN ('active','paused')`.

### 5.3 Should we check subscription.end_date?

- **Current:** No. We only check `status = 'active'`.
- **Effect:** Expired subscription (end_date passed) but status still 'active' → still treated as subscription customer. Unlikely if status is updated on expiry.
- **Recommendation:** Keep simple. Add end_date check only if business requires it.

### 5.4 Performance

- **Query:** `EXISTS (SELECT 1 FROM subscriptions WHERE site_id = X AND status = 'active')`
- **Index:** `idx_subscriptions_site_id` or similar exists; `status` filter is selective
- **Frequency:** Once per SIM status change (not per request)
- **Verdict:** No concern for typical use case

---

## 6. Step-by-Step Summary

| # | Task | Output |
|---|------|--------|
| 1 | Add `sim_card_id` column | `financial_transactions.sim_card_id` |
| 2 | Create index | `idx_ft_sim_card` |
| 3 | Create helper | `site_has_active_subscription(p_site_id)` |
| 4 | Create trigger function | `fn_sim_card_to_finance()` |
| 5 | Create trigger | `trg_sim_card_to_finance` AFTER UPDATE |
| 6 | Test | Run transitions; verify rows |
| 7 | (Optional) Rollback script | `00059_rollback_sim_card_finance.sql` |

---

## 7. Open Decisions

- **INSERT handling:** Implement now or only UPDATE? (Recommendation: UPDATE only for Phase 1)
- **Paused subscription:** Treat as subscription customer or wholesale? (Recommendation: wholesale for now)
- **Currency:** TRY only for Phase 1, or add USD via exchange_rates? (Recommendation: TRY only; add USD in Phase 2 if needed)
