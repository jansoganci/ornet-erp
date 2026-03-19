# Subscriptions Module — Issues, Bugs & Future Risks

**Date:** 2026-03-13
**Scope:** `src/features/subscriptions/` + related Supabase migrations
**Status:** Living document — update as issues are resolved

---

## How Automatic Renewal / Termination Works (and why it doesn't)

This is important to understand before reading the issues list.

### What the system actually does

When a subscription is **cancelled**, a database trigger automatically sets `end_date = CURRENT_DATE` on the row (migration `00016`). That is the only automatic lifecycle action in the entire system.

Everything else is **100% manual**:

| Action | Who triggers it |
|--------|----------------|
| Pause a subscription | Staff clicks "Duraklat" |
| Cancel a subscription | Staff clicks "İptal Et" |
| Reactivate a subscription | Staff clicks "Yeniden Etkinleştir" |
| Generate new payment rows | Only happens on create or reactivate |

### What happens with yearly / 6-month billing

- `generate_subscription_payments` RPC creates **1 payment row** for yearly, **2 rows** for 6-month, **12 rows** for monthly.
- Once those rows are all paid or exhausted, **nothing happens automatically**. No new rows are created, no alert fires, no status changes.
- The subscription sits in `status = 'active'` forever with zero pending payments until a human intervenes.

### What this means operationally

- A yearly subscriber pays in January. By February the grid is empty. Staff will not know to re-invoice unless they manually check.
- There is no dashboard alert for "subscriptions with no upcoming payments".
- **Risk:** Revenue goes untracked for the next billing period until someone notices.

### What would need to be built to fix this

A Supabase Edge Function (or pg_cron job) that runs monthly and:
1. Finds all `active` subscriptions where the latest `subscription_payments.payment_month` is in the past.
2. Calls `generate_subscription_payments` to extend the payment grid by one billing period.
3. Optionally sends a notification to the assigned manager.

This is **not implemented** and is not trivial to add.

---

## Section 1 — Confirmed Bugs

### BUG-01 · Invalid `3_month` Option in Billing Frequency Filter

**File:** `src/features/subscriptions/SubscriptionsListPage.jsx:131`

The billing frequency filter dropdown renders a `3_month` option:

```js
{ value: '3_month', label: t('subscriptions:form.fields.3_month') }
```

But the database `CHECK` constraint (migration `00037`) only allows:

```sql
CHECK (billing_frequency IN ('monthly', '6_month', 'yearly'))
```

And the Zod schema (`schema.js`) only allows the same three values.

**Result:** Selecting `3_month` in the filter sends an invalid value to the query. PostgREST silently returns zero results. The user sees an empty table with no error.

**Fix:** Remove the `3_month` option from the filter options array and add the i18n key if `3_month` billing is ever formally added to the schema.

---

### BUG-02 · VAT Calculation Precision in PaymentRecordModal

**File:** `src/features/subscriptions/components/PaymentRecordModal.jsx:59`

```js
const vat = Math.round(baseAmount * rate) / 100;
```

This formula multiplies the full amount by the integer rate (e.g. 20), rounds, then divides by 100. It works correctly for whole numbers but produces rounding errors for decimal amounts.

**Example:** `baseAmount = 1250.75`, `rate = 20`
- Current: `Math.round(1250.75 * 20) / 100 = Math.round(25015) / 100 = 250.15`
- Correct: `Math.round(1250.75 * 20) / 100 = 250.15` ✓

Actually correct in this case, but the intent of the formula is fragile. The RPC `fn_record_payment` uses PostgreSQL `NUMERIC` precision for the actual stored value. The UI may show a different rounded figure than what gets saved to the database, causing a visible mismatch of ±0.01 TL between the modal preview and the stored `vat_amount`.

**Fix:** Use `Math.round(baseAmount * (rate / 100) * 100) / 100` to compute VAT consistently with 2-decimal precision.

---

### BUG-03 · `cancelSubscription` is Not Atomic — Race Condition on Write-Off

**File:** `src/features/subscriptions/api.js:389`

The cancel function performs two separate database operations with no transaction:

```js
// Step 1 — update subscription status
await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id)

// Step 2 — write off pending payments (separate round trip)
await supabase.from('subscription_payments').update({ status: 'write_off' })
  .eq('subscription_id', id).eq('status', 'pending')
```

If step 2 fails (network error, RLS issue, timeout), the subscription is cancelled but all pending payment rows remain in `pending` status. This creates a data inconsistency: a cancelled subscription with pending payments that will never be collected and will never appear on dashboards as written off.

**Fix:** Move cancellation logic into a dedicated RPC function (similar to `fn_record_payment`) that executes both operations inside a single PostgreSQL transaction.

---

### BUG-04 · Stale Pause Reason Not Cleared on Reactivation

**File:** `src/features/subscriptions/api.js:422`

When reactivating, the API only sets `status = 'active'` and `reactivated_at`. It does **not** clear:
- `pause_reason`
- `paused_at`
- `cancel_reason`
- `cancelled_at`

If a subscription is paused → reactivated → paused again, the detail page's "Status History" section will show stale `paused_at` / `pause_reason` values from the previous pause cycle mixed with the new ones, producing a confusing timeline.

**Fix:** On reactivation, set `pause_reason = NULL`, `cancel_reason = NULL`. Keep the timestamps for historical record but document in the UI that they represent the last pause/cancel, not the current state.

---

### BUG-05 · `write_off` Status Has No Reverse Action in the UI

**File:** `src/features/subscriptions/components/MonthlyPaymentGrid.jsx` (grid cell rendering)

Once a payment is marked `write_off`, there is no UI action to revert it to `pending`. The `fn_record_payment` RPC checks for `status = 'pending' OR status = 'failed'` before allowing a payment to be recorded — a `write_off` payment is permanently stuck.

This becomes a problem when a subscription is cancelled with `writeOffUnpaid = true` and then the customer pays late, or when a staff member made an error.

**Fix:** Add a "Geri Al" (undo) action in PaymentRecordModal or a separate admin action that sets the payment back to `pending` for a specific payment row.

---

## Section 2 — Future Risks

### RISK-01 · No Automatic Payment Grid Extension (see intro section)

Subscriptions with yearly or 6-month billing will silently run out of payment rows. There is no mechanism to alert staff or auto-extend. This is the highest operational risk in the module.

**Priority:** High
**When it becomes a problem:** Immediately for any active yearly subscription after its first payment is recorded.

---

### RISK-02 · No Concurrent Edit Protection

**File:** `src/features/subscriptions/SubscriptionFormPage.jsx`

If two staff members open the same subscription's edit form simultaneously, the second one to save will silently overwrite the first's changes. The `updated_at` timestamp is saved but never checked before the update is submitted.

The RPC `fn_update_subscription_price` uses a `SELECT FOR UPDATE` lock, but the general `updateSubscription()` path uses a plain `UPDATE` with no version check.

**Risk:** Data loss when multiple office staff work simultaneously. Becomes more likely as the team grows.

**Fix:** On form load, capture `updated_at`. Before submitting, re-fetch the subscription and compare `updated_at`. If changed, show a conflict warning.

---

### RISK-03 · Bulk Price Revision Has No Confirmation Step

**File:** `src/features/subscriptions/SubscriptionsListPage.jsx` (PriceRevisionPage)

Editing prices in the bulk revision table and clicking save immediately calls `bulk_update_subscription_prices`. With 200+ subscriptions loaded, an accidental keypress on the wrong row or an incorrect copy-paste can update dozens of active subscription prices and recalculate all their pending payment amounts with no warning.

The RPC is atomic (all-or-nothing), but there is no "preview changes" step and no confirmation dialog before execution.

**Fix:** Add a summary modal before submit: "You are about to update prices for N subscriptions. Are you sure?"

---

### RISK-04 · Pagination Hard-Coded to 50 Rows

**File:** `src/features/subscriptions/hooks.js`

```js
const PAGE_SIZE = 50;
```

There is no UI control to change the page size and no "export all" function. As the subscription count grows past a few hundred, operational tasks that require seeing all data at once (e.g. year-end audit, bulk price review) become cumbersome.

**Fix:** Either expose a page-size selector in the UI or add a CSV export function to the list page.

---

### RISK-05 · Hardcoded Turkish Error Messages in paymentsApi.js

**File:** `src/features/subscriptions/paymentsApi.js:65,68`

```js
if (pgError?.code === 'P0001' && pgError.message.includes('payment_locked')) {
  throw new Error('Bu ödeme zaten kaydedilmiş ve kilitlenmiştir.');
}
if (pgError?.code === 'P0001' && pgError.message.includes('payment_not_found')) {
  throw new Error('Ödeme kaydı bulunamadı.');
}
```

These Turkish strings are outside the i18n system. If the app ever supports multiple languages, these messages will not be translated. They also cannot be updated without a code deploy.

**Fix:** Move these to `src/locales/tr/subscriptions.json` under `payment.errors.*` and use `i18next.t()`.

---

### RISK-06 · `annual` Subscription Type Exists in DB but Not in Form

**Migration:** `00054_add_sim_card_subscription_enum.sql`
**File:** `src/features/subscriptions/schema.js`

The database `subscription_type` column includes `annual` as a valid enum value (used in `generate_subscription_payments` for legacy logic). However, the form's `SUBSCRIPTION_TYPES` constant and the Zod schema list only `recurring_card`, `manual_cash`, `manual_bank` (and `internet_only` per analysis).

Any existing subscription rows with `subscription_type = 'annual'` will:
- Load correctly on the detail page (read from DB)
- Fail validation if staff tries to edit them (Zod rejects the value on form load)

**Fix:** Add `'annual'` to `SUBSCRIPTION_TYPES` in `schema.js` or explicitly migrate all `annual` rows to the appropriate modern type.

---

### RISK-07 · No Unpaid Payment Dashboard Alert

There is no widget or alert that shows "subscriptions with overdue pending payments" beyond the compliance alert for invoicing. A subscription that has been pending for 3+ months looks the same in the list as one that was just created.

**Fix:** Add a filter preset "Gecikmiş Ödemeler" (overdue) to the list page, showing subscriptions where the oldest pending payment's `payment_month` is more than 30 days in the past.

---

### RISK-08 · SIM Card — Subscription Link Is Partially Wired

**Migration:** `00055_subscription_sim_card_link.sql`, `00056_fix_sim_card_status_on_subscription_update.sql`

The subscription form has a `SimCardCombobox` field and the detail page shows `sim_phone_number` if `sim_card_id` exists. However:
- There is no validation that the selected SIM card belongs to the same site as the subscription.
- If the subscription is deleted (soft or hard), migration `00057` handles resetting the SIM status — but if the subscription's `site_id` changes via an edit, the SIM remains linked to the old site.

**Fix:** Add a form-level validation that `sim_card_id` belongs to the subscription's current `site_id`. Clear `sim_card_id` if `site_id` changes during edit.

---

## Section 3 — Deferred / Out of Scope

The following are known gaps that are intentionally not being addressed:

| Item | Decision |
|------|----------|
| Paraşüt accounting integration | **Will not be built.** `parasut_invoice_id` column can remain for potential future use but no integration code will be written. |
| Automatic payment retry / dunning | **Will not be built.** `retry_count`, `last_retry_at`, `next_retry_at` columns remain unused. Failed payments must be manually re-recorded. |

---

## Summary Table

| ID | Severity | Type | Status |
|----|----------|------|--------|
| BUG-01 | Medium | Bug | **Resolved — migration 00109, schema.js, i18n** |
| BUG-02 | Low | Bug | **Resolved — PaymentRecordModal.jsx** |
| BUG-03 | High | Bug | **Resolved — migration 00111, api.js** |
| BUG-04 | Low | Bug | **Resolved — api.js reactivateSubscription** |
| BUG-05 | Medium | Bug | **Resolved — migration 00113, paymentsApi.js, hooks.js, MonthlyPaymentGrid.jsx, PaymentRecordModal.jsx, i18n** |
| RISK-01 | High | Missing Feature | **Resolved — migration 00110 + Edge Function** |
| RISK-02 | Medium | Missing Feature | **Resolved — SubscriptionFormPage.jsx, i18n** |
| RISK-03 | Medium | UX Risk | **Resolved — PriceRevisionPage.jsx, i18n** |
| RISK-04 | Low | UX Limitation | **Resolved — hooks.js, SubscriptionsListPage.jsx, i18n** |
| RISK-05 | Low | Technical Debt | **Resolved — paymentsApi.js, i18n** |
| RISK-06 | High | Data Integrity | **Resolved — migration 00112** |
| RISK-07 | Medium | Missing Feature | **Resolved — migration 00114, api.js, SubscriptionsListPage.jsx, i18n** |
| RISK-08 | Medium | Data Integrity | **Resolved — SubscriptionFormPage.jsx** |
