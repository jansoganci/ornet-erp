# Module 1.5: Auto-Revenue Recording (Revised)

**Status:** Implemented  
**Created:** 2026-02-12  
**Revised:** 2026-02-12 — SIM cards removed, scope = proposal + work order only  
**Ref:** [sim-card-system-redesign.md](sim-card-system-redesign.md) for SIM cards (Module 1.6+)

---

## Scope

1. **Proposal completed** → auto-record financial_transaction
2. **Work order completed** (standalone only) → auto-record financial_transaction

SIM cards handled separately — see [sim-card-system-redesign.md](sim-card-system-redesign.md).

---

## When Does Finance Get Updated?

| Source | When | How |
|--------|------|-----|
| **Work order** | User clicks Done on work order | Auto (only if WO has no proposal link) |
| **Proposal** | When the last work order is marked Done (proposal becomes "completed") | Auto via DB trigger |
| **Subscriptions** | User records payment in subscription detail | Already automatic |

---

## Implementation

### Part 1: Proposal Auto-Record (DB Trigger)

**Trigger:** Proposal status becomes `completed` (via existing DB trigger when last work order is done)

**Action:** Create `financial_transaction`:
- direction = 'income'
- income_type = 'sale'
- proposal_id linked
- amount_original = proposal.total_amount_usd
- original_currency = 'USD'
- amount_try = amount_original × exchange_rate (latest USD)
- cogs_try from proposal_items
- customer_id, site_id from proposal
- should_invoice = true
- transaction_date = today

**File:** `00045_auto_revenue_proposal_completed.sql`

---

### Part 2: Work Order Auto-Record (DB Trigger)

**Trigger:** Work order status becomes `completed` **AND** proposal_id IS NULL

**Action:** Create `financial_transaction`:
- direction = 'income'
- income_type = 'service'
- work_order_id linked
- amount_original = work_order.amount
- amount_try = converted if USD
- No COGS (standalone WO)
- customer_id, site_id from work order
- should_invoice = true

**File:** Same migration

---

## Rules

1. **No duplicates:** Check if transaction already exists before creating
2. **Proposal-linked WO:** Do NOT create transaction (proposal trigger handles it)
3. **Standalone WO:** Create transaction
4. **Error handling:** Log errors in trigger, don't break status update (use EXCEPTION block)

---

## Deliverables

- [x] Migration 00045 with 2 triggers
- [x] Proposal completed → auto financial_transaction
- [x] Standalone WO completed → auto financial_transaction
- [x] Proposal-linked WO completed → NO transaction (avoid double-count)

---

## SIM Cards — Separate (Module 1.6+)

SIM card revenue logic deferred. See [sim-card-system-redesign.md](sim-card-system-redesign.md).
