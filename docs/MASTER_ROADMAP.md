# Ornet ERP — Master Roadmap to Production Ready

> Working Protocol: Consultation → Refinement → APPROVED → Execution.
> No code is written without an explicit APPROVED from the Lead Architect.

---

## Section 1 — Technical Hardening

| # | Task | Status | Priority |
|---|------|--------|----------|
| 1 | **DB Schema Validation** — Add `NOT NULL` and `CHECK` constraints at the database level so no rogue API call can insert corrupt data | ⬜ Pending | 🔴 High |
| 2 | **Proposals View Optimization** — Refactor `proposals_detail` view using `LATERAL JOIN`s + trigram indexes, mirroring the `work_orders_detail` fix | ⬜ Pending | 🔴 High |
| 3 | **Atomic Subscription Actions** — Move `pauseSubscription` / `cancelSubscription` to Postgres RPCs (`fn_pause_subscription`, `fn_cancel_subscription`) with transaction safety | ⬜ Pending | 🔴 High |
| 4 | **Query Timeouts** — Implement `statement_timeout` for long-running queries; protect the DB from runaway requests at scale | ⬜ Pending | 🟡 Medium |
| 5 | **DB Testing Foundation** — Set up pgTAP (or equivalent) migration test suite so every future migration is verified before hitting production | ⬜ Pending | 🟡 Medium |

---

## Section 2 — Functional Features

| # | Task | Status | Priority |
|---|------|--------|----------|
| 6 | **Customer Situation Board** ⭐ — Health-status dashboard showing Critical / Warning / Healthy per customer; the single most important operational view | ⬜ Pending | 🔴 High |
| 7 | **Equipment Lifecycle** — Track maintenance schedules and expiry dates for site assets; alert when service is overdue | ⬜ Pending | 🟡 Medium |
| 8 | **Price Revision Timeline** — Full historical log and notes for every subscription price change; visible on the subscription detail page | ⬜ Pending | 🟡 Medium |
| 9 | **Advanced Finance Dashboard** — Rich charts: monthly P&L trend, revenue by customer segment, expense breakdown, cash flow projection | ⬜ Pending | 🟡 Medium |
| 10 | **Inventory Alerts** — Automatic notifications when material stock drops below threshold; integrated with the existing notifications system | ⬜ Pending | 🟢 Low |

---

## Completed — Previous Sprint

| Task | Migration | Completed |
|------|-----------|-----------|
| RLS fix — tasks policies + `security_invoker` on view | 00097 | ✅ |
| Atomic payment recording RPCs | 00098 | ✅ |
| Subscriptions list pagination | — | ✅ |
| SIM cards pagination + trigram indexes | 00099 | ✅ |
| Work orders view optimization (LATERAL + trgm indexes) | 00100 | ✅ |
| Work orders list pagination | — | ✅ |

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ⬜ Pending | Not started |
| 🔄 In Progress | Consultation / Refinement underway |
| ✅ Complete | Approved + implemented |
| 🔴 High | Do first |
| 🟡 Medium | Do after High items |
| 🟢 Low | Nice to have |
