# Proposal / Work Order Technical Roadmap

**Date:** 2026-07-05  
**Project:** Ornet ERP  
**Status:** Completed technical reference  
**Purpose:** Define the implementation roadmap for Proposal ↔ Work Order fulfillment using the existing Ornet ERP stack, flows, and architectural patterns.

---

## 1. Technical Planning Principle

This roadmap must stay inside the current Ornet ERP system shape.

That means:

- keep the existing React + Vite + React Query + Supabase structure,
- keep existing feature/module boundaries,
- keep current finance safety assumptions,
- extend existing Proposal and Work Order flows instead of inventing a parallel system,
- avoid enterprise-heavy redesigns,
- avoid large process-breaking refactors unless absolutely necessary.

This is an adaptation roadmap, not a greenfield redesign.

---

## 2. Existing System Anchors To Reuse

The implementation should build on the current modules and flows:

### Proposal side

- `src/features/proposals/`
- existing proposal status flow:
  - `draft`
  - `sent`
  - `accepted`
  - `completed`
- existing `İşe Başla` / accepted behavior
- existing Proposal detail page and actions
- existing Proposal item model

### Work-order side

- `src/features/workOrders/`
- existing linked proposal field in work-order creation
- existing work-order list:
  - active
  - archive
- existing work-order completion flow
- existing work-order items row structure

### Finance side

- existing rule that proposal-linked work orders must not create finance entries
- existing proposal completion / finance trigger flow
- existing `financial_transactions` source-of-truth pattern

### Existing documentation context

- [proposal-workorder-fulfillment-context.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-fulfillment-context.md)
- [proposal-workorder-product-rules.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-product-rules.md)

---

## 3. Implementation Target

The target is to support:

- proposal-linked multi-visit work orders,
- quantity-based visit execution,
- simple extra-scope capture,
- proposal revision after execution changes,
- clear office/admin follow-up,
- no duplicate finance posting.

Without:

- introducing a separate enterprise fulfillment subsystem,
- replacing current core flows,
- overcomplicating field team behavior.

---

## 4. Module Breakdown

Implementation should be broken into the following modules.

### Module 1. Proposal status and operational availability

Goal:

- formalize which proposals are selectable by field team for linked WO creation.

Key rule:

- field team should only see proposals that are operationally started,
- current business meaning = `accepted` proposals.

Phase-1 practical rule:

- selectable pool = all `accepted + current + not completed` proposals

Important clarification:

- `accepted/open/current proposal` must be translated into a strict technical query rule,
- not left as a loose UI phrase.

Likely touchpoints:

- proposal status handling in `src/features/proposals/api.js`
- proposal list/query filtering
- linked proposal query for work-order creation

Questions already settled:

- no new business status is strictly required if `accepted` already maps to `İşe Başla`

Technical caution:

- do not break existing proposal list tabs and status logic.

---

### Module 2. Proposal-linked work-order creation flow

Goal:

- adapt current work-order creation to be the canonical linked-WO creation flow for phase 1.

Expected behavior:

- field opens work-order creation,
- sees proposal-link field,
- only valid proposals are listed,
- user selects relevant accepted/open proposal.

Final strategy for phase 1:

- proposal is created by office/center,
- accepted/open proposal becomes selectable in work-order create flow,
- field team may create the next linked visit WO from there,
- office/admin may also use the same flow when needed,
- a separate office-only planning submodule is not required in phase 1.

Selector simplification:

- no extra customer/site prefilter is required by the agreed phase-1 product rule

Important data behavior:

- proposal-derived work-order rows should be written as snapshots,
- field team must not see price/cost in UI,
- but underlying DB rows should still preserve the source-row values needed for historical consistency,
- row lineage and row snapshot must work together.

Critical UI requirement:

- standalone and proposal-linked creation must be clearly separated in the create experience,
- even if they share the same page/component shell,
- user must not feel that linked WO is "just a normal WO with one extra dropdown".

Likely touchpoints:

- `src/features/workOrders/WorkOrderFormPage.jsx`
- `src/features/proposals/hooks.js`
- `src/features/proposals/api.js`

Do not do:

- create a totally separate app flow unless existing create flow proves impossible to extend safely.

---

### Module 3. Linked work-order row execution UI

Goal:

- make proposal-linked WO rows usable for field team with quantity-based execution.

Required product behavior:

- all proposal rows visible,
- completed rows visible as reference,
- remaining rows editable,
- field enters `this visit completed quantity`,
- no checkbox-only interaction,
- price/cost hidden,
- extra row button available.

Likely touchpoints:

- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/WorkOrderFormPage.jsx`
- work-order schema validation
- i18n files for work-orders

Design caution:

- do not overload one row with too many controls,
- keep field inputs minimal.

---

### Module 4. Extra / scope-disi row capture

Goal:

- allow field and office to record extra material/service without silently changing the proposal.

Expected behavior:

- `Teklif Dışı Malzeme Ekle` action,
- product selection from existing material catalog,
- quantity input,
- optional note,
- no price/cost shown to field team.

Likely touchpoints:

- work-order item editor
- work-order row schema
- proposal detail operational summary

Important rule:

- this is an operational record first,
- commercial revision comes later through Proposal workflow.
- row category should be explicit at data layer through `source_type`

---

### Module 5. Proposal revision flow

Goal:

- distinguish `Düzenle` from `Revize Et`
- preserve old commercial version simply
- let revised proposal become the new truth

Expected behavior:

- `Düzenle` before execution-stage changes
- `Revize Et` after execution changed commercial reality
- old proposal retained
- new proposal created with simple chain link:
  - `revised_from_proposal_id`

Likely touchpoints:

- proposal schema / DB migration
- proposal create/update flow
- proposal detail actions menu
- previous version display

Important caution:

- do not introduce a complex version engine
- keep to simple linked-record history

---

### Module 6. Proposal detail operational summary

Goal:

- provide enough operational visibility inside proposal detail
- without creating a separate large fulfillment module

Expected summary content:

- latest linked visit / work-order signal
- extra scope present or not
- quantity difference / revision-needed signal
- practical job-follow-up visibility for office/admin

Important completion interaction:

- revision-needed is a warning signal
- it should not hard-block proposal completion

Likely touchpoints:

- `src/features/proposals/ProposalDetailPage.jsx`
- proposal hooks / linked work-order queries

Do not do:

- build a heavy standalone fulfillment dashboard in phase 1

---

### Module 7. Work-order tracking reuse

Goal:

- keep `Work Orders > Active / Archive` as part of the follow-up model

Expected behavior:

- office/admin can inspect completed visits through archive
- latest completed linked WOs appear on top through existing ordering

Likely touchpoints:

- possibly none or minimal if current ordering already works
- document and preserve this behavior instead of replacing it

---

### Module 8. Finance safety enforcement

Goal:

- make sure linked WOs never create finance side effects

Expected behavior:

- linked WOs produce no revenue posting
- linked WOs produce no VAT posting
- linked WOs produce no automatic finance rows
- revised/final proposal remains the finance source

Likely touchpoints:

- work-order completion RPC expectations
- trigger assumptions
- proposal completion/revision interaction

Important caution:

- validate current DB behavior before changing UI assumptions
- do not accidentally break standalone WO finance flow

---

## 5. Data Model Areas

This roadmap assumes the following data-model areas will likely need change.

### Likely proposal-side additions

- `revised_from_proposal_id` or equivalent chain field

### Required work-order-side additions

- linked proposal visibility/filter improvements
- row-level execution fields/behavior aligned with quantity completion model
- row-level source linkage from work-order rows back to proposal rows

Phase 1 required lineage direction:

- proposal-derived work-order row must point to its source proposal row
- practical example: `work_order_materials.proposal_item_id`

Reason:

- fulfillment is quantity-based
- previously completed quantity must be computed per proposal row
- remaining quantity must be computed per proposal row
- revision/reconciliation must not rely on fuzzy matching

Important note:

- this should still be implemented using the current DB/migration style,
- not with a parallel event-sourcing system or heavy redesign.

---

## 6. Tech Stack Guardrails

Implementation must stay within current project standards:

- React components stay in current feature folders
- React Query hooks stay in `hooks.js`
- Supabase queries stay in `api.js`
- Zod stays in `schema.js`
- migrations stay sequential in `supabase/migrations/`
- UI text remains i18n-driven
- no TypeScript migration
- no new framework layer
- no external workflow engine

This work should feel like a natural continuation of Ornet ERP, not a subsystem transplant.

---

## 7. Recommended Delivery Order

Technical implementation should likely happen in this order:

1. Proposal revision model and status assumptions
2. Proposal selection/filtering for linked WO creation
3. Linked WO row UI for `this visit completed quantity`
4. Extra-scope row input
5. Proposal detail operational summary
6. Revision action/menu behavior
7. Finance-safety verification
8. Final cleanup and regression pass

Reason:

- this order locks the business source-of-truth rules first,
- then the field workflow,
- then the office visibility layer,
- then the finance verification.

---

## 8. Rollout Philosophy

Phase 1 should aim for:

- correct product flow
- safe finance behavior
- usable field UI
- visible office follow-up

Phase 1 should not aim for:

- perfect historical reconstruction
- advanced analytics engine
- enterprise-grade fulfillment orchestration
- deep automated cost intelligence

Future phases may later add:

- visit inefficiency reporting
- planned vs actual visit count analysis
- operational loss estimation

But those should use the data captured now, not block phase 1.

---

## 9. Risks To Control

Main risks:

- mixing standalone WO flow and linked WO flow too aggressively
- overcomplicating field row interaction
- creating hidden finance side effects
- introducing too much revision complexity
- making proposal detail too crowded

The roadmap should be reviewed continuously against one question:

> Does this make daily life easier for field team and office, or does it just make the model more sophisticated?

If the answer is only “more sophisticated”, it should be cut.

---

## 10. Next Documents

After this roadmap, the next useful technical docs are:

- `proposal-workorder-data-model-plan.md`
- `proposal-workorder-ui-flow-plan.md`
- optionally later: `proposal-workorder-implementation-sequence.md`

This roadmap should be treated as the bridge between product rules and detailed technical design.
