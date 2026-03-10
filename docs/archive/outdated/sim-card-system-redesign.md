# SIM Card System — Revenue & Finance Integration (Future)

**Status:** Deferred — to be handled in Module 1.6 or later  
**Ref:** Module 1.5 scope change — SIM cards removed from auto-revenue plan

---

## Context

SIM card revenue logic is complex and needs separate research and discussion before implementation. Handle SIM cards after Module 1.5 (proposal + work order auto-revenue) is complete.

---

## Complexity

- **Active SIM:** Revenue (sale_price × count) + Cost (operator fees, etc.)
- **Inactive SIM:** Only Cost (may still incur operator charges)
- **Subscription-linked SIMs:** Some SIMs may be covered by `subscriptions.line_fee` — avoid double-counting
- **Bulk rental vs per-subscription:** Different revenue flows

---

## Data model (current)

- `sim_cards`: `customer_id`, `site_id`, `status` ('available','active','inactive','sold'), `sale_price`, `cost_price`, `currency`
- No `subscription_id` FK — sim_cards and subscriptions are separate per spec

---

## Proposed direction (for future implementation)

### Option A: "Record monthly revenue" button
- User clicks "Aylık gelir kaydet" on SIM Cards page
- Select period (YYYY-MM)
- System: `SELECT customer_id, site_id, COUNT(*), SUM(sale_price) FROM sim_cards WHERE status='active' AND customer_id IS NOT NULL GROUP BY customer_id, site_id`
- Create 1 `financial_transaction` per (customer, site) with income_type='sim_rental'

### Option B: Cron / scheduled job
- Monthly job creates transactions automatically
- Same logic as Option A

### Option C: Per-card activation trigger
- When sim_card status changes to 'active', create transaction? (Complex — would need prorating, recurring, etc.)

---

## Open questions

1. Active vs inactive — does inactive still generate cost? Revenue?
2. Prorating — if card activated mid-month, full or partial revenue?
3. subscription_id link — should we add FK to avoid double-count with line_fee?
4. Operator costs — separate expense flow?

---

## Next steps

- Complete Module 1.5 (proposal + work order triggers)
- Research and document SIM card business rules
- Implement in Module 1.6 when requirements are clear
