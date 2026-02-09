# Calendar Feature — Planning & Discussion

**Context:** Field service CRM for HVAC/electrical. Calendar view for work order scheduling.  
**Current state:** Work orders have `scheduled_date` and `scheduled_time`; list/table only. No calendar.  
**Goal:** Plan the best approach before building.

---

## 1. Calendar Design Approaches (2–3 options)

### Approach A: Full-page calendar (`/calendar`) — **Recommended**

| Aspect | Description |
|--------|-------------|
| **Location** | Dedicated route `/calendar`, sidebar item (e.g. "Takvim" with calendar icon). |
| **Weekly** | 7-day horizontal strip at top; time slots below (e.g. 08:00–18:00). One row per hour. |
| **Monthly** | Full month grid; each day shows event pills/dots. Click day → see list or mini day view. |
| **Multiple events same day/time** | Stack pills in the cell; "+N more" if overflow. Click to expand. |

**Pros:** Clear mental model, room for filters/toolbar, deep-linkable, matches "Phase 2 screen" in pages-and-screens.  
**Cons:** One more top-level nav item.

---

### Approach B: Calendar as a tab on Work Orders

| Aspect | Description |
|--------|-------------|
| **Location** | `/work-orders` with tabs: "List" | "Calendar". Same data, two views. |
| **Views** | Same weekly/monthly idea as A, but scoped to work-orders page. |

**Pros:** No new nav item; calendar lives where work orders live.  
**Cons:** Work Orders page gets heavier; calendar feels secondary; URL less clear (`/work-orders?view=calendar`).

---

### Approach C: Modal/drawer calendar

| Aspect | Description |
|--------|-------------|
| **Location** | Button "Takvime git" or "Haftalık görünüm" opens a modal/drawer overlay. |
| **Views** | Simplified: e.g. weekly only in drawer, "Open full calendar" → `/calendar`. |

**Pros:** Quick peek without leaving current page.  
**Cons:** Small viewport in modal; complex for monthly + filters; not ideal for "plan my day" usage.

---

**Recommendation:** **Approach A (full page `/calendar`)**. Fits a company owner who plans their day; sidebar access and URL are clear; space for weekly + monthly + filters. Approach B is a valid alternative if you want to avoid a new nav item.

---

## 2. View Modes: Weekly vs Monthly

| Question | Recommendation |
|----------|----------------|
| **Weekly: horizontal 7 days or vertical timeline?** | **Vertical timeline** (e.g. 08:00–18:00 left column, 7 days as columns). Matches "this week’s schedule" and avoids tiny hour cells on small screens. |
| **Monthly: full grid?** | **Yes.** Full month grid; events as pills or dots; click day → day detail or list for that day. |
| **Toggle** | **Weekly / Monthly** toggle in toolbar (e.g. segmented control or tabs). Default: Weekly for field/admin "today" use. |

---

## 3. User Workflows (who sees what, what they do)

### Role summary (from existing RLS / pages-and-screens)

| Role | Calendar sees | Can do |
|------|----------------|--------|
| **Admin** | All work orders | Create, edit, assign, reschedule, filter by user/status/type. |
| **Field worker** | Only assigned work orders | View, open detail; create allowed; edit/reschedule only own. |
| **Accountant** | All work orders | View only (read-only). |

### User workflow diagram (text)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CALENDAR PAGE (/calendar)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  [Weekly] [Monthly]     [< Feb 2026 >]     [Filter: All ▼] [Status ▼]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WEEKLY:                        MONTHLY:                                │
│  ┌──────┬─────┬─────┬─────┐     ┌─────────────────────────────────┐   │
│  │ Time │ Mon │ Tue │ Wed │     │  Mo  Tu  We  Th  Fr  Sa  Su     │   │
│  ├──────┼─────┼─────┼─────┤     │  [1] [2] [3] [4] [5] [6] [7]    │   │
│  │ 08   │     │     │ WO1 │     │  ... [3]: WO1, WO2 (pills)       │   │
│  │ 09   │ WO2 │     │     │     │  Click [3] → day list/drawer     │   │
│  │ 10   │     │     │     │     └─────────────────────────────────┘   │
│  │ ...  │     │     │     │                                            │
│  └──────┴─────┴─────┴─────┘     Click empty slot (weekly) → New WO     │
│                                                                         │
│  Click event → Detail (drawer or navigate to /work-orders/:id)           │
│  Click empty slot (weekly) → "New work order" (prefill date/time)       │
└─────────────────────────────────────────────────────────────────────────┘

Actions from calendar:
  • Click empty slot     → Create work order (scheduled_date/time prefilled)
  • Click event          → View/Edit work order (drawer or page)
  • (Phase 2) Drag event → Reschedule (update scheduled_date/time)
  • Toolbar filters      → By status, type, assigned user (admin)
```

---

## 4. Component Breakdown (what to build)

High-level only; no code. Fits your modular frontend.

| # | Component / layer | Responsibility |
|---|-------------------|----------------|
| 1 | **Route** | `/calendar` → `CalendarPage` (or `CalendarScreen`). |
| 2 | **CalendarPage** | Layout: toolbar (view toggle, date nav, filters), main area (weekly or monthly), any FAB for "New work order". |
| 3 | **CalendarToolbar** | View mode (Weekly/Monthly), date range navigator (prev/next week or month), filters (status, type, assignee — respect role). |
| 4 | **CalendarWeeklyView** | Receives `events` (work orders mapped to { id, title, start, end, ... }). Renders time grid + day columns; maps event to slot by scheduled_date/scheduled_time. |
| 5 | **CalendarMonthlyView** | Receives same `events`. Renders month grid; each day shows pills/dots; click day → day detail or list. |
| 6 | **CalendarEvent** (pill/card) | Single event in grid: e.g. title, time, customer or status. Click → open detail. Optional: color by status or type. |
| 7 | **EventDetailDrawer** (or bottom sheet on mobile) | Shows work order summary; actions: "Open full detail", "Edit", "Reschedule". Reuse existing WorkOrder detail content where possible. |
| 8 | **NewWorkOrderFromSlot** | When user clicks empty slot: open Work Order form with `scheduled_date` and `scheduled_time` prefilled (modal or navigate to `/work-orders/new?date=...&time=...`). |
| 9 | **Calendar API/hooks** | `useCalendarWorkOrders(dateFrom, dateTo, filters)` → fetch via existing `fetchWorkOrders({ dateFrom, dateTo, status, type })`; map to `{ id, title, start, end, ... }` for the calendar. No new backend endpoint if list API already supports date range (it does). |

Optional later:

- **DragHandle on CalendarEvent** + `onEventDrop` → PATCH work order `scheduled_date` / `scheduled_time`.
- **Real-time:** Supabase realtime on `work_orders` so when admin reschedules, calendar updates (Phase 2).

---

## 5. Implementation Complexity (simple vs advanced)

| Level | Scope | Effort (rough) |
|-------|--------|----------------|
| **Simple (MVP)** | Full page `/calendar`. Weekly view only. Month view = list of days with event count + click day → list. No drag. Filters: status, type. Click event → navigate to `/work-orders/:id`. Click "New" in toolbar → `/work-orders/new`. Use **react-big-calendar** or **FullCalendar** (see below). | Medium (1–2 sprints) |
| **Mid** | Add proper monthly grid with pills. Event detail drawer/sheet instead of only navigate. Click empty slot → new WO with prefilled date/time. Filter by assignee (admin). | +1 sprint |
| **Advanced** | Drag-and-drop reschedule, real-time updates, color by status/type, "today" shortcut, print-friendly view. | +1–2 sprints |

Recommendation: **Start with Simple (MVP)** then add Mid features.

---

## 6. Technical Choices: Library vs Custom

| Option | Pros | Cons |
|--------|------|------|
| **react-big-calendar** | Free, flexible, weekly/monthly, good for event list; fits controlled React state. | Styling and i18n need some work; mobile needs responsive tweaks. |
| **FullCalendar** | Very polished, drag-drop, responsive. | Core features free; some advanced features paid. |
| **Custom** | Full control, minimal bundle. | Higher effort for grid logic, accessibility, keyboard. |

**Recommendation:** **react-big-calendar** for speed and flexibility. If you later need premium UX (e.g. drag-drop out of the box, resource view), evaluate FullCalendar.

- **Real-time:** Optional Phase 2: Supabase Realtime on `work_orders`; when a row changes, refetch or update local state so calendar refreshes.
- **Color coding:** By `status` (e.g. pending=amber, in_progress=blue, completed=green) or by `type` (service vs installation). Prefer status so "what’s done vs pending" is obvious.

---

## 7. Mobile-First Recommendations

Align with your existing mobile plan (bottom sheet, touch targets, drawer).

| Topic | Recommendation |
|-------|----------------|
| **Default view on mobile** | **Weekly** (easier than dense month grid). Option to switch to monthly. |
| **Event detail** | **Bottom sheet** (same pattern as modals in mobile-tablet-implementation-plan). Title, customer, time, status; primary action "Open full detail" → `/work-orders/:id`. |
| **New work order from calendar** | Bottom sheet with minimal form (date, time, customer) or navigate to full form with query params. |
| **Week/month navigation** | **Swipe** left/right to change week/month; keep prev/next buttons as fallback. |
| **Filters** | Collapsible filter bar or single "Filters" chip that opens a small sheet/modal. |
| **Touch** | Event pills at least 44px tap target; avoid hover-only actions. |

---

## 8. Decisions to Lock Before Implementation

1. **Route:** Confirm `/calendar` as full page (Approach A) vs tab on work orders (B).  
2. **Library:** react-big-calendar vs FullCalendar vs custom.  
3. **MVP scope:** Weekly + simple month list, or full monthly grid in v1.  
4. **Event click:** Navigate only vs drawer/sheet first then "Open full".  
5. **Empty-slot click:** Always "New work order" with prefilled date/time (and optionally customer from context if any).  

---

## 10. i18n Support

All calendar UI text, labels, and date/time formatting for TR/EN. Implementation follows existing conventions: react-i18next, namespaces per feature, Intl for app-wide date/numbers.

### 10.1 File structure

- **New namespace:** `calendar` — new file `src/locales/tr/calendar.json` (and later `src/locales/en/calendar.json` when adding English).
- **Rationale:** Same pattern as `dashboard`, `workOrders`; keeps calendar strings in one place. Reuse `common` and `workOrders` for shared labels (e.g. "Filtrele", "Detayları Gör", "Bugün", "Önceki", "Sonraki", status, type) to avoid duplication.
- **Registration:** When implementing, add `calendar` to `ns` and `resources.tr` in `src/lib/i18n.js`.

### 10.2 Translatable strings and proposed keys

**View mode toggle**

| Key | TR | EN |
|-----|----|----|
| `calendar.view.weekly` | Haftalık | Weekly |
| `calendar.view.monthly` | Aylık | Monthly |

**Navigation**

| Key | TR | EN | Note |
|-----|----|-----|------|
| Reuse `common:time.today` | Bugün | Today | Do not duplicate; use `common:time.today` |
| Reuse `common:pagination.previous` | Önceki | Previous | Use `common:pagination.previous` |
| Reuse `common:pagination.next` | Sonraki | Next | Use `common:pagination.next` |

**Toolbar / filters**

| Key | TR | EN | Note |
|-----|----|-----|------|
| Reuse `common:actions.filter` | Filtrele | Filter | Use `common:actions.filter` |
| Reuse `workOrders:list.filters.status` | Durum | Status | Use workOrders |
| Reuse `workOrders:list.filters.type` | Tip | Type | Use workOrders |
| `calendar.toolbar.assigned` | Atanan | Assigned | Calendar-specific (or reuse `workOrders:detail.fields.assignedTo`) |

**Empty states**

| Key | TR | EN |
|-----|----|----|
| `calendar.empty.week` | Bu hafta iş emri yok | No work orders this week |
| `calendar.empty.month` | Bu ayda iş emri yok | No work orders this month |
| `calendar.empty.day` | Bu günde iş emri yok | No work orders this day |

**Actions**

| Key | TR | EN | Note |
|-----|----|-----|------|
| Reuse `workOrders:list.addButton` | Yeni İş Emri | New Work Order | Use workOrders |
| Reuse `common:actions.viewDetails` | Detayları Gör | View Details | Use common |

**Event detail (drawer/sheet)**

| Key | TR | EN |
|-----|----|----|
| `calendar.detail.title` | İş emri | Work order |
| `calendar.detail.customer` | Müşteri | Customer |
| `calendar.detail.time` | Saat | Time |
| `calendar.detail.openFull` | Tam detayı aç | Open full detail |

Status and type labels: reuse `common:status.*`, `common:type.service`, `common:type.installation`.

**Errors**

| Key | TR | EN |
|-----|----|----|
| `calendar.error.loadFailed` | İş emri yüklenemedi | Failed to load work order |
| `calendar.error.loadListFailed` | İş emirleri yüklenemedi | Failed to load work orders |

**Nav label (sidebar)**

| Key | TR | EN |
|-----|----|----|
| `calendar.nav.calendar` or `common:nav.calendar` | Takvim | Calendar |

**Reuse reference:** "Today", "Previous", "Next", "Filter", "Status", "Type", "New Work Order", "View Details" come from existing namespaces. Use: `common:time.today`, `common:pagination.previous`, `common:pagination.next`, `common:actions.filter`, `workOrders:list.filters.status`, `workOrders:list.filters.type`, `workOrders:list.addButton`, `common:actions.viewDetails`. Do not duplicate these in `calendar.json`.

### 10.3 Day / month names and react-big-calendar locale

- **Source of day/month names:** react-big-calendar does not use i18next; it uses the **localizer** (e.g. date-fns) for formatting. Day and month names (e.g. "Pazartesi", "Şubat", "Pzt") come from the **date library locale**, not from JSON.
- **Strategy:** Use **date-fns localizer** with locale objects keyed by i18n language:
  - `date-fns/locale/tr` for Turkish ("Pazartesi", "Şubat", "Pzt").
  - `date-fns/locale/en-US` for English ("Monday", "February", "Mon").
- **Integration:** Pass `localizer` to Calendar with `locale` derived from `i18n.language` (e.g. map `tr` → `tr`, `en` → `en-US`). When the user switches language, `i18n.changeLanguage(lng)` plus the same `lng` (mapped if needed) passed to the localizer makes the calendar re-render with the correct day/month names.
- **Configuration:** react-big-calendar will be configured with `dateFnsLocalizer` and locales `{ tr, 'en-US': enUS }` (or equivalent); the active locale is `i18n.language` with a trivial mapping `en` → `en-US` if needed.

### 10.4 Date/time formatting strategy

- **Inside the app (event labels, toolbar, drawer):** Use **Intl** (consistent with `src/lib/utils.js` and `docs/i18n.md`): `Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', options).format(date)`. Use for long date (e.g. "3 Şubat 2026, Pazartesi" / "Monday, Feb 3, 2026") and time (e.g. "14:30" / "2:30 PM"). Optionally add helpers such as `formatCalendarDate(date)` and `formatCalendarTime(date)` in utils that use `i18n.language`.
- **Inside react-big-calendar:** Formatting is controlled by the **localizer** (date-fns). Use the same locale as above so axis labels and tooltips use the correct language (TR/EN).
- **Decision:** Do not introduce date-fns for general app formatting; use it only for the calendar localizer. Keep Intl for all other date/time display so the rest of the app stays consistent and dependency-light.

### 10.5 Proposed `calendar.json` structure (TR)

Only calendar-specific keys; shared strings stay in `common` and `workOrders`.

**`src/locales/tr/calendar.json`**

```json
{
  "view": {
    "weekly": "Haftalık",
    "monthly": "Aylık"
  },
  "nav": {
    "calendar": "Takvim"
  },
  "toolbar": {
    "assigned": "Atanan"
  },
  "empty": {
    "week": "Bu hafta iş emri yok",
    "month": "Bu ayda iş emri yok",
    "day": "Bu günde iş emri yok"
  },
  "detail": {
    "title": "İş emri",
    "customer": "Müşteri",
    "time": "Saat",
    "openFull": "Tam detayı aç"
  },
  "error": {
    "loadFailed": "İş emri yüklenemedi",
    "loadListFailed": "İş emirleri yüklenemedi"
  }
}
```

**`src/locales/en/calendar.json`** (when adding English)

```json
{
  "view": {
    "weekly": "Weekly",
    "monthly": "Monthly"
  },
  "nav": {
    "calendar": "Calendar"
  },
  "toolbar": {
    "assigned": "Assigned"
  },
  "empty": {
    "week": "No work orders this week",
    "month": "No work orders this month",
    "day": "No work orders this day"
  },
  "detail": {
    "title": "Work order",
    "customer": "Customer",
    "time": "Time",
    "openFull": "Open full detail"
  },
  "error": {
    "loadFailed": "Failed to load work order",
    "loadListFailed": "Failed to load work orders"
  }
}
```

### 10.6 Library integration summary

- **i18next:** Calendar page uses `useTranslation('calendar')`; use `t('calendar:view.weekly')` etc. For shared labels use `t('common:time.today')`, `t('workOrders:list.addButton')`, etc.
- **react-big-calendar:** Use `dateFnsLocalizer` with a `locales` object; set `locale={i18n.language === 'en' ? 'en-US' : i18n.language}` (or equivalent) so day/month names and date formatting inside the calendar follow the current language.
- **Intl:** Use for any custom date/time strings outside the calendar component (e.g. drawer subtitle, custom event tooltip) with locale from `i18n.language`.

---

## 11. Next Steps

1. **Stakeholder:** Choose Approach A or B and MVP scope (Section 5).  
2. **Tech:** Add `/calendar` route and sidebar entry; implement `useCalendarWorkOrders` and map work orders to events.  
3. **UI:** Implement CalendarPage with toolbar + Weekly view (library or custom).  
4. **Then:** Monthly grid, then event drawer/sheet, then filters, then optional drag-and-drop and real-time.

---

*This doc is the single source of truth for calendar feature planning. Update it when decisions are made or scope changes.*
