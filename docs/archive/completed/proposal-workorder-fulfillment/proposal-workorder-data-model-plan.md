# Proposal / Work Order Data Model Plan

**Date:** 2026-07-05  
**Project:** Ornet ERP  
**Status:** Completed data-model reference  
**Purpose:** Translate the agreed product rules into concrete database/model requirements using the existing Ornet ERP schema style.

---

## 1. Planning Principle

This plan must stay close to the existing schema and migration style.

That means:

- extend current `proposals`, `proposal_items`, `work_orders`, `work_order_materials` flow,
- avoid creating a separate fulfillment subsystem,
- avoid event-sourcing / workflow-engine style redesign,
- prefer a few explicit columns and derived views over complex machinery.

---

## 2. Canonical Business Entities

### Proposal

Commercial source of truth.

Primary table:

- `proposals`

Commercial line items:

- `proposal_items`

### Work Order

Visit/service execution record.

Primary table:

- `work_orders`

Visit rows/items:

- `work_order_materials`

### Link Between Them

Proposal-linked work orders already have proposal connection at work-order level.

But phase 1 requires row-level linkage too.

---

## 3. Required Phase 1 Additions

### 3.1 Proposal revision chain

Add to `proposals`:

- `revised_from_proposal_id UUID NULL REFERENCES proposals(id)`

Purpose:

- preserve old proposal version,
- allow simple previous-version chain,
- support `Revize Et` without overwriting old commercial truth.

### 3.2 Row lineage for fulfillment

Add to `work_order_materials`:

- `proposal_item_id UUID NULL REFERENCES proposal_items(id)`

This is a phase 1 requirement.

Reason:

- fulfillment is quantity-based,
- `previously completed quantity` must be computed per proposal row,
- `remaining quantity` must be computed per proposal row,
- revision/reconciliation must not rely on fuzzy matching by description/material only.

### 3.3 Required source marker

Add to `work_order_materials`:

- `source_type TEXT NOT NULL DEFAULT 'proposal_item'`

Suggested values:

- `proposal_item`
- `manual_extra`
- `legacy`

Purpose:

- distinguish proposal-derived rows from scope-disi rows,
- keep future reporting and reconciliation simpler.

This should be part of phase 1.

Reason:

- `proposal_item_id` identifies source row,
- `source_type` identifies row business category,
- phase 1 already needs explicit difference between:
  - proposal-derived rows,
  - manual extra rows,
  - legacy rows,
- this is small to add now and expensive to retrofit later.

---

## 4. Explicit Meaning Of “Selectable Proposal”

The phrase `accepted/open proposal` should not remain vague.

For phase 1, a proposal should be selectable for proposal-linked WO creation if all of the following are true:

1. `status = 'accepted'`
2. proposal is not soft-deleted
3. proposal is not superseded by a newer revision
4. proposal is not commercially/operationally finished

This is the full phase-1 selection pool.

No extra customer/site restriction is required by the current product decision.

Practical interpretation in current schema:

- minimum hard rule: `status = 'accepted'`

Additional data-model recommendation:

- if revision chain is added, old superseded proposal should not appear as selectable when a newer revised proposal exists and is the current commercial truth

So “open” in this context should mean:

- accepted
- current revision
- not completed/cancelled/rejected

This should be encoded in query logic and, if useful, later wrapped in a dedicated view/query helper.

This is not merely a UI filter.

It is a technical selectable-proposal rule and should be treated as such in API/query design.

---

## 5. Linked WO Creation Model

Phase 1 canonical creation model:

- same create page can host both standalone and linked flows,
- but linked flow must be explicitly selected by user,
- linked flow must attach selected proposal at work-order level,
- linked work-order rows must be created from proposal rows with row-level lineage.

Meaning:

- screen shell may be shared,
- underlying data behavior is not the same.

Data-model consequence:

- proposal-linked WO row insert must populate `proposal_item_id` for source rows,
- scope-disi manual rows must keep `proposal_item_id = NULL`,
- `source_type` must also be populated:
  - source rows => `proposal_item`
  - manual extra rows => `manual_extra`

Snapshot rule:

- proposal-derived work-order rows should also store snapshot values copied from the proposal row at creation time
- field team does not see commercial fields in UI
- but DB rows should still preserve the source-time values needed for historical consistency

Practical meaning:

- lineage answers `where did this row come from?`
- snapshot answers `what did that row look like when this visit/work-order was created?`

---

## 6. How Quantity Context Should Be Derived

The UI wants to show:

- quoted quantity
- previously completed quantity
- this-visit completed quantity
- remaining quantity

Data-model interpretation:

### Quoted quantity

Source:

- `proposal_items.quantity`

### Previously completed quantity

Should be derived as:

- sum of quantities from earlier completed proposal-linked work-order rows
- grouped by `proposal_item_id`

Recommended business-safe definition:

- only completed linked work orders count as `previously completed`

Reason:

- draft/in-progress/pending visit rows are not final execution truth yet
- this matches the agreed wording better than “allocated”

### Remaining quantity

Derived as:

- `proposal_items.quantity - previously_completed_quantity`

For current visit input, UI may show live remaining preview including current typed value, but persistent business truth should come from completed rows.

---

## 7. Why `proposal_item_id` Is Mandatory

Without `proposal_item_id`, the system would have to guess lineage from:

- material id,
- description,
- quantity,
- unit,
- revenue type.

That is not reliable enough for:

- repeated rows,
- edited descriptions,
- service rows stored in materials catalog,
- revised proposals,
- extra scope entries.

Therefore:

- `proposal_item_id` is not optional in the agreed phase 1 model.

---

## 8. Proposal Revision Behavior In Data Terms

When commercial reality changes after execution begins:

1. old proposal remains in DB
2. new revised proposal row is created
3. new row points to old row via `revised_from_proposal_id`
4. old work orders remain frozen
5. future linked work orders should follow the current revised proposal

Data-model consequence:

- proposal chain must remain simple and queryable
- no old row mutation should destroy historical meaning

Recommended practical rule:

- new revised proposal becomes the only selectable/current proposal for future linked WO creation

---

## 9. Work-Order Row Categories

Phase 1 should distinguish at least these row categories:

### Proposal-derived execution row

- linked to one `proposal_item_id`
- inherits row meaning from proposal

### Scope-disi / extra row

- no `proposal_item_id`
- manually added during visit
- still belongs to work order
- may later cause commercial revision

### Legacy row

- old data without reliable lineage
- forward compatibility only

`source_type` should be implemented in phase 1 so these categories are explicit and easy to query.

---

## 10. Proposal Detail Summary Data

Proposal detail does not need a heavy fulfillment module.

But the small operational summary needs data access to:

- latest linked work order(s)
- whether extra rows exist
- whether quantity difference exists
- whether revision is required

Recommended phase-1 interpretation of `revision required`:

- true if any completed linked WO has quantity difference against proposal-derived rows
- true if any completed linked WO contains `source_type = 'manual_extra'`

This is a warning/visibility signal.

It is not a hard block on proposal completion.

This can likely be served by:

- existing linked work-order queries,
- plus one small derived aggregation/query helper,
- not by a full new subsystem.

---

## 11. Finance Safety Requirements At Data Layer

Proposal-linked work orders must remain operational-only.

Data/model implication:

- linked WO completion must not produce finance records
- proposal remains finance-bearing source
- revised proposal remains the basis for final commercial posting

Nothing in this model should weaken the current “linked WO = no finance” rule.

---

## 12. Backward Compatibility Strategy

Old linked WOs are not the primary concern.

Recommended approach:

- new columns nullable where needed for rollout safety
- old rows may remain without lineage
- old rows may be marked `legacy` if a source marker is added
- do not block phase 1 on perfect historical reconstruction

This matches the agreed business stance.

---

## 13. Recommended DB / Model Sequence

Phase 1 data-model sequence should likely be:

1. add `revised_from_proposal_id` to `proposals`
2. add `proposal_item_id` to `work_order_materials`
3. add `source_type` to `work_order_materials`
4. update query/API layer to respect “current selectable proposal” rule
5. add minimal derived query logic for previously completed quantity

This sequence supports product rules without jumping too early into UI complexity.

Migration safety note:

- these belong to the same product phase,
- but should preferably be delivered as small separate migrations rather than one oversized migration,
- so review and rollback stay safer.

---

## 14. Non-Goals For This Phase

This phase should not try to build:

- full revision history browser
- advanced fulfillment engine
- deep operational costing engine
- automatic commercial decision engine for extra scope

The goal is just enough structure to make the agreed workflow reliable.

---

## 15. Summary

Phase 1 data-model must lock three things:

1. proposal revision chain
2. per-row lineage from work-order rows to proposal rows
3. strict selectable-proposal rule for linked WO creation

If these three are not solid, the rest of the workflow becomes fragile.
