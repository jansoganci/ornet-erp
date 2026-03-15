# Pre-Launch Critical Bug Audit

> **STATUS: ✅ COMPLETED — 2026-03-14**
> All 62 bugs (28 CRITICAL, 34 IMPORTANT) have been resolved.
> Lessons extracted to: /docs/CODING-LESSONS.md
> Test scenarios documented in: /docs/TEST-SCENARIOS.md
> Ready for archive.

---

> Generated: 2026-03-14
> Scope: All 17 active feature modules
> Method: Full static analysis of api.js, hooks.js, schema.js, and all page/component files
> Only CRITICAL and IMPORTANT bugs are listed. Style, i18n gaps, and performance micro-opts are excluded.

---

## Legend

| Severity | Definition |
|---|---|
| **CRITICAL** | Data loss, security breach, crash, silent data corruption, or broken core flow |
| **IMPORTANT** | Stale UI after mutations, edge-case crashes, wrong calculations, UX-breaking behavior |

---

## Summary

| Module | CRITICAL | IMPORTANT |
|---|:---:|:---:|
| auth | 3 | 4 |
| customers | 2 | 2 |
| workOrders | 3 | 4 |
| dashboard | 2 | 2 |
| finance | 1 | 2 |
| subscriptions | 3 | 3 |
| proposals | 3 | 3 |
| simCards | 2 | 4 |
| siteAssets | 1 | 1 |
| materials | 1 | 1 |
| notifications | 1 | 1 |
| tasks | 1 | 2 |
| workHistory | — | 1 |
| calendar | 2 | 1 |
| actionBoard | 2 | 1 |
| profile | 1 | 2 |
| customerSites | — | — |
| **TOTAL** | **28** | **34** |

---

## 01 · auth

### CRITICAL

**A-C1 — Email verification always marks as verified**
`src/features/auth/VerifyEmailPage.jsx` ~line 47

```js
setTimeout(async () => {
  const { data: { session: refreshedSession } } = await supabase.auth.getSession();
  if (refreshedSession?.user?.email_confirmed_at) {
    setStatus('success');
  } else {
    setStatus('success'); // BUG: success even when NOT verified
  }
}, 1500);
```

Both branches of the condition set `status = 'success'`. Users receive a "Verified!" screen and are redirected to the dashboard with an unverified email. The database record remains unconfirmed.

---

**A-C2 — Password recovery race condition on slow connections**
`src/features/auth/UpdatePasswordPage.jsx` ~line 52

```js
setTimeout(() => {
  setPageState((current) => {
    if (current === 'loading') return 'error'; // fires after 2 s
  });
}, 2000);
```

If the `PASSWORD_RECOVERY` Supabase event arrives after the 2-second timeout (plausible on mobile/slow networks), the user is shown an error screen even though their recovery link is valid. They cannot reset their password without starting over.

---

**A-C3 — Password change with no old-password re-authentication**
`src/features/auth/api.js` ~line 59

```js
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  // No old password required
}
```

An attacker with an unattended authenticated session (or exploiting XSS) can immediately change the password and lock the real user out of their account.

---

### IMPORTANT

**A-I1 — Subscription not cleaned up on `getSession()` error**
`src/features/auth/UpdatePasswordPage.jsx` ~line 49
If `getSession()` rejects, the function returns early but the `onAuthStateChange` subscription is still active and never cleaned up until component unmount. Memory leak in long-lived sessions.

**A-I2 — Unhandled promise rejection inside `setTimeout`**
`src/features/auth/VerifyEmailPage.jsx` ~line 47
`setTimeout(async () => { await supabase.auth.getSession() })` — any thrown error inside the async callback becomes an unhandled rejection.

**A-I3 — Submit button stuck in loading state after navigation failure**
`src/features/auth/LoginPage.jsx` ~line 36
On successful sign-in, `navigate()` is called outside the try/catch. If navigation throws, the button loading state is never reset and the UI appears frozen.

**A-I4 — No retry path from registration success screen**
`src/features/auth/RegisterPage.jsx` ~line 21
Once `isSuccess = true`, the success screen has no "Go back" or retry mechanism. If the verification email is delayed or the link expires, the user cannot re-register without a hard page reload.

---

## 02 · customers

### CRITICAL

**CU-C1 — Deleted customer remains in React Query cache**
`src/features/customers/hooks.js` (`useDeleteCustomer`)

```js
onSuccess: (_, id) => {
  queryClient.removeQueries({ queryKey: customerKeys.detail(id) });
```

In React Query v5, `onSuccess(data, variables)` — here `_` is data and `id` is variables. BUT `deleteCustomer()` in api.js returns `{ success: true }`, which provides no id in the response. The `id` from variables IS passed correctly, so cache removal works — however, the list query is invalidated but not the related **site** queries. After deletion, navigating to the customer's old URL shows a stale detail page.

More critically: `queryClient.removeQueries` does NOT await; if the user clicks back before the navigation completes, the cached detail is still served.

**CU-C2 — Deleted site reappears until manual refresh**
`src/features/customerSites/hooks.js` (`useDeleteSite`)

```js
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: siteKeys.all });
  // Missing: siteKeys.listByCustomer(customerId)
```

`useCustomerSites(customerId)` uses key `siteKeys.listByCustomer(customerId)` which is scoped differently from `siteKeys.all`. After deleting a site, the customer detail page still shows it because the scoped query is not invalidated.

---

### IMPORTANT

**CU-I1 — Customer deletion does not invalidate site queries**
`src/features/customers/hooks.js` (`useDeleteCustomer`) — After deleting a customer, `siteKeys.listByCustomer(id)` is never invalidated. If another part of the app queries sites for the just-deleted customer ID, stale results are served.

**CU-I2 — `SiteFormModal` calls `toast.success` twice on update**
`src/features/customerSites/SiteFormModal.jsx` — The update path calls the mutation's built-in `onSuccess` toast AND a local `toast.success` in the submit handler. Users see a double success notification.

---

## 03 · workOrders

### CRITICAL

**WO-C1 — Material queries not invalidated after work order update**
`src/features/workOrders/hooks.js` (`useUpdateWorkOrder`)

```js
onSuccess: (_, { id }) => {
  queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
  // Missing: workOrderKeys.materials(id)
```

After updating a work order, the materials sub-list (`useWorkOrderMaterials`) is not invalidated. The detail page continues to show old material data until the user navigates away and back.

---

**WO-C2 — Two `useEffect`s race in `WorkOrderFormPage`**
`src/features/workOrders/WorkOrderFormPage.jsx`

The form has one effect that prefills `site_id` from location state (create mode) and another that populates all fields from cached query data (edit mode). React Query can return a cache hit synchronously before the prefill effect runs, causing the edit-mode effect to overwrite the prefill in create mode. Result: stale previous work order's `site_id` ends up in a new work order form.

---

**WO-C3 — Delete uses `window.location.replace` instead of `navigate()`**
`src/features/workOrders/WorkOrderDetailPage.jsx`

```js
onSuccess: () => {
  window.location.replace('/work-orders'); // full page reload
```

This bypasses React Router and empties the React Query cache on reload. Additionally, it fires `onSuccess` regardless of DB errors if the API throws after a partial write. If the Supabase delete fails silently, the user is still redirected away from the work order.

---

### IMPORTANT

**WO-I1 — Mixed-currency material cost totals are silently wrong**
`src/features/workOrders/WorkOrderDetailPage.jsx`
`row.cost ?? row.cost_usd` without checking `row.currency`. If a material was added in USD but the work order is in TRY, the fallback produces a number in the wrong currency and the line-item total is incorrect.

**WO-I2 — `DailyWorkCard` crashes on null worker name**
`src/features/workOrders/components/DailyWorkCard.jsx`
`worker.name.charAt(0)` — no null guard. If `profiles.full_name` is null in the DB, this throws and the entire daily work card fails to render.

**WO-I3 — `getMondayOfWeek()` timezone issue**
`src/features/workOrders/DailyWorkListPage.jsx`
Uses `new Date(dateStr + 'T12:00:00')` without UTC/timezone normalisation. For UTC+ users the computed Monday can be the previous day, showing the wrong week's work.

**WO-I4 — Schema allows zero-worker work orders**
`src/features/workOrders/schema.js`
`assigned_to: z.array(…).min(0)` — no business rule enforces at least one assigned worker for installation/service order types.

---

## 04 · dashboard

### CRITICAL

**DA-C1 — Undefined customer name renders as "undefined · undefined"**
`src/pages/DashboardPage.jsx` ~line 358

```jsx
{item.customer_name} · {item.title}
```

No null guard. When the RPC `get_today_schedule` returns rows with missing customer or title, the schedule card renders literal `"undefined · undefined"` text.

---

**DA-C2 — Action Board counts silent zero on DB error**
`src/features/actionBoard/hooks.js` (`useActionBoardCounts`)

```js
const total = lateWorkOrders.length + overduePayments.length + pendingProposals.length;
return { total, isLoading }; // errors never returned
```

If all three sub-queries fail (network outage, DB down), `lateWorkOrders`, `overduePayments`, and `pendingProposals` default to `[]`, total = 0, and `isLoading = false`. The admin sees "All clear — 0 items" when the system is actually unreachable.

---

### IMPORTANT

**DA-I1 — Non-admin users trigger 3 unnecessary Action Board queries**
`src/pages/DashboardPage.jsx` ~line 126
`useActionBoardCounts()` is called unconditionally. For non-admin users, this fires 3 DB queries that are never displayed. Also, if a user's role changes mid-session, the cached action board data is never invalidated.

**DA-I2 — `CurrencyWidget` renders "Invalid Date" on malformed rate**
`src/features/dashboard/components/CurrencyWidget.jsx`
`new Date(malformedDateString).toLocaleTimeString('tr-TR', …)` returns the string `"Invalid Date"` if the DB returns a non-parseable `rate_date`. No fallback is shown.

---

## 05 · finance

### CRITICAL

**FI-C1 — VAT saved as 1/100th of correct value**
`src/features/finance/QuickEntryModal.jsx` ~lines 184, 208

```js
Math.round(amount * vatRate / 100 * 100) / 100
```

The extra `* 100 / 100` at the end cancels itself, but more importantly the formula applies `vatRate` as a decimal fraction when the input is already a percentage. On a 1000 ₺ transaction with 20% VAT, this saves **2 ₺** instead of **200 ₺**. VAT ledger and regulatory filings will be wrong.

---

### IMPORTANT

**FI-I1 — Filtered transaction queries not invalidated after mutations**
`src/features/finance/hooks.js` — `useCreateTransaction` and `useUpdateTransaction` invalidate `transactionKeys.lists()` (bare prefix). Queries keyed as `['financial_transactions', 'list', { period, type, category }]` may not be cleared, leaving filtered income/expense views stale after mutations.

**FI-I2 — Recurring expense generation doesn't clear list queries**
`src/features/finance/recurringHooks.js` (`useTriggerRecurringGeneration`)
Same partial-key invalidation problem; the main transactions list may not refresh after auto-generating recurring expenses.

---

## 06 · subscriptions

### CRITICAL

**SB-C1 — Monthly payment grid month labels off by one**
`src/features/subscriptions/components/MonthlyPaymentGrid.jsx` ~line 46

```js
const monthIndex = date.getMonth(); // 0–11
return t(`common:monthsShort.${monthIndex}`); // keys are likely 1–12
```

`getMonth()` returns 0 for January, 11 for December. If `monthsShort` translation keys are `"1"` through `"12"` (as is standard), every label shows the previous month. January displays as December, February as January, etc.

---

**SB-C2 — Payment list not refreshed after recording a payment**
`src/features/subscriptions/hooks.js` (`useRecordPayment`)

```js
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  // Missing: subscriptionKeys.payments(subscriptionId)
```

`useSubscriptionPayments(id)` uses `subscriptionKeys.payments(id)` which is not invalidated. After recording a payment, the payment grid does not update until the page is manually refreshed.

---

**SB-C3 — Pause wrongly skips the current month's payment**
`src/features/subscriptions/api.js` ~line 375

```js
.gte('payment_month', currentMonthStart) // >= this month → skips current month too
.eq('status', 'pending')
.update({ status: 'skipped' })
```

Mid-month pauses should only skip **future** months. Using `>=` on the current month start skips the ongoing month's payment immediately, even if the customer already used the service for part of the month.

---

### IMPORTANT

**SB-I1 — Price update: subscription updated but payment amounts not recalculated on RPC failure**
`src/features/subscriptions/api.js` (`updateSubscription`)
If the subscription price update succeeds but the subsequent `fn_update_subscription_price` RPC fails, the subscription header shows the new price while all pending payment rows still show the old amount. No rollback; inconsistent state with no user notification.

**SB-I2 — Import silently ignores `static_ip_fee` and `static_ip_cost`**
`src/features/subscriptions/importApi.js` ~lines 96–117
The import payload does not include `static_ip_fee` / `static_ip_cost` fields. Subscriptions with static IP revenue are imported with those columns zeroed out, under-counting actual recurring revenue.

**SB-I3 — Payment record modal title shows wrong month**
`src/features/subscriptions/components/PaymentRecordModal.jsx` ~line 13
Same `getMonth()` off-by-one as SB-C1; the modal heading reads one month behind the actual payment being recorded.

---

## 07 · proposals

### CRITICAL

**PR-C1 — Proposal total not recalculated correctly after item deletion**
`src/features/proposals/api.js` ~line 227

```js
const total = (items || []).reduce(
  (sum, i) => sum + (i.quantity * (i.unit_price ?? 0)),
  0
);
```

`cost`, `product_cost`, and `labor_cost` per-item fields exist in the schema but are excluded from the total recalculation. After deleting an item, the saved total may not reflect the actual proposal value.

---

**PR-C2 — PDF generation crashes hard on null data with no user-facing error**
`src/features/proposals/components/ProposalPdf.jsx`
`@react-pdf/renderer` throws when `<Text>` receives `null` or `undefined`. No try/catch wraps the render; if proposal data is partially loaded or an item has a null field, the PDF export fails silently — the spinner runs forever or the app crashes.

---

**PR-C3 — Items saved with wrong currency fields on creation**
`src/features/proposals/api.js` ~line 118

```js
unit_price: unitPrice,
unit_price_usd: unitPrice, // always sets USD field = TRY price for TRY proposals
```

`unit_price_usd` is always set equal to `unit_price` regardless of the proposal's `currency`. TRY-denominated proposals store their TRY amounts in USD columns, corrupting financial reporting from creation.

---

### IMPORTANT

**PR-I1 — `proposalKeys.workOrders` not invalidated after item update**
`src/features/proposals/hooks.js` (`useUpdateProposalItems`)
After editing proposal items, linked work order data is not refreshed. The work order materials list shows stale items from the previous proposal state.

**PR-I2 — Currency mismatch when creating work order from proposal**
`src/features/proposals/components/CreateWorkOrderFromProposalModal.jsx` ~line 38
The raw `items` array (which may contain mismatched `unit_price` / `unit_price_usd` per PR-C3) is forwarded to the work order creation endpoint. Work orders inherit the currency corruption.

**PR-I3 — Edit form can corrupt currency fields**
`src/features/proposals/ProposalFormPage.jsx` ~line 70
Edit mode loads items using `unit_price ?? unit_price_usd` fallback. If a USD-only item (null `unit_price`, populated `unit_price_usd`) is loaded, the form presents the USD value as `unit_price`. On save, this USD value is written back to `unit_price` and `unit_price_usd` is set to the same value — overwriting the original USD pricing.

---

## 08 · simCards

### CRITICAL

**SC-C1 — Bulk import has no rollback on partial failure**
`src/features/simCards/SimCardImportPage.jsx` ~lines 227–235

```js
const { error } = await supabase.from('sim_cards').insert(allRows);
```

All rows are inserted in a single call. If the request times out or a constraint fails mid-insert, partially committed rows are saved with no error reported and no per-row feedback. The user is navigated away believing the import succeeded.

---

**SC-C2 — Excel serial-date conversion produces off-by-one dates**
`src/features/simCards/SimCardImportPage.jsx` ~lines 29–34

```js
new Date((serial - 25569) * 86400 * 1000)
```

Standard Excel serial-to-date conversion, but no timezone offset is applied. In UTC+ environments, the resulting Date object is midnight UTC, which rolls back to the previous day in local time. Activation dates can be off by 1–2 days.

---

### IMPORTANT

**SC-I1 — Paginated vs. non-paginated search returns inconsistent results**
`src/features/simCards/api.js` ~line 56
First-page load uses `.ilike('phone_number', …)`, while the non-paginated export path uses `.or(phone_number.ilike…, owner.ilike…)`. The same search term returns different row sets depending on which code path is hit.

**SC-I2 — Invoice analysis hides losses when `cost_price` is null**
`src/features/simCards/utils/compareInvoiceToInventory.js` ~line 74

```js
simCard.cost_price || 0
```

`null || 0` treats missing cost as zero. SIMs with no cost recorded appear to be 100% margin, masking actual losses in the invoice analysis report.

**SC-I3 — Turkcell PDF parser silently drops lines without `str` property**
`src/features/simCards/utils/parseTurkcellPdf.js` ~line 46

```js
textContent.items.map(i => i.str).join(' ')
```

PDF text items without a `str` property produce `undefined` in the array, which gets joined as the string `"undefined"`. Lines that pdfjs-dist returns in non-standard format are silently mangled; some SIM lines are missing from the analysis without any warning.

**SC-I4 — Duplicate phone numbers not detected across format variations**
`src/features/simCards/SimCardImportPage.jsx` ~line 210
Duplicate detection checks raw strings. `+905001234567` and `05001234567` are the same number but pass as distinct; the same SIM can be imported twice with different prefixes.

---

## 09 · siteAssets

### CRITICAL

**SA-C1 — Bulk asset registration always fails from the list page**
`src/features/siteAssets/components/BulkAssetRegisterModal.jsx` ~line 182

```js
const onCustomerChange = (customerId) => {
  setSelectedCustomerId(customerId);
  // Missing: setValue('customer_id', customerId)
};
```

When the modal is opened from the list page (no `customerId` prop pre-set), `onCustomerChange` updates local state but never writes to the React Hook Form field. The `customer_id` form field stays as `''`. Zod UUID validation rejects the submission every time — bulk registration from the list page is completely broken.

---

### IMPORTANT

**SA-I1 — Asset queries with `siteId`/`customerId` scope not invalidated**
`src/features/siteAssets/hooks.js` (`invalidateAssetQueries`)
Mutations only invalidate `assetKeys.all`. Components using `useAssetsBySite(siteId)` or `useAssetsByCustomer(customerId)` may show stale counts after registration because their scoped query keys are not cleared.

---

## 10 · materials

### CRITICAL

**MA-C1 — Import silently resets to upload screen on malformed Excel**
`src/features/materials/MaterialImportPage.jsx` ~line 43

```js
const result = validateAndFormatData(rows);
// if result is undefined (malformed sheet), neither `data` nor `errors` are set
```

When the Excel file has an unexpected structure, `validateAndFormatData()` may return `undefined`. The page resets to the upload state with no error message. Users cannot distinguish a parse failure from "nothing happened."

---

### IMPORTANT

**MA-I1 — No duplicate `code` detection within import batch**
`src/features/materials/MaterialImportPage.jsx` ~line 61
The import does not check for duplicate `code` values within the uploaded sheet itself. If the same material code appears twice in the file, the upsert silently writes it twice (last write wins), with no warning to the user.

---

## 11 · notifications

### CRITICAL

**NO-C1 — Notification badge count stays stale after resolving**
`src/features/notifications/hooks.js` (`useResolveNotification`)

```js
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: notificationKeys.badge() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.all });
```

Active and resolved list queries are keyed with page and filter segments (e.g., `['notifications', 'list', 1, { status: 'active' }]`). Invalidating the bare `notificationKeys.all` prefix does not clear these scoped queries in React Query v5's default exact-match mode. After resolving a notification, both the badge count and the list continue showing the old state.

---

### IMPORTANT

**NO-I1 — Date-range filter off by one day for UTC+ users**
`src/features/notifications/NotificationsCenterPage.jsx` ~line 30

```js
const date = new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1);
```

`new Date(year, month, 1)` creates local-timezone midnight. For users in UTC+ timezones, midnight local time is the previous day in UTC, meaning DB timestamp comparisons can include one extra day from the prior month.

---

## 12 · tasks

### CRITICAL

**TA-C1 — TaskModal creates duplicate tasks on every submit**
`src/features/tasks/TaskModal.jsx` ~lines 104–114

```jsx
<form onSubmit={handleSubmit(onSubmit)}>  {/* fires mutation */}
  …
  <Button onClick={handleSubmit(onSubmit)}>  {/* fires mutation again */}
```

The submit button's `onClick` and the `<form>`'s `onSubmit` both call `handleSubmit(onSubmit)`. A single button click fires the mutation twice, creating duplicate tasks in the database.

---

### IMPORTANT

**TA-I1 — `QuickPlanInput` has no error handler — task lost on failure**
`src/features/tasks/components/QuickPlanInput.jsx` ~line 14

```js
createMutation.mutate(payload, {
  onSuccess: () => { setTitle(''); … },
  // no onError
});
```

If the mutation fails, the form title is not cleared on success — but if a previous title was cleared optimistically and the mutation fires on a retry path, the user's input is lost with no error feedback.

**TA-I2 — Calendar date highlighting wrong on non-UTC timezones**
`src/features/tasks/components/MiniCalendarSidebar.jsx` ~line 118

```js
isSameDay(day, new Date(selectedDate + 'T12:00:00'))
```

String-concatenated date parsing is timezone-dependent. In certain UTC+ offsets, `T12:00:00` interpreted as local time maps to the next UTC day, causing the selected day highlight to appear on the wrong calendar cell.

---

## 13 · workHistory

### IMPORTANT

**WH-I1 — Workers column is always blank**
`src/features/workHistory/WorkHistoryPage.jsx` ~line 153

```js
{ accessor: 'assigned_workers', … }
```

The API returns `assigned_to`, not `assigned_workers`. The column accessor does not match the field name; the render function receives `undefined` for every row. The Workers column is blank in all work history records.

---

## 14 · calendar

### CRITICAL

**CA-C1 — Malformed `scheduled_time` produces Invalid Date that passes the guard**
`src/features/calendar/utils.js` (`parseScheduledAt`) ~line 46

```js
const date = new Date(y, m - 1, d, hour, minute, 0, 0);
// guard:
if (!start || Number.isNaN(start.getTime())) return null;
```

`Number.isNaN(NaN)` is `true`, but `new Date(NaN)` produces an Invalid Date whose `.getTime()` returns `NaN`. The guard condition should be `isNaN(start.getTime())` (global `isNaN`, which coerces) — using `Number.isNaN` with a Date object causes it to evaluate `Number.isNaN(dateObject)` = `false`, letting the Invalid Date through to the calendar renderer, which can crash.

---

**CA-C2 — Week-range label shows wrong dates for UTC+ users**
`src/features/calendar/utils.js` (`formatDateRangeLabel`) ~line 172

```js
const start = new Date(dateFrom + 'T12:00:00');
```

Without explicit UTC handling, `T12:00:00` is parsed as local time. Month/day extraction via `.getMonth()` / `.getDate()` is correct in this case — but when `dateFrom` is close to midnight boundaries (day transitions), the label can display the wrong day.

---

### IMPORTANT

**CA-I1 — `toLocaleUpperCase(undefined)` on undefined language**
`src/features/calendar/utils.js` (`formatDateRangeLabel`) ~line 176

```js
const capitalize = (str) => str.charAt(0).toLocaleUpperCase(language) + str.slice(1);
```

If `i18n.language` is `undefined` during initialisation, `toLocaleUpperCase(undefined)` uses the system default locale instead of Turkish. Month names may not capitalise correctly.

---

## 15 · actionBoard

### CRITICAL

**AB-C1 — Non-admin users can access all sensitive data if profile fetch fails**
`src/features/actionBoard/ActionBoardPage.jsx` ~lines 140, 152

```js
const { data: profile } = useCurrentProfile(); // undefined while loading, null if failed

const { lateWorkOrders, overduePayments, pendingProposals } = useActionBoardData();
// ↑ fetched unconditionally, regardless of role

if (profile && profile.role !== 'admin') { // skipped when profile is undefined OR null
  return <AccessDenied />;
}
```

During initial load (`profile = undefined`) or on profile fetch failure (`profile = null`), the guard short-circuits and all three sensitive query results are rendered. A non-admin user whose profile request fails will permanently see the full action board with late work orders, overdue payments, and pending proposals. No Supabase RLS backs this up.

---

**AB-C2 — `daysLate` calculation off by one in non-UTC environments**
`src/features/actionBoard/api.js` ~lines 4, 18

```js
const today = new Date().toISOString().split('T')[0]; // UTC date string
// …
daysLate: Math.floor(
  (new Date(today) - new Date(row.scheduled_date)) / (1000 * 60 * 60 * 24)
)
```

`new Date('YYYY-MM-DD')` is parsed as UTC midnight. `new Date(today)` where `today` is a UTC date string is also UTC midnight. The subtraction should be consistent — but if `row.scheduled_date` comes from the DB as a timestamp with timezone, the Date objects may not align, producing a 1-day error in the "days late" metric.

---

### IMPORTANT

**AB-I1 — Admin gate error message hardcoded in Turkish**
`src/features/actionBoard/ActionBoardPage.jsx` ~line 158

```jsx
<p>Bu sayfa yalnızca yöneticiler tarafından görüntülenebilir.</p>
```

Hardcoded string violates the project i18n rules and will not translate if language support is expanded.

---

## 16 · profile

### CRITICAL

**PF-C1 — Password change accepts no old-password verification**
*(Cross-listed from auth module)*
`src/features/auth/api.js` ~line 59
`updatePassword(newPassword)` calls `supabase.auth.updateUser({ password: newPassword })` without requiring the current password. A session left open on a shared machine allows any person to change the account password and lock out the owner.

---

### IMPORTANT

**PF-I1 — Breadcrumb config missing for `/action-board` and `/sim-cards/invoice-analysis`**
`src/lib/breadcrumbConfig.js`
These two routes exist in `App.jsx` and `navItems.js` but have no entry in the breadcrumb config. Users on those pages see an empty or incorrect breadcrumb trail.

**PF-I2 — Admin nav items flash on every page load**
`src/app/AppLayout.jsx` ~lines 23–37
`isAdmin` defaults to `false` while `useCurrentProfile()` is loading. Admin-only navigation items (Action Board, etc.) are hidden, then appear once the profile resolves — a visible flash on every navigation for admin users.

---

## 17 · customerSites

No additional standalone bugs beyond what was documented in **02 · customers** (CU-C2 covers site cache invalidation).

---

*End of audit — 62 bugs total (28 CRITICAL, 34 IMPORTANT)*
