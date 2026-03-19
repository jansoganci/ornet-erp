# Implementation Plan: `payment_start_month` Field

> **Goal:** Add `payment_start_month` (INTEGER 1-12) as the sole source of truth for payment cycle scheduling in non-monthly subscriptions.
> **Date:** 2026-03-17

---

## Background

`start_date` is unreliable for calculating payment cycles because historical payment schedules were agreed upon separately and don't match `start_date`. A new `payment_start_month` field will anchor payment generation for 3-month, 6-month, and yearly subscriptions.

### Rules
| Frequency | `payment_start_month` | Behavior |
|---|---|---|
| monthly | ignored (null) | Charges every month, no anchor needed |
| 3_month | **required** (1-12) | First payment = that month, then every 3 months |
| 6_month | **required** (1-12) | First payment = that month, then every 6 months |
| yearly | **required** (1-12) | First payment = that month, then every 12 months |

---

## Step-by-Step Plan (8 steps)

### STEP 1 — Database Migration
**File:** `supabase/migrations/00143_add_payment_start_month.sql`

**What it does:**
1. `ALTER TABLE subscriptions ADD COLUMN payment_start_month INTEGER CHECK (1-12)`
2. Backfill existing non-monthly subscriptions from `start_date` month
3. Replace `generate_subscription_payments()` — use `payment_start_month` as anchor for non-monthly
4. Update `extend_active_subscription_payments()` — fallback anchor uses `payment_start_month`
5. Update `bulk_import_subscriptions()` — accept `payment_start_month` in INSERT
6. Update `fn_update_subscription_price()` — no change needed (doesn't touch scheduling)
7. Update `bulk_update_subscription_prices()` — no change needed
8. Recreate `subscriptions_detail` view — add `payment_start_month` to SELECT

**Key anchor logic in `generate_subscription_payments`:**
```sql
-- For monthly: use p_start_date or start_date as-is (truncated to month)
-- For non-monthly with payment_start_month:
--   anchor_year = EXTRACT(YEAR FROM COALESCE(p_start_date, start_date))
--   v_start = make_date(anchor_year, payment_start_month, 1)
```

**Key change in `extend_active_subscription_payments` fallback:**
```sql
-- When no existing payments found (v_last_month IS NULL):
-- OLD: v_last_month = start_date - interval
-- NEW: if non-monthly + payment_start_month exists:
--        v_last_month = make_date(year_from_start_date, payment_start_month, 1) - interval
--      else:
--        v_last_month = start_date - interval (original fallback)
```

**Columns preserved in pricing calculation:**
- `base_price + sms_fee + line_fee + static_ip_fee + sim_amount` (subtotal)
- VAT calculated from `vat_rate`
- Multiplier applied per frequency (1/3/6/12)
- All 3 amounts stored: `amount`, `vat_amount`, `total_amount`

**View update:** `subscriptions_detail` already uses `sub.*` so the column appears automatically, but we recreate the view to be explicit.

---

### STEP 2 — Zod Schema
**File:** `src/features/subscriptions/schema.js`

**Changes:**
1. Add field to `subscriptionSchema`:
   ```js
   payment_start_month: z.preprocess(toNumber,
     z.number().int().min(1).max(12).nullable().optional()
   )
   ```
   Uses `preprocess(toNumber)` to match existing numeric field pattern.

2. Add `.refine()` for conditional validation:
   ```js
   .refine(
     (data) => {
       if (['3_month', '6_month', 'yearly'].includes(data.billing_frequency)) {
         return data.payment_start_month != null;
       }
       return true;
     },
     { message: i18n.t('subscriptions:validation.paymentStartMonthRequired'),
       path: ['payment_start_month'] }
   )
   ```

3. Add `payment_start_month: null` to `subscriptionDefaultValues`.

---

### STEP 3 — Subscription Form UI
**File:** `src/features/subscriptions/SubscriptionFormPage.jsx`

**Changes:**
1. Watch `billing_frequency`:
   ```js
   const watchedFrequency = watch('billing_frequency');
   ```
2. Add month selector after the billing_frequency Select (around line 381):
   ```jsx
   {watchedFrequency !== 'monthly' && (
     <Select
       label={t('subscriptions:form.fields.paymentStartMonth')}
       options={monthOptions}
       error={errors.payment_start_month?.message}
       className="rounded-xl"
       {...register('payment_start_month')}
     />
   )}
   ```
3. Build `monthOptions` from existing `notifications:months` translations (keys "1"-"12").
4. Add `useEffect` to reset `payment_start_month` to `null` when frequency changes to `'monthly'`.
5. Include `payment_start_month` in the data sent to create/update API.

---

### STEP 4 — Excel Parser
**File:** `src/features/subscriptions/importUtils.js`

**4a. Add header** to `TEMPLATE_HEADERS` after `'ODEME SIKLIGI'`:
```js
'ODEME NOTU',
```

**4b. Add Turkish month parser** (after `BILLING_FREQUENCY_MAP`):
```js
const TURKISH_MONTH_MAP = {
  'ocak': 1, 'january': 1,
  'şubat': 2, 'subat': 2, 'february': 2,
  'mart': 3, 'march': 3,
  'nisan': 4, 'april': 4,
  'mayıs': 5, 'mayis': 5, 'may': 5,
  'haziran': 6, 'june': 6,
  'temmuz': 7, 'july': 7,
  'ağustos': 8, 'agustos': 8, 'august': 8,
  'eylül': 9, 'eylul': 9, 'september': 9,
  'ekim': 10, 'october': 10,
  'kasım': 11, 'kasim': 11, 'november': 11,
  'aralık': 12, 'aralik': 12, 'december': 12,
};

function parsePaymentStartMonth(raw) {
  if (!raw) return null;
  const normalized = raw.toString().toLowerCase().trim();
  if (TURKISH_MONTH_MAP[normalized]) return TURKISH_MONTH_MAP[normalized];
  const firstWord = normalized.split(/[\s,\/\-]+/)[0];
  return TURKISH_MONTH_MAP[firstWord] ?? null;
}
```

**4c. In `validateAndMapRows()`**, after billing_frequency parsing:
```js
const paymentNoteRaw = get('ODEME NOTU');
const payment_start_month = parsePaymentStartMonth(paymentNoteRaw);

if (billing_frequency !== 'monthly' && payment_start_month === null) {
  errors.push({
    rowIndex, field: 'ODEME NOTU',
    message: 'required_for_non_monthly', rowNum
  });
}
```

**4d. Add to row object:**
```js
payment_start_month: billing_frequency !== 'monthly' ? payment_start_month : null,
```

**4e. Update template example row** to include `'OCAK'` for ODEME NOTU.

---

### STEP 5 — Import API
**File:** `src/features/subscriptions/importApi.js`

Add to `rpcItems.push()` (line ~113):
```js
payment_start_month: row.payment_start_month ?? null,
```

---

### STEP 6 — Detail Page
**File:** `src/features/subscriptions/SubscriptionDetailPage.jsx`

Add below the `billingFrequency` row (around line 305), using the existing inline pattern:
```jsx
{subscription.billing_frequency !== 'monthly' &&
  subscription.payment_start_month && (
  <div className="flex items-center justify-between">
    <span className="text-xs text-neutral-500">
      {t('subscriptions:detail.fields.paymentStartMonth')}
    </span>
    <span className="font-medium text-neutral-900 dark:text-neutral-100">
      {t(`notifications:months.${subscription.payment_start_month}`)}
    </span>
  </div>
)}
```

---

### STEP 7 — Translations
**File:** `src/locales/tr/subscriptions.json`

Add to `form.fields`:
```json
"paymentStartMonth": "Ödeme Başlangıç Ayı"
```

Add to `detail.fields`:
```json
"paymentStartMonth": "Ödeme Başlangıç Ayı"
```

Add to `validation`:
```json
"paymentStartMonthRequired": "Aylık dışı aboneliklerde ödeme başlangıç ayı zorunludur"
```

Add to import error keys (`errors.json`):
```json
"required_for_non_monthly": "Aylık dışı aboneliklerde ODEME NOTU zorunludur (örn: OCAK, TEMMUZ)"
```

**No new month translations needed** — already exist at `notifications:months` (keys "1"-"12").

---

### STEP 8 — Verify & Test Checklist

- [ ] `payment_start_month` column exists in DB
- [ ] Monthly subscription: `payment_start_month` can be null
- [ ] 3-month/6-month/yearly: `payment_start_month` is required in form
- [ ] `generate_subscription_payments` uses `payment_start_month` as anchor (not `start_date` month)
- [ ] `extend_active_subscription_payments` uses `payment_start_month` for fallback anchor
- [ ] `bulk_import_subscriptions` accepts and stores `payment_start_month`
- [ ] Excel parser reads `ODEME NOTU`, converts to integer 1-12
- [ ] Excel parser rejects non-monthly rows without valid `ODEME NOTU`
- [ ] Form shows month selector only for non-monthly frequencies
- [ ] Detail page shows payment start month for non-monthly
- [ ] Template download includes `ODEME NOTU` column
- [ ] Existing Excel with `ABONELİK TİPİ` column still works (ignored)

---

## Files Changed (8 files)

| # | File | Type |
|---|---|---|
| 1 | `supabase/migrations/00143_add_payment_start_month.sql` | NEW |
| 2 | `src/features/subscriptions/schema.js` | EDIT |
| 3 | `src/features/subscriptions/SubscriptionFormPage.jsx` | EDIT |
| 4 | `src/features/subscriptions/importUtils.js` | EDIT |
| 5 | `src/features/subscriptions/importApi.js` | EDIT |
| 6 | `src/features/subscriptions/SubscriptionDetailPage.jsx` | EDIT |
| 7 | `src/locales/tr/subscriptions.json` | EDIT |
| 8 | `src/locales/tr/errors.json` | EDIT |

## Execution Order
Steps 1 → 7, then verify with Step 8 checklist. No CLI commands — user runs `supabase db push` manually.
