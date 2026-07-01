# Ornet ERP Finance Process Audit and Implementation Plan

**Date:** 2026-06-30  
**Company context:** Istanbul, Turkey-based security systems company providing alarm, camera, fire/security system installation, service, rental, alarm monitoring center subscriptions, and M2M/SIM line rental.  
**System:** Ornet ERP  
**Document purpose:** Convert the finance/process audit findings into a practical implementation plan that can be used to improve the ERP until it produces a reliable management-level net profit view.

---

## 1. Executive Summary

Ornet ERP is not structurally broken. The current system already has several important foundations:

- A central finance ledger through `financial_transactions`.
- Recurring expense templates that can generate ledger expenses.
- A finance dashboard reading from `v_profit_and_loss` / ledger-based views.
- Subscription payment schedules and MRR-like operational metrics.
- Receivables and collection screens.
- SIM inventory and operator invoice comparison tooling.
- Site asset / subscription asset screens for equipment installed at customer sites.

The main issue is not the lack of an ERP foundation. The main issue is that the ERP must clearly separate:

1. **Job-level profitability**: whether a specific installation/service/proposal is profitable.
2. **Ledger profit**: income minus expenses currently posted to `financial_transactions`.
3. **Management net profit**: the practical monthly result after real recurring expenses, operator invoices, payroll, owner draw, vehicle expenses, accounting, banking, and tax reserves.
4. **Cash movement**: what was actually collected and paid in the month.
5. **MRR / recurring value**: the normalized monthly value of rentals and annual center subscriptions.

Without this separation, the same dashboard number can be misread as true net profit even when routine expenses are missing, SIM costs are duplicated, or labor is counted twice.

**Conclusion:** The ERP is close enough to be made useful. It does not need to be rebuilt. It needs targeted finance logic cleanup, recurring expense discipline, SIM cost-source control, labor/payroll double-count protection, and a few pragmatic operational additions.

---

## 2. Audit Scope and Limits

This report is based on:

- Cursor/codebase audit findings from React screens, Supabase queries, SQL views, RPCs, triggers, and migrations.
- Company operating context provided during the audit discussion.
- CSV-based observations from monthly profit, rental portfolio, and SIM/M2M line files.

This report does **not** claim statutory accounting accuracy. It is designed for **management reporting accuracy**.

The target is not a perfect enterprise-grade accounting ERP. The target is:

> A practical ERP for a small security installation/rental company that can show approximately 90-95% reliable management net profit, receivables, recurring income, and operational leakage.

---

## 3. Known Business Values and Operating Baseline

### 3.1 Monthly Routine Expense Baseline

The company currently has the following approximate monthly routine expenses:

| Expense Item | Approx. Monthly Amount TRY | Notes |
|---|---:|---|
| Field staff salaries + food + SGK | 180,000 | Includes field labor payroll and related costs. |
| Owner monthly draw | 100,000 | Should be tracked separately as owner draw or recurring management expense. |
| Bagkur | 0 | Removed from active baseline — owner is retired and no longer pays Bagkur. |
| Turkcell operator invoice | 34,000 | Real operator invoice. Should be the finance source for SIM cost if SIM cron cost is excluded. |
| Vodafone operator invoice | 3,400 | Real operator invoice. |
| Türk Telekom operator invoice | 900 | Real operator invoice. |
| Vehicle fuel | 9,000 | Midpoint of 8,000-10,000 TRY range. |
| Software/tools | 2,000 | Recurring software/tools. |
| Miscellaneous/YDS/small invoices/phone/internet | 8,000 | Practical monthly estimate. |
| Accounting | 3,500 | Previously missing from the first baseline. |
| POS/banking commissions | 2,000 | Monthly estimate. |
| Vehicle annual maintenance reserve | 1,250 | 15,000 TRY/year divided by 12. |
| Vehicle insurance/casco/MTV reserve | 1,667 | 20,000 TRY/year divided by 12. |
| **Estimated monthly total before tax reserve** | **345,717** | Taxes/KDV cash effects are not included. Excludes Bagkur (retired owner). |

**Decision:** These recurring expenses must be entered into `/finance/recurring` or an equivalent recurring expense mechanism. If they are not entered, dashboard profit cannot be trusted.

### 3.2 Revenue and Portfolio Observations

Based on the supplied CSVs and business discussion:

| Area | Observed / Discussed Value | Interpretation |
|---|---:|---|
| Active rental portfolio records | 421 | User stated all but one are paying or expected to pay. |
| Monthly rental + internet run-rate | ~198,118 TRY/month | Current recurring monthly rental/internet potential. |
| Annual alarm monitoring center portfolio | ~775,350 TRY/year | Equivalent to ~64,613 TRY/month normalized revenue. |
| Center subscription unit economics | Sale ~3,800 TRY/year; cost ~133.33 TRY/month | Annual cost ~1,600 TRY; annual gross contribution ~2,200 TRY; gross margin ~57.9%. |
| SIM operator invoice run-rate | ~38,300 TRY/month | Turkcell + Vodafone + TT real invoices. |
| SIM inventory/ERP cost total | ~29,826 TRY/month | Hat-based cost estimate; does not fully match real invoices. |
| SIM reconciliation gap | ~8,500 TRY/month | Difference between real operator invoices and hat-based costs. |
| SIM revenue with populated sale prices | ~58,000 TRY/month | True gross profit is closer to ~19,700 TRY/month if actual operator invoices are used. |
| Receivables | >1,000,000 TRY | Mostly active customers; approximately 100,000 TRY may be problematic. |
| Payables/debt | ~200,000 TRY | Mostly 30-60 day horizon according to business context. |
| Monthly installations | 7-12 | Mostly sales, not rentals. |
| New monthly rentals | 2-3 | Rental growth creates 6-9 month negative cash cycle when equipment is paid upfront. |
| Last 2-year rental/customer cancellations | 48 | Annual customer churn roughly 5-6%, not 12% annually. |
| Lost recurring equivalent from supplied churn list | ~21,828 TRY/month | Annualized lost recurring value ~262,000 TRY/year. |
| Estimated annual revenue churn | ~4% | Based on lost recurring equivalent and current recurring base. |

### 3.3 Monthly Profit CSV Interpretation

The monthly profit CSV showed roughly:

- 2026 first six months sales: ~3.29M TRY.
- 2026 first six months profit/contribution: ~1.83M TRY.
- Average reported contribution: ~304K TRY/month.
- Gross/contribution margin: ~55.6%.

This should not automatically be read as true net profit. If the monthly routine expenses of ~345.7K TRY are not fully posted to the ledger, the dashboard can overstate profitability. If job-level labor/fuel estimates and actual payroll/fuel recurring expenses are both included in the same net-profit formula, profitability can also be understated.

---

## 4. Key Decisions Made During the Audit

### Decision 1: Ornet ERP will remain a practical management ERP, not a full statutory accounting system

**Reason:** The company is small, with a 4-person operational structure and limited data discipline. A full professional accounting ERP would be too heavy and would slow down adoption.

**Implication:** The ERP should prioritize:

- Reliable monthly management profit.
- Receivables visibility.
- Recurring expense discipline.
- Rental and subscription tracking.
- SIM leakage detection.
- Practical customer collection workflows.

It does not need full supplier debt lifecycle, formal accounting period closing, full inventory accounting, or automatic statutory tax calculation in the first phase.

### Decision 2: `/finance/recurring` becomes the control point for routine expenses

**Reason:** Salaries, operator invoices, accounting, banking commissions, vehicle costs, owner draw, and estimated tax reserve must be represented consistently. Without them, net profit is not meaningful. (Bagkur removed from active baseline — retired owner.)

**Status (2026-06-30):** Recurring expense templates are now populated, current-month generation is working, and generated rows flow into `financial_transactions` and the finance dashboard. Ongoing monthly generation/verification remains an operational routine.

**Implementation direction:**

- Keep `recurring_expense_templates` as the source of routine recurring expenses.
- Continue generating `financial_transactions` through guarded recurring expense RPC.
- Add clear categories for payroll, owner draw, operator invoices, accounting, banking, vehicle, software, misc, and tax reserve.
- Add duplicate-generation protection and visibility for the last generated month.

### Decision 3: Job-level labor estimates and actual payroll must not both reduce management net profit

**Reason:** The company charges labor on installation/service jobs. Internally, labor cost is estimated per job or per service day. However, actual salaries are paid monthly. If both job labor cost and payroll expense reduce the same net-profit KPI, labor is double-counted.

**Implementation direction:**

- Keep labor estimates for job-level profitability.
- Use actual payroll from recurring expenses for company-level management net profit.
- Exclude allocated labor estimates from the management net-profit KPI, unless the report is explicitly named job contribution profit.

### Decision 4: SIM finance cost should use real operator invoices, not hat-based estimates, for management net profit

**Reason:** The SIM inventory cost total does not match actual Turkcell/Vodafone/TT invoices. The invoice-analysis tool is useful for operational reconciliation, but it should not be the authoritative finance cost source unless it is reconciled to actual invoices.

**Implementation direction:**

- Use real operator invoices as management net-profit SIM cost.
- Keep SIM inventory costs for line-level analysis and leakage detection.
- Disable or exclude SIM cron-generated cost lines from the management net-profit KPI if operator invoices are entered as recurring expenses.
- Prevent double-counting between SIM cron cost and recurring operator invoices.

### Decision 5: Rental asset cost tracking will be simplified and future-facing

**Reason:** Historical rental equipment costs were not consistently tracked. Attempting to reconstruct old asset costs is not efficient.

**Implementation direction:**

- Do not backfill historical asset costs unless high-value contracts require it.
- Add a single field to new rental contracts/proposals: `initial_rental_cost_estimate`.
- Use this field for simple payback calculations.
- Automate rental proposal completion so equipment is added to the customer/subscription site asset list.

### Decision 6: Center subscription reporting should show both cash and monthly equivalent value

**Reason:** Annual, semiannual, quarterly, and monthly center payments create uneven cash months. A month with 150K TRY of center collections is not necessarily 150K TRY of monthly economic value.

**Implementation direction:**

- Keep cash collection reporting as-is.
- Add monthly equivalent center revenue: annual center portfolio / 12.
- Avoid full monthly accrual journal automation in the first phase unless accounting needs it.

### Decision 7: Receivables should use practical overdue tracking, not heavy accounting aging at first

**Reason:** The company needs to know who has not paid, how long payment has been overdue, and what the last collection note was. Formal 0-30 / 31-60 / 61-90 / 90+ buckets are useful but not mandatory for phase one.

**Implementation direction:**

- Add or verify: job/invoice date, days outstanding, collection note, last contact date, status, assigned person.
- Optional later: aging buckets and collection queue.

### Decision 8: Tax handling should remain manual/estimated initially

**Reason:** KDV, tax reserve, provisional tax, SGK/Bagkur, and other tax payments are complex. Automatic statutory tax calculation is not required for the first reliable management ERP version.

**Implementation direction:**

- Continue tracking VAT-related fields where already available.
- Keep KDV reports separate from management net profit.
- Add a recurring monthly estimated tax reserve.
- Allow actual tax payments to be entered manually.
- Do not claim accounting accuracy without accountant validation.

---

## 5. Current ERP Findings and Required Actions

## 5.1 Finance Dashboard and Net Profit Calculation

**Status: PARTIALLY COMPLETE (Ledger Profit labeling + tooltips, 2026-06-30).** Full five-KPI split remains open.

### Current ERP State

The finance dashboard calculates major KPI values from `v_profit_and_loss` and `financial_transactions`.

Observed logic:

```text
Ledger income - ledger expense = remaining / netProfit
```

**UI update (2026-06-30):**

- Home dashboard (`/`): former “Bu Ayki Net Kâr” card is labeled **Defter Kârı** (Ledger Profit); hover tooltip on ⓘ explains it is posted income minus posted expenses, not management net profit.
- Finance dashboard (`/finance`): former “Kalan” card is labeled **Defter Kârı** with the same tooltip pattern.
- Relevant UI: `src/pages/DashboardPage.jsx`, `src/features/finance/FinanceDashboardPage.jsx`, `src/components/ui/KpiCard.jsx`, `src/features/finance/components/dashboard/ChannelKpiCard.jsx`.

Relevant code and DB references from the audit:

- `src/features/finance/api.js`
- `fetchOverviewTotals()`
- `fetchFinanceDashboardKpis()`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`
- `v_profit_and_loss`

### Risk

The dashboard can still be misread if users treat Defter Kârı as the final management result. Job Contribution Profit, Management Net Profit, and Cash Movement are not yet separate KPIs.

If payroll, owner draw, operator invoices, accounting, vehicle costs, banking fees, and tax reserves are missing from the ledger, Defter Kârı will still overstate true management profit.

### Required Action

Create separate KPI labels and calculations:

| KPI | Definition | Use | Status |
|---|---|---|---|
| Ledger Profit | Posted income - posted expenses from `financial_transactions` | Shows what the ledger currently knows. | **Done** — labeled Defter Kârı on home + finance dashboards; tooltip added. |
| Job Contribution Profit | Job/proposal revenue - materials - estimated labor - estimated fuel - direct job estimates | Job pricing. | **Not started** |
| Management Net Profit | Real recurring expenses, payroll, operator invoices, material COGS, tax reserve, etc. | Main owner KPI. | **Not started** (depends on P0.3, P0.4) |
| Cash Movement | Actual collections - actual payments | Cashflow visibility. | **Not started** |
| MRR / Monthly Equivalent Revenue | Normalized monthly recurring value of rental and annual center subscriptions | Recurring health. | **Done (2026-06-30)** — Finance dashboard (`/finance`): **Abonelik MRR** via `get_subscription_stats()` and **SIM Kart MRR** via `view_sim_card_financials.total_monthly_revenue`; each with label + tooltip. Home dashboard unchanged. *Note:* two operational MRR KPIs (subscription + SIM inventory), not a single blended “rental + center/12” formula KPI. |

### Acceptance Criteria

- [x] The dashboard must not label ledger profit as true net profit (Defter Kârı label + tooltip on home and finance overview).
- [x] Ledger Profit KPI has a short explanation/tooltip defining the formula.
- [x] MRR on finance dashboard — **Abonelik MRR** and **SIM Kart MRR** each have label, calculation source, and tooltip (`dashboardV2.overview` / `overviewInfo` in `finance.json`).
- [ ] Each remaining KPI (Job Contribution, Management Net Profit, Cash Movement) has its own label, calculation, and tooltip.
- [ ] Management Net Profit must explicitly exclude allocated labor/fuel estimates if actual payroll/fuel are included through recurring expenses.

---

## 5.2 Recurring Expenses

**Status: COMPLETE (implementation + business validation, 2026-06-30)**

### Current ERP State

Cursor/code audit confirmed:

- `/finance/recurring` manages `recurring_expense_templates`.
- Generated expenses are inserted into `financial_transactions`.
- Generation is handled by guarded RPC logic such as `fn_generate_recurring_expenses_guarded`.
- Since dashboard reads from `financial_transactions`, generated recurring expenses are included in dashboard profit.
- Recurring expense UX is implemented: month-status banner on finance dashboard, month-status summary on the recurring page, duplicate-safe generation feedback, and navigation under **Finans > Rutin Giderler**.

Relevant references:

- `src/features/finance/recurringApi.js`
- `src/features/finance/recurringHooks.js`
- `src/features/finance/RecurringExpensesPage.jsx`
- `src/features/finance/components/dashboard/RecurringMonthBanner.jsx`
- `supabase/migrations/00225_finance_rpc_role_guards.sql`
- `supabase/migrations/00231_recurring_generation_guarded_rpc.sql`

### Validation Evidence

- Active recurring expense templates were entered into the ERP (owner draw excluded by business choice; Bagkur excluded — retired owner).
- Current-month recurring expenses were generated successfully via `/finance/recurring`.
- Generated records were written into `financial_transactions`.
- Finance expense reports reflected the generated recurring expenses.
- Finance dashboard current-month net profit decreased by the generated recurring expense total.
- This confirms that recurring expenses are now included in the ledger-based profit view used by the dashboard.

### Remaining Operational Discipline

- Each month, verify that all active templates were generated for that month (dashboard/recurring month-status indicators).
- Enter or update templates when routine costs change.
- This is normal monthly usage discipline, not a missing implementation gap.

### Baseline Template Reference

The following recurring expense templates remain the reference baseline (amounts approximate):

| Category | Monthly Amount TRY | Treatment |
|---|---:|---|
| Payroll | 180,000 | Real recurring expense. |
| Owner draw | 100,000 | Separate category; included in management cash/profit view depending on owner decision. Not yet entered (business choice). |
| Bagkur | 0 | Removed from active baseline — owner is retired and no longer pays Bagkur. |
| Turkcell | 34,000 | Real operator invoice; include only if SIM cron cost is excluded from Management Net Profit. |
| Vodafone | 3,400 | Real operator invoice; include only if SIM cron cost is excluded. |
| Türk Telekom | 900 | Real operator invoice; include only if SIM cron cost is excluded. |
| Fuel | 9,000 | Real/estimated recurring vehicle expense. |
| Software/tools | 2,000 | Recurring expense. |
| Miscellaneous | 8,000 | Recurring estimate. |
| Accounting | 3,500 | Recurring expense. |
| POS/bank fees | 2,000 | Recurring estimate. |
| Vehicle maintenance reserve | 1,250 | Monthly reserve. |
| Vehicle insurance/casco/MTV reserve | 1,667 | Monthly reserve. |
| Tax reserve | TBD | Manual monthly estimate. |

### Acceptance Criteria

- [x] Recurring templates have active/inactive status.
- [x] The system shows generation status for the selected/current month.
- [x] The system prevents duplicate generation for the same month/template (DB guard + UI feedback).
- [x] A monthly recurring expense checklist exists (dashboard banner + recurring page summary).
- [x] Dashboard shows whether recurring expense generation is missing for the selected month.

---

## 5.3 Labor Cost vs Payroll Double Counting

### Current ERP State

Cursor/code audit found the following current behavior.

#### Proposal flow

- Proposal line-level operational cost fields are stored on `proposal_items` and mapped in the UI/API:
  - `cost` / `cost_usd`
  - `product_cost` / `product_cost_usd`
  - `labor_cost` / `labor_cost_usd`
  - `material_cost` / `material_cost_usd`
  - `shipping_cost` / `shipping_cost_usd`
  - `misc_cost` / `misc_cost_usd`
- Relevant app references:
  - `src/features/proposals/api.js`
  - `src/features/proposals/ProposalFormPage.jsx`
  - `src/lib/proposalCalc.js`
- When a proposal is completed, `auto_record_proposal_revenue()` currently:
  1. sums proposal revenue,
  2. computes one combined COGS total from `product_cost + labor_cost + material_cost + shipping_cost + misc_cost` (or fallback `cost`/`cost_usd`),
  3. writes that combined total into the income row `cogs_try`,
  4. also writes a separate expense row under expense category `material`.
- This means proposal completion currently posts **merged estimated cost**, not separate ledger rows for labor/material/shipping/misc.
- Relevant DB references:
  - `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
  - `auto_record_proposal_revenue()`

#### Service / work-order flow

- There is no separate “service form” finance model today. The practical service record is the existing `work_orders` + `work_order_materials` model.
- `work_orders` currently supports:
  - basic order metadata,
  - `currency`,
  - `materials_discount_percent`,
  - `vat_rate`,
  - `has_tevkifat`,
  - proposal linkage.
- `work_order_materials` currently stores only:
  - `description`,
  - `quantity`,
  - `unit`,
  - `unit_price` / `unit_price_usd`,
  - `cost` / `cost_usd`,
  - optional `material_id`.
- There are **no separate fields today** for:
  - labor/service revenue,
  - parts revenue,
  - estimated labor cost,
  - direct fuel estimate,
  - estimated misc cost.
- Current work-order UI calculates a simple operational margin as:

```text
line revenue total - line material cost total
```

- Relevant references:
  - `src/features/workOrders/schema.js`
  - `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
  - `src/features/workOrders/WorkOrderDetailPage.jsx`

#### Finance posting behavior

- Standalone work-order completion uses `fn_complete_work_order_with_payment()`, which changes work-order status and then relies on `auto_record_work_order_revenue()` for finance creation.
- Current work-order finance trigger behavior:
  - inserts one income row,
  - stores material COGS on the income row `cogs_try`,
  - inserts one expense row in expense category `material`,
  - does **not** currently post separate labor/fuel/shipping/misc expense components for work orders.
- Relevant references:
  - `src/features/workOrders/api.js`
  - `supabase/migrations/00230_completion_rpc_role_guards.sql`
  - `supabase/migrations/00212_tahsilat_core.sql`
  - `auto_record_work_order_revenue()`

#### Reports / dashboard impact

- `ReportsPage` currently subtracts both:
  - `cogs_try` from positive income rows, and
  - negative expense rows from the same proposal/work-order flows.
- This can double-subtract cost in report formulas for flows that write both an income-row `cogs_try` and a separate expense row.
- Relevant references:
  - `src/features/finance/ReportsPage.jsx`
  - `src/features/finance/api.js`

#### Suitability assessment

This model is **not suitable** as-is for a small company if the goal is practical management net profit.

Why:

- It mixes operational job estimates and real posted company expenses.
- Proposal completion currently merges estimated labor/shipping/misc into ledger COGS.
- Real payroll, SGK, meals, and routine staff costs are already posted through recurring expenses.
- That creates a realistic risk that estimated labor reduces one KPI while real payroll reduces another KPI for the same month.

Tradeoff:

- Keeping estimated labor at the job layer is useful and should remain.
- Posting estimated labor into finance ledger is not useful for management net profit once real payroll exists.
- A small company does not need payroll allocation by technician/hour to solve this. It only needs a clean separation between:
  - job contribution reporting,
  - real management net profit.

### Business Reality

The company estimates labor cost per job/service day. Example:

```text
Labor sold to customer: 100 units
Estimated internal labor cost: 75 units
Job-level labor margin: 25 units
```

However, actual staff salaries are paid monthly. If the ERP subtracts estimated job labor and then subtracts payroll again in the same net-profit KPI, labor is counted twice.

### Decision

Use two separate layers:

1. **Job Contribution Profit** includes estimated labor and estimated fuel.
2. **Management Net Profit** uses actual recurring payroll and actual recurring vehicle/fuel costs, and excludes allocated labor/fuel estimates.

### Required Action

Recommended practical rule:

```text
Estimated labor, estimated fuel, estimated shipping, and estimated misc remain operational.
They must not create real finance expense rows used by Management Net Profit.
```

Recommended smallest safe ledger behavior:

- Proposal completion:
  - keep proposal revenue posting,
  - keep material/product procurement COGS available for ledger,
  - stop treating `labor_cost`, `shipping_cost`, and `misc_cost` as real ledger expense.
- Work-order completion:
  - keep current material cost posting,
  - do not introduce labor/fuel auto-posting into `financial_transactions`.
- Management Net Profit:
  - use real payroll/staff recurring expenses as labor source,
  - use real recurring/posted fuel and overhead as expense source,
  - exclude estimated labor/fuel/misc from net-profit calculation.

Recommended minimal data model:

1. **Future proposal ledger rule**
   - Post material/product cost only.
   - Keep estimated labor/shipping/misc on `proposal_items` for job contribution only.

2. **Future service/work-order operational additions**
   - Keep existing `work_order_materials` for parts revenue and parts cost.
   - Add only the smallest missing top-level fields on `work_orders`:
     - `service_fee_revenue_try` (or `labor_revenue_try`)
     - `estimated_labor_cost_try`
     - `estimated_misc_cost_try` (optional)
   - Derive:
     - `parts_revenue_try` from work-order line totals,
     - `parts_cost_try` from work-order line costs,
     - `job_contribution_profit_try` from formula, not as accounting ledger.

3. **Reporting model**
   - Job Contribution Profit = operational layer
   - Management Net Profit = real ledger layer
   - Labor Coverage Report = billed service/labor revenue minus real payroll recurring expense

This avoids adding enterprise-grade overhead allocation or payroll distribution logic.

### Acceptance Criteria

- Job screen still shows job profitability using labor estimates.
- Management dashboard does not subtract both `labor_cost` and payroll for the same period.
- The dashboard clearly labels which cost basis is being used.
- A test case exists: one job with labor cost + one monthly payroll expense must not reduce Management Net Profit twice.

---

## 5.4 SIM/M2M Revenue, Cost, and Operator Invoice Reconciliation

**Status: COMPLETE for finance-ledger decoupling (2026-06-30). Historical synthetic rows remain intentionally untouched for now.**

### Implementation Status - Completed (2026-06-30)

- **Cron disabled:** The `generate-monthly-sim-finance` pg_cron job was unscheduled.
- **Function no-op:** `generate_monthly_sim_finance()` was redefined as a summary-only no-op that returns zeroed rows and skips ledger insertion.
- **Decoupling:** Future SIM activity will no longer insert `sim_rental` income or `sim_operator` expense rows into `financial_transactions`.
- **Operational Reporting:** The Finance SIM tab now reads operational SIM stats from `view_sim_card_financials` instead of synthetic ledger rows.
- **Invoice Analysis:** Remains the authoritative operational reconciliation tool (unchanged).
- **Authoritative Cost Source:** Recurring expenses remain the authoritative finance source for real Turkcell/Vodafone/Türk Telekom operator invoice costs.
- **Historical Data:** Historical synthetic SIM finance rows were not deleted yet.

### Current ERP State

Cursor/code audit found:

- SIM finance ledger flow is generated by a monthly cron.
- SIM revenue is based on active SIMs with `sale_price > 0`.
- SIM cost is based on `status IN ('active', 'available')` and `cost_price > 0`.
- Ledger does not use the real Turkcell/Vodafone/TT operator invoices as the authoritative SIM cost source.
- Invoice analysis exists and compares Turkcell invoice data with SIM inventory, but it does not automatically write reconciliation differences into finance ledger.

Relevant references:

- `supabase/migrations/00202_monthly_sim_finance_cron.sql`
- `supabase/migrations/00203_fix_sim_finance_status_ambiguity.sql`
- `generate_monthly_sim_finance()`
- `src/features/finance/components/dashboard/SimTab.jsx`
- `src/features/simCards/InvoiceAnalysisPage.jsx`
- `src/features/simCards/utils/compareInvoiceToInventory.js`

### Business Reality

Current known numbers:

```text
Real operator invoice run-rate: ~38,300 TRY/month
ERP/SIM inventory cost estimate: ~29,826 TRY/month
Monthly gap: ~8,500 TRY/month
SIM revenue with populated sale prices: ~58,000 TRY/month
Approx. true SIM gross profit using actual invoices: ~19,700 TRY/month
```

### Decision

The invoice analysis screen is valid as an operational comparison tool. It should not automatically mutate finance records.

For Management Net Profit:

```text
Use real Turkcell + Vodafone + Türk Telekom invoices as SIM cost.
```

SIM inventory cost should remain for:

- line-level profit estimate,
- abnormal usage detection,
- empty-sale-price lines,
- available/stale lines producing cost,
- customer warning/tahsilat follow-up.

### Required Action

Choose one SIM cost source for the Management Net Profit KPI.

Recommended mode:

```text
sim_cost_source_for_management_profit = actual_operator_invoice
```

Implementation options:

1. Disable SIM cron cost posting, or
2. Keep SIM cron for operational reporting but exclude its cost transactions from Management Net Profit, or
3. Add a transaction/source filter so SIM cron costs are included only in SIM operational views.

### Acceptance Criteria

- If Turkcell/Vodafone/TT invoices are entered as recurring expenses, SIM cron cost transactions must not also reduce Management Net Profit.
- SIM revenue can still be generated from active sale-priced lines.
- Invoice analysis must show:
  - actual invoice total,
  - ERP inventory cost total,
  - difference,
  - sale-price-empty but cost-producing lines,
  - available lines producing cost.

---

## 5.5 Rental Equipment Cost, Site Assets, and Payback

### Current ERP State

Cursor/code audit found:

- Site assets module stores equipment name, quantity, installation date, and site/subscription relationship.
- It does not store cost basis, book value, depreciation, residual value, payback, or early cancellation loss.
- Subscription assets tab shows equipment lists and quantities.
- Rental asset finance and ledger connection is not present.

Relevant references:

- `src/features/siteAssets/api.js`
- `src/features/siteAssets/schema.js`
- `src/features/subscriptions/tabs/SubscriptionAssetsTab.jsx`

### Business Reality

The company historically did not track rental equipment cost consistently. Reconstructing old equipment costs would be time-consuming and unreliable.

Rental deals create negative cashflow for approximately 6-9 months because the company buys the equipment upfront and collects monthly over time.

### Decision

Do not attempt full historical reconstruction.

Use a simple future-facing model:

```text
initial_rental_cost_estimate
```

This single field is enough for phase one.

### Required Action

For new rental proposals/contracts:

- Add `initial_rental_cost_estimate`.
- Calculate simple payback:

```text
Payback months = initial_rental_cost_estimate / monthly_contribution
```

Where:

```text
monthly_contribution = monthly_rent + monthly_internet + monthly_center_equivalent - direct monthly costs
```

Also automate:

```text
Rental proposal accepted -> add equipment to subscription/site assets
```

### Acceptance Criteria

- New rental contract has a visible estimated initial cost.
- New rental contract shows simple payback month.
- Accepted rental proposal automatically creates site/subscription asset records.
- Historical rentals may remain cost-empty unless manually updated.

---

## 5.6 Center Subscription Revenue: Cash vs Monthly Equivalent

### Current ERP State

Cursor/code audit found:

- `get_subscription_stats()` calculates MRR from active subscription monthly net components.
- `generate_subscription_payments()` creates 3, 6, or 12-month payment rows for non-monthly subscriptions.
- Finance ledger revenue is created when `subscription_payments.status` becomes `paid`.
- ERP separates operational MRR-like metrics from ledger/cash payment recognition, but it does not create formal monthly accrual journals.

Relevant references:

- `supabase/migrations/00143_add_payment_start_month.sql`
- `generate_subscription_payments()`
- `supabase/migrations/00050_subscription_payment_to_finance.sql`
- `fn_subscription_payment_to_finance()`
- `supabase/migrations/00225_finance_rpc_role_guards.sql`
- `get_subscription_stats()`

### Business Reality

Center subscription payments can be annual, semiannual, quarterly, or monthly. A month with high annual collections should not be interpreted as that month having permanently higher recurring profitability.

Example:

```text
July center collections: 150,000 TRY
Normalized monthly center value: annual center portfolio / 12
```

### Decision

Keep two separate views:

1. **Cash center collections**: when money is paid.
2. **Monthly equivalent center revenue**: annual center value divided by 12.

Full formal accrual journals are not required in the first phase.

### Required Action

Dashboard should show:

```text
Center cash collected this month
Center monthly equivalent revenue
```

### Acceptance Criteria

- User can see why January/July may be cash-heavy months.
- MRR/equivalent revenue is not confused with cash collected.
- Ledger revenue remains payment-triggered unless a later accrual module is intentionally added.

---

## 5.7 Receivables and Collection Follow-Up

### Current ERP State

Cursor/code audit found:

- Receivables and collection screens exist.
- Document statuses include `unpaid`, `partial`, and `paid`.
- Customer summaries include `outstanding`, `total_collected`, `unpaid_count`, `partial_count`, `paid_count`, and `total_profit`.
- Formal aging buckets and collection action queue are not present.

Relevant references:

- `src/features/finance/ReceivablesPage.jsx`
- `src/features/finance/TahsilatPage.jsx`
- `src/features/finance/api.js`
- `fetchReceivables()`
- `fetchCollectionSummaries()`
- `fetchCollectionDocuments()`
- `supabase/migrations/00233_tahsilat_views_aggregate_rewrite.sql`
- `v_collection_documents`
- `v_collection_customer_summary`

### Business Reality

The company has more than 1M TRY of receivables. Most are expected to be collectible, but collection requires active follow-up.

A full accounting aging methodology is not required in phase one. The practical need is:

```text
Who owes money, since when, how many days overdue, and what was the last collection note?
```

### Required Action

Add or verify these fields in the collection workflow:

| Field | Purpose |
|---|---|
| Customer | Identify debtor. |
| Amount due | Amount to collect. |
| Job/invoice/completion date | Start date for overdue calculation. |
| Days outstanding | Main prioritization field. |
| Collection note | Operational follow-up. |
| Last contact date | Prevent repeated blind calls. |
| Collection status | Waiting / contacted / promised / problematic / legal / written off. |
| Assigned user | Who owns the follow-up. |

### Acceptance Criteria

- Collection screen can be sorted by days outstanding.
- User can add/update collection notes.
- User can see last contact date.
- Paid records disappear from unpaid follow-up list.
- Optional later: 0-30 / 31-60 / 61-90 / 90+ buckets.

---

## 5.8 VAT, Taxes, and Debt

### Current ERP State

Cursor/code audit found:

- `financial_transactions` and `v_profit_and_loss` carry VAT-related fields such as `output_vat` and `input_vat`.
- VAT report exists and reads from finance data.
- Structured supplier debt, tax debt, installment liability, maturity ladder, or debt closing module was not found.

Relevant references:

- `src/features/finance/api.js`
- `fetchVatReport()`
- `src/features/finance/VatReportPage.jsx`
- `supabase/migrations/00040_financial_transactions.sql`
- `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`

### Business Reality

Some jobs are KDV/VAT-included and some are not. The ERP already asks whether tax applies and stores tax-related values.

However, automatic tax/provisional tax/corporate income tax calculation would be too heavy for the current company stage.

### Decision

Use a pragmatic model:

- Keep VAT/KDV reporting separate.
- Keep tax flag and KDV fields in transaction records.
- Add a manual monthly tax reserve as recurring expense.
- Enter actual tax payments manually.
- Do not treat the ERP as the final statutory tax calculation source.

### Required Action

Add categories:

```text
tax_reserve
actual_tax_payment
vat_cash_payment
sgk_payment
bagkur_payment
```

Clarify reporting behavior:

- Management cash view may include tax cash outflows.
- Management profitability should use tax reserve if the owner wants a conservative monthly view.
- VAT report should remain separate because VAT payment is not always a normal business expense.

### Acceptance Criteria

- KDV/VAT-included and non-VAT jobs are distinguishable.
- Monthly tax reserve can be entered through recurring expenses.
- Actual tax payments can be entered manually.
- Dashboard labels do not imply statutory accounting accuracy.

---

## 5.9 Inventory, Sales Materials, and Rental Site Assets

### Current ERP State

Cursor/code audit found:

- Materials module stores `unit_price`, `cost_price`, and `currency`.
- Work orders and proposals can use material costs for COGS.
- Site assets are operational inventory, not accounting inventory.
- No full stock or rental asset accounting flow exists.

Relevant references:

- `src/features/materials/api.js`
- `supabase/migrations/00204_materials_prices_with_currency.sql`
- `src/features/workOrders/api.js`
- `src/features/siteAssets/api.js`

### Business Reality

The company does not maintain formal stock records. For sales, material cost on the proposal/work order is enough. For rentals, the important need is to know what equipment is installed at which customer site.

### Decision

Do not build a full stock module as P0.

Use this minimum model:

- Sales jobs: proposal/work-order material cost is enough.
- Rental jobs: accepted rental proposal must write equipment to customer/subscription site assets.

### Required Action

Implement or verify:

```text
Accepted rental proposal -> create subscription/site asset rows
```

### Acceptance Criteria

- Sold jobs do not require stock movements.
- Rental jobs create operational asset records.
- Subscription detail page shows installed equipment.
- Optional later: add cost basis or estimated cost to rental assets.

---

## 5.10 Churn, Pricing, and Low-Price Customer Detection

### Current ERP State

Cursor/code audit found:

- Price revision page exists.
- Revision notes and subscription status fields exist.
- `cancelled_at`, `paused_at`, and `reactivated_at` exist.
- No full churn analytics or low-price warning module exists.

Relevant references:

- `src/features/subscriptions/PriceRevisionPage.jsx`
- `src/features/subscriptions/api.js`
- `src/features/subscriptions/SubscriptionDetailPage.jsx`
- `supabase/migrations/00111_atomic_cancel_subscription.sql`
- `supabase/migrations/00225_finance_rpc_role_guards.sql`
- `get_subscription_stats()`

### Business Reality

Historical prices have eroded in USD terms. Some customers cancel after price increases, but the actual annual churn appears lower than initially assumed.

Corrected interpretation from supplied cancellation data:

```text
48 cancellations over 2 years
Approx. annual customer churn: 5-6%
Approx. cancelled monthly recurring equivalent: 21,828 TRY/month
Approx. annualized lost value: 262,000 TRY/year
Approx. annual revenue churn: ~4%
```

### Decision

Churn analytics is useful but not P0. First priority is finance reliability.

### Required Action

Backlog item:

- Active low-price subscriptions filter.
- Revenue churn report.
- Customer churn report.
- Cancellation reason field.
- Price increase vs cancellation tracking.

### Acceptance Criteria

- Not required before Management Net Profit becomes reliable.
- Can be added after P0 finance fixes.

---

## 5.11 Audit Log and Period Lock

### Current ERP State

Cursor/code audit found:

- `financial_transactions` soft-delete RPC exists.
- Deletion is role-guarded for `admin` and `accountant`.
- Views filter `deleted_at IS NULL`.
- `audit_logs` table exists.
- Some flows write audit logs, but finance-wide insert/update/delete audit coverage is incomplete.
- No clear period-lock mechanism exists.

Relevant references:

- `supabase/migrations/00107_soft_delete_transaction_rpc.sql`
- `supabase/migrations/00225_finance_rpc_role_guards.sql`
- `soft_delete_transaction()`
- `supabase/migrations/00016_subscriptions.sql`
- `audit_logs`
- `supabase/migrations/00162_work_orders_audit_logs.sql`
- `supabase/migrations/00126_fix_medium_rls_issues.sql`

### Business Reality

For a small company, full enterprise-grade audit/period close is not required immediately. However, financial records should not be silently changed without trace.

### Required Action

Minimum audit coverage:

```text
financial_transactions
recurring_expense_templates
subscription_payments
collection notes / receivable status
```

For each change, log:

```text
user_id
timestamp
table_name
record_id
action
old_values
new_values
```

Period lock can be added later:

```text
Closed months cannot be modified directly.
Corrections are posted as current-month correction transactions.
```

### Acceptance Criteria

- Financial transaction changes are auditable.
- Deleted transactions remain soft-deleted.
- Admin/accountant restrictions remain active.
- Period lock is P1/P2, not required for first reliable version.

---

## 6. Required KPI Definitions

The ERP should use clear KPI labels. Avoid using one generic word such as "profit" without context.

### 6.1 Ledger Profit

```text
Ledger Profit = income financial_transactions - expense financial_transactions
```

This shows what is currently posted in the ERP ledger. It is not necessarily true net profit if expenses are missing.

### 6.2 Job Contribution Profit

```text
Job Contribution Profit =
job/service/proposal revenue
- material / parts cost
- estimated labor cost
- estimated direct misc / shipping / fuel estimates
```

This KPI is operational and pricing-oriented.

It should be used to answer:

- Was this proposal priced correctly?
- Did this service call cover its estimated labor burden?
- Are parts margins too thin?
- Are direct misc/shipping estimates being recovered?

Recommended practical inputs:

- Proposals:
  - use proposal revenue,
  - use `product_cost`, `material_cost`, `labor_cost`, `shipping_cost`, `misc_cost`,
  - do not require ledger posting for these fields.
- Work orders / service jobs:
  - derive parts revenue from `work_order_materials.unit_price`,
  - derive parts cost from `work_order_materials.cost`,
  - add top-level operational-only fields:
    - `service_fee_revenue_try`
    - `estimated_labor_cost_try`
    - `estimated_misc_cost_try` (optional)

Practical formula for service jobs:

```text
Job Contribution Profit =
service fee revenue
+ parts revenue
- parts cost
- estimated labor cost
- estimated misc/direct estimate
```

This KPI must not be reused as company net profit if payroll, fuel, and overhead are already posted through recurring expenses.

### 6.3 Management Net Profit

Recommended practical formula:

```text
Management Net Profit =
recognized/posted revenue
- real material COGS
- real recurring payroll
- owner draw if owner wants it included
- real operator invoices
- real vehicle/fuel recurring costs
- accounting/software/bank/misc recurring expenses
- monthly tax reserve
- other real overheads
```

Exclude:

```text
allocated_labor_estimate
allocated_fuel_estimate
allocated_shipping_estimate
allocated_misc_estimate
```

if actual payroll/fuel are already included.

This KPI is the main owner/management monthly result.

It should be calculated from real ledger data only. Operational estimates can support analysis, but they must not reduce this KPI a second time.

#### Labor Coverage companion report

To keep the model practical, do not allocate payroll by technician/hour. Add a simple companion report instead:

```text
Labor Coverage =
total billed service/labor revenue
- real payroll/staff recurring expense
```

Purpose:

- show whether billed labor/service revenue is enough to cover actual payroll,
- support pricing decisions,
- avoid false precision from heavy cost-accounting logic.

Data source expectation:

- billed labor/service revenue comes from explicit service-fee / labor-revenue fields on service jobs and, where later needed, proposal/service revenue classification,
- payroll/staff cost comes from recurring expense categories such as payroll/staff/SGK/meals.

### 6.4 Cash Movement

```text
Cash Movement = actual collections - actual payments
```

This is the best view for cashflow pressure.

### 6.5 MRR / Monthly Equivalent Revenue

```text
MRR = monthly rental + monthly internet + monthly equivalent annual center subscriptions
```

For annual center subscriptions:

```text
monthly equivalent = annual center subscription amount / 12
```

**ERP implementation (2026-06-30):** Finance dashboard shows two operational MRR KPIs instead of one blended formula:

- **Abonelik MRR** — `get_subscription_stats().mrr` (active subscription net monthly total).
- **SIM Kart MRR** — `view_sim_card_financials.total_monthly_revenue` (SIM inventory rental run-rate).

Home dashboard subscription revenue card unchanged. A single KPI that explicitly normalizes annual center subscriptions to `/12` is not yet a separate metric.

---

## 7. P0 Implementation Plan

These items must be completed before trusting the ERP's Management Net Profit with 90-95% confidence.

## P0.1 Verify and enforce recurring expense generation

**Status: COMPLETE.** UX/API implementation, template population, current-month generation, database write, report visibility, and dashboard net-profit impact have all been validated.

### Required

- [x] Verify `/finance/recurring` works end-to-end.
- [x] Enter the monthly routine expense baseline (owner draw deferred by business choice; Bagkur excluded).
- [x] Add duplicate generation protection.
- [x] Add visual indicator: generated / not generated for selected month.

### Done When

- [x] A selected month shows all required routine expenses inside `financial_transactions`.
- [x] The same recurring template cannot generate duplicate expense rows for the same month.
- [x] Finance dashboard net profit reflects generated recurring expenses.

**Ongoing:** Continue monthly generation and month-status verification as operational routine.

---

## P0.2 Split dashboard profit KPIs

**Status: PARTIALLY COMPLETE (Phase 1 — Ledger Profit labeling + tooltips, 2026-06-30; Phase 2 — finance-dashboard MRR KPIs, 2026-06-30).**

### Completed (Phase 1)

- [x] Home dashboard: “Net Kâr” renamed to **Defter Kârı**; ⓘ hover tooltip explains ledger profit vs management net profit.
- [x] Finance dashboard overview: “Kalan” renamed to **Defter Kârı**; same tooltip pattern.
- [x] User can no longer read the main profit card as unnamed “net profit” without context.

### Completed (Phase 2 — MRR on finance dashboard)

- [x] **Abonelik MRR** — `useSubscriptionStats()` → `get_subscription_stats().mrr` (active subscription net monthly components, KDV hariç).
- [x] **SIM Kart MRR** — `useSimFinancialStats()` → `view_sim_card_financials.total_monthly_revenue` (sum of `sale_price` for `active` + `subscription` SIM cards; same basis as monthly SIM finance cron income).
- [x] Both KPIs on `/finance` only; home dashboard not changed.
- [x] Turkish labels + ⓘ tooltips in `src/locales/tr/finance.json`.

Relevant references:

- `src/features/finance/FinanceDashboardPage.jsx`
- `src/features/finance/components/dashboard/ChannelKpiCard.jsx`
- `src/features/subscriptions/paymentsApi.js` (`fetchSubscriptionStats`)
- `src/features/simCards/api.js` (`fetchSimFinancialStats`)
- `supabase/migrations/00169_fix_subscription_stats_mrr_include_sim_amount.sql`
- `supabase/migrations/00152_fix_sim_financial_view.sql`

### Required (remaining)

Dashboard must still add or fully implement:

- [ ] **Job Contribution Profit** — separate KPI + formula tooltip.
- [ ] **Management Net Profit** — separate KPI + formula tooltip (accurate calculation blocked until P0.3 labor/payroll cleanup).
- [ ] **Cash Movement** — collections minus payments for the selected period.

### Done When

- [x] User cannot mistake the ledger profit card for an unnamed “true net profit” label.
- [x] Ledger Profit has clear formula text (tooltip).
- [x] Finance-dashboard recurring-revenue KPIs (Abonelik MRR + SIM Kart MRR) visible with distinct labels and tooltips.
- [ ] All five KPIs from the audit table are visible with distinct labels and tooltips (3 of 5 done: Ledger Profit, Abonelik MRR, SIM Kart MRR).
- [ ] Management Net Profit calculation excludes double-counted labor costs per P0.3. P0.4 is complete for future periods.

---

## P0.3 Prevent labor/payroll double counting

### Required

- Job-level labor estimates remain on proposals/work orders.
- Management Net Profit excludes allocated labor/fuel estimates if payroll/fuel recurring expenses are included.
- Keep the solution practical for a small company; do not add payroll allocation by technician/hour.

### Recommended implementation plan

#### Step 1 - Proposal ledger cleanup

- **Area:** Proposal completion trigger
- **Change:** Stop posting estimated labor/shipping/misc into real finance cost. Keep material/product procurement as the only ledger COGS basis.
- **Likely files/migrations involved:**
  - `supabase/migrations/*proposal*`
  - `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
  - `auto_record_proposal_revenue()`
- **Risk:** Medium-high because it changes finance-sensitive trigger behavior.
- **Acceptance criteria:** Future completed proposals no longer insert labor/shipping/misc as real ledger expense.

#### Step 2 - Work-order/service operational fields

- **Area:** Work-order schema + form
- **Change:** Add minimal operational-only fields on `work_orders`:
  - `service_fee_revenue_try`
  - `estimated_labor_cost_try`
  - `estimated_misc_cost_try` (optional)
- **Likely files/migrations involved:**
  - `supabase/migrations/*work_orders*`
  - `src/features/workOrders/schema.js`
  - `src/features/workOrders/WorkOrderFormPage.jsx`
  - `src/features/workOrders/components/WorkOrderItemsEditor.jsx`
  - `src/features/workOrders/WorkOrderDetailPage.jsx`
- **Risk:** Medium because it changes UI/data-entry flow, but can remain operational-only.
- **Acceptance criteria:** Service jobs can track service fee and estimated labor without creating new finance expense rows.

#### Step 3 - Job Contribution Profit reporting

- **Area:** Operational reporting
- **Change:** Add a job contribution calculation/view that uses proposal/work-order estimates.
- **Likely files involved:**
  - `src/features/proposals/*`
  - `src/features/workOrders/*`
  - optional reporting utility in `src/lib/proposalCalc.js`
- **Risk:** Low-medium.
- **Acceptance criteria:** Users can see job-level pricing/profitability without touching Management Net Profit.

#### Step 4 - Management Net Profit reporting cleanup

- **Area:** Finance reporting
- **Change:** Ensure Management Net Profit uses only real posted finance expenses and excludes estimated labor/fuel/misc.
- **Likely files involved:**
  - `src/features/finance/api.js`
  - `src/features/finance/ReportsPage.jsx`
  - finance dashboard KPI code
  - possibly a dedicated reporting view / classification field if report-level filtering is insufficient
- **Risk:** Medium because current reports already use mixed formulas.
- **Acceptance criteria:** Payroll and job labor estimates cannot reduce the management KPI twice.

#### Step 5 - Labor Coverage report

- **Area:** Management reporting
- **Change:** Add a simple labor coverage KPI/report:
  - billed service/labor revenue
  - minus real payroll/staff recurring expenses
- **Likely files involved:**
  - finance dashboard/reporting layer
  - recurring expense category filters
  - work-order/proposal labor revenue source fields
- **Risk:** Medium because labor revenue source needs to be explicit and consistent.
- **Acceptance criteria:** Management can answer whether billed labor covers actual payroll.

### Historical handling strategy

Recommended safest path: **future-first change**, not aggressive backfill.

Options:

1. **Future-only change**
   - safest,
   - avoids rewriting finance history,
   - leaves old reports imperfect.

2. **Reviewed backfill for proposal-generated rows**
   - more accurate historically,
   - higher finance risk,
   - requires careful identification of rows where labor was merged into material expense.

3. **Report-level adjustment only**
   - least invasive technically,
   - but can leave inconsistent ledger semantics underneath.

Recommended order:

```text
future-only trigger cleanup first
then optional reviewed backfill only if management history must be corrected
```

### What not to build

- No payroll allocation by technician/hour.
- No activity-based costing.
- No enterprise overhead absorption model.
- No full statutory cost accounting.

### Done When

- Test case proves one job labor estimate + one payroll expense does not reduce Management Net Profit twice.
- Proposal and work-order job contribution remains available operationally.
- Management Net Profit uses real payroll/overhead only.
- Labor Coverage report is possible without enterprise allocation logic.

---

## P0.4 Select one SIM cost source for Management Net Profit

**Status: COMPLETE for future periods after migration application (2026-06-30).**

Management Net Profit SIM cost = actual operator invoices entered through recurring expenses.

### Required

Recommended setting:

```text
Management Net Profit SIM cost = actual operator invoices
```

Therefore:

- [x] Turkcell/Vodafone/TT recurring expenses are included.
- [x] cron disabled: `generate-monthly-sim-finance` pg_cron job unscheduled.
- [x] function no-op: `generate_monthly_sim_finance()` redefined to skip ledger insertion.
- [x] no future synthetic SIM finance rows: Decoupling complete.
- [x] SIM tab uses operational stats: Reads from `view_sim_card_financials`.
- [x] invoice analysis unchanged: Remains reconciliation-only.
- [x] recurring expenses remain real cost source: Authoritative source for Management Net Profit.

### Done When

- [x] No month includes both actual operator invoice cost and SIM cron cost in Management Net Profit (for future periods).
- [x] Invoice analysis still compares real invoice vs inventory cost.

---

## P0.5 Improve collection screen usability

### Required

Add/verify:

- Job/invoice date.
- Days outstanding.
- Collection note.
- Last contact date.
- Collection status.

### Done When

- Collection user can sort unpaid customers by days outstanding.
- Collection notes are visible without opening external Excel.

---

## 8. P1 Implementation Plan

These items should follow after P0.

## P1.1 Rental proposal to site asset automation

```text
Accepted rental proposal -> create subscription/site asset rows
```

### Done When

- Rental equipment automatically appears in the subscription asset tab.

## P1.2 Initial rental cost estimate and payback

Add:

```text
initial_rental_cost_estimate
```

Calculate:

```text
payback_months = initial_rental_cost_estimate / monthly_contribution
```

### Done When

- New rental subscriptions show simple payback.

## P1.3 Center cash vs monthly equivalent display

### Done When

Dashboard separately shows:

- center cash collected this month,
- center monthly equivalent value.

## P1.4 Minimal finance audit log

### Done When

Financial transaction and recurring template changes show old/new values and changed user.

---

## 9. P2 Backlog

These are useful but should not block first reliable finance reporting.

- Full formal receivable aging buckets.
- Supplier debt lifecycle.
- Formal tax liability module.
- Period lock.
- Full stock accounting.
- Historical rental asset cost reconstruction.
- Churn analytics.
- Low-price subscription warning system.
- Price increase vs cancellation analytics.

---

## 10. Non-Goals for Phase One

The following should not be forced into the first phase:

- Full statutory accounting correctness.
- Automatic corporate income/provisional tax calculation.
- Full supplier payable management.
- Full inventory accounting.
- Historical reconstruction of all rental equipment cost.
- Enterprise-grade period close.
- Complex depreciation accounting.

These may be added later if the business process matures.

---

## 11. Data Entry Discipline Required

The ERP can only produce reliable management profit if the following monthly discipline is followed:

1. Generate recurring expenses for the month.
2. Verify operator invoices are entered once and only once.
3. Verify payroll/accounting/bank/vehicle expenses are present each month (Bagkur not applicable — retired owner).
4. Mark paid subscription payments correctly.
5. Keep collection notes updated.
6. Enter job/proposal material costs realistically.
7. Avoid using job labor estimates and payroll together in the same net-profit calculation.
8. Enter monthly tax reserve or actual tax payments consistently.

---

## 12. Final Assessment

Ornet ERP has a usable foundation. The current architecture is not a dead end.

The path to a reliable finance system is not a full rebuild. It is a targeted cleanup:

1. ~~Make recurring expenses complete.~~ **Done (2026-06-30)** — templates entered, generation validated, dashboard impact confirmed. Continue monthly operational discipline.
2. ~~Rename and separate profit KPIs.~~ **Partially done (2026-06-30)** — Defter Kârı label + tooltips on home and finance dashboards; **Abonelik MRR** + **SIM Kart MRR** on finance dashboard only. Remaining: Job Contribution Profit, Management Net Profit, Cash Movement.
3. Prevent labor/payroll double counting by keeping estimated labor operational and real payroll authoritative in management reporting.
4. Use actual operator invoices for SIM cost in Management Net Profit — **Done for future periods (2026-06-30).**
5. Keep SIM invoice analysis as an operational reconciliation tool.
6. Add practical receivable follow-up fields.
7. Add simple rental cost/payback tracking for new rentals only.
8. Keep tax handling manual/estimated in phase one.

**Current reliability note:** With recurring expenses now flowing into the ledger, Defter Kârı is materially more accurate than before. Abonelik MRR and SIM Kart MRR on the finance dashboard give operational recurring-revenue visibility but are not the same as Management Net Profit. Management Net Profit remains unavailable as a separate, trustworthy KPI until P0.2 (remaining profit/cash KPIs) and P0.3 (labor) are completed. P0.4 is no longer open for future periods.

**Labor/payroll suitability conclusion:** The chosen model is suitable for Ornet.

Why:

- The company is small and does not need technician-by-technician payroll allocation.
- Real payroll and recurring overhead already exist as authoritative company expenses.
- Proposal/service labor estimates are still valuable for pricing and job decisions.
- A clean split between Job Contribution Profit and Management Net Profit gives useful answers without creating fake accounting precision.

Main tradeoff:

- Management Net Profit becomes intentionally less detailed at the single-job labor-allocation level.
- In return, it becomes much more trustworthy as a real business-result KPI.
- Labor economics can still be monitored through a separate Labor Coverage report and job contribution screens.

After these changes, the ERP should be capable of producing a practical, management-level net profit estimate with approximately 90-95% reliability, assuming monthly data entry is disciplined.

The ERP should not present its dashboard output as statutory accounting profit. It should present it as management finance reporting for decision-making.
