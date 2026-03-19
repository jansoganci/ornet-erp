# Finance Module Audit Report

> **Date:** 2026-03-19
> **Auditor:** Claude (automated code audit)
> **Companion:** [SUBSCRIPTION_CALCULATION_AUDIT.md](./SUBSCRIPTION_CALCULATION_AUDIT.md)

---

## 1. Scope

### Modules Audited

| Module | Key Files | Focus |
|--------|-----------|-------|
| **Finance (Income)** | `IncomePage.jsx`, `api.js`, `hooks.js`, `QuickEntryModal.jsx` | Income query source, VAT formula, KPI accuracy |
| **Finance (Expense)** | `ExpensesPage.jsx`, `QuickEntryModal.jsx` | Expense query source, recurring expense visibility |
| **Finance (VAT)** | `VatReportPage.jsx`, `api.js:fetchVatReport()` | VAT data source, calculation method |
| **Finance (P&L)** | `api.js:fetchProfitAndLoss()`, `v_profit_and_loss` view | Revenue/expense aggregation, COGS |
| **Finance (Dashboard)** | `api.js:fetchFinanceDashboardKpis()` | KPI computation, MRR source |
| **Finance (Recurring)** | `recurringApi.js`, `fn_generate_recurring_expenses` | Template-to-transaction generation |
| **Subscriptions** | `subscriptions/api.js`, `paymentsApi.js`, `hooks.js` | Payment recording, monthly calc, VAT |
| **SIM Cards** | `view_sim_card_financials`, `compareInvoiceToInventory.js`, `parseTurkcellPdf.js` | Revenue view, invoice analysis, PDF parsing |
| **Work Orders** | `auto_record_work_order_revenue` trigger (00049) | Auto finance transaction on completion |
| **Proposals** | `auto_record_proposal_revenue` trigger (00045) | Auto finance transaction on completion |

### Database Objects Audited

| Object | Migration(s) | Purpose |
|--------|-------------|---------|
| `v_profit_and_loss` | 00043, 00050, 00070, 00071, 00073, 00090 | Unified income/expense view |
| `fn_record_payment` | 00098 | Atomic subscription payment recording |
| `fn_update_subscription_price` | 00098, 00142 | Atomic price update + payment recalc |
| `fn_subscription_payment_to_finance` | 00050 | Trigger: subscription payment -> financial_transactions |
| `generate_subscription_payments` | 00016, 00090, 00140, 00142, 00147 | Payment row generation |
| `fn_generate_recurring_expenses` | 00070, 00073 | Monthly recurring expense generation |
| `auto_record_proposal_revenue` | 00045 | Trigger: proposal completed -> income |
| `auto_record_work_order_revenue` | 00049 | Trigger: work order completed -> income + COGS |
| `view_sim_card_financials` | 00025 | SIM card revenue/cost aggregation |

---

## 2. What Works

### 2.1 Subscription Monthly Amount Formula

**Status:** Correct
**Location:** `supabase/migrations/00090_static_ip_feature.sql` lines 141-144

```sql
v_subtotal := v_sub.base_price + v_sub.sms_fee + v_sub.line_fee + v_sub.static_ip_fee;
v_vat := ROUND(v_subtotal * v_sub.vat_rate / 100, 2);
v_total := v_subtotal + v_vat;
```

All price fields are monthly NET (KDV haric). `static_ip_fee` correctly included. Billing frequency multiplier correctly applied.

### 2.2 Subscription VAT Calculation

**Status:** Correct everywhere

| Location | Formula |
|----------|---------|
| SQL migrations | `ROUND(subtotal * vat_rate / 100, 2)` |
| `fn_record_payment` (00098:65) | `ROUND(v_payment.amount * p_vat_rate / 100, 2)` |
| `PaymentRecordModal.jsx` | `Math.round(baseAmount * (rate/100) * 100) / 100` |
| `SubscriptionPricingCard.jsx` | `Math.round(subtotal * vatRate/100 * 100) / 100` |

VAT always applied to NET. Matches Turkish tax rules.

### 2.3 static_ip_fee Included in All Subscription Views

**Location:** `subscriptions_detail` (00090:61), `get_subscription_stats` MRR (00090:209), `fn_update_subscription_price` (00098:170)

### 2.4 QuickEntryModal VAT Formula

**Status:** Correct (assumes NET input)
**Location:** `src/features/finance/components/QuickEntryModal.jsx` lines 182-184 (expense), 206-208 (income)

```js
// Expense VAT:
Math.round(amount * (Number(data.vat_rate) || 20) / 100 * 100) / 100
// Evaluates to: round(amount * vatRate / 100, 2 decimals)
```

`vat_rate` is a percentage (0-100), validated by schema `z.number().min(0).max(100).default(20)`.

### 2.5 Proposal Completion -> Auto Finance Income

**Status:** Working
**Location:** `supabase/migrations/00045_auto_revenue_proposal_wo.sql`

Trigger `trg_auto_record_proposal_revenue` fires on `proposals.status -> 'completed'`. Creates income transaction with COGS from `proposal_items`. USD->TRY conversion. Idempotent.

### 2.6 Work Order Completion -> Auto Finance Income + COGS

**Status:** Working
**Location:** `supabase/migrations/00049_work_order_materials_finance_flow.sql`

Trigger fires on `work_orders.status -> 'completed'` (standalone only, skips proposal-linked). Creates income + COGS expense. Idempotent.

### 2.7 Recurring Expenses -> financial_transactions

**Status:** Working
**Location:** `supabase/migrations/00073_recurring_backend_cleanup.sql`, `fn_generate_recurring_expenses`

Inserts confirmed expense per active template. Idempotent per month. Respects soft-deleted templates. Visible on Expenses page via `recurring_template_id` filter.

### 2.8 Finance Dashboard, P&L, VAT Report

**Status:** Correct data source (but see G1 — double-counting)
**Location:** `src/features/finance/api.js` lines 305-324 (P&L), 327-366 (VAT), 369-431 (Dashboard)

All query `v_profit_and_loss` view. VAT report uses pre-computed `output_vat`/`input_vat` columns.

### 2.9 Subscription Payment -> financial_transactions Trigger

**Status:** Working
**Location:** `supabase/migrations/00050_subscription_payment_to_finance.sql`

Trigger `trg_subscription_payment_to_finance` fires on `subscription_payments.status -> 'paid'`. Creates income + COGS expense transactions. Idempotent via `subscription_payment_id`. Backfill included.

### 2.10 Turkcell PDF Parser

**Status:** Working with caveats
**Location:** `src/features/simCards/utils/parseTurkcellPdf.js`

- Regex: `F2-(\\d{10})\\?([^#]*)#([\\d.]+)\\$([\\d.]+)\\+([\\d.]+)!([\\d.]+)`
- Extracts hatNo, tariff, invoiceAmount, kdv, oiv, total per line
- `totalInvoiceAmount` = sum of NET (correct)
- Per-page error handling with `parseErrors[]` — partial results allowed
- `LINE_REGEX.lastIndex` reset per page (line 51) — correct

---

## 3. What's Broken / Missing

### CRITICAL

#### G1 — Subscription Revenue DOUBLE-COUNTED in v_profit_and_loss

**Severity:** CRITICAL
**Location:** `v_profit_and_loss` view (migration 00090) + trigger `fn_subscription_payment_to_finance` (migration 00050)

**Root cause:** Two conflicting data paths exist for subscription income:

1. **Migration 00050** created trigger `fn_subscription_payment_to_finance` that inserts into `financial_transactions` when a payment is marked paid. It also rewrote `v_profit_and_loss` to query only `financial_transactions`.

2. **Migration 00070** reverted `v_profit_and_loss` to UNION `subscription_payments` directly alongside `financial_transactions`. This was carried forward through 00071, 00073, and 00090.

**Current state (migration 00090):**
```
v_profit_and_loss =
  subscription_payments WHERE status='paid'         ← source_type='subscription'
  UNION ALL
  financial_transactions WHERE direction='income'   ← includes income_type='subscription' from trigger
  UNION ALL
  financial_transactions WHERE direction='expense'
```

Both the direct `subscription_payments` rows AND the trigger-created `financial_transactions` rows appear as subscription income. **Every paid subscription payment is counted twice.**

**Impact:** All these are wrong:
- P&L reports (`/finance/reports`) — revenue ~2x
- Finance Dashboard KPIs (`/finance`) — revenue, net profit, margins
- VAT report (`/finance/vat`) — output_vat ~2x
- Revenue vs Expense chart
- Expense by category (subscription COGS also double-counted)

**Fix:** Remove the `subscription_payments` UNION from `v_profit_and_loss`. The trigger already creates `financial_transactions` rows, so the view should query only `financial_transactions`.

---

#### G2 — v_profit_and_loss does NOT filter deleted_at

**Severity:** CRITICAL
**Location:** `v_profit_and_loss` view (migration 00090), `financial_transactions` portions

```sql
-- Current:
FROM financial_transactions ft
WHERE ft.direction = 'income'
  AND (ft.status = 'confirmed' OR ft.status IS NULL)
-- Missing: AND ft.deleted_at IS NULL
```

**Impact:** Soft-deleted transactions (via `soft_delete_transaction` RPC in 00107) may still appear in P&L, dashboard, and VAT reports. Users delete a transaction but totals don't change.

**Mitigation note:** RLS policy `ft_select` includes `deleted_at IS NULL`, and the view is `SECURITY INVOKER` (00102), so RLS may filter these in practice. But the view should still explicitly filter for safety and clarity.

**Fix:** Add `AND ft.deleted_at IS NULL` to both income and expense portions.

---

### HIGH

#### G3 — SIM financial view excludes subscription-linked SIMs

**Severity:** HIGH
**Location:** `view_sim_card_financials` (migration 00025, line 23)

```sql
FROM sim_cards WHERE status = 'active';
```

SIMs linked to subscriptions have `status = 'subscription'`, not `'active'`.

**Impact:** `total_monthly_revenue` and `total_monthly_profit` on the SIM Cards dashboard exclude all subscription-linked SIMs. Revenue understated.

**Fix:** `WHERE status IN ('active', 'subscription')`

---

#### G4 — Null cost_price treated as zero in invoice analysis

**Severity:** HIGH
**Location:** `src/features/simCards/utils/compareInvoiceToInventory.js`

**Line 74:**
```js
const costPrice = simCard.cost_price || 0;  // null → 0
```

**Line 24-27:**
```js
function isOverage(invoiceAmount, costPrice) {
  if (!costPrice || costPrice <= 0) return false;   // silently skips null-cost SIMs
  return invoiceAmount > costPrice * 1.5 && invoiceAmount > costPrice + 20;
}
```

**Impact:** When `cost_price` is null:
- `priceDiff = invoiceAmount - 0` = always positive (looks fine)
- `isOverage` = always false (short-circuits at line 25)
- `profit = salePrice - invoiceAmount` still works if salePrice exists
- But real cost is unknown — a SIM costing 50 TRY/month with null cost_price shows 0 cost and masks losses entirely

**Fix:** Track null `cost_price` as a separate `unknown_cost` category. Flag in UI with a warning banner.

---

#### G5 — v_profit_and_loss COGS wrong for 3_month billing

**Severity:** HIGH
**Location:** `v_profit_and_loss` (00090:279-282) + `fn_subscription_payment_to_finance` (00050:69-75)

```sql
CASE
  WHEN sub.billing_frequency = 'yearly' THEN (sub.cost + sub.static_ip_cost) * 12
  WHEN sub.billing_frequency = '6_month' THEN (sub.cost + sub.static_ip_cost) * 6
  ELSE (sub.cost + sub.static_ip_cost)   -- 3_month falls here → 1x instead of 3x
END AS cogs_try
```

**Impact:** 3-month billing subscriptions have COGS understated by 2/3. Gross margin appears higher than reality.

**Fix:** Add `WHEN sub.billing_frequency = '3_month' THEN (sub.cost + sub.static_ip_cost) * 3`

---

### MEDIUM

#### G6 — Hardcoded 20% VAT in work order and proposal finance triggers

**Severity:** MEDIUM
**Location:**
- `auto_record_proposal_revenue` (00045:93): `ROUND(v_amount_try * 0.20, 2)`
- `auto_record_work_order_revenue` (00049:89): `ROUND(v_amount_try * 0.20, 2)`
- `fn_subscription_payment_to_finance` (00050:90): `vat_rate = 20`
- SIM card finance triggers (00061): `ROUND(sale_price * 0.20, 2)`

**Impact:** Non-standard VAT rates (0% exports, 10% certain services) stored with wrong VAT.

**Fix:** Read `vat_rate` from related record. Fall back to 20 if not available.

---

#### G7 — SIM status not auto-updated when subscription cancelled/paused

**Severity:** MEDIUM
**Location:** `src/features/subscriptions/api.js` — `cancelSubscription()` (line 389), `pauseSubscription()` (line 352)

**Impact:** Cancelled/paused subscriptions leave SIMs stuck in `'subscription'` status. Cannot be reassigned.

**Fix:** Add `UPDATE sim_cards SET status='available' WHERE id = subscription.sim_card_id` inside cancel/pause DB functions.

---

#### G8 — Net vs gross ambiguity in expense entry

**Severity:** MEDIUM
**Location:** `src/features/finance/components/QuickEntryModal.jsx`

Amount field label says "Tutar" with no indication of NET or GROSS. Formula treats as NET.

**Impact:** Users entering gross amounts from invoices cause VAT double-calculation.

**Fix:** Label as "Tutar (KDV Haric)" or add net/gross toggle with recalculation.

---

#### G9 — fn_update_subscription_price missing sim_amount

**Severity:** MEDIUM
**Location:** `supabase/migrations/00142_drop_subscription_type.sql` lines 326-327

```sql
v_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee;
-- Missing: + p_sim_amount
```

**Impact:** Price edits on subscriptions with `sim_amount > 0` produce wrong pending payment amounts.

**Fix:** Add `p_sim_amount` parameter, include in subtotal. Update API to pass `sim_amount`.

---

#### G10 — bulk_update_subscription_prices missing static_ip_fee and sim_amount

**Severity:** MEDIUM
**Location:** `supabase/migrations/00142_drop_subscription_type.sql` lines 422-424

```sql
v_subtotal_one := v_base_price + v_sms_fee + v_line_fee;
-- Missing: + static_ip_fee + sim_amount
```

**Impact:** Bulk price revision creates wrong payment amounts for subscriptions with those fees.

**Fix:** Add both fields to subtotal and update payload.

---

#### G11 — Hardcoded 20 TRY overage threshold in invoice analysis

**Severity:** MEDIUM
**Location:** `src/features/simCards/utils/compareInvoiceToInventory.js` line 26

```js
return invoiceAmount > costPrice * 1.5 && invoiceAmount > costPrice + 20;
```

The `20` TRY threshold is hardcoded. As costs change over time, this threshold may become irrelevant.

**Impact:** Low-cost SIMs near the threshold may be misclassified.

**Fix:** Make the threshold configurable or proportional.

---

### LOW

#### G12 — Work orders completed with linked proposal may skip finance

**Severity:** LOW
**Location:** `auto_record_work_order_revenue` (00049:31-33)

```sql
IF NEW.proposal_id IS NOT NULL THEN
  RETURN NEW;  -- relies on proposal trigger
END IF;
```

If proposal never reaches `'completed'` but its WOs are all done, no income recorded.

**Impact:** Edge case — depends on `check_proposal_completion` working correctly.

---

#### G13 — SubscriptionPricingCard missing sim_amount

**Severity:** LOW
**Location:** `src/features/subscriptions/components/SubscriptionPricingCard.jsx` line 17

```js
const subtotal = basePrice + smsFee + lineFee + staticIpFee;
// Missing: + (subscription.sim_amount || 0)
```

Display-only bug. Shows wrong subtotal/VAT/total for subscriptions with sim_amount.

---

#### G14 — Unused currencyEnum import in finance schema

**Severity:** LOW
**Location:** `src/features/finance/schema.js` line 3

```js
import { isoDateString, currencyEnum } from '../../lib/zodHelpers';
```

`currencyEnum` is imported but never used.

---

#### G15 — Excel date timezone offset in SIM import

**Severity:** LOW
**Location:** `src/features/simCards/SimCardImportPage.jsx` line 25

Excel serial dates converted with timezone offset adjustment may produce wrong dates in edge cases.

---

#### G16 — Invoice duplicate hatNo handling — silent overwrite

**Severity:** LOW
**Location:** `src/features/simCards/utils/compareInvoiceToInventory.js` lines 42-50

When building the invoice map, duplicate `hatNo` entries overwrite silently (last wins). Duplicates are tracked in `duplicateHatNos[]` for UI warning, but the financial comparison uses only the last value.

**Impact:** If a SIM appears on multiple invoice lines (split billing, plan changes), only the last line's amount is compared.

---

#### G17 — parseFloat failures default to 0 in Turkcell parser

**Severity:** LOW
**Location:** `src/features/simCards/utils/parseTurkcellPdf.js` lines 50-66

Malformed amounts silently become 0 via `parseFloat(x) || 0`. No null tracking for unparseable values.

---

## 4. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MONEY EVENTS IN THE APP                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Subscription Payment    Proposal Completed    Work Order Done       │
│  (useRecordPayment)      (status→completed)    (status→completed)   │
│         │                       │                     │              │
│         ▼                       ▼                     ▼              │
│  fn_record_payment       trg_auto_record_      auto_record_         │
│  (UPDATE sub_payments)   proposal_revenue      work_order_revenue   │
│         │                       │                     │              │
│         ▼                       │                     │              │
│  trg_subscription_              │                     │              │
│  payment_to_finance             │                     │              │
│         │                       │                     │              │
│         ▼                       ▼                     ▼              │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │             financial_transactions TABLE                    │      │
│  │  income_type: subscription | sale | service | sim_rental   │      │
│  └────────────────────┬───────────────────────────────────────┘      │
│                       │                                              │
│  ┌────────────────────▼───────────────────────────────────────┐      │
│  │             v_profit_and_loss VIEW                          │      │
│  │  BUG: ALSO unions subscription_payments directly            │      │
│  │  → DOUBLE-COUNTING subscription revenue (G1)               │      │
│  └────────────────────┬───────────────────────────────────────┘      │
│                       │                                              │
│           ┌───────────┼───────────┬──────────────┐                   │
│           ▼           ▼           ▼              ▼                   │
│      Dashboard    P&L Report   VAT Report   Recent TX                │
│       (2x !)       (2x !)       (2x !)                               │
│                                                                      │
│  Recurring Expense Templates                                         │
│         │                                                            │
│         ▼                                                            │
│  fn_generate_recurring_expenses → financial_transactions (expense)   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                       PAGE DATA SOURCES                              │
├──────────────────┬─────────────────────────┬─────────────────────────┤
│ Page             │ Data Source              │ Shows Sub Revenue?      │
├──────────────────┼─────────────────────────┼─────────────────────────┤
│ Income Page      │ financial_transactions   │ YES (via 00050 trigger) │
│ Expenses Page    │ financial_transactions   │ COGS yes (via trigger)  │
│ Finance Dashboard│ v_profit_and_loss        │ YES but 2x (G1)        │
│ P&L Reports      │ v_profit_and_loss        │ YES but 2x (G1)        │
│ VAT Report       │ v_profit_and_loss        │ YES but 2x (G1)        │
│ SIM Dashboard    │ view_sim_card_financials │ NO (status filter, G3)  │
└──────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 5. SIM Card Invoice Analysis — Detailed Flow

**File:** `src/features/simCards/utils/compareInvoiceToInventory.js`

### Step-by-step:

1. **Phone normalization** (lines 11-17) — Strips `+90` or leading `0` to get 10-digit format. Returns null for unrecognizable numbers.

2. **Build invoice map** (lines 42-50) — Keys by `hatNo`. Duplicate handling: last occurrence wins (silent overwrite). Duplicates tracked in `duplicateHatNos[]` for UI warning.

3. **Build inventory map** (lines 54-63) — Normalizes each `phone_number` from DB. Cards that don't normalize are pushed to `unresolvableCards[]` and excluded.

4. **Match & calculate** (lines 65-96):
   ```
   priceDiff = invoiceAmount - costPrice
   profit    = salePrice - invoiceAmount
   isLoss    = profit < 0
   isOverage = (invoiceAmount > costPrice * 1.5) AND (invoiceAmount > costPrice + 20)
   ```

5. **Categorize unmatched** — Invoice lines without inventory match → `invoiceOnly`. Inventory without match → `inventoryOnly`.

6. **Summary totals** (lines 104-123) — Sums across matched records only.

### Known issues in this flow:
- **G4**: `costPrice` null → 0 masks losses
- **G11**: Hardcoded 20 TRY overage threshold
- **G16**: Duplicate hatNo silent overwrite

---

## 6. SIM Card Status Tracking

### Status values (QuickStatusSelect.jsx):

| Status | Meaning | Allowed transitions |
|--------|---------|-------------------|
| `active` | In use at customer site | → available, cancelled |
| `subscription` | Linked to subscription contract | None (locked in UI) |
| `available` | Ready for assignment | → active, subscription |
| `cancelled` | Deactivated | → available |
| `inactive` | Not in use | → available |
| `sold` | Transferred out | Terminal |

### Gap (G7):
When a subscription is cancelled/paused, the linked SIM's status is NOT automatically changed back to `'available'`. Orphaned `'subscription'`-status SIMs cannot be manually changed or reassigned.

---

## 7. Rounding & Currency

- **SQL:** `ROUND(value, 2)` — consistent
- **JS:** `Math.round(value * 100) / 100` — equivalent
- **USD → TRY:** `ROUND(amount_original * exchange_rate, 2)` — correct
- **VAT on converted amounts:** Computed on `amount_try` (TRY) — correct per Turkish tax law
- **No floating-point drift** detected

---

## 8. File Reference

| File | Role |
|------|------|
| `src/features/finance/api.js` | All finance queries (transactions, P&L, VAT, dashboard) |
| `src/features/finance/hooks.js` | React Query hooks for finance data |
| `src/features/finance/schema.js` | Zod schemas for transaction/income/expense forms |
| `src/features/finance/components/QuickEntryModal.jsx` | Manual income/expense entry with VAT calc |
| `src/features/finance/IncomePage.jsx` | Income list (queries financial_transactions) |
| `src/features/finance/ExpensesPage.jsx` | Expense list (queries financial_transactions) |
| `src/features/finance/VatReportPage.jsx` | VAT report (queries v_profit_and_loss) |
| `src/features/finance/recurringApi.js` | Recurring expense template CRUD |
| `src/features/subscriptions/api.js` | Subscription CRUD, price updates |
| `src/features/subscriptions/paymentsApi.js` | Payment recording (fn_record_payment RPC) |
| `src/features/subscriptions/hooks.js` | React Query hooks (invalidates finance keys) |
| `src/features/simCards/utils/compareInvoiceToInventory.js` | Invoice-to-inventory comparison |
| `src/features/simCards/utils/parseTurkcellPdf.js` | Turkcell PDF parsing |
| `src/features/simCards/SimCardImportPage.jsx` | SIM card Excel import |
| `src/features/subscriptions/components/SubscriptionPricingCard.jsx` | Pricing display |
| `supabase/migrations/00025_sim_card_financial_views.sql` | view_sim_card_financials |
| `supabase/migrations/00045_auto_revenue_proposal_wo.sql` | Proposal -> income trigger |
| `supabase/migrations/00049_work_order_materials_finance_flow.sql` | Work order -> income + COGS trigger |
| `supabase/migrations/00050_subscription_payment_to_finance.sql` | Sub payment -> financial_transactions trigger |
| `supabase/migrations/00090_static_ip_feature.sql` | v_profit_and_loss (current), static_ip_fee |
| `supabase/migrations/00098_atomic_record_payment.sql` | fn_record_payment, fn_update_subscription_price |
| `supabase/migrations/00107_soft_delete_transaction_rpc.sql` | Soft delete RPC + RLS policies |
| `supabase/migrations/00142_drop_subscription_type.sql` | fn_update_subscription_price, bulk_update |
