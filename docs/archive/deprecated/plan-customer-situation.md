# Customer Situation Board — Implementation Plan

> Status: APPROVED — Ready to implement.
> Last updated: 2026-02-24

---

## Overview

A smart board that shows the current health of every customer in one place.
Default view shows only problematic customers. Toggle to see all.
Each customer has a live health status + a historical notes log.

---

## Health Status Rules

| Status | Condition |
|--------|-----------|
| Critical | Payment overdue 30+ days OR open work order older than 7 days |
| Warning | Payment overdue 15–30 days OR open work order 4–7 days old |
| Healthy | Everything within limits |

Default view = Critical + Warning only. Toggle button to show all customers.

Health edge cases — explicit rules for the view:
- Customer with no subscription → payment axis treated as 0 overdue days (healthy baseline)
- Customer with no open work orders → WO axis treated as 0 days (healthy baseline)
- Customer with no subscription AND no work orders (new customer, zero activity) → always `healthy`
- Both axes use `COALESCE(value, 0)` so nulls never accidentally trigger warning or critical

---

## Board Columns

| Column | Source |
|--------|--------|
| Customer name | `customers` |
| Subscription status | `subscriptions` (active / overdue / none) |
| Last payment date | `subscription_payments` |
| Last service date | `work_orders` (latest completed servis/bakım) |
| Open work orders | `work_orders` (count of open WOs) |
| Health badge | Computed in view |
| Latest note preview | `customer_notes` (most recent note, truncated) |
| Actions | — |

Subscription status aggregation rule: a customer may have multiple subscriptions. The board shows the **worst status** across all non-cancelled subscriptions. If any subscription is overdue, the customer's subscription status shows overdue. The `customer_situation` view derives this by taking `MAX(days since last payment)` across all active/overdue subscriptions per customer.

---

## Quick Actions (per row)

- **Create Work Order** → navigates to new WO form pre-filled with customer
- **Record Payment** → opens payment modal (existing subscription payment flow)
- **Add Note** → opens side panel focused on note input
- **Paraşüt** → placeholder button, no action yet

---

## Notes System

- Historical, never overwritten — each note is a separate record
- Timestamped + author name shown (profile name)
- Only `admin` role can write notes (any authenticated user can read)
- Click any customer row → side panel opens showing:
  - Full note history (newest first)
  - Input field to add a new note
- Latest note preview shown inline on the board (first 60 chars)

Row interaction contract:
- Clicking anywhere on a customer row opens the notes side panel
- Clicking the **actions cell** (last column, containing `SituationActionsMenu`) does **not** open the notes panel — the actions cell stops click propagation via `stopPropagation`
- These two interactions must not conflict

Note permanence: notes cannot be deleted by any role. This is intentional, not an omission. No DELETE policy exists on `customer_notes`.

---

## Database

### New table: `customer_notes`

```sql
create table customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  content     text not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
```

RLS policies:
- `SELECT`: any authenticated user
- `INSERT`: `WITH CHECK (created_by = auth.uid() AND get_my_role() = 'admin')` — client sends `created_by`, RLS enforces it matches the session user and that the user is admin
- `DELETE`: no policy (intentionally permanent — notes are never deleted)

Index: `(customer_id, created_at DESC)` for fast note history lookups ordered newest first

---

### New view: `customer_situation`

Aggregates per customer:
- Worst payment situation across all non-cancelled subscriptions: `MAX(days since last payment)` per customer; null (no subscription) treated as 0
- Latest completed work order date (servis or bakım type)
- Count of open work orders + age of oldest open WO; null (no open WOs) treated as 0
- Computed `health` field using `COALESCE` on both axes:
  - `'critical'` → `COALESCE(max_payment_overdue_days, 0) > 30` OR `COALESCE(oldest_open_wo_days, 0) > 7`
  - `'warning'` → `COALESCE(max_payment_overdue_days, 0) > 15` OR `COALESCE(oldest_open_wo_days, 0) > 4`
  - `'healthy'` → everything else, including customers with no subscription and no work orders
- Latest note content + date

Composite indexes included in the migration (required for view query performance):

```sql
-- Open WO age and count per customer (respects soft-delete)
CREATE INDEX idx_wo_customer_status_created
  ON work_orders(customer_id, status, created_at)
  WHERE deleted_at IS NULL;

-- Latest completed service/maintenance per customer (respects soft-delete)
CREATE INDEX idx_wo_customer_type_status_date
  ON work_orders(customer_id, type, status, scheduled_date)
  WHERE deleted_at IS NULL;

-- Last payment lookup per subscription
CREATE INDEX idx_subpay_subscription_status_date
  ON subscription_payments(subscription_id, status, period_year, period_month);

-- Notes panel and latest note preview (ORDER BY created_at DESC)
CREATE INDEX idx_customer_notes_customer_created
  ON customer_notes(customer_id, created_at DESC);
```

---

## File Structure

```
src/features/customerSituation/
├── api.js                          # fetchCustomerSituations, addCustomerNote, fetchCustomerNotes
├── hooks.js                        # useCustomerSituations, useAddCustomerNote, useCustomerNotes
├── schema.js                       # Zod schema for note form
├── index.js                        # Barrel exports
├── CustomerSituationPage.jsx       # Main board page
└── components/
    ├── SituationHealthBadge.jsx    # Critical / Warning / Healthy badge
    ├── CustomerNotesPanel.jsx      # Slide-over panel with note history + input
    └── SituationActionsMenu.jsx    # Quick actions dropdown per row
```

API notes:
- `fetchCustomerSituations(filters = {})` accepts an optional `healthFilter` array. When the "problematic only" toggle is active, called with `{ healthFilter: ['critical', 'warning'] }` — filter applied server-side via `.in('health', filters.healthFilter)`. When the "show all" toggle is active, called with no filter.
- `addCustomerNote({ customer_id, content, created_by })` — `created_by` is the current user's ID taken from the auth session in the client. RLS enforces `created_by = auth.uid()` server-side, consistent with `work_orders` and `tasks` patterns.

---

## Translations

New file: `src/locales/tr/customerSituation.json`

Keys needed:
- Page title, column headers
- Health status labels (kritik, uyarı, sağlıklı)
- Notes panel (geçmiş notlar, not ekle, kaydet)
- Empty states (no problems found, no notes yet)
- Action labels

---

## Routes & Navigation

- Route: `/customer-situation`
- Nav group: **Management** (new group) or add to existing top-level
- Nav label: "Müşteri Durumu" with icon `LayoutDashboard` or `Activity`

---

## Migration

- File: `supabase/migrations/00096_customer_situation.sql`
- Creates: `customer_notes` table + RLS policies + 4 composite indexes
- Creates: `customer_situation` view

---

## Implementation Order

1. Migration (table + view + indexes + RLS)
2. `api.js` — fetch situation list, fetch notes, add note
3. `hooks.js` — React Query hooks
4. `schema.js` — note form validation
5. Translations — stub all keys in `customerSituation.json` before writing any JSX
6. `CustomerSituationPage.jsx` — main board (table, toggle, health badges)
7. `CustomerNotesPanel.jsx` — slide-over with note history
8. `SituationActionsMenu.jsx` — quick actions
9. Wire route + nav

---

## Out of Scope (for now)

- Paraşüt integration (placeholder only)
- Email/push notifications when customer turns critical
- Configurable thresholds (hardcoded: 30 days payment, 7 days WO)
- SIM card health (not requested)
