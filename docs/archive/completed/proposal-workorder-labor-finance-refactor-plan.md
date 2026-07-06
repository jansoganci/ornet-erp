# Proposal / Work-Order Labor Finance Refactor Plan

**Date:** 2026-07-02  
**Project:** Ornet ERP  
**Scope:** Planning only. No code or migration changes in this document.  
**Goal:** Separate labor/service revenue classification from real finance ledger cost posting so Management Net Profit remains practical and trustworthy for a small security installation/rental/service company.

---

## 1. Purpose

Ornet ERP currently mixes operational job data with real ledger finance data.

This is now a problem because:

- real payroll, SGK, food, vehicle/fuel, and routine overhead are already entered as recurring expenses,
- those real costs flow into `financial_transactions`,
- proposal/work-order flows also contain labor/service revenue that is not explicitly classified for reporting,
- proposal completion currently folds non-material cost components into posted finance COGS,
- finance reporting still mixes ledger profit logic with operational cost indicators.

The refactor goal is not enterprise cost accounting.

The goal is a practical split:

1. **Finance ledger**
   - real posted revenue
   - real material/product COGS where appropriate
   - real recurring payroll/overhead/operator costs
   - no estimated labor/fuel/misc postings

2. **Operational revenue classification**
   - total customer revenue
   - material/product revenue where applicable
   - labor/service revenue where applicable
   - contribution visibility without enterprise costing

3. **Labor coverage reporting**
   - billed labor/service revenue
   - minus real payroll/staff/field burden from recurring expenses

---

## 2. Current Behavior

### 2.1 Proposal Flow

#### Frontend / API

Proposal item cost fields are collected and persisted in the proposal layer.

Relevant references:

- `src/features/proposals/api.js`
- `src/features/proposals/ProposalFormPage.jsx`
- `src/lib/proposalCalc.js`

Current proposal item fields include:

- `cost` / `cost_usd`
- `product_cost` / `product_cost_usd`
- `labor_cost` / `labor_cost_usd`
- `material_cost` / `material_cost_usd`
- `shipping_cost` / `shipping_cost_usd`
- `misc_cost` / `misc_cost_usd`

These values are operationally attached to `proposal_items`.

#### DB / completion flow

Proposal completion is handled through:

- frontend RPC call path: `complete_proposal_with_rate`
- DB trigger path: `auto_record_proposal_revenue()`

Relevant references:

- `src/features/proposals/api.js`
- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`

#### What gets written to `financial_transactions`

Current trigger behavior:

1. create one **income** row for the proposal revenue
2. compute one combined internal COGS total
3. store that total on the income row as `cogs_try`
4. create one separate **expense** row in category `material`

Important detail:

- labor/material/shipping/misc are **not posted separately**
- they are merged into one total cost basis
- the merged total can include:
  - `product_cost`
  - `labor_cost`
  - `material_cost`
  - `shipping_cost`
  - `misc_cost`
- if those are absent, trigger falls back to `cost` / `cost_usd`

So proposal completion currently posts:

- `cogs_try` on the income row
- plus a separate expense row
- using one merged cost number

This is the core labor/payroll double-count risk on the proposal side.

### 2.2 Work-Order / Service Flow

#### Frontend / API

There is no separate dedicated service-finance form model today. Operational service work currently lives in:

- `work_orders`
- `work_order_materials`

Relevant references:

- `src/features/workOrders/schema.js`
- `src/features/workOrders/api.js`
- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/WorkOrderDetailPage.jsx`
- `src/features/workOrders/components/WorkOrderCompletionModal.jsx`

Current line-level work-order item fields:

- `description`
- `quantity`
- `unit`
- `unit_price` / `unit_price_usd`
- `cost` / `cost_usd`
- `material_id`

Current work-order model does **not** have a separate field for:

- labor/service revenue charged to the customer

Today, service/job economics are mostly derived from:

- item revenue
- item cost

#### DB / completion flow

Work-order completion uses:

- frontend RPC: `fn_complete_work_order_with_payment`
- DB trigger: `auto_record_work_order_revenue()`

Relevant references:

- `src/features/workOrders/api.js`
- `supabase/migrations/00230_completion_rpc_role_guards.sql`
- `supabase/migrations/00212_tahsilat_core.sql`

#### What gets written to `financial_transactions`

Current standalone work-order completion posts:

1. one **income** row
2. `cogs_try` on that income row
3. one separate **expense** row in expense category `material`

Current work-order trigger cost basis appears to be **material/parts only**:

- revenue from `work_order_materials.unit_price`
- cost from `work_order_materials.cost`
- no separate trigger posting for estimated labor/fuel/misc

This means:

- proposal flow is the bigger labor/payroll double-count problem today
- work-order flow already handles parts revenue/cost via item lines
- work-order flow still lacks a simple explicit service/labor revenue field

### 2.3 Finance / Reporting Impact

Relevant references:

- `src/features/finance/api.js`
- `src/features/finance/ReportsPage.jsx`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`

Current finance/reporting consequences:

- `v_profit_and_loss` reads posted `financial_transactions`
- proposal and work-order triggers can write both:
  - `cogs_try` on income rows
  - separate expense rows

Current `ReportsPage` aggregation:

```text
revenue += positive amount_try
cogs += income-row cogs_try
expenses += absolute value of negative rows
netProfit = (revenue - cogs) - expenses
```

This creates a possible double-subtraction pattern for flows where:

- `cogs_try` is populated, and
- a matching expense row also exists

Current dashboards are not yet cleanly separated between:

- Ledger Profit
- Job Contribution Profit
- Management Net Profit
- Labor Coverage

### 2.4 Existing Job Contribution Calculations

Some operational calculations already exist locally in the UI / helper layer.

Relevant references:

- `src/lib/proposalCalc.js`
- `src/features/workOrders/WorkOrderDetailPage.jsx`

Current state:

- work-order detail computes a simple operational margin using line totals minus line costs
- proposal helper logic can total all cost components, including labor and misc fields

These are useful seeds for a future simplified contribution view, but they are not a clean finance/reporting model yet.

---

## 3. Problems Found

### 3.1 Proposal estimated labor is effectively mixed into ledger COGS

Because proposal completion merges labor/material/shipping/misc into one posted cost basis, estimated labor can affect ledger finance.

### 3.2 Real payroll already exists in recurring expenses

This means the business already has a real labor-cost source in the ledger.

If estimated labor also reduces finance profit through proposal postings, Management Net Profit becomes distorted.

### 3.3 Reports can subtract both `cogs_try` and expense rows

Current report aggregation can understate profit if it subtracts:

- income-row `cogs_try`
- plus matching negative expense rows

This issue is broader than labor alone, but labor makes the business impact worse.

### 3.4 Proposal and work-order flows lack explicit labor/service revenue classification

Today, the system can track parts revenue/cost fairly naturally through item lines.

It cannot cleanly answer:

- how much labor/service revenue was billed,
- whether labor sales cover payroll.

### 3.5 Management and operational profit are not clearly separated

The business needs two different answers:

1. Was this job priced properly?
2. Did the company make money this month after real payroll/overhead?

Current model is not explicit enough about that split.

---

## 4. Target Behavior

### 4.1 Finance Ledger

The ledger should post:

- customer revenue
- real material/product COGS where appropriate
- real recurring payroll/staff costs
- real recurring overhead/fuel/operator costs
- real manual/posted finance expenses

The ledger should **not** post:

- estimated labor
- estimated fuel
- estimated shipping
- estimated misc/direct soft estimates

### 4.2 Operational Revenue Classification

Proposal / work-order / service flows should still track:

- total revenue
- material/product revenue where applicable
- labor/service revenue where applicable
- real material/product cost
- simplified contribution profit

This remains practical operational/reporting data for a small company.

### 4.3 Labor Coverage Report

Later reporting should answer:

```text
total billed labor/service revenue
- real payroll/staff/field recurring cost
= labor coverage result
```

Optional later extension:

- include vehicle/fuel/maintenance burden in a second version

But that is not required for phase one.

---

## 5. Required DB Changes

### 5.1 Proposal Trigger Change

Target:

- proposal completion should stop posting labor/shipping/misc estimate fields into real finance cost
- proposal finance posting should keep:
  - revenue
  - real material/product procurement COGS only

Smallest safe approach:

- keep existing proposal item cost fields for now
- add an explicit revenue classification field to `proposal_items`
  - preferred field: `revenue_type`
  - preferred values:
    - `material`
    - `labor_service`
    - `other`
- change `auto_record_proposal_revenue()` so ledger COGS only reflects:
  - `product_cost`
  - `material_cost`
  - or fallback `cost` / `cost_usd` when no split fields exist
- exclude:
  - `labor_cost`
  - `shipping_cost`
  - `misc_cost`

Important:

- total proposal customer revenue still posts to finance as one income row
- `revenue_type` is operational/reporting data, not separate ledger posting logic

### 5.2 Work-Order / Service Schema Additions

Minimal practical additions on `work_orders`:

- `service_fee_revenue_try`

Do **not** add:

- `estimated_labor_cost_try`
- `estimated_misc_cost_try`
- per-job fuel/vehicle breakdown fields
- separate material revenue fields
- technician-hour payroll allocation
- payroll distribution tables
- enterprise burden allocation

### 5.3 Ledger Classification

Preferred first approach:

- avoid adding ledger-side classification columns if behavior can be corrected at source
- keep labor/service classification as operational proposal/work-order data
- future proposal/work-order posting should simply avoid inserting estimated labor-like costs into ledger

Optional fallback if reporting still needs extra filtering:

- add a lightweight reporting classification such as:
  - `profit_reporting_class`
  - or `cost_basis_type`

But this should be considered only if source-behavior cleanup is insufficient.

### 5.4 Historical Backfill

Preferred strategy:

- **future-only behavior change first**
- historical rewrite only as a separate reviewed step

No backfill should be bundled into the first implementation unless explicitly approved after review.

---

## 6. Required Trigger / RPC Changes

### 6.1 Proposal

Likely areas:

- `auto_record_proposal_revenue()`
- related completion trigger chain

Required behavior:

- keep proposal completion flow working
- keep revenue posting
- keep material/product cost posting
- stop labor/shipping/misc estimate fields from becoming ledger expense/COGS
- preserve explicit `revenue_type` data for later reporting such as Labor Coverage

### 6.2 Work Orders

Likely areas:

- `fn_complete_work_order_with_payment`
- `auto_record_work_order_revenue()`

Required behavior:

- do not break existing completion/payment flow
- keep current material-cost posting behavior from item lines
- allow `service_fee_revenue_try` to increase total customer revenue
- do not create a separate labor expense row from `service_fee_revenue_try`
- do not introduce estimated labor/fuel/misc into ledger

### 6.3 Report Formula Cleanup

Likely area:

- finance report aggregation logic

Required behavior:

- treat this as a required fix, not an optional cleanup
- avoid report formulas that subtract both:
  - `cogs_try`
  - and mirrored expense rows
- Ledger Profit should be:
  - posted income
  - minus posted expense rows
- keep `cogs_try` informational/export-only unless the reporting model is changed consistently everywhere

---

## 7. Required API Changes

### 7.1 Proposal API

Keep existing proposal item cost fields for operational job analysis.

API changes should be minimal:

- preserve current UI payload structure
- add support for explicit `revenue_type` on proposal items
- do not rely on text matching like `montaj` or `devreye alma`
- no forced UX rewrite

### 7.2 Work-Order API

Add support for minimal new operational fields:

- `service_fee_revenue_try`

Existing line-item API remains the source for:

- parts revenue
- parts cost

### 7.3 Finance Reporting API

Introduce explicit API distinctions later between:

- ledger profit views
- job contribution views
- labor coverage views

Do not overload one endpoint/KPI to answer all three questions.

---

## 8. Required Frontend Changes

### 8.1 Proposal UI

Keep existing proposal cost fields.

Change only the semantics:

- they remain operational cost estimates
- they are not all ledger-posting fields
- add an explicit proposal item `revenue_type` control for labor/service/material/other classification

Potential UI improvement later:

- lightweight explanatory label or tooltip:
  - labor/service classification is for reporting
  - real labor cost comes from recurring expenses, not per-job estimates

### 8.2 Work-Order / Service UI

Add the smallest practical set of operational fields:

- service/labor revenue via `service_fee_revenue_try`

Keep current material line flow intact.

Do not redesign the entire work-order form.

### 8.3 Finance / KPI UI

Future KPI/reporting split should make these distinctions explicit:

- Ledger Profit
- Job Contribution Profit
- Management Net Profit
- Labor Coverage

Do not present one generic “profit” number without context.

---

## 9. Reporting / KPI Impact

### 9.1 Job Contribution Profit

Target formula:

```text
Job Contribution Profit =
job revenue
- parts/material cost
```

Optional reporting split:

- material revenue
- labor/service revenue
- other revenue

Use cases:

- proposal pricing
- service-call pricing
- low-margin job detection

### 9.2 Management Net Profit

Target formula:

```text
Management Net Profit =
real ledger revenue
- real material COGS
- real recurring payroll/staff cost
- real recurring operator/fuel/overhead costs
- other real posted expenses
```

Exclude:

- estimated labor
- estimated fuel/vehicle burden assumptions
- estimated shipping/misc if not real posted supplier cost

### 9.3 Labor Coverage

Target formula:

```text
Labor Coverage =
total billed labor/service revenue
- real payroll/staff/field recurring expense
```

Optional later extension:

```text
Labor Coverage (burdened) =
labor/service revenue
- payroll/staff recurring expense
- optional vehicle/fuel/maintenance burden
```

### 9.4 Report Integrity Review

During implementation, validate whether these views/pages need coordinated updates:

- `v_profit_and_loss`
- `ReportsPage`
- finance dashboard KPI aggregation
- any work/proposal margin summaries

Particular attention:

- double subtraction through `cogs_try` + expense rows
- `ReportsPage` should not subtract both `cogs_try` and mirrored expense rows
- Ledger Profit should use posted income minus posted expense rows
- `cogs_try` should remain informational/export-only unless reporting is redesigned consistently

---

## 10. Backfill Strategy

### Preferred Strategy: Future-Only First

Recommended sequence:

1. correct future proposal/work-order posting behavior
2. separate reporting/KPI semantics
3. only then decide whether historical correction is worth the risk

### Historical Options

#### Option A - Future-only

Pros:

- safest
- no finance-history rewrite
- lowest rollout risk

Cons:

- old months remain imperfect

#### Option B - Reviewed backfill later

Pros:

- cleaner historical management reporting

Cons:

- finance-sensitive
- requires careful identification of proposal-generated rows where labor was merged into ledger cost

#### Option C - Report-level historical adjustment only

Pros:

- less invasive than ledger rewrite

Cons:

- ledger semantics remain inconsistent underneath

### Recommendation

Use **Option A first**.  
Treat any historical cleanup as **Phase 4** and require separate review/approval.

---

## 11. Risks

### Finance Risk

Changing proposal/work-order finance triggers is finance-sensitive and can affect posted reporting.

### UX Risk

Adding service-fee/labor fields to work orders must not confuse existing users or slow completion flow.

### Reporting Risk

If report formulas are not updated consistently, the system can still double-subtract even after trigger cleanup.

### Historical Consistency Risk

Future-only change improves new periods but leaves old periods mixed unless a separate cleanup is approved.

### Scope Risk

This can easily expand into enterprise cost accounting if not tightly controlled.

Avoid that.

---

## 12. Acceptance Criteria

### Core

- No estimated labor/fuel/misc is posted as real finance expense in future proposal/work-order flows
- Real payroll/staff recurring expenses remain the authoritative labor cost source for Management Net Profit
- Proposal items can explicitly classify labor/service revenue with `revenue_type`
- Work orders add only `service_fee_revenue_try` as the new labor/service revenue field
- Existing recurring-expense flow remains intact
- Existing SIM finance decoupling remains intact
- Proposal/work-order completion flows remain functional

### Operational

- Proposal/work-order users can classify labor/service revenue without text matching
- Work orders can track explicit service/labor revenue in a practical way
- Job Contribution Profit becomes reportable without relying on ledger cost posting

### Reporting

- Management Net Profit depends on real recurring payroll/staff/field expenses, not job-level labor estimates
- Labor Coverage report becomes possible from explicit labor/service revenue plus recurring payroll/staff/field costs
- ReportsPage is corrected so `cogs_try` and mirrored expense rows are not double-subtracted

### Rollout

- Phase 1 can ship without historical backfill
- Historical cleanup remains optional and separately reviewed

---

## 13. What Not To Build

- No payroll allocation by technician/hour
- No activity-based costing
- No full overhead allocation engine
- No enterprise standard-cost accounting model
- No broad rewrite of proposal/work-order architecture
- No bundled historical finance rewrite in the first implementation

---

## 14. Recommended Implementation Phases

### Phase 1: Proposal

**Status:** `DONE`

Focus:

- proposal ledger cleanup
- add explicit proposal `revenue_type` classification
- stop labor/shipping/misc estimate fields from becoming real ledger cost

Likely areas:

- proposal finance trigger
- proposal item schema/API
- proposal completion flow validation
- finance report formula review

### Phase 2: Work-Order / Service

**Status:** `DONE`

Focus:

- add only `service_fee_revenue_try`
- keep material line workflow intact
- preserve current completion flow

Likely areas:

- `work_orders` schema
- work-order form/detail/API
- no broad redesign

### Phase 3: Reports / KPIs

**Status:** `DONE`

Focus:

- formalize Job Contribution Profit
- formalize Management Net Profit
- add Labor Coverage reporting
- remove ambiguity in existing finance formulas

Likely areas:

- finance dashboard
- ReportsPage
- supporting reporting APIs/views

Completion note:

- Phase 3 was implemented as the accepted work-order finance packet, including:
  - standalone work-order service fee source modeling
  - canonical work-order net/VAT/gross totals
  - standalone work-order posting consistency
  - payment/VAT settlement consistency
  - Tahsilat gross-settlement alignment
  - service-fee-only standalone work-order save flow hardening

### Phase 4: Optional Historical Cleanup

Focus:

- only if management insists on historical correction
- review proposal-generated historical rows
- decide between soft correction, report-only adjustment, or future-only acceptance

This phase should be separate and explicitly approved.

---

## 15. Inspected Files / Functions / Migrations

### Frontend / API

- `src/features/proposals/api.js`
- `src/features/proposals/ProposalFormPage.jsx`
- `src/features/workOrders/api.js`
- `src/features/workOrders/schema.js`
- `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
- `src/features/workOrders/components/WorkOrderCompletionModal.jsx`
- `src/features/workOrders/WorkOrderDetailPage.jsx`
- `src/features/finance/api.js`
- `src/features/finance/ReportsPage.jsx`
- `src/lib/proposalCalc.js`

### Validation notes after review

- `material_cost` should be treated as real part/material/product cost only. It should not include labor, payroll burden, or vehicle/fuel burden.
- For work orders, existing `work_order_materials` lines are already sufficient to represent material/parts revenue and cost. A separate top-level material revenue field is not required unless reporting later proves item-line aggregation insufficient.
- Proposal items need explicit revenue-side classification for labor/service/material/other. Do not rely on text matching.
- Work orders should add only `service_fee_revenue_try` on the revenue side. Do not add job-level labor, fuel, misc, or vehicle estimate fields.
- Management Net Profit should depend on real recurring expenses for payroll/staff/field burden, not job-level labor estimates.

### DB / Finance Logic

- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
- `supabase/migrations/00212_tahsilat_core.sql`
- `supabase/migrations/00230_completion_rpc_role_guards.sql`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`

### Relevant functions / views

- `auto_record_proposal_revenue()`
- `auto_record_work_order_revenue()`
- `complete_proposal_with_rate`
- `fn_complete_work_order_with_payment`
- `v_profit_and_loss`
