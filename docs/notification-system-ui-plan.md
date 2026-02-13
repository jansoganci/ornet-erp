# Notification System — UI/UX Design Plan

**Date:** 2026-02-13
**Status:** UI/UX plan — awaiting approval
**Based on:** notification-system-architecture.md + codebase UI analysis

---

## Design System Reference (Extracted from Codebase)

All decisions below are anchored to exact tokens, components, and patterns already in use.

| Token | Light | Dark |
|-------|-------|------|
| App background | `white` | `#0a0a0a` |
| Surface (cards, panels) | `white` | `#171717` |
| Border | `neutral-200` | `#262626` |
| Text primary | `neutral-900` | `neutral-50` |
| Text secondary | `neutral-500` | `neutral-400` |
| Primary (brand red) | `primary-600` (#dc2626) | `primary-400` (#f87171) |
| Error | `error-600` (#dc2626) | `error-400` |
| Warning | `warning-600` (#d97706) | `warning-400` |
| Success | `success-600` (#059669) | `success-400` |
| Focus ring | `ring-2 ring-primary-600 ring-offset-2` | `ring-offset-0` |
| Font | Inter, system stack | |
| z-dropdown | 50 | |
| z-sticky | 100 | |
| z-modal | 200 | |
| z-toast | 300 | |

---

## 1. NotificationBell Component

**Location:** `src/features/notifications/components/NotificationBell.jsx`
**Placement:** AppLayout topbar → `<div className="flex items-center gap-2">`, **before** the theme toggle button.

### Props & State

```
Props: none (self-contained, uses hooks internally)
Internal State:
  - isOpen: boolean (dropdown visibility)
Internal Hooks:
  - useNotificationBadge() → { total, overdue_work_orders }
  - useNotificationRealtime() → invalidates badge on notifications table change
```

### Layout (ASCII)

```
┌─ Topbar ──────────────────────────────────────────────────┐
│  [☰]  [◂]  Ornet ERP              [🔔•]  [☀/🌙]         │
└───────────────────────────────────────────────────────────┘
                                      ↑
                                Bell + badge
```

### Badge Specification

| Condition | Display |
|-----------|---------|
| `total === 0` | No badge shown, bell is neutral color |
| `total >= 1 && total <= 99` | Red circle, white text, exact number |
| `total >= 100` | Red circle, white text, "99+" |

**Badge position:** Top-right corner of bell icon, offset by `-top-1 -right-1` (overlapping the icon edge).

**Badge styling:**
```
className="absolute -top-1 -right-1 flex items-center justify-center
  min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
  bg-error-600 text-white"
```

Why `error-600` not `primary-600`? Both are red in this design system, but `error-600` semantically communicates "attention needed" and won't conflict if the primary color ever changes.

### Bell Icon States

| State | Icon Color | Behavior |
|-------|------------|----------|
| No notifications | `text-neutral-500 dark:text-neutral-400` | Matches theme toggle color |
| Has notifications | `text-neutral-500 dark:text-neutral-400` | Same color — badge does the talking |
| Dropdown open | `bg-neutral-100 dark:bg-neutral-800` | Background highlight (matches IconButton ghost hover) |

**Why no color change on bell itself?** Steve Jobs principle — the badge is the signal. A colored bell + badge + number is three signals for one thing. Keep it simple.

### Bell Button Implementation

Reuse existing `IconButton` component with `variant="ghost"`. Wrap in a `relative` container for badge positioning.

```
<div className="relative">
  <IconButton
    icon={<Bell className="w-5 h-5" />}
    variant="ghost"
    onClick={() => setIsOpen(prev => !prev)}
    aria-label={t('notifications:bell.label')}
    aria-expanded={isOpen}
    aria-haspopup="true"
  />
  {total > 0 && <span className="absolute -top-1 -right-1 ...">{formatted}</span>}
</div>
```

### Touch Target

`IconButton` size `md` already provides `min-w-[44px] min-h-[44px]` on mobile. No change needed.

---

## 2. NotificationDropdown Component

**Location:** `src/features/notifications/components/NotificationDropdown.jsx`

### Responsive Strategy

| Breakpoint | Behavior |
|------------|----------|
| Desktop (lg+) | Popover dropdown anchored below bell icon, right-aligned |
| Mobile/Tablet (<lg) | Bottom sheet (matching MobileNavDrawer pattern) |

**Why two modes?** The MobileNavDrawer already sets the precedent — mobile uses bottom sheets with handle bars and backdrop blur. Users already know this pattern. Desktop uses a standard dropdown because there's enough screen space.

### Desktop Dropdown Spec

**Trigger:** Click bell icon → toggle open/close
**Close:** Click outside, press Escape, click bell again, click a notification item

**Positioning:**
```
className="absolute right-0 top-full mt-2 z-50
  w-[400px] max-h-[min(600px,70vh)]
  bg-white dark:bg-[#171717]
  border border-neutral-200 dark:border-[#262626]
  rounded-lg shadow-xl
  overflow-hidden flex flex-col
  animate-slide-down"
```

**Layout (ASCII):**
```
┌─────────────────────────────────┐
│  Bildirimler              (15)  │  ← Header
├─────────────────────────────────┤
│  ┌ Filter Tabs ───────────────┐ │
│  │ Tümü │ İş Em. │ Teklif │ …│ │  ← Optional type filter
│  └────────────────────────────┘ │
│                                 │
│  [⚠] Vadesi geçmiş iş emri     │  ← NotificationItem
│      ABC Güvenlik — 3 gün önce  │
│  ─────────────────────────────  │
│  [📋] Teklif 5 gündür cevap...  │  ← NotificationItem
│      XYZ Ltd — 5 gün önce      │
│  ─────────────────────────────  │
│  [🔔] Abonelik iptal edildi     │  ← NotificationItem
│      0532 xxx — 1 saat önce     │
│  ─────────────────────────────  │
│  ... (scrollable)               │
│                                 │
├─────────────────────────────────┤
│  Tümünü Gör →                   │  ← Footer (deferred to Phase 1.5)
└─────────────────────────────────┘
```

**Header:**
```
<div className="flex items-center justify-between px-4 py-3
  border-b border-neutral-200 dark:border-[#262626]">
  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
    {t('notifications:title')}
  </h3>
  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
    {total}
  </span>
</div>
```

**Scrollable body:**
```
<div className="flex-1 overflow-y-auto overscroll-contain">
  {/* NotificationItem list */}
</div>
```

**Why `overscroll-contain`?** Prevents scroll chaining to the page behind. Used in MobileNavDrawer already.

### Mobile Bottom Sheet Spec

**Trigger:** Same bell click
**Pattern:** Mirrors `MobileNavDrawer.jsx` exactly:

```
- createPortal to document.body
- Backdrop: bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in
- Sheet: w-full max-h-[70vh] bg-white dark:bg-[#171717] rounded-t-2xl shadow-xl animate-slide-up
- Handle bar: w-12 h-1 rounded-full bg-neutral-200 dark:bg-[#262626]
- Close: backdrop click + Escape key
- z-index: 200 (z-modal — above topbar z-40, matches MobileNavDrawer)
```

**Layout:**
```
┌─────────────────────────────────┐
│          ━━━━━━━━━━━            │  ← Handle bar
├─────────────────────────────────┤
│  Bildirimler          (15)  ✕   │  ← Header + close button
├─────────────────────────────────┤
│                                 │
│  [⚠] Vadesi geçmiş iş emri     │  ← Scrollable list
│      ABC Güvenlik — 3 gün önce  │
│  ...                            │
│                                 │
└─────────────────────────────────┘
```

**Header close button:** `IconButton` with `X` icon, `variant="ghost"`, `size="sm"` — exact same as MobileNavDrawer header.

### Click Outside Handling

Desktop only. Use `useRef` + `useEffect` with `mousedown` listener:
```js
useEffect(() => {
  if (!isOpen) return;
  const handler = (e) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [isOpen]);
```

### Loading / Empty / Error States

| State | Display |
|-------|---------|
| Loading | 3 skeleton rows (`Skeleton` component): icon circle (w-8 h-8) + two text lines (w-3/4, w-1/2) |
| Empty | Centered: `Bell` icon in `neutral-100 dark:bg-[#171717]` circle + "Bildirim yok" text |
| Error | "Yüklenemedi" + `Button` size="sm" variant="ghost" for retry |

**Skeleton pattern** (matches existing `Skeleton` component):
```
<div className="flex items-start gap-3 px-4 py-3">
  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
  <div className="flex-1 space-y-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
  </div>
</div>
```

---

## 3. NotificationItem Component

**Location:** `src/features/notifications/components/NotificationItem.jsx`

### Props

```
{
  notification_type: string,
  title: string,
  body: string,
  entity_type: string,
  entity_id: string,
  created_at: string,
  notification_id: string | null,      // null for computed
  notification_source: 'computed' | 'stored',
  onResolve?: (id: string) => void,    // only for stored
  onNavigate?: () => void,             // close dropdown after navigation
}
```

### Layout (ASCII)

```
┌────────────────────────────────────────────┐
│  [icon]  Title text here                   │
│          Body text truncated to one li...  │
│          3 gün önce         [Tamamla ✓]    │
└────────────────────────────────────────────┘
```

**Grid structure:**
```
<button className="w-full flex items-start gap-3 px-4 py-3
  hover:bg-neutral-50 dark:hover:bg-[#1a1a1a]
  transition-colors text-left cursor-pointer
  focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-inset focus-visible:ring-primary-600"
  onClick={handleClick}
>
  {/* Icon */}
  <div className="flex-shrink-0 mt-0.5">
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", iconBgClass)}>
      <TypeIcon className="w-4 h-4" />
    </div>
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
      {title}
    </p>
    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
      {body}
    </p>
    <div className="flex items-center justify-between mt-1">
      <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
        {relativeTime}
      </span>
      {/* Resolve button for stored notifications only */}
    </div>
  </div>
</button>
```

### Icon Map

| notification_type | Icon (lucide-react) | Background | Icon Color |
|-------------------|---------------------|------------|------------|
| `open_work_order` | `Wrench` | `bg-info-100 dark:bg-info-900/40` | `text-info-600 dark:text-info-400` |
| `overdue_work_order` | `AlertTriangle` | `bg-error-100 dark:bg-error-900/40` | `text-error-600 dark:text-error-400` |
| `today_not_started` | `Clock` | `bg-warning-100 dark:bg-warning-900/40` | `text-warning-600 dark:text-warning-400` |
| `proposal_awaiting_response` | `FileText` | `bg-info-100 dark:bg-info-900/40` | `text-info-600 dark:text-info-400` |
| `proposal_no_response_2d` | `FileWarning` | `bg-warning-100 dark:bg-warning-900/40` | `text-warning-600 dark:text-warning-400` |
| `proposal_approved_no_wo` | `FileCheck` | `bg-success-100 dark:bg-success-900/40` | `text-success-600 dark:text-success-400` |
| `subscription_cancelled` | `XCircle` | `bg-error-100 dark:bg-error-900/40` | `text-error-600 dark:text-error-400` |
| `subscription_paused` | `PauseCircle` | `bg-warning-100 dark:bg-warning-900/40` | `text-warning-600 dark:text-warning-400` |
| `payment_due_soon` | `CreditCard` | `bg-warning-100 dark:bg-warning-900/40` | `text-warning-600 dark:text-warning-400` |
| `renewal_due_soon` | `RefreshCw` | `bg-info-100 dark:bg-info-900/40` | `text-info-600 dark:text-info-400` |
| `work_order_assigned` | `UserPlus` | `bg-primary-100 dark:bg-primary-900/40` | `text-primary-600 dark:text-primary-400` |
| `task_due_soon` | `CheckSquare` | `bg-warning-100 dark:bg-warning-900/40` | `text-warning-600 dark:text-warning-400` |
| `user_reminder` | `BellRing` | `bg-primary-100 dark:bg-primary-900/40` | `text-primary-600 dark:text-primary-400` |

**Why these colors?** Follows the existing `Badge` component variant semantics:
- `error` = overdue, cancelled, urgent
- `warning` = approaching deadline, paused
- `info` = informational, waiting
- `success` = ready for action (approved proposal)
- `primary` = user-initiated (assigned, reminder)

### Relative Time Format

Use `date-fns` (already in dependencies) with Turkish locale:

```js
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: tr })
// → "3 gün önce", "2 saat önce", "az önce"
```

### Resolve Button (Stored Notifications Only)

**Visibility:** Only shown when `notification_source === 'stored'` AND `notification_id !== null`.
**Not shown for computed notifications** — those auto-resolve when the entity status changes.

```
<button
  onClick={(e) => { e.stopPropagation(); onResolve(notification_id); }}
  className="text-[11px] font-medium text-neutral-400 hover:text-success-600
    dark:text-neutral-500 dark:hover:text-success-400 transition-colors"
  aria-label={t('notifications:actions.resolve')}
>
  <Check className="w-3.5 h-3.5" />
</button>
```

**Why small and subtle?** Most stored notifications resolve automatically when the entity closes (trigger-based). Manual resolve is a fallback, not the primary action. It shouldn't compete with the click-to-navigate action.

### Click → Deep Link

| entity_type | Route |
|-------------|-------|
| `work_order` | `/work-orders/${entity_id}` |
| `proposal` | `/proposals/${entity_id}` |
| `subscription` | `/subscriptions/${entity_id}` |
| `subscription_payment` | `/subscriptions/${entity_id}` (navigate to parent subscription) |
| `task` | `/tasks` (no individual task page exists) |
| `reminder` | No navigation — stay in dropdown |

**On click:**
1. `navigate(route)` via `useNavigate()`
2. Close dropdown (`onNavigate()` callback)

**Keyboard:** `Enter` / `Space` triggers click (native `<button>` behavior).

### Divider Between Items

```
<div className="border-b border-neutral-100 dark:border-[#1f1f1f]" />
```

Lighter than card borders (`neutral-200`) — subtle visual separation. Matches the pattern in card headers/footers using `border-neutral-200 dark:border-[#262626]` but one shade lighter for list items.

---

## 4. ReminderFormModal Component

**Location:** `src/features/notifications/components/ReminderFormModal.jsx`

### Pattern

Follows `QuickEntryModal` pattern exactly:
- Uses `Modal` component with `size="sm"` (max-w-md)
- `react-hook-form` + `zodResolver`
- Footer with Cancel + Save buttons
- `toast.success()` on save

### Props

```
{
  open: boolean,
  onClose: () => void,
  reminder?: object  // for edit mode (future)
}
```

### Form Layout (ASCII)

```
┌─────────────────────────────────┐
│  Hatırlatma Oluştur         ✕   │
├─────────────────────────────────┤
│                                 │
│  Başlık *                       │
│  ┌─────────────────────────┐    │
│  │ X kişisine geri dön     │    │
│  └─────────────────────────┘    │
│                                 │
│  Not (Opsiyonel)                │
│  ┌─────────────────────────┐    │
│  │ Fiyat teklifi gönder... │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─── Tarih ───┐ ┌── Saat ──┐  │
│  │ 2026-02-15  │ │  09:00   │  │
│  └─────────────┘ └──────────┘  │
│                                 │
├─────────────────────────────────┤
│            [İptal]  [Kaydet]    │
└─────────────────────────────────┘
```

### Fields

| Field | Component | Type | Required | Notes |
|-------|-----------|------|----------|-------|
| title | `Input` | text | Yes | Max 100 chars, placeholder: "Ne hatırlatılsın?" |
| content | `Textarea` | text | No | Max 500 chars, rows=2, placeholder: "Ek detaylar..." |
| remind_date | `Input` | date | Yes | Native date picker, min=today |
| remind_time | `Input` | time | No | Native time picker, default shows placeholder "09:00" |

**Grid layout for date+time:**
```
<div className="grid grid-cols-2 gap-4">
  <Input type="date" ... />
  <Input type="time" ... />
</div>
```

**Why native date/time pickers?** Already used throughout the app (work order scheduled_date, financial transaction_date). No custom calendar needed. Consistent UX.

### Zod Schema

```js
export const reminderSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().max(500).optional().or(z.literal('')),
  remind_date: z.string().min(1),      // YYYY-MM-DD
  remind_time: z.string().optional(),   // HH:MM or empty
});

export const reminderDefaultValues = {
  title: '',
  content: '',
  remind_date: '',
  remind_time: '',
};
```

### Submit Flow

1. Validate form
2. Call `createReminder` mutation:
   ```js
   {
     content: `${title}\n${content}`.trim(),  // or separate title + content columns
     remind_date: data.remind_date,
     remind_time: data.remind_time || '09:00',
     created_by: currentUser.id,
   }
   ```
3. `toast.success(t('notifications:reminder.created'))`
4. `onClose()` + `reset()`
5. `invalidateQueries(['notifications', 'reminders'])` (in mutation hook)

### Footer

```
<Button variant="ghost" onClick={onClose}>
  {t('common:actions.cancel')}
</Button>
<Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
  {t('common:actions.save')}
</Button>
```

---

## 5. Daily Work Page Integration

**File:** `src/features/workOrders/DailyWorkListPage.jsx`

### Changes Required

#### 5a. Add "New Reminder" Button

**Placement:** Below the worker filter row, right-aligned.

```
┌─ Week bar ────────────────────────────────┐
│  ◂   Pzt  Sal  Çar  Per  Cum  Cmt  Paz  ▸ │
├───────────────────────────────────────────┤
│  Tümü | Ali | Ahmet | Mehmet              │  ← Worker filter
├───────────────────────────────────────────┤
│                        [+ Hatırlatma Ekle]│  ← NEW: reminder button
├───────────────────────────────────────────┤
│  ... work order cards ...                 │
│                                           │
│  ┌─ Hatırlatmalarım ────────────────────┐ │  ← NEW: reminders section
│  │  ☐ X kişisine geri dön — 15 Şubat   │ │
│  │  ☐ Fiyat teklifi gönder — 18 Şubat  │ │
│  └──────────────────────────────────────┘ │
│                                           │
│  ... TodayPlansSection ...                │
└───────────────────────────────────────────┘
```

**Button spec:**
```
<Button
  variant="outline"
  size="sm"
  leftIcon={<Plus className="w-4 h-4" />}
  onClick={() => setReminderModalOpen(true)}
>
  {t('notifications:reminder.addButton')}
</Button>
```

Why `outline` not `primary`? The primary action on this page is "Yeni İş Emri" (if present). The reminder button is secondary.

#### 5b. Active Reminders Section

**Placement:** Between work order cards and TodayPlansSection.
**Data:** `useReminders()` hook → `user_reminders WHERE completed_at IS NULL`.
**Only shown when:** reminders exist AND selected date is today.

**Reminder row:**
```
<div className="flex items-center gap-3 px-4 py-3
  bg-white dark:bg-[#171717]
  border border-neutral-200 dark:border-[#262626] rounded-lg">

  {/* Checkbox to complete */}
  <button onClick={() => completeReminder(id)} ...>
    <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
  </button>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
      {title}
    </p>
    <p className="text-xs text-neutral-500 dark:text-neutral-400">
      {formattedDate} {remind_time !== '09:00' && `· ${remind_time}`}
    </p>
  </div>
</div>
```

**Complete animation:** On click, the row fades out (`opacity-0 transition-opacity duration-300`), then removed from list after 300ms.

**Section header:**
```
<h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
  {t('notifications:reminder.myReminders')}
</h3>
```

---

## 6. Dashboard Widget Updates

**File:** `src/pages/DashboardPage.jsx`

The dashboard already shows:
- Today's work orders count
- Pending work orders count
- Open tasks count

These are **already notification-adjacent data**. No duplicate widgets needed.

### Changes

1. **Make stat cards clickable** — clicking "Bekleyen İş Emirleri: 15" navigates to `/work-orders?status=pending` (or opens bell dropdown filtered to work orders).

2. **Add visual cue** — When count > 0, show a small colored dot on the stat card:
```
{count > 0 && (
  <span className="w-2 h-2 rounded-full bg-warning-500" />
)}
```

3. **No new dashboard widgets** for notifications. The bell icon in the topbar is the unified notification entry point. Dashboard stays focused on summary metrics.

---

## 7. Interaction Flows

### Flow 1: View Notifications (Desktop)

```
User clicks bell → dropdown opens (animate-slide-down)
  → User sees list of active notifications
  → User clicks a notification item
    → dropdown closes
    → navigate to entity page
```

### Flow 2: View Notifications (Mobile)

```
User taps bell → bottom sheet opens (animate-slide-up + backdrop)
  → User scrolls through notifications
  → User taps a notification item
    → bottom sheet closes
    → navigate to entity page
  OR
  → User taps backdrop / X button → bottom sheet closes
```

### Flow 3: Resolve Stored Notification

```
User sees subscription_cancelled notification
  → Clicks the small ✓ icon (stopPropagation prevents navigation)
  → API call: fn_resolve_notification(id)
  → Optimistic update: item fades out
  → Badge count decrements
```

### Flow 4: Create Reminder

```
User on Daily Work page → clicks "+ Hatırlatma Ekle"
  → ReminderFormModal opens (standard Modal component)
  → User fills title, optional content, picks date
  → Clicks "Kaydet"
    → API: insert into user_reminders
    → Toast: "Hatırlatma oluşturuldu"
    → Modal closes
    → Reminders list refreshes
```

### Flow 5: Complete Reminder

```
User on Daily Work page → sees reminder in list
  → Clicks circle/checkbox
  → API: update user_reminders SET completed_at = now()
  → Item fades out (300ms)
  → Badge count decrements (if reminder was in active notifications)
```

---

## 8. Responsive Breakpoints

| Component | Mobile (<768px) | Tablet (768-1023px) | Desktop (1024px+) |
|-----------|-----------------|---------------------|-------------------|
| NotificationBell | In topbar, same position | Same | Same |
| Badge | Same sizing | Same | Same |
| NotificationDropdown | Bottom sheet (createPortal, z-200) | Bottom sheet | Popover dropdown (z-50, w-[400px]) |
| NotificationItem | Full width, larger touch targets (py-3.5) | Same as mobile | Standard (py-3) |
| ReminderFormModal | Bottom sheet (Modal default on mobile) | Modal | Modal |
| Reminders section | Single column below WO cards | Same | Same |

**Breakpoint detection:**
```js
// Use existing pattern — CSS classes, not JS media query
className="hidden lg:block"  // desktop dropdown
className="lg:hidden"        // mobile bottom sheet
```

Both render, but only one visible. Simple, no JS state for breakpoint detection.

---

## 9. Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between bell icon → dropdown items |
| `Enter` / `Space` | Open dropdown (on bell), navigate (on item), resolve (on resolve button) |
| `Escape` | Close dropdown / bottom sheet |
| `Arrow Down` | Move to next notification item (within dropdown) |
| `Arrow Up` | Move to previous notification item |

### ARIA Attributes

**Bell button:**
```
aria-label="Bildirimler (15 yeni)"  // dynamic with count
aria-expanded={isOpen}
aria-haspopup="true"
aria-controls="notification-dropdown"
```

**Dropdown container:**
```
id="notification-dropdown"
role="menu"
aria-label="Bildirim listesi"
```

**Notification items:**
```
role="menuitem"
aria-label="Vadesi geçmiş iş emri: ABC Güvenlik — 3 gün önce"
```

**Bottom sheet (mobile):**
```
role="dialog"
aria-modal="true"
aria-label="Bildirimler"
```

### Focus Management

- **Open dropdown:** Focus moves to first notification item (or header if empty)
- **Close dropdown:** Focus returns to bell button
- **Focus trap:** Tab cycles within dropdown/bottom sheet (matches Modal pattern)

---

## 10. Translation Keys

**File:** `src/locales/tr/notifications.json`

```json
{
  "title": "Bildirimler",
  "bell": {
    "label": "Bildirimler",
    "labelWithCount": "Bildirimler ({{count}} yeni)"
  },
  "empty": {
    "title": "Bildirim yok",
    "description": "Tüm işler güncel"
  },
  "error": {
    "loadFailed": "Bildirimler yüklenemedi"
  },
  "actions": {
    "resolve": "Tamamlandı işaretle",
    "viewAll": "Tümünü Gör",
    "retry": "Tekrar Dene"
  },
  "types": {
    "open_work_order": "Açık İş Emri",
    "overdue_work_order": "Vadesi Geçmiş İş Emri",
    "today_not_started": "Bugün Başlanmamış",
    "proposal_awaiting_response": "Cevap Bekleyen Teklif",
    "proposal_no_response_2d": "2+ Gündür Cevapsız Teklif",
    "proposal_approved_no_wo": "Montaj Bekleyen Teklif",
    "subscription_cancelled": "Abonelik İptal Edildi",
    "subscription_paused": "Abonelik Duraklatıldı",
    "payment_due_soon": "Ödeme Vadesi Yaklaşıyor",
    "renewal_due_soon": "Yenileme Tarihi Yaklaşıyor",
    "work_order_assigned": "İş Emri Atandı",
    "task_due_soon": "Görev Vadesi Yaklaşıyor",
    "user_reminder": "Hatırlatma"
  },
  "reminder": {
    "addButton": "Hatırlatma Ekle",
    "createTitle": "Hatırlatma Oluştur",
    "myReminders": "Hatırlatmalarım",
    "fields": {
      "title": "Başlık",
      "content": "Not",
      "date": "Tarih",
      "time": "Saat"
    },
    "placeholders": {
      "title": "Ne hatırlatılsın?",
      "content": "Ek detaylar...",
      "time": "09:00"
    },
    "created": "Hatırlatma oluşturuldu",
    "completed": "Hatırlatma tamamlandı"
  }
}
```

---

## 11. File Structure Summary

```
src/features/notifications/
├── api.js                              # Supabase calls (badge, list, resolve, reminders CRUD)
├── hooks.js                            # React Query hooks + Realtime subscription
├── schema.js                           # Zod schema for reminder form
├── index.js                            # Barrel exports
└── components/
    ├── NotificationBell.jsx            # Bell icon + badge + dropdown trigger
    ├── NotificationDropdown.jsx        # Desktop popover + mobile bottom sheet
    ├── NotificationItem.jsx            # Single notification row
    └── ReminderFormModal.jsx           # Create reminder modal

Modified files:
├── src/app/AppLayout.jsx               # Add NotificationBell to topbar
├── src/features/workOrders/DailyWorkListPage.jsx  # Add reminder button + section
├── src/lib/i18n.js                     # Register notifications namespace
├── src/locales/tr/notifications.json   # Translation file
```

---

## 12. Implementation Order

| Step | Component | Depends On |
|------|-----------|------------|
| 1 | `notifications.json` (translations) | Nothing |
| 2 | `api.js` + `hooks.js` + `schema.js` | Backend migrations complete |
| 3 | `NotificationItem.jsx` | Translations |
| 4 | `NotificationDropdown.jsx` | NotificationItem |
| 5 | `NotificationBell.jsx` | NotificationDropdown |
| 6 | `AppLayout.jsx` integration | NotificationBell |
| 7 | `ReminderFormModal.jsx` | Schema, hooks |
| 8 | `DailyWorkListPage.jsx` integration | ReminderFormModal, hooks |

---

## 13. What This Plan Does NOT Include

| Excluded | Reason |
|----------|--------|
| Filter tabs in dropdown | Phase 1 shows flat list. Filtering adds complexity without proven need. |
| Full /notifications page | Dropdown is sufficient. Can add in Phase 1.5 if list is too long. |
| Notification grouping | "5 overdue work orders" grouped as one — adds complexity. Flat list first. |
| Sound/vibration | Not in concept doc. In-app visual only. |
| Toast notifications on event | Bell badge update is sufficient. Toasts are for user actions (save, delete). |
| Swipe-to-dismiss (mobile) | Adds touch gesture complexity. Tap resolve button instead. |
| Animation on badge count change | Subtle, nice-to-have. Can add later with CSS animation. |
