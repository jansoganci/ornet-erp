# Ornet ERP Dashboard — Design Decisions

> Status: Current implementation reference
> Last verified: 2026-07-30
> Primary screen: `src/pages/DashboardPage.jsx`

This document records the dashboard that exists in the application today. It is
not an implementation roadmap. When dashboard behavior changes, update this file
in the same change so that the code remains the final source of truth and this
document remains a reliable summary.

## 1. Scope

This document covers:

- the main dashboard at `/`;
- dashboard layout and responsive behavior;
- role-based section visibility;
- dashboard components and their data sources;
- dashboard-specific visual conventions;
- known gaps and unresolved product decisions.

This document does not define:

- the Finance dashboard at `/finance`;
- the future Cashflow screen or cashflow calculations;
- module-specific list/detail page design;
- general sidebar navigation architecture;
- database or finance-ledger rules beyond the data consumed by the dashboard.

## 2. Product Purpose

The dashboard is a compact daily overview, not a full reporting workspace.

It should answer three questions quickly:

1. What needs attention today?
2. What is the current operational workload?
3. For finance-authorized users, what is the high-level subscription and ledger
   position?

Detailed investigation and mutations belong on the relevant module pages.

## 3. Design Principles

- Information density is preferred over decorative whitespace.
- Color communicates state or meaning, not decoration.
- Light and dark modes are both supported.
- Dashboard cards use solid light surfaces and restrained translucent dark
  surfaces.
- Financial data is hidden when the current role does not have finance access.
- Interactive summaries should link to the closest relevant working screen.
- Loading, error, empty, and restricted states must be explicit.
- User-facing text must use the `dashboard` or appropriate shared i18n namespace.
- Animations should remain subtle and must not delay interaction.

The shared design tokens in `src/index.css` are authoritative. Do not duplicate a
separate dashboard color system in this document.

## 4. Roles and Visibility

`useRole().canWrite` means `admin` or `accountant`.

| Section | Admin | Accountant | Field worker |
|---|---:|---:|---:|
| Greeting, date, quick actions | Yes | Yes | Yes |
| USD/TRY widget | Yes | Yes | Yes, read-only |
| Subscription and finance KPIs | Yes | Yes | No |
| Revenue / expense chart | Yes | Yes | No |
| Overdue subscription payments | Yes | Yes | No |
| Work-order status donut | Yes | Yes | Yes |
| Today task checklist | Yes | Yes | Yes |
| Today schedule | Yes | Yes | Yes |
| Action Board quick action | Yes | No | No |

The dashboard remains one page with role-based section visibility. It is not
split into separate role-specific routes.

## 5. Current Layout

The page uses:

```jsx
<PageContainer maxWidth="full" padding="compact" className="space-y-5">
```

### 5.1 Header row

- Left: time-based greeting, current date, compact quick actions.
- Right: `CurrencyWidget` with latest USD/TRY buy and sell rates.
- On small screens, the currency widget moves below the greeting and fills the
  available width.

### 5.2 KPI row

Visible only to `canWrite`.

```text
Mobile:  2 columns
Tablet+: 4 columns
```

The row contains four shared `KpiCard` instances:

1. Active subscription count
2. Subscription revenue / MRR
3. Uncollected subscription amount
4. Current-period ledger profit

### 5.3 Main analysis row

Desktop uses a 12-column grid:

```text
8 columns: RevenueExpenseLineChart
4 columns: WorkOrderStatusDonut
           TodayTaskChecklist
```

For users without finance access, the chart is hidden and the operational column
uses the full width.

### 5.4 Daily activity row

Desktop uses:

```text
8 columns: TodayScheduleFeed
4 columns: OverduePaymentsList
```

The overdue list is hidden without finance access. The schedule then uses the
full width.

### 5.5 Mobile order

Sections stack in this order:

1. Greeting and quick actions
2. Currency widget
3. Finance KPIs, when authorized
4. Revenue / expense chart, when authorized
5. Work-order status
6. Today tasks
7. Today schedule
8. Overdue payments, when authorized

## 6. KPI Definitions

The dashboard uses the shared `src/components/ui/KpiCard.jsx`; there is no
dashboard-specific `KPIStatCard`.

| KPI | Display | Source | Destination |
|---|---|---|---|
| Active subscriptions | Count | `get_subscription_stats()` via `useSubscriptionStats` | `/subscriptions` |
| Subscription revenue | TRY MRR plus month-over-month percentage when available | `get_subscription_stats()` | `/subscriptions` |
| Overdue subscription debt | TRY total of `pending`/`failed` payments before the current month, with a red left border when greater than zero | `unpaid_total_amount` from `get_subscription_stats()` | `/subscriptions` |
| Ledger profit | Current-period ledger income minus expense | `fetchFinanceDashboardKpis()` | `/finance` |

The ledger-profit tooltip must keep the distinction between accounting ledger
profit and broader management profit clear.

Sparkline KPI cards are not part of the current dashboard. Adding historical
sparklines requires a separate product decision and a justified data source; it
must not be inferred from the old dashboard plan.

## 7. Component Contracts

### 7.1 `CurrencyWidget`

- Reads the latest USD exchange rate through the Finance hooks.
- Displays buy and sell values.
- Refresh action is available only to `canWrite`.
- Missing rates display an em dash instead of a fabricated value.

### 7.2 `RevenueExpenseLineChart`

- Visible only to `canWrite`.
- Reads seven months from `get_monthly_revenue_expense(7)`.
- Displays income and expense as separate lines.
- Uses `ChartTooltip`, `CHART_COLORS`, and `formatTL` from shared chart utilities.
- Current series colors are profit green and expense red.

### 7.3 `WorkOrderStatusDonut`

- Uses `get_dashboard_stats()`.
- Displays pending, in-progress, and completed-this-week counts.
- Zero-value segments are omitted.
- The center total is the sum of the displayed segments; it is not a lifetime
  work-order total.

### 7.4 `TodayTaskChecklist`

- Uses `get_my_pending_tasks(limit_count: 5)`.
- Includes incomplete tasks ordered by due date and priority; it is not limited
  to tasks due today.
- Admin sees all matching tasks; other roles see tasks assigned to or created by
  the current user according to the RPC.
- Checking a row marks the task completed through the existing task mutation.
- The local completed counter is an immediate dashboard interaction state.

### 7.5 `TodayScheduleFeed`

- Uses `get_today_schedule()`.
- Shows at most eight work orders. Timed rows are ordered by scheduled time, but
  the current client-side sort moves rows without a time to the beginning.
- Excludes completed and cancelled work orders through the RPC.
- Links each row to its work-order detail and “View all” to `/daily-work`.

### 7.6 `OverduePaymentsList`

- Visible only to `canWrite`.
- Uses `get_overdue_subscription_payments()`.
- The RPC includes `pending` and `failed` payments whose `payment_month` is
  before the first day of the current month.
- The RPC returns at most 20 rows ordered by oldest payment month first; the
  dashboard displays the first five.
- Each row links to its subscription detail.
- This component is distinct from the subscription Collection Desk KPI at
  `/subscriptions/collection`.

### 7.7 `QuickActionsBar`

Current actions:

| Action | Route | Visibility |
|---|---|---|
| Create work order | `/work-orders/new` | All authenticated users |
| Add customer | `/customers/new` | All authenticated users |
| Daily work | `/daily-work` | All authenticated users |
| Tasks | `/tasks` | All authenticated users; known invalid route |
| Action Board | `/action-board` | Admin only |

Buttons wrap on narrow widths and hide their labels below the `sm` breakpoint.

## 8. Data and Query Boundaries

Dashboard Supabase calls live in `src/features/dashboard/api.js`; React Query
hooks and keys live in `src/features/dashboard/hooks.js`.

Current dashboard query keys:

```js
export const dashboardKeys = {
  all: ['dashboard'],
  stats: () => [...dashboardKeys.all, 'stats'],
  schedule: () => [...dashboardKeys.all, 'schedule'],
  tasks: () => [...dashboardKeys.all, 'tasks'],
  revenue: (months) => [...dashboardKeys.all, 'revenue', months],
  overduePayments: () => [...dashboardKeys.all, 'overduePayments'],
};
```

The finance KPI query intentionally uses the Finance module's existing query
factory rather than duplicating ledger aggregation in the Dashboard module.

Role-gated finance queries must retain their `enabled: canWrite` protection; UI
visibility alone is not sufficient.

## 9. Visual Conventions

### 9.1 Cards

Dashboard analysis cards currently use:

```text
Light: bg-white, gray border
Dark:  gray-800/40, white/10 border, backdrop-blur-sm
Shape: rounded-xl
```

Shared KPI styling is owned by `KpiCard`. New dashboard components should prefer
shared UI primitives when an equivalent exists.

### 9.2 Typography

- Greeting: compact semibold heading.
- Card headings: uppercase, extra tracking, `text-xs`.
- Primary list values: `text-sm`, medium weight.
- Financial and counter values: tabular numerals.
- Secondary context: compact neutral text.

### 9.3 Charts

Chart colors and number formatting come from `src/lib/chartTheme.js`. Tooltip
appearance comes from `src/components/ui/ChartTooltip.jsx`.

Do not define a second chart palette inside a dashboard component.

### 9.4 Motion

Feed rows may use the existing short staggered reveal. Hover lift is limited to
compact action buttons and interactive cards. Motion must respect usability and
must not become a prerequisite for understanding state.

## 10. Loading, Error, and Empty States

- The page shows a structural skeleton while authorized KPI sources load.
- Individual cards and charts own their loading states.
- Schedule load failure shows a translated generic error.
- Other dashboard data components do not yet expose explicit query-error states;
  this is known debt rather than intended behavior.
- Empty lists explain that no matching record exists.
- Missing numeric data falls back to zero only where zero is a valid business
  default.
- Missing exchange rates use an em dash.

Every data component should expose an error state. A loading skeleton followed
by a misleading empty state is not acceptable.

## 11. Accessibility and i18n

- Interactive rows use router links or buttons with clear destinations.
- Icon-only controls require `title` and/or `aria-label`.
- Touch targets should remain usable on mobile.
- All user-visible copy must come from i18n namespaces.
- Turkish is the primary UI language.

Known i18n debt exists in dashboard components and is tracked below.

## 12. Known Gaps and Decisions to Make

These are the only open dashboard items currently identified.

### 12.1 Invalid `/tasks` destination

`QuickActionsBar` and `TodayTaskChecklist` link to `/tasks`, but `src/App.jsx`
does not define that route.

A product decision is required:

- remove the Tasks action/link;
- point it to an existing operational screen; or
- explicitly approve and build a Tasks route.

Do not add a route as an incidental documentation fix.

### 12.2 Dashboard i18n debt

The following components contain user-facing Turkish text or labels directly in
JSX:

- `WorkOrderStatusDonut`
- `TodayTaskChecklist`
- `RevenueExpenseLineChart` month abbreviations
- `OverduePaymentsList` month-count suffix

These should move into `src/locales/tr/dashboard.json` or an appropriate shared
namespace in a targeted UI cleanup.

### 12.3 Missing query-error states

Only `TodayScheduleFeed` currently renders an explicit query-error state.
`CurrencyWidget`, `RevenueExpenseLineChart`, `WorkOrderStatusDonut`,
`TodayTaskChecklist`, and `OverduePaymentsList` can make a failed query look like
missing, empty, or zero data.

Each component should distinguish query failure from a legitimate empty result.

### 12.4 Overdue workflow destinations

The overdue-debt KPI and overdue-payment list currently link to `/subscriptions`,
while the dedicated subscription collection workflow lives at
`/subscriptions/collection`. Confirm which destination matches the daily
collection workflow and update both links together.

### 12.5 Schedule rows without a time

The schedule RPC places rows without `scheduled_time` last, but the dashboard
sorts `null` as an empty string and moves those rows to the beginning before
applying the eight-row limit.

Confirm whether unscheduled work should appear first or last, then align the
client sort with that decision.

### 12.6 Card surface consistency

Dashboard analysis cards still use direct gray utility classes while the global
design system is based on warm neutral tokens. A future visual cleanup may
standardize these surfaces, but it should be a scoped UI change rather than
formatting churn.

## 13. Explicitly Out of Scope

- Cashflow forecasting, burn rate, runway, and cash-balance management
- Paraşüt operational status
- Customer health scoring
- Technician performance scoring
- Proposal pipeline forecasting
- New dashboard routes
- New realtime subscriptions without a demonstrated need

## 14. Maintenance Rule

When dashboard code changes:

1. Verify the real component and query behavior.
2. Update the relevant current-state section here.
3. Add an item to “Known Gaps” only when the work is genuinely unresolved.
4. Remove resolved gaps instead of retaining historical implementation notes.
5. Move historical plans to `docs/archive/completed/` if they are still useful;
   do not mix them back into this current-state document.
