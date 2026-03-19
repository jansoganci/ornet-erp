# Finance Fix Roadmap

> **Date:** 2026-03-19
> **Based on:** [finance-audit-report.md](./finance-audit-report.md), [SUBSCRIPTION_CALCULATION_AUDIT.md](./SUBSCRIPTION_CALCULATION_AUDIT.md)
> **Priority:** Critical fixes first, then data integrity, then polish

---

## Phase 1 — Fix Double-Counting & Data Integrity (CRITICAL)

**Goal:** Make P&L, Dashboard, and VAT reports show correct numbers.

### Task 1.1 — Fix v_profit_and_loss double-counting (G1)

**Bug:** Subscription revenue counted twice — once from `subscription_payments` UNION, once from trigger-created `financial_transactions`.

**Fix:** Drop and recreate `v_profit_and_loss` to query only `financial_transactions`. Remove the `subscription_payments` UNION entirely since migration 00050's trigger already creates `financial_transactions` rows.

**Migration file:** `supabase/migrations/00XXX_fix_v_pnl_double_counting.sql`

```sql
DROP VIEW IF EXISTS v_profit_and_loss;

CREATE VIEW v_profit_and_loss AS
-- Income (subscriptions via trigger + manual + proposals + work orders)
SELECT
  ft.id::TEXT AS source_id,
  COALESCE(ft.income_type, 'other') AS source_type,
  'income' AS direction,
  ft.transaction_date AS period_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,
  ft.output_vat,
  NULL::DECIMAL AS input_vat,
  ft.should_invoice AS is_official,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND ft.deleted_at IS NULL              -- Task 1.2
  AND (ft.status = 'confirmed' OR ft.status IS NULL)

UNION ALL

-- Expense
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,
  NULL,
  ft.input_vat,
  ft.has_invoice,
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense'
  AND ft.deleted_at IS NULL              -- Task 1.2
  AND (ft.status = 'confirmed' OR ft.status IS NULL);

-- Re-apply security invoker
ALTER VIEW v_profit_and_loss SET (security_invoker = true);
GRANT SELECT ON v_profit_and_loss TO authenticated;
```

**Pre-flight check:** Before applying, verify that all paid `subscription_payments` have corresponding `financial_transactions` rows:

```sql
SELECT COUNT(*) AS orphaned_payments
FROM subscription_payments sp
WHERE sp.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM financial_transactions ft
    WHERE ft.subscription_payment_id = sp.id
  );
```

If `orphaned_payments > 0`, run the backfill from migration 00050 first.

**Acceptance criteria:**
- [ ] `SELECT SUM(amount_try) FROM v_profit_and_loss WHERE direction='income'` matches `SELECT SUM(amount_try) FROM financial_transactions WHERE direction='income' AND deleted_at IS NULL`
- [ ] No duplicate `source_id` values in P&L view for subscription income
- [ ] Finance Dashboard KPIs match Income page totals for the same period

---

### Task 1.2 — Add deleted_at filter to v_profit_and_loss (G2)

**Bug:** Soft-deleted transactions still appear in P&L view.

**Fix:** Included in Task 1.1 above — `AND ft.deleted_at IS NULL` added to both income and expense portions.

**Acceptance criteria:**
- [ ] Delete a transaction on Income page → P&L totals decrease immediately
- [ ] Delete a transaction on Expenses page → P&L totals decrease immediately

---

### Task 1.3 — Fix 3_month COGS multiplier (G5)

**Bug:** 3-month billing uses 1x cost instead of 3x.

**Fix:** Add to the same migration as Task 1.1 (if the view still contains COGS logic) OR fix inside `fn_subscription_payment_to_finance`:

```sql
-- In fn_subscription_payment_to_finance (00050):
IF (v_sub.billing_frequency = 'yearly') THEN
  v_multiplier := 12;
ELSIF v_sub.billing_frequency = '6_month' THEN
  v_multiplier := 6;
ELSIF v_sub.billing_frequency = '3_month' THEN
  v_multiplier := 3;
ELSE
  v_multiplier := 1;
END IF;
```

**Note:** Since Task 1.1 removes `subscription_payments` from the P&L view, the COGS is now computed by the trigger (stored in `financial_transactions.cogs_try`). Fix the trigger function + backfill existing 3-month records.

**Acceptance criteria:**
- [ ] 3-month subscription payment shows COGS = `cost * 3` in financial_transactions
- [ ] P&L gross margin is correct for 3-month subscriptions

---

## Phase 2 — SIM Card Revenue Accuracy

### Task 2.1 — Fix view_sim_card_financials to include subscription SIMs (G3)

**Migration file:** `supabase/migrations/00XXX_fix_sim_financial_view.sql`

```sql
CREATE OR REPLACE VIEW view_sim_card_financials AS
SELECT
    COALESCE(SUM(sale_price), 0) as total_monthly_revenue,
    COALESCE(SUM(cost_price), 0) as total_monthly_cost,
    COALESCE(SUM(sale_price - cost_price), 0) as total_monthly_profit,
    COUNT(*) as active_sim_count
FROM sim_cards
WHERE status IN ('active', 'subscription');
```

**Acceptance criteria:**
- [ ] SIM dashboard revenue includes subscription-linked SIMs
- [ ] `active_sim_count` reflects both active and subscription SIMs

---

### Task 2.2 — Flag null cost_price in invoice analysis (G4)

**File:** `src/features/simCards/utils/compareInvoiceToInventory.js`

**Changes:**
1. Line 74: Replace `simCard.cost_price || 0` with explicit null tracking:
   ```js
   const costPrice = simCard.cost_price;
   const hasCost = costPrice != null && costPrice > 0;
   ```

2. Add `unknownCostCount` to summary output

3. In matched record, add `hasCost: boolean` flag

**UI changes:**
- Add warning banner in invoice analysis results when `unknownCostCount > 0`
- Show "?" or "N/A" for cost/profit columns when `hasCost === false`

**Acceptance criteria:**
- [ ] SIMs with null cost_price show "Unknown" in cost column, not "0"
- [ ] Warning banner appears when any matched SIMs have unknown cost
- [ ] Profit/loss calculations exclude unknown-cost SIMs from totals

---

### Task 2.3 — Improve invoice duplicate handling (G16)

**File:** `src/features/simCards/utils/compareInvoiceToInventory.js`

**Change:** When duplicate `hatNo` found, sum the amounts instead of overwriting:

```js
if (invoiceMap.has(normalized)) {
  const existing = invoiceMap.get(normalized);
  existing.invoiceAmount += line.invoiceAmount;
  existing.kdv += line.kdv;
  existing.total += line.total;
  duplicateHatNos.push(normalized);
} else {
  invoiceMap.set(normalized, { ...line });
}
```

**Decision needed:** Confirm with business whether duplicate hatNos represent split billing (sum) or data errors (flag).

---

## Phase 3 — Subscription Price Calculation Fixes

### Task 3.1 — Add sim_amount to fn_update_subscription_price (G9)

**File:** `supabase/migrations/00XXX_fix_price_update_sim_amount.sql`

**Changes:**
1. Add `p_sim_amount NUMERIC` parameter to `fn_update_subscription_price`
2. Update subtotal: `v_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee + p_sim_amount`
3. Update `src/features/subscriptions/api.js` `updateSubscription()` to pass `sim_amount`

**Acceptance criteria:**
- [ ] Editing a subscription with sim_amount > 0 produces correct pending payment amounts

---

### Task 3.2 — Add static_ip_fee and sim_amount to bulk_update_subscription_prices (G10)

**File:** Same migration as Task 3.1

**Changes:**
1. Update subtotal: `v_subtotal_one := v_base_price + v_sms_fee + v_line_fee + v_static_ip_fee + v_sim_amount`
2. Read `static_ip_fee` and `sim_amount` from subscription row if not in payload

**Acceptance criteria:**
- [ ] Bulk price revision produces correct amounts for subscriptions with static_ip_fee or sim_amount

---

### Task 3.3 — Fix SubscriptionPricingCard display (G13)

**File:** `src/features/subscriptions/components/SubscriptionPricingCard.jsx` line 17

```js
// Before:
const subtotal = basePrice + smsFee + lineFee + staticIpFee;
// After:
const subtotal = basePrice + smsFee + lineFee + staticIpFee + (subscription.sim_amount || 0);
```

---

## Phase 4 — Data Integrity & Status Fixes

### Task 4.1 — Auto-update SIM status on subscription cancel/pause (G7)

**Option A (DB trigger — recommended):** Add to `fn_cancel_subscription` and create new function for pause:

```sql
-- Inside fn_cancel_subscription:
UPDATE sim_cards SET status = 'available'
WHERE id = v_sub.sim_card_id AND status = 'subscription';
```

**Option B (API-level):** Add SIM status update in `cancelSubscription()` and `pauseSubscription()` in `api.js`.

Recommend Option A — atomic, no race conditions.

**Acceptance criteria:**
- [ ] Cancelling a subscription sets linked SIM to 'available'
- [ ] Pausing a subscription sets linked SIM to 'available'
- [ ] Reactivating a subscription sets SIM back to 'subscription'

---

### Task 4.2 — Fix hardcoded VAT in finance triggers (G6)

**Files:** Migrations for `auto_record_proposal_revenue`, `auto_record_work_order_revenue`, `fn_subscription_payment_to_finance`, SIM triggers

**Change:** Replace `0.20` with dynamic rate:

```sql
-- For subscription trigger:
v_vat_rate := COALESCE(v_sub.vat_rate, 20);
v_output_vat := ROUND(v_amount * v_vat_rate / 100, 2);

-- For work order trigger:
v_vat_rate := COALESCE(NEW.vat_rate, 20);

-- For proposal trigger:
v_vat_rate := COALESCE(NEW.vat_rate, 20);
```

**Note:** `work_orders` and `proposals` tables may not have a `vat_rate` column. If not, default to 20 for now and add the column when needed.

---

### Task 4.3 — Clarify net/gross in expense entry UI (G8)

**File:** `src/features/finance/components/QuickEntryModal.jsx`

**Minimal fix:** Change label from "Tutar" to "Tutar (KDV Haric)":
- Update `src/locales/tr/finance.json` expense amount field label

**Better fix:** Add a toggle:
```
[ ] KDV Dahil giriyorum
```
When checked, recalculate: `netAmount = gross / (1 + vatRate/100)`

---

## Phase 5 — Polish & Edge Cases

### Task 5.1 — Make overage threshold configurable (G11)

**File:** `src/features/simCards/utils/compareInvoiceToInventory.js` line 26

Replace hardcoded `20` with a constant or parameter:

```js
const OVERAGE_ABSOLUTE_THRESHOLD = 20; // TRY
const OVERAGE_RELATIVE_THRESHOLD = 1.5; // 150% of cost
```

---

### Task 5.2 — Remove unused currencyEnum import (G14)

**File:** `src/features/finance/schema.js` line 3

```js
// Before:
import { isoDateString, currencyEnum } from '../../lib/zodHelpers';
// After:
import { isoDateString } from '../../lib/zodHelpers';
```

---

### Task 5.3 — Document proposal vs work order finance trigger flow (G12)

Add to `docs/CODING-LESSONS.md` or this file:

```
RULE: Work orders linked to proposals DO NOT create finance transactions.
Only the proposal completion trigger creates the income record.
If all WOs are completed but the proposal isn't marked complete,
check_proposal_completion should auto-complete it.
Monitor for proposals stuck in non-completed status with all WOs done.
```

---

### Task 5.4 — Fix parseFloat silent failures in Turkcell parser (G17)

**File:** `src/features/simCards/utils/parseTurkcellPdf.js`

Track unparseable values:

```js
const invoiceAmount = parseFloat(match[3]);
if (isNaN(invoiceAmount)) {
  parseErrors.push({ page: pageNum, hatNo, field: 'invoiceAmount', raw: match[3] });
}
```

---

### Task 5.5 — Excel date timezone edge case (G15)

**File:** `src/features/simCards/SimCardImportPage.jsx` line 25

Use UTC-safe date conversion for Excel serial dates. Consider using `xlsx` library's built-in date parsing with explicit timezone handling.

---

## Implementation Order Summary

| Order | Task | Severity | Effort | Dependencies |
|-------|------|----------|--------|-------------|
| 1 | 1.1 + 1.2 | CRITICAL | Medium | Pre-flight: verify backfill |
| 2 | 1.3 | HIGH | Small | After 1.1 (trigger fix) |
| 3 | 2.1 | HIGH | Small | None |
| 4 | 2.2 | HIGH | Medium | None |
| 5 | 3.1 + 3.2 | MEDIUM | Medium | None |
| 6 | 4.1 | MEDIUM | Small | None |
| 7 | 4.2 | MEDIUM | Medium | None |
| 8 | 3.3 | LOW | Tiny | None |
| 9 | 4.3 | MEDIUM | Small | None |
| 10 | 2.3 | LOW | Small | Business decision |
| 11 | 5.1-5.5 | LOW | Small each | None |

**Estimated total:** 6-8 focused sessions. Phase 1 alone fixes the most impactful bugs.
