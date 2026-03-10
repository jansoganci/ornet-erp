# Notification Center — Phase 2 Implementation Prompt

Copy the prompt below and use it to implement **Phase 2 only** (Center page & list UI). Phase 1 (Data & API) must be done first. No nav changes, no "Tümünü gör" in the dropdown yet — that is Phase 3.

---

## Prompt (copy from here)

You are implementing **Phase 2** of the Notification Center for Ornet ERP.

**Prerequisites:** Phase 1 is done. The app has `fetchResolvedNotifications`, `useResolvedNotifications`, and `useNotificationsList({ resolved, page, timeFilter })` in `src/features/notifications/`. Do not change those.

**Scope — do only this:**
- Add a **type badge** (job type) to `NotificationItem` and support **resolved** state (no resolve button for resolved items).
- Create the **Notifications Center page** at route `/notifications`: list format, URL-driven filters (Bekleyen/Tamamlanan + time), empty/error/loading, pagination or "Load more."
- Add the **route** and **breadcrumb** for `/notifications`.
- Add all **i18n keys** needed for the page (title, filter labels, empty messages).
- Do **not** add the notification link to the sidebar or mobile menu. Do **not** add "Tümünü gör" to the bell dropdown. Do **not** change `navItems`, `Sidebar`, or `MobileNavDrawer`.

**Project context:**
- Feature: `src/features/notifications/`. Use `PageContainer`, `PageHeader` from `@/components/layout` (or `../../components/layout`). Use `Button`, `Select`, `Card`, `EmptyState`, `ErrorState`, `Skeleton`, `Badge` from `@/components/ui` (or `../../components/ui`).
- List pages use `useSearchParams` for filters: read with `searchParams.get('key')` and a default; update with `setSearchParams(prev => { ... })`. Pass filter values into the data hook (e.g. `useNotificationsList({ resolved, page, timeFilter })`).
- Use **list layout** (vertical list of rows), not the generic `Table` component. Each row is a `NotificationItem`. Reuse the same row styling as in the notification dropdown (border between rows, clickable row).
- Filter values: `resolved` = `'undone' | 'done'` (map to boolean: undone = false, done = true). `time` = `'all' | 'today' | 'this_week' | 'older'`. Default: `resolved = 'undone'`, `time = 'all'`. Page default: 1.
- Pagination: use page size 20. Either "Load more" (append next page) or Previous/Next buttons; queryKey must include page so changing page refetches. Use the same `useNotificationsList` with a `page` argument from URL (e.g. `searchParams.get('page')` default 1).

**Tasks:**

1. **`NotificationItem.jsx`**
   - Add a **type badge** on each row: show the job type label so users can scan by type. Use existing `notification_type` and translate with `t('notifications:types.' + notification_type)` (the keys already exist in `locales/tr/notifications.json` under `types`). Render as a small `Badge` or pill (e.g. next to the icon or above/below the title). Use a neutral or secondary variant so it doesn’t overpower the title.
   - Support **resolved** state: accept an optional prop such as `isResolved` (or derive from `notification_source === 'stored' && !notification_id` or from a new prop). When the item is resolved (done): do **not** show the resolve (check) button. Optionally show `resolved_at` as secondary text (e.g. "Tamamlandı: 2 saat önce") if you pass `resolved_at` and want to display it. Ensure click-to-navigate and icon/title/body still work for resolved items.

2. **`NotificationsCenterPage.jsx`** (new file in `src/features/notifications/`)
   - Use `PageContainer` and `PageHeader`. Title from i18n: `t('notifications:page.title')` (add key below).
   - Read URL: `resolved = searchParams.get('resolved') || 'undone'`, `time = searchParams.get('time') || 'all'`, `page = Number(searchParams.get('page')) || 1`.
   - Call `useNotificationsList({ resolved: resolved === 'done', page, timeFilter: time === 'all' ? undefined : time })`. Use the returned `data`, `isLoading`, `error`, `refetch`.
   - Filter bar: two controls. (1) Resolved: Select or segment with options "Bekleyen" (undone) and "Tamamlanan" (done). (2) Time: Select with options "Tümü", "Bugün", "Bu hafta", "Daha eski". On change, call `setSearchParams` to set `resolved` and `time` (and reset `page` to 1 when filter changes).
   - List: render `data?.map(n => <NotificationItem key={...} {...n} isResolved={resolved === 'done'} onResolve={...} onNavigate={() => {}} />)`. Use a stable key (e.g. `n.notification_id || n.entity_type + n.entity_id + n.created_at`). For resolved list, pass `onResolve={undefined}` and `isResolved={true}` (or equivalent).
   - Loading: show a list skeleton (e.g. 5–8 placeholder rows similar to the dropdown skeleton).
   - Error: show `ErrorState` with retry calling `refetch`.
   - Empty: when `data?.length === 0`, show `EmptyState` with message from i18n: use `t('notifications:empty.undone')` when `resolved === 'undone'` and `t('notifications:empty.done')` when `resolved === 'done'`.
   - Pagination: add "Load more" button (when there are 20 items, show "Daha fazla" or use existing common key) that increments `page` in URL, or Previous/Next. Ensure `page` is in the URL so the list hook refetches for that page.
   - Optional: redirect or show a message if the user is not admin/accountant (e.g. redirect to `/`). The route is protected by auth; if the app already restricts notification data by role in the API, you may only need to ensure the page doesn’t crash for non-admin; otherwise add a simple role check and redirect.

3. **Route and breadcrumb**
   - **`App.jsx`**: Import `NotificationsCenterPage` from `src/features/notifications` (add to the feature’s `index.js` export if needed). Add `<Route path="notifications" element={<NotificationsCenterPage />} />` inside the protected layout (same level as other feature routes, e.g. after `profile` or with other list routes).
   - **`src/lib/breadcrumbConfig.js`**: In `getRootLabel(seg)`, add an entry for the first segment `notifications`: `{ labelKey: 'common:nav.notifications', to: '/notifications' }`. (Phase 3 will add `common:nav.notifications` in common.json; for Phase 2 you can add the key in common.json under `nav` as `"notifications": "Bildirimler"` so the breadcrumb works.)

4. **i18n**
   - **`src/locales/tr/notifications.json`**: Add keys: `page.title`: "Bildirimler"; `filters.undone`: "Bekleyen", `filters.done`: "Tamamlanan", `filters.timeAll`: "Tümü", `filters.timeToday`: "Bugün", `filters.timeThisWeek`: "Bu hafta", `filters.timeOlder`: "Daha eski"; `empty.undone`: "Şu an dikkat gerektiren bildirim yok.", `empty.done`: "Bu dönemde tamamlanan bildirim yok."
   - **`src/locales/tr/common.json`**: Under `nav`, add `"notifications": "Bildirimler"` so the breadcrumb label exists.

5. **Exports**
   - Export `NotificationsCenterPage` from `src/features/notifications/index.js` so `App.jsx` can import it from the feature.

**Constraints:**
- Do not add new npm dependencies.
- Reuse existing UI components (Badge, Select, Card, EmptyState, ErrorState, Skeleton). Match the app’s list styling (borders, spacing, dark mode: `dark:bg-[#171717]`, `dark:border-[#262626]`, etc.).
- Keep the list as a vertical list of `NotificationItem` rows; do not use the `Table` component for this screen.

**Acceptance criteria:**
- Visiting `/notifications` shows the notification center page with title "Bildirimler."
- Filter "Bekleyen" shows active (undone) list; "Tamamlanan" shows resolved (done) list.
- Time filter "Tümü / Bugün / Bu hafta / Daha eski" filters the list (client-side).
- Each row shows a type badge (job type label) and behaves like the dropdown row (click navigates; resolve button only for stored undone).
- Resolved rows do not show the resolve button.
- Loading shows skeleton; error shows ErrorState with retry; empty shows EmptyState with the correct message.
- Breadcrumb for `/notifications` shows "Bildirimler" (or the nav label).
- Pagination (or Load more) works and URL reflects page/filters.

Reference: `docs/notification-center-implementation-plan.md` — Phase 2 and Sections 3.1–3.4, 3.6.

---

## End of prompt
