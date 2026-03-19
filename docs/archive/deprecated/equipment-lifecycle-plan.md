# Equipment Lifecycle — Implementation Plan

This document describes the full implementation plan for the Equipment Lifecycle feature in Ornet ERP. The database and API layer for work orders ↔ site assets already exist (`work_order_assets`, `site_assets`, hooks); this plan adds the missing UI and schema pieces.

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

### [REVISED] Pre-step: Extract shared schema

Before building the modal, move the item-level Zod schema out of `BulkAssetRegisterModal.jsx` and into `siteAssets/schema.js` so `PostCompletionEquipmentModal` can import it without duplicating validation logic.

- Extract `bulkItemSchema` and `defaultItem` from `BulkAssetRegisterModal.jsx` as named exports in `siteAssets/schema.js`
- Update `BulkAssetRegisterModal.jsx` to import both from `../schema`

### [REVISED] API additions

Two new batch functions must be added to `siteAssets/api.js` before the modal is built:

- **`bulkLinkAssetsToWorkOrder(workOrderId, assetIds, action)`** — single `insert` of N records into `work_order_assets`. Replaces N individual `linkAssetToWorkOrder` calls. One network call, atomic at the DB level.
- **`bulkRemoveAssets(assetIds, { removed_at, removed_by_work_order_id, replacement_reason })`** — single `update ... where id in (assetIds)` on `site_assets`. Replaces N individual `removeAsset` calls. One network call, atomic at the DB level.

Add corresponding hooks `useBulkLinkAssetsToWorkOrder` and `useBulkRemoveAssets` in `siteAssets/hooks.js`.

### [REVISED] Modal submit — two-step retry safety

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

### [REVISED] WorkOrderDetailPage integration

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
| **MODIFY** | `src/features/siteAssets/schema.js` — extract `bulkItemSchema`, `defaultItem` **[REVISED]** |
| **MODIFY** | `src/features/siteAssets/components/BulkAssetRegisterModal.jsx` — import from `../schema` **[REVISED]** |
| **MODIFY** | `src/features/siteAssets/api.js` — add `bulkLinkAssetsToWorkOrder`, `bulkRemoveAssets` **[REVISED]** |
| **MODIFY** | `src/features/siteAssets/hooks.js` — add corresponding hooks **[REVISED]** |
| **MODIFY** | `src/features/workOrders/WorkOrderDetailPage.jsx` |
| **MODIFY** | `src/locales/tr/workOrders.json` |

---

## Feature 2 — Equipment History UI

**Description:** On the customer detail page, Equipment tab (`/customers/{id}?tab=equipment`), the existing `SiteAssetsCard` shows current equipment. This feature adds an asset history section (expandable per asset) that lists all work orders that touched the asset, the action taken (installed, serviced, removed, replaced, inspected), and date/work order reference. It uses the existing `useAssetHistory(assetId)` hook (which calls `fetchAssetHistory`).

### [REVISED] Lazy loading

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

### [REVISED] Migration spec

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

**[REVISED] Deployment constraint:** This migration must be applied to the production database before any Feature 1 code is deployed. If Feature 1 ships first, the demount completion modal will attempt to write `replacement_reason` to a non-existent column and throw a database error. Development of Features 3 and 1 can proceed in parallel, but the migration runs first in production.

### [REVISED] API change — `removeAsset`

`removeAsset` in `siteAssets/api.js` currently destructures `{ removed_at, removed_by_work_order_id, replaced_by_asset_id }` from its options parameter. `replacement_reason` is not in the destructure, so it is silently dropped and never sent to Supabase.

Two changes required in `removeAsset`:
1. Add `replacement_reason` to the destructured options parameter.
2. Conditionally add it to `payload`, using the same pattern as the existing `removed_by_work_order_id` conditional already in that function.

| Action | File path |
|--------|-----------|
| **CREATE** | `supabase/migrations/00096_add_site_assets_replacement_reason.sql` **[REVISED]** |
| **MODIFY** | `src/features/siteAssets/api.js` — `removeAsset` signature and payload **[REVISED]** |
| **MODIFY** | `src/features/siteAssets/schema.js` (optional — add `replacement_reason` field to `assetSchema`) |
| **MODIFY** | `src/features/workOrders/components/PostCompletionEquipmentModal.jsx` (demount mode; exists after Feature 1) |

---

## Feature 4 — Demount Work Type

**Description:** Add `"demount"` to the `WORK_TYPES` array in the work order schema so the frontend validates and displays it. Add the Turkish translation `"Demontaj"` under `workType` in `common.json`. The database already allows `demount` (migration 00074); no DB change required.

### [REVISED] Schema refine fix

`workOrderSchema` contains a refine that requires `items.length > 0` for all work types except `'survey'`. Without this fix, creating a demount work order without materials rows will fail form validation silently — demount work orders typically have no billable materials.

The refine condition must be updated to exempt both `'survey'` and `'demount'` from the materials requirement. This is a one-line change in the existing refine.

| Action | File path |
|--------|-----------|
| **MODIFY** | `src/features/workOrders/schema.js` — `WORK_TYPES` array + refine condition **[REVISED]** |
| **MODIFY** | `src/locales/tr/common.json` |

---

## Implementation Order

Recommended order to respect dependencies and minimize rework:

1. **Feature 4 — Demount work type** (unblocks Feature 1 demount flow; the refine fix must be in place before any demount WO can be created)
2. **Feature 3 — Replacement reason** (migration must deploy to production before Feature 1 ships; `removeAsset` fix enables reason in the demount flow from day one)
3. **Feature 1 — Work order completion → equipment registration** (depends on 4 and 3; includes schema extraction pre-step, API additions, modal build, and WorkOrderDetailPage integration)
4. **Feature 2 — Equipment history UI** (independent; can be done in parallel with any of the above or shipped after Feature 1)

**Order: 4 → 3 → 1 → 2**

**[REVISED] Critical deployment constraint:** Feature 3's migration (`00096`) must be applied to the production database before Feature 1 code is deployed. Development can proceed in parallel, but migration runs first in production.

---

## Complexity Ratings

| Feature | Complexity | Notes |
|---------|------------|-------|
| Feature 4 — Demount work type | **Simple** | Two small edits plus one-line refine fix. |
| Feature 3 — Replacement reason | **Simple** | One migration, `removeAsset` two-line change, optional schema field. |
| Feature 1 — Completion → equipment | **Complex** | Schema extraction pre-step, two new batch API functions, new modal with two modes, two-step submit with retry state, WorkOrderDetailPage state machine change, i18n. |
| Feature 2 — Equipment history UI | **Medium** | New presentational component with lazy load pattern, integration into SiteAssetsCard, i18n. |

---

## Dependencies (Summary)

- **Feature 4 before Feature 1:** The completion flow branches on `work_type === 'demount'`; the frontend must know the demount type. The refine fix must also land before demount WOs can be created at all.
- **Feature 3 before (or with) Feature 1:** The demount completion modal collects `replacement_reason`; `removeAsset` must accept it and the column must exist in the DB.
- **[REVISED] Migration 00096 before Feature 1 deploys to production:** Code and migration can be developed together but the migration must run first in production.
- **Feature 2** has no dependency on 1, 3, or 4. It can ship before Feature 1 is in production, though history data will be sparse until the completion flow (Feature 1) begins populating `work_order_assets` in the field.

---

*This plan is for implementation only; no code is included in this document.*
