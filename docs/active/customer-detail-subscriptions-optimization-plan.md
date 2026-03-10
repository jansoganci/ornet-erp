# CustomerDetailPage Subscriptions Optimization — Implementation Plan

> **Status:** Planned (not implemented)  
> **Related:** [AUDIT_REPORT.md](../AUDIT_REPORT.md) — Critical Issue #3, Performance #1

---

## Problem

`CustomerDetailPage` currently:

1. Calls `useSubscriptions({})` → fetches **all** subscriptions
2. Filters client-side by `siteIds` from `useSitesByCustomer(id)`
3. Recomputes `siteIds`, `customerSubscriptions`, `subscriptionsBySite`, `counts`, `monthlyRevenue` on every render

This scales poorly as subscription count grows (e.g. 500+ subscriptions).

---

## Solution Overview

| Layer | Change |
|-------|--------|
| **api.js** | Add `fetchSubscriptionsByCustomer(customerId)` — server-side filter by `customer_id` |
| **hooks.js** | Add `useCustomerSubscriptions(customerId)` — uses new API, `enabled: !!customerId` |
| **CustomerDetailPage.jsx** | Replace `useSubscriptions({})` with `useCustomerSubscriptions(id)`; add `useMemo` for derived stats |

---

## 1. api.js — New API Function

**File:** `src/features/subscriptions/api.js`

**Add after** `fetchSubscriptions` (around line 95):

```javascript
/**
 * Fetch subscriptions for a specific customer (uses subscriptions_detail view).
 * Optimized for CustomerDetailPage — avoids fetching all subscriptions.
 */
export async function fetchSubscriptionsByCustomer(customerId) {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from('subscriptions_detail')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
```

**Why `customer_id`:** The `subscriptions_detail` view includes `customer_id` (from `customer_sites.customer_id`). A single `.eq('customer_id', customerId)` filter returns only that customer's subscriptions. No need for `site_ids` array or `.in()`.

---

## 2. hooks.js — New Hook

**File:** `src/features/subscriptions/hooks.js`

**Add import:**
```javascript
import {
  fetchSubscriptions,
  fetchSubscriptionsByCustomer,  // add this
  fetchSubscription,
  // ...
} from './api';
```

**Add query key** (in `subscriptionKeys` object):
```javascript
listByCustomer: (customerId) => [...subscriptionKeys.lists(), 'customer', customerId],
```

**Add hook** (after `useSubscriptionsBySite`):
```javascript
export function useCustomerSubscriptions(customerId) {
  return useQuery({
    queryKey: subscriptionKeys.listByCustomer(customerId),
    queryFn: () => fetchSubscriptionsByCustomer(customerId),
    enabled: !!customerId,
  });
}
```

**Invalidation:** When subscriptions are created/updated/deleted, we should invalidate `subscriptionKeys.lists()` — which will also invalidate `listByCustomer` since it extends `lists()`. Verify: `listByCustomer` uses `[...subscriptionKeys.lists(), 'customer', customerId]`, so it's a *different* key. To invalidate customer-scoped data on mutation, add:

```javascript
queryClient.invalidateQueries({ queryKey: subscriptionKeys.lists() });
```

This invalidates all list-like queries. The `listByCustomer` key is `['subscriptions', 'list', 'customer', customerId]` — `invalidateQueries({ queryKey: subscriptionKeys.lists() })` matches `['subscriptions', 'list']` as a prefix, so TanStack Query will invalidate `listByCustomer` too. ✓

---

## 3. CustomerDetailPage.jsx — Replace Hook + Memoize

**File:** `src/features/customers/CustomerDetailPage.jsx`

### 3.1 Replace import and hook call

**Change:**
```javascript
import { useSubscriptions } from '../subscriptions/hooks';
// ...
const { data: allSubscriptions = [] } = useSubscriptions({});
```

**To:**
```javascript
import { useCustomerSubscriptions } from '../subscriptions/hooks';
// ...
const { data: customerSubscriptions = [] } = useCustomerSubscriptions(id);
```

### 3.2 Remove client-side filtering

**Remove:**
```javascript
const siteIds = sites.map((s) => s.id);
const customerSubscriptions = (allSubscriptions || []).filter((sub) =>
  siteIds.includes(sub.site_id)
);
```

**Reason:** Data now comes pre-filtered from the API.

### 3.3 Add useMemo for derived values

**Add import:**
```javascript
import { useState, useMemo } from 'react';
```

**Replace** the inline `subscriptionsBySite`, `counts`, `monthlyRevenue` with memoized versions:

```javascript
const subscriptionsBySite = useMemo(() => {
  return (customerSubscriptions || []).reduce((acc, sub) => {
    if (!acc[sub.site_id]) acc[sub.site_id] = [];
    acc[sub.site_id].push(sub);
    return acc;
  }, {});
}, [customerSubscriptions]);

const counts = useMemo(() => ({
  activeSubscriptions: (customerSubscriptions || []).filter((s) => s.status === 'active').length,
  openWorkOrders: (workOrders || []).filter(
    (wo) => !['completed', 'cancelled'].includes(wo.status)
  ).length,
  activeSimCards: (simCards || []).filter((s) => s.status === 'active').length,
  faultyEquipment: (assets || []).filter((a) => a.status === 'faulty').length,
}), [customerSubscriptions, workOrders, simCards, assets]);

const monthlyRevenue = useMemo(
  () => (customerSubscriptions || [])
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (Number(s.base_price) || 0), 0),
  [customerSubscriptions]
);
```

### 3.4 Tab bar equipment count

**Current:**
```javascript
equipment: assets.filter((a) => a.status !== 'removed').length,
```

**Memoize** (optional, minor): Could add to `counts` or keep inline. For consistency, add `equipmentCount` to `counts`:

```javascript
equipmentCount: (assets || []).filter((a) => a.status !== 'removed').length,
```

Then use `counts.equipmentCount` in the tab bar. Or leave as-is — it's a simple filter.

---

## 4. Data Flow Summary

| Before | After |
|--------|-------|
| `useSubscriptions({})` → all subscriptions | `useCustomerSubscriptions(id)` → only this customer's |
| Filter by `siteIds` client-side | No client filter; API returns correct set |
| No memoization | `useMemo` for `subscriptionsBySite`, `counts`, `monthlyRevenue` |

---

## 5. Edge Cases

| Case | Behavior |
|------|----------|
| Customer has 0 sites | `useCustomerSubscriptions(id)` returns `[]` (no subscriptions) |
| Customer has sites but no subscriptions | Returns `[]` |
| `id` is undefined (e.g. bad route) | `enabled: !!customerId` prevents query from running |

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/features/subscriptions/api.js` | Add `fetchSubscriptionsByCustomer` |
| `src/features/subscriptions/hooks.js` | Add `listByCustomer` key, `useCustomerSubscriptions` hook |
| `src/features/customers/CustomerDetailPage.jsx` | Replace hook, add `useMemo`, remove client filter |

---

## 7. Verification

After implementation:

1. Open a customer detail page — subscriptions should load (no change in UI).
2. Check Network tab — single request to `subscriptions_detail` with `customer_id=eq.<uuid>`.
3. Compare with previous behavior — no request for full subscriptions list.
4. Confirm `subscriptionsBySite`, counts, and revenue display correctly in Overview tab.

---

*Plan created: March 2026*
