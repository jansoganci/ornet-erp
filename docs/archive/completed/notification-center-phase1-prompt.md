# Notification Center — Phase 1 Implementation Prompt

Copy the prompt below and use it to implement **Phase 1 only** (Data & API). No UI, no new pages, no routes.

---

## Prompt (copy from here)

You are implementing **Phase 1** of the Notification Center for Ornet ERP.

**Scope — do only this:**
- Add support for fetching **resolved** (done) notifications from the backend.
- Add a **list hook** that returns either active or resolved notifications and supports an optional **client-side time filter** (today / this week / older).
- Do **not** add any new pages, routes, components, or UI. Do **not** change existing components (NotificationBell, NotificationDropdown, NotificationItem). Do **not** change `useActiveNotifications`, `useNotificationBadge`, or `useResolveNotification`.

**Project context:**
- Feature lives in `src/features/notifications/`.
- API: `src/features/notifications/api.js` (Supabase).
- Hooks: `src/features/notifications/hooks.js` (React Query). Query keys live in `notificationKeys`; list keys use `notificationKeys.list(page)` for active.
- The `notifications` table has: `id`, `type`, `title`, `body`, `related_entity_type`, `related_entity_id`, `resolved_at`, `created_at`. RLS allows SELECT for users with role admin or accountant. There is no new migration: query the existing table.

**Tasks:**

1. **`api.js`** — Add a function `fetchResolvedNotifications(page = 1, pageSize = 20)`.
   - Query the `notifications` table (not the view): `where('resolved_at', 'not.is', null)`, order by `resolved_at` descending, then apply `.range(from, to)` for the page.
   - Return each row in the **same shape** as `v_active_notifications` so existing `NotificationItem` can consume it later. Map: `type` → `notification_type`, `related_entity_type` → `entity_type`, `related_entity_id` → `entity_id`, `id` → `notification_id`. Add `notification_source: 'stored'` to every row. Include `resolved_at` and `created_at`. If the table returns snake_case, normalize to the names used by the active view (`notification_type`, `entity_type`, `entity_id`, `notification_id`).

2. **`hooks.js`** — Add:
   - **Query key:** Extend `notificationKeys` with `resolved: (page) => [...notificationKeys.all, 'resolved', page ?? 1]`.
   - **`useResolvedNotifications(page = 1)`** — useQuery with `queryKey: notificationKeys.resolved(page)`, `queryFn: () => fetchResolvedNotifications(page, 20)`, `enabled: isSupabaseConfigured`. Same pattern as `useActiveNotifications`.
   - **`useNotificationsList({ resolved, page = 1, timeFilter })`** — A single hook that:
     - When `resolved === false`: use `useActiveNotifications(page)` and return its data (and isLoading, error, refetch). Optionally apply **client-side** time filter to the list: `timeFilter` one of `'all' | 'today' | 'this_week' | 'older'`. Filter the array by `created_at` (start of today, start of this week, etc.). If `timeFilter` is `'all'` or undefined, return data as-is.
     - When `resolved === true`: use `useResolvedNotifications(page)` and return its data (and isLoading, error, refetch). Optionally apply the same **client-side** time filter to the list using `resolved_at` instead of `created_at`.
     - Return a stable shape: `{ data, isLoading, error, refetch }` where `data` is the (possibly filtered) array of notification rows. Implement time boundaries in JS (e.g. start of today UTC or local, start of week) and filter the array after fetch; do not add backend params for time in Phase 1.

3. **Realtime:** When resolved notifications are updated (e.g. a notification is resolved), the active list should invalidate. Existing `useResolveNotification` already invalidates `notificationKeys.all`. Ensure `useResolvedNotifications` uses a queryKey under `notificationKeys.all` (e.g. `['notifications', 'resolved', page]`) so that `invalidateQueries({ queryKey: notificationKeys.all })` also invalidates resolved lists. So the existing invalidation in `useResolveNotification` and in `useNotificationRealtime` will refetch resolved list when needed.

**Constraints:**
- Do not add new dependencies.
- Do not change the signature or behavior of `fetchActiveNotifications`, `useActiveNotifications`, or `useNotificationBadge`.
- Keep the same page size (20) for both active and resolved.
- Use the project’s existing patterns: `isSupabaseConfigured` for `enabled`, same error handling (throw in API, let React Query handle).

**Acceptance criteria:**
- `fetchResolvedNotifications(1, 20)` returns an array of objects with `notification_type`, `title`, `body`, `entity_type`, `entity_id`, `created_at`, `resolved_at`, `notification_id`, `notification_source: 'stored'`.
- `useResolvedNotifications(1)` returns a useQuery result that loads resolved notifications for page 1.
- `useNotificationsList({ resolved: false, page: 1 })` returns active notifications (same as `useActiveNotifications(1).data`).
- `useNotificationsList({ resolved: true, page: 1 })` returns resolved notifications (same as `useResolvedNotifications(1).data`).
- `useNotificationsList({ resolved: true, page: 1, timeFilter: 'this_week' })` returns only resolved notifications where `resolved_at` falls within the current week (client-side filter).
- Invalidating `notificationKeys.all` (e.g. after resolve) causes both active and resolved list queries to refetch when used.

Reference: `docs/notification-center-implementation-plan.md` — Phase 1 and Section 2.3.

---

## End of prompt
