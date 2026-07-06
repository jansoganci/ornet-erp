# Proposal / Work Order UI Flow Plan

**Date:** 2026-07-05  
**Project:** Ornet ERP  
**Status:** Completed UI flow reference  
**Purpose:** Define how the agreed Proposal ↔ Work Order product rules should appear in the current Ornet ERP UI without introducing unnecessary complexity.

---

## 1. UI Planning Principle

This plan must reuse existing Ornet ERP surfaces as much as possible.

That means:

- reuse current Proposal detail page,
- reuse current Work Order creation page,
- reuse current Work Order Active / Archive follow-up screens,
- avoid building a big new fulfillment interface in phase 1,
- keep field-team interaction minimal and obvious.

The goal is not to create a new workflow universe.

The goal is to make the current workflow behave correctly and clearly.

---

## 2. Main User Roles In UI Terms

### Office / Admin

Office/admin must be able to:

- create and edit proposals,
- operationally start proposals,
- revise proposals after execution changes,
- inspect linked work orders,
- monitor extra scope and quantity difference,
- finalize commercial truth before finance flow.

### Field Team

Field team must be able to:

- create proposal-linked work orders,
- select only valid accepted/open proposals,
- see proposal scope rows without prices/costs,
- record actual quantities for the current visit,
- add extra material/service rows,
- complete the visit/work order.

### Management

Management mostly needs:

- clear proposal status,
- visit history visibility,
- simple operational summary,
- not a complicated control panel.

---

## 3. Main UI Surfaces To Reuse

Phase 1 should center around these existing surfaces:

1. Proposal detail page
2. Work-order create page
3. Work-order detail page
4. Work-order list:
   - active
   - archive

These are enough for phase 1 if behavior is made clear.

---

## 4. Proposal Detail Flow

### 4.1 Proposal before execution

Proposal detail remains the office/admin commercial control screen.

Before execution starts:

- proposal can be edited using `Düzenle`
- customer-facing scope adjustments before start are normal edit behavior

### 4.2 Proposal action area

Top-right proposal actions should be simplified.

Preferred behavior:

- keep important completion/start actions visible as needed
- move infrequent document-management actions into dropdown

Dropdown should contain:

1. `Düzenle`
2. `Revize Et`
3. `Sil`

### 4.3 Proposal operational summary

Proposal detail should contain a small `operasyon özeti` block.

This should not become a large fulfillment module.

It only needs to show enough for office/admin follow-up.

Suggested summary content:

- latest linked work order / latest visit info
- whether extra scope exists
- whether quantity difference exists
- whether revision is required

### 4.4 Previous version visibility

If proposal was revised:

- proposal detail should show simple previous-version information
- no complex version browser needed

Simple list is enough.

Possible compact fields:

- previous proposal no
- product/row summary
- quantity summary
- unit sales price
- unit cost

---

## 5. Proposal Status / Start Flow

### 5.1 Sent -> accepted

Current business meaning:

- `İşe Başla` means proposal is accepted and operationally ready

UI implication:

- once `İşe Başla` is used,
- proposal becomes selectable in linked work-order creation.

### 5.2 Accepted proposal behavior

Accepted proposals should:

- remain visible to office/admin as active commercial jobs,
- become available to field team in linked WO selection,
- continue until execution and commercial reconciliation finish.

---

## 6. Work-Order Creation Entry

### 6.1 Shared create page, separated meaning

The same create page may be reused.

But the user must clearly choose between two flows:

1. `Bağımsız İş Emri`
2. `Teklife Bağlı İş Emri`

This separation must be obvious early in the create experience.

The user should not feel that linked WO is just a normal WO with one extra dropdown.

### 6.2 Standalone work-order flow

Standalone flow remains:

- unrelated to proposal fulfillment,
- existing operational service flow.

### 6.3 Proposal-linked work-order flow

If user chooses `Teklife Bağlı İş Emri`:

- proposal selector appears/activates,
- only accepted/open/current proposals are shown,
- field team chooses relevant proposal,
- linked item rows load from proposal scope.

---

## 7. Proposal Selector Behavior

### 7.1 Who sees what

Field team may browse the valid proposal pool for this workflow.

For phase 1, they should see proposals that are:

- accepted,
- operationally open,
- current revision,
- not completed.

This is intentionally simple.

No extra customer/site prefilter is required by the product rule set at this stage.

### 7.2 Visual clarity

Proposal dropdown/list should be informative enough to avoid wrong selection.

At minimum, proposal option should show:

- proposal number
- proposal title
- customer
- site / location

This helps field team and office avoid picking the wrong accepted proposal.

---

## 8. Linked WO Item Rows

### 8.1 What field team sees

For proposal-linked work orders, field team should see:

- product/service description
- quoted quantity
- previously completed quantity
- this-visit completed quantity input

They must not see:

- prices
- cost
- margin
- finance data

### 8.2 Display strategy

All proposal rows remain visible.

Rows already completed in earlier visits:

- remain visible as reference
- may appear dimmed / green / completed
- should not confuse the user into thinking they are the active work area

Recommended usability rule:

- remaining/incomplete rows should appear first,
- completed rows should appear below them,
- if the proposal is long, completed rows may be collapsed by default,
- but user must still be able to reveal them for reference.

Rows with remaining quantity:

- remain active/editable
- become the main working rows for the visit

### 8.3 Input strategy

Main action per row:

- enter `this visit completed quantity`

This is the preferred simple model.

No checkbox-only interaction is needed.

### 8.4 Over-entry warning

If entered quantity exceeds the expected amount:

- system warns
- user can understand that they are exceeding proposal scope

The warning should be clear but not overcomplicated.

---

## 9. Extra / Scope-Disi Row UI

### 9.1 Action

There should be a simple button such as:

- `Teklif Dışı Malzeme Ekle`

### 9.2 Input

When clicked:

- material/product list appears
- user selects item
- user enters quantity
- optional note may be added

### 9.3 Visibility

Extra rows should be visually distinguishable from proposal-derived rows.

But the distinction should stay lightweight.

Example:

- small badge,
- different row label,
- `scope dışı` note.

---

## 10. Notes UI

### 10.1 General note

General work-order note area should remain available.

This is important for:

- customer explanations
- installation notes
- IP/system information
- why something was missing or extra

### 10.2 Row note

Row-level note can exist if needed, but should not be mandatory for every row.

Phase 1 should not force too much typing for field team.

---

## 11. Work-Order Completion Flow

### 11.1 Meaning

Completing a proposal-linked work order means:

- this visit is finished

It does not automatically mean:

- the whole proposal job is finished
- the commercial document is reconciled

### 11.2 Completion warning

If quantity difference remains when field team completes the visit:

- system should warn
- but visit completion should still be possible
- office/admin will resolve the commercial side later

This keeps field workflow practical.

---

## 12. Office/Admin Follow-Up After Visit

### 12.1 Main tracking surfaces

Office/admin can follow completed visits through:

- proposal detail operational summary
- work-order active/archive lists
- work-order detail pages

### 12.2 Archive importance

Work-order archive is part of the real tracking model.

Expected usage:

- latest completed linked work orders appear at top
- office/admin reviews what the last visit actually did
- this is enough for practical daily follow-up

### 12.3 When revision is needed

If completed visit created final quantity/scope difference:

- office/admin should use `Revize Et`
- revised proposal becomes new commercial truth
- old proposal remains preserved

Practical warning trigger:

- quantity difference in completed linked WO
- or extra / scope-disi row exists in completed linked WO

---

## 13. Revision UI Flow

### 13.1 Trigger

Revision is used after execution changed commercial reality.

Examples:

- customer accepted fewer units
- extra permanent scope exists
- final commercial quantities differ from original proposal

### 13.2 User expectation

When office/admin uses `Revize Et`:

- current/original proposal content should come forward as base
- user changes quantities/details
- saves revised version

This should feel like:

- “open current commercial truth, update it, save as revised version”

not like building a new proposal from zero.

### 13.3 Save behavior

The save action should clearly communicate revision behavior.

Example expectation:

- `Revizeyi Kaydet`

Result:

- old proposal remains
- new revised proposal is created
- link between them is preserved

---

## 14. Proposal Completion UI Meaning

Proposal completion should not be a field-team concern alone.

Proposal can only be truly completed when:

- visit/work-order process is done
- admin intentionally decides to close the proposal
- final commercial truth is ready

So proposal completion remains primarily an office/admin-controlled closure.

If `revision needed` warning exists:

- system should warn admin at completion time
- but should not block completion
- admin may still complete first and revise later if operationally needed

---

## 15. What Phase 1 Should Not Add

Phase 1 should not add:

- a huge separate fulfillment dashboard
- complicated planning wizard
- deep row-by-row commercial decision trees
- over-detailed field-team forms

If the UI becomes harder to use than today's manual process, the design is failing.

---

## 16. Summary

Phase 1 UI should feel like this:

- office controls commercial truth from proposal
- field team creates proposal-linked visit work orders from accepted/open proposals
- linked rows show full scope without prices
- field team records only actual completed quantity and extra scope
- office/admin monitors latest visit through proposal summary and archive
- if commercial reality changed, office/admin revises proposal simply

This is the intended practical UI direction for Ornet ERP.
