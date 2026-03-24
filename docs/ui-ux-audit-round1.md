# UI/UX Audit — Round 1

> **Modules:** Auth, Profile, Notifications, Materials
> **Date:** 2026-03-24
> **Auditor:** Claude Opus 4.6

---

## Round 1 Summary

- **Round Score: 7.5/10**
- **Modules audited:** 4
- **Total files analyzed:** 23 page/component files

### Top Strengths (Round 1)
1. **Consistent i18n usage** — Nearly all user-facing text uses translation keys across all 4 modules
2. **Shared component adoption** — Button, Input, Card, Modal, EmptyState, ErrorState used properly everywhere
3. **Full dark mode coverage** — All modules use proper Tailwind tokens with `dark:` variants

### Top Issues (Round 1)
1. **Touch targets below 44px** — Multiple buttons/icons across notifications and materials are dangerously small on mobile
2. **Tablet layout gap** — All 4 modules jump from single-column mobile to desktop layout at `lg:` (1024px), wasting tablet width at 768-1023px
3. **Nested interactive elements** — Notifications module has button-inside-button patterns (invalid HTML, screen reader issues)

---

## Auth Module

- **Module Score: 8/10**
- **Files audited:** LoginPage.jsx, RegisterPage.jsx, ForgotPasswordPage.jsx, UpdatePasswordPage.jsx, VerifyEmailPage.jsx, AuthLayout.jsx, PasswordInput.jsx, PasswordStrength.jsx, EmailVerificationBanner.jsx

### Issues

#### Mobile
- [PasswordInput.jsx:36] Password toggle touch target is only `p-1` (~28px), below the 44px minimum → increase to `p-2` with `min-w-[44px] min-h-[44px]`
- [PasswordInput.jsx:36] Toggle uses hardcoded `top-[38px]` magic number — will misalign if Input label is absent → use flexbox or relative positioning instead

#### Tablet
- No significant issues. `max-w-md` constraint keeps auth forms well-proportioned.

#### Desktop
- [AuthLayout.jsx:10] `max-w-md` card on 1280px+ leaves large whitespace — standard for auth pages but noted

#### UX
- 🔴 [UpdatePasswordPage.jsx:111] Loading state reuses `t('verifyEmail.checking')` which is semantically wrong for password update → add dedicated loading key
- 🔴 [UpdatePasswordPage.jsx:129-130] Error state reuses `t('verifyEmail.error.title')` — confusing on expired password reset links → add `passwordReset.error.title` key
- 🟡 [VerifyEmailPage.jsx:163-164] Success button says "Giris sayfasina git" but navigates to `/` (dashboard), not `/login` — label/action mismatch → fix navigation target or label
- 🟡 [ForgotPasswordPage.jsx:60-66] Success state CTA is a small text link, inconsistent with full-width primary buttons on other auth success screens → use Button component
- 🟡 [EmailVerificationBanner.jsx:54-69] Resend button is raw `<button>` instead of shared Button component → use `<Button variant="ghost">`

#### i18n
- 🔴 [PasswordInput.jsx:37] Hardcoded Turkish aria-labels: `'Sifreyi gizle'` / `'Sifreyi goster'` → use `t('auth:passwordToggle.hide/show')`
- 🟡 [EmailVerificationBanner.jsx:79] Hardcoded Turkish aria-label: `'Kapat'` → use `t('common:actions.close')`
- 🟢 [auth.json:81-92] `passwordReset` namespace appears unused/duplicate of `forgotPassword` → audit and remove dead keys

### Strengths
- Excellent module cohesion via shared AuthLayout wrapper
- Comprehensive state handling (loading, error, success) on UpdatePasswordPage and VerifyEmailPage
- PasswordStrength component provides real-time feedback
- All submit buttons use `size="lg" className="w-full"` for proper mobile touch targets
- No hardcoded hex colors — all Tailwind tokens

---

## Profile Module

- **Module Score: 7.5/10**
- **Files audited:** ProfilePage.jsx, api.js, hooks.js, schema.js, index.js

### Issues

#### Mobile
- [ProfilePage.jsx:316-343] Avatar + name + badge row on 390px screen risks truncating long names with nested padding → test with long names
- [ProfilePage.jsx:275] SearchInput + Select stack vertically without labels — unclear what each field filters → add placeholder text or labels
- [ProfilePage.jsx:421-440] Password form footer uses `flex-col-reverse` placing "Forgot password" link below submit — easy to miss → reorder so link is above or beside button

#### Tablet
- 🟡 [ProfilePage.jsx:244-249] Grid uses `lg:grid-cols-12` so tablet (768-1023px) remains single-column, resulting in very long scroll for admin users → use `md:grid-cols-12` for two-column layout on tablet
- 🟡 [ProfilePage.jsx:251] Directory card is `order-2 lg:order-1` causing different card ordering between tablet and desktop → confusing for users switching devices

#### Desktop
- [ProfilePage.jsx:306-309] Non-admin profile cards stretch to full `max-w-7xl` (1280px) for just 2-3 form fields — too wide → add `max-w-2xl mx-auto` or constrain to `lg:col-span-8`

#### UX
- 🟡 [ProfilePage.jsx:222-224] Loading state uses bare `<FormSkeleton />` without PageContainer/PageHeader — causes layout shift when data loads → wrap skeleton in full page layout
- 🟡 [ProfilePage.jsx:87-91] Admin check uses `profile?.role === 'admin'` instead of `useRole()` hook → use centralized role logic from `src/lib/roles.js`
- 🟢 [ProfilePage.jsx:252] Admin directory table has no pagination — will degrade with many users → add pagination or virtual scrolling

#### i18n
- 🔴 [schema.js:12] Hardcoded Turkish string: `'Gecerli bir telefon numarasi giriniz'` in zod validation → use `i18n.t('profile:validation.phoneInvalid')`

### Strengths
- Thorough use of shared UI components (Button, Card, Input, Badge, Table, SearchInput, etc.)
- Turkish search normalization via `normalizeForSearch`
- Form handling follows project pattern: react-hook-form + zodResolver
- Error states with retry capability on both profile load and directory load
- Consistent dark mode throughout

---

## Notifications Module

- **Module Score: 7/10**
- **Files audited:** NotificationsCenterPage.jsx, NotificationBell.jsx, NotificationDropdown.jsx, NotificationFeedCard.jsx, NotificationSidebar.jsx, NotificationItem.jsx, ReminderFormModal.jsx, schema.js, api.js, hooks.js

### Issues

#### Mobile
- 🔴 [NotificationsCenterPage.jsx:198] Tab bar with 4 tabs has no horizontal scroll — will overflow at 390px → wrap in `overflow-x-auto` or use 2x2 grid
- 🔴 [NotificationFeedCard.jsx:148-154] "Detaylari Gor" button uses `text-[10px]` with no padding — touch target ~20px → add `py-2 min-h-[44px]`
- 🔴 [NotificationFeedCard.jsx:159-166] "Kaldir" dismiss button same `text-[10px]` issue → same fix
- 🔴 [NotificationItem.jsx:139-150] Resolve check-mark is 14px icon with no padding — untappable on mobile → wrap in `p-2 min-w-[44px]`
- 🟡 [NotificationsCenterPage.jsx:252-259] "Load older" button has no minimum touch target → add `min-h-[44px] py-3`
- 🟡 [NotificationsCenterPage.jsx:272-288] FAB may overlap mobile bottom nav bar → add `bottom-20` to clear bottom nav
- 🟡 [NotificationDropdown.jsx:220] Nested `max-h` on mobile sheet creates double scroll container → use single scroll boundary

#### Tablet
- 🟡 [NotificationsCenterPage.jsx:215] Grid uses `grid-cols-1 lg:grid-cols-12` — tablet stays single-column, sidebar stretches full width → add `md:grid-cols-12` for two-column at 768px
- 🟡 [NotificationSidebar.jsx:134] Sidebar returns `null` during loading — empty space on grid → show skeleton placeholder

#### Desktop
- [NotificationsCenterPage.jsx:176] `maxWidth="full"` means feed cards stretch on ultrawide monitors → use `maxWidth="7xl"`
- [NotificationFeedCard.jsx:126] Title uses `truncate` even on desktop where there's ample space → use `line-clamp-2` or remove truncation on `lg:`
- [NotificationsCenterPage.jsx:233] Date header `text-[10px]` is too small even on desktop → increase to `text-xs`

#### UX
- 🔴 [NotificationsCenterPage.jsx:159-161] "Load Older" replaces current feed with page 2 instead of appending — user loses context → implement `useInfiniteQuery` for cumulative pagination
- 🔴 [NotificationFeedCard.jsx:100-104] Button-inside-button: card is `role="button"` containing nested `<button>` elements — invalid HTML, screen reader issue → restructure DOM
- 🔴 [NotificationItem.jsx:113+142] Same button-inside-button pattern in dropdown items → same fix
- 🟡 [NotificationsCenterPage.jsx:272-288] FAB navigates to `/work-orders/new` — not contextually related to notifications → use contextual icon or relocate
- 🟡 [NotificationBell.jsx:19-20] Role check duplicates logic instead of using `useRole()` hook → use centralized hook
- 🟡 [NotificationDropdown.jsx:97-104] Mobile detection via `window.matchMedia` causes flash on first render → use CSS-only approach or shared hook

#### i18n
- 🔴 [schema.js:5] Hardcoded Turkish: `'Gecerli bir tarih giriniz (YYYY-AA-GG)'` → use translation key
- 🔴 [schema.js:9] Hardcoded Turkish: `'Gecerli bir saat giriniz (SS:DD)'` → use translation key
- 🟢 [NotificationFeedCard.jsx:83] `formatDistanceToNow` hardcodes `locale: tr` — won't adapt to language changes → pull from i18n context

### Strengths
- Excellent accessibility on NotificationDropdown: Escape to close, focus trap, `role="menu"`, `aria-expanded`
- Real-time updates via Supabase Realtime subscription with auto-invalidation
- Well-structured icon mapping system per notification type
- Full state coverage: loading, error, empty all handled on main page
- Clean mobile/desktop split in dropdown: positioned popover vs portal bottom sheet

---

## Materials Module

- **Module Score: 7.5/10**
- **Files audited:** MaterialsListPage.jsx, MaterialImportPage.jsx, MaterialFormModal.jsx, MaterialUsageModal.jsx, api.js, hooks.js, schema.js

### Issues

#### Mobile
- 🔴 [MaterialImportPage.jsx:267-298] Preview table is raw HTML `<table>` with 5 columns — will overflow at 390px with no mobile alternative → add mobile card layout
- 🟡 [MaterialImportPage.jsx:169] Upload card uses `p-12` padding — excessive on 390px, wastes space → use `p-6 sm:p-12`
- 🟡 [MaterialUsageModal.jsx:106-111] Usage history table renders 7 columns inside a modal — severe horizontal scroll on mobile → limit columns or add card view
- 🟡 [MaterialsListPage.jsx:233] Unit text uses `text-[10px]` — below minimum readable size (12px) → increase to `text-xs`
- 🟡 [MaterialsListPage.jsx:499] Clear period filter button has only `p-2` (~32px touch target) → increase to 44px minimum

#### Tablet
- 🟡 [MaterialsListPage.jsx:529-531] Desktop table hidden below `lg:` — tablet users at 768px see mobile card layout, underutilizing space → show table from `md:`
- 🟡 [MaterialImportPage.jsx:160-199] Import page has no max-width — content stretches to full tablet width → add `max-w-3xl mx-auto`

#### Desktop
- 🟡 [MaterialsListPage.jsx:416-456] KPI cards are `md:hidden` — desktop users never see summary metrics → expose KPIs on desktop too
- 🟢 [MaterialsListPage.jsx:622-624] Table uses `rounded-2xl` instead of standard `rounded-xl` → standardize

#### UX
- 🔴 [MaterialFormModal.jsx:32] Form `defaultValues` evaluated once on mount — editing different items without unmounting shows stale data → add `useEffect` with `reset()` keyed on `material?.id`
- 🟡 [MaterialImportPage.jsx:116] Auto-navigate after 2.5s timeout removes user control → let user click to navigate (button already exists)
- 🟡 [MaterialsListPage.jsx:96] `t('notifications:months')` borrows from notifications namespace — fragile cross-dependency → define in common or materials namespace
- 🟢 [MaterialsListPage.jsx:83] `useMaterials({})` fetches ALL materials just for KPI counts → use lightweight aggregate query

#### i18n
- 🟡 [MaterialImportPage.jsx:13] Hardcoded Turkish column headers: `['Kod', 'Ad', 'Kategori', 'Birim', 'Aciklama']` → move to translations or document as intentional
- 🟡 [MaterialImportPage.jsx:22-25] Hardcoded Turkish sheet name `'Malzemeler'` and sample data → same as above
- 🔴 [schema.js:9-12] Schema allows 16 unit enum values but `materials.json` only has translations for 3 (`adet`, `metre`, `paket`) → add missing 13 unit translations
- 🔴 [MaterialFormModal.jsx:73-77] Form UI only shows 3 unit options while schema allows 16 → expand form options or restrict schema

### Strengths
- Excellent mobile-first design on MaterialsListPage with sticky header, KPI cards, card-based list, chip filters
- URL-driven filter state via searchParams for bookmarkable views
- Proper accessibility: aria-labels, keyboard navigation, role="button" with tabIndex
- Clean module structure following project conventions
- Import page uses shared ImportInstructionCard and ImportResultSummary
- Turkish search normalization in API layer

---

## Round 1 Score Table (Partial)

| Criterion | Auth | Profile | Notifications | Materials | Avg |
|---|---|---|---|---|---|
| Color System | 9 | 9 | 8 | 9 | 8.8 |
| Typography | 8 | 8 | 6 | 7 | 7.3 |
| Component Consistency | 9 | 9 | 8 | 9 | 8.8 |
| Mobile | 8 | 7 | 5 | 6 | 6.5 |
| Tablet | 9 | 6 | 6 | 6 | 6.8 |
| Desktop | 8 | 7 | 7 | 7 | 7.3 |
| Information Hierarchy | 8 | 7 | 7 | 8 | 7.5 |
| Module Cohesion | 9 | 8 | 7 | 8 | 8.0 |
| State Coverage | 8 | 7 | 8 | 8 | 7.8 |
| i18n | 7 | 7 | 6 | 6 | 6.5 |
| **Module Score** | **8** | **7.5** | **7** | **7.5** | **7.5** |

---

## Round 1 Priority Fix List

### 🔴 CRITICAL (11 issues)
1. [NotificationFeedCard.jsx:100-104] Button-inside-button: invalid HTML, screen reader failure
2. [NotificationItem.jsx:113+142] Same nested button pattern in dropdown
3. [NotificationsCenterPage.jsx:159-161] Pagination replaces feed instead of appending — data loss
4. [NotificationsCenterPage.jsx:198] Tab bar overflows at 390px — layout breaks
5. [NotificationFeedCard.jsx:148-166] Action buttons have ~20px touch targets — untappable
6. [NotificationItem.jsx:139-150] Resolve button 14px with no padding — untappable
7. [MaterialImportPage.jsx:267-298] 5-column raw table overflows on mobile
8. [MaterialFormModal.jsx:32] Stale form data when editing different items
9. [UpdatePasswordPage.jsx:111,129] Wrong translation keys (verifyEmail reused for password)
10. [schema.js (notifications):5,9] Hardcoded Turkish validation messages
11. [schema.js (materials):9-12 + MaterialFormModal.jsx:73-77] 13 missing unit translations + form shows only 3 of 16 units

### 🟡 IMPORTANT (18 issues)
1. All 4 modules: tablet layout stays single-column until `lg:` (1024px) — wasted space at 768-1023px
2. [ProfilePage.jsx:222-224] Loading skeleton missing PageContainer/PageHeader wrapper
3. [PasswordInput.jsx:37] Hardcoded Turkish aria-labels
4. [VerifyEmailPage.jsx:163-164] Button label/navigation mismatch
5. [ForgotPasswordPage.jsx:60-66] Success CTA inconsistent with other auth pages
6. [EmailVerificationBanner.jsx:54-69] Raw button instead of Button component
7. [ProfilePage.jsx:87-91] Admin check bypasses useRole() hook
8. [ProfilePage.jsx:421-440] Password link hidden below submit on mobile
9. [NotificationsCenterPage.jsx:272-288] FAB context mismatch + may overlap bottom nav
10. [NotificationBell.jsx:19-20] Role check duplicates logic
11. [MaterialImportPage.jsx:169] Excessive `p-12` padding on mobile
12. [MaterialUsageModal.jsx:106-111] 7-column table in modal — mobile overflow
13. [MaterialsListPage.jsx:233] `text-[10px]` below readable minimum
14. [MaterialsListPage.jsx:499] Filter clear button below 44px touch target
15. [MaterialImportPage.jsx:116] Auto-navigate timeout removes user control
16. [MaterialsListPage.jsx:416-456] KPI cards hidden on desktop
17. [MaterialImportPage.jsx:13,22-25] Hardcoded Turkish in import template
18. [MaterialsListPage.jsx:96] Cross-namespace dependency on notifications months

### 🟢 MINOR (6 issues)
1. [auth.json:81-92] Dead translation keys in passwordReset namespace
2. [NotificationFeedCard.jsx:83] Hardcoded `locale: tr` in formatDistanceToNow
3. [ProfilePage.jsx:252] No pagination on admin directory table
4. [MaterialsListPage.jsx:83] Full table scan for KPI counts
5. [MaterialsListPage.jsx:622-624] `rounded-2xl` vs `rounded-xl` inconsistency
6. [EmailVerificationBanner.jsx:79] Hardcoded Turkish aria-label 'Kapat'
