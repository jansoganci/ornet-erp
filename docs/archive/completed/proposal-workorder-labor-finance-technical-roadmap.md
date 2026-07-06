# Proposal / Work-Order Labor Finance Technical Roadmap

**Date:** 2026-07-02  
**Project:** Ornet ERP  
**Scope:** Technical roadmap only. No code, migration, or UI implementation in this document.  
**Business source of truth:** `docs/active/proposal-workorder-labor-finance-refactor-plan.md`

---

## Status Update

### Phase 1 status

- Phase 1: `DONE`
- Changed file: `src/features/finance/ReportsPage.jsx`
- Fix: ReportsPage ledger profit no longer subtracts `cogs_try` twice
- New formula: posted income rows - posted expense rows
- Build passed
- Lint failed due to pre-existing unrelated repo errors
- Proposal, work order, DB, VAT, service fee, `revenue_type`, and planned labor were not touched

### Current implementation focus

- Phase 1: `DONE`
- Phase 2: `DONE`
- Phase 3: `DONE`
- Phase 4: `DONE`
- Current focus after Phase 4: `Phase 5` optional historical review only
- Follow-up items remain separate:
  - historical remediation / backfill review
  - withholding / tevkifat settlement modeling
  - field coverage UI/report shipping beyond the current foundation

---

## 1. Executive Summary

### What will be changed

- Proposal items will gain an explicit revenue-side classification field: `revenue_type`
- Proposal and standalone work-order VAT handling will be made explicit at the source record level:
  - `has_vat`
  - `vat_rate`
  - net amount
  - VAT amount
  - gross amount
- Standalone work orders will gain a DB-backed service/labor fee that follows the app's existing TRY/USD currency pattern
- Proposal planned operational labor cost will remain storable on proposal items, but treated as operational-only data
- Standalone work orders will gain planned operational labor cost storage that is separate from service revenue and separate from ledger expense
- `work_orders.amount` will be treated as legacy/unsafe and will not be reused for service fee, planned labor cost, or canonical totals
- Proposal finance posting will be cleaned so ledger COGS includes only real material/product cost
- Standalone work-order finance posting will be updated so service fee increases total customer revenue without creating a labor expense
- Finance reporting will be corrected so Ledger Profit uses posted income minus posted expense rows and does not double-subtract `cogs_try`
- A future Labor Coverage foundation will be created from:
  - proposal `labor_service` revenue
  - work-order service/labor fee revenue
  - recurring Labor Burden
- A future Field Coverage foundation will be enabled from:
  - labor/service revenue
  - recurring Labor Burden
  - recurring Vehicle Burden
- Future recurring expense burden tagging will be planned without redesigning recurring expenses now

### What will not be changed

- No planned operational labor cost from proposals/work orders will post to `financial_transactions`
- No planned operational labor cost from proposals/work orders will populate `cogs_try`
- No planned operational labor cost from proposals/work orders will create an expense row
- No estimated fuel/misc/vehicle burden per job
- No payroll allocation by technician/hour
- No activity-based costing
- No enterprise overhead allocation
- No recurring expense redesign
- No SIM finance changes
- No historical backfill or automatic finance rewrite in phase one

### Recommended implementation order

1. Confirm open questions
2. Fix reporting double-subtract behavior
3. Add proposal `revenue_type` and clean proposal trigger COGS logic
4. Add currency-aware work-order service fee and update standalone WO revenue posting
5. Split KPI/report semantics and prepare Labor Coverage / Field Coverage foundations
6. Optionally review historical inconsistencies later, without automatic backfill

---

## 2. Clarified Decisions And Remaining Open Questions

### Confirmed answers

1. `revenue_type` does not decide whether a line is revenue.
   - All billed proposal lines remain customer revenue.
   - `revenue_type` only classifies revenue internally:
     - `material`
     - `labor_service`
     - `other`

2. `revenue_type` must be stored in the database.
   - It is company reporting data, not UI-only inference.

3. Work-order service fee must support currency properly.
   - TRY-only planning is rejected.
   - The roadmap should follow the repo's existing dual-column currency pattern.

4. Operational reporting should remain VAT-exclusive.
   - Customer-facing totals may still include VAT where current UI does so.
   - Stored VAT rate/base should be clear enough that reports do not need to guess later.
   - `vat_rate > 0` is not enough as the long-term source model; roadmap should explicitly carry `has_vat` and source-level VAT/net/gross semantics.

5. Labor Coverage and Field Coverage are future reporting concepts.
   - `Labor Coverage = labor/service revenue - Labor Burden`
   - `Field Coverage = labor/service revenue - Labor Burden - Vehicle Burden`

6. Planned operational labor cost is valid business data, but it is not a ledger expense.
   - It should be stored on proposals/work orders for analysis.
   - It must not flow into `financial_transactions`.
   - It must remain separate from service revenue.

7. Proposal `labor_cost` fields may continue as the proposal-side storage for planned operational labor cost.
   - Do not rename DB columns in phase one.
   - Do relabel their business meaning in roadmap/UI/reporting as planned operational labor cost.

8. Future recurring-expense burden tagging should distinguish:
   - `labor_burden`
   - `vehicle_burden`
   - `general_overhead`

9. Customer-facing proposal/work-order PDFs and exports should not change by default.
   - Internal classifications remain internal unless explicitly requested later.

10. Historical behavior remains future-only first.
   - No backfill
   - No automatic rewrite of historical records

11. Proposal-linked work orders are operational-only for finance purposes.
   - If `work_orders.proposal_id IS NOT NULL`, there is no standalone work-order income posting.
   - There is no standalone work-order material expense posting.
   - There is no service-fee posting.
   - There is no planned operational labor posting.

12. Standalone work-order finance logic is only for rows where `work_orders.proposal_id IS NULL`.
   - service/labor fee revenue + material item revenue = net customer revenue
   - real material/parts cost = COGS/material expense
   - planned operational labor cost remains operational-only
   - VAT is calculated separately when `has_vat = true`

13. `work_orders.amount` must not be reused in phase one.
   - Do not use it for service fee.
   - Do not use it for planned operational labor cost.
   - Do not treat it as the canonical net/VAT/gross source.

14. `proposal_items.revenue_type` should be required for new app writes.
   - DB default for legacy/unspecified rows = `material`
   - UI default:
     - `MaterialCombobox` line => `material`
     - blank/manual line => `other`
     - user may switch to `labor_service`

15. Canonical VAT path decision for phase one:
   - source records explicitly store `has_vat`
   - source records keep `vat_rate`
   - existing source net totals remain authoritative
   - the app should expose one canonical detail/read-model path for `net_amount`, `vat_amount`, and `gross_amount`
   - phase one does not require duplicating extra raw VAT/gross columns on every source table if canonical aliases/views are used consistently

### Remaining open questions

1. Which concrete recurring expense categories or templates should count as `labor_burden` versus `vehicle_burden` in future reporting?
   Recommendation: finalize before Phase 4.

---

## 3. Database Roadmap

### 3.1 Proposal Database Planning

#### Current state

`proposal_items` currently stores:

- revenue amounts: `unit_price` / `unit_price_usd`
- cost amounts: `cost`, `cost_usd`, `product_cost`, `labor_cost`, `material_cost`, `shipping_cost`, `misc_cost` and USD variants
- no explicit revenue-side classification

`proposals` currently stores:

- `vat_rate`
- net total in `total_amount` / `total_amount_usd`
- no persisted `has_vat`
- no persisted source-level `vat_amount`
- no persisted source-level gross total field

Observed save path:

- frontend builds item payload in `src/features/proposals/api.js`
- persistence happens through `fn_save_proposal_package(...)`
- completion finance posting reads `proposal_items` from `auto_record_proposal_revenue()`

#### Proposed change

Add `proposal_items.revenue_type`.
Reuse existing `proposal_items.labor_cost` / `labor_cost_usd` as proposal-side planned operational labor cost storage.
Add explicit source-level VAT semantics for proposals so `has_vat`, net, VAT, and gross are not inferred differently in each consumer.

Recommended VAT source model:

- add `has_vat BOOLEAN NOT NULL DEFAULT false`
- keep `vat_rate`
- keep `total_amount` / `total_amount_usd` as canonical net amount in the active row currency
- expose one canonical proposal read path for:
  - `net_amount`
  - `vat_amount`
  - `gross_amount`

#### Exact column plan

- Column: `revenue_type`
- Suggested type: `TEXT`
- Allowed values:
  - `material`
  - `labor_service`
  - `other`
- Suggested DB rule:
  - `NOT NULL DEFAULT 'material'`
  - `CHECK (revenue_type IN ('material', 'labor_service', 'other'))`

#### Why `TEXT + CHECK` instead of enum

- Safer and easier to evolve in this repo’s migration style
- Avoids enum migration friction and rollback complexity
- The value set is small and stable enough for a check constraint

#### Save/load paths affected

- `fn_save_proposal_package(...)`
- `src/features/proposals/api.js`
  - `buildProposalItemInsertRow`
  - `buildProposalItemPackageRow`
  - `updateProposalSectionsAndItems`
- any proposal detail/list query that later needs `revenue_type`
- proposal edit/load paths must also apply legacy-safe fallback values in app code, not only DB defaults

#### Completion trigger changes

`auto_record_proposal_revenue()` must be updated so finance COGS includes only:

- `product_cost`
- `material_cost`
- fallback `cost` / `cost_usd` when no split data exists

It must exclude:

- `labor_cost`
- `shipping_cost`
- `misc_cost`

`revenue_type` itself should not change whether a line is revenue. Proposal completion should still create:

- one income row for total proposal customer revenue
- one expense row for real material/product cost when applicable

`labor_service` lines remain included in:

- proposal total revenue
- finance ledger income
- customer-facing total

They are only separated internally for reporting and future Labor Coverage.

#### Proposal labor-cost storage recommendation

`proposal_items.labor_cost` and `proposal_items.labor_cost_usd` can be reused safely if phase-one rules are explicit:

- treat them as planned operational labor cost
- keep them internal-only
- exclude them from proposal ledger COGS
- do not map them to any expense row

This is safer than adding a second proposal labor field immediately because:

- the columns already exist
- proposal save/load code already supports them
- the real defect is ledger posting semantics, not lack of storage

Main risk:

- the DB name `labor_cost` is ambiguous
- UI labels, roadmap wording, and reporting labels must clarify that it is planned operational labor cost, not posted finance expense

#### Proposal VAT recommendation

Phase one should make the proposal VAT model explicit as:

- `has_vat` = explicit business toggle on the source record
- `vat_rate` = stored percentage on the source record
- net amount = existing proposal total in the active currency (`total_amount` / `total_amount_usd`)
- VAT amount = stored or canonically exposed from the same source record
- gross amount = stored or canonically exposed from the same source record

The roadmap should not rely on `vat_rate > 0` alone as a durable meaning for "VAT applies".

#### Existing rows without backfill

No historical backfill in phase one.

Plan:

- migration default makes future inserts safe
- reporting should treat old/missing values as `material` unless explicitly revised later
- frontend/Zod load paths must also coerce missing `revenue_type` to a safe default for edit forms
- no rewrite of historical proposal rows

#### Migration impact

- one `proposals.has_vat` column addition
- one `proposal_items` column addition
- one `fn_save_proposal_package(...)` signature/body update
- one trigger function replacement for `auto_record_proposal_revenue()`
- one proposal detail/read-model update for canonical net/VAT/gross aliases

#### Rollback risk

- medium
- touches finance-sensitive trigger behavior
- rollback must preserve proposal save RPC and completion flow compatibility

#### Affected views/RPCs

- `fn_save_proposal_package(...)`
- `complete_proposal_with_rate`
- `auto_record_proposal_revenue()`
- potentially proposal detail/query payloads if UI/reporting starts reading `revenue_type`

---

### 3.2 Work-Order Database Planning

#### Current state

`work_orders` currently includes:

- `amount`
- `currency`
- `materials_discount_percent`
- VAT/tevkifat fields
- no dedicated service fee field
- no dedicated planned operational labor cost field
- no persisted `has_vat`
- no persisted canonical source-level VAT amount/gross amount fields

`work_order_materials` already stores:

- revenue: `unit_price` / `unit_price_usd`
- cost: `cost` / `cost_usd`

`work_orders_detail` surfaces work-order base fields but does not include a service fee field because none exists yet.

#### Proposed change

Add one work-order service/labor fee that follows the app's existing currency pattern.
Add one separate planned operational labor cost that also follows the app's existing currency pattern.
Do not reuse `work_orders.amount` for either of those concepts.

Recommended VAT source model:

- add `has_vat BOOLEAN NOT NULL DEFAULT false`
- keep `vat_rate`
- expose one canonical work-order read path for:
  - `net_amount`
  - `vat_amount`
  - `gross_amount`

`work_orders.amount` remains legacy/unsafe and should not be part of this canonical source model.

#### Currency-aware recommendation

The repo already uses a dual-column pattern for currency-aware job amounts:

- proposals: `unit_price` + `unit_price_usd`, `cost` + `cost_usd`
- work-order materials: `unit_price` + `unit_price_usd`, `cost` + `cost_usd`
- parent row `currency` determines which column is active

Safest consistent recommendation:

- add `service_fee_revenue`
- add `service_fee_revenue_usd`
- use existing `work_orders.currency` to decide which one is populated

Recommended DB rule:

- `service_fee_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`
- `service_fee_revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0`
- `CHECK (service_fee_revenue >= 0)`
- `CHECK (service_fee_revenue_usd >= 0)`
- optional later constraint/trigger to enforce only the active currency column is non-zero

Why this is safer than a single field:

- it matches the current repo design and data-handling approach
- it avoids ambiguous interpretation of a single numeric field under mixed TRY/USD rows
- it keeps reporting and trigger logic aligned with existing proposal/work-order material math

#### Planned labor storage recommendation

Recommended new columns:

- `planned_operational_labor_cost`
- `planned_operational_labor_cost_usd`

Recommended DB rule:

- `planned_operational_labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0`
- `planned_operational_labor_cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0`
- `CHECK (planned_operational_labor_cost >= 0)`
- `CHECK (planned_operational_labor_cost_usd >= 0)`

Why a separate field instead of reusing `amount`:

- `amount` is legacy and semantically overloaded
- current create/update flow often writes `amount: null`
- proposal-to-work-order creation currently copies proposal total into `amount`
- older finance logic and health checks already treat `amount` as expected revenue

Reusing `amount` would blur:

- total customer revenue
- service revenue component
- planned operational labor cost

Those must stay separate.

#### Work-order VAT recommendation

Phase one should make the standalone work-order VAT model explicit as:

- `has_vat` = explicit business toggle on the source record
- `vat_rate` = stored percentage on the source record
- net amount = item revenue plus service fee after discount in the active currency
- VAT amount = stored or canonically exposed from the same source record
- gross amount = stored or canonically exposed from the same source record

This becomes especially important once work orders can carry service fee revenue without material lines.

#### Views/functions needing updates

- `work_orders_detail`
- `get_daily_work_list(...)`
- `search_work_history(...)`
- any other function returning `SETOF work_orders_detail`
- possibly `WO_LIST_SELECT` / `WO_DETAIL_SELECT` in frontend API
- any work-order amount/summary source later reused for invoice or Paraşüt payload preparation

#### Completion trigger changes

`auto_record_work_order_revenue()` must be updated so standalone WO posted revenue becomes:

- discounted item revenue
- plus service/labor fee in the active row currency

Ledger COGS must remain based only on real material/parts cost from `work_order_materials`.

The service/labor fee must:

- increase income posting
- not create any separate labor expense row
- not affect `cogs_try` except indirectly through revenue margin percentages if displayed
- remain fully skipped when `work_orders.proposal_id IS NOT NULL` so proposal-linked WOs cannot duplicate proposal revenue

The planned operational labor cost must:

- never be read by `auto_record_work_order_revenue()`
- never flow into `financial_transactions`
- never populate `cogs_try`
- never create an expense row
- remain available only for operational reporting/margin analysis

If `work_orders.proposal_id IS NOT NULL`, then all work-order finance posting is skipped:

- no income row
- no material expense row
- no service-fee posting
- no planned-labor posting

#### Existing rows without backfill

No historical backfill in phase one.

Plan:

- existing rows behave as service fee = 0
- no rewrite of old work orders

#### Migration impact

- one `work_orders.has_vat` column addition
- two work-order service-fee columns
- two work-order planned-labor columns
- `work_orders_detail` replacement
- dependent `SETOF work_orders_detail` functions recreated
- trigger function replacement
- one work-order detail/read-model update for canonical net/VAT/gross aliases

#### Rollback risk

- medium
- touches work-order completion and views consumed by multiple pages

#### Affected views/RPCs

- `work_orders_detail`
- `get_daily_work_list(...)`
- `search_work_history(...)`
- `fn_complete_work_order_with_payment(...)`
- `auto_record_work_order_revenue()`
- any future invoice/Paraşüt source that reads work-order totals, VAT, or receivable amount

---

### 3.3 Finance / Reporting Database Planning

#### Current state

`financial_transactions` already stores:

- income/expense rows
- `cogs_try`
- VAT fields
- `payment_status`

`v_profit_and_loss` currently returns:

- income rows with positive `amount_try` and `cogs_try`
- expense rows with negative `amount_try`

Current proposal and standalone WO flows write both:

- income row with `cogs_try`
- expense row for COGS/material

#### Proposed behavior

- `financial_transactions` schema can remain unchanged in phase one
- `cogs_try` should remain stored, but treated as informational/export-only for Ledger Profit
- Ledger Profit should use posted income minus posted expense rows
- reporting code must not subtract both `cogs_try` and mirrored expense rows
- internal job/profit reports should use VAT-exclusive revenue
- VAT should remain stored or clearly derivable from persisted base + rate, not guessed from ambiguous totals

#### VAT persistence guidance

Current repo pattern already persists:

- `vat_rate` on proposals/work orders
- `output_vat` / `input_vat` on finance rows

Roadmap guidance:

- keep operational revenue/profit reporting VAT-exclusive
- add explicit `has_vat` on source job records rather than deriving only from `vat_rate > 0`
- keep persisting `vat_rate` on source job records
- ensure each proposal/work-order has a canonical net/VAT/gross read model so receivables, completion flows, and reports use the same amounts
- keep persisting VAT amount on finance rows where posted
- avoid future reports that must infer VAT from customer-facing totals alone
- all UI/API/reporting paths should use the same canonical net/VAT/gross calculation path

#### Avoiding double subtraction

Two options exist:

1. Reporting-only fix
   - keep DB shape
   - change aggregators to ignore `cogs_try` in Ledger Profit

2. DB semantic cleanup
   - remove mirrored expense rows or stop storing `cogs_try`

Recommendation for phase one:

- choose reporting-only fix first
- keep DB shape stable
- use posted rows as ledger truth
- keep `cogs_try` informational only

#### Does `v_profit_and_loss` need DB change immediately?

Not necessarily.

Because `v_profit_and_loss` already exposes:

- positive income
- negative expense
- optional `cogs_try`

the first safe fix can live in frontend/backend reporting aggregation logic.

#### Migration impact

- none required for phase-one double-subtract fix if handled in app logic

#### Rollback risk

- low if reporting-only
- higher if DB semantics are changed later

#### Affected views/RPCs

- `v_profit_and_loss`
- any page/API aggregating `cogs_try`

---

## 4. Backend / API Roadmap

### 4.1 Proposal Service

#### Files / functions affected

- `src/features/proposals/schema.js`
- `src/features/proposals/api.js`
- `src/lib/proposalCalc.js`
- `supabase/migrations/00237_fix_proposal_integrity_and_transaction.sql`
- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
- `src/features/proposals/components/ProposalItemsEditor.jsx`
- proposal detail/summary components that show internal profit

#### API payload changes

Add `revenue_type` to proposal item payloads.

Suggested client shape:

```js
{
  description,
  quantity,
  unit,
  unit_price,
  material_id,
  cost,
  product_cost,
  labor_cost,
  shipping_cost,
  material_cost,
  misc_cost,
  revenue_type
}
```

#### Save/load behavior

- `buildProposalItemInsertRow()` must map `revenue_type`
- package-save RPC JSON payload must include `revenue_type`
- proposal fetch queries used by edit/detail should load `revenue_type`

#### Validation rules

- allowed values only: `material`, `labor_service`, `other`
- future UI inserts should always set a value
- old rows missing the field should remain readable
- app load paths should coerce legacy null/missing values to `material` before edit submit

`labor_cost` / `labor_cost_usd` should be documented in app code and UI copy as planned operational labor cost, not ledger expense.

#### Completion behavior

- no change to one-income-row completion model
- no change to customer-visible total amount logic
- no separate labor income rows in ledger

#### Finance transaction behavior

- total proposal revenue still posts once
- `labor_service` rows remain part of billed customer revenue
- COGS expense and `cogs_try` should reflect only real material/product cost
- `labor_service` affects reporting only, not expense creation

#### Edge cases

- material-combobox line manually changed to labor_service
- blank/manual line with no `material_id`
- old proposal with no `revenue_type`
- TRY proposal vs USD proposal
- proposal with labor/service lines but no material cost
- legacy proposal item loaded from DB with null `revenue_type` and resaved without user edits

#### Tests needed

- payload round-trip for `revenue_type`
- proposal total unaffected by `revenue_type`
- completion trigger excludes labor/shipping/misc from expense logic
- null/legacy rows remain editable
- legacy proposal rows with missing `revenue_type` save back without validation/runtime failure

---

### 4.2 Work-Order Service

#### Files / functions affected

- `src/features/workOrders/schema.js`
- `src/features/workOrders/api.js`
- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/WorkOrderDetailPage.jsx`
- `src/features/workOrders/WorkOrderFormPage.jsx`
- `supabase/migrations/00195_work_orders_detail_status_rank.sql`
- `supabase/migrations/00208_complete_work_order_with_payment_rpc.sql`
- `supabase/migrations/00200_auto_record_work_order_revenue_income_cogs_try.sql`
- future work-order invoice/Paraşüt sync sources that derive amount/VAT from work orders or linked finance documents

#### API payload changes

Add currency-aware service/labor fee fields to work-order create/update/fetch payloads.

Suggested client shape:

```js
{
  site_id,
  work_type,
  currency,
  service_fee_revenue,
  service_fee_revenue_usd,
  planned_operational_labor_cost,
  planned_operational_labor_cost_usd,
  has_vat,
  items,
  materials_discount_percent,
  vat_rate,
  has_tevkifat
}
```

#### Create/update behavior

- create: persist service/labor fee on `work_orders` using the active currency column
- create: persist planned operational labor cost on `work_orders` using the active currency column
- update: allow editing before completion
- proposal-linked WO create path should default service fee = 0 in phase one
- proposal-linked WO create path should default planned operational labor cost = 0 in phase one

#### Completion behavior

For standalone WOs:

- posted income = service/labor fee in active currency + discounted item revenue
- posted material cost remains from `work_order_materials.cost/cost_usd`
- VAT base, receivable amount, and payment amount must all use the same combined customer revenue number

For proposal-linked WOs:

- current trigger skips finance posting
- roadmap preserves that behavior
- this skip also applies if service-fee or planned-labor fields are non-zero, to avoid duplicate proposal revenue

#### How service fee is added to total customer revenue

The cleanest approach is inside `auto_record_work_order_revenue()`:

- compute item revenue subtotal
- apply item discount
- add the active-currency service/labor fee amount
- then post the combined amount

The same combined amount must be reused consistently by:

- work-order detail/form totals
- VAT calculation base
- `fn_complete_work_order_with_payment(...)` payment amount logic
- receivables / collections views fed by the resulting finance row
- future invoice / Paraşüt sync flows

#### How material item costs remain COGS source

- keep `work_order_materials.cost/cost_usd` as the only job-flow COGS source
- no labor expense row from service fee
- no labor expense row from planned operational labor cost

#### Edge cases

- parts-only WO => service fee 0
- service-fee-only WO => no materials, revenue still posts if allowed
- service fee + parts => combined income
- service fee negative or empty => validation should prevent negative, coerce blank to 0
- planned operational labor cost negative or empty => validation should prevent negative, coerce blank to 0
- TRY WO with local service fee and USD field = 0
- USD WO with USD service fee and local field = 0
- proposal-linked WO with non-zero service fee field must still skip standalone revenue posting
- bank-transfer WO with service fee must still land in receivables with correct amount/VAT

#### Tests needed

- create/update payload includes service fee
- detail/list/load shows service fee consistently
- standalone completion posts expected amount
- proposal-linked completion still skips duplicate income
- VAT, payment amount, and receivable amount all stay consistent with service fee included
- future invoice/Paraşüt prep sources can read the same combined amount without ambiguity

---

### 4.3 Finance / Reporting Service

#### Files / functions affected

- `src/features/finance/ReportsPage.jsx`
- `src/features/finance/api.js`
- `src/features/finance/FinanceDashboardPage.jsx`
- `src/features/finance/ReceivablesPage.jsx`
- `src/features/finance/exportUtils.js`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`
- any reducer/helper in `src/features/finance/api.js` that derives profit from `v_profit_and_loss`
- channel/overview aggregators that currently mix `cogs_try` with expense rows

#### ReportsPage double-subtract fix

Current formula:

- revenue += positive rows
- cogs += income-row `cogs_try`
- expenses += negative rows

Required phase-one fix:

- Ledger Profit = posted income - posted expense rows
- do not subtract `cogs_try` a second time

#### Dashboard KPI impact

Current `fetchFinanceDashboardKpis()` repeats the same `cogs_try` deduction pattern.

Roadmap impact:

- align dashboard ledger/net calculations with corrected Ledger Profit semantics
- review `fetchChannelMetrics()` because work-channel costs currently use `cogs_try`
- review `fetchOverviewTotals()` and any related finance cards so dashboard and reports cannot drift to different profit numbers

#### Ledger Profit formula

Recommended canonical formula:

```text
Ledger Profit =
SUM(income rows amount_try)
- SUM(expense rows absolute amount_try)
```

`cogs_try` remains:

- export column
- optional operational metric
- not part of Ledger Profit unless the entire reporting model is redesigned consistently

#### Management Net Profit impact

Management Net Profit should continue to come from real ledger rows, which means:

- proposal/work-order customer revenue
- real material/product/parts COGS
- recurring labor, vehicle, and other real posted overhead expenses
- other real manual/posted expenses

No operational labor estimate should ever be introduced into this metric.

#### Future Labor Coverage report data source

Planned sources:

- proposal item revenue where `revenue_type = 'labor_service'`
- work-order service/labor fee revenue
- recurring expense rows selected as `labor_burden`

Future Field Coverage sources:

- proposal item revenue where `revenue_type = 'labor_service'`
- work-order service/labor fee revenue
- recurring expense rows selected as `labor_burden`
- recurring expense rows selected as `vehicle_burden`

This likely requires a dedicated reporting query or view later, but not in phase one.

#### Tests needed

- ReportsPage aggregates
- dashboard KPI aggregates
- export still includes `cogs_try`
- management numbers reflect recurring expenses
- ReportsPage and dashboard must agree on corrected ledger profit for the same period/view
- channel/overview cards must not silently keep old double-subtract logic

---

## 5. Frontend / UI Roadmap

### 5.1 Proposal UI

#### Where `revenue_type` should appear

Recommended placement:

- inside each proposal item row
- near sales-side inputs, not cost-side inputs
- visible in both desktop and mobile item editors

#### Suggested Turkish labels

- field label: `Gelir Tipi`
- option labels:
  - `Malzeme`
  - `İşçilik / Hizmet`
  - `Diğer`

#### Default behavior for product/material lines

- if selected from `MaterialCombobox`, default to `Malzeme`

#### Default behavior for manual lines

- default to `Diğer`
- user may switch to `İşçilik / Hizmet`

#### Should labor/service rows hide cost fields?

Recommendation: no.

Reason:

- cost fields still may be useful operationally
- hiding them introduces more UX branching
- the key rule is finance posting behavior, not forced UI suppression

#### Total summary changes

Optional later summary additions:

- material revenue subtotal
- labor/service revenue subtotal
- other revenue subtotal

Not required in the first UI pass.

#### Validation / error messages

- new lines should always have `revenue_type`
- Turkish validation label can reuse standard required-message patterns

#### PDF / export impact

- customer-facing PDF should hide `revenue_type` by default
- internal CSV export may include it later if requested

---

### 5.2 Work-Order UI

#### Where service/labor fee should appear

Recommended placement:

- top-level work-order form pricing area
- separate from item-line editor
- near discount/VAT fields, not inside each material line

#### Suggested Turkish label

- `Hizmet / İşçilik Bedeli`

Optional helper text:

- `Müşteriye yansıtılan servis / işçilik geliri`

#### How it affects total amount

- total shown on the form/detail should become:
  - discounted item total
  - plus service fee

The form should follow existing row currency:

- TRY work order => local service fee field
- USD work order => USD service fee field
- every displayed VAT-inclusive total or completion summary must use the same base

#### How item lines remain unchanged

- material lines continue to hold parts revenue/cost only
- no change to `WorkOrderItemsEditor` line structure is needed beyond total summary
- planned operational labor cost should remain outside item lines in phase one

#### Detail page display

Recommended:

- show `Hizmet / İşçilik Bedeli`
- show `Malzeme Toplamı`
- show `Genel Toplam`
- if VAT is shown, its base must include service fee for standalone WOs

#### Completion modal display

Recommended:

- show final customer revenue total including service fee
- do not introduce any labor cost concept
- ensure collection/payment amount preview matches the finance row that will be created

#### Validation / error messages

- allow blank => 0 if client uses numeric coercion
- reject negative values
- label should follow existing work-order currency context
- make the planned-labor label explicitly operational, not financial

#### PDF / export impact

- if work-order PDF/export exists later, service fee should appear as a separate revenue component

---

### 5.3 Finance / Reporting UI

#### Labels to avoid confusion

Recommended wording:

- `Defter Kârı`
  - posted income minus posted expenses
- `Yönetim Net Kârı`
  - real ledger result including recurring real labor, vehicle, and overhead expenses
- `İşçilik Gelir Karşılama`
  - future Labor Coverage wording
- `Saha Gelir Karşılama`
  - future Field Coverage wording

#### Where double-subtract fix changes visible numbers

- `ReportsPage`
- finance dashboard KPIs
- any page currently deriving profit from `cogs_try + expenses`
- any overview, channel, or summary card fed by `fetchFinanceDashboardKpis()` or sibling reducers

#### Future wording notes

- `Brüt Kar` should not imply enterprise-standard gross margin if it still depends on `cogs_try`
- if kept, it should be clearly explained

---

## 6. Data Flow Tables

### 6.1 Proposal Data Flow

| UI field | DB field | Operational report usage | Finance ledger usage |
|---|---|---|---|
| Item sales amount | `proposal_items.unit_price` / `unit_price_usd` | Included in proposal revenue totals | Included in total proposal income row |
| Item material/product cost | `proposal_items.product_cost`, `material_cost`, fallback `cost` | Used in internal contribution | Included in proposal COGS logic |
| Planned operational labor cost | `proposal_items.labor_cost*` | Proposal operational margin and future contribution analysis | Excluded from finance posting after cleanup |
| Item shipping/misc cost fields | `proposal_items.shipping_cost*`, `misc_cost*` | Optional internal-only cost visibility | Excluded from finance posting after cleanup |
| Item revenue type | `proposal_items.revenue_type` | Drives labor/material/other revenue reporting | Not separately posted to ledger |
| Proposal VAT toggle/rate | `proposals.has_vat`, `proposals.vat_rate` | Controls source VAT semantics | Drives posted output VAT when revenue is recorded |
| Proposal net/VAT/gross totals | canonical proposal source/detail model | Main billing and reporting basis | Net posts to income; VAT posts separately |

### 6.2 Work-Order Data Flow

| UI field | DB field | Operational report usage | Finance ledger usage |
|---|---|---|---|
| Service/labor fee | `work_orders.service_fee_revenue` / `service_fee_revenue_usd` | Labor/service revenue reporting | Included in total work-order income |
| Planned operational labor cost | `work_orders.planned_operational_labor_cost` / `planned_operational_labor_cost_usd` | Work-order operational margin and future contribution analysis | Never posted |
| Item sales amount | `work_order_materials.unit_price` / `unit_price_usd` | Material/parts revenue | Included in total work-order income |
| Item material cost | `work_order_materials.cost` / `cost_usd` | Contribution and internal margin | Included in material COGS |
| Work-order discount | `work_orders.materials_discount_percent` | Reduces item revenue subtotal | Affects posted item revenue portion |
| Work-order VAT toggle/rate | `work_orders.has_vat`, `work_orders.vat_rate` | Controls source VAT semantics | Drives posted output VAT when revenue is recorded |
| Work-order net/VAT/gross totals | canonical work-order source/detail model | Billing, completion, and receivable basis | Net posts to income; VAT posts separately |

### 6.3 Finance Ledger Flow

| Source | Transaction type | Included in Ledger Profit | Included in Labor Coverage |
|---|---|---|---|
| Proposal total customer revenue | income | Yes | Only labor_service portion later |
| Proposal material/product COGS | expense | Yes | No |
| Work-order service fee | income | Yes | Yes |
| Work-order item revenue | income | Yes | No |
| Work-order material/parts cost | expense | Yes | No |
| Recurring Labor Burden | expense | Yes | Yes |
| Recurring Vehicle Burden | expense | Yes | Field Coverage only |
| `cogs_try` on income rows | informational column | No direct subtraction in corrected Ledger Profit | No |

---

## 7. Implementation Phases

### Phase 0: Confirm Remaining Open Questions

#### Files to inspect / change

- none yet, decision-only phase

#### DB changes

- none

#### Backend changes

- none

#### Frontend changes

- none

#### Tests

- none

#### Acceptance criteria

- remaining open questions documented explicitly
- especially:
  - Labor Burden vs Vehicle Burden recurring classification scope is recognized as a Phase 4 design input, not a blocker for phases 1-3

#### Risks

- coding starts with inconsistent assumptions

---

### Phase 1: Reporting Double-Subtract Fix

#### Status

- `DONE`

#### Files to inspect / change

- `src/features/finance/ReportsPage.jsx`
- `src/features/finance/api.js`
- `src/features/finance/FinanceDashboardPage.jsx`
- possibly `src/features/finance/ReceivablesPage.jsx`

#### DB changes

- none required if reporting-only

#### Backend changes

- update aggregators to use posted income minus posted expenses
- leave `cogs_try` export-only/informational

#### Frontend changes

- labels/help text may need clarification if numbers visibly change

#### Tests

- ReportsPage P&L aggregation
- dashboard KPI aggregation

#### Acceptance criteria

- no ledger report subtracts both `cogs_try` and mirrored expense rows
- visible Ledger Profit matches posted rows

#### Implemented result

- final code change landed only in `src/features/finance/ReportsPage.jsx`
- ReportsPage `netProfit` now uses posted income rows minus posted expense rows
- no proposal logic changed
- no work-order logic changed
- no DB, VAT, service fee, `revenue_type`, or planned labor logic changed

#### Risks

- users notice changed totals; release notes/explanation needed
- dashboard and reports can still drift if only one reducer is fixed

---

### Phase 2: Proposal `revenue_type` + Trigger Cleanup

#### Phase 2 goal

Implement proposal-side internal revenue classification and proposal finance cleanup without changing proposal total revenue, without touching work orders, and without letting planned operational labor flow into the ledger.

#### Hard rules for Phase 2

- add `proposal_items.revenue_type`
- all billed proposal lines still count as revenue
- `revenue_type` is internal classification only:
  - `material`
  - `labor_service`
  - `other`
- `proposal_items.labor_cost` / `labor_cost_usd` may remain planned operational labor cost storage
- planned operational labor cost must not flow into `financial_transactions`
- planned operational labor cost must not populate `cogs_try`
- planned operational labor cost must not create an expense row
- shipping and misc must not flow into proposal ledger COGS unless a later explicit rule says they are real material/product cost
- Phase 2 must not add `proposals.has_vat`
- Phase 2 must not redesign proposal VAT source modeling
- Phase 2 must not introduce canonical proposal net/VAT/gross read-model changes
- work-order logic is out of scope for this phase
- customer-facing proposal PDFs/exports should remain unchanged by default

#### Exact files and functions to change

- `src/features/proposals/schema.js`
  - `proposalItemSchema`
  - `defaultProposalItem`
  - `proposalSchema`
  - `proposalDefaultValues`
- `src/features/proposals/api.js`
  - `buildProposalItemInsertRow()`
  - `buildProposalItemPackageRow()`
  - `saveProposalPackage()`
  - `fetchProposalItems()`
  - `duplicateProposal()`
  - edit-load data mapping inside `fetchProposal()` consumers must remain compatible with missing `revenue_type`
- `src/features/proposals/ProposalFormPage.jsx`
  - edit-load mapping from `existingItems`
  - reset defaults for legacy rows
- `src/features/proposals/components/ProposalItemsEditor.jsx`
  - add internal-only `Gelir Tipi` control
  - default new rows safely by line type
  - keep customer-facing totals unchanged
- `src/lib/proposalCalc.js`
  - no revenue-total changes
  - if touched, only to support internal reporting helpers or explicit planned-labor semantics
- `supabase/migrations/00237_fix_proposal_integrity_and_transaction.sql`
  - `fn_save_proposal_package(...)`
  - item JSON recordset definition
- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
  - `auto_record_proposal_revenue()`
- proposal read models / queries
  - `proposal_items` reads used by proposal edit/detail flows
  - any query path that must expose `revenue_type` to edit/detail/duplicate flows

#### Concrete DB / migration packet

1. Add `proposal_items.revenue_type TEXT NOT NULL DEFAULT 'material'`
2. Add `CHECK (revenue_type IN ('material', 'labor_service', 'other'))`
3. Replace `fn_save_proposal_package(...)` so proposal item JSON includes `revenue_type`
4. Replace `auto_record_proposal_revenue()` so proposal finance COGS includes only:
   - `product_cost`
   - `material_cost`
   - fallback `cost` / `cost_usd` only when split material/product fields are absent
5. Explicitly exclude from proposal ledger COGS:
   - `labor_cost`
   - `labor_cost_usd`
   - `shipping_cost`
   - `shipping_cost_usd`
   - `misc_cost`
   - `misc_cost_usd`
6. Keep proposal income posting as one total customer revenue row
7. Keep proposal material COGS expense as one row when applicable
8. Do not add `proposals.has_vat` in this packet
9. Do not change proposal VAT/net/gross source modeling in this packet

#### Concrete frontend / API packet

1. Add `revenue_type` to proposal Zod schema with legacy-safe default
2. Add `revenue_type` to proposal item defaults
3. Add `revenue_type` to item payload builders in `api.js`
4. Add `revenue_type` to `fetchProposalItems()` select list
5. Add `revenue_type` to `duplicateProposal()` fetch and copy mapping
6. In `ProposalFormPage.jsx`, coerce missing legacy `revenue_type` to a safe value on edit load
7. In `ProposalItemsEditor.jsx`, add internal-only editor control and default behavior:
   - material-combobox line => `material`
   - blank/manual line => `other`
   - user may switch to `labor_service`
8. Ensure submit/save paths always send `revenue_type` for new writes
9. Do not change proposal PDF/export output by default

#### Legacy compatibility checklist

- old proposal rows without `revenue_type` must load
- old proposal rows without `revenue_type` must resave without user repair work
- DB default alone is not enough; frontend load fallback is also required
- proposal rows currently using `has_vat: proposal.vat_rate > 0` in UI stay unchanged in Phase 2
- roadmap/code comments must not imply proposal `has_vat` is DB-backed after Phase 2

#### Before-coding risks

- High: `fn_save_proposal_package(...)` payload drift can break create/edit silently if app JSON and SQL recordset get out of sync
- High: `auto_record_proposal_revenue()` is finance-sensitive; a naive cleanup can underpost COGS, overpost COGS, or break TRY/USD completion behavior
- Medium: `duplicateProposal()` currently selects and remaps explicit item fields; missing `revenue_type` there would regress duplicated rows to defaults
- Medium: `fetchProposalItems()` and edit-load mapping currently omit `revenue_type`; legacy-safe fallback must be applied before Zod validation and before resave
- Medium: `proposalCalc.js` currently totals all cost components for internal margin; if UI labels are not clarified, users may confuse planned operational labor with posted finance COGS
- Medium: if fallback-to-`cost` logic in the trigger is kept too broad, labor/shipping/misc can still leak into ledger COGS through legacy unsplit rows
- Medium: roadmap drift can create confusion if Phase 2 implementation starts adding VAT fields even though VAT modeling was deferred
- Low: adding an internal-only `Gelir Tipi` control can create UX confusion unless it is clearly labeled as reporting-only

#### Implementation checklist

1. Add DB column/constraint for `proposal_items.revenue_type`
2. Update `fn_save_proposal_package(...)` JSON input contract and insert statement
3. Update proposal frontend schema/defaults/payload builders for `revenue_type`
4. Update proposal fetch/edit/duplicate paths so `revenue_type` round-trips
5. Add internal-only `Gelir Tipi` editor control
6. Replace proposal completion trigger COGS logic to exclude planned labor/shipping/misc
7. Verify proposal income posting still uses full billed proposal total
8. Verify no proposal labor cost data appears in `financial_transactions.amount_try`, `cogs_try`, or any new expense row
9. Verify old proposals load and save unchanged except for safe defaulted classification
10. Leave VAT source modeling unchanged and move that work to the later dedicated VAT packet

#### Acceptance criteria

- proposal item can be classified as `material`, `labor_service`, or `other`
- new proposal item writes always include `revenue_type`
- old proposal rows without `revenue_type` remain loadable and resavable
- proposal total revenue does not change because of `revenue_type`
- proposal completion still posts one income row for the full billed proposal amount
- proposal ledger COGS includes only real material/product cost
- `labor_cost` / `labor_cost_usd` remain operational-only planned labor storage
- `labor_cost` does not populate `cogs_try`
- `labor_cost` does not create an expense row
- shipping/misc do not create proposal ledger COGS unless a later explicit rule changes that
- customer-facing proposal PDFs/exports remain unchanged by default
- proposal VAT source modeling remains unchanged in Phase 2
- `proposals.has_vat` is not introduced in Phase 2
- no work-order code path is modified in this phase

#### Checks to run during implementation

- proposal create flow
- proposal edit flow
- proposal duplicate flow
- proposal completion via `complete_proposal_with_rate`
- finance row inspection after proposal completion for TRY proposal
- finance row inspection after proposal completion for USD proposal
- legacy proposal edit/save round-trip with missing `revenue_type`

---

### Phase 3: Work-Order Currency-Aware Service Fee + Revenue Posting Update

**Status:** `DONE`

Implemented packets:

- `00240_work_order_finance_contract.sql`
- `00241_work_order_posting_consistency.sql`
- `00242_payment_vat_settlement_consistency.sql`
- `00243_tahsilat_gross_settlement_views.sql`

Implemented scope summary:

- standalone work-order service fee and planned operational labor source fields
- canonical `work_orders_detail` net / VAT / gross aliases
- standalone work-order posting from canonical totals
- completion RPC consistency for VAT-enabled cash/card settlement
- payment-status settlement against collectible total (`net + VAT`)
- Tahsilat gross-settlement alignment
- service-fee-only standalone work-order save flow without dummy material rows

#### Files to inspect / change

- `supabase/migrations/*` new migration
- `src/features/workOrders/schema.js`
- `src/features/workOrders/api.js`
- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/WorkOrderDetailPage.jsx`
- `supabase/migrations/00195_work_orders_detail_status_rank.sql`
- `supabase/migrations/00200_auto_record_work_order_revenue_income_cogs_try.sql`
- `supabase/migrations/00208_complete_work_order_with_payment_rpc.sql`

#### DB changes

- add currency-aware service/labor fee columns on `work_orders`
- add currency-aware planned operational labor cost columns on `work_orders`
- add `work_orders.has_vat`
- update `work_orders_detail`
- recreate dependent `SETOF work_orders_detail` functions
- update standalone WO trigger logic
- update canonical work-order detail/read model for net/VAT/gross

#### Backend changes

- save/load service fee in the active row currency pattern
- save/load planned operational labor cost in the active row currency pattern
- add service fee into posted revenue
- keep material item costs as only COGS source
- keep planned operational labor cost out of posting logic entirely

#### Frontend changes

- add `Hizmet / İşçilik Bedeli`
- add explicit planned operational labor cost field
- update totals in form/detail/completion summary

#### Tests

- parts-only
- service-fee-only
- service fee + parts

#### Acceptance criteria

- work-order service fee increases customer revenue
- no labor expense row is created
- planned operational labor cost is stored but never posted
- item-line behavior remains intact

#### Risks

- ambiguity if standalone WO has no materials and only service fee
- view/function recreation can ripple into list/detail pages
- proposal-linked WOs can duplicate revenue if skip logic is not preserved end-to-end
- service fee can desynchronize totals/VAT/payment amounts if form, trigger, and completion RPC are updated inconsistently
- future invoice/Paraşüt sync can read the wrong base if service fee is not surfaced in the same canonical total path

---

### Phase 4: KPI / Report Split, Burden Tagging, And Coverage Foundation

**Status:** `DONE`

Implemented in this packet:

- recurring burden classification infrastructure was added
- recurring-generated finance rows now snapshot `burden_type`
- ledger profit semantics were clarified as posted income minus posted expense rows
- Labor Coverage reporting foundation was added from:
  - proposal `labor_service` revenue
  - standalone work-order service-fee revenue
  - recurring `labor_burden`
- Field Coverage data foundation is now possible later from:
  - labor/service revenue
  - recurring `labor_burden`
  - recurring `vehicle_burden`

#### Files to inspect / change

- `src/features/finance/api.js`
- `src/features/finance/ReportsPage.jsx`
- finance dashboard components
- `src/features/finance/recurringApi.js`
- `src/features/finance/recurringSchema.js`
- `supabase/migrations/00070_recurring_expenses.sql`
- future reporting SQL/view layer as needed

#### DB changes

- possibly new recurring-expense classification/tagging field later
- possibly new report query/view later, but not required to start

#### Backend changes

- separate Ledger Profit vs Management Net Profit semantics
- define future burden classification/tagging approach for recurring expenses:
  - `labor_burden`
  - `vehicle_burden`
  - `general_overhead`
- build Labor Coverage data source
- prepare Field Coverage data source without shipping the report immediately

#### Frontend changes

- label clarification
- future Labor Coverage UI

#### Tests

- report labeling and aggregation consistency
- Labor Coverage source correctness

#### Acceptance criteria

- Ledger Profit and Management Net Profit are not conflated
- Labor Coverage can be derived from proposal/work-order labor revenue plus recurring `labor_burden`
- future Field Coverage can be derived without redesign debt from labor revenue plus `labor_burden` + `vehicle_burden`

#### Risks

- recurring expense category scope not finalized
- profit cards can remain inconsistent if KPI reducers outside `ReportsPage` are not updated together

---

### Phase 5: Optional Historical Review

#### Files to inspect / change

- ad hoc SQL/reporting analysis only

#### DB changes

- none automatic

#### Backend changes

- none automatic

#### Frontend changes

- none required

#### Tests

- only if a separate historical correction plan is approved

#### Acceptance criteria

- historical review remains manual and separately approved

#### Risks

- finance-history rewrite risk if rushed

---

## 8. Test Plan

### 8.1 Proposal Tests

1. Material-only proposal
   - `revenue_type = material`
   - completion posts income + material expense
   - no labor expense

2. Material + `labor_service` proposal
   - one material row, one labor row
   - total income row includes both
   - expense logic only reflects real material/product cost

3. `other` revenue line
   - revenue included in total
   - no special expense behavior

4. Old proposal item with null/missing `revenue_type`
   - proposal still loads
   - editing path applies safe default behavior
   - resave path does not fail when frontend receives legacy row data

5. Proposal completion finance transaction output
   - verify one income row
   - verify one expense row only for real material/product cost
   - verify `cogs_try` excludes labor/shipping/misc

6. Ensure `labor_service` does not create expense
   - item classified as labor_service only
   - finance should not post labor expense

### 8.2 Work-Order Tests

1. Parts-only work order
   - service fee revenue columns remain `0`
   - completion behaves like today

2. Service-fee-only work order
   - no items
   - service fee > 0
   - revenue posts correctly
   - no COGS expense created

3. Service fee + parts work order
   - total income = service fee + item revenue
   - expense = item material cost only

4. Completed work-order finance transaction output
   - verify income row amount
   - verify VAT base includes service fee
   - verify payment status behavior still works
   - verify payment amount / receivable amount matches the same combined revenue figure

5. Ensure service fee does not create labor expense
   - no additional expense row beyond material COGS

6. Proposal-linked work order with non-zero service-fee fields
   - completion still returns proposal-linked path
   - no standalone income row is created
   - no duplicate revenue is posted

7. Service-fee-only bank-transfer work order
   - receivable is created with correct net amount and VAT
   - later payment flow can settle the same amount without mismatch

8. Standalone work order with planned operational labor cost
   - planned operational labor cost is stored
   - no finance expense row is created
   - `cogs_try` does not include planned operational labor cost

9. Proposal-linked work order with non-zero planned operational labor fields
   - completion still returns proposal-linked path
   - no finance row is created from planned labor

### 8.3 Reporting Tests

1. ReportsPage should not subtract both `cogs_try` and expense row
2. Ledger Profit should match posted income minus posted expenses
3. `cogs_try` remains informational only
4. Management Net Profit includes recurring expenses
5. Dashboard KPI logic matches corrected Ledger Profit semantics
6. ReportsPage and dashboard show the same Ledger Profit for the same period/view mode
7. Channel / overview reducers do not silently retain old `cogs_try` double-subtract behavior

---

## 9. Acceptance Criteria

### After implementation, these must be true

- Proposal items can explicitly classify revenue as `material`, `labor_service`, or `other`
- New proposal item writes always include `revenue_type`
- Proposal source rows explicitly store `has_vat`
- Standalone work orders can store service/labor fee revenue in a currency-aware way consistent with existing TRY/USD design
- Standalone work-order source rows explicitly store `has_vat`
- Proposal-linked work orders never post duplicate standalone revenue, even if service-fee fields exist
- Proposal-linked work orders are operational-only for finance purposes
- Proposal/work-order finance posting sends only:
  - total customer revenue
  - real material/product/parts cost
- No planned operational labor/fuel/misc/vehicle burden is posted from job flows
- ReportsPage Ledger Profit equals posted income minus posted expense rows
- Dashboard KPIs, overview cards, and ReportsPage use the same corrected ledger-profit semantics for the same filters
- `cogs_try` remains visible only as informational/export data unless a later redesign says otherwise
- Work-order service/labor fee is included consistently in:
  - standalone posted income
  - VAT base
  - completion/payment amount logic
  - receivable amount logic
  - future invoice/Paraşüt integration inputs
- Proposal/work-order planned operational labor cost remains queryable for operational analysis without appearing in ledger profit
- All UI/API/reporting paths use one canonical net/VAT/gross calculation path per source record type
- Labor Coverage can later be built from labor/service revenue plus recurring burden sources
- Field Coverage can later be built from labor/service revenue plus recurring Labor Burden and Vehicle Burden sources

### These must not happen

- no estimated misc/fuel/vehicle per-job field
- no labor expense row created from proposal `labor_service` classification
- no labor expense row created from work-order service/labor fee
- no planned operational labor cost may flow into `financial_transactions`
- no planned operational labor cost may populate `cogs_try`
- no planned operational labor cost may create an expense row
- `work_orders.amount` is not repurposed silently
- no historical finance rewrite in phase one

### How to verify from UI

- proposal item editor shows `Gelir Tipi`
- work-order form/detail shows `Hizmet / İşçilik Bedeli`
- proposal/work-order forms expose explicit VAT behavior using a real source field, not only `vat_rate > 0` inference
- ReportsPage totals change only due to corrected ledger math
- dashboard profit cards match the same period/view report totals
- customer-facing PDFs/exports remain unchanged by default

### How to verify from database

- `proposal_items.revenue_type` populated on new rows
- work-order service/labor fee columns stored according to active row currency
- planned operational labor cost remains stored on proposals/work orders but absent from finance rows
- `work_orders.amount` remains unused for canonical service fee / planned labor / total logic
- legacy proposal rows remain readable/resavable without backfill
- completed proposal/work-order finance rows match intended posting rules

### How to verify from reports

- Ledger Profit matches ledger rows
- Management Net Profit still reflects recurring expense burden
- dashboard and reports match for the same period/view
- no double-subtract behavior remains

---

## 10. What Not To Build

- No estimated misc/fuel/vehicle field
- No planned operational labor cost posting to ledger
- No payroll allocation by technician/hour
- No activity-based costing
- No enterprise overhead allocation
- No historical rewrite in first implementation
- No SIM finance changes
- No recurring expense changes

---

## 11. Inspected Files / Functions / Tables

### Business source

- `docs/active/proposal-workorder-labor-finance-refactor-plan.md`

### Proposal

- `src/features/proposals/schema.js`
- `src/features/proposals/api.js`
- `src/features/proposals/components/ProposalItemsEditor.jsx`
- `src/lib/proposalCalc.js`
- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
- `supabase/migrations/00237_fix_proposal_integrity_and_transaction.sql`

### Work orders

- `src/features/workOrders/schema.js`
- `src/features/workOrders/api.js`
- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/WorkOrderDetailPage.jsx`
- `supabase/migrations/00200_auto_record_work_order_revenue_income_cogs_try.sql`
- `supabase/migrations/00208_complete_work_order_with_payment_rpc.sql`
- `supabase/migrations/00195_work_orders_detail_status_rank.sql`

### Finance / reporting

- `src/features/finance/ReportsPage.jsx`
- `src/features/finance/api.js`
- `src/features/finance/FinanceDashboardPage.jsx`
- `src/features/finance/ReceivablesPage.jsx`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`

### Tables / views / functions inspected

- `proposal_items`
- `proposals`
- `work_orders`
- `work_order_materials`
- `financial_transactions`
- `financial_transaction_payments`
- `v_profit_and_loss`
- `work_orders_detail`
- `fn_save_proposal_package(...)`
- `auto_record_proposal_revenue()`
- `auto_record_work_order_revenue()`
- `fn_complete_work_order_with_payment(...)`
- `complete_proposal_with_rate`
