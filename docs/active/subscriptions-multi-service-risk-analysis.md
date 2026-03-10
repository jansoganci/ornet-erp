# Multi-Service Support Implementation – Risk Analysis & Impact Assessment

> **Status:** Analysis only. DO NOT IMPLEMENT until business decisions are made.

---

## 1. FK Dependency Map

### Tables with direct FK to `subscriptions.id`

| Table | Column | Constraint | Impact |
|-------|--------|------------|--------|
| **subscription_payments** | `subscription_id` | `REFERENCES subscriptions(id) ON DELETE CASCADE` | **Critical** – Payments are 1:1 with subscription. Splitting 1 sub → 3 subs means we must decide: keep payments on one, duplicate, or re-link. |
| **subscription_price_revision_notes** | `subscription_id` | `REFERENCES subscriptions(id) ON DELETE CASCADE` | **Medium** – Notes are per subscription. Split subs won't have notes; decide: copy to all or keep on one. |

### Tables that reference subscriptions indirectly (view/join only)

| Table/View | Relationship | Impact |
|------------|--------------|--------|
| **subscriptions_detail** | View joining `subscriptions` with sites, customers, payment methods | No change – already returns one row per subscription. |
| **audit_logs** | `record_id` stores UUID (generic, not FK) for `table_name='subscriptions'` | No cascade. Orphaned references after split/deletion are OK for audit trail. |

### Tables that do NOT reference subscriptions

- **sim_cards** – Links to `site_id` and `customer_id` only. **No FK to subscriptions.** ✅
- **customer_sites** – Subscriptions reference sites; sites do not reference subscriptions. ✅
- **customers** – No direct subscription link. ✅
- **work_orders**, **proposals**, **tasks**, etc. – No subscription FK. ✅

---

## 2. Impact Analysis per Table

### A. subscription_payments

**Current:** One payment record per (subscription_id, payment_month). UNIQUE (subscription_id, payment_month).

**Split scenario:** Combo subscription with 12 monthly payments. We split to 3 rows (alarm, camera, internet).

| Option | Description | Pros | Cons |
|--------|--------------|------|------|
| **1. Keep on original** | Rename original to alarm_only; payments stay. New camera/internet subs get fresh payment records (call generate_subscription_payments). | Simple. Historical payments preserved. | Old "bundle" payments show only on alarm row. Camera/internet show no history. |
| **2. Duplicate payments** | Create copies of each payment row for each new subscription (with split amounts). | Each service has its own payment history. | Complex. Amount splitting is arbitrary. Risk of double-counting MRR. |
| **3. Leave as-is, mark migrated** | Keep combo subscription as "legacy", mark status differently. Create new separate subs for future. Don't split existing. | No migration of payments. | Combo subs remain; doesn't achieve "one row per service". |

**Recommendation:** Option 1. Keep payments on the subscription we convert to `alarm_only`. New subs get `generate_subscription_payments` from current month. Past payments = legacy bundle; going forward each service is independent.

---

### B. subscription_price_revision_notes

**Current:** Notes linked to `subscription_id`.

**Split scenario:** Combo sub has 3 revision notes. We create 3 new subscriptions.

| Option | Description |
|--------|-------------|
| **Copy to all** | Insert note copies for each new subscription_id. |
| **Keep on first only** | Assign notes to alarm_only (the row we keep from original). Others get empty. |
| **Don't copy** | New subs have no notes. User can add going forward. |

**Recommendation:** Keep on first (alarm_only) only. Notes are typically about overall price revision; duplicating would be misleading.

---

### C. audit_logs

**Structure:** `table_name`, `record_id` (UUID), `action`, `old_values`, `new_values`, etc. No FK.

**Impact:** When we delete the original combo subscription (or update it), audit logs keep the old `record_id`. That ID may no longer exist. For audit trail this is acceptable – we preserve history. No migration needed.

---

## 3. Application Logic Breakage Analysis

### A. Subscription Payments Flow

| Component | Assumption | Multi-Service Impact |
|-----------|------------|----------------------|
| `fetchPaymentsBySubscription(subscriptionId)` | Works per subscription | ✅ No change |
| `recordPayment(paymentId)` | Works per payment row | ✅ No change |
| `generate_subscription_payments` | Takes subscription_id, creates 1 row per month (or 1 for yearly) | ✅ No change |
| Bulk payment creation | None – payments are created per subscription | ✅ No change |

**Verdict:** Payment logic is subscription-scoped. No changes needed.

---

### B. SIM Card Management

- **sim_cards** table: `site_id`, `customer_id` – NO `subscription_id`.
- SIM cards are assigned to site/customer, not to a specific subscription.
- One SIM can "serve" multiple services at same site (alarm + camera) – no schema change.
- **Verdict:** No impact. ✅

---

### C. Dashboard & Reports

| Component | Uses subscriptions? | Impact |
|-----------|---------------------|--------|
| **DashboardPage.jsx** | No – uses `useDashboardStats` (work orders, tasks, customers) and `useSimFinancialStats` | ✅ No impact |
| **get_subscription_stats()** | Yes – counts active subscriptions, sums MRR | ✅ Correct – more subs = more count, MRR sums all. |
| **SubscriptionsListPage** | Uses `useSubscriptions` | ✅ Shows all rows. Multi-service = more rows. |

**Verdict:** Stats will count services correctly. No breakage.

---

### D. Customer / Site Detail Pages

| Page | Subscription display | Impact |
|------|----------------------|--------|
| **CustomerDetailPage** | Does NOT display subscriptions | ✅ No impact |
| **SiteCard** | Does NOT display subscriptions | ✅ No impact |
| **SubscriptionDetailPage** | Shows single subscription by ID | ✅ No change – one sub per page. |
| **SubscriptionFormPage** | Create/Edit – no check for "site already has sub" | ❌ Today: DB rejects 2nd sub. After migration: must allow. |

**Verdict:** Customer/Site pages don't show subscriptions. Subscription Create form needs update to allow adding another service for same site.

---

### E. Subscription Import

**Current flow:** For each row, find/create customer+site, then `createSubscription`. Cache key = `customerId|siteName`.

**Problem:** If import has 2 rows for same company+site (e.g. alarm_only and camera_only):
1. Both get same `siteId` from cache
2. First `createSubscription` succeeds
3. Second fails with `idx_subscriptions_active_site` unique violation

**After migration:** Both would succeed (different service_type). Import already passes `service_type` per row. ✅ Works as-is post-migration, but import template/UX should clarify "one row per service".

---

### F. Filters & Searches

| Filter | Uniqueness assumption? | Impact |
|--------|------------------------|--------|
| `account_no` | Lives in `customer_sites`, not subscriptions | All subs for same site share account_no. Search returns multiple rows. ✅ |
| `company_name`, `site_name` | From view join | Same – multiple subs, same names. ✅ |
| `service_type` | Filter by service | ✅ Correct – filters to specific services. |

**Verdict:** No filters assume one sub per site. All good.

---

## 4. Pricing & Billing Logic

### Billing model

- Each subscription has its own `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`.
- `subscription_type` (recurring_card, manual_cash, manual_bank) is per subscription.
- **Can alarm be recurring_card and camera be manual_cash?** Yes – each row is independent.

### account_no

- **Source:** `customer_sites.account_no` (from view join).
- **Uniqueness:** Per site. All subscriptions for the same site show the same account_no.
- **Recommendation:** Reuse same account_no for all services at a site. No new account numbers needed.

---

## 5. Business Logic Constraints

### A. Application-level validation

- **SubscriptionFormPage:** No check for "site already has subscription". DB enforces uniqueness.
- **Create flow:** After migration, no app-level block. ✅

### B. Status transitions

- Each subscription has its own `status` (active/paused/cancelled).
- Pausing one service does not affect others. ✅ By design.

### C. Pricing / bundle discounts

- Current schema has no "bundle discount" field.
- Splitting combo → separate rows means each has its own price.
- **Business decision:** How to split 1800₺ bundle? (See Questions section.)

---

## 6. UI/UX Changes Needed

| Page | Current | New behavior needed |
|------|---------|---------------------|
| **Price Revision** | One row per subscription | ✅ Already correct |
| **Subscriptions List** | One row per subscription | ✅ Already correct |
| **Subscription Create** | DB rejects 2nd sub for same site | ❌ Remove block; allow adding another service |
| **Subscription Detail** | Shows one subscription | ⚠️ Optional: add "Other services at this site" link |
| **Customer Detail** | No subscription section | ⚠️ Optional: add subscriptions by customer/sites |
| **SiteCard / Site Detail** | No subscription display | ❌ Add "Subscriptions" section (plural) – list all subs for site |
| **Dashboard** | No subscription stats | ✅ Uses work orders, SIM; get_subscription_stats unchanged |

---

## 7. Migration Script (Proposed)

### Pre-requisites

1. **Data check:** Count combo subscriptions:
```sql
SELECT service_type, COUNT(*) 
FROM subscriptions 
WHERE service_type IN ('alarm_camera', 'alarm_camera_internet')
  AND status = 'active'
GROUP BY service_type;
```

2. **Backup:**
```sql
CREATE TABLE subscriptions_backup_YYYYMMDD AS SELECT * FROM subscriptions;
CREATE TABLE subscription_payments_backup_YYYYMMDD AS SELECT * FROM subscription_payments;
CREATE TABLE subscription_price_revision_notes_backup_YYYYMMDD AS SELECT * FROM subscription_price_revision_notes;
```

### Migration steps

```sql
-- Step 1: Drop old constraint
DROP INDEX IF EXISTS idx_subscriptions_active_site;

-- Step 2: Add new constraint (one active subscription per site per service type)
-- Only allow atomic types: alarm_only, camera_only, internet_only
CREATE UNIQUE INDEX idx_subscriptions_active_site_service 
  ON subscriptions (site_id, service_type) 
  WHERE status = 'active' AND service_type IS NOT NULL;

-- Step 3: Migrate alarm_camera → 2 rows
-- Strategy: Update original to alarm_only. Insert new camera_only.
-- Pricing: Business decision (see Questions).

-- For each subscription WHERE service_type = 'alarm_camera':
--   a) Update: SET service_type = 'alarm_only', base_price = X, sms_fee = Y, line_fee = Z
--   b) INSERT new row: site_id, service_type='camera_only', base_price=A, sms_fee=B, line_fee=C, ...
--   c) Call generate_subscription_payments for new row

-- Step 4: Migrate alarm_camera_internet → 3 rows
--   a) Update original to alarm_only (with split pricing)
--   b) INSERT camera_only
--   c) INSERT internet_only
--   d) generate_subscription_payments for both new rows

-- Step 5: Update service_type CHECK constraint (remove combos)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_service_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_service_type_check 
  CHECK (service_type IN ('alarm_only', 'camera_only', 'internet_only'));
```

### Pricing split strategy (business decision)

| Scenario | Example | Options |
|----------|---------|---------|
| alarm_camera 1800₺ | Split to alarm + camera | Manual (e.g. 1200+600), equal (900+900), or keep on alarm (1800+0) |
| alarm_camera_internet 2000₺ | Split to 3 | Manual (1000+600+400), equal (666 each), or similar |

**Recommendation:** Manual split with migration config table or script parameters. No automatic formula.

---

## 8. Rollback Plan

```sql
-- Restore from backup (ONLY if migration failed before committing)
-- WARNING: Only use if migration is incomplete/failed

-- Restore constraint
DROP INDEX IF EXISTS idx_subscriptions_active_site_service;
CREATE UNIQUE INDEX idx_subscriptions_active_site 
  ON subscriptions (site_id) 
  WHERE status = 'active';

-- Restore data (if we modified)
-- TRUNCATE subscriptions CASCADE;
-- INSERT INTO subscriptions SELECT * FROM subscriptions_backup_YYYYMMDD;
-- (Then re-run generate_subscription_payments for affected subs)
```

**Safer approach:** Run migration in a transaction. If any step fails, ROLLBACK. Test on staging first.

---

## 9. Testing Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Create new subscription for site that already has one (different service_type) | Success |
| 2 | Create duplicate service_type for same site | Rejected by unique constraint |
| 3 | Price Revision page with multi-service site | 3 rows for site with 3 services |
| 4 | Update price for one service | Others unchanged |
| 5 | Add revision note to one subscription | Isolated; other subs unaffected |
| 6 | Customer Detail (if we add subscriptions) | Shows all subs for customer's sites |
| 7 | Record payment for one subscription | Only that sub's payments updated |
| 8 | Pause one service | Others remain active |
| 9 | Filter by service_type | Correct rows |
| 10 | Export subscriptions | All rows; multiple per site possible |
| 11 | Import: 2 rows same site, different services | Both created |
| 12 | get_subscription_stats | active_count, MRR reflect all services |
| 13 | SIM card at site with 3 subs | No change – SIM links to site |

---

## 10. Questions for Business Decisions

### Pricing split

When splitting `alarm_camera` (1800₺) or `alarm_camera_internet` (2000₺):

- **A.** Manual per subscription (you provide: alarm=1000, camera=500, internet=500)?
- **B.** Equal split?
- **C.** Keep total on one (alarm), others 0?

### Payment history

For existing payments on combo subscription:

- **A.** Keep linked to original (which becomes alarm_only)?
- **B.** Duplicate for each new subscription (with split amounts)?
- **C.** Leave as "legacy"; new subs start fresh from current month?

### Account numbers

- **Per site:** Reuse same account_no for all 3 services ✅ (current design)
- **Per subscription:** Would require new column; not recommended

### Future bundles

- Will you still offer combo pricing? If yes: how to represent? (3 separate subs with discount flag? New "bundle" entity?)
- If no: Remove combo service_types entirely in migration.

---

## 11. Effort Estimate

| Task | Effort |
|------|--------|
| Migration script (with pricing config) | 1 day |
| Subscription Create form (allow add service for same site) | 0.5 day |
| SiteCard / Site detail: show subscriptions (plural) | 0.5 day |
| Customer Detail: optional subscriptions section | 0.5 day |
| Schema update: remove combo types, add new constraint | Included in migration |
| Testing & QA | 1 day |
| **Total** | **~3.5 days** |

---

## 12. Summary

| Area | Status |
|------|--------|
| FK dependencies | 2 tables: subscription_payments, subscription_price_revision_notes |
| Payment logic | No changes |
| SIM cards | No link to subscriptions |
| Dashboard | No subscription stats in main view; get_subscription_stats OK |
| Customer/Site pages | No subscription display today; Site needs "Subscriptions" section |
| Import | Works post-migration; template should clarify |
| account_no | Per site; reuse for all services |
| Migration | Drop old index; add (site_id, service_type) unique; split combos |
| Rollback | Possible via backup; test on staging |

**Recommendation:** Proceed after business decisions on pricing split and payment history. Migration is feasible with low–medium effort.
