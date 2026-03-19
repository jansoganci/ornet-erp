# Prompt: Billing Frequency and Payment Month Redesign

---

## Current State — What Is the Problem?

The `subscriptions` table has a `billing_frequency` column that uses text values: `'monthly'`, `'3_month'`, `'6_month'`, `'yearly'`. These values:
- Can appear inconsistent or "odd"
- Cannot be used directly for monthly average revenue calculations
- **Critical gap:** There is no information about which month to invoice/collect payment

The payment schedule (`subscription_payments`, `generate_subscription_payments`, `extend_active_subscription_payments`) currently works only with `start_date` and `billing_frequency`. So payments always start from the month of `start_date`. For example, if a 3‑month subscription starts on March 15, payments are generated for March, June, September, December. But if the business wants a fixed calendar like "our 3‑month subscriptions are collected in January, April, July, October", there is no field to express that.

---

## What Can the Application Not Answer?

1. **"Which subscriptions do I invoice/collect from this month?"** — Only derived from `start_date` + `billing_frequency`; a fixed payment cycle month (e.g. "January, April, July, October") cannot be defined.
2. **Monthly average revenue (MRR)** — Because `billing_frequency` is text, it must be converted to numeric multipliers (1, 3, 6, 12); it cannot be used directly.
3. **Consistency** — "3‑month" = 3 months, "6‑month" = 6 months is clear, but text-based; numeric values (1, 3, 6, 12) would be simpler.

---

## What Do We Need It to Answer?

1. Store billing frequency as **numbers**: 1 (monthly), 3 (quarterly), 6 (half‑yearly), 12 (yearly).
2. Calculate total amounts based on these numbers; monthly average revenue = total / frequency.
3. Know **which month to collect payment**: a "payment month" (1–12) so January, February, … December can be selected.
4. Example logic:
   - **1‑month:** Payment month irrelevant; every month.
   - **3‑month + January:** January, April, July, October.
   - **6‑month + February:** February, August.
   - **12‑month + March:** Every March.

---

## Our Idea

1. **`billing_frequency`** — Use **numbers (1, 3, 6, 12)** instead of text. Map: `monthly` → 1, `3_month` → 3, `6_month` → 6, `yearly` → 12.
2. **`payment_month`** (new column) — Integer 1–12; the month when the payment cycle starts (1 = January, 12 = December).
3. Payment generation:
   - 1‑month: Every month.
   - 3‑month + payment_month=1: January, April, July, October.
   - 6‑month + payment_month=2: February, August.
   - 12‑month + payment_month=3: Every March.

---

## Proposed Solution

1. **Migration:** Change `billing_frequency` from `TEXT` to `INTEGER` (or `SMALLINT`) with values 1, 3, 6, 12. Migrate existing data: `monthly`→1, `3_month`→3, `6_month`→6, `yearly`→12.
2. **New column:** `payment_month INTEGER CHECK (payment_month BETWEEN 1 AND 12)` — 1‑month subscriptions can use NULL or 0.
3. **`generate_subscription_payments` and `extend_active_subscription_payments`** — Use numeric `billing_frequency`; compute payment months from `payment_month`.
4. **Frontend:** Form and list show options 1, 3, 6, 12; payment month selector 1–12 (January–December).
5. **Excel import:** Accept 1, 3, 6, 12 in `ODEME SIKLIGI` column; separate column for `payment_month` or default (e.g. month of `start_date`).

---

## Codebase Compatibility and Alternatives

Is this solution sensible and compatible with the current Ornet ERP codebase?

- `billing_frequency` is currently defined with `CHECK (billing_frequency IN ('monthly', '3_month', '6_month', 'yearly'))`.
- It is used in: `generate_subscription_payments`, `extend_active_subscription_payments`, `bulk_import_subscriptions`, `SubscriptionFormPage`, `importUtils`, `schema.js`, `SubscriptionsListPage`.
- The `subscription_payments` table uses `payment_month` (DATE); no conflict with the new `payment_month` (1–12), which has a different meaning.

**If this solution is not sensible or poses compatibility risks:**
- What alternative approaches would you suggest?
- Would it be safer to add only `payment_month` and keep the existing text values for `billing_frequency`?
- If `payment_month` conflicts with `start_date`, which rule should take precedence?
