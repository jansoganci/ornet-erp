# CLAUDE.md - Ornet ERP Project Context

> This file helps Claude understand the project context, architecture, and coding conventions.
> Last updated: 2026-03-13

---

## Project Overview

**Ornet ERP** is a Work Order Management and ERP system built for a Turkish security company. It manages work orders, customers, field technicians, materials, and business operations.

### Target Users
- Field technicians (montaj/servis workers)
- Office staff (scheduling, customer management)
- Accountants (finance, invoicing)
- Administrators (full access)

### Current Features
- Customer management with multi-location support (sites)
- Work order management (keşif, montaj, servis, bakım)
- Task management with mini calendar sidebar and plan groups
- Materials/inventory tracking with import and usage modals
- Daily work tracking
- Work history search
- Calendar view (react-big-calendar)
- Dashboard with metrics and currency widget
- Authentication (login, register, password reset, email verification)
- **Action Board** - Admin-only operational command center
- **Subscription Management** - Monthly/yearly alarm and camera rental tracking with payment grid, pause/cancel, price revisions
- **SIM Card Management** - 2500+ phone numbers in security devices (location, owner, revenue, status) with import and invoice analysis (Turkcell PDF parsing)
- **Proposals/Quotes** - Offer generator with PDF export (@react-pdf/renderer) and work order bridge
- **Finance Module** - Income, expenses, VAT tracking, exchange rates (TCMB), recurring expenses, P&L reports, CSV export
- **Notifications** - In-app notification center with triggered alerts and reminder form
- **Site Assets** - Equipment tracking per customer location with bulk registration
- **User Profile** - Profile management

### Planned Features
- **Customer Situation Tracking** - Current status of all customers
- **Paraşüt Integration** - Connect to Paraşüt accounting system
- **Invoice Automation** - Generate invoices (monthly, yearly, on installation) and auto-send to Paraşüt

---

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Routing | React Router DOM | 7.x |
| State Management | TanStack React Query | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Backend | Supabase (PostgreSQL) | 2.x |
| Styling | Tailwind CSS | 4.x |
| CSS Utilities | clsx + tailwind-merge | 2.x / 3.x |
| Icons | lucide-react | 0.563.x |
| i18n | i18next + react-i18next | 25.x |
| Notifications | sonner | 2.x |
| Date Utils | date-fns | 4.x |
| Charts | recharts | 3.x |
| Calendar | react-big-calendar | 1.x |
| PDF Export | @react-pdf/renderer | 4.x |
| PDF Parsing | pdfjs-dist | 5.x |
| Excel/CSV | xlsx | 0.18.x |
| Error Tracking | @sentry/react | 10.x |

---

## Project Structure

```
src/
├── app/                    # App configuration
│   ├── AppLayout.jsx       # Main layout (sidebar + topbar)
│   ├── providers.jsx       # React Query, Theme, Toaster
│   ├── ProtectedRoute.jsx  # Auth protection wrapper
│   └── AuthRoute.jsx       # Redirect if logged in
│
├── features/               # Feature modules (domain-driven)
│   ├── actionBoard/        # Admin action board
│   ├── auth/               # Authentication
│   ├── calendar/           # Calendar view
│   ├── customers/          # Customer management
│   ├── customerSites/      # Customer locations
│   ├── dashboard/          # Dashboard & metrics
│   ├── finance/            # Income, expenses, VAT, exchange rates, reports
│   ├── materials/          # Materials/inventory
│   ├── notifications/      # In-app notification center
│   ├── profile/            # User profile management
│   ├── proposals/          # Quotes/offers with PDF export
│   ├── service/            # (reserved, empty)
│   ├── simCards/           # SIM card / data card inventory
│   ├── siteAssets/         # Equipment tracking per site
│   ├── subscriptions/      # Subscription & recurring payment management
│   ├── tasks/              # Task management
│   ├── workHistory/        # Work history
│   └── workOrders/         # Work orders
│
├── components/
│   ├── layout/             # Layout components
│   ├── ui/                 # Reusable UI components
│   └── ErrorBoundary.jsx   # Top-level error boundary
│
├── hooks/                  # Global hooks
│   ├── useAuth.js          # Authentication
│   ├── useDebouncedValue.js# Debounce hook for search inputs
│   ├── useSearchInput.js   # Search input state management
│   ├── useTheme.jsx        # Theme toggle
│   ├── useUnsavedChanges.js# Warn before leaving with unsaved changes
│   └── themeContext.js     # Theme context provider
│
├── lib/                    # Utilities
│   ├── breadcrumbConfig.js # Breadcrumb route definitions
│   ├── csvExport.js        # CSV export utility
│   ├── errorHandler.js     # Error localization
│   ├── i18n.js             # i18next config (21 namespaces)
│   ├── normalizeForSearch.js # Turkish character normalization for search
│   ├── supabase.js         # Supabase client
│   └── utils.js            # Helper functions
│
├── locales/tr/             # Turkish translations (21 files)
│   ├── actionBoard.json
│   ├── auth.json
│   ├── calendar.json
│   ├── common.json
│   ├── customers.json
│   ├── dailyWork.json
│   ├── dashboard.json
│   ├── errors.json
│   ├── finance.json
│   ├── invoiceAnalysis.json
│   ├── materials.json
│   ├── notifications.json
│   ├── profile.json
│   ├── proposals.json
│   ├── recurring.json
│   ├── simCards.json
│   ├── siteAssets.json
│   ├── subscriptions.json
│   ├── tasks.json
│   ├── workHistory.json
│   └── workOrders.json
│
├── pages/
│   └── DashboardPage.jsx   # Main dashboard page
│
├── App.jsx                 # Router configuration
├── main.jsx                # Entry point
└── index.css               # Tailwind + CSS variables
```

### Feature Module Structure

Each feature folder follows this pattern:

```
features/customers/
├── api.js                  # Supabase API calls
├── hooks.js                # React Query hooks
├── schema.js               # Zod validation schemas
├── index.js                # Barrel exports
├── CustomersListPage.jsx   # List page
├── CustomerDetailPage.jsx  # Detail page
├── CustomerFormPage.jsx    # Create/Edit form
└── components/             # Feature-specific components
```

Some features split API concerns into multiple files (e.g., `subscriptions` has `api.js`, `importApi.js`, `paymentsApi.js`, `paymentMethodsApi.js`; `finance` has `recurringApi.js`).

---

## Routing

All routes are defined in `src/App.jsx`. Key route groups:

| Group | Routes |
|-------|--------|
| Auth (public) | `/login`, `/register`, `/forgot-password`, `/auth/update-password`, `/auth/verify-email` |
| Dashboard | `/`, `/profile`, `/notifications`, `/action-board` |
| Customers | `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit` |
| Work Orders | `/work-orders`, `/work-orders/new`, `/work-orders/:id`, `/work-orders/:id/edit` |
| Planning | `/daily-work`, `/work-history`, `/tasks`, `/calendar` |
| Materials | `/materials`, `/materials/import` |
| Subscriptions | `/subscriptions`, `/subscriptions/price-revision`, `/subscriptions/new`, `/subscriptions/:id`, `/subscriptions/:id/edit` |
| Proposals | `/proposals`, `/proposals/new`, `/proposals/:id`, `/proposals/:id/edit` |
| Finance | `/finance`, `/finance/expenses`, `/finance/income`, `/finance/vat`, `/finance/exchange`, `/finance/recurring`, `/finance/reports` |
| Equipment | `/equipment` |
| SIM Cards | `/sim-cards`, `/sim-cards/new`, `/sim-cards/import`, `/sim-cards/invoice-analysis`, `/sim-cards/:id/edit` |

---

## Navigation

Navigation is configured in `src/components/layout/navItems.js` with these groups:

1. **Top-level** (5 items, also in mobile bottom bar): Dashboard, Daily Work, Customers, Work Orders, Proposals
2. **Operasyon**: Notifications, Action Board (admin only)
3. **Planlama**: Calendar, Tasks, Work History
4. **Gelir ve Altyapı**: Subscriptions, SIM Cards, Invoice Analysis, Equipment
5. **Finans**: Finance Dashboard, Income, Expenses, VAT, Exchange Rates, Recurring Expenses, Reports
6. **Ayarlar** (collapsed by default): Materials

---

## Coding Patterns

### Component Pattern

```jsx
// Always functional components with hooks
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation('namespace');
  // ...
}
```

### Form Pattern

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schema, defaultValues } from './schema';

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm({
  resolver: zodResolver(schema),
  defaultValues,
});
```

### API Pattern

```javascript
// api.js - Supabase calls
export async function fetchCustomers(filters) {
  const { data, error } = await supabase
    .from('customers')
    .select('*, customer_sites(count)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### React Query Pattern

```javascript
// hooks.js - Query hooks
export const customerKeys = {
  all: ['customers'],
  lists: () => [...customerKeys.all, 'list'],
  detail: (id) => [...customerKeys.all, 'detail', id],
};

export function useCustomers(filters) {
  return useQuery({
    queryKey: customerKeys.lists(),
    queryFn: () => fetchCustomers(filters),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success(t('common:success.created'));
    },
  });
}
```

### i18n Pattern

```jsx
// Always use translations - never hardcode Turkish
import { useTranslation } from 'react-i18next';

function MyPage() {
  const { t } = useTranslation('customers');

  return (
    <PageHeader title={t('list.title')} />
  );
}
```

---

## UI Components

### Available Components (src/components/ui/)

| Component | Usage |
|-----------|-------|
| `Button` | Primary, secondary, outline, ghost, danger, success variants |
| `Input` | Text input with label, error, hint support |
| `Textarea` | Multi-line input |
| `Select` | Dropdown selection |
| `Modal` | Dialog/modal windows |
| `Card` | Container card |
| `Badge` | Status badges |
| `Table` | Data tables |
| `Spinner` | Loading spinner |
| `Skeleton` | Loading placeholder |
| `CardSkeleton` | Card-shaped skeleton loader |
| `TableSkeleton` | Table-shaped skeleton loader |
| `FormSkeleton` | Form-shaped skeleton loader |
| `EmptyState` | Empty data state |
| `ErrorState` | Error display with retry |
| `SearchInput` | Search field |
| `IconButton` | Icon-only button |
| `DateRangeFilter` | Date range picker for filters |
| `MaterialCombobox` | Searchable material selector |
| `SimCardCombobox` | Searchable SIM card selector |
| `UnsavedChangesModal` | Warn user before leaving with unsaved changes |

### Layout Components (src/components/layout/)

| Component | Usage |
|-----------|-------|
| `PageContainer` | Page wrapper with max-width |
| `PageHeader` | Page title, breadcrumbs, actions |
| `Container` | Generic container with padding |
| `Sidebar` | Navigation sidebar |
| `MobileNavDrawer` | Mobile slide-out navigation |
| `Header` | Top application header |
| `Footer` | Application footer |
| `NavGroup` | Collapsible navigation group |
| `Stack` | Spacing utility |
| `UserProfileDropdown` | User menu in header |

### Usage Example

```jsx
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageContainer, PageHeader } from '@/components/layout';

function MyPage() {
  return (
    <PageContainer>
      <PageHeader title="Page Title" />
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <Button variant="primary" loading={isSubmitting}>
        Save
      </Button>
    </PageContainer>
  );
}
```

---

## Styling Guidelines

### Tailwind CSS
- Use Tailwind classes exclusively
- Mobile-first responsive design
- Dark mode with `dark:` prefix
- Use `clsx` + `tailwind-merge` for conditional class composition

```jsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));
```

### Responsive Breakpoints
```
sm: 640px   - Small tablets
md: 768px   - Tablets
lg: 1024px  - Desktops
xl: 1280px  - Large desktops
```

### Dark Mode
```jsx
// Always include dark mode variants
<div className="bg-white dark:bg-[#171717]">
  <p className="text-neutral-900 dark:text-neutral-50">
    Content
  </p>
</div>
```

### Common Dark Mode Colors
```
Background:  dark:bg-[#0a0a0a]    (app background)
Surface:     dark:bg-[#171717]    (cards, modals)
Border:      dark:border-[#262626]
Text:        dark:text-neutral-50  (primary)
             dark:text-neutral-400 (secondary)
```

---

## i18n Structure

### Translation Files Location
```
src/locales/tr/          (21 namespaces)
├── actionBoard.json     # Action board
├── auth.json            # Authentication
├── calendar.json        # Calendar view
├── common.json          # General UI, actions, time
├── customers.json       # Customer module
├── dailyWork.json       # Daily work tracking
├── dashboard.json       # Dashboard
├── errors.json          # Error messages
├── finance.json         # Finance module
├── invoiceAnalysis.json # SIM card invoice analysis
├── materials.json       # Materials
├── notifications.json   # Notifications
├── profile.json         # User profile
├── proposals.json       # Proposals/quotes
├── recurring.json       # Recurring expenses
├── simCards.json        # SIM cards
├── siteAssets.json      # Site assets/equipment
├── subscriptions.json   # Subscriptions
├── tasks.json           # Tasks
├── workHistory.json     # Work history
└── workOrders.json      # Work orders
```

### Adding New Translations

1. Add namespace JSON file to `src/locales/tr/myFeature.json`
2. Register namespace in `src/lib/i18n.js`
3. Use in component:

```jsx
const { t } = useTranslation('myNamespace');
<h1>{t('myFeature.title')}</h1>
```

---

## Database (Supabase)

### Key Tables
- `customers` - Company records
- `customer_sites` - Location/branch records
- `work_orders` - Work order records
- `work_order_materials` - Materials used in work orders
- `materials` - Material catalog
- `tasks` - Task records
- `profiles` - User profiles
- `subscriptions` - Recurring subscription contracts
- `subscription_payments` - Monthly payment records per subscription
- `sim_cards` - SIM/data card inventory
- `proposals` - Customer quotes/offers
- `proposal_items` - Line items per proposal
- `proposal_work_orders` - Junction: proposals ↔ work orders
- `financial_transactions` - Income & expense ledger
- `expense_categories` - Expense classification
- `exchange_rates` - TCMB currency rates (auto-fetched)
- `recurring_expenses` - Scheduled repeating expenses
- `site_assets` - Equipment assigned to customer sites
- `notifications` - In-app notification records

### Query Patterns
```javascript
// Select with relationships
const { data } = await supabase
  .from('customers')
  .select('*, customer_sites(*)');

// Select with count
const { data } = await supabase
  .from('customers')
  .select('*, customer_sites(count)');

// Filter
const { data } = await supabase
  .from('work_orders')
  .select('*')
  .eq('status', 'pending')
  .gte('scheduled_date', '2024-01-01');
```

---

## Global Hooks Reference

| Hook | Location | Purpose |
|------|----------|---------|
| `useAuth` | `src/hooks/useAuth.js` | Auth state, user, session |
| `useTheme` | `src/hooks/useTheme.jsx` | Light/dark theme toggle |
| `useDebouncedValue` | `src/hooks/useDebouncedValue.js` | Debounce rapidly changing values |
| `useSearchInput` | `src/hooks/useSearchInput.js` | Search input state with debounce |
| `useUnsavedChanges` | `src/hooks/useUnsavedChanges.js` | Warn before navigating away |

---

## Utility Libraries

| File | Purpose |
|------|---------|
| `src/lib/utils.js` | General helper functions |
| `src/lib/csvExport.js` | CSV file export |
| `src/lib/normalizeForSearch.js` | Normalize Turkish characters for search (ş→s, ı→i, etc.) |
| `src/lib/breadcrumbConfig.js` | Route-to-breadcrumb mapping |
| `src/lib/errorHandler.js` | Localize Supabase/API errors |

---

## Critical Rules

### ALWAYS Do

1. **Implement i18n** - Every page, modal, popup must use translations
2. **Mobile-first design** - Test on mobile, tablet, desktop
3. **Follow existing architecture** - Use feature folder structure
4. **Use existing UI components** - Don't reinvent Button, Input, etc.
5. **Handle all states** - Loading, error, empty, success
6. **Use react-hook-form + zod** - For all forms
7. **Use React Query hooks** - For all data fetching
8. **Include dark mode** - All UI must work in dark mode
9. **Use English in code** - Variables, functions, comments in English
10. **Normalize search** - Use `normalizeForSearch` for Turkish text search

### NEVER Do

1. **Don't create new CSS files** - Use Tailwind classes only
2. **Don't use class components** - Functional components only
3. **Don't add npm dependencies without asking** - Check first
4. **Don't use inline styles** - Use Tailwind classes
5. **Don't hardcode Turkish strings** - Use i18n
6. **Don't create new UI components if existing ones work** - Reuse
7. **Don't skip form validation** - Always use zod schemas
8. **Don't call Supabase directly in components** - Use api.js + hooks
9. **Don't create pages without mobile responsiveness** - Always responsive
10. **Don't forget loading/error/empty states** - Handle all cases

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `CustomerFormPage.jsx` |
| Hooks | camelCase with "use" | `useCustomers.js` |
| Utils | camelCase | `formatDate.js` |
| API files | `api.js` | `src/features/customers/api.js` |
| Schema files | `schema.js` | `src/features/customers/schema.js` |
| Hook files | `hooks.js` | `src/features/customers/hooks.js` |

---

## Common Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:5173)

# Build
npm run build        # Production build
npm run preview      # Preview production build

# Linting
npm run lint         # Run ESLint
```

---

## Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## Quick Reference

### Creating a New Feature

1. Create folder: `src/features/myFeature/`
2. Add files:
   - `api.js` - Supabase calls
   - `hooks.js` - React Query hooks
   - `schema.js` - Zod schemas
   - `MyFeaturePage.jsx` - Page component
   - `index.js` - Exports
3. Add translations: `src/locales/tr/myFeature.json`
4. Register namespace in: `src/lib/i18n.js`
5. Add route: `src/App.jsx`
6. Add to navigation: `src/components/layout/navItems.js`

### Creating a New Page

```jsx
import { useTranslation } from 'react-i18next';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useMyData } from './hooks';

export function MyPage() {
  const { t } = useTranslation('myNamespace');
  const { data, isLoading, error } = useMyData();

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  if (!data?.length) {
    return (
      <PageContainer>
        <PageHeader title={t('list.title')} />
        <EmptyState
          title={t('list.empty.title')}
          description={t('list.empty.description')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('list.title')}
        actions={
          <Button variant="primary">
            {t('list.addButton')}
          </Button>
        }
      />
      {/* Content */}
    </PageContainer>
  );
}
```

---

## Business Terms Glossary

| Turkish | English | Context |
|---------|---------|---------|
| İş Emri | Work Order | Main work record |
| Müşteri | Customer | Company/client |
| Lokasyon | Site/Location | Customer branch |
| Hesap No | Account Number | Alarm monitoring ID |
| Montaj | Installation | New system setup |
| Servis | Service | Repair/support |
| Bakım | Maintenance | Scheduled upkeep |
| Keşif | Survey | Pre-installation check |
| Malzeme | Material | Equipment/parts |
| Personel | Worker/Staff | Field technician |
| Görev | Task | To-do item |
| Abone | Subscriber | Subscription contract holder |
| Teklif | Proposal/Quote | Offer document |
| Fatura | Invoice | Billing document |
| Gelir | Income | Revenue |
| Gider | Expense | Cost |
| KDV | VAT | Turkish value-added tax |

---

## Contact & Resources

- **Supabase Dashboard**: Check database/auth settings
- **Paraşüt**: Future accounting integration target
- **Tailwind Docs**: https://tailwindcss.com/docs
- **React Query Docs**: https://tanstack.com/query
- **i18next Docs**: https://www.i18next.com
- **Recharts Docs**: https://recharts.org/en-US/api
- **React PDF Renderer**: https://react-pdf.org
