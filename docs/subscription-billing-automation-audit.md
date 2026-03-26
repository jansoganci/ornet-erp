# Subscription Billing Automation — Technical Audit Report

> Generated: 2026-03-26
> Scope: Supabase Edge Functions, pg_cron jobs, DB triggers, frontend API layer

---

## Executive Summary

The system has a **well-architected, multi-layer billing foundation** built on pg_cron + Supabase Edge Functions + database triggers. The 25th-of-month cron exists, but its purpose is narrower than you might expect: it fires a **notification summary**, not actual payment processing. Actual payment generation runs on the **1st of the month** via a different path. All payment recording is currently **manual** — no automatic card charges exist.

---

## 1. Edge Functions

Two Edge Functions exist under `supabase/functions/`:

### `fetch-tcmb-rates/index.ts`
- **Purpose:** Fetches USD/TRY exchange rates from the Turkish Central Bank XML feed
- **Schedule:** Daily at 03:00 UTC (`0 3 * * *`), set in migration `00053_tcmb_cron_setup.sql`
- **Target:** Upserts into `exchange_rates` table
- **Status:** ✅ Active, functional

### `extend-subscription-payments/index.ts`
- **Purpose:** Rolling 24-month payment row generator for all active subscriptions
- **Schedule:** 1st of every month at 02:00 UTC (`0 2 1 * *`)
- **What it does:** Calls the `extend_active_subscription_payments()` RPC — generates `subscription_payments` rows up to 24 months ahead, fully idempotent via `ON CONFLICT (subscription_id, payment_month) DO NOTHING`
- **Billing cycles handled:** Monthly (×1), 3-month (×3), 6-month (×6), yearly (×12) multipliers applied to base_price + fees
- **Status:** ✅ Active — this is the only automated payment *row generation* in the system

---

## 2. The Cron Job Landscape

There are **6 active pg_cron jobs** across migrations:

| Job Name | Schedule | What It Does | Migration |
|---|---|---|---|
| `fetch-tcmb-rates-daily` | `0 3 * * *` (daily) | HTTP POST → TCMB Edge Function | `00053` |
| `notification-daily-check` | `0 6 * * *` (daily) | `fn_create_scheduled_notifications()` — payment/renewal/task due alerts | `00067` |
| `notification-reminder-check` | `0 * * * *` (hourly) | `fn_process_reminders()` — user reminder notifications | `00067` |
| `notification-cleanup-monthly` | `0 4 1 * *` (1st of month) | `fn_notification_cleanup()` — purges resolved notifications >90 days old | `00067` |
| `recurring-expenses-daily` | `0 1 * * *` (daily) | `fn_generate_recurring_expenses()` — creates `financial_transactions` rows for recurring expense templates | `00070` |
| `pending-payments-summary` | `0 6 25 * *` (**25th of month**) | `fn_create_pending_payments_summary_notification()` — notifies accountant of how many payments are still pending this month | `00149` |

### The "25th of the month" rule

The 25th-of-month cron in migration `00149` **does not generate payments or create transactions**. It only:
1. Counts pending `subscription_payments` rows for the current month
2. Creates a single `pending_payments_summary` notification targeted at the `accountant` role
3. Auto-resolves that notification when all payments are collected or written off

It is a **reminder trigger**, not a billing engine.

---

## 3. Transaction Generation Flow

### How `subscription_payments` rows are created

- **At subscription creation:** `generate_subscription_payments()` RPC creates 12 months of rows
- **On an ongoing basis:** `extend_active_subscription_payments()` (Edge Function, 1st of month) keeps the horizon at 24 months ahead

### How `financial_transactions` rows are created from payments

This is handled entirely by a **database trigger**, not by cron or the frontend:

```
subscription_payments  ──[AFTER UPDATE, status → 'paid']──▶  fn_subscription_payment_to_finance()
                                                                ├─ INSERT income row (income_type='subscription')
                                                                └─ INSERT expense row (cogs, category='subscription_cogs')
```

Defined in `supabase/migrations/00050_subscription_payment_to_finance.sql`. The trigger:
- Creates **two rows**: one income record, one COGS expense record
- Applies the billing frequency multiplier to cost (yearly=×12, 6-month=×6, etc.)
- Is fully idempotent (EXISTS check on `subscription_payment_id`)
- Carries through `should_invoice`, `output_vat`, `cogs_try`, `payment_method`

**This trigger is the single source of truth** — the frontend never directly inserts into `financial_transactions` for subscription payments.

### Recurring Expenses (separate path)

`fn_generate_recurring_expenses()` runs daily at 01:00 UTC and inserts directly into `financial_transactions` for each active `recurring_expense_templates` row. Protected against duplicates by a unique index on `(recurring_template_id, period)`.

---

## 4. Payment Recording — The Manual Gap

The atomic `fn_record_payment()` RPC (migration `00098`) is what actually marks a payment as `paid`. It:
- Acquires a row-level lock on the payment
- Sets `status = 'paid'`, `payment_date`, `payment_method`, `vat_amount`, `total_amount`
- Creates an audit log entry
- **Fires the trigger** → creates the `financial_transactions` pair

**Who calls it:** Only `paymentsApi.js → recordPayment()` from the frontend UI. There is no automated card charge logic anywhere in the codebase. The `iyzico_token` field exists in the `payment_methods` schema but is never read or used by any function or cron job.

---

## 5. Notification Logic

### What generates notifications

| Type | Source | Mechanism |
|---|---|---|
| `payment_due_soon` | Payments due in ≤5 days | `fn_create_scheduled_notifications()` daily cron |
| `renewal_due_soon` | Subscriptions ending in ≤5 days | Same cron |
| `task_due_soon` | Tasks due in ≤2 days | Same cron |
| `user_reminder` | User-set reminders | `fn_process_reminders()` hourly cron |
| `pending_payments_summary` | Pending payments this month | 25th-of-month cron (`fn_create_pending_payments_summary_notification()`) |
| `subscription_cancelled` / `subscription_paused` / `sim_card_cancelled` / `recurring_expense_pending` | Status change triggers | Separate DB triggers |

### What notifications are NOT

All notification delivery is **in-app only** — rows inserted into the `notifications` table. There is no email dispatch, no push notification, no SMS, no webhook call anywhere in the codebase. The frontend consumes notifications via `fetchActiveNotifications()` and a real-time Postgres subscription (`subscribeToNotifications()`). Deduplication is enforced by a `UNIQUE` constraint on `dedup_key`.

---

## 6. Current Status & Gap Analysis

### ✅ What is working

- Subscription payment rows are continuously generated (24-month rolling horizon, 1st of month)
- All billing cycles (monthly / 3-month / 6-month / yearly) handled with correct multipliers
- Recording a payment atomically creates the finance transaction pair via trigger
- VAT is dynamic (`vat_rate` per subscription, per payment)
- Cron sends in-app reminders for upcoming due dates and the 25th-of-month summary
- Recurring expenses generate `financial_transactions` rows automatically each day
- Audit trail is complete

### ❌ What is missing / not implemented

| Gap | Severity | Detail |
|---|---|---|
| **Automatic card charging** | 🔴 Critical (Phase 2) | `iyzico_token` field exists in schema but is never called. All payments require manual recording via the UI. |
| **Payment dunning / retry** | 🟠 High | Schema has `retry_count`, `last_retry_at`, `next_retry_at` columns on `subscription_payments` — none are written to by any function or cron. Dead schema. |
| **Invoice automation** | 🟠 High | `parasut_invoice_id` field exists, `should_invoice` flag is set correctly, but there is zero Parasut API integration. No e-Fatura, e-Arşiv, or paper invoice generation. |
| **The 25th-of-month cron does NOT generate anything** | 🟡 Medium (expectation gap) | If the intent was for the 25th job to *trigger* billing, it doesn't — it only creates a summary notification for accountants. |
| **Notifications are in-app only** | 🟡 Medium | No email or push delivery. Accountants must open the app to see the 25th-of-month summary. |
| **No prorating on mid-month start** | 🟢 Low | Billing always assumes full-month amounts regardless of when in the month a subscription starts. |
| **Billing day 29-31 not validated** | 🟢 Low | `billing_day` field comment says 1-28, but no DB constraint enforces it. |

---

## 7. Architecture Diagram

```
pg_cron (1st of month, 02:00 UTC)
  └─▶ Edge Function: extend-subscription-payments
        └─▶ RPC: extend_active_subscription_payments()
              └─▶ INSERT subscription_payments rows (24-month horizon, idempotent)

pg_cron (25th of month, 06:00 UTC)
  └─▶ fn_create_pending_payments_summary_notification()
        └─▶ INSERT notification (type='pending_payments_summary') for accountant role
              [this is the "25th billing cron" — reminders only, no transactions created]

Frontend UI (accountant records payment manually)
  └─▶ paymentsApi.recordPayment()
        └─▶ RPC: fn_record_payment()  [row-lock + atomic UPDATE]
              └─▶ TRIGGER: fn_subscription_payment_to_finance()
                    ├─▶ INSERT financial_transactions (income row)
                    └─▶ INSERT financial_transactions (expense/COGS row)

pg_cron (daily, 01:00 UTC)
  └─▶ fn_generate_recurring_expenses()
        └─▶ INSERT financial_transactions (recurring expense rows, idempotent)

pg_cron (daily, 06:00 UTC)
  └─▶ fn_create_scheduled_notifications()
        └─▶ INSERT notifications (payment_due_soon, renewal_due_soon, task_due_soon)
```

---

## 8. Key File Locations

### Database Migrations

| File | What's in it |
|---|---|
| `supabase/migrations/00016_subscriptions.sql` | Core schema: subscriptions, subscription_payments, payment_methods tables |
| `supabase/migrations/00050_subscription_payment_to_finance.sql` | Trigger: payment → financial_transactions bridge |
| `supabase/migrations/00053_tcmb_cron_setup.sql` | pg_cron job for TCMB Edge Function |
| `supabase/migrations/00067_notification_cron.sql` | pg_cron jobs for notifications (daily + hourly) |
| `supabase/migrations/00070_recurring_expenses.sql` | Recurring expense templates + daily cron |
| `supabase/migrations/00098_atomic_record_payment.sql` | `fn_record_payment()` RPC with row-level lock |
| `supabase/migrations/00111_atomic_cancel_subscription.sql` | `fn_cancel_subscription()` RPC |
| `supabase/migrations/00145_extend_and_ensure_payments_for_year.sql` | `extend_active_subscription_payments()` + `ensure_payments_for_year()` |
| `supabase/migrations/00149_pending_payments_summary_notification.sql` | 25th-of-month cron + summary notification function |

### Edge Functions

| File | What's in it |
|---|---|
| `supabase/functions/fetch-tcmb-rates/index.ts` | Daily TCMB exchange rate fetch |
| `supabase/functions/extend-subscription-payments/index.ts` | Monthly rolling payment row generator |

### Frontend

| File | What's in it |
|---|---|
| `src/features/subscriptions/api.js` | Subscription CRUD, price update, cancellation RPCs |
| `src/features/subscriptions/paymentsApi.js` | `recordPayment()`, `fetchOverdueInvoices()`, `ensurePaymentsForYear()` |
| `src/features/subscriptions/hooks.js` | React Query hooks for all subscription & payment operations |
| `src/features/finance/api.js` | Manual financial transaction CRUD |
| `src/features/notifications/api.js` | Notification fetch, resolve, real-time subscription |

---

## 9. Data Model Quick Reference

### `subscription_payments` (key columns)

| Column | Type | Notes |
|---|---|---|
| `payment_month` | DATE | Always 1st of month. UNIQUE with `subscription_id`. |
| `status` | ENUM | `pending` / `paid` / `failed` / `skipped` / `write_off` |
| `amount` | NUMERIC | NET (KDV hariç) |
| `vat_amount` | NUMERIC | Calculated: `ROUND(amount * vat_rate / 100, 2)` |
| `total_amount` | NUMERIC | `amount + vat_amount` |
| `retry_count` | INT | Always 0 — dunning not implemented |
| `parasut_invoice_id` | TEXT | Always NULL — Parasut not integrated |

### `financial_transactions` (key columns)

| Column | Type | Notes |
|---|---|---|
| `direction` | ENUM | `income` / `expense` |
| `income_type` | ENUM | `subscription` / `sim_rental` / `sale` / `service` / etc. |
| `period` | TEXT | GENERATED: `YYYY-MM` from `transaction_date` |
| `subscription_payment_id` | UUID FK | Links income row back to the payment that triggered it |
| `recurring_template_id` | UUID FK | Links expense row to its recurring template |
| `status` | ENUM | `pending` / `confirmed` — only `confirmed` appears in P&L |

---

## 10. Bottom Line

The billing infrastructure is solid for a **manual-recording workflow**. The foundation (payment rows, trigger bridge, VAT, audit log, cron reminders) is production-ready.

The **missing piece for full automation is Phase 2**: an automated payment charge path (Iyzico integration) that would call `fn_record_payment()` programmatically rather than waiting for an accountant to click "Öde" in the UI. Until then, the 25th-of-month cron serves as an accountant nudge, not a billing engine.
