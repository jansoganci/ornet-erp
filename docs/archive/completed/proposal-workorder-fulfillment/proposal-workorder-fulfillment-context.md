# Proposal / Work Order Fulfillment Context

**Date:** 2026-07-04  
**Project:** Ornet ERP  
**Status:** Completed implementation reference  
**Mode:** Discussion / design only. No implementation in this document.  

---

## 1. Why This Document Exists

This note exists so the Proposal ↔ Work Order discussion does not stay in chat only.

The goal is to preserve:

- the current business reality,
- the actual pain points,
- the decisions already made,
- the still-open product questions,
- the intended direction for Ornet ERP.

This is not an enterprise-theory document.

The target is a system that is:

- simple,
- traceable,
- safe,
- not over-engineered,
- usable by field team, office, and management,
- suitable for Ornet ERP's real operating style.

---

## 2. Core Business Reality

### Proposal

Proposal is:

- the commercial offer given to the customer,
- commercially binding for Ornet,
- the quoted scope and pricing document,
- a living business document until the job is delivered,
- after delivery, finance/tahsilat continues the money collection process.

Proposal is not just an initial sales intention.

Normally, proposal rows represent the real commercial agreement.

However, in real operations:

- customer may reduce quantity,
- fewer products may be installed than quoted,
- more products may be installed than quoted,
- extra material/service may be needed on site,
- some changes may require proposal revision.

### Work Order

Work Order is:

- a visit record,
- a service form,
- a "what happened that day" document,
- not the commercial source of truth.

For normal standalone service jobs, this is already conceptually fine.

The real challenge starts when a work order is related to a proposal.

---

## 3. The Actual Problem

Proposal creation is not the problem.

Standalone work order creation is not the problem.

The real problem is:

- one proposal may require multiple visits,
- each visit must have its own work order / service form,
- the field team may complete only part of the quoted scope in one visit,
- the field team may install less than quoted,
- the field team may install more than quoted,
- the field team may need to add extra scope,
- the office must be able to understand and reconcile all of that without chaos,
- finance must not double-post revenue.

In plain language:

> We need Proposal and Work Order to be connected strongly enough to track the job, but separated cleanly enough so field execution does not silently corrupt the commercial document.

---

## 4. What Is Already Decided

The following points are now effectively settled unless product direction changes later.

### 4.1 Proposal role

Proposal is:

- the commercial source of truth,
- owned by office / center,
- something the field team should not manage commercially.

### 4.2 Work order role

Work Order is:

- a visit-level execution record,
- based on what was actually done,
- not a planning/configuration document,
- not something field team should structurally redesign.

### 4.3 Field team permissions

Field team:

- should not see price, sales amount, or cost,
- should only see product/service rows and quantities,
- should be able to record actual quantities,
- should be able to say a row was not completed,
- should be able to add extra / scope-disi rows,
- should not manage proposal pricing logic.

### 4.4 Proposal-linked work orders and finance

Proposal-linked work orders must:

- never create revenue posting,
- never create VAT posting,
- never create automatic finance records,
- exist for fulfillment / visit tracking only.

Commercial revenue belongs to the proposal.

If proposal changes commercially, the proposal process handles that.

### 4.5 Legacy support

Old proposal-linked work orders are not the priority.

Forward correctness matters more than perfect historical reconstruction.

Practical stance:

- legacy data can be treated as legacy,
- new system behavior should be correct going forward.

---

## 5. Proposal-Linked Work Order Creation Direction

### Current decision

Proposal is created only by office / center.

However:

- field team should be able to create proposal-linked new work orders,
- but only from visible, valid proposals,
- and only for proposals that are accepted, current, and not completed.

### Current working UX idea

In the current system there is already a proposal-linking field while creating work order.

The direction now is:

- field team can open work order creation,
- field team should only see all valid `accepted + current + not completed` proposals,
- field team selects the related proposal from there.

Important practical nuance:

- there may be multiple active proposals,
- field team should see the full valid operational pool,
- but only within the technical rule:
  - accepted
  - current revision
  - not completed

### Meaning of `İşe Başla`

Current product understanding:

- `İşe Başla` means the proposal has been accepted and is now operationally ready,
- for system behavior, this corresponds to proposal status becoming `accepted`.

So, in practice:

- field team should only see proposal-linked candidates that are in `accepted` status,
- only the current revision should be selectable,
- completed proposals should not appear as new linked WO candidates,
- `İşe Başla` is the business gate that opens the proposal to linked work-order creation.

This is currently the preferred direction instead of forcing all linked WO creation to start only from proposal detail page.

Reason:

- it matches operational reality better,
- field team may need to create the next visit form in the field,
- office should not be a bottleneck for every follow-up visit.

---

## 6. How Proposal Rows Should Appear In Linked Work Orders

Current preferred direction:

- all proposal scope should be visible in linked work order,
- already completed parts should still be visible,
- completed rows can be shown visually as:
  - green,
  - dimmed,
  - marked completed,
- but they should remain visible.

Reason:

- field team needs to know what the proposal originally included,
- field team should not guess what products belong to the job,
- work order should act as a usable field reference,
- but without exposing price/cost.

Also needed:

- a note area,
- ability to mark actual installed quantity,
- ability to indicate incomplete rows,
- ability to add extra scope row when the proposal did not contain the needed item.

### Preferred simple row behavior

Checkboxes are not needed.

Current preferred row behavior for field team:

- show product/service row,
- show quoted quantity,
- show previously completed quantity,
- show `this visit completed quantity` as the main input.

Example:

- Camera
- Quoted: `5`
- Previously completed: `0`
- This visit completed: `[ 3 ]`

This is currently considered the simplest and clearest model.

Reason:

- the company needs quantity-based execution tracking,
- checkbox-only behavior would be too weak,
- this model is understandable for field team,
- and still gives office/admin enough usable data.

### Over-entry warning

If field team enters more than the quoted/expected amount:

- system should warn clearly,
- for example: `Teklifteki miktardan fazla giriş yapıyorsunuz, emin misiniz?`

This should remain a simple warning-based flow, not a heavy enterprise validation maze.

### Extra scope row input should stay minimal

There should be a simple button such as:

- `Teklif Dışı Malzeme Ekle`

When pressed:

- show product list,
- no price/cost shown,
- user selects product,
- enters quantity,
- optional note explains why it was needed.

General work-order note area should also remain available for:

- installation notes,
- customer notes,
- IP / system information,
- final field explanation.

This should stay simple.

The point is not advanced allocation theory.

The point is:

- show all planned scope,
- let field team record actual execution,
- let office/admin reconcile differences later.

---

## 7. Quantity / Fulfillment Thinking

### Quantity basis

Fulfillment should be quantity-based, not only row-based.

Example:

- proposal says `8 cameras`,
- first visit installs `5`,
- system should still understand `3 remaining`.

### Remaining logic

Current thinking:

- until field team presses final completion / work finished action, remaining quantity should stay visible,
- if work order is marked complete while quantity difference remains, the system should warn,
- after that, office/admin becomes responsible for the commercial/fulfillment decision.

### Simple interpretation

Field team records:

- what got installed,
- what did not,
- what extra appeared.

Office/admin later decides:

- continue in another visit,
- revise proposal,
- or close remaining scope in a controlled business way.

---

## 8. Extra / Scope-Disi Work

This is real and frequent.

Examples:

- extra cable,
- extra outlet / priz work,
- extra material,
- extra mounting/service effort.

### Current decision direction

Extra rows should be allowed by:

- field team,
- office/admin.

### Important rule

Extra row should not silently change the proposal automatically.

Instead, the system should:

- mark it as extra / scope-disi,
- keep it in work order,
- surface it for office review,
- let office decide whether commercial revision is needed.

### Commercial outcome

If extra scope must become billable:

- proposal should be revised,
- or a new/revised proposal should be created,
- and finance should flow through the revised commercial document,
- not through the work order directly.

This matches current manual company behavior better.

---

## 9. Proposal Revision Logic

Current real-life company logic:

- existing proposal is pulled to cancel/revise state,
- note is written,
- a new proposal is created,
- the new one explains why quantities were revised,
- invoicing goes through the revised proposal.

### Current design intention

The new system should likely stay close to this existing operational habit.

Meaning:

- do not invent a super-complex revision engine,
- do not auto-rewrite proposal from field events,
- keep revision explicit and office-controlled.

### Edit and Revise must be different actions

`Düzenle` and `Revize Et` should not mean the same thing.

#### `Düzenle`

`Düzenle` should be used for:

- before work starts,
- when proposal was sent and customer wants a normal pre-start change,
- when there is a simple mistake,
- when proposal has not yet become an active execution-linked job.

Typical examples:

- wrong line entered,
- wrong quantity before installation starts,
- customer asks for a normal pre-start adjustment,
- proposal was not yet operationally used.

#### `Revize Et`

`Revize Et` should be used for:

- after work has started,
- when actual installed quantities differ from proposal quantities,
- when extra scope becomes part of the final commercial result,
- when commercial truth must change because execution reality changed.

Typical examples:

- quoted 8, installed 5 because customer insisted,
- extra permanent material was installed,
- final billable scope changed after field execution began.

### Proposal detail top-right actions should be simplified

Current preferred UI direction:

- use a dropdown menu for less-frequent proposal actions,
- instead of keeping all of them exposed as top-right standalone buttons.

Preferred order inside dropdown:

1. `Düzenle`
2. `Revize Et`
3. `Sil`

Reason:

- these actions matter,
- but they are not the fastest repeat-action buttons in daily use,
- dropdown keeps proposal detail cleaner.

### Existing work orders

Already-created or completed work orders should remain frozen snapshots.

They should not mutate because proposal changed later.

### Practical rule

Likely simplest model:

- old WO stays as historical truth,
- revised proposal becomes the new commercial truth,
- future follow-up work references the revised proposal state,
- past work orders are not altered.

This direction is currently considered sensible and non-overcomplicated.

### Old proposal version should be preserved simply

Old proposal version should stay in the system.

But this should be implemented in the simplest possible way.

Current preferred approach:

- keep old proposal row,
- create a new revised proposal row,
- connect them with a simple field such as:
  - `revised_from_proposal_id`

This is enough for current needs.

No heavy snapshot/versioning engine is required.

### Previous version visibility can stay simple

Proposal detail should ideally show previous version information in a simple form.

It does not need to be complex.

Even a basic list is enough.

Useful compact comparison fields:

- product list,
- quantity,
- unit sales price,
- unit cost.

Goal:

- easy traceability,
- not a complicated revision browser.

---

## 10. Completion Meaning

### Work order completed

Work order completion means:

- that visit is finished.

It does not automatically mean:

- the full proposal/job is finished,
- the commercial scope is fully reconciled.

### Proposal completed

Proposal completion should mean:

- the real job is finished,
- linked work order process is finished,
- admin has explicitly used the proposal completion action,
- then finance flow proceeds based on final commercial document.

Simple interpretation:

- proposal does not auto-complete because a linked visit ended,
- proposal completion remains an office/admin-controlled decision,
- if quoted quantities and actual final quantities match, proposal can close normally,
- if they differ or extra scope exists, proposal detail should warn that revision may be needed,
- but this warning should not block completion.

---

## 11. Office / Admin Needs

Office/admin must be able to see, ideally inside proposal context:

- what was quoted,
- what has been completed,
- what is still remaining,
- what extra scope appeared,
- which visits/work orders have happened,
- whether revision is needed.

Current product intuition:

- a separate huge enterprise-style module is not wanted,
- if possible, proposal detail itself should show enough fulfillment visibility.

### Proposal detail can contain a small operational summary

A large separate fulfillment module is not required.

Current preferred direction:

- proposal detail may contain a small `operasyon özeti` block,
- just enough for office/admin to understand what happened operationally,
- without turning proposal detail into a giant extra workflow.
- at this stage, this lightweight summary is considered sufficient instead of building a separate dedicated fulfillment module.

Useful content for this lightweight summary:

- last linked work order / latest visit info,
- was extra scope entered,
- is revision required,
- was the job finished cleanly or with quantity difference.

Current practical interpretation of `revision required`:

- at least one completed linked work order ended with quantity difference,
- or at least one completed linked work order contains extra / scope-disi rows.

What office needs most:

- teklif edilen,
- ne kadar tamamlandı,
- ne kadar kaldı,
- extra scope var mı,
- varsa ne var.

That is enough for a practical Ornet-style control panel.

### Work order Active / Archive is also part of the tracking model

Office/admin should also use the work-order list itself as a practical tracking point.

Current expectation:

- active/archive work-order areas remain part of the operational follow-up flow,
- completed linked work orders can be checked from archive,
- latest completed visits should naturally appear at the top through normal work-order ordering,
- proposal detail does not need to carry all visit-history responsibility by itself.

---

## 12. Management / Reporting Need

Management wants simple visibility, not over-modeled theory.

Useful future reporting targets:

- quoted vs actual,
- was there extra scope,
- what was the extra scope,
- fulfillment percentage,
- operational inefficiency / sapma.

Example future use case:

- job was planned as 4 visits,
- it actually took 6 visits,
- proposal amount stayed the same,
- the extra 2 visits are an operational loss.

This is not today's finance engine requirement.

This is future operational analysis intent.

That is why linked work orders still matter even if they do not create finance records.

---

## 13. The Most Important Design Principle

Do not overcomplicate this.

This system is for a very manual, practical company that wants:

- fewer manual follow-ups,
- less chaos,
- ERP visibility,
- operational traceability,
- safer data,
- but not heavy enterprise complexity.

The target is not "world-class abstract workflow modeling."

The target is:

- simple,
- realistic,
- not fragile,
- easy to operate,
- useful in daily life.

---

## 14. Remaining Open Area

The core phase-1 product rules are now largely settled.

The main non-blocking future-facing area is:

1. How far linked WO operational signals should later feed deeper operational costing/reporting beyond today's basic visibility.

---

## 15. Current Working Conclusion

The current best-fit direction for Ornet ERP is:

- Proposal remains the commercial source of truth.
- Work order remains a visit/service-form execution record.
- Proposal-linked work orders can be created by field team.
- Field team should see all `accepted + current + not completed` proposals when linking.
- Linked work orders should show proposal scope rows without price/cost.
- Field team records actual quantities and extra scope.
- Extra scope does not silently rewrite proposal.
- Office/admin decides whether proposal revision is needed.
- If quantity difference or extra scope exists after a completed linked visit, proposal detail should show `revize gerekli` style warning.
- Proposal completion stays manual for admin and warning-based, not blocked by revision-needed state.
- If commercial outcome changes, revised proposal becomes the billing basis.
- Proposal-linked work orders never generate finance records.
- The whole design should stay practical, visible, and simple.

This document should be treated as the active product-context baseline for further planning discussions.
