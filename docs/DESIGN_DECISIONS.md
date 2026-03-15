# DESIGN_DECISIONS.md — Ornet ERP Dashboard Redesign
> Single source of truth for all dashboard UI/UX decisions.
> Produced: 2026-03-14. Do not edit individual sections in isolation — changes must be reflected across all dependent sections.

---

## 0. Scope

This document covers:
- The main dashboard page (`src/pages/DashboardPage.jsx`)
- KPI stat cards and sparkline financial cards
- Dashboard layout grid and zone map
- Sidebar visual refinements (architecture unchanged)
- Chart color system
- Typography hierarchy
- Micro-interactions
- Implementation order

What is NOT in scope: routing changes, new Supabase migrations, existing feature pages.

---

## 1. Design Philosophy

Reference: Linear (information density) + Vercel (surface hierarchy) + Supabase Studio (data-first clarity).

**Core rules:**
- Data breathes — every pixel earns its place
- Color communicates meaning, never mood
- Dark mode is primary; light mode is fully supported
- Glassmorphism in dark mode only; solid surfaces in light mode
- No framer-motion — CSS transitions only
- No new npm dependencies except Recharts (already planned)

---

## 2. Color Token System

### 2.1 Surface Tokens

```
DARK MODE                         LIGHT MODE
─────────────────────────────     ──────────────────────────────
--bg-base:       #0a0a0a          --bg-base:       #fafafa
--bg-surface:    #111111          --bg-surface:     #ffffff
--bg-elevated:   #1a1a1a          --bg-elevated:    #f4f4f5
--bg-overlay:    #222222          --bg-overlay:     #e4e4e7
```

### 2.2 Glassmorphism Tokens (dark mode only)

Applied to KPI cards, sparkline cards, and chart containers.

```
--glass-bg:       bg-gray-800/40        (rgba(31,41,55,0.4))
--glass-border:   border-white/10       (rgba(255,255,255,0.1))
--glass-blur:     backdrop-blur-sm      (8px)
--glass-hover-bg: bg-gray-800/60
--glass-hover-border: border-white/20
```

**Light mode override (same components):**
```
--solid-bg:       bg-white
--solid-border:   border-gray-200
--solid-hover-bg: bg-gray-50
--solid-hover-border: border-gray-300
```

**Tailwind class pattern for any glass card:**
```jsx
className="
  rounded-xl border p-5 cursor-pointer
  transition-all duration-150

  /* dark: glass */
  dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10
  dark:hover:bg-gray-800/60 dark:hover:border-white/20

  /* light: solid */
  bg-white border-gray-200
  hover:bg-gray-50 hover:border-gray-300

  hover:-translate-y-px
"
```

### 2.3 Border Tokens

```
DARK                              LIGHT
--border-subtle:  #1f1f1f         --border-subtle:  #f0f0f0
--border-default: border-white/10 --border-default: border-gray-200
--border-strong:  border-white/20 --border-strong:  border-gray-300
```

### 2.4 Typography Tokens

```
DARK                              LIGHT
--text-primary:   #f5f5f5         --text-primary:   #09090b
--text-secondary: #a3a3a3         --text-secondary: #71717a
--text-tertiary:  #525252         --text-tertiary:  #a1a1aa
```

Tailwind equivalents:
```
text-neutral-50  dark:text-neutral-50    ← primary values
text-neutral-500 dark:text-neutral-400   ← labels, captions
text-neutral-600 dark:text-neutral-600   ← timestamps, placeholders
```

### 2.5 Accent & Semantic Colors

```
--accent:              #3b82f6   (blue-500)    ← links, CTAs, active nav
--accent-subtle-dark:  blue-900/50             ← accent backgrounds dark
--accent-subtle-light: blue-50                 ← accent backgrounds light

--status-success:      #22c55e   (green-500)
--status-success-bg-dark:  green-950
--status-success-bg-light: green-50

--status-warning:      #f59e0b   (amber-500)
--status-warning-bg-dark:  amber-950
--status-warning-bg-light: amber-50

--status-danger:       #ef4444   (red-500)
--status-danger-bg-dark:   red-950
--status-danger-bg-light:  red-50

--status-neutral:      #6b7280   (gray-500)
--status-neutral-bg:   zinc-900 / zinc-100
```

### 2.6 Alert Card Variant

When a KPI value signals a problem (e.g. overdue count > 0), the card gets:
```jsx
// Add conditionally via `variant="alert"` prop
dark:border-red-900/50 dark:border-l-4 dark:border-l-red-500 dark:bg-red-950/20
border-red-200 border-l-4 border-l-red-500 bg-red-50
```

---

## 3. Typography Hierarchy

Font stack: system fonts only — no new dependencies.
```css
font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
```

All metric numbers must use tabular figures to prevent layout shift on update:
```css
font-variant-numeric: tabular-nums;
/* Tailwind: font-variant-numeric → use inline style or @apply in index.css */
```

| Role | Tailwind Classes | Usage |
|------|-----------------|-------|
| `metric-xl` | `text-3xl font-bold tracking-tighter` | KPI card main value |
| `metric-lg` | `text-2xl font-semibold` | Sparkline card value |
| `section-label` | `text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500` | Section headings, card labels |
| `card-label` | `text-xs font-medium text-neutral-500 dark:text-neutral-400` | KPI card title above value |
| `delta` | `text-xs font-medium` + semantic color | Trend arrow + percentage |
| `list-primary` | `text-sm font-medium text-neutral-900 dark:text-neutral-50` | List row main text |
| `list-secondary` | `text-xs text-neutral-500 dark:text-neutral-400` | List row subtext |
| `chart-axis` | `text-[11px] text-neutral-600 dark:text-neutral-600` | Recharts axis labels |
| `timestamp` | `text-xs text-neutral-600 dark:text-neutral-600` | "2 saat önce", timestamps |

---

## 4. Layout Grid & Dashboard Zone Map

### 4.1 Grid Spec

```
Desktop  (≥1280px): 12-column, 24px gutters, 32px page padding
Tablet   (≥768px):   8-column, 20px gutters, 24px page padding
Mobile   (<768px):   4-column, 16px gutters, 16px page padding
```

### 4.2 KPI Card Responsive Grid

```
Mobile  (<768px):  2-column  → grid-cols-2 gap-3
Tablet  (768px+):  3-column  → sm:grid-cols-3 gap-4
Desktop (1280px+): 6-column  → xl:grid-cols-6 gap-4
```

No exceptions. Sparkline cards follow the same grid — they do NOT stack to full-width on mobile.

### 4.3 Zone Map

```
┌────────────────────────────────────────────────────────────────┐
│  ZONE A — KPI Strip                                            │
│  grid-cols-2 sm:grid-cols-3 xl:grid-cols-6  gap-3 sm:gap-4    │
│  [Geciken İE] [Bugün Plan.] [Aktif Ab.] [MRR] [Tahsil Ed.] [Kâr] │
├─────────────────────────────────┬──────────────────────────────┤
│  ZONE B1 — Primary Chart        │  ZONE B2 — Today's Feed      │
│  col-span-12 lg:col-span-8      │  col-span-12 lg:col-span-4   │
│  RevenueExpenseLineChart        │  TodayScheduleFeed           │
│  (last 6 months)                │  (today's work orders)       │
├─────────────────────────────────┴──────────────────────────────┤
│  ZONE C — Sparkline Financial Cards                            │
│  grid-cols-2 sm:grid-cols-3 xl:grid-cols-3  gap-3 sm:gap-4    │
│  [Aylık Gelir+spark] [Abonelikler+spark] [MRR+spark]          │
├─────────────────┬──────────────────────────────────────────────┤
│  ZONE D1        │  ZONE D2 — Overdue Payments List             │
│  WO Status      │  col-span-12 lg:col-span-8                   │
│  Donut          │  OverduePaymentsList                         │
│  lg:col-span-4  │                                              │
├─────────────────┴──────────────────────────────────────────────┤
│  ZONE E — Today's Task Checklist + Pending Proposals Feed      │
│  col-span-12 lg:col-span-6 each                                │
└────────────────────────────────────────────────────────────────┘
```

**Mobile zone order (single column, stacked):**
E (Quick Actions) → A (KPI strip) → B2 (Today's Feed) → C (Sparkline cards) → B1 (Chart) → D2 (Overdue list) → D1 (Donut) → E (Checklists)

Actions and schedule first on mobile — a field tech needs the schedule before the revenue chart.

### 4.4 Spacing Rhythm

Base unit: 8px.

```
4px   → gap-1   micro (icon-to-label, badge padding)
8px   → gap-2   small (list item internal)
12px  → gap-3   medium (mobile card gap)
16px  → gap-4   default card gap
20px  → p-5     card internal padding
24px  → gap-6   desktop between major cards
32px  → gap-8   between dashboard zones/sections
44px  →         minimum touch target height (row height in feeds)
```

---

## 5. Component Catalog

### 5.1 KPIStatCard

**When to use:** Operational metrics — counts, status numbers. No chart.
**Source data:** `get_dashboard_stats()` RPC, `get_subscription_stats()` RPC

Props:
```js
{
  title: string,          // e.g. "Geciken İş Emirleri"
  value: string,          // e.g. "12" or "₺84,200"
  icon: LucideIcon,
  trendChange: string,    // e.g. "+3" or "+12.4%"
  trendType: 'up' | 'down' | 'neutral',
  variant: 'default' | 'alert',   // alert = red border accent
  href: string,           // click navigates to filtered list page
}
```

Visual anatomy:
```
┌─────────────────────────────────────┐
│  CARD LABEL (xs uppercase)  [icon]  │
│                                     │
│  84,200                             │  ← text-3xl font-bold tabular-nums
│                                     │
│  ↑ 12.4%  vs. geçen ay              │  ← text-xs semantic color
└─────────────────────────────────────┘
```

**Important:** The entire card is a clickable `<Link>` to `href`. Wrap with `react-router-dom Link`, not `<a>`.

Trend logic (direct port from DrdMetricCard, TypeScript stripped):
```js
const TrendIcon = trendType === 'up' ? ArrowUp : trendType === 'down' ? ArrowDown : Minus;
const trendColor =
  trendType === 'up'   ? 'text-green-400' :
  trendType === 'down' ? 'text-red-400'   :
  'text-neutral-500';
```

**Note on trend direction vs. business meaning:** "Geciken İş Emirleri" going up (`trendType='up'`) is BAD. Caller is responsible for passing the correct `variant='alert'` when the value is undesirable. The component itself does not infer this — it only renders what it receives.

---

### 5.2 SparklineStatCard

**When to use:** Financial/revenue metrics only. Has embedded mini line chart.
**Source data:** Financial time-series from `financial_transactions` or `subscription_payments`

Props:
```js
{
  title: string,
  value: string,
  change: string,         // e.g. "+20.1%"
  changeType: 'positive' | 'negative',
  icon: LucideIcon,
  chartData: Array<{ name: string, value: number }>,
}
```

Sparkline spec:
```
Height:    h-12 (48px)
Width:     w-28 (112px)
Position:  absolute bottom-right corner of card
Line:      strokeWidth={2}, dot={false}
Color:     positive → #22c55e (green-500), negative → #ef4444 (red-500)
Fill:      linearGradient, stopOpacity 0.15 → 0
Tooltip:   custom dark glass (see Section 7.3)
```

linearGradient id must be unique per card instance — use React's `useId()` hook:
```js
const id = useId(); // → generates ":r0:", ":r1:", etc.
// <linearGradient id={`sparkGrad-${id}`}>
```

**Cards with sparklines:**
1. `Aylık Toplam Gelir` — data from `financial_transactions` last 7 months, summed by month
2. `Aktif Abonelikler` — data from `subscription_payments` active count by month
3. `MRR` — data from `get_subscription_stats()` per month (needs new RPC or client-side calculation)

---

### 5.3 RevenueExpenseLineChart

Chart type: Multi-series line chart (Recharts `LineChart`)
Data: `financial_transactions` grouped by month, last 6 months
Series: Revenue (blue) + Expense (rose) + optional Net (green)

```js
// Recharts config
<LineChart data={monthlyData}>
  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
  <XAxis dataKey="month" tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
  <YAxis tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTL} />
  <Tooltip content={<CustomChartTooltip />} />
  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
  <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} dot={false} />
</LineChart>
```

Area fill under revenue line (optional, subtle):
```jsx
<defs>
  <linearGradient id="revenueAreaGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.12} />
    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
  </linearGradient>
</defs>
```

---

### 5.4 WorkOrderStatusDonut

Chart type: Recharts `PieChart` with inner radius (donut)
Data: Current WO counts by status from `get_dashboard_stats()`

```js
const WO_STATUS_COLORS = {
  pending:     '#f59e0b',  // amber
  in_progress: '#3b82f6',  // blue
  completed:   '#22c55e',  // green
  cancelled:   '#6b7280',  // gray
};
```

Segment stroke: `stroke="#0a0a0a" strokeWidth={2}` — creates the gap between segments.
Center label: Total count, `text-2xl font-bold`.

---

### 5.5 TodayScheduleFeed

List of today's work orders sorted by `scheduled_time`.
Max visible rows: 8. Overflow → "Tümünü Gör" link to `/daily-work`.

Row anatomy:
```
[time]  [customer name]     [type badge]  [status chip]
08:30   Akdeniz Güvenlik    Montaj        Planlandı
```

Row height: 44px. Divider: `border-b border-white/5 dark:border-white/5 border-gray-100`.
Empty state: `"Bugün planlanmış iş emri yok."` — short, human, no icon needed.

---

### 5.6 OverduePaymentsList

Source: `subscription_payments` where `status = 'pending'` AND `payment_month < (today - 30 days)`.
Sorted by: months overdue descending (worst first).
Max visible rows: 7. Overflow → "Tümünü Gör" link to `/subscriptions`.

Row anatomy:
```
[customer name]  [X ay gecikmiş]  [₺ amount]  [Ara →]
Merkez Plaza     3 ay             ₺2,400       [button]
```

The `[Ara →]` button is a `tel:` link using the customer's phone number — one tap to call from mobile.
Row background on hover: `dark:hover:bg-red-950/20 hover:bg-red-50` — subtle danger tint.

---

### 5.7 TodayTaskChecklist

Source: `tasks` table filtered for `due_date = today` AND `assigned_to = currentUser.id` AND `status != 'completed'`.
"Tümünü Gör" link replaces "Reset" button — links to `/tasks`.

Row anatomy:
```
☐  [Task title bold]
   [Gray description text]
   ⚠ "3 gündür bekliyor"  ← amber italic, only if overdue
   ─────────────────────
```

Counter: `"X / Y tamamlandı"` — X updates optimistically on checkbox click via React Query mutation.
Checking a task fires `UPDATE tasks SET status = 'completed'` — standard mutation pattern.

Overdue tip row threshold: `due_date < today`. Days calculation:
```js
const daysOverdue = differenceInDays(new Date(), parseISO(task.due_date));
// Show amber row if daysOverdue > 0
// Text: daysOverdue === 1 ? "1 gündür bekliyor" : `${daysOverdue} gündür bekliyor`
```

---

### 5.8 QuickActionsBar

Full-width horizontal strip. 5 action buttons. Horizontal scroll on mobile (no wrap).

| Button | Label | Route | Icon |
|--------|-------|-------|------|
| 1 | Yeni İş Emri | `/work-orders/new` | `ClipboardList` |
| 2 | Yeni Müşteri | `/customers/new` | `UserPlus` |
| 3 | Günlük İş | `/daily-work` | `CalendarCheck` |
| 4 | Görevlerim | `/tasks` | `Target` |
| 5 | Aksiyon Panosu | `/action-board` | `AlertCircle` (admin only) |

Button style: `variant="outline"` from existing `Button` component. No change to Button component itself.

---

## 6. Chart Color Palette

Single source of truth. Import from `src/lib/chartTheme.js`.

```js
// src/lib/chartTheme.js
export const CHART_COLORS = {
  // Financial series
  revenue:  '#3b82f6',   // blue-500
  expense:  '#f43f5e',   // rose-500
  profit:   '#22c55e',   // green-500
  mrr:      '#3b82f6',   // blue-500

  // Work order types
  montaj:   '#8b5cf6',   // violet-500
  servis:   '#f59e0b',   // amber-500
  bakim:    '#06b6d4',   // cyan-500
  kesif:    '#6b7280',   // gray-500

  // Status
  pending:     '#f59e0b',
  in_progress: '#3b82f6',
  completed:   '#22c55e',
  cancelled:   '#6b7280',

  // Chart infrastructure
  grid:    '#1f1f1f',    // dark grid lines
  axis:    '#525252',    // axis label text
  tooltip: '#1a1a1a',    // tooltip background (dark)
};

export const SPARKLINE_COLORS = {
  positive: '#22c55e',   // green-500
  negative: '#ef4444',   // red-500
};
```

**Rule:** Maximum 3 simultaneous series on any single chart. If 4+ are needed, use opacity variants of the same hue.

---

## 7. Micro-Interactions

All CSS only. No framer-motion.

### 7.1 Card Hover Lift
```css
/* Applied to KPIStatCard and SparklineStatCard */
transition-all duration-150
hover:-translate-y-px     /* 1px only — not 4px, not dramatic */
```

### 7.2 Delta Badge Fade-In
```css
/* Applied to the trend line inside KPIStatCard */
.delta-badge {
  animation: fadeSlideUp 200ms ease-out 400ms both;
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Add this to `src/index.css`. Uses existing CSS file — not a new file.

### 7.3 Custom Chart Tooltip
Used by both `RevenueExpenseLineChart` and `SparklineStatCard`.
```jsx
// src/components/ui/ChartTooltip.jsx
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="
      rounded-lg border px-3 py-2 text-sm shadow-lg
      dark:bg-gray-900/80 dark:border-white/10 dark:backdrop-blur-sm dark:text-white
      bg-white border-gray-200 text-gray-900
    ">
      {label && <p className="text-xs text-neutral-500 mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}
```

### 7.4 Feed Row Reveal
```css
/* Staggered entrance for list rows — add to index.css */
.feed-row {
  animation: rowReveal 250ms ease-out var(--row-delay, 0ms) both;
}
@keyframes rowReveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Apply `--row-delay` inline per row: `style={{ '--row-delay': `${index * 50}ms` }}`. Max 6 rows with stagger — beyond that, remove animation.

### 7.5 Alert Card Pulse
```css
/* Applied to the left border of alert variant KPIStatCard */
.alert-accent-border {
  animation: softPulse 2.5s ease-in-out infinite;
}
@keyframes softPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

### 7.6 Button Press
```css
/* Already handled by existing Button component's active:scale-95 */
/* Do not duplicate */
```

### 7.7 Skeleton Loaders
Every card must have a skeleton that matches its exact shape. Use existing `CardSkeleton` from `src/components/ui/` as the base. Do not use generic grey blocks.

---

## 8. Sidebar Refinements

**Architecture: DO NOT CHANGE.** The existing `Sidebar.jsx` + `NavGroup.jsx` + `navItems.js` remain intact.

Visual changes only. Apply as Tailwind class updates inside the existing files.

### 8.1 Reduce Visual Noise

Current problem: All nav groups are always visible and compete for attention equally.

Fix:
1. **Section group labels** — reduce from current weight to `text-[11px] font-semibold uppercase tracking-widest` with `opacity-60`. They should feel like metadata, not headings.
2. **Inactive nav items** — reduce icon opacity: `opacity-70` on the icon `w-5 h-5`, restored to `opacity-100` on hover and active. Subtle but effective.
3. **Group separator lines** — replace `border-t` between groups with `mt-4` spacer only. Fewer lines = less clutter.

### 8.2 Collapsed Mode (Icon-Only, Linear-Style)

When `isCollapsed={true}`:
- Show icons only. No text.
- `title` attribute on each `<NavLink>` already in place — browser shows native tooltip. Keep this.
- Group labels hidden entirely (already handled by `isCollapsed` guard).
- Nav item: `justify-center px-2`, icon fills the space.
- Existing implementation already does this correctly. ✓

### 8.3 Brand / Logo Area Upgrade

Replace current plain text `h1` with:
```
┌──────────────────────────────────────┐
│  [O]  Ornet ERP                      │  ← expanded
│       Admin  ←─ role subtitle        │
└──────────────────────────────────────┘

┌──────────┐
│   [O]    │  ← collapsed (icon only)
└──────────┘
```

Role subtitle implementation:
```jsx
// In Sidebar.jsx brand section, expanded state only
{!isCollapsed && (
  <div>
    <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
      {tCommon('appName')}
    </span>
    <span className="block text-[11px] text-neutral-500 dark:text-neutral-500 capitalize">
      {currentProfile?.role || 'Kullanıcı'}
    </span>
  </div>
)}
```

### 8.4 Collapse Toggle — ChevronsRight Pattern

Replace the current collapse mechanism with the `ChevronsRight` bottom toggle from the inspiration component:

```jsx
// Placed at absolute bottom of sidebar, above user section
<button
  onClick={onToggleCollapse}   // prop passed from AppLayout
  className="
    w-full flex items-center border-t p-3
    border-neutral-200 dark:border-[#262626]
    hover:bg-neutral-50 dark:hover:bg-neutral-800
    transition-colors duration-150
  "
>
  <div className="grid size-10 place-content-center">
    <ChevronsRight className={cn(
      'h-4 w-4 text-neutral-500 transition-transform duration-300',
      !isCollapsed && 'rotate-180'
    )} />
  </div>
  {!isCollapsed && (
    <span className="text-sm text-neutral-500 dark:text-neutral-400">
      {tCommon('nav.collapse')}  {/* add this key to common.json */}
    </span>
  )}
</button>
```

### 8.5 Active State — No Change

Current active state (`border-l-2 border-primary-600 bg-primary-50 dark:bg-primary-950/30`) matches the inspiration exactly. No changes needed.

---

## 9. Status Chips / Badges

Design: pill-shaped, no icons unless critical, 20px height.

```
Tamamlandı:   dark:bg-green-950  dark:text-green-400   dark:border-green-900/50
              bg-green-50        text-green-700         border-green-200

Devam Ediyor: dark:bg-amber-950  dark:text-amber-400   dark:border-amber-900/50
              bg-amber-50        text-amber-700         border-amber-200

Gecikmiş:     dark:bg-red-950    dark:text-red-400     dark:border-red-900/50
              bg-red-50          text-red-700           border-red-200

Planlandı:    dark:bg-zinc-900   dark:text-zinc-400    dark:border-zinc-800
              bg-zinc-100        text-zinc-600          border-zinc-200

Taslak:       dark:bg-zinc-900   dark:text-zinc-500    dark:border-zinc-800
              bg-zinc-50         text-zinc-500          border-zinc-200
```

Chip Tailwind template:
```jsx
<span className="inline-flex items-center px-2 h-5 rounded-full text-xs font-medium border
  dark:bg-green-950 dark:text-green-400 dark:border-green-900/50
  bg-green-50 text-green-700 border-green-200">
  Tamamlandı
</span>
```

---

## 10. Data Fetching Architecture

No changes to existing React Query patterns. Dashboard-specific additions:

### New RPC / Query needed for charts

| Chart | New RPC or Query? | Notes |
|-------|------------------|-------|
| RevenueExpenseLineChart | New RPC: `get_monthly_revenue_expense(months: 6)` | Groups `financial_transactions` by month |
| WorkOrderStatusDonut | Already in `get_dashboard_stats()` | Use `pending_work_orders`, `in_progress_work_orders`, `completed_this_week` |
| SparklineStatCard — Gelir | New query: last 7 months from `financial_transactions` | Client-side grouping acceptable |
| SparklineStatCard — Abonelikler | New query: monthly active sub count from `subscription_payments` | Needs a new view or RPC |
| SparklineStatCard — MRR | Extend `get_subscription_stats()` or add `get_mrr_history()` | One new RPC |

Hook location: `src/features/dashboard/hooks.js` — all dashboard queries in one place.

### Query keys

```js
export const dashboardKeys = {
  stats:          ['dashboard', 'stats'],
  schedule:       ['dashboard', 'schedule'],
  tasks:          ['dashboard', 'tasks'],
  monthlyRevenue: ['dashboard', 'monthly-revenue'],
  overduePayments:['dashboard', 'overdue-payments'],
  sparklineData:  (metric) => ['dashboard', 'sparkline', metric],
};
```

---

## 11. New i18n Keys Required

Add to `src/locales/tr/dashboard.json`:

```json
{
  "kpi": {
    "overdueWorkOrders": "Geciken İş Emirleri",
    "todayPlanned": "Bugün Planlanan",
    "activeSubscriptions": "Aktif Abonelik",
    "mrr": "Aylık Tekrar Eden Gelir",
    "uncollectedPayments": "Tahsil Edilemeyen",
    "netProfit": "Net Kâr (Bu Ay)"
  },
  "sparkline": {
    "monthlyRevenue": "Aylık Toplam Gelir",
    "subscriptions": "Aktif Abonelikler",
    "mrrTrend": "MRR Trendi"
  },
  "sections": {
    "todaySchedule": "Bugünün Programı",
    "overduePayments": "Geciken Ödemeler",
    "todayTasks": "Bugünün Görevleri",
    "revenueChart": "Gelir / Gider"
  },
  "feed": {
    "viewAll": "Tümünü Gör",
    "emptySchedule": "Bugün planlanmış iş emri yok.",
    "emptyTasks": "Bugün için görev yok.",
    "emptyPayments": "Geciken ödeme bulunmuyor.",
    "daysOverdue_one": "{{count}} gündür bekliyor",
    "daysOverdue_other": "{{count}} gündür bekliyor",
    "monthsOverdue_one": "{{count}} ay gecikmiş",
    "monthsOverdue_other": "{{count}} ay gecikmiş",
    "call": "Ara"
  },
  "checklist": {
    "counter": "{{completed}} / {{total}} tamamlandı"
  }
}
```

---

## 12. New Files to Create

```
src/
├── lib/
│   └── chartTheme.js              ← Section 6 color constants
├── features/dashboard/
│   ├── hooks.js                   ← extend with new query hooks
│   └── components/
│       ├── KPIStatCard.jsx
│       ├── SparklineStatCard.jsx
│       ├── RevenueExpenseLineChart.jsx
│       ├── WorkOrderStatusDonut.jsx
│       ├── TodayScheduleFeed.jsx
│       ├── OverduePaymentsList.jsx
│       ├── TodayTaskChecklist.jsx
│       └── QuickActionsBar.jsx
└── components/ui/
    └── ChartTooltip.jsx           ← shared tooltip (Section 7.3)
```

No new pages. No new routes. No new npm packages except Recharts.

**Files to modify (not replace):**
```
src/pages/DashboardPage.jsx         ← full redesign using new components
src/components/layout/Sidebar.jsx   ← visual tweaks only (Sections 8.1–8.4)
src/locales/tr/dashboard.json       ← add Section 11 keys
src/index.css                       ← add Section 7 keyframe animations
```

---

## 13. Implementation Order

Build in this sequence. Each step is independently shippable.

| # | Task | Files | Blocker? |
|---|------|-------|----------|
| 1 | `src/lib/chartTheme.js` | New | None — 5 min |
| 2 | `ChartTooltip.jsx` | New UI component | None |
| 3 | `KPIStatCard.jsx` | New dashboard component | chartTheme.js |
| 4 | CSS keyframes in `index.css` | Edit | None |
| 5 | `SparklineStatCard.jsx` | New dashboard component | chartTheme.js, Recharts installed |
| 6 | `TodayScheduleFeed.jsx` | New — uses existing `get_today_schedule()` | None |
| 7 | `TodayTaskChecklist.jsx` | New — uses existing `get_my_pending_tasks()` | None |
| 8 | `OverduePaymentsList.jsx` | New — needs new RPC query | New RPC migration |
| 9 | `RevenueExpenseLineChart.jsx` | New — needs `get_monthly_revenue_expense()` | New RPC migration |
| 10 | `WorkOrderStatusDonut.jsx` | New — uses existing stats | None |
| 11 | `QuickActionsBar.jsx` | Refactor existing quick actions | None |
| 12 | `DashboardPage.jsx` | Compose all components into zone layout | All above |
| 13 | Sidebar visual tweaks | Edit `Sidebar.jsx` | None — last, lowest risk |

Steps 1–7 and 10–11 require zero new SQL migrations. Ship them first to get the visual system in place. Steps 8–9 need new RPCs — schedule those with the backend work.

---

## 14. What NOT to Build (Explicitly Deferred)

- Technician performance chart — no `assigned_to` aggregation RPC exists yet
- Proposal pipeline funnel — deferred to Proposals module Phase 3
- MRR historical sparkline — needs `get_mrr_history()` RPC (not yet created)
- Customer health scores — deferred to Customer Situation Tracking feature
- Real-time updates — no Supabase Realtime subscription on dashboard; polling via React Query `refetchInterval` is sufficient
- Role-specific dashboard views — single dashboard for now, role-based show/hide per section using existing `currentProfile.role`

---

*End of DESIGN_DECISIONS.md*
