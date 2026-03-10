# Notification Center — Audit Prompt

Use this prompt to audit whether the notification center was built completely and correctly. Copy the prompt below and run it (e.g. in a new chat or as a checklist). The auditor should report: **% complete**, **pass/fail per area**, **missing tasks**, **lint/syntax errors**, and **recommendations**.

---

## Prompt (copy from here)

You are auditing the **Notification Center** implementation for Ornet ERP. Determine if it was built 100% successfully, list any missing tasks, and report lint/syntax errors and other issues.

**Reference docs (read as needed):**
- `docs/notification-center-implementation-plan.md` — full plan, phases 1–3, summary checklist (Section 7), edge cases (Section 6).
- `docs/notification-center-phase1-prompt.md`, `phase2-prompt.md`, `phase3-prompt.md` — intended deliverables per phase.

**Codebase paths:**
- Notifications feature: `src/features/notifications/` (api.js, hooks.js, components/, NotificationsCenterPage if present).
- App: `src/App.jsx`, `src/app/AppLayout.jsx`.
- Layout: `src/components/layout/navItems.js`, `Sidebar.jsx`, `MobileNavDrawer.jsx`.
- Lib: `src/lib/breadcrumbConfig.js`.
- Locales: `src/locales/tr/common.json`, `src/locales/tr/notifications.json`.

---

### 1. Completeness — Phase checklist

Verify each item. Answer **Done / Missing / N/A** and note the exact file or line if relevant.

**Phase 1 — Data & API**
- [ ] **P1.1** Backend: Resolved notifications are fetchable (query `notifications` with `resolved_at IS NOT NULL`). No migration required if RLS allows; confirm `api.js` or Supabase client is used correctly.
- [ ] **P1.2** `src/features/notifications/api.js`: Function `fetchResolvedNotifications(page, pageSize)` exists. It queries the `notifications` table (not only the view), filters by `resolved_at` not null, orders by `resolved_at` desc, uses `.range(from, to)`, and returns rows in the shape expected by NotificationItem (`notification_type`, `entity_type`, `entity_id`, `notification_id`, `notification_source: 'stored'`, `title`, `body`, `created_at`, `resolved_at`).
- [ ] **P1.3** `src/features/notifications/hooks.js`: `notificationKeys.resolved(page)` exists. `useResolvedNotifications(page)` exists and uses that key and `fetchResolvedNotifications`. `useNotificationsList({ resolved, page, timeFilter })` exists; when `resolved === false` it uses active data, when `resolved === true` it uses resolved data; optional client-side time filter (`today` / `this_week` / `older`) is applied to the array. Invalidating `notificationKeys.all` invalidates resolved lists (queryKey under the same prefix).

**Phase 2 — Center page & list UI**
- [ ] **P2.1** `NotificationItem.jsx`: A **type badge** (job type label) is shown on each row using `t('notifications:types.' + notification_type)` or equivalent. **Resolved state**: when the item is resolved/done, the resolve (check) button is **not** shown.
- [ ] **P2.2** `NotificationsCenterPage.jsx` exists in `src/features/notifications/`. It uses `PageContainer`, `PageHeader` (title from i18n). Reads URL params: `resolved` (undone/done), `time` (all/today/this_week/older), `page`. Uses `useNotificationsList({ resolved, page, timeFilter })`. Renders filter bar (Bekleyen/Tamamlanan + time), list of `NotificationItem` rows (list layout, not Table), loading skeleton, `ErrorState` with retry, `EmptyState` with correct message for undone vs done. Pagination or "Load more" with page in URL.
- [ ] **P2.3** i18n: `notifications.json` contains: `page.title`, `filters.undone`, `filters.done`, `filters.timeAll`, `filters.timeToday`, `filters.timeThisWeek`, `filters.timeOlder`, `empty.undone`, `empty.done`. `common.json` contains `nav.notifications` (e.g. "Bildirimler").
- [ ] **P2.4** `App.jsx`: Route `path="notifications"` with `element={<NotificationsCenterPage />}` (or equivalent) inside the protected layout. `NotificationsCenterPage` is exported from the notifications feature and imported in App.jsx.
- [ ] **P2.5** `src/lib/breadcrumbConfig.js`: In `getRootLabel(seg)`, the segment `notifications` is mapped to `{ labelKey: 'common:nav.notifications', to: '/notifications' }`.

**Phase 3 — Discovery**
- [ ] **P3.1** `navItems.js`: A top-level item exists with `to: '/notifications'`, `icon: Bell`, `labelKey: 'nav.notifications'`, and `notificationCenter: true` (or equivalent so it can be filtered by role).
- [ ] **P3.2** `Sidebar.jsx`: Visibility for notification center: `hasNotificationAccess` (or equivalent) is computed (admin or accountant). `visibleNavItems` filters out items where `item.notificationCenter === true` when the user does not have notification access.
- [ ] **P3.3** `MobileNavDrawer.jsx`: Same visibility logic as Sidebar so "Bildirimler" appears in the More menu only for admin/accountant.
- [ ] **P3.4** `NotificationDropdown.jsx`: A footer (or bottom link) contains "Tümünü gör" (`t('notifications:actions.viewAll')`) that links to `/notifications` and calls `onClose` on click so the dropdown/sheet closes.

---

### 2. Lint and syntax

- [ ] Run **`npm run lint`** (or `pnpm lint` / `yarn lint`). Report: **Pass** or **Fail**. If fail, list every file and line (or rule) that has an error. Fix or list as "must fix."
- [ ] Run **`npm run build`** (or equivalent). Report: **Pass** or **Fail**. If fail, list the first blocking error (syntax, missing export, etc.). Fix or list as "must fix."
- [ ] In notification-related files, confirm there are **no unused variables or imports** that would trigger lint warnings. Confirm **no console.log** or debug code left in.

---

### 3. i18n and copy

- [ ] All user-facing strings in the notification center (page title, filter labels, empty messages, button "Tümünü gör", type labels) use **translations** (e.g. `t('notifications:...')` or `t('common:...')`). No hardcoded Turkish or English in JSX/JS except inside locale JSON files.
- [ ] Every key referenced in the notification feature exists in `locales/tr/notifications.json` or `common.json`. Report any **missing keys** (key used in code but not in JSON).

---

### 4. Consistency and edge cases

- [ ] **Access:** Notification center route and nav are only useful for admin/accountant; bell is already hidden for others. If a non–admin/accountant user opens `/notifications` directly, the app either redirects or shows data only if the API allows (no crash). Note: API/RLS may already restrict data; confirm page doesn’t crash.
- [ ] **Realtime:** Existing `useNotificationRealtime` (or equivalent) invalidates queries so the badge and lists update when notifications change. No need to duplicate subscription; just confirm invalidation still covers the new list queries.
- [ ] **List format:** The center page uses a **vertical list** of rows (NotificationItem), not the generic Table component. Styling is consistent with the app (e.g. borders, dark mode classes like `dark:bg-[#171717]`, `dark:border-[#262626]`).
- [ ] **Pagination:** Page is in the URL; changing page or filters updates the URL and refetches. Page size is 20 (or as specified in the plan).

---

### 5. Final report format

Please output a short report in this form:

**Notification Center Audit Report**

1. **Completeness:** _X_ / 18 tasks (or list total from checklist). **% complete:** _Y_%.
2. **Phase 1:** Pass / Fail. Notes: _…_
3. **Phase 2:** Pass / Fail. Notes: _…_
4. **Phase 3:** Pass / Fail. Notes: _…_
5. **Lint:** Pass / Fail. Errors: _list or "none"._
6. **Build:** Pass / Fail. Errors: _list or "none"._
7. **i18n:** Pass / Fail. Missing keys: _list or "none"._
8. **Missing or incomplete tasks:** _bullet list._
9. **Recommendations:** _bullet list (optional fixes, accessibility, tests)._
10. **Verdict:** **Success (100%)** / **Success with minor issues** / **Incomplete (list what’s missing).**

---

## End of prompt
