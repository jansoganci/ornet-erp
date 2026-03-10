# Search Input Focus Audit — Summary

## 1. Search Inputs Inventory

| Component | File | onChange | normalizeForSearch | useMemo/Debounce | Focus Risk |
|-----------|------|----------|-------------------|-----------------|------------|
| CustomersListPage | customers/CustomersListPage.jsx | setSearch | API only | useSearchInput (debounce) | Fixed |
| ProposalsListPage | proposals/ProposalsListPage.jsx | setSearch | API only | useSearchInput (debounce) | Fixed |
| WorkOrdersListPage | workOrders/WorkOrdersListPage.jsx | handleSearch | API only | useDebouncedValue | Fixed |
| SubscriptionsListPage | subscriptions/SubscriptionsListPage.jsx | handleSearch | API only | useDebouncedValue | Fixed |
| MaterialsListPage | materials/MaterialsListPage.jsx | handleFilterChange | API only | useDebouncedValue | Fixed |
| SiteAssetsListPage | siteAssets/SiteAssetsListPage.jsx | handleSearchChange | API only | useDebouncedValue | Fixed |
| WorkHistoryPage | workHistory/WorkHistoryPage.jsx | handleFilterChange | API only | useDebouncedValue | Fixed |
| SimCardsListPage | simCards/SimCardsListPage.jsx | handleSearch | In component (filter) | useMemo for filtered list | Fixed |
| CustomerSiteSelector | workOrders/CustomerSiteSelector.jsx | setSearchTerm | API only | useDebouncedValue | Fixed |
| SimCardCombobox | components/ui/SimCardCombobox.jsx | setSearch | API (client filter) | None | Low (fetches, then filters) |
| MaterialCombobox | components/ui/MaterialCombobox.jsx | setSearch | N/A | None | Low |
| CustomerSelect | workOrders/CustomerSelect.jsx | setSearch | API only | None | Low |

## 2. Focus Bug Patterns Identified

### Pattern A: Early return on isLoading
```jsx
if (isLoading) {
  return <Skeleton />;  // SearchInput unmounts!
}
```
**Fix:** Remove early return; always render SearchInput; show loading in table area.

### Pattern B: Direct setState → immediate refetch
```jsx
onChange={(e) => setSearch(e.target.value)}  // Every keystroke → refetch → isLoading
```
**Fix:** Debounce the value passed to the query.

### Pattern C: normalizeForSearch on every render (client filter)
```jsx
const normalizedTerm = normalizeForSearch(search);  // Every render
const filtered = data.filter(...);
```
**Fix:** useMemo for normalized term and filtered list.

## 3. Global Fix Applied

- **useDebouncedValue** (`src/hooks/useDebouncedValue.js`) — debounces any value
- **useSearchInput** (`src/hooks/useSearchInput.js`) — useState + debounce for search
- **Removed early returns** on isLoading in list pages
- **Debounce** (300ms) for all API-backed search inputs

## 4. Effort

| Approach | Files Changed | Lines Added |
|----------|---------------|-------------|
| Global hooks | 2 new files | ~35 |
| Per-page fixes | 9 files | ~150 total |

## 5. Example Diffs

### CustomersListPage.jsx
```diff
- import { useState, useEffect } from 'react';
+ import { useSearchInput } from '../../hooks/useSearchInput';
- const [search, setSearch] = useState('');
- const [debouncedSearch, setDebouncedSearch] = useState('');
- useEffect(() => {
-   const tId = setTimeout(() => setDebouncedSearch(search), 300);
-   return () => clearTimeout(tId);
- }, [search]);
+ const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });
  const { data: customers, ... } = useCustomers({ search: debouncedSearch });
```

### WorkOrdersListPage.jsx
```diff
+ import { useState, useEffect } from 'react';
+ import { useDebouncedValue } from '../../hooks/useDebouncedValue';
- const search = searchParams.get('search') || '';
+ const searchFromUrl = searchParams.get('search') || '';
+ const [localSearch, setLocalSearch] = useState(searchFromUrl);
+ const debouncedSearch = useDebouncedValue(localSearch, 300);
+ useEffect(() => setLocalSearch(searchFromUrl), [searchFromUrl]);
+ useEffect(() => { /* sync URL when debouncedSearch changes */ }, [debouncedSearch, searchFromUrl]);
- if (isLoading) return <Skeleton />;  // REMOVED
- const handleSearch = (value) => setSearchParams(...);
+ const handleSearch = (value) => setLocalSearch(value);
  <SearchInput value={localSearch} onChange={handleSearch} />
```

### WorkHistoryPage.jsx (most complex)
```diff
+ import { useDebouncedValue } from '../../hooks/useDebouncedValue';
+ const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');
+ const debouncedSearch = useDebouncedValue(localSearch, 300);
- if (isLoading) return <Skeleton />;  // REMOVED
  const handleFilterChange = (key, value) => {
+   if (key === 'search') { setLocalSearch(value ?? ''); return; }
    setFilters(...);
  };
  useSearchWorkHistory({ ...filters, search: debouncedSearch });
  <SearchInput value={localSearch} onChange={(v) => handleFilterChange('search', v)} />
```
