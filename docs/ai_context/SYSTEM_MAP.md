# SYSTEM_MAP — Ornet ERP

> Machine-readable context map. No prose. Pure structure.

---

## Tech Stack (pinned versions)

| Layer | Tech | Version |
|-------|------|---------|
| Runtime | React | 19.x |
| Build | Vite | 7.x |
| Routing | react-router-dom | 7.x |
| Server State | @tanstack/react-query | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Backend | Supabase (PostgreSQL 15) | JS SDK 2.x |
| Styling | Tailwind CSS | 4.x |
| i18n | i18next + react-i18next | 25.x / 16.x |
| Charts | recharts | 3.x |
| Calendar | react-big-calendar | 1.x |
| PDF Gen | @react-pdf/renderer | 4.x |
| PDF Parse | pdfjs-dist | 5.x |
| Excel | xlsx | 0.18.x |
| Toasts | sonner | 2.x |
| Dates | date-fns | 4.x |
| Icons | lucide-react | 0.563.x |
| Errors | @sentry/react | 10.x |

---

## Directory Pattern

```
src/
├── features/{module}/          # Domain modules (21 modules)
│   ├── api.js                  # Supabase queries, query key factory
│   ├── hooks.js                # React Query hooks (queries + mutations)
│   ├── schema.js               # Zod validation schemas
│   ├── index.js                # Barrel re-exports (no JSX)
│   ├── {Name}Page.jsx          # Page components
│   └── components/             # Module-specific components
├── components/
│   ├── ui/                     # Shared UI (Button, Modal, Badge, etc.)
│   └── layout/                 # Shell (Sidebar, Header, PageContainer)
├── hooks/                      # Global hooks (useAuth, useTheme, etc.)
├── lib/                        # Utilities (supabase client, i18n config, etc.)
├── locales/tr/                 # 22 Turkish translation JSON files
├── pages/DashboardPage.jsx     # Dashboard (only page outside features/)
├── App.jsx                     # Router config
└── main.jsx                    # Entry point
```

### Data Flow (invariant)

```
Component.jsx → useHook() → api.js → supabase.from('table') → PostgreSQL
                    ↓
              React Query Cache
              (queryKey factory)
```

### File Extension Rule

```
.jsx  →  Contains JSX (components, pages)
.js   →  Pure JS (api, hooks, schema, barrel exports, utils)
```

**CONSTRAINT:** Vite/Rollup will fail to parse JSX in `.js` files. Never put JSX in `.js`.

---

## React Query Cache Key Registry

All cache keys follow factory pattern. Cross-module invalidation is explicit.

| Module | Key Root | Location |
|--------|----------|----------|
| `customerKeys` | `['customers']` | `features/customers/hooks.js` |
| `siteKeys` | `['sites']` | `features/customerSites/api.js` |
| `workOrderKeys` | `['workOrders']` | `features/workOrders/hooks.js` |
| `serviceRequestKeys` | `['service_requests']` | `features/operations/api.js` |
| `subscriptionKeys` | `['subscriptions']` | `features/subscriptions/hooks.js` |
| `paymentMethodKeys` | `['payment_methods']` | `features/subscriptions/hooks.js` |
| `transactionKeys` | `['transactions']` | `features/finance/api.js` |
| `categoryKeys` | `['expense_categories']` | `features/finance/api.js` |
| `rateKeys` | `['exchange_rates']` | `features/finance/api.js` |
| `profitAndLossKeys` | `['profitAndLoss']` | `features/finance/api.js` |
| `vatReportKeys` | `['vatReport']` | `features/finance/api.js` |
| `financeDashboardKeys` | `['financeDashboard']` | `features/finance/api.js` |
| `collectionKeys` | `['collection']` | `features/finance/collectionApi.js` |
| `proposalKeys` | `['proposals']` | `features/proposals/hooks.js` |
| `simCardKeys` | `['simCards']` | `features/simCards/hooks.js` |
| `providerCompanyKeys` | `['providerCompanies']` | `features/simCards/hooks.js` |
| `materialKeys` | `['materials']` | `features/materials/api.js` |
| `assetKeys` | `['site_assets']` | `features/siteAssets/api.js` |
| `calendarKeys` | `['calendar']` | `features/calendar/hooks.js` |
| `taskKeys` | `['tasks']` | `features/tasks/hooks.js` |
| `notificationKeys` | `['notifications']` | `features/notifications/hooks.js` |
| `dashboardKeys` | `['dashboard']` | `features/dashboard/hooks.js` |
| `workHistoryKeys` | `['workHistory']` | `features/workHistory/hooks.js` |
| `actionBoardKeys` | `['actionBoard']` | `features/actionBoard/hooks.js` |

### Cross-Module Invalidation Map

```
operations.useConvertToWorkOrder  →  invalidates: serviceRequestKeys, workOrderKeys
operations.useBoomerangRequest    →  invalidates: serviceRequestKeys, workOrderKeys
collection.useCollectionRecordPayment → invalidates: collectionKeys, subscriptionKeys, transactionKeys, financeDashboardKeys, profitAndLossKeys
```

**RULE:** When a mutation affects data visible in another module, both caches MUST be invalidated.

---

## Database Architecture

### Migration System

- **Location:** `supabase/migrations/`
- **Count:** 160 files (00001–00160)
- **Naming:** `00NNN_description.sql` (sequential, never reorder)
- **Execution:** `supabase db push` (applies in order)

### Migration Ranges

| Range | Domain |
|-------|--------|
| 00001–00007 | Core: profiles, customers, customer_sites, work_orders, tasks, materials |
| 00008–00015 | Material views, functions, task rebuild |
| 00016–00022 | Subscriptions, invoice logic, permissions |
| 00023–00026 | SIM cards, views, subscription reactivation |
| 00027–00035 | Proposals, WO bridge, cost tracking |
| 00036–00039 | Multi-service, 6-month billing, stats |
| 00040–00053 | **Finance Phase 1:** single ledger, triggers, currency flexibility |
| 00054–00063 | SIM ↔ Finance integration, status sync |
| 00064–00073 | Notifications, recurring expenses, cron |
| 00074–00094 | Site assets, soft deletes, static IPs, Turkish search |
| 00095–00109 | Performance, pagination, 3-month billing |
| 00110–00140 | Dashboard RPCs, subscription fees (sim_amount, static_ip) |
| 00141–00159 | Site assets v2, dynamic VAT triggers |
| 00160 | **Operations Board:** service_requests, conversion/boomerang RPCs |

### RLS Pattern (all tables)

```sql
-- SELECT: all authenticated users (soft-delete filtered)
CREATE POLICY "table_select" ON {table} FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- INSERT/UPDATE: admin + accountant only
CREATE POLICY "table_insert" ON {table} FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
  );

-- DELETE: admin only (when implemented)
```

### Soft Delete Pattern

All major tables use `deleted_at TIMESTAMPTZ` column. RLS `USING (deleted_at IS NULL)` filters automatically. API calls set `deleted_at = now()` instead of DELETE.

### Shared Trigger

```sql
-- Reused by all tables with updated_at column
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

---

## Role System

| Role | Value | Access |
|------|-------|--------|
| Admin | `'admin'` | Full access. All routes, all mutations. |
| Accountant | `'accountant'` | Same as admin except: no user management, no action board. |
| Field Worker | `'field_worker'` | Read-only. Can view WOs, daily-work. Cannot access finance, subscriptions, operations. |

```
Hook: useRole()  →  { role, isAdmin, isAccountant, isFieldWorker, canWrite }
Location: src/lib/roles.js
canWrite = isAdmin || isAccountant
```

### Route Guards

```jsx
// App.jsx — wraps restricted routes
<Route path="operations" element={<RoleRoute><OperationsBoardPage /></RoleRoute>} />

// RoleRoute redirects field_workers to /work-orders
function RoleRoute({ children }) {
  const { canWrite, role } = useRole();
  if (role === undefined) return null;
  if (!canWrite) return <Navigate to="/work-orders" replace />;
  return children;
}
```

### Nav Visibility Flags

```
adminOnly: true      →  Only role='admin'
canWriteOnly: true   →  Only admin + accountant
notificationCenter   →  admin + accountant (hardcoded in Sidebar.jsx)
```

---

## i18n Architecture

- **Language:** Turkish only (`lng: 'tr'`)
- **Namespaces:** 22 JSON files in `src/locales/tr/`
- **Registration:** `src/lib/i18n.js` (import + add to `ns[]` + `resources.tr{}`)
- **Usage:** `const { t } = useTranslation('namespace')`

**CONSTRAINT:** Never hardcode Turkish strings. Always use `t('key')`.

### Turkish Search Normalization

```javascript
// src/lib/normalizeForSearch.js
// Maps: ğ→g, ş→s, ı→i, ö→o, ü→u, ç→c (+ uppercase variants)
normalizeForSearch("Boğa Gıda") → "boga gida"
```

**RULE:** All client-side search/filter must use `normalizeForSearch()` for both query and data.

---

## Entity Relationship (key FKs)

```
customers
  └── customer_sites (1:N)
        ├── work_orders.site_id        ← WOs link via site, NOT customer
        ├── subscriptions.site_id
        ├── proposals.site_id
        ├── service_requests.site_id
        └── site_assets.site_id

work_orders
  ├── work_order_materials (1:N)
  ├── proposal_work_orders (N:M with proposals)
  └── service_requests.work_order_id   ← 1:1 back-link from request

subscriptions
  ├── subscription_payments (1:N)      ← one per month per subscription
  ├── sim_cards.id = sim_card_id       ← optional SIM link
  └── payment_methods.id = payment_method_id

financial_transactions                  ← SINGLE LEDGER (all money flows)
  ├── work_order_id                    ← optional, set by WO completion trigger
  ├── proposal_id                      ← optional, set by proposal completion trigger
  ├── subscription_payment_id          ← optional, set by payment trigger
  └── recurring_template_id            ← optional, set by cron job
```

**CRITICAL:** `work_orders` has NO `customer_id` column. Customer is resolved via `site_id → customer_sites → customers`.

---

## Navigation Structure

```
Top-level (5, mobile bottom bar):
  / (Dashboard), /operations, /customers, /work-orders, /proposals

Groups:
  Operasyon:        /notifications, /action-board
  Planlama:         /work-history
  Gelir ve Altyapı: /subscriptions, /sim-cards, /sim-cards/invoice-analysis, /equipment
  Finans:           /finance, /finance/income, /finance/expenses, /finance/vat,
                    /finance/exchange, /finance/recurring, /finance/reports
  Ayarlar:          /materials

Deprecated (routes exist, removed from nav):
  /daily-work      ← accessible by URL for field workers
  /tasks           ← REMOVED (route deleted)
  /calendar        ← REMOVED (absorbed into /operations?tab=calendar)
```
