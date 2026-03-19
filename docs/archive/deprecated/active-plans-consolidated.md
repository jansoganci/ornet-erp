# Ornet ERP — Active Plans (Consolidated)

> **Purpose:** Single reference for current features in development.  
> **Source:** plan-customer-situation.md + equipment-lifecycle-plan.md + subscriptions-price-revision-analysis.md  
> **Last updated:** 2026-03-09

---

# Part 1 — Customer Situation Board

> Status: APPROVED — Ready to implement.  
> Last updated: 2026-02-24

---

## Overview

A smart board that shows the current health of every customer in one place.
Default view shows only problematic customers. Toggle to see all.
Each customer has a live health status + a historical notes log.

---

## Health Status Rules

| Status | Condition |
|--------|-----------|
| Critical | Payment overdue 30+ days OR open work order older than 7 days |
| Warning | Payment overdue 15–30 days OR open work order 4–7 days old |
| Healthy | Everything within limits |

Default view = Critical + Warning only. Toggle button to show all customers.

Health edge cases — explicit rules for the view:
- Customer with no subscription → payment axis treated as 0 overdue days (healthy baseline)
- Customer with no open work orders → WO axis treated as 0 days (healthy baseline)
- Customer with no subscription AND no work orders (new customer, zero activity) → always `healthy`
- Both axes use `COALESCE(value, 0)` so nulls never accidentally trigger warning or critical

---

## Board Columns

| Column | Source |
|--------|--------|
| Customer name | `customers` |
| Subscription status | `subscriptions` (active / overdue / none) |
| Last payment date | `subscription_payments` |
| Last service date | `work_orders` (latest completed servis/bakım) |
| Open work orders | `work_orders` (count of open WOs) |
| Health badge | Computed in view |
| Latest note preview | `customer_notes` (most recent note, truncated) |
| Actions | — |

Subscription status aggregation rule: a customer may have multiple subscriptions. The board shows the **worst status** across all non-cancelled subscriptions. If any subscription is overdue, the customer's subscription status shows overdue. The `customer_situation` view derives this by taking `MAX(days since last payment)` across all active/overdue subscriptions per customer.

---

## Quick Actions (per row)

- **Create Work Order** → navigates to new WO form pre-filled with customer
- **Record Payment** → opens payment modal (existing subscription payment flow)
- **Add Note** → opens side panel focused on note input
- **Paraşüt** → placeholder button, no action yet

---

## Notes System

- Historical, never overwritten — each note is a separate record
- Timestamped + author name shown (profile name)
- Only `admin` role can write notes (any authenticated user can read)
- Click any customer row → side panel opens showing:
  - Full note history (newest first)
  - Input field to add a new note
- Latest note preview shown inline on the board (first 60 chars)

Row interaction contract:
- Clicking anywhere on a customer row opens the notes side panel
- Clicking the **actions cell** (last column, containing `SituationActionsMenu`) does **not** open the notes panel — the actions cell stops click propagation via `stopPropagation`
- These two interactions must not conflict

Note permanence: notes cannot be deleted by any role. This is intentional, not an omission. No DELETE policy exists on `customer_notes`.

---

## Database (Customer Situation)

### New table: `customer_notes`

```sql
create table customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  content     text not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
```

RLS policies:
- `SELECT`: any authenticated user
- `INSERT`: `WITH CHECK (created_by = auth.uid() AND get_my_role() = 'admin')` — client sends `created_by`, RLS enforces it matches the session user and that the user is admin
- `DELETE`: no policy (intentionally permanent — notes are never deleted)

Index: `(customer_id, created_at DESC)` for fast note history lookups ordered newest first

---

### New view: `customer_situation`

Aggregates per customer:
- Worst payment situation across all non-cancelled subscriptions: `MAX(days since last payment)` per customer; null (no subscription) treated as 0
- Latest completed work order date (servis or bakım type)
- Count of open work orders + age of oldest open WO; null (no open WOs) treated as 0
- Computed `health` field using `COALESCE` on both axes:
  - `'critical'` → `COALESCE(max_payment_overdue_days, 0) > 30` OR `COALESCE(oldest_open_wo_days, 0) > 7`
  - `'warning'` → `COALESCE(max_payment_overdue_days, 0) > 15` OR `COALESCE(oldest_open_wo_days, 0) > 4`
  - `'healthy'` → everything else, including customers with no subscription and no work orders
- Latest note content + date

Composite indexes included in the migration (required for view query performance):

```sql
-- Open WO age and count per customer (respects soft-delete)
CREATE INDEX idx_wo_customer_status_created
  ON work_orders(customer_id, status, created_at)
  WHERE deleted_at IS NULL;

-- Latest completed service/maintenance per customer (respects soft-delete)
CREATE INDEX idx_wo_customer_type_status_date
  ON work_orders(customer_id, type, status, scheduled_date)
  WHERE deleted_at IS NULL;

-- Last payment lookup per subscription
CREATE INDEX idx_subpay_subscription_status_date
  ON subscription_payments(subscription_id, status, period_year, period_month);

-- Notes panel and latest note preview (ORDER BY created_at DESC)
CREATE INDEX idx_customer_notes_customer_created
  ON customer_notes(customer_id, created_at DESC);
```

---

## File Structure (Customer Situation)

```
src/features/customerSituation/
├── api.js                          # fetchCustomerSituations, addCustomerNote, fetchCustomerNotes
├── hooks.js                        # useCustomerSituations, useAddCustomerNote, useCustomerNotes
├── schema.js                       # Zod schema for note form
├── index.js                        # Barrel exports
├── CustomerSituationPage.jsx       # Main board page
└── components/
    ├── SituationHealthBadge.jsx    # Critical / Warning / Healthy badge
    ├── CustomerNotesPanel.jsx      # Slide-over panel with note history + input
    └── SituationActionsMenu.jsx    # Quick actions dropdown per row
```

API notes:
- `fetchCustomerSituations(filters = {})` accepts an optional `healthFilter` array. When the "problematic only" toggle is active, called with `{ healthFilter: ['critical', 'warning'] }` — filter applied server-side via `.in('health', filters.healthFilter)`. When the "show all" toggle is active, called with no filter.
- `addCustomerNote({ customer_id, content, created_by })` — `created_by` is the current user's ID taken from the auth session in the client. RLS enforces `created_by = auth.uid()` server-side, consistent with `work_orders` and `tasks` patterns.

---

## Translations (Customer Situation)

New file: `src/locales/tr/customerSituation.json`

Keys needed:
- Page title, column headers
- Health status labels (kritik, uyarı, sağlıklı)
- Notes panel (geçmiş notlar, not ekle, kaydet)
- Empty states (no problems found, no notes yet)
- Action labels

---

## Routes & Navigation (Customer Situation)

- Route: `/customer-situation`
- Nav group: **Management** (new group) or add to existing top-level
- Nav label: "Müşteri Durumu" with icon `LayoutDashboard` or `Activity`

---

## Migration (Customer Situation)

- File: `supabase/migrations/00096_customer_situation.sql`
- Creates: `customer_notes` table + RLS policies + 4 composite indexes
- Creates: `customer_situation` view

---

## Implementation Order (Customer Situation)

1. Migration (table + view + indexes + RLS)
2. `api.js` — fetch situation list, fetch notes, add note
3. `hooks.js` — React Query hooks
4. `schema.js` — note form validation
5. Translations — stub all keys in `customerSituation.json` before writing any JSX
6. `CustomerSituationPage.jsx` — main board (table, toggle, health badges)
7. `CustomerNotesPanel.jsx` — slide-over with note history
8. `SituationActionsMenu.jsx` — quick actions
9. Wire route + nav

---

## Out of Scope (Customer Situation)

- Paraşüt integration (placeholder only)
- Email/push notifications when customer turns critical
- Configurable thresholds (hardcoded: 30 days payment, 7 days WO)
- SIM card health (not requested)

---

# Part 2 — Equipment Lifecycle

---

## Key Decisions

- **Equipment registration after work order completion is OPTIONAL.** When a user marks an installation or demount work order as completed, the system may prompt to register equipment. The user can skip (close the modal) without saving; completion is not blocked.
- **`replacement_reason` column** will be added to the `site_assets` table. When an asset is marked removed or replaced, a reason (free text) can be stored.
- **Demount work type** will be added to the frontend: `WORK_TYPES` in the work order schema and Turkish translation "Demontaj" in `common.json`. The database already allows `demount`.
- **[REVISED] `PostCompletionEquipmentModal` is a new component** — it must NOT be built by extending `BulkAssetRegisterModal`. The demount mode (select and remove existing assets) is structurally incompatible with the bulk register form (enter new assets). The shared item-level Zod schema (`bulkItemSchema`, `defaultItem`) is extracted to `siteAssets/schema.js` before building the new modal, so both components import from the same source without duplicating validation logic.
- **[REVISED] Two-step write safety.** The installation and demount completion flows use two atomic batch operations each. If the first step (create or remove assets) succeeds but the second (link to work order) fails, the modal retains the intermediate asset IDs in component state so retrying skips the succeeded step and only re-attempts the failed one.

---

## Feature 1 — Work Order Completion → Equipment Registration

**Description:** When a work order of type **installation** is marked completed, the system prompts: *"Bu montajda hangi ekipmanlar kuruldu? Kaydetmek ister misiniz?"* The user can add equipment rows (type, brand, model, serial, qty, ownership). On save, `site_assets` records are created with `installed_by_work_order_id` set, and a batch `work_order_assets` link is created with action `installed`. When a work order of type **demount** is completed, the system prompts: *"Hangi ekipmanlar söküldü?"* The user selects existing active assets at that site from a checkable list. On save, all selected assets are batch-updated to `status = 'removed'` with `removed_by_work_order_id` and `replacement_reason` set, and a batch `work_order_assets` link is created with action `removed`. This flow is implemented on the Work Order detail page; the equipment modal opens after the status confirmation modal closes (post-completion).

### Pre-step: Extract shared schema

Before building the modal, move the item-level Zod schema out of `BulkAssetRegisterModal.jsx` and into `siteAssets/schema.js` so `PostCompletionEquipmentModal` can import it without duplicating validation logic.

- Extract `bulkItemSchema` and `defaultItem` from `BulkAssetRegisterModal.jsx` as named exports in `siteAssets/schema.js`
- Update `BulkAssetRegisterModal.jsx` to import both from `../schema`

### API additions

Two new batch functions must be added to `siteAssets/api.js` before the modal is built:

- **`bulkLinkAssetsToWorkOrder(workOrderId, assetIds, action)`** — single `insert` of N records into `work_order_assets`. Replaces N individual `linkAssetToWorkOrder` calls. One network call, atomic at the DB level.
- **`bulkRemoveAssets(assetIds, { removed_at, removed_by_work_order_id, replacement_reason })`** — single `update ... where id in (assetIds)` on `site_assets`. Replaces N individual `removeAsset` calls. One network call, atomic at the DB level.

Add corresponding hooks `useBulkLinkAssetsToWorkOrder` and `useBulkRemoveAssets` in `siteAssets/hooks.js`.

### Modal submit — two-step retry safety

The modal's submit handler uses a `createdAssetIds` state variable (`useState([])`) to track whether step 1 succeeded and prevent duplicate asset creation if the user retries after a partial failure.

**Installation mode submit logic:**
1. If `createdAssetIds.length === 0`, call `bulkCreateAssets(flattenedItems)` and store the returned IDs in `createdAssetIds` state.
2. Call `bulkLinkAssetsToWorkOrder(workOrderId, createdAssetIds, 'installed')`.
3. On full success: clear `createdAssetIds` and close the modal.
4. On failure at step 2: the modal stays open. `createdAssetIds` retains the IDs from step 1. A retry skips step 1 entirely and re-attempts only step 2, preventing duplicate assets.

**Demount mode submit logic:**
1. Call `bulkRemoveAssets(selectedAssetIds, { removed_by_work_order_id, replacement_reason })`.
2. Call `bulkLinkAssetsToWorkOrder(workOrderId, selectedAssetIds, 'removed')`.
3. On full success: close the modal.
4. `bulkRemoveAssets` is a single atomic UPDATE — if it fails, nothing was written and a clean retry is safe. If step 2 fails after step 1 succeeds, the modal stays open for retry.

`createdAssetIds` is reset to `[]` in the modal's `useEffect` that fires when `open` changes, so reopening the modal always starts clean.

### WorkOrderDetailPage integration

The trigger for the post-completion equipment modal lives in `WorkOrderDetailPage.jsx`'s `handleStatusUpdate` function.

**Add one state variable** alongside the existing ones at the top of the component:

```
showEquipmentModal  (useState — boolean, initial false)
```

**Modify the `updateStatusMutation.mutate` `onSuccess` callback** to conditionally open the equipment modal when the completed status is confirmed on an installation or demount work order:

```
onSuccess: () => {
  setStatusToUpdate(null);
  if (
    statusToUpdate === 'completed' &&
    (workOrder.work_type === 'installation' || workOrder.work_type === 'demount')
  ) {
    setShowEquipmentModal(true);
  }
}
```

Mount `<PostCompletionEquipmentModal>` at the bottom of the JSX, passing `workOrderId`, `siteId`, `customerId`, and `workOrder.work_type` as `mode`. `onClose` sets `showEquipmentModal` to `false`.

| Action | File path |
|--------|-----------|
| **CREATE** | `src/features/workOrders/components/PostCompletionEquipmentModal.jsx` |
| **MODIFY** | `src/features/siteAssets/schema.js` — extract `bulkItemSchema`, `defaultItem` |
| **MODIFY** | `src/features/siteAssets/components/BulkAssetRegisterModal.jsx` — import from `../schema` |
| **MODIFY** | `src/features/siteAssets/api.js` — add `bulkLinkAssetsToWorkOrder`, `bulkRemoveAssets` |
| **MODIFY** | `src/features/siteAssets/hooks.js` — add corresponding hooks |
| **MODIFY** | `src/features/workOrders/WorkOrderDetailPage.jsx` |
| **MODIFY** | `src/locales/tr/workOrders.json` |

---

## Feature 2 — Equipment History UI

**Description:** On the customer detail page, Equipment tab (`/customers/{id}?tab=equipment`), the existing `SiteAssetsCard` shows current equipment. This feature adds an asset history section (expandable per asset) that lists all work orders that touched the asset, the action taken (installed, serviced, removed, replaced, inspected), and date/work order reference. It uses the existing `useAssetHistory(assetId)` hook (which calls `fetchAssetHistory`).

### Lazy loading

`AssetHistorySection` must own its own expansion state. The hook receives `assetId` only when the section is expanded. This prevents N simultaneous queries firing on page load when a customer has many assets:

```
const [isOpen, setIsOpen] = useState(false);
const { data: history, isLoading } = useAssetHistory(isOpen ? assetId : null);
```

`useAssetHistory` already has `enabled: !!assetId` — passing `null` when collapsed means no query fires until the user expands. No changes are required to the hook itself.

| Action | File path |
|--------|-----------|
| **CREATE** | `src/features/siteAssets/components/AssetHistorySection.jsx` |
| **MODIFY** | `src/features/siteAssets/components/SiteAssetsCard.jsx` |
| **MODIFY** | `src/locales/tr/siteAssets.json` |

---

## Feature 3 — Replacement Reason

**Description:** Add a `replacement_reason` column to the `site_assets` table. When an asset's status is changed to "replaced" or "removed" (e.g. in the demount completion flow or a future "mark as removed" UI), show a reason field and save the value to `replacement_reason`. The `site_assets_detail` view uses `sa.*`, so the new column is included automatically after migration.

### Migration spec

**File:** `supabase/migrations/00096_add_site_assets_replacement_reason.sql`

- **Column type:** `TEXT` — free text, no enum or CHECK constraint. The range of reasons (device failure, customer upgrade, end of life, etc.) is too varied to constrain, and filtering by reason value is not a current requirement.
- **Nullable:** yes, unconditionally. The column is only meaningful when `status` is `'removed'` or `'replaced'`. Active and faulty assets leave it `NULL`. Existing rows are unaffected; no backfill is needed.
- **`IF NOT EXISTS`** on the column addition for safety.
- A down migration is included as a comment, matching the convention of this codebase (no separate down migration files exist).

```sql
-- Migration: 00096_add_site_assets_replacement_reason
-- Description: Add replacement_reason TEXT nullable to site_assets.
--   Applies when status is 'removed' or 'replaced'. All other rows remain NULL.

ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS replacement_reason TEXT;

-- Down migration:
-- ALTER TABLE site_assets DROP COLUMN IF EXISTS replacement_reason;
```

**Deployment constraint:** This migration must be applied to the production database before any Feature 1 code is deployed. If Feature 1 ships first, the demount completion modal will attempt to write `replacement_reason` to a non-existent column and throw a database error. Development of Features 3 and 1 can proceed in parallel, but the migration runs first in production.

### API change — `removeAsset`

`removeAsset` in `siteAssets/api.js` currently destructures `{ removed_at, removed_by_work_order_id, replaced_by_asset_id }` from its options parameter. `replacement_reason` is not in the destructure, so it is silently dropped and never sent to Supabase.

Two changes required in `removeAsset`:
1. Add `replacement_reason` to the destructured options parameter.
2. Conditionally add it to `payload`, using the same pattern as the existing `removed_by_work_order_id` conditional already in that function.

| Action | File path |
|--------|-----------|
| **CREATE** | `supabase/migrations/00096_add_site_assets_replacement_reason.sql` |
| **MODIFY** | `src/features/siteAssets/api.js` — `removeAsset` signature and payload |
| **MODIFY** | `src/features/siteAssets/schema.js` (optional — add `replacement_reason` field to `assetSchema`) |
| **MODIFY** | `src/features/workOrders/components/PostCompletionEquipmentModal.jsx` (demount mode; exists after Feature 1) |

---

## Feature 4 — Demount Work Type

**Description:** Add `"demount"` to the `WORK_TYPES` array in the work order schema so the frontend validates and displays it. Add the Turkish translation `"Demontaj"` under `workType` in `common.json`. The database already allows `demount` (migration 00074); no DB change required.

### Schema refine fix

`workOrderSchema` contains a refine that requires `items.length > 0` for all work types except `'survey'`. Without this fix, creating a demount work order without materials rows will fail form validation silently — demount work orders typically have no billable materials.

The refine condition must be updated to exempt both `'survey'` and `'demount'` from the materials requirement. This is a one-line change in the existing refine.

| Action | File path |
|--------|-----------|
| **MODIFY** | `src/features/workOrders/schema.js` — `WORK_TYPES` array + refine condition |
| **MODIFY** | `src/locales/tr/common.json` |

---

## Implementation Order (Equipment Lifecycle)

Recommended order to respect dependencies and minimize rework:

1. **Feature 4 — Demount work type** (unblocks Feature 1 demount flow; the refine fix must be in place before any demount WO can be created)
2. **Feature 3 — Replacement reason** (migration must deploy to production before Feature 1 ships; `removeAsset` fix enables reason in the demount flow from day one)
3. **Feature 1 — Work order completion → equipment registration** (depends on 4 and 3; includes schema extraction pre-step, API additions, modal build, and WorkOrderDetailPage integration)
4. **Feature 2 — Equipment history UI** (independent; can be done in parallel with any of the above or shipped after Feature 1)

**Order: 4 → 3 → 1 → 2**

**Critical deployment constraint:** Feature 3's migration (`00096`) must be applied to the production database before Feature 1 code is deployed. Development can proceed in parallel, but migration runs first in production.

---

## Complexity Ratings (Equipment Lifecycle)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Feature 4 — Demount work type | **Simple** | Two small edits plus one-line refine fix. |
| Feature 3 — Replacement reason | **Simple** | One migration, `removeAsset` two-line change, optional schema field. |
| Feature 1 — Completion → equipment | **Complex** | Schema extraction pre-step, two new batch API functions, new modal with two modes, two-step submit with retry state, WorkOrderDetailPage state machine change, i18n. |
| Feature 2 — Equipment history UI | **Medium** | New presentational component with lazy load pattern, integration into SiteAssetsCard, i18n. |

---

## Dependencies (Equipment Lifecycle)

- **Feature 4 before Feature 1:** The completion flow branches on `work_type === 'demount'`; the frontend must know the demount type. The refine fix must also land before demount WOs can be created at all.
- **Feature 3 before (or with) Feature 1:** The demount completion modal collects `replacement_reason`; `removeAsset` must accept it and the column must exist in the DB.
- **Migration 00096 before Feature 1 deploys to production:** Code and migration can be developed together but the migration must run first in production.
- **Feature 2** has no dependency on 1, 3, or 4. It can ship before Feature 1 is in production, though history data will be sparse until the completion flow (Feature 1) begins populating `work_order_assets` in the field.

---

# Part 3 — Price Revision (Subscriptions)

**Page:** `/subscriptions/price-revision`  
**Scope:** Table layout (horizontal scroll) + Notes system (yearly price change timeline)  
**Status:** Analysis only – no implementation until approved.

---

## 1. Current Implementation Summary

### 1.1 Page & Components

| Item | Location / Detail |
|------|-------------------|
| **Page component** | `src/features/subscriptions/PriceRevisionPage.jsx` |
| **Route** | `App.jsx`: `<Route path="subscriptions/price-revision" element={<PriceRevisionPage />} />` |
| **Layout** | `PageContainer` with `maxWidth="xl"` (1280px), `padding="default"` |
| **Data** | `useSubscriptions(filters)` → `subscriptions_detail` view |
| **Save** | `useBulkUpdateSubscriptionPrices()` → RPC `bulk_update_subscription_prices(p_updates)` |
| **UI pieces** | Filters (service type, billing frequency, start month), single `Table`, Save button, Empty/Error states |

No separate child components for the table; column config and render functions are defined inline in the page.

### 1.2 Database & API

- **Source:** View `subscriptions_detail` (migration `00016_subscriptions.sql`).
- **View joins:** `subscriptions` + `customer_sites` + `customers` + `payment_methods` (optional) + `profiles` (managed_by, sold_by).
- **Key columns used on price-revision:**  
  `id`, `company_name`, `site_name`, `account_no`, `start_date`, `subscription_type`, `service_type`, `billing_frequency`, `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`.
- **Subscriptions table** (`00016`, `00022`): has `notes` (TEXT) and `setup_notes` (TEXT) – general free-text fields, not a timeline.
- **Audit:** `audit_logs` stores `price_change` actions (single and bulk) with `old_values` / `new_values` JSONB and `description` (e.g. "Fiyat güncellendi (toplu revizyon)"). No user-written "revision note" per change.
- **Bulk update:** Migration `00024_bulk_update_subscription_prices.sql` – updates `subscriptions` and pending `subscription_payments`, writes to `audit_logs`; no note parameter.

### 1.3 Table Layout (Current)

- **Component:** `src/components/ui/Table.jsx`.
- **Desktop:** `<div class="hidden lg:block overflow-x-auto">` → horizontal scroll when content is wider than container.
- **Mobile:** `lg:hidden` card stack (one card per row); no horizontal scroll there.
- **Columns (11):**

| # | Column key | Header (TR) | Current styling / width |
|---|------------|-------------|--------------------------|
| 1 | company_name | Müşteri | `min-w-[120px]` on wrapper div, company + site_name |
| 2 | account_no | Hesap No | font-mono, no fixed width |
| 3 | start_date | Başlangıç | `formatDate`, whitespace-nowrap |
| 4 | subscription_type | Tip | Badge |
| 5 | service_type | Hizmet Türü | text |
| 6 | billing_frequency | Ödeme Sıklığı | text (Aylık/Yıllık) |
| 7 | base_price | Baz Fiyat | Input `w-24` |
| 8 | sms_fee | SMS Ücreti | Input `w-20` |
| 9 | line_fee | Hat Ücreti | Input `w-20` |
| 10 | vat_rate | KDV | Input `w-16` |
| 11 | cost | Maliyet | Input `w-24` |

- **Table:** `min-w-full`, no column `width` in config; cells use `whitespace-nowrap` and `px-6 py-4`.
- **Effective width:** With 11 columns and inputs, total width easily exceeds 1280px → horizontal scroll on desktop.

### 1.4 Notes System (Current)

- **In app:** No timeline or "revision notes" on the price-revision page.  
- **Subscriptions:** `subscriptions.notes` and `subscriptions.setup_notes` are shown on **Subscription Detail** (`SubscriptionDetailPage.jsx`) as static blocks (setup notes + general notes). Not tied to a specific price change or year.
- **Audit:** `audit_logs` gives automated history of price changes (who, when, old/new values) but no free-text "note" per revision. Only `description` is set (fixed string like "Fiyat güncellendi (toplu revizyon)").
- **Conclusion:** There is no dedicated "notes for yearly price revision" or "timeline of price change notes" anywhere; only generic notes and system audit.

---

## 2. Problems & Constraints (Price Revision)

### 2.1 Table (Left–Right Scroll)

- **Problem:** 11 columns cause horizontal scroll on typical desktop (e.g. 1280px or 1440px).
- **Constraint:** User requirement: avoid left–right scroll where possible.
- **Constraint:** Must keep editing in place (inputs for base_price, sms_fee, line_fee, vat_rate, cost) and keep filters; only layout/priorities/abbreviations can change.

### 2.2 Notes

- **Problem:** No way to record "why" or "what was agreed" for a yearly price increase (e.g. "2025 zam notu", "müşteri ile görüşüldü").
- **Constraint:** Should support a timeline (e.g. one note per revision / per year), not only a single blob.
- **Constraint:** Should fit existing patterns (i18n, modals/UI, Supabase, RLS) and not break bulk update flow.

---

## 3. Proposed Solutions (Price Revision)

### 3.1 Table Layout – Fit 11 Columns Without Horizontal Scroll

**Goal:** Same 11 data points, no horizontal scroll on common desktop widths (e.g. up to ~1280px content width).

**Approach: combine responsive behavior, abbreviations, and column priorities.**

1. **Shorten headers (abbreviations / tooltips)**  
   - Use short labels in the header to save width; full text in `title` tooltip or in a small "column help" if needed.  
   - Example mapping (can be tuned with i18n):

   | Current header | Short (example) | Tooltip |
   |----------------|------------------|--------|
   | Müşteri | Müş. | Müşteri |
   | Hesap No | H.No | Hesap No |
   | Başlangıç | Başl. | Başlangıç Tarihi |
   | Tip | Tip | Abonelik Tipi |
   | Hizmet Türü | Hizmet | Hizmet Türü |
   | Ödeme Sıklığı | Ödem. | Ödeme Sıklığı |
   | Baz Fiyat | Baz | Baz Fiyat |
   | SMS Ücreti | SMS | SMS Ücreti |
   | Hat Ücreti | Hat | Hat Ücreti |
   | KDV | KDV | KDV (%) |
   | Maliyet | Maliyet | Maliyet |

   Add i18n keys under `priceRevision.columnsShort` (and keep long keys for tooltip/mobile).

2. **Constrain column widths**  
   - Set explicit `width` (or `minWidth`/`maxWidth` if Table supports it) so the table doesn't grow unbounded:
     - Müşteri: ~140px  
     - Hesap No: ~80px  
     - Başlangıç: ~90px  
     - Tip: ~70px  
     - Hizmet: ~80px  
     - Ödem.: ~70px  
     - Baz / SMS / Hat / KDV / Maliyet: keep inputs but narrow (e.g. `w-20` / `w-16` where already used), total ~120–130px for the 5 numeric columns.  
   - Total target: ~800–950px so it fits in xl (1280px) with padding and filters.

3. **Narrow inputs and cell padding**  
   - Use consistent small inputs (e.g. `w-18` or `w-20` for price fields, `w-14` for vat_rate) and optionally `px-3 py-2` for table cells on this page to save horizontal space.

4. **Sticky first column (optional)**  
   - Keep "Müşteri" (and optionally Hesap No) sticky left so when user does scroll on very small viewports, context stays visible. Implement only if we still need a minimal scroll on very narrow desktop.

5. **Table component**  
   - Table currently doesn't use `column.width` in the cell, only in `<th>`. Ensure `width` is applied to `<td>` as well (or that table-layout is fixed and only th widths are used). If not, extend Table to support optional `width` on columns and apply to both `th` and `td`.

**Deliverables:**  
- New i18n keys for short headers + tooltips.  
- Column config in `PriceRevisionPage.jsx` with `width` and short headers.  
- Slightly smaller, consistent input widths.  
- Optional: sticky first column only if needed.

**Result:** Same 11 columns, no horizontal scroll on xl layout, and still editable in place.

---

### 3.2 Notes System – Timeline of Yearly Price Change Notes

**Goal:** Per-subscription timeline of notes tied to price revisions (e.g. one note per year / per revision).

#### 3.2.1 Database Schema Options

| Option | Pros | Cons |
|-------|------|------|
| **A. New table `subscription_price_revision_notes`** | Clear model, easy to query "notes for this subscription", good for RLS and reporting. | New table + migration, one more join or fetch. |
| **B. JSONB on `subscriptions`** (e.g. `price_revision_notes JSONB`) | No new table; one column. | Harder to query by date/author; schema drift if structure changes. |
| **C. Reuse `audit_logs` and add optional `user_note`** | Reuses existing audit trail. | Mixes "system event" with "user note"; audit_logs is generic and might be heavy to query for "last N notes per subscription". |

**Recommendation: Option A – new table `subscription_price_revision_notes`.**

- **Table:**  
  - `id` (uuid, PK),  
  - `subscription_id` (uuid, FK → subscriptions, ON DELETE CASCADE),  
  - `note` (TEXT),  
  - `revision_date` (DATE or TIMESTAMPTZ) – "effective" date of the revision (e.g. 2025-01-01 for 2025 zam),  
  - `created_at` (TIMESTAMPTZ),  
  - `created_by` (UUID → profiles),  
  - optional: `audit_log_id` (UUID → audit_logs) to link to the price_change audit entry if we add a note at save time.  

- **Indexes:** `(subscription_id, revision_date DESC)` (and optionally `created_at DESC`) for "timeline for this subscription".

- **RLS:** Same as subscriptions (e.g. admin/accountant can select/insert; policy aligned with subscriptions_detail / subscriptions).

- **When to create a note:**  
  - **Option 1:** User adds note in the UI when editing prices (e.g. "2025 zam" note) and we save it together with the bulk update (one note per subscription that had edits + optional note text).  
  - **Option 2:** User can add a note without changing price (e.g. "2025 anlaşma notu").  
  Support at least Option 1; Option 2 can be same API: "add note" with optional `revision_date`.

#### 3.2.2 API

- **Create note:** `POST`-style insert into `subscription_price_revision_notes` (subscription_id, note, revision_date, created_by).  
- **List notes:** Query by `subscription_id`, order by `revision_date DESC` or `created_at DESC`.  
- **Bulk save from price-revision page:** Either:  
  - Call existing `bulk_update_subscription_prices` for prices, then for each row that had a "revision note" in the form, insert one note (revision_date = e.g. selected year or today); or  
  - Extend RPC to accept optional `note` per item and insert into `subscription_price_revision_notes` in the same transaction.  

Recommendation: keep RPC for prices only; in the app, after successful bulk update, call a "create revision notes" API for rows that have note text. Simpler and keeps "notes" separate from "price update".

#### 3.2.3 UI Design

- **Where to show notes (price-revision page):**  
  - **Per row:** Small "note" icon/button in each row (e.g. in the Müşteri cell or a dedicated 12th column). Click opens a **modal** or **slide-over** with:  
    - Timeline of existing notes (date + text + author if we store it).  
    - Form to add a new note (text + optional revision date, default e.g. current year-01-01).  
  - **Why modal/slide-over:** Keeps the table compact; timeline can be long and needs space.  
  - Avoid inline expandable section in the table (many rows → noisy and heavy).

- **When saving prices:**  
  - If we want "one note for this batch" (e.g. "2025 toplu zam"): one global note field above the table that applies to all rows that are being updated; we create one note per updated subscription with that text and revision_date.  
  - If we want "per-row note": each row can have an optional note input (or "add note" that opens modal); on save we persist notes only for rows that have note content.  

Recommendation: **per-row "Notes" button** that opens a **modal** with:  
- Timeline of existing revision notes (list by revision_date desc).  
- "Add note" form (note text, revision date).  
- No need to change the bulk-update RPC; after bulk update success, for each row that has a new note in local state, call "create revision note" API.

- **Subscription Detail page:** Optionally add a "Fiyat revizyon notları" section that shows the same timeline (read-only) by loading `subscription_price_revision_notes` for that subscription.

#### 3.2.4 i18n

- New keys under `subscriptions.priceRevision.notes` (or `subscriptions.revisionNotes`): e.g. `title`, `add`, `revisionDate`, `empty`, `timelineTitle`, and column header "Not" if we add a notes column.

---

## 4. Summary (Price Revision)

| Area | Current state | Proposed direction |
|------|----------------|--------------------|
| **Table layout** | 11 columns, no width limits, `overflow-x-auto` → horizontal scroll | Short headers + tooltips, fixed column widths, slightly smaller inputs → fit in xl without scroll; optional sticky first column. |
| **Notes** | Only generic `notes`/`setup_notes` and audit_logs (no user note per revision) | New table `subscription_price_revision_notes`; per-row "Notes" button on price-revision page opening modal with timeline + add form; optional "revision notes" block on Subscription Detail. |

---

## 5. Open Points / User Answers (Price Revision)

1. **Short headers:** ❌ **REJECTED** – User wants full column names.  
   → **See:** `price-revision-alternatives.md` for 6 alternative solutions (Options A-F).

2. **Notes – one per revision vs many:** ✅ **CONFIRMED** – One note per year (one revision per year). Timeline shows all historical notes (2026, 2027, 2028, etc.).

3. **Notes – revision_date default:** ⏳ **PENDING** – Need to decide: first day of current year (e.g. 2025-01-01) or "today"?

4. **Bulk "batch note":** ✅ **NO** – Not needed. Only per-row notes.

**Next step:** User must choose one table layout solution from the alternatives document.
