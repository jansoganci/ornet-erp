# Proposal / Work Order Phase 5 Finance Safety Checklist

**Date:** 2026-07-06  
**Status:** Completed verification checklist  
**Purpose:** Verify that proposal-linked work orders remain operational-only for finance, while standalone work orders and proposal completion continue to post finance correctly.

## 1. Proposal-Linked Work Order Completion

Expected result:

- linked WO can move from `in_progress` to `completed`
- no income row is created in `financial_transactions`
- no payment row is created in `financial_transaction_payments`
- no receivable/payment-status side effect appears

Check:

1. Open a proposal-linked work order.
2. Move it to `in_progress`.
3. Complete it from the detail screen.
4. Confirm the work order is archived as completed.
5. Confirm no new `financial_transactions.work_order_id = <linked_wo_id>` row exists.
6. Confirm no new `financial_transaction_payments` row exists for that work order.

## 2. Standalone Work Order Completion With Cash/Card

Expected result:

- standalone WO must complete through the completion modal
- one income row is created
- one payment row is created
- payment status becomes `paid`

Check:

1. Create a standalone work order with positive billable total.
2. Move it to `in_progress`.
3. Complete it with `Nakit` or `Kredi Kartı`.
4. Confirm one income row exists in `financial_transactions`.
5. Confirm one payment row exists in `financial_transaction_payments`.
6. Confirm the income row payment status is `paid`.

## 3. Standalone Work Order Completion With Bank Transfer

Expected result:

- one income row is created
- no immediate payment row is created
- payment status becomes `unpaid`

Check:

1. Create a standalone work order with positive billable total.
2. Move it to `in_progress`.
3. Complete it with `Havale / EFT`.
4. Confirm one income row exists in `financial_transactions`.
5. Confirm no immediate `financial_transaction_payments` row exists.
6. Confirm the income row payment status is `unpaid`.

## 4. Standalone Completion Bypass Guard

Expected result:

- standalone WO cannot be completed via the generic status-update path
- completion must use the payment modal / RPC path

Check:

1. Try any generic standalone completion path that bypasses the completion modal.
2. Confirm the app blocks the action and shows the payment-flow warning.

## 5. Proposal Completion

Expected result:

- proposal revenue posts only when the proposal is completed
- proposal-linked work orders do not create duplicate commercial revenue
- proposal COGS respects `revenue_type`

Check:

1. Complete an accepted proposal.
2. Confirm proposal income row(s) are created.
3. Confirm linked WO completion did not already create the same revenue.
4. Confirm `labor_service` and `other` rows do not create material COGS.

## 6. Proposal Revision Finance Safety

Expected result:

- revising an accepted proposal creates no finance row by itself
- revising a completed proposal preserves existing finance rows
- completed -> revised does not auto-reverse finance rows

Check:

1. Revise an accepted proposal and confirm no new finance row appears.
2. Revise a completed proposal and confirm existing finance rows remain intact.
3. Confirm no automatic reversal row appears solely because status became `revised`.
