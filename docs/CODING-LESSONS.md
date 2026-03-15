# CODING-LESSONS.md — Audit-Derived Coding Rules

> Derived from the pre-launch audit (2026-03-14) that found 62 bugs across 17 modules.  
> Each rule maps to one or more real bugs. Bug IDs are listed as references.  
> Read this before writing any new feature or touching existing hooks, forms, or date logic.

---

## Contents

1. [React Query — Always invalidate scoped keys](#1-react-query--always-invalidate-scoped-keys)
2. [Date arithmetic — Always use UTC-safe construction](#2-date-arithmetic--always-use-utc-safe-construction)
3. [Router navigation — Never use window.location](#3-router-navigation--never-use-windowlocation)
4. [Error toasts — Never expose raw error messages](#4-error-toasts--never-expose-raw-error-messages)
5. [Null guards — Always guard string/array ops on nullable fields](#5-null-guards--always-guard-stringarray-ops-on-nullable-fields)
6. [isNaN — Never use Number.isNaN on a Date object](#6-isnan--never-use-numberisnan-on-a-date-object)
7. [Form submit — Never wire handleSubmit to both form and button](#7-form-submit--never-wire-handlesubmit-to-both-form-and-button)
8. [Auth guards — Handle undefined AND null profile separately](#8-auth-guards--handle-undefined-and-null-profile-separately)
9. [React Hook Form — Always call setValue for external field updates](#9-react-hook-form--always-call-setvalue-for-external-field-updates)
10. [API layer — Never call Supabase directly in components or hooks](#10-api-layer--never-call-supabase-directly-in-components-or-hooks)
11. [Month display — Never use getMonth() as a display index directly](#11-month-display--never-use-getmonth-as-a-display-index-directly)
12. [useEffect order — Guard against multiple effects racing](#12-useeffect-order--guard-against-multiple-effects-racing)
13. [Multi-step writes — Always inform user of partial failure](#13-multi-step-writes--always-inform-user-of-partial-failure)
14. [Role-gated queries — Never fetch sensitive data unconditionally](#14-role-gated-queries--never-fetch-sensitive-data-unconditionally)
15. [Realtime channels — Always set up supabase.channel() inside api.js](#15-realtime-channels--always-set-up-supabasechannel-inside-apijs)
16. [Page components — Never import supabase directly](#16-page-components--never-import-supabase-directly)
17. [Dead imports — Remove unused imports immediately after refactoring](#17-dead-imports--remove-unused-imports-immediately-after-refactoring)

---

## 1. React Query — Always invalidate scoped keys

**Audit references:** CU-C2, CU-I1, WO-C1, SB-C2, FI-I1, FI-I2, NO-C1, SA-I1, PR-I1 (9 bugs)

In React Query v5, `invalidateQueries({ queryKey: ['foo'] })` uses **prefix matching by default**, but only when `exact: false`. Invalidating a parent key does NOT guarantee all child/scoped keys are cleared when those child keys include additional segments. Always trace every `useQuery` that depends on mutated data and invalidate its exact key.

### ❌ Never do this

```js
// hooks.js — after deleting a site
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: siteKeys.all });
  // siteKeys.all = ['sites']
  // BUT useCustomerSites uses key ['sites', 'byCustomer', customerId]
  // That key is NOT cleared — deleted site still appears
};
```

```js
// hooks.js — after recording a payment
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  // useSubscriptionPayments uses subscriptionKeys.payments(id)
  // Payment grid stays stale until manual refresh
};
```

### ✅ Always do this instead

```js
// hooks.js — invalidate the EXACT scoped key used by the consuming hook
onSuccess: (_, { customerId }) => {
  queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
  queryClient.invalidateQueries({ queryKey: siteKeys.listByCustomer(customerId) });
};
```

```js
// hooks.js — invalidate the specific payment list key
onSuccess: (_, { subscriptionId }) => {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.payments(subscriptionId) });
};
```

**Rule of thumb:** When writing any `useMutation`, open the corresponding `useQuery` hook and copy its exact `queryKey`. Paste it into the `invalidateQueries` call. Do not guess by prefix alone.

**Why:** Prefix invalidation is inconsistent across key shapes. The consuming hook's exact key is the ground truth — anything shorter may silently miss it.

---

## 2. Date arithmetic — Always use UTC-safe construction

**Audit references:** WO-I3, SC-C2, NO-I1, TA-I2, CA-C2, AB-C2 (6 bugs)

String-concatenated dates like `new Date('2024-06-15T12:00:00')` are parsed as **local time**. In UTC+ environments (Turkey is UTC+3), local midnight is 3 hours behind UTC midnight. Arithmetic that mixes local and UTC date objects produces off-by-one day errors in date labels, calendar highlights, and "days late" metrics.

### ❌ Never do this

```js
// Parsed as local time — wrong in UTC+ environments
const start = new Date(dateFrom + 'T12:00:00');

// Excel serial to date — creates UTC midnight, displays as previous day locally
const date = new Date((serial - 25569) * 86400 * 1000);

// Local midnight ≠ UTC midnight when crossing day boundaries
const date = new Date(parseInt(year), parseInt(month) - 1, 1);
```

### ✅ Always do this instead

```js
// Force UTC by appending Z — unambiguous across all timezones
const start = new Date(dateFrom + 'T12:00:00Z');

// Excel serial: compensate for local timezone offset
function excelSerialToDate(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMs);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs);
}

// Date arithmetic for "days late" — compare UTC dates to UTC dates
const todayUtc = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');
const scheduledUtc = new Date(row.scheduled_date + 'T00:00:00Z');
const daysLate = Math.floor((todayUtc - scheduledUtc) / 86400000);
```

**Why:** Turkey is UTC+3. Midnight local time is 21:00 the previous UTC day. Any date created with `new Date(localString)` or `new Date(year, month, day)` will subtract 3 hours when compared to UTC timestamps from the database, producing off-by-one errors in calendar views, date labels, and day-late calculations.

---

## 3. Router navigation — Never use window.location

**Audit references:** WO-C3

`window.location.replace()` or `window.location.href =` bypasses React Router entirely. This destroys the entire React application, clears the React Query cache, and resets all component state. It also executes even when the preceding async operation fails, potentially navigating the user away from a failed action.

### ❌ Never do this

```js
// hooks.js or component
onSuccess: () => {
  window.location.replace('/work-orders'); // full page reload, cache destroyed
  // or:
  window.location.href = '/work-orders';
};
```

### ✅ Always do this instead

```js
// Component — import useNavigate from react-router-dom
import { useNavigate } from 'react-router-dom';

function WorkOrderDetailPage() {
  const navigate = useNavigate();

  const { mutate: deleteWorkOrder } = useDeleteWorkOrder({
    onSuccess: () => {
      navigate('/work-orders', { replace: true });
    },
  });
}
```

```js
// hooks.js — accept navigate as a parameter when needed
export function useDeleteWorkOrder({ onSuccess } = {}) {
  return useMutation({
    mutationFn: deleteWorkOrder,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      onSuccess?.();
    },
  });
}
```

**Why:** `window.location` bypasses React Router, destroys the React Query cache on reload, and fires even when the DB operation failed, potentially sending the user away from a half-executed action with no data.

---

## 4. Error toasts — Never expose raw error messages

**Audit references:** FS-RE1, FS-RE2, FS-RE3, FS-RE4 (and previously widespread)

`err?.message` from Supabase errors contains internal details: table names, constraint names, column names, and PostgreSQL error codes. Showing these to end users is both a UX failure and a security concern (information disclosure).

### ❌ Never do this

```js
onError: (err) => {
  toast.error(err?.message);                            // shows raw DB error
  toast.error(err?.message || 'Bir hata oluştu');      // hardcoded fallback
  toast.error(err?.message || t('staticIp.success.assigned')); // fallback is a success string!
};
```

### ✅ Always do this instead

```js
// Use the semantic key matching the operation type
onError: () => {
  toast.error(t('common:errors.saveFailed'));    // for create/update
  toast.error(t('common:errors.deleteFailed')); // for delete
  toast.error(t('common:errors.loadFailed'));   // for fetch/load
};
```

```js
// In console.error — log only the message, not the full error object
catch (error) {
  console.error('Operation failed:', error?.message ?? error);
  toast.error(t('common:errors.saveFailed'));
}
```

**Available keys in `common.json`:**
```json
"errors": {
  "saveFailed": "Kayıt başarısız oldu. Lütfen tekrar deneyin.",
  "loadFailed": "Veriler yüklenemedi. Lütfen tekrar deneyin.",
  "deleteFailed": "Silme işlemi başarısız oldu. Lütfen tekrar deneyin."
}
```

**Why:** Raw Supabase error messages expose internal table names, constraint names, and PostgreSQL error codes to the browser and to users, constituting both an information disclosure vulnerability and a broken UX.

---

## 5. Null guards — Always guard string/array ops on nullable fields

**Audit references:** WO-I2, DA-C1, CA-I1, SA-C1, SC-I2 (5 bugs)

Database columns that are `nullable` will occasionally be `null` in production — even if they "should" always have a value. Operations like `.charAt()`, `.slice()`, `.map()`, and arithmetic on `null` silently produce errors or wrong output that can crash entire components.

### ❌ Never do this

```jsx
// worker.name is full_name from profiles — can be null
worker.name.charAt(0)               // throws TypeError: Cannot read properties of null

// customer_name is a joined column — null if customer was deleted
{item.customer_name} · {item.title} // renders "undefined · undefined"

// cost_price is nullable in sim_cards
simCard.cost_price || 0             // null || 0 = 0, masking missing cost data
```

### ✅ Always do this instead

```jsx
// String operations — always use optional chaining + nullish coalescing
worker.name?.charAt(0) ?? '?'

// Rendered fields — guard with ?? fallback
{item.customer_name ?? t('common:labels.unknown')} · {item.title ?? '—'}

// Numeric nullable — use nullish coalescing, not logical OR
//   || treats 0 as falsy (hides legitimate zero costs)
//   ?? only falls back for null/undefined
const cost = simCard.cost_price ?? null; // preserve null for "no data" vs "zero"

// Array fields — always guard .map()
(workers ?? []).map(w => w.name?.charAt(0) ?? '?')
```

**Why:** Nullable database columns will be `null` in practice. `.charAt()` and `.map()` on `null` throw TypeErrors that crash the component and show a blank screen to the user. Falsy checks (`||`) additionally mask legitimate zero values in financial fields.

---

## 6. isNaN — Never use Number.isNaN on a Date object

**Audit references:** CA-C1

`Number.isNaN(value)` only returns `true` when `value` is literally the `NaN` primitive. A `Date` object constructed with invalid input (e.g., `new Date(NaN)`) is an object — not the `NaN` primitive — so `Number.isNaN(dateObject)` returns `false` even for an Invalid Date, bypassing the guard entirely.

### ❌ Never do this

```js
const date = new Date(year, month - 1, day, hour, minute);
if (!date || Number.isNaN(date.getTime())) return null;
//           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Number.isNaN(NaN) = true — correct
// BUT: Number.isNaN(new Date(NaN)) = false — Date is an object, not NaN
// Invalid Date slips through and reaches the calendar renderer
```

### ✅ Always do this instead

```js
const date = new Date(year, month - 1, day, hour, minute);
// Use global isNaN (coerces its argument) or check .getTime() explicitly
if (!date || isNaN(date.getTime())) return null;
//           ^^^^^^^^^^^^^^^^^^^^^ — correctly catches Invalid Date
```

**Why:** `Number.isNaN` does not coerce its argument. An Invalid Date's `.getTime()` returns `NaN` (the primitive), but the Date object itself is not `NaN`. Only the global `isNaN()` or an explicit `date.getTime() !== date.getTime()` check reliably detects Invalid Date.

---

## 7. Form submit — Never wire handleSubmit to both form and button

**Audit references:** TA-C1

React Hook Form's `handleSubmit(onSubmit)` executes the mutation when called. Attaching it to both the `<form onSubmit>` event and a `<button onClick>` handler means a single button click fires the mutation **twice**: once from the click event bubbling to the form's submit, and once directly from `onClick`.

### ❌ Never do this

```jsx
<form onSubmit={handleSubmit(onSubmit)}>
  {/* ... fields ... */}
  <Button onClick={handleSubmit(onSubmit)}>  {/* DOUBLE FIRE */}
    Kaydet
  </Button>
</form>
```

### ✅ Always do this instead

```jsx
// Option A — use form's onSubmit only, button type="submit"
<form onSubmit={handleSubmit(onSubmit)}>
  {/* ... fields ... */}
  <Button type="submit" loading={isSubmitting}>
    Kaydet
  </Button>
</form>

// Option B — use button onClick only, no form onSubmit (for modal forms)
<form>
  {/* ... fields ... */}
  <Button
    type="button"
    onClick={handleSubmit(onSubmit)}
    loading={isSubmitting}
  >
    Kaydet
  </Button>
</form>
```

**Why:** Attaching `handleSubmit` to both the `<form>` and the `<button>` fires the mutation twice per click, creating duplicate database rows — a data integrity bug that is invisible to the user but corrupts the dataset.

---

## 8. Auth guards — Handle undefined AND null profile separately

**Audit references:** AB-C1

`useCurrentProfile()` returns `undefined` while loading and may return `null` if the profile fetch fails. A guard written as `if (profile && profile.role !== 'admin')` skips the check when `profile` is falsy — which includes both the loading state (`undefined`) and the error state (`null`). Sensitive content renders to all users during load or on auth failure.

### ❌ Never do this

```jsx
const { data: profile } = useCurrentProfile();
const sensitiveData = useAdminData(); // always fetched

if (profile && profile.role !== 'admin') {
  return <AccessDenied />;
  // profile = undefined (loading) → skips this, renders admin content
  // profile = null (error)        → skips this, renders admin content
}
return <AdminPage data={sensitiveData} />;
```

### ✅ Always do this instead

```jsx
const { data: profile, isLoading, isError } = useCurrentProfile();

// Show spinner while profile is being fetched
if (isLoading) return <Spinner />;

// Deny access if profile failed to load — fail closed
if (isError || !profile) return <AccessDenied />;

// Now profile is guaranteed to be a non-null object
if (profile.role !== 'admin') return <AccessDenied />;

return <AdminPage />;
```

```jsx
// For conditional data fetching — use the `enabled` option
const { data: adminData } = useAdminData({
  enabled: profile?.role === 'admin',
});
```

**Why:** Auth checks that pass on falsy values (both `undefined` and `null`) expose sensitive UI and data during the profile loading window, which is long enough on slow connections for a user to see or interact with admin content they should not access.

---

## 9. React Hook Form — Always call setValue for external field updates

**Audit references:** SA-C1

React Hook Form maintains its own internal state tree. When you update a piece of local state (e.g., `setSelectedCustomerId`) in response to a UI event, the form's registered field does **not** automatically reflect that change. If you forget to call `setValue('fieldName', value)`, the form field stays at its initial value and Zod validation will fail — even though your UI looks correct.

### ❌ Never do this

```js
// BulkAssetRegisterModal — onCustomerChange handler
const onCustomerChange = (customerId) => {
  setSelectedCustomerId(customerId);   // updates local state
  // form field 'customer_id' is still '' — validation fails every time
};
```

### ✅ Always do this instead

```js
const { register, setValue, handleSubmit } = useForm({
  resolver: zodResolver(assetSchema),
  defaultValues: assetDefaultValues,
});

const onCustomerChange = (customerId) => {
  setSelectedCustomerId(customerId);
  setValue('customer_id', customerId, { shouldValidate: true });
  //                                    ^^^^^^^^^^^^^^^^^^^
  // Trigger validation immediately so the error clears on selection
};
```

**General rule:** Any time a field value is set from outside the form (callback, prop, event handler, `useEffect`), use `setValue('fieldName', value)`. This keeps the form's internal state and the UI in sync.

**Why:** RHF's `register()` and `Controller` only respond to native input events or explicit `setValue`/`reset` calls. Setting external state without calling `setValue` leaves the form's internal model at its stale value, causing validation to fail silently and the submit to be blocked with no visible error.

---

## 10. API layer — Never call Supabase directly in components or hooks

**Audit references:** FS-C1, FS-C2, FS-hooks (and general architectural principle)

All Supabase calls must live in `api.js` files. Components and even custom hooks (`hooks.js`) must only call functions exported from `api.js`. This ensures: (1) auth logic is centrally testable, (2) error handling is consistent, (3) the Supabase client can be swapped or mocked without touching component code.

### ❌ Never do this

```js
// useAuth.js — direct Supabase call in a hook
import { supabase } from '@/lib/supabase';

supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
});

supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
});
```

```jsx
// AnyComponent.jsx — direct Supabase call in a component
import { supabase } from '@/lib/supabase';

const { data } = await supabase.from('customers').select('*');
```

### ✅ Always do this instead

```js
// auth/api.js — wrap Supabase calls here
export function getRawSession() {
  return supabase.auth.getSession();
}
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// useAuth.js — import from api.js, not from supabase directly
import * as authApi from '@/features/auth/api';

authApi.getRawSession().then(({ data: { session } }) => {
  setSession(session);
});
authApi.onAuthStateChange((event, session) => {
  setSession(session);
});
```

**Import hierarchy:**

```
Component (.jsx)
  └── hooks.js (useQuery / useMutation)
        └── api.js (all supabase.from / supabase.auth calls)
              └── lib/supabase.js (client singleton)
```

No layer should skip a level in this chain.

**Why:** Direct Supabase calls scattered across components and hooks make error handling inconsistent, make the codebase hard to audit for security issues, and couple UI components to the database client in a way that prevents future refactoring.

---

## 11. Month display — Never use getMonth() as a display index directly

**Audit references:** SB-C1, SB-I3

`Date.prototype.getMonth()` returns `0` for January and `11` for December. Turkish translation keys and any human-facing month numbering use `1`–`12`. Using the raw `getMonth()` value as a translation key index produces a consistent off-by-one where every month label shows the previous month.

### ❌ Never do this

```js
const monthIndex = date.getMonth();             // 0 for January
return t(`common:monthsShort.${monthIndex}`);  // key "0" → probably undefined or December
```

```js
// Modal heading
const month = paymentDate.getMonth();           // 4 for May
const label = t(`months.${month}`);            // shows "Nisan" (April) instead of "Mayıs"
```

### ✅ Always do this instead

```js
// Add 1 to convert from 0-indexed to 1-indexed
const monthIndex = date.getMonth() + 1;         // 1 for January
return t(`common:monthsShort.${monthIndex}`);  // key "1" → "Oca"

// Or use date-fns for locale-aware formatting — avoids the index entirely
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
const label = format(date, 'MMMM', { locale: tr }); // "Ocak"
```

**Why:** `getMonth()` is zero-indexed. Translation files and display labels are one-indexed. Using the raw value without `+1` produces a silent, consistent off-by-one that shifts every displayed month name one month earlier.

---

## 12. useEffect order — Guard against multiple effects racing

**Audit references:** WO-C2, A-I1

When a component has two or more `useEffect` hooks that both write to the same form state (or both trigger async operations), React does not guarantee which effect's writes "win". A cache hit from React Query can make an edit-mode effect execute synchronously and overwrite a create-mode prefill before the prefill's effect even runs.

### ❌ Never do this

```jsx
// WorkOrderFormPage — two effects that both call reset() or setValue()
useEffect(() => {
  // Effect 1: prefill from router state (create mode)
  if (locationState?.site_id) {
    setValue('site_id', locationState.site_id);
  }
}, [locationState]);

useEffect(() => {
  // Effect 2: populate from query cache (edit mode)
  if (existingOrder) {
    reset(mapToFormValues(existingOrder)); // overwrites Effect 1's setValue in create mode
  }
}, [existingOrder]);
```

### ✅ Always do this instead

```jsx
// Combine into a single effect with explicit mode branching
useEffect(() => {
  if (isEditMode && existingOrder) {
    reset(mapToFormValues(existingOrder));
  } else if (!isEditMode && locationState?.site_id) {
    // Only prefill when NOT in edit mode
    setValue('site_id', locationState.site_id);
  }
}, [isEditMode, existingOrder, locationState]);
```

```js
// For auth listeners — always clean up and guard against early-return paths
useEffect(() => {
  let subscription;

  const init = async () => {
    const { data: { session }, error } = await authApi.getRawSession();
    if (error) return; // early return — subscription not yet assigned
    setSession(session);

    const { data } = authApi.onAuthStateChange(callback);
    subscription = data.subscription;
  };

  init();

  return () => {
    subscription?.unsubscribe(); // safe even if subscription was never assigned
  };
}, []);
```

**Why:** React does not guarantee execution order between independent `useEffect` calls when dependencies resolve simultaneously. Merging related effects into a single effect with explicit branching eliminates race conditions between them.

---

## 13. Multi-step writes — Always inform user of partial failure

**Audit references:** SB-I1, SC-C1, MA-C1

When a feature performs two sequential writes (e.g., update subscription → recalculate payments, or insert batch rows), the second step can fail after the first has already committed. Without explicit handling, the database is left in an inconsistent state and the user has no idea — they see either a success message or a silent redirect.

### ❌ Never do this

```js
// api.js — sequential writes with no partial-failure handling
const { error: updateError } = await supabase.from('subscriptions').update(...);
if (updateError) throw updateError;

// If this RPC fails, subscription shows new price but payments show old amounts
const { error: rpcError } = await supabase.rpc('fn_update_subscription_price', {...});
// rpcError is never checked
```

```js
// hooks.js — batch import with no per-row feedback
const { error } = await supabase.from('sim_cards').insert(allRows);
if (!error) navigate('/sim-cards'); // navigates away even on timeout/partial commit
```

### ✅ Always do this instead

```js
// api.js — check every sequential write and throw with context
const { error: updateError } = await supabase.from('subscriptions').update(...);
if (updateError) throw updateError;

const { error: rpcError } = await supabase.rpc('fn_update_subscription_price', {...});
if (rpcError) {
  // First write succeeded; throw a specific error so the hook can show the right message
  throw Object.assign(new Error('price_rpc_failed'), { partialSuccess: true });
}
```

```js
// hooks.js — handle partial-success scenario
onError: (err) => {
  if (err.partialSuccess) {
    toast.warning(t('subscriptions:priceUpdatePartialError'));
  } else {
    toast.error(t('common:errors.saveFailed'));
  }
},
```

```js
// import flow — only navigate on confirmed success, warn on failure
const { error } = await supabase.from('sim_cards').insert(allRows);
if (error) {
  toast.warning(t('simCards:import.partialFailureWarning'));
  return; // stay on import page
}
navigate('/sim-cards');
```

**Why:** Sequential writes without rollback leave the database in an inconsistent state silently. The user needs to know when a partial failure occurred so they can manually correct the data — otherwise the inconsistency persists undetected in production.

---

## 14. Role-gated queries — Never fetch sensitive data unconditionally

**Audit references:** AB-C1, DA-I1

Queries behind role checks (admin-only data, finance data, action board counts) must not be fired until the user's role is confirmed. Unconditional hook calls fire the query during load (`profile = undefined`) and on auth failure (`profile = null`) — exposing sensitive data to anyone whose profile request is slow or fails.

### ❌ Never do this

```jsx
// DashboardPage — fires 3 admin queries for ALL users
const { total } = useActionBoardCounts(); // no role check
const { data: profile } = useCurrentProfile();

if (profile?.role === 'admin') {
  return <ActionBoardWidget count={total} />; // guarded in JSX, but queries already ran
}
```

```jsx
// ActionBoardPage — data fetched regardless of profile state
const { data: profile } = useCurrentProfile();
const { lateWorkOrders } = useActionBoardData(); // fires immediately, no guard

if (profile && profile.role !== 'admin') return <AccessDenied />;
// profile = undefined (loading) → content renders for all users
```

### ✅ Always do this instead

```jsx
// Guard the query with the `enabled` option — does not fire until role is known
const { data: profile, isLoading } = useCurrentProfile();

const isAdmin = profile?.role === 'admin'; // undefined while loading = false

const { data: lateWorkOrders } = useLateWorkOrders({
  enabled: isAdmin, // query is blocked until isAdmin = true
});

// Also render nothing sensitive while profile is loading
if (isLoading) return <Spinner />;
if (!isAdmin) return <AccessDenied />;
```

```js
// hooks.js — accept enabled option and pass it through
export function useActionBoardData({ enabled = true } = {}) {
  const lateWorkOrders = useQuery({
    queryKey: actionBoardKeys.lateWorkOrders(),
    queryFn: fetchLateWorkOrders,
    enabled,
  });
  // ...
}
```

**Why:** React Query fires `useQuery` the moment a component mounts, regardless of what the JSX renders. Role-checking only in JSX does not prevent the data fetch. Sensitive data is requested, received, and cached in the browser before the user's identity is confirmed.

---

## 15. Realtime channels — Always set up supabase.channel() inside api.js

**Audit references:** FS-C1 (calendar/hooks.js), FS-C2 (notifications/hooks.js)

Supabase Realtime channel setup (`supabase.channel()`, `.on()`, `.subscribe()`, `supabase.removeChannel()`) is a direct Supabase client call — the same as any `.from()` or `.rpc()` call. It must live in `api.js`, not in `hooks.js` or page components. The hook should only call the exported wrapper function.

### ❌ Never do this

```js
// hooks.js — direct Supabase Realtime call inside a hook
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export function useCalendarRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase               // ← direct supabase call in hooks.js
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}
```

### ✅ Always do this instead

```js
// calendar/api.js — Realtime setup lives here alongside all other Supabase calls
export function subscribeToCalendar(onWorkOrderChange, onTaskChange) {
  return supabase
    .channel('calendar-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, onWorkOrderChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onTaskChange)
    .subscribe();
}

export function unsubscribeFromCalendar(channel) {
  return supabase.removeChannel(channel);
}
```

```js
// calendar/hooks.js — imports the wrapper, no direct supabase import
import { isSupabaseConfigured } from '../../lib/supabase';
import { subscribeToCalendar, unsubscribeFromCalendar } from './api';

export function useCalendarRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = subscribeToCalendar(
      () => { queryClient.invalidateQueries({ queryKey: calendarKeys.all }); },
      () => { queryClient.invalidateQueries({ queryKey: calendarKeys.all }); }
    );

    return () => { unsubscribeFromCalendar(channel); };
  }, [queryClient]);
}
```

**Why:** Realtime channel setup is a Supabase client call like any other. Keeping it in `hooks.js` bypasses the `api.js` boundary, scatters direct Supabase coupling across two layers, and makes the channel logic harder to audit, mock, or replace.

---

## 16. Page components — Never import supabase directly

**Audit references:** FS-C3 (SubscriptionFormPage.jsx), FS-C4 (auth pages before fix)

Page components (`.jsx` files) must never import `supabase` from `lib/supabase` directly. Every DB or auth call a page needs must be delegated to a named function in `api.js`. This includes one-off queries, concurrent-edit staleness checks, and auth session reads.

### ❌ Never do this

```jsx
// SubscriptionFormPage.jsx — direct supabase import in a page component
import { supabase } from '../../lib/supabase';

const onSubmit = async (data) => {
  // Inline staleness check — Supabase call embedded in page logic
  const { data: current } = await supabase
    .from('subscriptions')
    .select('updated_at')
    .eq('id', id)
    .single();

  if (current?.updated_at !== loadedRef.current) { ... }
};
```

### ✅ Always do this instead

```js
// subscriptions/api.js — named function isolates the DB call
export async function getSubscriptionUpdatedAt(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data?.updated_at;
}
```

```jsx
// SubscriptionFormPage.jsx — imports only from api.js, no supabase import
import { getSubscriptionUpdatedAt } from './api';

const onSubmit = async (data) => {
  const updatedAt = await getSubscriptionUpdatedAt(id);
  if (updatedAt !== loadedRef.current) { ... }
};
```

**Import hierarchy to follow strictly:**

```
Page (.jsx)  →  hooks.js  →  api.js  →  lib/supabase.js
```

**Why:** A direct `supabase` import in a page component bypasses the `api.js` boundary entirely, embeds query logic inside UI code, and means any change to query shape, error handling, or auth flow requires hunting down page components rather than updating one central function.

---

## 17. Dead imports — Remove unused imports immediately after refactoring

**Audit references:** FS-C3 (supabase import left in SubscriptionFormPage after DB call was moved)

When you move a Supabase call (or any logic) from one file to another, immediately remove the now-unused import from the original file. Do not leave `import { supabase }` or similar in a file where it is no longer called — this constitutes a dead import that misleads future readers into thinking the file still makes direct DB calls.

### ❌ Never do this

```js
// SubscriptionFormPage.jsx — after moving the inline supabase.from() call to api.js
import { supabase } from '../../lib/supabase'; // ← supabase is no longer used here
import { getSubscriptionUpdatedAt } from './api';

// supabase is never called anywhere in this file
```

### ✅ Always do this instead

```js
// SubscriptionFormPage.jsx — remove the import the moment the call moves to api.js
import { getSubscriptionUpdatedAt } from './api';

// File is clean — no direct supabase dependency
```

**Checklist after any refactor that moves Supabase calls:**

1. Search the original file for `supabase` — if zero uses remain, delete the import line.
2. Run the linter (`npm run lint`) — unused imports are caught as warnings.
3. Check that no sibling `isSupabaseConfigured` import is now also stranded (it is often imported alongside `supabase`).

**Why:** Dead imports are misleading — they signal that a file still has a direct Supabase dependency when it does not. During security audits, unused imports produce false positives that hide real violations. They also couple the file to a module it no longer needs, making future refactors harder.

---

## Summary Checklist

Before submitting any PR that touches mutations, forms, date logic, or auth flows, verify:

- [ ] Every `useMutation` invalidates the **exact** `queryKey` used by its dependent `useQuery` calls
- [ ] All dates are constructed as UTC (`+ 'T00:00:00Z'`) or use `Date.UTC()` when doing arithmetic
- [ ] Navigation after mutations uses `useNavigate()`, never `window.location`
- [ ] All `onError` handlers use `t('common:errors.*')` keys, never `err?.message`
- [ ] All JSX fields derived from nullable DB columns use `?? fallback`
- [ ] Invalid Date guards use global `isNaN(date.getTime())`, not `Number.isNaN`
- [ ] Form `<form onSubmit>` and submit `<button onClick>` do not both call `handleSubmit`
- [ ] Auth-gated components check `isLoading`, then `!profile`, then `profile.role`
- [ ] External field updates (dropdown callbacks, URL params, props) call `setValue()`
- [ ] No `supabase.*` calls exist outside of `api.js` files
- [ ] Month display values add `+1` to `getMonth()` output, or use `date-fns` format
- [ ] Multiple `useEffect` hooks writing to the same state are merged into one with explicit branching
- [ ] Sequential writes check every step and show a specific warning on partial failure
- [ ] Role-gated queries pass `enabled: isAdmin` (not just guard the JSX render)
- [ ] Supabase Realtime `channel()` / `removeChannel()` calls are in `api.js`, not in `hooks.js` or components
- [ ] No page component (`.jsx`) imports `supabase` directly — all DB/auth calls go through named `api.js` functions
- [ ] After moving any Supabase call to `api.js`, the originating file has no remaining `supabase` import
