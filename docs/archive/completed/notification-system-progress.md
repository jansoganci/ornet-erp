# Notification System — Phase-by-Phase Implementation Plan

**Date:** 2026-02-13  
**Purpose:** Collaborative implementation guide. Each phase is self-contained so we can say "implement Phase 2" and execute step-by-step.

**Source docs:** notification-system-concept.md, notification-system-architecture.md, notification-system-ui-plan.md

---

## Prerequisites (verify before starting)

- `get_my_role()` exists (00001_profiles.sql)
- `work_orders`, `proposals`, `proposal_work_orders`, `subscriptions`, `subscription_payments`, `tasks`, `sim_cards` tables exist
- `sim_cards.operator` = sim_operator enum (TURKCELL, VODAFONE, TURK_TELEKOM)
- `subscriptions.sim_card_id` exists (00055)
- pg_cron enabled (00053_tcmb_cron_setup.sql)
- Pattern reference: `src/features/calendar/hooks.js` → useCalendarRealtime
- Pattern reference: `src/app/AppLayout.jsx` → topbar `<div className="flex items-center gap-2">` before theme toggle

---

## Phase 1: Backend — Migration 00064 (tables)

**File:** `supabase/migrations/00064_notifications.sql`

**Steps:**

1. **Create `notifications` table**
   - Columns: id, type, title, body, related_entity_type, related_entity_id, target_role, created_by, resolved_at, created_at, **dedup_key** (TEXT UNIQUE)
   - type CHECK: subscription_cancelled, subscription_paused, payment_due_soon, renewal_due_soon, work_order_assigned, task_due_soon, user_reminder
   - related_entity_type CHECK: work_order, proposal, subscription, subscription_payment, task, reminder
   - target_role CHECK: admin, accountant (nullable = all eligible)
   - Indexes: idx_notifications_active (resolved_at WHERE resolved_at IS NULL), idx_notifications_type, idx_notifications_entity, idx_notifications_created
   - RLS: SELECT/INSERT/UPDATE for admin+accountant; DELETE admin only; use get_my_role()

2. **Create `user_reminders` table**
   - Columns: id, **title** (TEXT NOT NULL), content (TEXT), remind_date (DATE), remind_time (TIME DEFAULT '09:00'), completed_at, notified (BOOLEAN DEFAULT false), created_by, created_at, updated_at
   - **Note:** Add `title` — UI plan ReminderFormModal requires it; architecture had only content
   - Indexes: idx_reminders_pending (remind_date, remind_time) WHERE notified = false AND completed_at IS NULL; idx_reminders_created_by
   - RLS: SELECT created_by = auth.uid() OR admin; INSERT admin+accountant; UPDATE/DELETE created_by or admin
   - Trigger: update_updated_at_column on UPDATE

3. **GRANT** SELECT, INSERT, UPDATE, DELETE on both tables to authenticated where policies allow

**Verification:** Run migration; insert test row into notifications; confirm RLS blocks field_worker.

---

## Phase 2: Backend — Migration 00065 (triggers)

**File:** `supabase/migrations/00065_notification_triggers.sql`

**Steps:**

1. **`fn_notify_subscription_status_change()`**
   - Table: subscriptions, AFTER UPDATE
   - Condition: OLD.status != NEW.status AND NEW.status IN ('cancelled', 'paused')
   - INSERT notifications: type = subscription_cancelled|subscription_paused; title = company name from customer_sites→customers; body = phone from sim_cards + "Cancel this number from [operator]" or "Set this number to inactive at [operator]"; related_entity_type = 'subscription'; related_entity_id = NEW.id; dedup_key = 'subscription_cancelled::' || NEW.id (or paused)
   - Wrap in BEGIN...EXCEPTION WHEN OTHERS THEN RAISE WARNING; RETURN NEW; END (never block main tx)

2. **`fn_notify_work_order_assigned()`**
   - Table: work_orders, AFTER INSERT
   - INSERT notifications: type = work_order_assigned; title = form_no || ' ' || work_type; body = customer name, site name, scheduled_date (from customers, customer_sites JOIN); related_entity_type = 'work_order'; related_entity_id = NEW.id; target_role = 'admin'; dedup_key = 'work_order_assigned::' || NEW.id

3. **`fn_resolve_notification_on_entity_close()`**
   - Generic function using TG_TABLE_NAME, TG_OP
   - work_orders: status → completed|cancelled → UPDATE notifications SET resolved_at = now() WHERE related_entity_type = 'work_order' AND related_entity_id = OLD.id
   - tasks: same for task
   - subscription_payments: status changes from 'pending' → resolve WHERE related_entity_type = 'subscription_payment' AND related_entity_id = OLD.id
   - Triggers: AFTER UPDATE on work_orders, tasks, subscription_payments

**Verification:** Update subscription status to cancelled → notification row appears. Create work order → notification row appears.

---

## Phase 3: Backend — Migration 00066 (views + functions)

**File:** `supabase/migrations/00066_notification_views_functions.sql`

**Steps:**

1. **Create `v_active_notifications` view**
   - UNION ALL of 8 sections (architecture §1.3):
     - Section 1–6: computed from work_orders, proposals (with proposal_work_orders check)
     - Section 7: FROM notifications WHERE resolved_at IS NULL
     - Section 8: FROM user_reminders WHERE notified = true AND completed_at IS NULL
   - Unified columns: notification_source ('computed'|'stored'), notification_type, title, body, entity_type, entity_id, created_at, notification_id (NULL for computed, id for stored)
   - For computed: entity_id = work_order.id or proposal.id; notification_id = NULL
   - For stored: entity_type/entity_id from notifications; notification_id = notifications.id
   - For reminders: entity_type = 'reminder', entity_id = user_reminders.id
   - GRANT SELECT to authenticated

2. **Create `get_notification_badge_count()`**
   - RETURNS JSON: { total, open_work_orders, overdue_work_orders, proposals_waiting, stored_notifications, reminders }
   - Each = separate COUNT(*) with WHERE (no UNION). Sum for total.
   - proposals_waiting = sent + no_response_2d + approved_no_wo (or similar breakdown)
   - Only count for users where get_my_role() IN ('admin','accountant') — return zeros for field_worker
   - GRANT EXECUTE to authenticated

3. **Create `fn_resolve_notification(notification_id UUID)`**
   - UPDATE notifications SET resolved_at = now() WHERE id = notification_id
   - SECURITY DEFINER; check get_my_role() IN ('admin','accountant')
   - GRANT EXECUTE to authenticated

**Verification:** SELECT * FROM v_active_notifications; SELECT get_notification_badge_count();

---

## Phase 4: Backend — Migration 00067 (cron)

**File:** `supabase/migrations/00067_notification_cron.sql`

**Steps:**

1. **`fn_create_scheduled_notifications()`**
   - Payment due soon: subscription_payments WHERE status = 'pending' AND payment_month BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days' → INSERT with dedup_key = 'payment_due_soon::' || id; use related_entity_type='subscription', related_entity_id=subscription_id (so frontend navigates to /subscriptions/:id)
   - Renewal due soon: subscriptions WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days' → INSERT with dedup_key = 'renewal_due_soon::' || id
   - Task due soon: tasks WHERE status NOT IN ('completed','cancelled') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days' → INSERT with dedup_key = 'task_due_soon::' || id
   - Auto-resolve: UPDATE notifications SET resolved_at = now() WHERE related entity is now closed (payment paid, task completed, etc.)
   - Use ON CONFLICT (dedup_key) DO NOTHING

2. **`fn_process_reminders()`**
   - user_reminders WHERE notified = false AND remind_date <= CURRENT_DATE AND (remind_time <= LOCALTIME OR remind_time IS NULL)
   - INSERT notification (type = user_reminder, title from user_reminders.title, body from content)
   - UPDATE user_reminders SET notified = true
   - dedup_key = 'user_reminder::' || user_reminders.id

3. **Schedule pg_cron jobs**
   - notification-daily-check: '0 6 * * *' (06:00 UTC = 09:00 Turkey) → fn_create_scheduled_notifications
   - notification-reminder-check: '0 * * * *' (hourly) → fn_process_reminders
   - notification-cleanup-monthly: '0 4 1 * *' (1st of month 04:00 UTC) → DELETE notifications WHERE resolved_at < now() - interval '90 days'
   - Idempotent unschedule before schedule (DO $$ BEGIN PERFORM cron.unschedule(...); EXCEPTION WHEN OTHERS THEN NULL; END $$;)

**Verification:** Manually call fn_create_scheduled_notifications(); fn_process_reminders(); check cron.job table.

---

## Phase 5: Frontend — Data layer

**Files:** `src/features/notifications/api.js`, `hooks.js`, `schema.js`, `index.js`

**Steps:**

1. **api.js**
   - fetchActiveNotifications(page, pageSize) → from('v_active_notifications').select('*').order('created_at', { ascending: false }).range(...)
   - fetchBadgeCount() → rpc('get_notification_badge_count')
   - resolveNotification(id) → rpc('fn_resolve_notification', { notification_id: id })
   - fetchReminders() → from('user_reminders').select('*').order('remind_date')
   - createReminder({ title, content, remind_date, remind_time, created_by }) → insert
   - completeReminder(id) → update({ completed_at: new Date().toISOString() }).eq('id', id)

2. **hooks.js**
   - notificationKeys: badge(), list(page), reminders()
   - useNotificationBadge() → useQuery, queryKey badge(), queryFn fetchBadgeCount, refetchInterval: 60000
   - useActiveNotifications(page) → useQuery, pageSize 20
   - useResolveNotification() → useMutation, invalidate badge + list
   - useReminders() → useQuery
   - useCreateReminder() → useMutation, invalidate reminders
   - useCompleteReminder() → useMutation, invalidate reminders + badge
   - useNotificationRealtime() → supabase.channel('notifications-realtime').on('postgres_changes', { table: 'notifications' }, () => invalidateQueries badge + list).subscribe(); return cleanup

3. **schema.js**
   - reminderSchema: title min(1) max(100), content max(500) optional, remind_date string, remind_time optional
   - reminderDefaultValues

4. **index.js** — barrel export api, hooks, schema, components (when created)

5. **i18n:** Add `notifications` to src/lib/i18n.js namespaces

**Verification:** useNotificationBadge() returns data; useActiveNotifications() returns list.

---

## Phase 6: Frontend — Translation file

**File:** `src/locales/tr/notifications.json`

**Content:** Full keys from notification-system-ui-plan.md §10 (title, bell.label, empty, error, actions, types.*, reminder.*)

**Verification:** t('notifications:title') renders "Bildirimler".

---

## Phase 7: Frontend — NotificationItem + NotificationDropdown + NotificationBell

**Files:**
- `src/features/notifications/components/NotificationItem.jsx`
- `src/features/notifications/components/NotificationDropdown.jsx`
- `src/features/notifications/components/NotificationBell.jsx`

**Steps:**

1. **NotificationItem.jsx**
   - Props: notification_type, title, body, entity_type, entity_id, created_at, notification_id, notification_source, onResolve, onNavigate
   - Icon map per notification_type (Wrench, AlertTriangle, Clock, FileText, etc.) — see UI plan §3
   - formatDistanceToNow(created_at, { addSuffix: true, locale: tr })
   - Resolve button: only if notification_source === 'stored' && notification_id; onClick stopPropagation, onResolve(id)
   - onClick: navigate by entity_type (work_order→/work-orders/:id, proposal→/proposals/:id, subscription→/subscriptions/:id, task→/tasks, reminder→no nav); then onNavigate() to close dropdown

2. **NotificationDropdown.jsx**
   - Props: isOpen, onClose, total
   - Desktop (lg+): absolute right-0 top-full mt-2 z-50 w-[400px] max-h-[min(600px,70vh)], popover
   - Mobile (<lg): createPortal, bottom sheet (MobileNavDrawer pattern), handle bar, backdrop
   - useActiveNotifications(1) for first page
   - Header: title + total; body: map to NotificationItem; Loading: Skeleton rows; Empty: Bell icon + "Bildirim yok"; Error: retry button
   - useRef + mousedown for click-outside (desktop)
   - Escape key to close

3. **NotificationBell.jsx**
   - useState isOpen; useNotificationBadge(); useNotificationRealtime()
   - IconButton with Bell, variant ghost; badge when total > 0 (red circle, number or "99+")
   - Renders NotificationDropdown when isOpen
   - Only render if get_my_role in (admin, accountant) — use useCurrentProfile or similar to hide for field_worker

**Verification:** Bell shows badge; click opens dropdown; click item navigates.

---

## Phase 8: Frontend — AppLayout integration

**File:** `src/app/AppLayout.jsx`

**Steps:**

1. Import NotificationBell from notifications feature
2. Add NotificationBell inside `<div className="flex items-center gap-2">` **before** the theme toggle IconButton (line ~96)
3. Gate: only show if hasNotificationAccess (admin or accountant) — reuse hasFinanceAccess pattern or add role check

**Verification:** Bell visible in topbar for admin/accountant; hidden for field_worker.

---

## Phase 9: Frontend — ReminderFormModal

**File:** `src/features/notifications/components/ReminderFormModal.jsx`

**Steps:**

1. Modal size="sm", props: open, onClose
2. react-hook-form + zodResolver(reminderSchema)
3. Fields: title (Input, required), content (Textarea, optional), remind_date (Input type="date", min=today), remind_time (Input type="time", optional, default "09:00")
4. Footer: Cancel, Save
5. onSubmit: createReminder({ title, content: data.content || '', remind_date, remind_time: data.remind_time || '09:00', created_by: currentUser.id }); toast.success; onClose; reset
6. useCreateReminder mutation

**Verification:** Open modal, fill form, save → reminder in user_reminders.

---

## Phase 10: Frontend — DailyWorkListPage integration

**File:** `src/features/workOrders/DailyWorkListPage.jsx`

**Steps:**

1. Add state: reminderModalOpen
2. Add "+ Hatırlatma Ekle" Button (variant outline, size sm) below worker filter row, right-aligned
3. Add "Hatırlatmalarım" section between work order cards and TodayPlansSection — only when selectedDate === todayIso
4. useReminders() → filter completed_at IS NULL
5. Reminder row: checkbox (Circle→Check on complete), title, formatted date + time; onClick complete → useCompleteReminder
6. Render ReminderFormModal when reminderModalOpen
7. Fade-out animation on complete (opacity-0 300ms then remove)

**Verification:** Daily Work shows reminder button; create reminder; see in list; complete removes it.

---

## Testing Checklist (run after all phases)

- [ ] Backend: Update subscription to cancelled → notification row in DB
- [ ] Backend: Create work order → notification row in DB
- [ ] Backend: Call fn_create_scheduled_notifications() → no error
- [ ] Backend: Call fn_process_reminders() with past-due reminder → notification created
- [ ] Frontend: Badge shows correct total (admin/accountant)
- [ ] Frontend: Badge hidden for field_worker
- [ ] Frontend: Click notification → navigates to work order / proposal / subscription
- [ ] Frontend: Resolve button on stored notification → item disappears
- [ ] Frontend: Create reminder from Daily Work → appears in list
- [ ] Frontend: Complete reminder → fades out, badge updates

---

## Open Issues

- **user_reminders.title:** Added in Phase 1 migration. ReminderFormModal uses title; API createReminder sends title. Cron fn_process_reminders uses title for notification.
