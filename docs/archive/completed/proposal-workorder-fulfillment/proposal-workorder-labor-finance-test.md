

# Proposal / Work Order / Labor / Finance QA Test Checklist

**Status:** Completed QA checklist for Phase 5

## Status Legend

- `[x]` Done
- `[ ]` Pending

---

## 1. Recurring Burden Classification

- [x] Create a recurring expense template with `Personel Yuku` / `labor_burden`.
- [x] Edit the same recurring expense template from `labor_burden` to `general_overhead`, then back to `labor_burden`.
- [x] Verify generated `financial_transactions.burden_type` snapshots the template `burden_type`.
- [x] Create and verify a recurring expense template with `Arac Yuku` / `vehicle_burden`.
- [x] Create and verify a recurring expense template with `Genel Gider` / `general_overhead`.
- [x] Create and verify a recurring expense template with `Siniflandirilmadi` / `unassigned`.

---

## 2. Proposal Tests

- [x] Create a material-only proposal.
- [x] Create a `labor_service`-only proposal.
- [x] Create a mixed proposal with material + `labor_service` + `other` rows.
- [x] Edit an existing material row description and verify `revenue_type` does not silently change to `other`.
- [x] Duplicate proposal test marked not applicable: no duplicate/copy action exists in the current Proposal UI.
- [x] Complete a material-only proposal and verify finance income + mirrored material expense rows.
- [x] Complete a `labor_service` proposal and verify no fake labor expense / COGS row is created.
- [x] Verify proposal Ledger Profit does not subtract `cogs_try` twice. SQL-verified; no per-proposal Ledger Profit UI exists yet.

---

## 3. Work Order Creation / Editing Tests

- [x] Create a standalone parts-only work order.
- [x] Create a standalone service-fee-only work order with no material rows.
- [x] Create a standalone work order with parts + service fee.
- [x] Verify `has_vat` persists on create/edit instead of being inferred only from `vat_rate`.
- [x] Verify proposal-linked work order creation defaults service/service item fields safely.

---

## 4. Work Order Completion / Finance Posting Tests

- [x] Complete a standalone parts-only work order and verify income + material expense posting.
- [x] Complete a standalone service-fee-only work order and verify income posting without dummy material.
- [x] Complete a standalone parts + service fee work order and verify net amount includes both.
- [x] Complete a VAT-enabled standalone work order with cash/card and verify payment row equals net + VAT.
- [x] Complete a VAT-enabled standalone work order with bank transfer and verify no payment row is created and status is unpaid.
- [x] Complete a no-VAT standalone work order with cash/card and verify payment row equals net amount.
- [x] Complete a proposal-linked work order and verify no standalone finance/payment rows are created.

---

## 5. Receivables / Tahsilat Tests

- [x] Verify Receivables shows net, VAT, and gross total correctly.
- [x] Verify Add Payment uses gross collectible total: `amount_try + output_vat`.
- [x] Verify partial payment against a VAT-bearing document marks status as `partial`.
- [x] Verify full payment against a VAT-bearing document marks status as `paid`.
- [x] Verify Tahsilat document totals use gross collectible amount.
- [x] Verify Tahsilat customer summary outstanding amount uses gross collectible amount. SQL-verified 2026-07-06: 8 customers, 0 outstanding mismatches vs gross collectible formula.

---

## 6. Reports / Dashboard / Coverage Tests

- [x] Verify ReportsPage Ledger Profit uses posted income minus posted expense rows. SQL-verified 2026-07-06 (`2026-07`): `v_profit_and_loss` ledger profit matches posted income − expense rows; `ReportsPage.aggregatePL` uses `revenue - expenses`.
- [x] Verify `cogs_try` is informational/export-only and not subtracted twice. SQL-verified 2026-07-06: period has `cogs_on_income > 0`; ledger profit matches income − expenses (not double-subtracted). `ReportsPage` keeps `cogs_try` in gross profit/export only.
- [x] Verify Management Net Profit labels/semantics are clear. Code/i18n verified 2026-07-06: dashboard + reports label ledger profit as `Defter Kârı` with tooltip stating it is not management net profit.
- [x] Verify `v_coverage_reporting_base` returns labor/service revenue rows correctly. SQL-verified 2026-07-06: 3 `proposal_labor_service` + 4 `work_order_service_fee` rows in `labor_revenue`.
- [x] Verify `v_coverage_reporting_base` includes recurring `labor_burden` expenses. SQL-verified 2026-07-06: 1 recurring `labor_burden` row present.
- [x] Verify `v_coverage_reporting_base` includes recurring `vehicle_burden` expenses. SQL-verified 2026-07-06: 1 recurring `vehicle_burden` row present.
- [x] Verify `v_coverage_reporting_base` excludes `general_overhead` from coverage buckets. SQL-verified 2026-07-06: 1 `general_overhead` expense exists; 0 leaked into view.
- [x] Verify `v_coverage_reporting_base` excludes `unassigned` from coverage buckets. SQL-verified 2026-07-06: 30 `unassigned` expenses exist; 0 leaked into view.
- [x] Verify finance dashboard/report query invalidation after proposal/work-order completion. Fixed and manually verified 2026-07-06 after proposal completion invalidation update.

---

## 7. Known Follow-Ups / Out of Scope For Current QA

- [ ] Historical VAT-bearing documents with old net-only payment rows: separate remediation/backfill decision if needed.
- [ ] Tevkifat settlement model: separate finance packet.
- [ ] Standalone work order USD frontend selector: out of scope unless explicitly approved.
- [ ] Recurring Expenses UI polish: missing/unclear column title, column alignment, and category/burden visual boundaries.
