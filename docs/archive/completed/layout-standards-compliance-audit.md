# Layout Standards Compliance Audit

**Date:** 2026-02-04  
**Status:** 🔍 Assessment Complete

---

## Summary

**Current Status:** ❌ **Not all components/pages use latest standards**

Most pages still use the old `Container` component and manual headers instead of the new `PageHeader` and `PageContainer` components. Some components also use outdated dark mode colors and breakpoints.

---

## Issues Found

### 1. Pages Not Using New Layout Components

| Page | Current | Should Use | Priority |
|------|---------|------------|----------|
| `DashboardPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🔴 High |
| `CustomersListPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🔴 High |
| `WorkOrdersListPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🔴 High |
| `CustomerDetailPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🔴 High |
| `CustomerFormPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🟡 Medium |
| `WorkOrderDetailPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🟡 Medium |
| `WorkOrderFormPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🟡 Medium |
| `TasksPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🟡 Medium |
| `CalendarPage.jsx` | `Container` + manual header | `PageContainer` + `PageHeader` | 🟡 Medium |
| `LoginPage.jsx` | Manual layout | Keep as-is (auth page) | ✅ OK |

**Total:** 9 pages need updates

---

### 2. Old Breakpoints Still in Use

**Issue:** Pages use `md:` (768px) for desktop layouts, but should use `lg:` (1024px) for desktop.

**Files with old breakpoints:**
- `DashboardPage.jsx`: `md:flex-row`, `md:items-center`, `md:border-r`, `md:pr-4`
- `CustomersListPage.jsx`: `sm:flex-row`, `sm:items-center` (OK, but check consistency)
- `CustomerDetailPage.jsx`: `lg:grid-cols-3`, `lg:col-span-2` (✅ Already using lg)
- Many skeleton components use `md:` breakpoints

**Should be:**
- Mobile: `< 480px` (xs, default)
- Mobile/Large phone: `480px+` (sm)
- Tablet: `768px+` (md)
- Desktop: `1024px+` (lg) ← **Use this for desktop layouts**
- Large desktop: `1440px+` (xl)

---

### 3. Old Dark Mode Colors

**Issue:** Some components still use old dark mode colors instead of new design tokens.

**Old colors (need update):**
- `dark:bg-neutral-900` → `dark:bg-[#171717]`
- `dark:bg-neutral-950` → `dark:bg-[#0a0a0a]`
- `dark:border-neutral-800` → `dark:border-[#262626]`
- `dark:text-neutral-100` → `dark:text-neutral-50`

**Files with old dark mode colors:**
- `StatCard.jsx`: `dark:bg-neutral-900`, `dark:border-neutral-800`
- `Table.jsx`: May have old colors
- `EmptyState.jsx`: May have old colors
- `ErrorBoundary.jsx`: May have old colors
- `CustomerSelect.jsx`: May have old colors

---

### 4. Components Using Old Patterns

| Component | Issue | Fix Needed |
|-----------|-------|------------|
| `StatCard.jsx` | Old dark mode colors | Update to `#171717`, `#262626` |
| `Table.jsx` | May have old colors/breakpoints | Audit and update |
| `EmptyState.jsx` | May have old colors | Audit and update |
| `ErrorBoundary.jsx` | May have old colors | Audit and update |
| `CustomerSelect.jsx` | May have old colors | Audit and update |

---

## Detailed Page Analysis

### DashboardPage.jsx
**Current:**
```jsx
<Container maxWidth="xl">
  {/* Manual header */}
  <div className="flex flex-col sm:flex-row...">
    <h1>...</h1>
  </div>
  {/* Content */}
</Container>
```

**Should be:**
```jsx
<PageContainer maxWidth="full" padding="default">
  <PageHeader
    title={t('dashboard.title')}
    actions={<Button>...</Button>}
  />
  {/* Content */}
</PageContainer>
```

**Issues:**
- Uses `Container` instead of `PageContainer`
- Manual header instead of `PageHeader`
- Uses `md:` breakpoints (should be `lg:` for desktop)
- Old dark mode colors in skeleton components

---

### CustomersListPage.jsx
**Current:**
```jsx
<Container maxWidth="xl">
  <div className="flex flex-col sm:flex-row...">
    <h1>{t('list.title')}</h1>
    <Button>...</Button>
  </div>
  {/* Search, content */}
</Container>
```

**Should be:**
```jsx
<PageContainer maxWidth="xl" padding="default">
  <PageHeader
    title={t('list.title')}
    actions={
      <Button leftIcon={<Plus />}>
        {t('list.addButton')}
      </Button>
    }
  />
  {/* Search, content */}
</PageContainer>
```

**Issues:**
- Uses `Container` instead of `PageContainer`
- Manual header instead of `PageHeader`
- Breakpoints are OK (`sm:` for mobile/tablet)

---

### WorkOrdersListPage.jsx
**Current:**
```jsx
<Container maxWidth="xl">
  {/* Manual header with filters */}
  {/* Content */}
</Container>
```

**Should be:**
```jsx
<PageContainer maxWidth="xl" padding="default">
  <PageHeader
    title={t('list.title')}
    actions={<Button>...</Button>}
    tabs={statusTabs}
  />
  {/* Filters, content */}
</PageContainer>
```

**Issues:**
- Uses `Container` instead of `PageContainer`
- Manual header instead of `PageHeader`
- Could use `tabs` prop for status filters

---

### CustomerDetailPage.jsx
**Current:**
```jsx
<Container maxWidth="lg">
  <div className="flex items-center gap-4 mb-6">
    <IconButton icon={<ArrowLeft />} />
    <h1>...</h1>
  </div>
  {/* Content */}
</Container>
```

**Should be:**
```jsx
<PageContainer maxWidth="lg" padding="default">
  <PageHeader
    title={customer.name}
    breadcrumbs={[
      { label: t('nav.customers'), to: '/customers' },
      { label: customer.name }
    ]}
    actions={<Button>...</Button>}
  />
  {/* Content */}
</PageContainer>
```

**Issues:**
- Uses `Container` instead of `PageContainer`
- Manual header with back button instead of `PageHeader` with breadcrumbs
- Already uses `lg:` breakpoints (✅ Good)

---

## Recommendations

### Priority 1: High Impact Pages (Do First)
1. **DashboardPage** - Most visible page
2. **CustomersListPage** - Frequently used
3. **WorkOrdersListPage** - Frequently used
4. **CustomerDetailPage** - Good candidate for breadcrumbs

### Priority 2: Medium Impact Pages
5. **TasksPage**
6. **WorkOrderDetailPage**
7. **WorkOrderFormPage**
8. **CustomerFormPage**
9. **CalendarPage**

### Priority 3: Component Updates
10. Update `StatCard.jsx` dark mode colors
11. Audit and update `Table.jsx`
12. Audit and update `EmptyState.jsx`
13. Audit and update `ErrorBoundary.jsx`
14. Audit and update `CustomerSelect.jsx`

### Priority 4: Breakpoint Cleanup
15. Update all `md:` breakpoints to `lg:` where desktop layout is intended
16. Ensure consistent breakpoint usage across all pages

---

## Migration Checklist

For each page, follow this pattern:

- [ ] Replace `Container` with `PageContainer`
- [ ] Replace manual header with `PageHeader`
- [ ] Add breadcrumbs if applicable
- [ ] Move action buttons to `PageHeader` `actions` prop
- [ ] Update breakpoints: `md:` → `lg:` for desktop layouts
- [ ] Update dark mode colors to new tokens
- [ ] Test responsive behavior on all breakpoints

---

## Example Migration

### Before:
```jsx
import { Container } from '../../components/layout';

export function CustomersListPage() {
  return (
    <Container maxWidth="xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('list.title')}
        </h1>
        <Button onClick={handleAdd}>
          {t('list.addButton')}
        </Button>
      </div>
      {/* Content */}
    </Container>
  );
}
```

### After:
```jsx
import { PageContainer, PageHeader } from '../../components/layout';
import { Plus } from 'lucide-react';

export function CustomersListPage() {
  return (
    <PageContainer maxWidth="xl" padding="default">
      <PageHeader
        title={t('list.title')}
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus className="w-5 h-5" />}
            onClick={handleAdd}
          >
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

## Next Steps

1. **Create migration plan** for updating all pages
2. **Update components** with old dark mode colors
3. **Update breakpoints** throughout codebase
4. **Test** each page after migration
5. **Document** migration patterns for future pages

---

**Status:** Ready for migration implementation
