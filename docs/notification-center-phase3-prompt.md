# Notification Center — Phase 3 Implementation Prompt

Copy the prompt below and use it to implement **Phase 3 only** (Discovery: nav & bell). Phase 1 and Phase 2 must be done first. Do not change the notification center page, API, or hooks.

---

## Prompt (copy from here)

You are implementing **Phase 3** of the Notification Center for Ornet ERP.

**Prerequisites:** Phase 1 and Phase 2 are done. The notification center page exists at `/notifications` and works when opened via direct URL. The app has a bell in the topbar (for admin/accountant) that opens a dropdown. Do not change the center page, API, or hooks.

**Scope — do only this:**
- Add **"Bildirimler"** to the sidebar and to the mobile "Menü" (More) drawer, visible only to **admin and accountant** (same as the bell).
- Add a **"Tümünü gör"** link in the bell dropdown that navigates to `/notifications` and closes the dropdown.
- Do **not** change `NotificationsCenterPage`, `NotificationItem`, `api.js`, or `hooks.js`. Do **not** add new routes or breadcrumb entries (already done in Phase 2).

**Project context:**
- Nav config: `src/components/layout/navItems.js`. Top-level items are flat: `{ to, icon, labelKey, exact? }`. There is an `adminOnly` property (when true, item is shown only when user is admin). The bell visibility uses: `hasNotificationAccess = isAdmin || currentProfile?.role === 'accountant'` (see `src/app/AppLayout.jsx`).
- Sidebar: `src/components/layout/Sidebar.jsx` builds `visibleNavItems` with `navItems.filter((item) => !item.adminOnly || isAdmin)`. You need to also hide/show the notifications item by role: show it only when `currentProfile?.role === 'admin' || currentProfile?.role === 'accountant'`.
- Mobile drawer: `src/components/layout/MobileNavDrawer.jsx` uses the same `navItems` and the same visibility logic (filter by adminOnly and by notification access).
- The dropdown: `src/features/notifications/components/NotificationDropdown.jsx`. It has a header and a scrollable body; add a footer with a single link/button "Tümünü gör" that navigates to `/notifications` and calls `onClose()` so the dropdown closes. Use `Link` from react-router-dom or `useNavigate` + onClick; ensure `onClose` is called so the sheet/dropdown closes on mobile too.
- i18n: `notifications.actions.viewAll` already exists in `locales/tr/notifications.json` as "Tümünü Gör". Use that for the dropdown link. For the nav label, use `common:nav.notifications`; Phase 2 should have added `nav.notifications` in common.json; if not, add it as "Bildirimler".

**Tasks:**

1. **`navItems.js`**
   - Add a new top-level nav item for the notification center. Use the **Bell** icon from `lucide-react` (same as the topbar bell). Add: `to: '/notifications'`, `icon: Bell`, `labelKey: 'nav.notifications'`. Place it after the "proposals" item and before the first group (e.g. planning). Add a property so we can filter by role: use **`notificationCenter: true`**. (So the item is shown only to admin and accountant; the rest of the app uses `adminOnly` for admin-only items.)

2. **`Sidebar.jsx`**
   - Compute **notification access**: same as AppLayout — e.g. `const hasNotificationAccess = currentProfile?.role === 'admin' || currentProfile?.role === 'accountant';` (you already have `currentProfile` and `isAdmin`).
   - When building **visibleNavItems**, filter out items that have `item.notificationCenter === true` when the user does not have notification access. So: `visibleNavItems = navItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.notificationCenter || hasNotificationAccess))`. This keeps existing behavior and adds notification-center visibility.

3. **`MobileNavDrawer.jsx`**
   - Apply the **same** visibility logic as in Sidebar: compute `hasNotificationAccess` (admin or accountant) and filter nav items with `notificationCenter: true` when the user lacks that access. Use the same formula: `(!item.notificationCenter || hasNotificationAccess)` in the filter that builds the list of items to show. The drawer renders `navItems` via NavGroup and flat items; ensure the item list passed to the drawer (or the navItems used there) is filtered the same way. If the drawer uses `visibleNavItems` from a shared computation, use that; otherwise duplicate the filter logic so "Bildirimler" appears in the More menu only for admin/accountant.

4. **`NotificationDropdown.jsx`**
   - Add a **footer** section below the scrollable list (after the div that contains the notifications or empty state). In the footer, add a single link: "Tümünü gör" that goes to `/notifications`. Use `Link` from `react-router-dom` with `to="/notifications"`, and call `onClose` on click so the dropdown (or mobile sheet) closes. Label: `t('notifications:actions.viewAll')`. Style it as a simple text link or button (e.g. primary outline or ghost) so it’s visible but doesn’t dominate. Ensure the footer is inside the same card/panel as the dropdown content so it’s visible on both desktop and mobile layouts.

5. **`common.json`** (if not already done in Phase 2)
   - Under `nav`, ensure `"notifications": "Bildirimler"` exists so the sidebar and mobile menu show the correct label.

**Constraints:**
- Do not add new dependencies.
- Do not change the notification center page, NotificationItem, api, or hooks.
- Reuse the same role check as the bell: admin or accountant only.

**Acceptance criteria:**
- When logged in as **admin** or **accountant**, the sidebar shows "Bildirimler" (with Bell icon) as a top-level item; clicking it goes to `/notifications`.
- When logged in as **admin** or **accountant**, the mobile "Menü" (More) drawer shows "Bildirimler"; clicking it goes to `/notifications` and closes the drawer.
- When logged in as a user who is **not** admin or accountant (e.g. field_worker), "Bildirimler" does **not** appear in the sidebar or in the More menu.
- The bell dropdown (desktop and mobile) has a footer with "Tümünü gör"; clicking it navigates to `/notifications` and closes the dropdown/sheet.
- Breadcrumb and page at `/notifications` are unchanged and still work.

Reference: `docs/notification-center-implementation-plan.md` — Phase 3 and Section 3.5.

---

## End of prompt
