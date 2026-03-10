# Ornet ERP - Technical Audit & Debug Roadmap (March 2026)

## Status Summary

Current health: **5 Critical**, **3 Performance**, **7 Best Practice** issues identified. The codebase follows solid architectural patterns (api.js, hooks.js, schema.js separation) and consistent UI state handling (Loading, Error, Empty). Priority should be given to fixing critical error-handling gaps and the CustomerDetailPage subscription fetch bottleneck.

---

## 🔴 Critical Issues

| # | Checkbox | Title | File | Why it matters / Fix suggestion |
|---|----------|-------|------|--------------------------------|
| 1 | [x] | Dashboard API swallows real errors | `src/features/dashboard/api.js` | 401/404/400 errors return mock data instead of throwing. Users may see fake data while the real API fails. Use mock only when Supabase is not configured; otherwise throw and handle in UI. |
| 2 | [x] | SimCards hooks bypass centralized error handling | `src/features/simCards/hooks.js` | Uses `toast.error(error.message)` instead of `getErrorMessage()`. Supabase errors won't be localized or logged to Sentry. Replace with `getErrorMessage(error, 'common.createFailed')` etc. |
| 3 | [x] | CustomerDetailPage fetches all subscriptions | `src/features/customers/CustomerDetailPage.jsx` | `useSubscriptions({})` loads all subscriptions then filters client-side by siteIds. Performance bottleneck as subscription count grows. Add `useSubscriptionsBySite` per site or a server-side filter by customer/sites. |
| 4 | [x] | Finance hooks: invalid i18n fallback key | `src/features/finance/hooks.js` | Uses `'common.error'` which doesn't exist in errors.json. Should be `'common.unexpected'` for proper fallback message. |
| 5 | [x] | Subscriptions schema: hardcoded Turkish in Zod | `src/features/subscriptions/schema.js` | `paymentRecordSchema` refine message uses `'Kart ödemeleri faturalanmalıdır'` directly. Move to i18n key (e.g. `subscriptions:validation.cardPaymentsMustBeInvoiced`). |

---

## 🟡 Performance Improvements

| # | Checkbox | Title | File | Why it matters / Fix suggestion |
|---|----------|-------|------|--------------------------------|
| 1 | [x] | CustomerDetailPage: memoize derived stats | `src/features/customers/CustomerDetailPage.jsx` | `siteIds`, `customerSubscriptions`, `subscriptionsBySite`, `counts`, `monthlyRevenue` are recomputed every render. Wrap in `useMemo` with correct dependencies to avoid unnecessary work. |
| 2 | [x] | TanStack Query: increase staleTime for exchange rates | `src/features/finance/hooks.js` (or providers) | TCMB rates change once per day. Set `staleTime: 1000 * 60 * 60` (1 hour) on `useExchangeRates` / fetch mutation to reduce over-fetching. |
| 3 | [x] | Subscriptions import: use centralized error handling | `src/features/subscriptions/hooks.js` | `useImportSubscriptions` uses `error?.message || t('import.failed')` instead of `getErrorMessage()`. Align with other mutations for consistency and Sentry logging. |

---

## 🟢 Best Practice & Cleanup

| # | Checkbox | Title | File | Why it matters / Fix suggestion |
|---|----------|-------|------|--------------------------------|
| 1 | [x] | ErrorState: English fallback strings | `src/components/ui/ErrorState.jsx` | Uses `'An error occurred'`, `'Something went wrong...'`, `'Retry'` as fallbacks. Move to i18n keys for consistency with Turkish-first app. |
| 2 | [x] | i18n cleanup: CurrencyWidget | `src/features/dashboard/components/CurrencyWidget.jsx` | Hardcoded `"Amerikan Doları"` and similar. Add to `locales/tr/finance.json`. |
| 3 | [x] | i18n cleanup: ProposalPdf | `src/features/proposals/components/ProposalPdf.jsx` | Month names and header labels hardcoded. Add to `locales/tr/proposals.json`. |
| 4 | [x] | i18n cleanup: Payment forms | `src/features/subscriptions/components/PaymentMethodFormModal.jsx` | Strings like `"Banka Adı"`, `"Örn: Elden Nakit"` hardcoded. Add to `locales/tr/subscriptions.json`. |
| 5 | [x] | Zod schemas: simplify optional/nullable patterns | `src/features/subscriptions/schema.js`, `siteAssets/schema.js` | Redundant `.nullable().optional().or(z.literal(''))` chains. Use `.transform(v => v === '' ? null : v)` or cleaner optional chain for clarity. |
| 6 | [x] | Prop drilling: consider Context for CustomerDetailPage | `src/features/customers/CustomerDetailPage.jsx` | Many props passed to tabs (`navigate`, `onNewWorkOrder`, `customerId`, etc.). If complexity grows, consider React Context or a small state slice for customer-scoped UI. |
| 7 | [x] | i18n cleanup: MonthlyPaymentGrid, SimCardImportPage | `src/features/subscriptions/components/MonthlyPaymentGrid.jsx`, `SimCardImportPage.jsx` | `MONTH_NAMES_TR` and import error messages hardcoded. Move to locale files. |

---

## Progress

**Percentage Completed:** 100% (15/15)

---

*Last updated: March 2026*
