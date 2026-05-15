# List Pages — Tablet & Mobile UI Audit

> Audit date: 2026-03-23  
> Focus: LIST views only (detail pages excluded)

---

## Summary

- **Shared Table component** drives most list layouts; its mobile/tablet card view is single-column with no `md:` grid.
- **All pages** using Table inherit the same card layout issues.
- **Primary fix**: Update `Table.jsx` card layout to follow the target card standard; then adjust page-specific column renders for truncation where needed.

---

## 1. `src/components/ui/Table.jsx`

**Issue type:** Card layout — single column on mobile AND tablet; no `md:grid-cols-2`; no `min-w-0` / truncate; cramped on tablet.

**Current code (mobile card block):**
```jsx
<Card
  key={getKey(item, rowIndex)}
  variant={onRowClick ? 'interactive' : 'default'}
  onClick={onRowClick ? () => onRowClick(item) : undefined}
  className={cn('p-4 space-y-3', typeof rowClassName === 'function' ? rowClassName(item, rowIndex) : rowClassName)}
>
  {columns.map((column, colIndex) => {
    const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
    return (
      <div key={fieldKey} className="flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
          {column.header}
        </span>
        <div className={cn('text-sm text-neutral-900 dark:text-neutral-50', alignClasses[column.align || 'left'])}>
          {column.render
            ? column.render(item[fieldKey], item, rowIndex)
            : item[fieldKey]}
        </div>
      </div>
    );
  })}
</Card>
```

**Fix:** Apply a 2-column layout at tablet: primary info left, status/meta right. Use column metadata for grouping when available; otherwise split first 1–2 columns vs rest.

```jsx
{/* Mobile/Tablet: Card Stack — 2-col grid at md for primary | meta */}
{!loading &&
  data.map((item, rowIndex) => {
    const primaryCols = columns.slice(0, 2);
    const metaCols = columns.slice(2);
    return (
      <Card
        key={getKey(item, rowIndex)}
        variant={onRowClick ? 'interactive' : 'default'}
        onClick={onRowClick ? () => onRowClick(item) : undefined}
        className={cn(
          'grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4',
          typeof rowClassName === 'function' ? rowClassName(item, rowIndex) : rowClassName
        )}
      >
        <div className="min-w-0 space-y-3">
          {primaryCols.map((column, colIndex) => {
            const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
            return (
              <div key={fieldKey} className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  {column.header}
                </span>
                <div className={cn('text-sm text-neutral-900 dark:text-neutral-50 min-w-0 truncate', alignClasses[column.align || 'left'])}>
                  {column.render
                    ? column.render(item[fieldKey], item, rowIndex)
                    : item[fieldKey]}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row md:flex-col md:items-end md:justify-center gap-2 md:gap-3">
          {metaCols.map((column, colIndex) => {
            const fieldKey = column.key ?? column.accessor ?? `col-${colIndex + 2}`;
            return (
              <div key={fieldKey} className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  {column.header}
                </span>
                <div className={cn('text-sm text-neutral-900 dark:text-neutral-50 min-w-0', alignClasses[column.align || 'left'])}>
                  {column.render
                    ? column.render(item[fieldKey], item, rowIndex)
                    : item[fieldKey]}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  })}
```

---

## 2. `src/features/customers/CustomersListPage.jsx`

**Issue type:** Table usage — no custom card; relies on Table. Column `company_name` uses `max-w-[200px] break-words` but no `truncate`; long strings can overflow. Table parent has no explicit `overflow-x-auto` (Table provides it for desktop; N/A for mobile cards).

**Current snippet (company_name column):**
```jsx
<span className="font-medium text-neutral-900 dark:text-neutral-50 max-w-[200px] break-words">
  {site.customers?.company_name || '—'}
</span>
```

**Fix:** Add `truncate` and `min-w-0` for consistent overflow handling.
```jsx
<span className="font-medium text-neutral-900 dark:text-neutral-50 max-w-[200px] min-w-0 truncate block">
  {site.customers?.company_name || '—'}
</span>
```

**Note:** Subscriber/site columns already use `break-words`; for card view, `truncate` is preferable to avoid layout shift.

---

## 3. `src/features/workOrders/WorkOrdersListPage.jsx`

**Issue type:** Table usage; customer column uses `line-clamp-2` (good) but `min-w-[140px]` can cause horizontal overflow on narrow viewports.

**Current snippet:**
```jsx
<div className="min-w-[140px]">
  <p className="line-clamp-2 break-words font-bold text-neutral-900 dark:text-neutral-100">
    {value}
  </p>
  ...
</div>
```

**Fix:** Use `min-w-0` to allow shrinking; keep `line-clamp-2` for multi-line truncation.
```jsx
<div className="min-w-0 max-w-[min(280px,90vw)]">
  <p className="line-clamp-2 break-words font-bold text-neutral-900 dark:text-neutral-100 truncate">
    {value}
  </p>
  <p className="line-clamp-2 break-words text-xs text-neutral-500 dark:text-neutral-400 truncate">
    {row.site_name || row.site_address}
  </p>
  ...
</div>
```

---

## 4. `src/features/workHistory/WorkHistoryPage.jsx`

**Issue type:** Table usage; customer column has `truncate` (good). Table wrapper has no `overflow-x-auto` — not required because Table shows cards below `lg`. No critical issues.

**Optional improvement:** Ensure Table parent in results section allows horizontal scroll if any custom layout is added later:
```jsx
<div className="overflow-x-auto">
  <Table ... />
</div>
```

---

## 5. `src/features/proposals/ProposalsListPage.jsx`

**Issue type:** Table usage; `title` column uses `whitespace-normal break-words` with `min-w-[200px] max-w-[400px]` — no truncation; long titles can stretch cards.

**Current snippet:**
```jsx
<div className="min-w-[200px] max-w-[400px]">
  <p className="font-medium text-neutral-900 dark:text-neutral-50 whitespace-normal break-words">
    {value || '—'}
  </p>
</div>
```

**Fix:** Add truncation for list view; detail/tooltip can show full text.
```jsx
<div className="min-w-0 max-w-[min(400px,90vw)]">
  <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate" title={value || ''}>
    {value || '—'}
  </p>
</div>
```

---

## 6. `src/features/subscriptions/SubscriptionsListPage.jsx`

**Issue type:** Table usage; customer column uses `break-words` but no `truncate`; many columns — card stack will be tall.

**Current snippet:**
```jsx
<div className="min-w-0 break-words">
  <p className="font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
  <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.site_name}</p>
  ...
</div>
```

**Fix:** Add truncate for primary text.
```jsx
<div className="min-w-0">
  <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{row.site_name}</p>
  ...
</div>
```

---

## 7. `src/features/simCards/SimCardsListPage.jsx`

**Issue type:** Table usage; `customerLabel` column uses `break-words`; phone_number and other columns lack truncation. Many columns cause a very long card stack.

**Current snippet (customerLabel):**
```jsx
<span className="break-words">
  {row.customers?.company_name || row.customer_label || '-'}
</span>
```

**Fix:**
```jsx
<span className="block min-w-0 truncate" title={row.customers?.company_name || row.customer_label || '-'}>
  {row.customers?.company_name || row.customer_label || '-'}
</span>
```

**phone_number column:**
```jsx
<div className="font-medium text-neutral-900 dark:text-neutral-50 truncate min-w-0">{value}</div>
```

---

## 8. `src/features/siteAssets/SiteAssetsListPage.jsx`

**Issue type:** Table usage; customer column has `truncate max-w-[200px]` (good). Equipment badges use `flex flex-wrap` — acceptable. `installation_date` column hidden on mobile via `className: 'hidden md:table-cell'` — Table card view still shows it; consider `cardHidden` or similar if needed.

**Current snippet:** Already uses truncate; minimal changes.

**Optional:** Ensure equipment badges wrap without overflowing:
```jsx
<div className="flex flex-wrap gap-1.5 min-w-0">
  {row.equipment.map((e, i) => (
    <Badge key={i} variant="info" size="sm" className="truncate max-w-[120px]">
      {e.name}: {e.quantity}
    </Badge>
  ))}
</div>
```

---

## 9. `src/features/materials/MaterialsListPage.jsx`

**Issue type:** Table usage; `name` column has `truncate` (good). Code column has no truncation (usually short). No critical issues.

**Optional:** Add `min-w-0` to name wrapper for consistency.
```jsx
<div className="max-w-[300px] min-w-0">
  <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate" title={val}>
    {val}
  </p>
</div>
```

---

## 10. `src/features/finance/IncomePage.jsx`

**Issue type:** Table usage; `description` and `customers` columns can be long; no truncation.

**Current snippet (customers):**
```jsx
render: (val) => val?.company_name || '-',
```

**Fix:** Add a wrapper with truncate for list consistency.
```jsx
render: (val) => (
  <span className="block min-w-0 truncate max-w-[200px]" title={val?.company_name || ''}>
    {val?.company_name || '-'}
  </span>
),
```

**Description column:**
```jsx
render: (val) => (
  <span className="block min-w-0 truncate max-w-[180px]" title={val || ''}>
    {val || '-'}
  </span>
),
```

---

## 11. `src/features/finance/ExpensesPage.jsx`

**Issue type:** Same as IncomePage — `description` and `customers` lack truncation.

**Fix:** Same pattern as IncomePage for `customers` and `description` columns.

---

## 12. `src/features/finance/VatReportPage.jsx`

**Issue type:** Report table; totals row uses `grid-cols-4` — on narrow screens (e.g. when Table shows cards) this may not wrap. Vat report typically has few columns; acceptable for now.

**Optional:** Make totals row responsive.
```jsx
<div className="border-t ... grid grid-cols-2 md:grid-cols-4 gap-4 ...">
```

---

## 13. `src/features/finance/ExchangeRatePage.jsx`

**Issue type:** Table usage; columns are short (currency, dates, numbers). No truncation needed. No critical issues.

---

## Implementation Priority

| Priority | File | Change |
|----------|------|--------|
| 1 | `Table.jsx` | 2-col card layout at `md`, `min-w-0`, truncate wrappers |
| 2 | CustomersListPage | `truncate` on company_name |
| 3 | WorkOrdersListPage | `min-w-0` on customer cell |
| 4 | ProposalsListPage | `truncate` on title |
| 5 | SubscriptionsListPage | `truncate` on customer blocks |
| 6 | SimCardsListPage | `truncate` on customerLabel, phone_number |
| 7 | IncomePage, ExpensesPage | `truncate` on description, customers |
| 8 | SiteAssetsListPage, MaterialsListPage | Optional small tweaks |
| 9 | VatReportPage | Optional totals grid responsiveness |

---

## Table Desktop: overflow-x-auto

The desktop table is inside a `div` with `overflow-x-auto` (line 77–79 in Table.jsx). On mobile/tablet only the card stack is shown, so horizontal overflow applies only to the desktop table. This is already handled. Pages that wrap Table in their own container do not need an extra `overflow-x-auto` unless they override the Table layout.
