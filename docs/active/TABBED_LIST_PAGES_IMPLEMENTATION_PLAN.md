# Tabbed List Pages — Implementation Plan
> Work Orders & Proposals: Server-Side Active/Archive Filtering
>
> Status: PLANNING — DO NOT IMPLEMENT OUT OF ORDER
> Last updated: 2026-04-06

---

## Overview

Replace the current status-dropdown filter model (Work Orders) and four-tab model (Proposals) with a unified **Active / Archive** tab system backed by server-side filtering. The active tab is the default; the archive tab is opt-in. This prevents fetching thousands of terminal records on initial page load.

### Guiding Constraints
- Work Orders use **server-side pagination** — all filtering and sorting must happen in Postgres, not in JavaScript.
- Proposals fetch all records at once (limit 200) — client-side sort remains acceptable; server-side filter is an optimization.
- No hardcoded Turkish strings anywhere — all labels go through i18n.
- Mobile-first: tab bar must be horizontally scrollable on small screens.
- No new npm packages.

---

## Status Group Definitions

| Group | Work Order Statuses | Proposal Statuses |
|---|---|---|
| `active` | `pending`, `scheduled`, `in_progress` | `draft`, `sent`, `accepted` |
| `archive` | `completed`, `cancelled` | `completed`, `rejected`, `cancelled` |

---

## Phase 1 — API Layer Evolution

### 1.1 Work Orders (`src/features/workOrders/api.js`)

**Affected files:** `src/features/workOrders/api.js`

**Constants to add at the top of the file:**

Define two named arrays so the same values are importable by the UI (for badge colouring, labels, etc.) without duplicating the definition:

```
WO_ACTIVE_STATUSES  = ['pending', 'scheduled', 'in_progress']
WO_ARCHIVE_STATUSES = ['completed', 'cancelled']
```

**Logic changes in `fetchWorkOrdersPaginated`:**

The function already accepts a `filters` object. Add handling for a new `statusGroup` key:

- If `filters.statusGroup === 'active'`  → apply `.in('status', WO_ACTIVE_STATUSES)`
- If `filters.statusGroup === 'archive'` → apply `.in('status', WO_ARCHIVE_STATUSES)`
- If `filters.statusGroup` is absent/`'all'` → no status filter (existing behaviour, used by calendar/sub-lists)

The existing `filters.status` single-value filter (`eq`) must remain intact for backward compatibility with calendar and other callers that pass a specific status directly. `statusGroup` and `status` are mutually exclusive; `statusGroup` takes precedence.

**Sort order change in `fetchWorkOrdersPaginated` only (not `fetchWorkOrders`):**

When `statusGroup === 'active'`, inject a `status_rank` sort as the first ORDER BY:
```
in_progress → pending → scheduled
```

Because PostgREST does not accept `CASE WHEN` in `.order()`, this requires a computed column on the `work_orders_detail` view (see Phase 1.3). Add `.order('status_rank', { ascending: true })` before `.order('scheduled_date', ...)`.

When `statusGroup === 'archive'`, keep the existing `scheduled_date DESC, created_at DESC` order (most recently completed first is natural for archive browsing).

**`fetchWorkOrders` (non-paginated):** No change to signature. Calendar, site detail, and customer detail pages call this — leave their sort/filter unchanged.

**Logic changes in `fetchProposals`:**

Define:
```
PROPOSAL_ACTIVE_STATUSES  = ['draft', 'sent', 'accepted']
PROPOSAL_ARCHIVE_STATUSES = ['completed', 'rejected', 'cancelled']
```

Add `statusGroup` handling identically to the work orders pattern. The existing `status` comma-list filter (`status.includes(',')` → `.in()`) stays for backward compatibility.

### 1.2 Definition of Done — Phase 1 (API)

- [ ] `WO_ACTIVE_STATUSES` and `WO_ARCHIVE_STATUSES` exported from `workOrders/api.js`
- [ ] `PROPOSAL_ACTIVE_STATUSES` and `PROPOSAL_ARCHIVE_STATUSES` exported from `proposals/api.js`
- [ ] `fetchWorkOrdersPaginated` filters correctly for all three `statusGroup` values
- [ ] `fetchWorkOrders` (non-paginated) is **not changed** — zero regression risk on calendar/sites
- [ ] `fetchProposals` filters correctly for all three `statusGroup` values
- [ ] Existing callers that do not pass `statusGroup` behave identically to today

### 1.3 Database Migration — `status_rank` Column

**Affected file:** new migration file under `supabase/migrations/`

Add a computed column to the `work_orders_detail` view:

```sql
CASE status
  WHEN 'in_progress' THEN 0
  WHEN 'pending'     THEN 1
  WHEN 'scheduled'   THEN 2
  WHEN 'completed'   THEN 3
  WHEN 'cancelled'   THEN 4
  ELSE 5
END AS status_rank
```

This is a view column only — no schema change to the underlying `work_orders` table. The migration must `CREATE OR REPLACE VIEW work_orders_detail` with the new column appended. No data migration required.

**Definition of Done — Migration:**
- [ ] `work_orders_detail` view includes `status_rank` integer column
- [ ] `status_rank` sorts correctly: `in_progress (0) < pending (1) < scheduled (2) < completed (3) < cancelled (4)`
- [ ] Existing columns and RLS behaviour are unchanged
- [ ] Migration runs cleanly on a fresh DB

---

## Phase 2 — Hook Optimization

### 2.1 Work Orders (`src/features/workOrders/hooks.js`)

**Affected files:** `src/features/workOrders/hooks.js`

`useWorkOrdersPaginated` currently builds its query key from `(filters, page)`. The `filters` object will now carry `statusGroup`. Because the filters object is spread into the query key, this change is **automatic** — no structural change to `workOrderKeys` is needed.

Verify: the `keepPreviousData` option is already present on `useWorkOrdersPaginated`. This is what enables the "stale overlay" UX during tab transition (see Phase 5). No change needed if it is already set.

If it is missing, add `placeholderData: keepPreviousData` to prevent the table from flashing an empty state between tab clicks.

### 2.2 Proposals (`src/features/proposals/hooks.js`)

**Affected files:** `src/features/proposals/hooks.js`

`useProposals` passes `filters` directly into `proposalKeys.list(filters)`. Adding `statusGroup` to the filters object passed from the page component automatically generates a distinct cache key per group. No structural change needed.

The `useProposals({})` call (the "all proposals" shadow query used for tab counts) in `ProposalsListPage` must be **removed** after Phase 4 (see Phase 4 note).

### 2.3 Definition of Done — Phase 2

- [ ] Switching tabs causes a new fetch (different cache key), not a cache hit from the other tab
- [ ] Switching back to a previously visited tab uses the cached result (React Query `staleTime` behaviour)
- [ ] `keepPreviousData` is active on the Work Orders paginated hook — no empty flash on tab switch
- [ ] The shadow `useProposals({})` call for tab counts is identified and flagged for removal in Phase 4

---

## Phase 3 — UI Architecture: Work Orders Tab Bar

### 3.1 Tab Definitions

Define `WO_TAB_DEFINITIONS` as a constant in `WorkOrdersListPage.jsx`:

```
[
  { key: 'active',   labelKey: 'workOrders:list.tabs.active',   statusGroup: 'active'   },
  { key: 'archive',  labelKey: 'workOrders:list.tabs.archive',  statusGroup: 'archive'  },
]
```

Default tab on first visit: `active`.

The tab key is persisted in the URL as `?tab=active` (mirrors the Proposals pattern already in place). This means a direct link to the archive tab is shareable.

### 3.2 Removing the Status Dropdown

The existing desktop filter card contains a `ListboxSelect` for status. When `tab !== 'all'`, the status dropdown must be **hidden** — it is now redundant and would produce confusing empty results if a user selected `completed` while on the active tab.

Decision: **remove the status dropdown entirely** from the list page. Users who need a specific status can use the Archive tab (which shows all terminal statuses). The "open" vs "closed" distinction now lives at the tab level, not the filter level.

The `statusOptions` array and the `status` URL param handling in `handleFilterChange` can be deleted.

### 3.3 Filter State Changes

URL params after this change:

| Param | Before | After |
|---|---|---|
| `status` | single status string | **removed** |
| `tab` | not present | `'active'` (default, omitted from URL) or `'archive'` |
| `work_type` | unchanged | unchanged |
| `year` | unchanged | unchanged |
| `month` | unchanged | unchanged |
| `page` | unchanged | unchanged — reset to 0 on tab change |

`page` must reset to `0` when the tab changes. Add `next.delete('page')` inside `handleTabChange`.

### 3.4 KPI Strip Update

The existing KPI strip has four cards. Two are already showing placeholder (`—`) values. After this change:

- **"Eşleşen" (matched):** keep — shows `totalCount` from the active query
- **"Açık" (open):** rename to the count from the active tab's `totalCount` when `tab === 'active'`
- **"Bekleyen Montaj" (pending install):** can be driven by a `statusGroup: 'active', work_type: 'installation'` count — defer to a future phase, keep placeholder for now
- **"Tamamlanan" (completed):** driven by archive `totalCount` — only meaningful when `tab === 'archive'`; keep placeholder on active tab

For Phase 3, the simplest correct behaviour: KPI cards reflect the currently displayed tab's `totalCount`. Filling all four with live data is explicitly deferred to a future phase.

### 3.5 Tab Bar Component Markup

Reuse the exact tab bar pattern already implemented in `ProposalsListPage.jsx` (lines 246–278). It is responsive, uses `overflow-x-auto scrollbar-hide`, renders pill tabs on desktop and underline tabs on mobile. Copy the structure; swap the tab definitions.

Do not extract a shared `<TabBar>` component — the two pages have slightly different layout contexts and the duplication is minimal. Apply YAGNI.

### 3.6 Definition of Done — Phase 3

- [ ] Tab bar renders above the filter card: "Aktif" | "Arşiv"
- [ ] Default tab is `active`; URL is clean (no `?tab=` param) on default
- [ ] Switching to Archive fetches `completed` + `cancelled` records server-side
- [ ] Status dropdown filter removed from desktop filter card and mobile filter modal
- [ ] `page` resets to `0` on every tab change
- [ ] `keepPreviousData` prevents empty flash during tab-switch fetch
- [ ] Mobile tab bar is scrollable; no horizontal overflow on 375px viewport
- [ ] Active tab count badge shows current `totalCount`

---

## Phase 4 — UI Refactoring: Proposals

### 4.1 Current State

`ProposalsListPage.jsx` has four tabs defined in `TAB_DEFINITIONS`:
```
all | drafts | sent | archive
```

The "archive" tab already groups `['rejected', 'cancelled', 'completed']`. The "sent" tab groups `['sent', 'accepted']`. This is close to the target model but has two problems:

1. The `all` tab fetches everything — the performance anti-pattern we are eliminating.
2. There is a shadow `useProposals({})` call on line 88 solely to compute per-tab counts. This fires an uncached `limit 200` fetch on every page render.

### 4.2 New Tab Definitions

Replace `TAB_DEFINITIONS` with:

```
[
  { key: 'active',  labelKey: 'proposals:list.tabs.active',  statusGroup: 'active'  },
  { key: 'archive', labelKey: 'proposals:list.tabs.archive', statusGroup: 'archive' },
]
```

The `drafts` and `sent` sub-tabs are removed. Users who need to filter by draft-only can use the existing search, or a work type filter if added later. The Active tab covers `draft + sent + accepted` — all proposals that need attention.

### 4.3 Tab Count Strategy

The shadow `useProposals({})` query must be **removed**. Replace with:

- The count badge on the active tab: use the `data.length` of the current active-tab response (since proposals are not paginated, `data.length` equals the real count for that group).
- The count badge on the archive tab: only shown when the archive tab is active.
- Do not show both counts simultaneously — this avoids the shadow query entirely.

If simultaneous counts are required in the future, the correct approach is a lightweight `COUNT` RPC rather than fetching all rows twice.

### 4.4 Sort Order Within Tabs

Since proposals are not paginated, apply a frontend `useMemo` sort **within** the active tab:

```
draft (0) → sent (1) → accepted (2)
```

Secondary sort: `created_at DESC` within each rank.

Archive tab: `created_at DESC` only (most recently closed first).

This sort lives in `ProposalsListPage.jsx` as a `useMemo` derived from `proposals` — no changes to `api.js` sort order needed for proposals.

### 4.5 URL Param Alignment

Proposals already use `?tab=` in the URL. After this change:

| Param | Before | After |
|---|---|---|
| `tab` | `all/drafts/sent/archive` | `active` (omitted) / `archive` |
| `status` (legacy) | comma-list for tab mapping | **removed** |
| `year` | unchanged | unchanged |
| `month` | unchanged | unchanged |

Remove the `prev.delete('status')` cleanup line in `handleTabChange` — the `status` param no longer exists.

### 4.6 Definition of Done — Phase 4

- [ ] Two tabs only: "Aktif" | "Arşiv"
- [ ] Shadow `useProposals({})` call removed — no double-fetch on page load
- [ ] Active tab shows `draft + sent + accepted`, sorted by rank then `created_at DESC`
- [ ] Archive tab shows `completed + rejected + cancelled`, sorted by `created_at DESC`
- [ ] Old `TAB_DEFINITIONS` array and `status` URL param handling deleted
- [ ] No regression on existing `year` / `month` filters
- [ ] Mobile tab bar identical in structure to Work Orders tab bar

---

## Phase 5 — i18n & Final Polish

### 5.1 Required Translation Keys

All new keys go into existing namespace files. No new namespace files needed.

**`src/locales/tr/workOrders.json`**

```json
"list": {
  "tabs": {
    "active":  "Aktif",
    "archive": "Arşiv"
  }
}
```

**`src/locales/tr/proposals.json`**

```json
"list": {
  "tabs": {
    "active":  "Aktif",
    "archive": "Arşiv"
  }
}
```

**`src/locales/tr/common.json`** (only if shared tab labels are desired — otherwise use per-namespace keys above)

No keys needed in `common.json` unless a shared `<TabBar>` component is created (which Phase 3.5 explicitly defers).

### 5.2 Loading State Behaviour During Tab Transitions

| State | Work Orders | Proposals |
|---|---|---|
| First load (cold cache) | `TableSkeleton` via `isLoading` | Existing `ListSkeleton` via `isLoading` |
| Tab switch (warm cache exists for new tab) | Instant — React Query serves cache | Instant |
| Tab switch (no cache for new tab) | Table dims via `isFetching` opacity overlay (`keepPreviousData` holds previous tab's rows visible) | `ListSkeleton` shown (`isLoading: true` because no prior data) |
| Search/filter change within tab | Table dims (same `isFetching` pattern) | Skeleton re-shown |

The existing `isFetching && !isLoading ? 'opacity-70' : ''` className on the Work Orders table wrapper (line 498) already implements the dim-overlay pattern. No new loading component is needed.

For Proposals, `keepPreviousData` is not currently set. Add `placeholderData: keepPreviousData` to `useProposals` in `hooks.js` to enable the same dim-overlay pattern. Then wrap the Proposals table in an `opacity-70` container when `isFetching && !isLoading`.

### 5.3 Empty State Copy

Each tab needs its own empty state message since "no active proposals" is different from "no archived proposals".

**Work Orders empty states:**

| Tab | Title key | Description key |
|---|---|---|
| `active` | `workOrders:list.empty.activeTitle` | `workOrders:list.empty.activeDescription` |
| `archive` | `workOrders:list.empty.archiveTitle` | `workOrders:list.empty.archiveDescription` |

**Proposals empty states:**

| Tab | Title key | Description key |
|---|---|---|
| `active` | `proposals:list.empty.activeTitle` | `proposals:list.empty.activeDescription` |
| `archive` | `proposals:list.empty.archiveTitle` | `proposals:list.empty.archiveDescription` |

Suggested Turkish copy:

| Key | Value |
|---|---|
| `workOrders:list.empty.activeTitle` | `Aktif iş emri yok` |
| `workOrders:list.empty.activeDescription` | `Bekleyen, planlanan veya devam eden iş emri bulunmuyor.` |
| `workOrders:list.empty.archiveTitle` | `Arşiv boş` |
| `workOrders:list.empty.archiveDescription` | `Tamamlanan veya iptal edilen iş emri bulunamadı.` |
| `proposals:list.empty.activeTitle` | `Aktif teklif yok` |
| `proposals:list.empty.activeDescription` | `Taslak, gönderilmiş veya kabul edilmiş teklif bulunmuyor.` |
| `proposals:list.empty.archiveTitle` | `Arşiv boş` |
| `proposals:list.empty.archiveDescription` | `Tamamlanan, reddedilen veya iptal edilen teklif bulunamadı.` |

### 5.4 Definition of Done — Phase 5

- [ ] All new tab labels use i18n keys — zero hardcoded Turkish strings
- [ ] All four empty state title/description keys exist in their respective locale files
- [ ] `keepPreviousData` added to `useProposals` hook
- [ ] Proposals table wrapped with `isFetching` dim-overlay (matches Work Orders pattern)
- [ ] No console warnings about missing i18n keys

---

## Implementation Order

```
Phase 1.3 (DB migration) → Phase 1 (API) → Phase 2 (Hooks) → Phase 3 (WO UI) → Phase 4 (Proposals UI) → Phase 5 (i18n polish)
```

The migration must land before the API change because the API will call `.order('status_rank')` — which requires the column to exist in the view. All other phases are independent once Phase 1 is complete.

---

## Out of Scope (Explicitly Deferred)

- Live counts on both tabs simultaneously (requires a `COUNT` RPC — separate task)
- KPI strip live data beyond `totalCount` (separate task)
- "Pending Installation" KPI driven by `work_type + statusGroup` compound query
- Shared `<TabBar>` UI component extraction
- Paraşüt / invoice integration
- Any other module beyond Work Orders and Proposals
