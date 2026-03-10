# Notification System — Concept Document

**Date:** 2026-02-13
**Status:** Concept / requirements gathering

---

## Phases

| Phase | Scope | Dependency |
|-------|-------|------------|
| **Phase 1** | Notifications working with existing data | None |
| **Phase 2** | Notifications requiring Parasut, Easycore/Istikor integration | After integrations are established |

---

## 1. Purpose

Enable users to see, remember, and prioritize tasks that require action. Open tasks must always be prominently visible.

---

## 2. Target Audience

| Role | Sees Notifications? |
|------|---------------------|
| Admin | Yes |
| Office staff (accountant, etc.) | Yes |
| Field worker (field_worker) | No — excluded for now |

---

## 3. Read / Unread

**No read/unread tracking.** What matters is whether the task is closed.

- **Open task** = Unclosed task
- A task remains open until the user marks it "completed" or "cancelled"
- The notification stays visible until the task is closed

---

## 4. Notification Types

### PHASE 1 — Working with existing data

#### 4.1 Open Work Orders

- **Definition:** Work orders that are not completed and not cancelled
- **Visibility:** Dashboard, Daily Work (/daily-work), notification center
- **Purpose:** How many open tasks exist, which ones are waiting — for planning and tracking
- **Feature:** Must always be visible, must stand out

#### 4.2 Overdue Work Orders

- **Definition:** Scheduled date (scheduled_date) has passed, work order still not completed/cancelled
- **Importance:** Very important — overdue work orders must be highlighted separately
- **Visibility:** Daily Work, notification center

#### 4.3 Proposals Awaiting Response

- **Definition:** Proposals awaiting customer response
- **Visibility:** Dashboard, notification center

#### 4.4 Proposal Waiting X Days for Response

- **Definition:** Sent proposals with no response; X = number of days shown
- **Threshold:** 2 days — notification if no response 2 days after sending
- **Visibility:** Dashboard, notification center

#### 4.5 Approved Proposals Not Yet Installed

- **Definition:** Proposal approved but no work order / installation created yet
- **Visibility:** Dashboard, notification center

#### 4.6 Subscription Cancellation / Pause

- **Trigger:** User cancels or pauses a subscription
- **Notification:** Instant (toast + recorded in notification center)
- **Example message (cancel):** "Cancel this number from Turkcell" — relevant phone number is shown
- **Example message (pause):** "Set this number to inactive at Turkcell" — relevant phone number is shown
- **Frequency:** One event = one notification (no repetition)

#### 4.7 Subscription Payment Due Soon

- **Definition:** Upcoming subscription payments (subscription_payments)
- **Threshold:** Notification 5 days before due date
- **Visibility:** Notification center

#### 4.7b Subscription Renewal Date Approaching

- **Definition:** Subscription period end / renewal date is approaching (monthly, 6-month, yearly)
- **Threshold:** Notification 5 days before renewal date
- **Visibility:** Notification center

#### 4.7c Work Order Assigned

- **Definition:** New work order created / assigned
- **Target:** Admin (for now); can be expanded to other teams later
- **Visibility:** Notification center

#### 4.8 Overdue / Upcoming Tasks

- **Definition:** Tasks that are overdue or approaching due date (e.g., installation date in 2 days)
- **Threshold:** Notification 2 days before due date
- **Notification:** One-time is sufficient
- **Visibility:** Notification center

#### 4.9 Today's Scheduled But Not Started Work Orders

- **Definition:** Work orders scheduled for today (scheduled_date = today) but not yet completed/cancelled
- **Purpose:** Daily work tracking — "This work was scheduled for today, not started" warning
- **Visibility:** Daily Work, notification center

#### 4.10 User Reminder Note

- **Definition:** User enters a manual note; selects a date; receives a reminder on that date
- **Example:** "X person called, need to send something to X person" — remind on the 15th
- **Location:** Notes are created from the Daily Work page; notification appears on the selected date
- **Target:** Admin (for now); can be expanded later
- **Visibility:** Notification center (when the date arrives)

---

### PHASE 2 — After Parasut / iyzico integration

*Cannot be tested until integrations are established; will be added after integration is complete.*

#### 4.11 Overdue Invoices & Uncollected Payments

- **Source:** Parasut
- **Target:** Overdue invoices; payments that are due but not collected

#### 4.12 Subscription Payment Received / Invoice Sent

- **Trigger:** When subscription payment is received (settlement with iyzico)
- **Example message:** "Subscription payment received from X person. Successful. Invoice sent."
- **Dependency:** Parasut + subscription integration

---

## 5. Display Locations

| Location | Content |
|----------|---------|
| **Daily Work (/daily-work)** | Main hub — open tasks, notes, notifications (Section 8) |
| **Dashboard** | Open task count, proposals awaiting response, proposals awaiting installation (widgets) |
| **Top-right bell icon** | Badge + notification list dropdown |
| **Sidebar** | Bell icon (optional) |

---

## 6. Badge / Count Display

- Total count is shown on the bell icon
- If the count is very large (e.g., 5000+), display as "5000+"
- What matters: notifying about open tasks

---

## 7. Exclusions

| Topic | Decision |
|-------|----------|
| Low stock (materials) | No notification needed since stock is not fully tracked |

---

## 8. Main Hub and UI Structure

### 8.1 Main Hub: Daily Work (/daily-work)

- **Decision:** Daily Work = main hub of the notification system
- **Rationale:** Day workers need to know what's open and what's not; planning will be managed from here
- **Future:** Will expand as a work planning center — planning days, preventing workers from leaving late (currently ~1 hour lost daily for planning)

### 8.2 Display Locations

| Location | Content |
|----------|---------|
| **Daily Work** | Main hub — open tasks, notes, notifications |
| **Dashboard** | Summary widgets (open task count, proposals, etc.) |
| **Top-right bell icon** | Badge + notification list dropdown |
| **Sidebar** | Bell icon (optional) |

### 8.3 Current Gap: Create New Note

- **Status:** Daily Work has "New work order"; has "New note"
- **New note:** User should be able to enter personal notes, not work orders
- **Fields:** Note text + due date (reminder date)
- **Time:** Optional. If no time entered -> notification at 9:00 AM. If time entered -> notification at specified time

### 8.4 Reminder Date Logic

| Time entered? | Notification time |
|---------------|-------------------|
| No | 9:00 AM on selected day |
| Yes | Selected day + specified time |

---

## 9. Backend Architecture

### 9.1 General Approach: Trigger + Cron

| Notification type | Trigger mechanism | Description |
|-------------------|-------------------|-------------|
| **Instant** (subscription cancel, work order assigned) | DB Trigger | INSERT into `notifications` table when event occurs |
| **Scheduled** (2 days proposal, 5 days subscription, reminder note) | Cron | Daily/hourly job; runs query, adds matching records to notifications |

### 9.2 Supabase Options

| Method | Pros | Cons |
|--------|------|------|
| **pg_cron** | Inside DB, set up via migration | May require Supabase Pro |
| **Edge Function + Cron** | Supabase's own cron | Separate deploy, cold start |
| **External cron** (GitHub Actions, Vercel Cron) | Independent | Additional service |

**Recommendation:** Prefer pg_cron if available; otherwise Edge Function or external cron.

### 9.3 Data Model (Summary)

- **notifications** table: type, title, body, related_entity_type, related_entity_id, target_user_id, created_at, trigger_at (for scheduled)
- **user_reminders** table: User reminder notes — content, remind_at (date), remind_at_time (optional, default 09:00), created_by

### 9.4 Where is the Center?

- **Data center:** `notifications` table — all notifications are collected here
- **UI center:** Daily Work page — main hub
- **Triggers:** On work_orders, subscriptions, proposals, etc. tables; INSERT notification on event
- **Cron:** Runs at 9:00 AM (or hourly); queries for "today's reminders", "proposals waiting 2+ days for response", etc., and inserts into notifications

---

## 10. Summary of Decisions (Business Rules)

| Topic | Decision |
|-------|----------|
| Target audience | Admin + office; no field workers |
| Read/unread | None; what matters is task closure |
| Open task definition | Not completed and not cancelled |
| Subscription notification | Instant on cancel/pause, single notification |
| Badge count | Unlimited; "5000+" display accepted |
| Overdue work order | Very important; must be highlighted separately |
| User reminder note | For admin; manual note + date |
| Proposal 2 days, task 2 days, subscription 5 days | Thresholds set |
| Proposal rejected | No notification |
| Stock | Not included |

---

## 11. Confirmed Thresholds and Rules

| Topic | Decision |
|-------|----------|
| Who gets reminder notes? | Assigned to admin. Admin for now; can be expanded later. |
| Proposal "waiting X days for response" threshold | 2 days. Notification if no response 2 days after sending. |
| Task "approaching" threshold | Notification 2 days before due date. |
| Subscription payment "approaching" threshold | Notification 5 days before due date. |
| Subscription renewal date | Notification 5 days before renewal date. (Monthly, 6-month, yearly periods) |
| Work order assigned | Notification to admin. Admin for now; can be expanded to other teams later. |

### Exclusions

| Topic | Decision |
|-------|----------|
| Proposal rejected | Not needed. User will already click "rejected" themselves. |

---

## 12. Open Items

| Topic | Status |
|-------|--------|
| Missing account number, missing phone number, missing fields | Not enough information; left as open item. |

---

## 13. Next Steps

1. **Database:** notifications, user_reminders tables; triggers
2. **Cron:** pg_cron or Edge Function — for scheduled notifications
3. **Daily Work:** "Create new note" button and form (note + date + optional time)
4. **Bell icon:** Top-right; badge + dropdown
5. **Phase 1 implementation plan** (priority order)
