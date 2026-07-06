# Proposal / Work Order Product Rules

**Date:** 2026-07-05  
**Project:** Ornet ERP  
**Status:** Completed reference  
**Purpose:** Convert the fulfillment discussion into short, binding product rules before technical design and implementation planning.

---

## 1. Scope

These rules define how Proposal and Proposal-linked Work Order should behave in Ornet ERP.

This document is intentionally short and practical.

It does not describe implementation details.

---

## 2. Core Model

### 2.1 Proposal

Proposal is:

- the commercial source of truth,
- the quoted and binding scope given to the customer,
- owned commercially by office / center,
- active until the job is delivered and commercially finalized.

### 2.2 Work Order

Work Order is:

- a visit record,
- a service form,
- an operational execution record,
- not the commercial source of truth.

### 2.3 Proposal-linked Work Order

A proposal-linked work order is:

- a visit-level execution record connected to a proposal,
- not a separate commercial document,
- not a revenue-producing finance document.

---

## 3. Creation Rules

### 3.1 Proposal creation

Proposal is created and managed by office / center only.

### 3.2 Linked work-order creation

Field team may create proposal-linked work orders.

Office/admin may also create them when needed.

They must only be able to choose from proposals that are:

- operationally started,
- accepted/approved,
- still open.

For phase 1, this should be interpreted simply as:

- all `accepted + current + not completed` proposals are selectable,
- field team does not need extra customer/site prefiltering in this rule set.

Current business meaning:

- `İşe Başla` = proposal becomes operationally available
- operationally available proposal = `accepted`

Phase 1 canonical creation path:

- proposal is still created and owned by office,
- proposal-linked visit work orders are created through the work-order creation flow,
- field team and office/admin may use that same linked-WO creation flow,
- there is no separate heavy office-only planning module required in phase 1.

UI rule:

- even if the same create screen is reused,
- user must see a clear choice between:
  - `Bağımsız İş Emri`
  - `Teklife Bağlı İş Emri`

The shared screen must not make these two concepts feel like the same workflow.

### 3.3 Standalone work-order creation

Standalone work order behavior remains separate.

Standalone work orders and proposal-linked work orders should not be mixed conceptually.

---

## 4. Visibility Rules For Field Team

Field team must not see:

- sales price,
- sales totals,
- cost,
- margin,
- commercial finance details.

Field team may see:

- proposal-linked product/service rows,
- quoted quantity,
- previously completed quantity,
- this-visit completed quantity,
- notes needed to perform the job.

---

## 5. Linked Work-Order Row Behavior

### 5.1 Default row display

In a proposal-linked work order:

- all proposal scope rows should be visible,
- already completed rows should still be visible,
- completed rows may be shown visually as dimmed/green/completed.

More specifically:

- all proposal rows remain visible for field reference,
- rows that are fully completed from previous visits should be read-only reference rows,
- rows that still have remaining quantity should be the main editable rows for the current visit.

Preferred usability behavior:

- remaining/incomplete rows should appear first,
- previously completed rows should be visually secondary,
- if the proposal is long, completed rows may be collapsed by default,
- but completed rows must still remain accessible as reference.

### 5.2 Main row input

Each row should use quantity input, not checkbox logic.

Preferred field logic:

- quoted quantity
- previously completed quantity
- this-visit completed quantity

Meaning of these values:

- `quoted quantity` = proposal's current commercial quantity for that row
- `previously completed quantity` = cumulative completed quantity from earlier completed linked work orders for the same proposal
- `this-visit completed quantity` = quantity entered for the current visit/work order

The system should derive:

- remaining quantity = quoted quantity - previously completed quantity - current visit entered quantity

Product intent:

- field team sees full context,
- but only works on what is still incomplete,
- while past completed work stays visible as reference.

### 5.2.1 Row lineage is required

Proposal-linked fulfillment must have row-level source linkage.

In practical terms, each proposal-derived work-order row must be traceable back to its source proposal row.

Without this linkage:

- previously completed quantity cannot be trusted,
- remaining quantity cannot be trusted,
- per-row fulfillment cannot be trusted,
- revision/reconciliation becomes too fragile.

So row-level linkage is not a future nice-to-have.

It is a phase 1 requirement.

### 5.3 Over-entry

If user enters more than expected quantity:

- system should warn clearly,
- but this should stay a simple warning flow.

---

## 6. Extra / Scope-Disi Rows

### 6.1 Permission

Extra / scope-disi rows may be added by:

- field team,
- office/admin.

### 6.2 UI behavior

There should be a simple action such as:

- `Teklif Dışı Malzeme Ekle`

User should:

- select material/product,
- enter quantity,
- optionally write note.

### 6.3 Business rule

Extra row must not silently modify the proposal.

Extra row must be treated as:

- operational reality first,
- commercial decision pending if needed.

---

## 7. Notes

The system should support:

- general work-order note,
- operational field notes,
- customer explanation notes,
- technical notes such as IP/system information.

Row-level note may exist if needed, but general note is the minimum required behavior.

---

## 8. Quantity Difference Rules

If actual installed quantity differs from proposal quantity:

- field team records actual quantity,
- work order may still be completed as a visit,
- office/admin becomes responsible for the commercial resolution.

If a completed linked work order has:

- quantity difference,
- or extra / scope-disi rows,

proposal detail should show a `revision needed` style warning for office/admin follow-up.

Quantity-based fulfillment is the preferred model.

---

## 9. Edit vs Revise

### 9.1 Edit

`Düzenle` is for:

- pre-start changes,
- customer-requested changes before execution starts,
- normal corrections,
- non-execution-stage modifications.

### 9.2 Revise

`Revize Et` is for:

- after work has started,
- when actual execution changed commercial reality,
- when quantity/scope changed after field execution began,
- when a new final commercial version is needed.

---

## 10. Revision Rules

### 10.1 Revision outcome

If commercial reality changed:

- proposal should be revised,
- revised proposal becomes the new commercial truth,
- invoicing/finance should follow the revised proposal.

### 10.2 Previous version retention

Old proposal version should remain in the system.

Simple version-chain approach is preferred.

Example:

- `revised_from_proposal_id`

### 10.3 Existing work orders

Existing/completed work orders remain frozen snapshots.

Proposal revision must not mutate old work orders.

---

## 11. Completion Rules

### 11.1 Work-order completion

Work-order completion means:

- that visit is finished.

It does not automatically mean:

- the whole proposal/job is finished.

### 11.2 Proposal completion

Proposal completion means:

- job is operationally finished,
- linked work-order process is finished,
- admin has explicitly used the completion action,
- final commercial document is ready for finance flow.

Important practical rule:

- revision-needed state should warn,
- but should not block admin from marking proposal completed.

---

## 12. Finance Rules

Proposal-linked work orders must:

- never post revenue,
- never post VAT,
- never create automatic finance records.

Proposal remains the finance-bearing commercial document.

If extra scope becomes billable:

- finance should flow through revised proposal,
- not through linked work order.

---

## 13. Tracking Rules

### 13.1 Proposal detail

Proposal detail may include a small operational summary.

This summary is preferred over a large separate fulfillment module at this stage.

### 13.2 Work-order list

Office/admin should also use Work Order Active / Archive areas as part of operational follow-up.

Completed visits can be checked there.

Latest completed visits should naturally appear at the top through normal ordering.

---

## 14. Reporting Intent

In the future, management should be able to see:

- quoted vs actual,
- extra scope existence,
- extra scope content,
- fulfillment percentage,
- operational inefficiency such as extra visits.

This is a future operational analysis goal, not an immediate finance-posting requirement.

---

## 15. Simplicity Principle

This system must stay:

- practical,
- understandable,
- low-friction,
- not enterprise-heavy,
- suitable for a manual but fast-moving company.

If a rule makes the workflow harder to use without clear daily benefit, it should be reconsidered.
