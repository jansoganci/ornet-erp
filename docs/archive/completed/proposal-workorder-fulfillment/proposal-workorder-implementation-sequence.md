# Proposal / Work Order Implementation Sequence

**Date:** 2026-07-05  
**Project:** Ornet ERP  
**Status:** Completed implementation record — Phase 1, 2, 3, 4, 5, 6 completed  
**Purpose:** Define the safest and most practical order for implementing the agreed Proposal ↔ Work Order fulfillment model in Ornet ERP.

---

## 1. Implementation Principle

Implementation should follow dependency order, not cosmetic order.

That means:

- first lock data truth,
- then lock query/API behavior,
- then build field UI,
- then build office/admin visibility,
- then verify finance safety,
- then clean up old/weak behavior.

This sequence is meant to:

- reduce regression risk,
- avoid half-working UI,
- avoid building screens before the data model exists,
- keep rollout understandable.

---

## 2. Inputs For This Sequence

This sequence is based on the following active documents:

- [proposal-workorder-fulfillment-context.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-fulfillment-context.md)
- [proposal-workorder-product-rules.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-product-rules.md)
- [proposal-workorder-technical-roadmap.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-technical-roadmap.md)
- [proposal-workorder-data-model-plan.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-data-model-plan.md)
- [proposal-workorder-ui-flow-plan.md](/Users/jans/Desktop/voxus-systems/ornet-erp/docs/archive/completed/proposal-workorder-fulfillment/proposal-workorder-ui-flow-plan.md)

---

## 3. Phase Structure

Recommended delivery structure:

1. Foundation phase
2. Linked WO creation phase
3. Linked WO execution UI phase
4. Proposal revision / visibility phase
5. Finance safety and regression phase
6. Cleanup and behavior hardening phase

This is not meant to become six long waterfall milestones.

It is just the safest implementation order.

---

## 4. Phase 1 — Foundation

**Status:** Completed

### Goal

Create the minimum data-model and status groundwork that all later UI depends on.

### Scope

1. Add proposal revision chain support
   - `proposals.revised_from_proposal_id`

2. Add row lineage support
   - `work_order_materials.proposal_item_id`

3. Add row category support
   - `work_order_materials.source_type`

4. Define strict selectable-proposal rule in data/API layer
   - accepted
   - current revision
   - not completed/cancelled/rejected
   - not soft-deleted

Recommended migration style:

- same foundation phase,
- but small separate migrations,
- not one oversized schema patch.

### Why first

Because without this:

- linked WO rows cannot be trusted,
- revision cannot be modeled cleanly,
- selectable proposal logic stays fuzzy,
- UI would be forced to guess.

### Expected outputs

- migration(s)
- schema alignment
- API/query contract updates

### Risks controlled here

- fake fulfillment logic
- fuzzy row matching
- later UI rework

---

## 5. Phase 2 — Linked WO Creation

**Status:** Completed

### Goal

Make proposal-linked work-order creation usable and explicit without breaking standalone WO flow.

### Scope

1. Shared work-order create screen supports two clear modes:
   - `Bağımsız İş Emri`
   - `Teklife Bağlı İş Emri`

2. Proposal selector only shows valid selectable proposals
   - all `accepted + current + not completed` proposals

3. Proposal options become understandable enough to choose safely
   - proposal no
   - title
   - customer
   - site

4. Proposal-linked mode loads proposal-derived row set correctly
   - proposal-derived rows are inserted with lineage
   - proposal-derived rows preserve snapshot values in DB

### Why second

Because this is the first behavior users will feel.

And it depends on:

- selectable proposal logic
- row lineage assumptions
- mode separation rule

### Expected outputs

- create screen mode separation
- linked proposal selector behavior
- proposal-derived row loading contract

### Risks controlled here

- standalone / linked confusion
- wrong proposal selection
- field team seeing irrelevant proposals

---

## 6. Phase 3 — Linked WO Row Execution UI

**Status:** Completed

### Goal

Give field team the simplest usable interaction model for proposal-linked visit execution.

### Scope

1. Show proposal rows with:
   - quoted quantity
   - previously completed quantity
   - this-visit completed quantity

2. Keep prices/costs hidden

3. Order rows by usability:
   - remaining rows first
   - completed rows below
   - completed rows optionally collapsed by default

4. Over-entry warning

5. `Teklif Dışı Malzeme Ekle`

6. General note support remains available

### Why third

Because this is the core daily-use field workflow.

It should only be built after:

- row lineage exists
- linked creation flow is stable

### Expected outputs

- usable field visit form
- quantity-based execution input
- extra-scope capture

### Risks controlled here

- field confusion
- unusable long proposal forms
- insufficient execution data

---

## 7. Phase 4 — Proposal Revision and Proposal Detail Visibility

**Status:** Completed

### Goal

Complete the office/admin side of the loop.

### Scope

1. Distinguish `Düzenle` vs `Revize Et`

2. Add dropdown action pattern in proposal detail:
   - `Düzenle`
   - `Revize Et`
   - `Sil`

3. `Revize Et` uses current proposal as base

4. Revised proposal is saved as a new version

5. Old proposal remains visible in simple previous-version chain

6. Proposal detail gets lightweight operational summary:
   - latest linked visit signal
   - extra scope signal
   - quantity difference signal
   - revision-needed signal

7. Proposal completion warning behavior:
   - admin completion stays manual
   - revision-needed warns
   - warning does not block completion

### Why fourth

Because office/admin follow-up should be built after field execution flow exists.

Otherwise proposal detail would display signals that the actual execution flow cannot yet produce reliably.

### Expected outputs

- revision UX
- previous version visibility
- practical office/admin follow-up inside proposal detail

### Risks controlled here

- silent commercial drift
- untraceable revisions
- office losing context after field visit completion

---

## 8. Phase 5 — Finance Safety and Regression Pass

**Status:** Completed

### Goal

Verify that the new flow does not create finance damage.

### Scope

1. Re-verify linked WO completion path:
   - no revenue posting
   - no VAT posting
   - no automatic finance rows

2. Re-verify proposal revision effect:
   - final commercial truth still belongs to proposal
   - no double finance behavior

3. Re-verify standalone WO flow still works unchanged

4. Re-verify proposal completion assumptions

### Why fifth

Because finance safety is critical, but should be validated after behavior is fully wired.

If done too early, validation is incomplete.

### Expected outputs

- verified no-finance behavior for linked WO
- no regression in standalone WO
- confidence before rollout

### Risks controlled here

- duplicate revenue
- broken standalone finance
- hidden trigger side effects

---

## 9. Phase 6 — Cleanup and Hardening

**Status:** Completed

### Goal

Remove ambiguity and harden the final phase-1 behavior.

### Scope

1. Remove or hide weak/legacy UX that conflicts with final model

2. Clean inconsistent labels / i18n

3. Make proposal selection and linked mode language explicit

4. Document remaining known non-goals

5. Optional small guardrails for legacy behavior

### Why sixth

Because cleanup is safest after core flow is working.

### Expected outputs

- cleaner UX
- less confusion
- less accidental fallback to old weak behavior

---

## 10. File/Layer Mapping By Phase

### Likely phase 1 layers

- migrations
- `schema.js`
- `api.js`

### Likely phase 2 layers

- work-order create UI
- proposal fetch/filter hooks

### Likely phase 3 layers

- work-order item editor
- linked WO form behavior
- i18n labels

### Likely phase 4 layers

- proposal detail UI
- proposal actions
- proposal revision save flow

### Likely phase 5 layers

- RPC/trigger verification
- finance regression validation

### Likely phase 6 layers

- cleanup
- label consistency
- weak flow removal/hiding

---

## 11. What Should Not Be Done Too Early

Avoid doing these too early:

- building complex analytics
- building a dedicated fulfillment module
- building deep previous-version comparison UI
- building smart automation around commercial decision making
- over-optimizing legacy data handling

These are phase-later concerns.

Phase 1 should stay focused on correctness and usability.

---

## 12. Suggested Testing / Validation Order

After implementation work begins, validation should follow this order:

1. Selectable proposal logic works correctly
2. Standalone vs linked mode separation is obvious
3. Linked WO rows load correctly from proposal
4. Completed quantity behavior is correct
5. Extra row entry works
6. Revision chain works
7. Proposal detail summary is understandable
8. Linked WO produces no finance
9. Standalone WO still produces normal finance

This order mirrors the main business risk stack.

---

## 13. Rollout Recommendation

Best rollout style:

- implement as one internally consistent feature slice,
- not as scattered independent UI patches,
- but still in the dependency order above.

If needed, rollout can be hidden behind:

- role-limited exposure
- linked-WO specific UI gating

until confidence is high.

---

## 14. Summary

The safest implementation order is:

1. data truth
2. linked creation truth
3. field execution truth
4. office/admin revision truth
5. finance verification
6. cleanup

This sequence matches the agreed Ornet ERP principle:

- keep it simple
- keep it practical
- do not break existing flows
- do not add complexity before it is needed
