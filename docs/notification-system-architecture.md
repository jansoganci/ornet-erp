# Notification System — Architecture Plan

**Date:** 2026-02-13
**Status:** Architecture plan — awaiting approval
**Based on:** notification-system-concept.md + codebase analysis

---

## Executive Summary

After analyzing 63 existing migrations, all feature modules, triggers, cron setup, Realtime usage, and the AppLayout, I recommend a **hybrid computed + stored** approach rather than a pure "insert everything into notifications table" model.

**Why hybrid?** Types like "open work orders" and "overdue proposals" are just queries against existing data. Materializing them into a notifications table means maintaining lifecycle (create when WO opens, delete when WO closes), preventing duplicates, and fighting staleness. A computed view gives you always-current data for free.

The `notifications` table is reserved for what it's good at: **one-time events** (subscription cancelled, work order assigned) and **threshold alerts** created by cron (payment due in 5 days).

---

## Architecture Decision: Hybrid Model

### Category A — Computed (live queries, no storage)

| # | Type | Source Query |
|---|------|-------------|
| 4.1 | Open Work Orders | `work_orders WHERE status NOT IN ('completed','cancelled')` |
| 4.2 | Overdue Work Orders | `work_orders WHERE status NOT IN ('completed','cancelled') AND scheduled_date < CURRENT_DATE` |
| 4.3 | Proposals Awaiting Response | `proposals WHERE status = 'sent'` |
| 4.4 | Proposal 2+ Days No Response | `proposals WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '2 days'` |
| 4.5 | Approved, Not Installed | `proposals WHERE status = 'accepted' AND id NOT IN (SELECT proposal_id FROM proposal_work_orders)` |
| 4.9 | Today Scheduled, Not Started | `work_orders WHERE scheduled_date = CURRENT_DATE AND status NOT IN ('completed','cancelled')` |

**Reasoning:** These change constantly. An open WO is resolved the moment someone marks it completed. No INSERT/DELETE dance needed — the query IS the truth.

### Category B — Stored in `notifications` table (events + cron)

| # | Type | Mechanism | Lifecycle |
|---|------|-----------|-----------|
| 4.6 | Subscription Cancel/Pause | DB Trigger (instant) | One-time event, never auto-resolves |
| 4.7 | Payment Due Soon (5 days) | Cron (daily) | Resolves when payment status changes from 'pending' |
| 4.7b | Renewal Due Soon (5 days) | Cron (daily) | Resolves when subscription renewed/cancelled |
| 4.7c | Work Order Assigned | DB Trigger (instant) | One-time event, never auto-resolves |
| 4.8 | Task Due Soon (2 days) | Cron (daily) | Resolves when task completed/cancelled |
| 4.10 | User Reminder | Cron (hourly) | Resolves when user marks complete |

**Reasoning:** These are either one-time events (you need to remember "subscription X was cancelled on Feb 10") or threshold alerts that should fire once at a specific time.

### Category C — User Reminders (separate table)

| # | Type | Mechanism |
|---|------|-----------|
| 4.10 | User Reminder Note | User creates manually; cron moves to notifications when `remind_at` arrives |

**Reasoning:** Reminders have their own lifecycle (create, trigger, complete) and need separate CRUD. They appear in the unified notification view only when their time comes.

---

## 1. Database Schema Design

### Migration: `00064_notifications.sql`

#### 1.1 `notifications` table

```
notifications
├── id                    UUID PK DEFAULT gen_random_uuid()
├── type                  TEXT NOT NULL CHECK (type IN (...))
├── title                 TEXT NOT NULL
├── body                  TEXT
├── related_entity_type   TEXT CHECK (type IN ('work_order','proposal','subscription','subscription_payment','task','reminder'))
├── related_entity_id     UUID
├── target_role           TEXT CHECK (target_role IN ('admin','accountant')) — NULL = all eligible
├── created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL
├── resolved_at           TIMESTAMPTZ — NULL = still active
├── created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Notification `type` values:**
- `subscription_cancelled`
- `subscription_paused`
- `payment_due_soon`
- `renewal_due_soon`
- `work_order_assigned`
- `task_due_soon`
- `user_reminder`

**What's NOT here:**
- No `updated_at` — notifications are immutable (only `resolved_at` changes)
- No `read_at` — per concept doc, no read/unread tracking
- No `target_user_id` — using `target_role` instead (admin/accountant see all; field_worker excluded)
- No `org_id` — single-tenant (matching your existing pattern)
- No `priority` — type implies priority; frontend handles display

**Indexes:**
```
idx_notifications_active          — (resolved_at) WHERE resolved_at IS NULL
idx_notifications_type            — (type)
idx_notifications_entity          — (related_entity_type, related_entity_id)
idx_notifications_created         — (created_at DESC)
```

**RLS:**
```
SELECT  → authenticated WHERE get_my_role() IN ('admin', 'accountant')
INSERT  → authenticated WHERE get_my_role() IN ('admin', 'accountant')
UPDATE  → authenticated WHERE get_my_role() IN ('admin', 'accountant')  — only for resolved_at
DELETE  → authenticated WHERE get_my_role() = 'admin'
```

#### 1.2 `user_reminders` table

```
user_reminders
├── id                    UUID PK DEFAULT gen_random_uuid()
├── content               TEXT NOT NULL
├── remind_date           DATE NOT NULL
├── remind_time           TIME DEFAULT '09:00'
├── completed_at          TIMESTAMPTZ — NULL = still active
├── notified              BOOLEAN DEFAULT false — cron sets true after creating notification
├── created_by            UUID NOT NULL REFERENCES profiles(id)
├── created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
├── updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Why `notified` flag?** Duplicate prevention. Cron checks `notified = false AND remind_date <= CURRENT_DATE AND (remind_time <= CURRENT_TIME OR remind_time IS NULL)`. After inserting the notification, sets `notified = true`.

**Indexes:**
```
idx_reminders_pending    — (remind_date, remind_time) WHERE notified = false AND completed_at IS NULL
idx_reminders_created_by — (created_by)
```

**RLS:**
```
SELECT  → authenticated WHERE created_by = auth.uid() OR get_my_role() = 'admin'
INSERT  → authenticated WHERE get_my_role() IN ('admin', 'accountant')
UPDATE  → authenticated WHERE created_by = auth.uid() OR get_my_role() = 'admin'
DELETE  → authenticated WHERE created_by = auth.uid() OR get_my_role() = 'admin'
```

#### 1.3 `v_active_notifications` view

The heart of the system. UNION ALL of computed + stored:

```
Section 1: Open Work Orders (computed)
  → type = 'open_work_order'
  → FROM work_orders WHERE status NOT IN ('completed','cancelled')

Section 2: Overdue Work Orders (computed)
  → type = 'overdue_work_order'
  → FROM work_orders WHERE status NOT IN ('completed','cancelled') AND scheduled_date < CURRENT_DATE

Section 3: Proposals Awaiting Response (computed)
  → type = 'proposal_awaiting_response'
  → FROM proposals WHERE status = 'sent'

Section 4: Proposal 2+ Days No Response (computed)
  → type = 'proposal_no_response_2d'
  → FROM proposals WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '2 days'

Section 5: Approved Not Installed (computed)
  → type = 'proposal_approved_no_wo'
  → FROM proposals WHERE status = 'accepted'
    AND NOT EXISTS (SELECT 1 FROM proposal_work_orders WHERE proposal_id = proposals.id)

Section 6: Today Scheduled Not Started (computed)
  → type = 'today_not_started'
  → FROM work_orders WHERE scheduled_date = CURRENT_DATE AND status NOT IN ('completed','cancelled')

Section 7: Active stored notifications
  → FROM notifications WHERE resolved_at IS NULL

Section 8: Active user reminders (already triggered)
  → type = 'user_reminder'
  → FROM user_reminders WHERE notified = true AND completed_at IS NULL
```

**View columns (unified shape):**
```
notification_source   TEXT    — 'computed' or 'stored'
notification_type     TEXT    — the type string
title                 TEXT
body                  TEXT
entity_type           TEXT    — 'work_order', 'proposal', etc.
entity_id             UUID
created_at            TIMESTAMPTZ
notification_id       UUID    — NULL for computed, actual ID for stored (needed for resolve action)
```

**GRANT SELECT** to authenticated.

#### 1.4 `get_notification_badge_count()` function

Instead of `SELECT COUNT(*) FROM v_active_notifications` (which runs the full UNION ALL), use optimized separate counts:

```
RETURNS JSON → {
  total: number,
  open_work_orders: number,
  overdue_work_orders: number,
  proposals_waiting: number,
  stored_notifications: number,
  reminders: number
}
```

Each count is a simple `SELECT COUNT(*)` with WHERE clause — fast, no JOINs, no UNION. Frontend sums for badge or shows breakdown.

**Pattern:** Matches `get_subscription_stats()` (migration 00016).

---

## 2. Trigger Strategy

### 2.1 Subscription Cancel/Pause → `fn_notify_subscription_status_change()`

**Table:** `subscriptions`
**Event:** `AFTER UPDATE`
**Condition:** `OLD.status != NEW.status AND NEW.status IN ('cancelled', 'paused')`

**Action:** INSERT into `notifications`:
- type: `subscription_cancelled` or `subscription_paused`
- title: Subscription company name + action
- body: SIM card phone number (if linked) + carrier action message
- related_entity_type: `subscription`
- related_entity_id: `NEW.id`

**Carrier message logic:**
- cancelled → "Cancel this number from [carrier]"
- paused → "Set this number to inactive at [carrier]"
- Fetch phone number via `sim_cards` JOIN if `NEW.sim_card_id IS NOT NULL`

**Why AFTER UPDATE:** We need `NEW.status` confirmed. Matches pattern from `fn_subscription_payment_to_finance` (00050).

### 2.2 Work Order Created → `fn_notify_work_order_assigned()`

**Table:** `work_orders`
**Event:** `AFTER INSERT`

**Action:** INSERT into `notifications`:
- type: `work_order_assigned`
- title: Work order form_no + work_type
- body: Customer name, site, scheduled date
- related_entity_type: `work_order`
- related_entity_id: `NEW.id`
- target_role: `admin` (per concept doc — admin only for now)

**Note:** `assigned_to` is UUID[] (array). For now, notification targets admin role, not individual workers. If expanded later, iterate array and create per-user notifications.

### 2.3 Auto-Resolve Stored Notifications

**Table:** `work_orders`, `tasks`, `subscription_payments`
**Event:** `AFTER UPDATE`

When a tracked entity reaches terminal state, resolve its notification:

**Function:** `fn_resolve_notification_on_entity_close()`

**Logic:**
- If `work_orders.status` changes to `'completed'` or `'cancelled'` → resolve notifications WHERE `related_entity_type = 'work_order' AND related_entity_id = OLD.id`
- If `tasks.status` changes to `'completed'` or `'cancelled'` → resolve matching
- If `subscription_payments.status` changes from `'pending'` to anything → resolve matching

**Implementation:** One generic function, multiple triggers. Uses `TG_TABLE_NAME` and `TG_OP` to determine behavior. Matches the pattern of `update_updated_at_column()` being reused across tables.

---

## 3. Cron Job Strategy

### 3.1 pg_cron Availability

**Confirmed available.** Migration `00053_tcmb_cron_setup.sql` already uses:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
```
Your Supabase project supports pg_cron. No Edge Function needed for scheduled notifications.

### 3.2 Cron Jobs Needed

#### Job 1: `notification-daily-check` — runs daily at 06:00 UTC (09:00 Turkey)

**Handles:**
- **Payment due soon:** subscription_payments WHERE status = 'pending' AND payment_month BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
- **Renewal due soon:** subscriptions WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
- **Task due soon:** tasks WHERE status NOT IN ('completed','cancelled') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'

#### Job 2: `notification-reminder-check` — runs hourly at :00

**Handles:**
- User reminders WHERE `notified = false AND remind_date <= CURRENT_DATE AND remind_time <= CURRENT_TIME`
- Creates notification row, sets `notified = true`

**Why separate?** Reminders have time precision (user can set 14:00). Daily job would miss afternoon reminders until next day. Hourly is sufficient — not second-precise, but good enough.

### 3.3 Duplicate Prevention

**Mechanism:** `ON CONFLICT DO NOTHING` on a unique constraint.

Add a **deduplication key** to `notifications`:

```
dedup_key TEXT UNIQUE — e.g., 'payment_due_soon::{payment_id}' or 'task_due_soon::{task_id}'
```

Cron jobs construct the dedup_key before INSERT:
```sql
INSERT INTO notifications (type, title, ..., dedup_key)
VALUES ('payment_due_soon', ..., 'payment_due_soon::' || payment_id)
ON CONFLICT (dedup_key) DO NOTHING;
```

**This prevents:** Running cron twice in a day from creating duplicate notifications. The dedup_key is unique per entity per notification type.

**For triggers (instant):** Triggers fire once per event — no duplicate risk. But add dedup_key anyway for safety: `'subscription_cancelled::' || NEW.id`.

### 3.4 Cron Setup Pattern

Following the exact pattern from `00053_tcmb_cron_setup.sql`:

```sql
-- Idempotent unschedule
DO $$ BEGIN
  PERFORM cron.unschedule('notification-daily-check');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule
SELECT cron.schedule(
  'notification-daily-check',
  '0 6 * * *',    -- 06:00 UTC = 09:00 Turkey
  $$ SELECT fn_create_scheduled_notifications(); $$
);
```

**Key difference from TCMB cron:** No Edge Function needed. The cron job calls a PostgreSQL function directly (simpler, no HTTP overhead, no cold starts).

### 3.5 Stale Notification Cleanup

**Cron Job 3:** `notification-cleanup-monthly` — runs 1st of each month at 04:00 UTC

**Action:** DELETE resolved notifications older than 90 days:
```sql
DELETE FROM notifications WHERE resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '90 days';
```

**Why:** Prevents table bloat. 90 days keeps enough history for auditing. Resolved notifications are invisible to users anyway.

---

## 4. Functions & Utilities

### 4.1 `get_notification_badge_count()` — Badge count

**Returns:** JSON with breakdown counts
**Called by:** Frontend on app load + after Realtime events
**Pattern:** Matches `get_subscription_stats()`

### 4.2 `fn_create_scheduled_notifications()` — Daily cron function

**Called by:** pg_cron daily at 09:00 Turkey
**Logic:**
1. Find payments due in 5 days → INSERT with dedup_key
2. Find renewals due in 5 days → INSERT with dedup_key
3. Find tasks due in 2 days → INSERT with dedup_key
4. Auto-resolve: Mark notifications as resolved where entity is now closed

Step 4 is important: if a payment was marked 'paid' between cron runs, the next cron run resolves its notification.

### 4.3 `fn_process_reminders()` — Hourly cron function

**Called by:** pg_cron hourly
**Logic:**
1. Find reminders WHERE `notified = false AND remind_date <= CURRENT_DATE AND remind_time <= LOCALTIME`
2. INSERT into notifications with type = 'user_reminder'
3. UPDATE user_reminders SET notified = true

### 4.4 `fn_resolve_notification()` — Manual resolve (RPC)

**Called by:** Frontend when user explicitly dismisses a stored notification
**Input:** notification_id UUID
**Action:** UPDATE notifications SET resolved_at = NOW() WHERE id = input

### 4.5 No archival strategy needed

Resolved notifications are invisible (filtered by `resolved_at IS NULL`). Monthly cleanup prevents bloat. No separate archive table needed. Keep it simple.

---

## 5. Integration Points

### 5.1 Frontend Data Fetching

**API layer:** `src/features/notifications/api.js`

| Function | Supabase Call |
|----------|---------------|
| `fetchActiveNotifications(page, pageSize)` | `supabase.from('v_active_notifications').select('*').order('created_at', { ascending: false }).range(...)` |
| `fetchBadgeCount()` | `supabase.rpc('get_notification_badge_count')` |
| `resolveNotification(id)` | `supabase.rpc('fn_resolve_notification', { notification_id: id })` |
| `fetchReminders()` | `supabase.from('user_reminders').select('*').order('remind_date')` |
| `createReminder(data)` | `supabase.from('user_reminders').insert(data)` |
| `completeReminder(id)` | `supabase.from('user_reminders').update({ completed_at: new Date() }).eq('id', id)` |

### 5.2 React Query Hooks — `src/features/notifications/hooks.js`

```
notificationKeys.badge()       → ['notifications', 'badge']
notificationKeys.list()        → ['notifications', 'list']
notificationKeys.reminders()   → ['notifications', 'reminders']

useNotificationBadge()         → useQuery → fetchBadgeCount
useActiveNotifications(page)   → useQuery → fetchActiveNotifications
useResolveNotification()       → useMutation → resolveNotification → invalidate badge + list
useReminders()                 → useQuery → fetchReminders
useCreateReminder()            → useMutation → createReminder → invalidate reminders
useCompleteReminder()          → useMutation → completeReminder → invalidate reminders + badge
```

### 5.3 Supabase Realtime

**Pattern:** Matches existing `useCalendarRealtime()` in `src/features/calendar/hooks.js`.

```
useNotificationRealtime() hook:
  Channel: 'notifications-realtime'
  Listens to: postgres_changes on `notifications` table (INSERT, UPDATE)
  On change: invalidateQueries(['notifications', 'badge']) + invalidateQueries(['notifications', 'list'])
```

This ensures the badge count updates instantly when a trigger fires (e.g., subscription cancelled → trigger inserts notification → Realtime fires → badge refreshes).

**Important:** Realtime only covers the `notifications` table (stored). For computed notifications (open work orders, etc.), the badge count function includes those counts, so a page refresh or periodic refetch (e.g., every 60 seconds) keeps them current. This is acceptable — work orders don't change every second.

### 5.4 Polling Fallback

For computed notification counts (which don't trigger Realtime events):

```
useNotificationBadge() with refetchInterval: 60000 (60 seconds)
```

Every 60 seconds, re-fetch badge count. This catches work orders being completed, proposals being sent, etc. Low overhead — it's a single RPC call returning a small JSON.

---

## 6. Frontend Components

### 6.1 New Files

```
src/features/notifications/
├── api.js                           # Supabase calls
├── hooks.js                         # React Query hooks
├── schema.js                        # Zod schema for reminder form
├── index.js                         # Barrel exports
├── components/
│   ├── NotificationBell.jsx         # Bell icon + badge (goes in AppLayout)
│   ├── NotificationDropdown.jsx     # Dropdown list when bell clicked
│   ├── NotificationItem.jsx         # Single notification row
│   └── ReminderFormModal.jsx        # Create reminder modal
```

### 6.2 Bell Icon Placement

**Location:** `src/app/AppLayout.jsx` → top bar, left of theme toggle button

**Behavior:**
- Shows bell icon (lucide-react `Bell`)
- Badge with count (red circle, number or "99+")
- Click → dropdown panel (not a new page)
- Dropdown shows latest 10 notifications, "View all" link to /notifications page (optional, can be Phase 1.5)

### 6.3 Translation File

`src/locales/tr/notifications.json` — all notification titles, types, action labels in Turkish.

---

## 7. Migration Plan

### Migration Order

| # | File | Content |
|---|------|---------|
| 1 | `00064_notifications.sql` | `notifications` table, `user_reminders` table, indexes, RLS, `dedup_key` unique constraint |
| 2 | `00065_notification_triggers.sql` | Trigger functions + triggers on subscriptions, work_orders, tasks, subscription_payments |
| 3 | `00066_notification_views_functions.sql` | `v_active_notifications` view, `get_notification_badge_count()`, `fn_resolve_notification()` |
| 4 | `00067_notification_cron.sql` | `fn_create_scheduled_notifications()`, `fn_process_reminders()`, pg_cron job schedules |

**Why 4 separate migrations?**
- Tables must exist before triggers reference them
- Triggers must exist before views query their results (though views don't depend on triggers technically — separation is for clarity)
- Cron jobs depend on functions existing
- If one part fails, you know exactly which step broke
- Rollback: drop in reverse order

### Rollback Strategy

Each migration should be reversible:
```sql
-- At top of migration, as a comment block:
-- ROLLBACK:
-- DROP VIEW IF EXISTS v_active_notifications;
-- DROP FUNCTION IF EXISTS get_notification_badge_count();
-- etc.
```

Not automated rollback — just documented. Matches existing pattern (no migrations have DOWN scripts).

### Testing Approach

1. **After 00064:** Verify tables created, insert test rows, check RLS (admin can see, field_worker cannot)
2. **After 00065:** Manually update a subscription status → verify notification row appears. Create work order → verify notification row appears.
3. **After 00066:** Call `get_notification_badge_count()` → verify JSON response. Query `v_active_notifications` → verify UNION ALL works.
4. **After 00067:** Check `cron.job` table for scheduled jobs. Manually call `fn_create_scheduled_notifications()` → verify no errors. Insert a reminder with past date → call `fn_process_reminders()` → verify notification created.

---

## 8. Potential Pitfalls

### 8.1 View Performance with Large Data

**Risk:** `v_active_notifications` with 5000+ rows from UNION ALL could be slow.
**Mitigation:** Each sub-query uses indexed columns (status, scheduled_date, sent_at). The view is only for the dropdown list (paginated, LIMIT 10-20). Badge count uses the separate optimized function, not the view.

### 8.2 Cron Job Timezone

**Risk:** pg_cron uses UTC. Turkey is UTC+3.
**Mitigation:** Schedule at 06:00 UTC = 09:00 Turkey. Already proven with TCMB cron (03:00 UTC = 06:00 Turkey). Use `CURRENT_DATE AT TIME ZONE 'Europe/Istanbul'` in queries if date boundaries matter.

### 8.3 Trigger Failures Blocking Transactions

**Risk:** If notification trigger fails, it could block the subscription update or work order creation.
**Mitigation:** Wrap trigger body in `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ... RETURN NEW; END;` — same pattern used in `fn_subscription_payment_to_finance` (00050). Never block the main operation for a notification.

### 8.4 assigned_to is UUID[] (Array)

**Risk:** Work order assigned_to is an array, not a single UUID. Future per-user notifications would need to unnest.
**Mitigation:** Phase 1 targets admin role, not individual users. When expanding to per-user, use `UNNEST(NEW.assigned_to)` to create one notification per worker.

### 8.5 Realtime Limits

**Risk:** Supabase Realtime has connection limits on free/pro plans.
**Mitigation:** Single channel for notifications (not one per type). Combined with 60-second polling for computed types. Minimal Realtime overhead.

---

## 9. Implementation Order (Recommended)

### Sprint 1: Foundation
1. Migration 00064 (tables)
2. Migration 00065 (triggers)
3. Migration 00066 (views + functions)
4. Migration 00067 (cron)

### Sprint 2: Frontend Core
5. `notifications/api.js` + `hooks.js` + `schema.js`
6. `NotificationBell.jsx` + `NotificationDropdown.jsx` in AppLayout
7. Realtime hook + polling setup
8. Translation file

### Sprint 3: User Reminders
9. `ReminderFormModal.jsx`
10. Integration with Daily Work page ("New Note" button)
11. Reminder CRUD (create, list, complete)

### Sprint 4: Polish
12. Dashboard widget updates (link existing stats to notification types)
13. Deep linking (click notification → navigate to entity)
14. Empty states, loading states, error handling
15. Mobile responsive dropdown

---

## 10. What This Plan Does NOT Include (Intentionally)

| Excluded | Reason |
|----------|--------|
| Push notifications (browser/mobile) | Not in concept doc; in-app only |
| Email/SMS notifications | Not in concept doc |
| Per-user notification preferences | Not needed — role-based is sufficient |
| Notification grouping/threading | Adds complexity; flat list is simpler |
| Phase 2 types (Parasut, iyzico) | Deferred until integrations exist |
| Separate /notifications page | Bell dropdown is sufficient for Phase 1; can add later |
| Low stock alerts | Explicitly excluded in concept doc |
