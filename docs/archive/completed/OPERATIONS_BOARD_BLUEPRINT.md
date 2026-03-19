# Operations Board Blueprint (Operasyon Merkezi)

> **Status:** Implementation Complete (Phases A–E)
> **Date:** 2026-03-19
> **Author:** Jan + Claude (collaborative design)
> **Replaces:** `/daily-work`, `/calendar`, `/tasks` (3-screen fragmented system)

---

## 1. Vision & Problem Statement

### The Problem

Our field service team manages work through three disconnected screens:

| Screen | Route | Purpose | Problem |
|--------|-------|---------|---------|
| Gunluk Isler | `/daily-work` | See today's work orders | Only shows scheduled WOs, no request intake |
| Takvim | `/calendar` | Week/month schedule view | Read + drag scheduling, but no backlog concept |
| Yillik Plan | `/tasks` | Generic task management | Not connected to customers/sites, acts as a todo list |

Real-world workflow is managed in Excel because the app doesn't support the actual pipeline:

```
Customer calls -> Record problem -> Call back to confirm -> Schedule visit -> Execute -> Done or Retry
```

### The Solution

One screen. One workflow. Excel speed.

**Operations Center (Operasyon Merkezi)** — a tabbed interface that handles the full lifecycle from phone call to job completion.

### Design Principles

1. **Excel-speed entry**: Record a phone call in < 8 seconds (Customer + Site + Problem + Enter)
2. **One-team focus**: No multi-technician timeline. One shared calendar. Simple.
3. **Clean data separation**: Phone calls are NOT work orders. Requests convert to WOs only when confirmed and scheduled.
4. **Boomerang pattern**: Failed jobs return to the pool automatically for rescheduling.
5. **Zero clutter**: One nav item replaces three. Full-width tabs, no split panels.

---

## 2. Data Lifecycle

### The Pipeline

```
                    TALEP HAVUZU                          TAKVIM                    IS GECMISI
               (Service Requests)                    (Work Orders)              (Completed WOs)

  Phone Call
      |
      v
  [New Request] --- contact_status --->  [Confirmed]  --- schedule --->  [Work Order Created]
   status: open      not_contacted        status: open                   status: scheduled
   region: europe    no_answer            contact: confirmed             request.status: scheduled
                     confirmed                                           request.work_order_id: WO.id
                     cancelled                |                                   |
                                              v                                   v
                                         "Planla"                          Field Execution
                                      (pick date/time)                          |
                                              |                          -------+-------
                                              v                          |             |
                                     Auto-create Work Order         GREEN          RED
                                     (form_no, type, date)       Completed       Failed
                                                                      |             |
                                                                      v             v
                                                                 WO completed   WO cancelled
                                                                 Request:       Request: boomerang
                                                                 completed      -> open + reschedule_count++
                                                                                -> failure_reason stored
                                                                                -> re-enters pool
```

### Key Rules

1. **Service Requests are cheap** — 3 required fields (customer, site, description). No form number, no materials, no assignment. Just a phone note.
2. **Work Orders are expensive** — form_no generated, work_type assigned, date/time set, triggers finance on completion. Only created when a request is confirmed and scheduled.
3. **Conversion is one-way** — a request creates a WO, not the other way around. The request tracks the full lifecycle; the WO tracks the execution.
4. **Failed WOs boomerang** — when a WO is marked failed, the linked request reverts to `open`, increments `reschedule_count`, stores the failure reason, and reappears in the pool.

---

## 3. Database Schema

### 3.1 New Table: `service_requests`

```sql
CREATE TABLE service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core (captured during phone call)
  customer_id       UUID NOT NULL REFERENCES customers(id),
  site_id           UUID REFERENCES customer_sites(id),
  description       TEXT NOT NULL,

  -- Classification
  region            TEXT NOT NULL DEFAULT 'istanbul_europe'
                    CHECK (region IN (
                      'istanbul_europe',
                      'istanbul_anatolia',
                      'outside_istanbul'
                    )),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  work_type         TEXT NOT NULL DEFAULT 'service'
                    CHECK (work_type IN (
                      'survey', 'installation', 'service', 'maintenance', 'other'
                    )),

  -- Contact tracking (traffic light)
  contact_status    TEXT NOT NULL DEFAULT 'not_contacted'
                    CHECK (contact_status IN (
                      'not_contacted',   -- Red
                      'no_answer',       -- Yellow
                      'confirmed',       -- Green
                      'cancelled'        -- Gray (customer cancelled)
                    )),
  contact_attempts  INT NOT NULL DEFAULT 0,
  last_contact_at   TIMESTAMPTZ,
  contact_notes     TEXT,

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN (
                      'open',        -- In the pool (new or boomeranged)
                      'scheduled',   -- Date assigned, WO created
                      'completed',   -- WO finished successfully (green)
                      'failed',      -- WO failed, will boomerang (red)
                      'cancelled'    -- Abandoned
                    )),

  -- Work Order link (set on conversion)
  work_order_id     UUID REFERENCES work_orders(id),

  -- Scheduling (set when confirmed + date assigned)
  scheduled_date    DATE,
  scheduled_time    TIME,

  -- Failure / Rescheduling
  failure_reason    TEXT,
  reschedule_count  INT NOT NULL DEFAULT 0,

  -- Metadata
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ  -- soft delete
);

-- Performance indexes
CREATE INDEX idx_sr_status_open
  ON service_requests(status)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX idx_sr_region
  ON service_requests(region)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX idx_sr_contact_status
  ON service_requests(contact_status)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX idx_sr_scheduled_date
  ON service_requests(scheduled_date)
  WHERE status = 'scheduled';

CREATE INDEX idx_sr_customer
  ON service_requests(customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_sr_work_order
  ON service_requests(work_order_id)
  WHERE work_order_id IS NOT NULL;

-- Auto-update timestamp
CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Admin and accountant can insert service requests"
  ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'accountant')
    )
  );

CREATE POLICY "Admin and accountant can update service requests"
  ON service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'accountant')
    )
  );
```

### 3.2 View: `service_requests_detail`

```sql
CREATE OR REPLACE VIEW service_requests_detail AS
SELECT
  sr.*,
  c.company_name AS customer_name,
  c.phone AS customer_phone,
  cs.site_name,
  cs.account_no,
  cs.city,
  cs.district,
  cs.contact_phone AS site_contact_phone,
  p.full_name AS created_by_name,
  wo.form_no AS work_order_form_no,
  wo.status AS work_order_status
FROM service_requests sr
LEFT JOIN customers c ON c.id = sr.customer_id
LEFT JOIN customer_sites cs ON cs.id = sr.site_id
LEFT JOIN profiles p ON p.id = sr.created_by
LEFT JOIN work_orders wo ON wo.id = sr.work_order_id
WHERE sr.deleted_at IS NULL;
```

### 3.3 RPC: `fn_convert_request_to_work_order`

This is the core conversion function. When a confirmed request is scheduled, it atomically creates a work order and links it back.

> **Note:** `form_no` is optional on `work_orders` and manually entered by users — no auto-generation sequence exists. The RPC creates the WO without a form_no; users can add it later on the WO detail page. Work orders link to customers through `site_id -> customer_sites -> customers` (no `customer_id` column on `work_orders`).

See `supabase/migrations/00160_service_requests.sql` for the actual implementation.

### 3.4 RPC: `fn_boomerang_failed_request`

When a work order is marked as failed, this function returns the linked request to the pool.

See `supabase/migrations/00160_service_requests.sql` for the actual implementation. Key behaviors:
- Cancels the linked WO (appends failure reason to notes)
- Resets request to `open` + `not_contacted`
- Clears `work_order_id`, `scheduled_date`, `scheduled_time`
- Increments `reschedule_count`
- Auto-escalates to `urgent` after 3 failures

### 3.5 RPC: `fn_get_operations_stats`

Stats for the Insights tab. Returns JSON with two keys: `pool` (live open request counts) and `period` (date-filtered success/fail metrics).

See `supabase/migrations/00160_service_requests.sql` for the actual implementation.

### 3.6 Existing Schema Impact

| Existing Table/Object | Change Needed | Reason |
|---|---|---|
| `work_orders` | None | WOs continue to work as-is. Requests create WOs through the conversion RPC. |
| `work_orders_detail` view | None | No structural change. |
| `get_daily_work_list` RPC | None | Still works for field worker mobile view. |
| `financial_transactions` triggers | None | Fire on WO completion as before. Requests don't touch finance. |
| `tasks` table | No immediate change | Will be deprecated in Phase E, not deleted. Data preserved. |
| `update_updated_at_column()` function | None | Reused by new trigger. |

---

## 4. UI/UX Architecture

### 4.1 Route & Navigation

**New:**

| Route | Component | Access |
|---|---|---|
| `/operations` | `OperationsBoardPage.jsx` | Admin + Accountant |

**Navigation Change:**

```
BEFORE (3 items):                    AFTER (1 item):
  Planlama group:                      Operasyon group:
    - Takvim (/calendar)                 - Operasyon Merkezi (/operations)
    - Yillik Plan (/tasks)               - Bildirimler (/notifications)
    - Is Gecmisi (/work-history)         - Aksiyon Listesi (/action-board)
  Operasyon group:                     Planlama group:
    - Bildirimler                        - Is Gecmisi (/work-history)
    - Aksiyon Listesi
```

`/daily-work` remains but is moved to a secondary location — it becomes the field worker's mobile-only view of their assigned WOs for today.

### 4.2 Tabbed Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Operasyon Merkezi          [Talep Havuzu] [Takvim] [Ozet]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    << Active Tab Content >>                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Tab 1: Request Pool (Talep Havuzu)

**Quick Entry Row (top of tab):**

```
┌──────────────────────────────────────────────────────────────────┐
│ +  [Musteri ara...▼]  [Lokasyon ▼]  [Problem aciklamasi...]  ↵  │
└──────────────────────────────────────────────────────────────────┘
```

- **Customer field**: Typeahead combobox using `normalizeForSearch`. Type 3+ chars, dropdown appears. Uses existing `customers` query.
- **Site field**: Auto-filtered by selected customer. If customer has 1 site, auto-select. Uses existing `customer_sites` query.
- **Problem field**: Free text. This is the only field the user truly types.
- **Enter**: Creates request with defaults (region from site's city, priority: normal, work_type: service, contact_status: not_contacted).
- **Tab navigation**: Tab between fields like Excel cells.

**Auto-Region Detection:**

```javascript
function detectRegion(city, district) {
  const istanbul = normalizeForSearch(city) === 'istanbul';
  if (!istanbul) return 'outside_istanbul';

  const europeanDistricts = [
    'fatih', 'beyoglu', 'sisli', 'besiktas', 'bakirkoy',
    'bayrampasa', 'eyupsultan', 'kagithane', 'sariyer',
    'zeytinburnu', 'gungoren', 'esenler', 'bagcilar',
    'bahcelievler', 'avcilar', 'kucukcekmece', 'buyukcekmece',
    'basaksehir', 'sultangazi', 'arnavutkoy', 'catalca',
    'esenyurt', 'beylikduzu', 'silivri'
  ];

  const normalizedDistrict = normalizeForSearch(district);
  return europeanDistricts.includes(normalizedDistrict)
    ? 'istanbul_europe'
    : 'istanbul_anatolia';
}
```

Region is auto-detected from the site's city/district. Manual override available via dropdown on the request card.

**Filter Bar:**

```
[Bolge: Tumu ▼]  [Durum: Tumu ▼]  [Oncelik: Tumu ▼]     [Arama Sirasi]
```

- Region: All / Istanbul Avrupa / Istanbul Anadolu / Istanbul Disi
- Contact Status: All / Not Contacted / No Answer / Confirmed
- Priority: All / Normal / High / Urgent

**Call Queue Button (Arama Sirasi):**

Opens a focused full-screen mode for batch calling:

```
┌──────────────────────────────────────────────────────────────┐
│  Arama Sirasi — 12 kisi kaldi                                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Acme Ltd - Merkez Sube                                     │
│   Tel: 0555 123 4567  (click to copy)                        │
│   "Alarm paneli hata veriyor"                                │
│                                                               │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │    Cevap  │  │   Mesgul │  │   Onay   │  │   Atla   │   │
│   │    Yok    │  │          │  │          │  │          │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│   Not: _________________________________________________     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

- Shows one request at a time
- Big action buttons: No Answer (increment attempts, next), Busy (same), Confirmed (set status, next), Skip
- Optional note field
- After last item: summary modal

**Request Cards:**

```
┌─────────────────────────────────────────────┐
│ Acme Ltd                            Acil    │
│ Merkez Sube (ACC-12345)                     │
│ Alarm paneli surekli hata veriyor           │
│                                             │
│ Istanbul Avrupa   Servis   2. deneme        │
│ Aranmadi                       [Planla]     │
└─────────────────────────────────────────────┘
```

- Customer name (bold), site name + account no
- Description (1-2 lines, truncated)
- Bottom row: region badge, work type, reschedule count (if > 0)
- Contact status badge (traffic light color)
- "Planla" button (only visible when contact_status = confirmed)

**Inline Scheduling (when "Planla" is clicked):**

The card expands to show a scheduling row directly below it:

```
┌─────────────────────────────────────────────┐
│ Acme Ltd                            Acil    │
│ ...                                         │
│ Onaylandi                          [Planla] │
├─────────────────────────────────────────────┤
│ Tarih: [2026-03-25]  Saat: [09:00]         │
│ Tip:   [Servis ▼]                           │
│              [Iptal]  [Is Emri Olustur ↵]   │
└─────────────────────────────────────────────┘
```

- Date picker (required)
- Time picker (optional, default 09:00)
- Work type dropdown (pre-filled from request)
- "Is Emri Olustur" calls `fn_convert_request_to_work_order`
- On success: card slides out of pool, toast shows WO form number

### 4.4 Tab 2: Calendar (Takvim)

Read-only schedule overview of work orders created from the Operations Board (and any other WOs).

**Reuses existing calendar infrastructure** (`react-big-calendar`) but simplified:
- No drag-and-drop (scheduling happens in Tab 1)
- No task/plan events (tasks module deprecated)
- Work orders only, color-coded by status:
  - Blue = Scheduled
  - Yellow = In Progress
  - Green = Completed
  - Red = Failed/Cancelled
- Click event -> navigate to WO detail page
- Week view (default) + Month view toggle

This is essentially the current `/calendar` page stripped of task display and drag-to-schedule, making it lighter and focused.

### 4.5 Tab 3: Insights (Ozet)

Dashboard cards powered by `fn_get_operations_stats`:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 12       │  │ 8        │  │ 87%      │  │ 3        │      │
│  │ Havuzda  │  │ Planlandi│  │ Basari   │  │ Basarisiz│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  Bolge Dagilimi              Iletisim Durumu                   │
│  ┌─────────────────┐         ┌─────────────────┐              │
│  │ Ist. Avrupa: 5  │         │ Aranmadi:    4  │              │
│  │ Ist. Anadolu: 4 │         │ Cevap Yok:  3  │              │
│  │ Dis Istanbul: 3 │         │ Onaylandi:  5  │              │
│  └─────────────────┘         └─────────────────┘              │
│                                                                 │
│  Donem: [Bu Ay ▼]           Ort. Yeniden Planlama: 0.3        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

- Period filter: This Month, Last Month, This Quarter, Custom
- KPI cards: Pool size, Scheduled count, Success rate %, Failed count
- Regional breakdown
- Contact status breakdown
- Average reschedule count

---

## 5. Feature Module Structure

```
src/features/operations/
  api.js                    -- Supabase queries for service_requests
  hooks.js                  -- React Query hooks
  schema.js                 -- Zod schemas for request creation/scheduling
  index.js                  -- Barrel exports
  OperationsBoardPage.jsx   -- Main page with tab container
  components/
    RequestPoolTab.jsx      -- Tab 1: pool list + quick entry + filters
    QuickEntryRow.jsx       -- Inline customer/site/problem entry
    RequestCard.jsx         -- Individual request card with status badge
    InlineScheduler.jsx     -- Expandable scheduling row within a card
    CallQueueModal.jsx      -- Full-screen batch calling mode
    CalendarTab.jsx         -- Tab 2: read-only calendar (wraps react-big-calendar)
    InsightsTab.jsx         -- Tab 3: stats dashboard
    ContactStatusBadge.jsx  -- Traffic light badge component
    RegionBadge.jsx         -- Region label badge
```

### i18n Namespace: `operations`

File: `src/locales/tr/operations.json`

Key structure:

```json
{
  "title": "Operasyon Merkezi",
  "tabs": {
    "pool": "Talep Havuzu",
    "calendar": "Takvim",
    "insights": "Ozet"
  },
  "quickEntry": {
    "customerPlaceholder": "Musteri ara...",
    "sitePlaceholder": "Lokasyon sec...",
    "descriptionPlaceholder": "Problem aciklamasi...",
    "hint": "Enter ile kaydet"
  },
  "regions": {
    "istanbul_europe": "Istanbul Avrupa",
    "istanbul_anatolia": "Istanbul Anadolu",
    "outside_istanbul": "Istanbul Disi"
  },
  "contactStatus": {
    "not_contacted": "Aranmadi",
    "no_answer": "Cevap Yok",
    "confirmed": "Onaylandi",
    "cancelled": "Iptal"
  },
  "status": {
    "open": "Havuzda",
    "scheduled": "Planlandi",
    "completed": "Tamamlandi",
    "failed": "Basarisiz",
    "cancelled": "Iptal Edildi"
  },
  "actions": {
    "schedule": "Planla",
    "createWorkOrder": "Is Emri Olustur",
    "boomerang": "Yeniden Planla",
    "callQueue": "Arama Sirasi"
  },
  "callQueue": {
    "title": "Arama Sirasi",
    "remaining": "{{count}} kisi kaldi",
    "noAnswer": "Cevap Yok",
    "busy": "Mesgul",
    "confirmed": "Onaylandi",
    "skip": "Atla",
    "notePlaceholder": "Not ekle...",
    "summary": "{{confirmed}} onaylandi, {{noAnswer}} cevap yok, {{cancelled}} iptal"
  },
  "insights": {
    "inPool": "Havuzda",
    "scheduled": "Planlandi",
    "successRate": "Basari Orani",
    "failed": "Basarisiz",
    "avgReschedules": "Ort. Yeniden Planlama",
    "regionBreakdown": "Bolge Dagilimi",
    "contactBreakdown": "Iletisim Durumu"
  },
  "empty": {
    "title": "Talep havuzu bos",
    "description": "Yeni bir musteri talebi eklemek icin yukardaki hizli giris satirini kullanin."
  },
  "scheduler": {
    "date": "Tarih",
    "time": "Saat",
    "workType": "Is Tipi",
    "create": "Is Emri Olustur"
  },
  "failure": {
    "title": "Basarisiz Is Emri",
    "reason": "Basarisizlik Nedeni",
    "reasons": {
      "customer_absent": "Musteri yerinde degil",
      "parts_needed": "Parca gerekli",
      "access_denied": "Erisim engellendi",
      "incomplete_work": "Is tamamlanamadi",
      "other": "Diger"
    },
    "rescheduleCount": "{{count}}. deneme"
  }
}
```

---

## 6. Deconstruction & Cleanup

### Routes to Deprecate

| Current Route | Current Component | Action | Timing |
|---|---|---|---|
| `/tasks` | `TasksPage` | **Deprecate** — remove route, nav item. Data stays in DB. | Phase E |
| `/calendar` | `CalendarPage` | **Absorb** — functionality moves to Operations Board Tab 2. Remove standalone route. | Phase E |
| `/daily-work` | `DailyWorkListPage` | **Keep but relocate** — becomes field worker view. Remove from main Planning nav group. Accessible via direct URL only or mobile bottom bar. | Phase E |

### Files to Remove (Phase E)

```
REMOVE from navigation:
  src/components/layout/navItems.js
    - Remove /calendar entry from "Planlama" group
    - Remove /tasks entry from "Planlama" group
    - Move /daily-work to conditional (field_worker role only)
    - Add /operations to "Operasyon" group

REMOVE routes:
  src/App.jsx
    - Remove: <Route path="tasks" ...>
    - Remove: <Route path="calendar" ...>
    - Add: <Route path="operations" ...>

DO NOT DELETE yet (Phase E cleanup):
  src/features/tasks/          -- Keep files, just unroute
  src/features/calendar/       -- Keep files, reuse components in Operations Board
  src/features/workOrders/DailyWorkListPage.jsx  -- Keep, restrict access
```

### What Gets Reused

| Existing Code | Reused In | How |
|---|---|---|
| `react-big-calendar` setup | CalendarTab.jsx | Import localizer, event mapping utils from calendar module |
| `CalendarPage` filter logic | CalendarTab.jsx | Simplified version (no tasks, no drag) |
| `DailyWorkCard` component | Not reused | Different data model (WOs vs requests) |
| `QuickPlanInput` pattern | QuickEntryRow.jsx | Same UX pattern, different fields |
| `TaskModal` pattern | Not reused | Replaced by InlineScheduler |
| `normalizeForSearch` | QuickEntryRow customer combobox | Direct reuse |
| `useCustomers` / customer API | QuickEntryRow | Direct reuse for typeahead |
| `useCalendarRealtime` | CalendarTab.jsx | Direct reuse for live updates |

---

## 7. Implementation Phases

### Phase A: Database Schema & Migration

**Scope:** Create the `service_requests` table, view, indexes, RLS, and RPCs.

**Deliverables:**
- [x] Migration file: `supabase/migrations/00160_service_requests.sql` — DONE
  - Table with all columns and constraints
  - View: `service_requests_detail`
  - Indexes (6 indexes)
  - RLS policies (select/insert/update for admin + accountant)
  - Trigger: `update_service_requests_updated_at`
  - RPC: `fn_convert_request_to_work_order` (atomic request-to-WO conversion)
  - RPC: `fn_boomerang_failed_request` (return failed request to pool)
  - RPC: `fn_get_operations_stats` (insights tab aggregations)
- [x] Verified: no conflicts with existing work_order triggers or finance flows
  - WO `form_no` is optional text, no auto-generation — RPC creates WO without it
  - WO links to customer via `site_id` (no `customer_id` column) — matches existing pattern
  - Work types use English values (survey/installation/service/maintenance/other) — matches existing CHECK constraint

**Dependencies:** None. Can start immediately.

### Phase B: Feature Module Foundation

**Scope:** Create the data layer — API functions, React Query hooks, Zod schemas.

**Deliverables:**
- [x] `src/features/operations/api.js` — 10 functions: CRUD, contactStatus, convertToWO, boomerang, stats, cancel
- [x] `src/features/operations/hooks.js` — 9 hooks with cross-module cache invalidation (service_requests + workOrders)
- [x] `src/features/operations/schema.js` — 4 Zod schemas (quickEntry, schedule, contactUpdate, failure) + constants
- [x] `src/features/operations/index.js` — Barrel exports
- [x] `src/locales/tr/operations.json` — 100+ translation keys (all sections)
- [x] Registered `operations` namespace in `src/lib/i18n.js`

**Dependencies:** Phase A (tables must exist).

### Phase C: Frontend Core — Board Container & Tabs

**Scope:** Create the Operations Board page shell with tab navigation.

**Deliverables:**
- [x] `src/features/operations/OperationsBoardPage.jsx` — Page with 3 tabs
- [x] Route: `/operations` in `src/App.jsx` (RoleRoute wrapped)
- [x] Nav item: "Operasyon Merkezi" in navItems.js (top-level + Operasyon group)
- [x] Breadcrumb config update
- [x] Tab switching with URL state (`?tab=pool`, `?tab=calendar`, `?tab=insights`)

**Dependencies:** Phase B (hooks needed for data fetching).

### Phase D: Tab Components

**Scope:** Build out each tab's content.

**Sub-phases (can be sequential within D):**

**D1: Request Pool Tab**
- [x] `RequestPoolTab.jsx` — List container with filters
- [x] `QuickEntryRow.jsx` — Customer combobox + site + description + Enter + auto-region detection
- [x] `RequestCard.jsx` — Card with contact badge, region, priority, phone, context menu
- [x] `ContactStatusBadge.jsx` — Traffic light component
- [x] `RegionBadge.jsx` — Region label

**D2: Inline Scheduler**
- [x] `InlineScheduler.jsx` — Expandable date/time/type picker within card
- [x] Wire to `fn_convert_request_to_work_order` RPC
- [x] Toast on successful conversion

**D3: Call Queue**
- [x] `CallQueueModal.jsx` — Full-screen batch calling mode
- [x] Contact status update API integration
- [x] Summary modal on completion

**D4: Calendar Tab**
- [x] `CalendarTab.jsx` — Simplified calendar (reuse react-big-calendar setup)
- [x] Work orders only, color-coded by status
- [x] Week/month toggle

**D5: Insights Tab**
- [x] `InsightsTab.jsx` — Stats dashboard with KPI cards
- [x] Wire to `fn_get_operations_stats` RPC
- [x] Period filter (this month, last month, this quarter)

**Dependencies:** Phase C (board shell must exist).

### Phase E: Cleanup & Migration

**Scope:** Remove deprecated routes, update navigation, restrict daily-work.

**Deliverables:**
- [x] Remove `/tasks` route from App.jsx
- [x] Remove `/calendar` route from App.jsx
- [x] Remove both from navItems.js (Planlama group now has only Work History)
- [x] `/operations` promoted to top-level nav (replaced `/daily-work` slot) with Target icon
- [x] `/daily-work` removed from nav but route kept accessible by URL for field workers
- [x] Breadcrumb entries for tasks/calendar removed

**Dependencies:** Phase D complete and verified.

> **Note:** `src/features/tasks/` and `src/features/calendar/` directories are NOT deleted — calendar components are reused by CalendarTab, task data stays in DB for historical reference.

**Important:** Do NOT delete `src/features/tasks/` or `src/features/calendar/` directories. Just unroute them. Calendar components are reused. Task data stays in DB for historical reference.

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| `fn_convert_request_to_work_order` conflicts with existing WO form_no generation | High | Check current form_no logic in existing migrations before writing RPC |
| Calendar tab performance with many WOs | Low | Already solved — existing calendar uses date-range queries |
| Quick Entry customer search too slow | Medium | Already solved — `normalizeForSearch` + existing customer combobox pattern |
| Field workers confused by missing /daily-work in nav | Medium | Keep route accessible, just remove from main nav. Add redirect or mobile-specific nav. |
| Data migration for existing tasks | Low | Tasks stay in DB. No data migration needed. Users can view old tasks by direct URL until Phase E cleanup. |
| Service request table grows without cleanup | Low | Soft delete + `deleted_at` filtering. Add periodic archive job post-launch. |

---

## 9. Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Request entry speed | < 8 seconds from phone pickup | Manual timing test |
| Call queue processing | 20+ requests in 10 minutes | Batch calling speed test |
| Request-to-WO conversion | Same day for confirmed requests | Query: avg(scheduled_date - created_at) |
| Rescheduling visibility | Zero "lost" failed jobs | Query: count where status='failed' AND reschedule_count=0 |
| Navigation simplification | 3 items to 1 | Visual check |

---

## 10. Decision Log

| Date | Decision | Context |
|---|---|---|
| 2026-03-19 | Separate `service_requests` table, not WO status flag | Keep work_orders clean for execution only. Requests are lightweight phone notes. |
| 2026-03-19 | Tabbed layout, not split-panel | Single team doesn't need simultaneous pool + calendar view. Full-width tabs are cleaner. |
| 2026-03-19 | Inline scheduling, not drag-to-calendar | For 1 team, a date picker is faster than visual drag. Calendar becomes read-only overview. |
| 2026-03-19 | Auto-region detection from site city/district | Reduces manual entry. Istanbul districts mapped to European/Anatolian sides. |
| 2026-03-19 | Boomerang pattern for failed jobs | Failed WO auto-returns request to pool with history preserved. No manual re-entry. |
| 2026-03-19 | Call Queue as batch processing mode | Excel-speed for the morning calling routine. One request at a time, big buttons. |
| 2026-03-19 | Keep /daily-work for field workers | Mobile-first WO view for technicians. Operations Board is for office dispatchers. |
| 2026-03-19 | Deprecate /tasks, absorb /calendar | Tasks module is a generic todo list that doesn't fit the customer-centric pipeline. Calendar functionality moves into Operations Board Tab 2. |
