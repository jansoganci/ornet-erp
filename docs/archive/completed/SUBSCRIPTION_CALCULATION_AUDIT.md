# Subscription, SIM Card & Financial Transaction Calculation Audit

> **Date:** 2026-03-19  
> **Scope:** Subscription billing, VAT (KDV) formulas, SIM card calculations, financial transactions

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|------|
| **VAT formula** | ✅ Correct | VAT applied to NET amount everywhere |
| **Monthly total** | ✅ Correct | Total = Base (NET) + VAT |
| **Rounding** | ✅ Consistent | 2 decimal places (ROUND(..., 2) / `* 100) / 100`) |
| **Subscription subtotal** | ⚠️ Inconsistencies | `sim_amount` / `static_ip_fee` missing in some code paths |
| **v_profit_and_loss COGS** | ❌ Bug | `3_month` billing uses 1× cost instead of 3× |
| **SIM / Financial VAT** | ⚠️ Hardcoded | 20% used in triggers; no `vat_rate` from config |

---

## 2. Subscription Calculation Logic

### 2.1 Intended Business Logic

**Monthly Total = Base Price (NET) + VAT**

- All price fields (`base_price`, `sms_fee`, `line_fee`, `static_ip_fee`, `sim_amount`) are stored as **monthly NET** amounts (KDV hariç).
- VAT is calculated on the subtotal: `VAT = subtotal × vat_rate / 100`
- Gross total: `total = subtotal + VAT`

### 2.2 Subtotal Formula (Correct Implementation)

```
subtotal = base_price + sms_fee + line_fee + static_ip_fee + sim_amount
vat_amount = ROUND(subtotal × vat_rate / 100, 2)
total_amount = subtotal + vat_amount
```

**Used correctly in:**
- `generate_subscription_payments()` (00142, 00140, 00147, etc.)
- `extend_active_subscription_payments()`
- `ensure_payments_for_year` / `generate_payments_until_2040`
- `subscriptions_detail` view
- `SubscriptionsListPage.jsx` (list totals)
- `bulk_import_subscriptions`

### 2.3 VAT Application — Correct

VAT is **always applied to the NET amount** (subtotal), never to gross. This matches Turkish tax rules (KDV net tutar üzerinden hesaplanır).

| Location | Formula | Correct? |
|----------|---------|----------|
| SQL migrations | `ROUND(subtotal * vat_rate / 100, 2)` | ✅ |
| PaymentRecordModal.jsx | `Math.round(baseAmount * (rate/100) * 100) / 100` | ✅ |
| SubscriptionPricingCard.jsx | `Math.round(subtotal * vatRate/100 * 100) / 100` | ✅ |
| fn_record_payment | `ROUND(amount * p_vat_rate / 100, 2)` | ✅ |

### 2.4 Billing Frequency Multipliers

| Frequency | Multiplier | Payment records/year |
|-----------|------------|----------------------|
| monthly | 1 | 12 |
| 3_month | 3 | 4 |
| 6_month | 6 | 2 |
| yearly | 12 | 1 |

Payment amount per record = `subtotal × multiplier`, VAT = `vat_amount × multiplier`, total = `total_amount × multiplier`.

---

## 3. Inconsistencies & Bugs

### 3.1 ❌ `fn_update_subscription_price` — Missing `sim_amount`

**File:** `supabase/migrations/00142_drop_subscription_type.sql` (lines 326–327)

When a user edits subscription prices via the form, pending payments are recalculated by this function. It does **not** include `sim_amount`:

```sql
v_subtotal := p_base_price + p_sms_fee + p_line_fee + p_static_ip_fee;
-- Missing: + p_sim_amount
```

**Impact:** Subscriptions with `sim_amount > 0` will have pending payment amounts understated after a price edit.

**Fix:** Add `p_sim_amount` parameter and include it in `v_subtotal`. Update the form/API to pass `sim_amount`.

---

### 3.2 ❌ `bulk_update_subscription_prices` — Missing `sim_amount` and `static_ip_fee`

**File:** `supabase/migrations/00142_drop_subscription_type.sql` (lines 422–424)

Price revision page uses this RPC. It only uses `base_price`, `sms_fee`, `line_fee`:

```sql
v_subtotal_one := v_base_price + v_sms_fee + v_line_fee;
-- Missing: + static_ip_fee + sim_amount
```

**Impact:** After bulk price revision, pending payments for subscriptions with `static_ip_fee` or `sim_amount` will be wrong.

**Fix:** Add `static_ip_fee` and `sim_amount` to the update payload and to `v_subtotal_one`.

---

### 3.3 ⚠️ `SubscriptionPricingCard` — Missing `sim_amount`

**File:** `src/features/subscriptions/components/SubscriptionPricingCard.jsx` (line 17)

```javascript
const subtotal = basePrice + smsFee + lineFee + staticIpFee;
// Missing: + (subscription.sim_amount || 0)
```

**Impact:** UI shows incorrect subtotal/VAT/total for subscriptions with `sim_amount > 0`.

**Fix:** Add `sim_amount` to the subtotal calculation.

---

### 3.4 ❌ `v_profit_and_loss` — Wrong COGS for `3_month` Billing

**File:** `supabase/migrations/00090_static_ip_feature.sql` (lines 279–282)

```sql
CASE
  WHEN sub.billing_frequency = 'yearly' THEN (sub.cost + sub.static_ip_cost) * 12
  WHEN sub.billing_frequency = '6_month' THEN (sub.cost + sub.static_ip_cost) * 6
  ELSE (sub.cost + sub.static_ip_cost)   -- 3_month and monthly both get ×1
END AS cogs_try
```

For `3_month`, each payment covers 3 months, so COGS should be `(cost + static_ip_cost) × 3`. Currently it uses `× 1`.

**Impact:** Gross margin and P&L are wrong for 3‑month subscriptions (COGS understated).

**Fix:** Add explicit branch:
```sql
WHEN sub.billing_frequency = '3_month' THEN (sub.cost + sub.static_ip_cost) * 3
```

---

## 4. Rounding & Currency

### 4.1 Rounding — Consistent

- **SQL:** `ROUND(value, 2)` everywhere
- **JS:** `Math.round(value * 100) / 100`
- No evidence of floating‑point drift in normal usage.

### 4.2 Currency Conversion

- **TRY:** No conversion; `amount_try = amount_original`
- **USD:** `amount_try = ROUND(amount_original × exchange_rate, 2)`
- VAT is always computed on `amount_try` (converted amount), which is correct.

### 4.3 Potential Edge Case

When `vat_amount` is rounded per month and then multiplied (e.g. `v_vat × 12`), the result is the sum of 12 rounded values. This is intentional and matches “round per line item” accounting. No change needed.

---

## 5. SIM Card Calculations

### 5.1 Turkcell PDF Parser (`parseTurkcellPdf.js`)

- **Purpose:** Extract line data from invoice PDFs
- **Output:** `invoiceAmount`, `kdv`, `oiv`, `total` per line — **no calculation**, only parsing
- **totalInvoiceAmount:** Sum of `invoiceAmount` (NET), not `total` — correct for invoice totals

### 5.2 SIM Rental Income (Trigger)

**File:** `supabase/migrations/00061_fix_sim_card_to_finance_logic.sql`

- `amount_try = sale_price` (NET)
- `output_vat = ROUND(sale_price × 0.20, 2)` — **hardcoded 20%**
- VAT on NET ✅

### 5.3 SIM Operator Expense (Trigger)

- `amount_try = cost_price` (NET)
- `input_vat = ROUND(cost_price × 0.20, 2)` — **hardcoded 20%**
- VAT on NET ✅

### 5.4 Subscription vs SIM Revenue

- **Subscription‑linked SIMs:** Revenue via `subscriptions.line_fee` or `sim_amount`; no separate SIM rental transaction (avoids double‑counting).
- **Wholesale SIMs:** `sale_price` creates `sim_rental` income when status = `active` and site has no active subscription.

---

## 6. Financial Transactions

### 6.1 Manual Entry (QuickEntryModal)

- **Income:** `output_vat = amount_try × (vat_rate/100)` when `should_invoice`
- **Expense:** `input_vat = amount_try × (vat_rate/100)` when `has_invoice`
- Uses `vat_rate` from form (default 20%) ✅

### 6.2 Auto-Generated Transactions

| Source | amount_try | output_vat / input_vat | vat_rate |
|--------|------------|------------------------|----------|
| Proposal completion | Converted from USD | `ROUND(amount_try × 0.20, 2)` | Hardcoded 20% |
| Work order completion | From materials | `ROUND(amount_try × 0.20, 2)` | Hardcoded 20% |
| SIM card activation | sale_price | `ROUND(sale_price × 0.20, 2)` | Hardcoded 20% |
| Subscription payment → finance | NEW.amount | COALESCE(NEW.vat_amount, 0) | 20 (ignores payment_vat_rate) |

**Note:** Subscription payments store `vat_amount` and `payment_vat_rate` when recorded. The trigger uses `NEW.vat_amount` (correct) but hardcodes `vat_rate = 20` in the `financial_transactions` row. If a subscription uses a different VAT rate, the stored `vat_rate` will be wrong, though P&L uses `output_vat` from the payment, so the numbers are still correct.

### 6.3 Subscription Payment → Finance Flow

When a subscription payment is marked `paid`:
1. Trigger `fn_subscription_payment_to_finance` creates income + COGS expense
2. `amount_try` = `NEW.amount` (NET from `subscription_payments`)
3. `output_vat` = `NEW.vat_amount` (from payment record)
4. COGS = `cost × multiplier` (yearly: 12, 6_month: 6, else: 1 — **3_month falls into else = 1**, same bug as v_profit_and_loss; should be 3)

---

## 7. Recommendations

| Priority | Item | Action |
|----------|------|--------|
| **High** | v_profit_and_loss COGS for 3_month | Add `WHEN '3_month' THEN * 3` |
| **High** | fn_update_subscription_price | Add `sim_amount` to params and subtotal |
| **High** | bulk_update_subscription_prices | Add `static_ip_fee` and `sim_amount` |
| **Medium** | SubscriptionPricingCard | Include `sim_amount` in subtotal |
| **Low** | SIM/finance triggers | Consider configurable `vat_rate` instead of 20 |
| **Medium** | fn_subscription_payment_to_finance (00050) | Add `WHEN '3_month' THEN 3` for COGS multiplier; optionally use `payment_vat_rate` |

---

## 8. File Reference

| File | Role |
|------|------|
| `supabase/migrations/00142_drop_subscription_type.sql` | fn_update_subscription_price, bulk_update_subscription_prices |
| `supabase/migrations/00140_add_sim_amount_to_subscriptions.sql` | generate_subscription_payments, subscriptions_detail |
| `supabase/migrations/00090_static_ip_feature.sql` | v_profit_and_loss (COGS) |
| `supabase/migrations/00098_atomic_record_payment.sql` | fn_record_payment |
| `supabase/migrations/00050_subscription_payment_to_finance.sql` | Subscription → financial_transactions trigger |
| `supabase/migrations/00061_fix_sim_card_to_finance_logic.sql` | SIM → financial_transactions trigger |
| `src/features/subscriptions/components/PaymentRecordModal.jsx` | Payment recording UI (VAT calc) |
| `src/features/subscriptions/components/SubscriptionPricingCard.jsx` | Pricing display |
| `src/features/finance/components/QuickEntryModal.jsx` | Manual income/expense (VAT calc) |
| `src/features/simCards/utils/parseTurkcellPdf.js` | Turkcell PDF parsing |
