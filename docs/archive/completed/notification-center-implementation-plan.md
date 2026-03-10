# Notification Center — Implementation Plan

**Purpose:** Full notification center page + nav + filters, aligned with app patterns and style.  
**Audience:** Admin and accountant only (same as existing bell).

---

## 1. App patterns used (reference)

| Area | Pattern in this app |
|------|---------------------|
| **List pages** | `PageContainer` → `PageHeader` (title, optional actions) → filters (URL via `useSearchParams`) → list/table → `EmptyState` / `ErrorState` / Skeleton |
| **Filters** | `searchParams.get('key')` with default; `setSearchParams` in handler; hook receives object (e.g. `{ status, period }`) |
| **API** | `features/<name>/api.js` — `fetchX(filters)`; pagination with `.range(from, to)` where needed |
| **Hooks** | `features/<name>/hooks.js` — `useX(filters)`, queryKey includes filter params; mutations invalidate relevant queryKeys |
| **i18n** | `locales/tr/<feature>.json`; `useTranslation('notifications')`; keys under `notifications.*` |
| **Routes** | `App.jsx` — add `Route path="notifications" element={...}` under protected layout |
| **Breadcrumb** | `lib/breadcrumbConfig.js` — `getRootLabel(seg)` map; add `notifications` segment |
| **Nav** | `navItems.js` — flat item `{ to, icon, labelKey }`; Sidebar/MobileNavDrawer use `visibleNavItems`; optional `adminOnly` or role-based visibility |
| **Access** | `hasNotificationAccess = isAdmin \|\| currentProfile?.role === 'accountant'` (already in AppLayout for bell) |

---

## 2. Backend (Supabase)

### 2.1 Current state

- **`v_active_notifications`** — view returns only **undone** items (computed + stored where `resolved_at IS NULL`). No date filter; no “done” set.
- **`notifications`** table — has `resolved_at`; when set, row is no longer in `v_active_notifications`.
- **Computed** items (open WO, overdue, proposals, etc.) have no “done” row in DB; they disappear when the entity state changes.

### 2.2 Required backend work

| # | Task | Notes |
|---|------|--------|
| B1 | **Resolved/done list** | Need a way to fetch **resolved** notifications. Options: (a) New view `v_resolved_notifications` on `notifications WHERE resolved_at IS NOT NULL` with same column shape as active view for consistency, or (b) Direct select from `notifications` with `resolved_at IS NOT NULL`, ordered by `resolved_at DESC`. RLS already allows admin/accountant to read. Prefer (b) to avoid view proliferation; ensure `related_entity_type`, `related_entity_id`, `title`, `body`, `type` (as `notification_type`), `created_at`, `resolved_at`, `id` are selectable. |
| B2 | **Time filter (optional but recommended)** | For **active**: filter by `created_at` (e.g. today, this week, older). View doesn’t support params; options: (1) RPC that accepts time window and returns active + resolved as needed, or (2) Fetch a reasonable window (e.g. last 90 days) and filter **client-side** for “Bugün / Bu hafta / Daha eski”. For **resolved**: filter by `resolved_at`. Recommendation: **Phase 1** — client-side time filter on existing payloads (fetch active from view, resolved from `notifications` with limit); **Phase 2** — add RPC with date params if list gets large. |

### 2.3 API functions to add (in `notifications/api.js`)

- **`fetchResolvedNotifications(page, pageSize)`**  
  - Select from `notifications` where `resolved_at IS NOT NULL`, order by `resolved_at DESC`, `.range(from, to)`.  
  - Return rows with fields compatible with `NotificationItem`: `notification_type` (= `type`), `title`, `body`, `entity_type` (= `related_entity_type`), `entity_id` (= `related_entity_id`), `created_at`, `resolved_at`, `notification_id` (= `id`), `notification_source` = `'stored'`.

No change to `v_active_notifications` or `get_notification_badge_count()` for Phase 1.

---

## 3. Frontend — File-by-file plan

### 3.1 Notifications feature (existing)

| File | Change |
|------|--------|
| **`api.js`** | Add `fetchResolvedNotifications(page, pageSize)` (see 2.3). Optionally add `fetchActiveNotifications(page, pageSize, timeWindow)` later if backend supports it; for Phase 1 keep current signature and filter by time in frontend. |
| **`hooks.js`** | Add `useResolvedNotifications(page)` with queryKey `[...notificationKeys.all, 'resolved', page]`. Add `useNotificationsList({ resolved, page, timeFilter })` that: when `resolved === false` uses `useActiveNotifications(page)` and when `resolved === true` uses `useResolvedNotifications(page)`; optionally apply client-side `timeFilter` (today / this week / older) to the combined or separate list. Keep existing `useNotificationBadge`, `useResolveNotification`, realtime. |
| **`components/NotificationItem.jsx`** | Add a **type badge** (job type) on each row: e.g. `<Badge variant="..." className="...">{t('types.' + notification_type)}</Badge>` so “type of job” is visible. Reuse existing `ICON_MAP` and `notifications.types.*` from locales. For resolved items, no “resolve” button; optionally show `resolved_at` as secondary text. |
| **`components/NotificationDropdown.jsx`** | Add footer with “Tümünü gör” (`actions.viewAll`) linking to `/notifications` (e.g. `<Link to="/notifications" onClick={onClose}>` or `useNavigate` + `onClose`). |

### 3.2 New page and components

| File | Purpose |
|------|--------|
| **`NotificationsCenterPage.jsx`** (new) | Full notification center page. Structure: `PageContainer` → `PageHeader` (title from i18n) → filter bar (Done/Undone + Time) → list (reuse `NotificationItem` in a list layout) → pagination or “Load more”. Use `useSearchParams` for `resolved` (undone/done) and `time` (all / today / week / older). Default: undone, time = all (or this week). Loading: list skeleton (e.g. 5–8 row placeholders). Empty: `EmptyState` with message from i18n. Error: `ErrorState` with retry. |
| **`components/NotificationListFilters.jsx`** (new, optional) | Encapsulate filter UI: segment or Select for “Bekleyen / Tamamlanan”, Select for “Bugün / Bu hafta / Daha eski / Tümü”. Call `onFilterChange(key, value)` that parent maps to `setSearchParams`. Can be inlined in page for simplicity. |

### 3.3 List format

- Do **not** use the generic `Table` component for this screen; use a **vertical list** of rows (same as dropdown content): each row is a `NotificationItem` (or a wrapper div with border) so the layout matches the bell dropdown and stays scannable.
- Each row shows: **type badge** (job type) + icon + title + body + time + resolve (if undone and stored). Click row → navigate to entity; resolve button only for stored undone.

### 3.4 Routing and layout

| File | Change |
|------|--------|
| **`App.jsx`** | Import `NotificationsCenterPage` from `features/notifications`. Add `<Route path="notifications" element={<NotificationsCenterPage />} />` inside the protected `AppLayout` route group. |
| **`lib/breadcrumbConfig.js`** | In `getRootLabel(seg)`, add `notifications: { labelKey: 'common:nav.notifications', to: '/notifications' }`. |

### 3.5 Navigation (sidebar + mobile)

| File | Change |
|------|--------|
| **`navItems.js`** | Add a top-level item: `{ to: '/notifications', icon: Bell, labelKey: 'nav.notifications' }`. Placement: e.g. after “proposals” and before the first group. Add a way to show this item only to admin + accountant: e.g. `notificationCenter: true` (and in Sidebar/MobileNavDrawer filter by `hasNotificationAccess` for that item), or add `roles: ['admin', 'accountant']` and filter by `currentProfile?.role`. Recommendation: add `roles: ['admin', 'accountant']` and in both Sidebar and MobileNavDrawer compute `visibleNavItems` so that items with `roles` are only shown when `currentProfile?.role` is in `roles`. |
| **`Sidebar.jsx`** | When building `visibleNavItems`, exclude nav items where `item.roles` is defined and `currentProfile?.role` is not in `item.roles`. Keep existing `adminOnly` logic. |
| **`MobileNavDrawer.jsx`** | Same visibility rule as Sidebar for `roles`. |
| **`locales/tr/common.json`** | Under `nav`, add `"notifications": "Bildirimler"`. |

**Alternative (simpler):** Add `notificationCenter: true` to the new nav item. In Sidebar and MobileNavDrawer, use the same `hasNotificationAccess` as AppLayout (e.g. import from a small util or duplicate `isAdmin || currentProfile?.role === 'accountant'`). Then `visibleNavItems = navItems.filter(item => ... && (!item.notificationCenter || hasNotificationAccess))`.

### 3.6 i18n

| File | Keys to add |
|------|-------------|
| **`locales/tr/notifications.json`** | `page.title`: "Bildirimler"; `filters.undone`: "Bekleyen", `filters.done`: "Tamamlanan", `filters.timeAll`: "Tümü", `filters.timeToday`: "Bugün", `filters.timeThisWeek`: "Bu hafta", `filters.timeOlder`: "Daha eski"; `empty.undone`: "Şu an dikkat gerektiren bildirim yok.", `empty.done`: "Bu dönemde tamamlanan bildirim yok." (or reuse one message). |

---

## 4. Phased rollout (how many phases)

We need **3 phases**. Each phase is testable on its own.

| Phase | Name | Goal | Deliverables |
|-------|------|------|---------------|
| **1** | Data & API | Backend can return “done” notifications; frontend can fetch active and resolved with filters. | Backend: direct select from `notifications` (resolved). `api.js`: `fetchResolvedNotifications`. `hooks.js`: `useResolvedNotifications`, list hook with `resolved` + optional client-side `timeFilter`. |
| **2** | Center page & list UI | Full notification center page at `/notifications` with list, filters, and type badge. | `NotificationItem`: type badge, resolved state (no resolve button). `NotificationsCenterPage`: page, filters (Bekleyen/Tamamlanan + time), list, empty/error/loading, pagination. i18n keys (page, filters, empty). Route in `App.jsx`. Breadcrumb in `breadcrumbConfig.js`. |
| **3** | Discovery (nav & bell) | Users can open the center from sidebar, mobile menu, and bell. | “Bildirimler” in `navItems` with admin/accountant visibility. Sidebar + MobileNavDrawer: filter by `notificationCenter` or `roles`. `common.json`: `nav.notifications`. NotificationDropdown: “Tümünü gör” link to `/notifications`. |

**Why 3 phases**

- **Phase 1** — No UI change; you only add data and hooks. You can verify with a temporary route or dev tools that resolved notifications load.
- **Phase 2** — The center page is usable at `/notifications` (e.g. via direct URL). No nav yet, so it’s safe to test layout, filters, and list.
- **Phase 3** — Discovery only: nav + “Tümünü gör”. Small, low-risk changes.

**Optional:** If you want to split “page” from “routing,” you could do **4 phases**: 1 = Data & API, 2 = NotificationItem + NotificationsCenterPage (no route), 3 = Route + breadcrumb, 4 = Nav + dropdown. The 3-phase version keeps route and page together so you can test the full page as soon as it exists.

---

## 5. Implementation order (by phase)

**Phase 1**  
1. Backend: ensure `notifications` is queryable with `resolved_at IS NOT NULL` (RLS allows).  
2. `api.js`: add `fetchResolvedNotifications(page, pageSize)`.  
3. `hooks.js`: add `useResolvedNotifications(page)` and list hook (active vs resolved + client-side time).

**Phase 2**  
4. `NotificationItem.jsx`: type badge; resolved state (no resolve button).  
5. `NotificationsCenterPage.jsx`: new page with URL filters, filter UI, list, empty/error/loading, pagination.  
6. i18n: `notifications.json` (page, filters, empty).  
7. `App.jsx`: route `path="notifications"`.  
8. `breadcrumbConfig.js`: notifications segment.

**Phase 3**  
9. `navItems.js`: add Bildirimler with `notificationCenter: true` (or `roles`).  
10. `Sidebar.jsx` + `MobileNavDrawer.jsx`: visibility for notification item.  
11. `common.json`: `nav.notifications`.  
12. `NotificationDropdown.jsx`: “Tümünü gör” link.

---

## 6. Edge cases and consistency

- **Access:** Notifications center route should be protected and only useful for admin/accountant; bell is already hidden for others. Optional: redirect non–admin/accountant from `/notifications` to `/` (or 404) so the URL is not usable if someone types it.
- **Realtime:** Existing `useNotificationRealtime` invalidates badge and list; keep that so the center list updates when new notifications arrive or are resolved.
- **Pagination:** Active and resolved lists: use same page size (e.g. 20); “Load more” or next/prev buttons; queryKey includes page so switching filters refetches.
- **Time filter:** Applied client-side in Phase 1: after fetching a page, filter rows by `created_at` (active) or `resolved_at` (resolved) for today / this week / older. If result is empty, show empty state for that filter. Optionally fetch more data (e.g. 100 items) when time filter is used so “this week” has enough rows; or keep simple and show “no items in this period” when filtered list is empty.

---

## 7. Summary checklist

| # | Item | Owner |
|---|------|--------|
| 1 | Backend: query resolved notifications (view or direct select) | Migration or RPC + api.js |
| 2 | api.js: `fetchResolvedNotifications` | notifications |
| 3 | hooks.js: `useResolvedNotifications`, list hook with resolved + time | notifications |
| 4 | NotificationItem: type badge; resolved state | notifications |
| 5 | NotificationsCenterPage: page + filters + list | notifications |
| 6 | App.jsx: route `/notifications` | app |
| 7 | breadcrumbConfig: notifications segment | lib |
| 8 | navItems: Bildirimler + visibility (admin/accountant) | layout |
| 9 | Sidebar + MobileNavDrawer: show item only for admin/accountant | layout |
| 10 | common.json: nav.notifications | locales |
| 11 | notifications.json: page title, filters, empty messages | locales |
| 12 | NotificationDropdown: “Tümünü gör” → /notifications | notifications |

This plan keeps the app’s existing style (feature module, api/hooks, PageContainer, URL-driven filters, i18n, list over table for this screen) and adds the minimum needed for a full notification center with list format, job type visible, and done/undone + time filters.
