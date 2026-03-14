# Frontend Security & Validation Audit

> Generated: 2026-03-14
> Scope: `src/features/*/` (all 18 modules) + `src/components/` + `src/hooks/` + `src/app/`
> Method: Static analysis — grep scans + full schema review
> No code was modified.

---

## Summary

- **Total CRITICAL issues: 3**
- **Total IMPORTANT issues: 47**
- **Modules with no issues:** `actionBoard`, `dashboard`, `workHistory`, `service` (reserved/empty)

---

## Legend

| Tag | Meaning |
|---|---|
| `[SUPABASE]` | Direct Supabase call outside `api.js` |
| `[RAW-ERROR]` | Raw Supabase/JS error exposed to user |
| `[CONSOLE]` | Sensitive data in console output |
| `[VALIDATION]` | Missing or incomplete form validation |

---

## auth

### CRITICAL

- [ ] `[SUPABASE]` Direct `supabase.auth.onAuthStateChange()` + `supabase.auth.getSession()` called inside a page component, bypassing the `api.js` layer — `src/features/auth/UpdatePasswordPage.jsx:49,62`
- [ ] `[SUPABASE]` Direct `supabase.auth.getSession()` + `supabase.auth.onAuthStateChange()` called inside a page component — `src/features/auth/VerifyEmailPage.jsx:32,48,69`

### IMPORTANT

- [ ] `[VALIDATION]` `loginSchema` — `email` field uses `z.string().email()` (correct), but `password` has only `z.string().min(1)` — no minimum length enforced at login, allowing single-character passwords to pass client-side validation — `src/features/auth/schema.js`
- [ ] `[VALIDATION]` `updatePasswordSchema` — `newPassword` has `z.string().min(8)` but no complexity rules (no uppercase, digit, or special character requirement) — `src/features/auth/schema.js`

---

## calendar

### IMPORTANT

- [ ] `[SUPABASE]` Direct `supabase.channel('calendar-realtime')` and `supabase.removeChannel()` called inside a React Query hook, bypassing `api.js` — `src/features/calendar/hooks.js:87,114`

---

## customers

### IMPORTANT

- [ ] `[VALIDATION]` `customerSchema.phone` — `z.string().optional().or(z.literal(''))` — accepts any string including non-numeric; no phone format or length validation — `src/features/customers/schema.js`
- [ ] `[VALIDATION]` `customerSchema.phone_secondary` — same issue as `phone` — `src/features/customers/schema.js`
- [ ] `[VALIDATION]` `customerSchema.tax_number` — Turkish Vergi Kimlik Numarası must be exactly 10 digits; schema accepts any string or empty — `src/features/customers/schema.js`
- [ ] `[VALIDATION]` `customerSchema.company_name` — `z.string().min(1)` with no `max()` — unlimited length string reaches the DB — `src/features/customers/schema.js`

---

## customerSites

### IMPORTANT

- [ ] `[VALIDATION]` `siteSchema.contact_phone` — `z.string().optional().or(z.literal(''))` — accepts any string; no phone format validation — `src/features/customerSites/schema.js`
- [ ] `[VALIDATION]` `siteSchema.account_no` — monitoring account number accepts any string with no format or length constraint — `src/features/customerSites/schema.js`
- [ ] `[VALIDATION]` `siteSchema.site_name`, `city`, `district`, `contact_name`, `panel_info`, `notes` — all use `z.string().optional().or(z.literal(''))` with no `max()` — unlimited length strings — `src/features/customerSites/schema.js`

---

## dashboard

_No issues found._

---

## finance

### IMPORTANT

- [ ] `[VALIDATION]` `transactionSchema.transaction_date` — `z.string().min(1)` — does not enforce ISO date format; a date like `"not-a-date"` passes validation and reaches the DB — `src/features/finance/schema.js`
- [ ] `[VALIDATION]` `transactionSchema.exchange_rate` — `z.number().positive().optional()` — no upper bound; accepts arbitrarily large exchange rates — `src/features/finance/schema.js`
- [ ] `[VALIDATION]` `rateSchema.currency` — `z.string().default('USD')` — not constrained to a known currency enum; any string is accepted — `src/features/finance/schema.js`
- [ ] `[VALIDATION]` `rateSchema.rate_date` — `z.string().min(1)` — no ISO date format validation — `src/features/finance/schema.js`

---

## materials

### IMPORTANT

- [ ] `[VALIDATION]` `materialSchema.unit` — `z.string().default('adet')` — not constrained to predefined unit values; accepts any arbitrary string — `src/features/materials/schema.js`
- [ ] `[VALIDATION]` `materialSchema.code` — `z.string().min(1)` with no `max()` — no upper length bound on material codes — `src/features/materials/schema.js`

---

## notifications

### IMPORTANT

- [ ] `[SUPABASE]` Direct `supabase.channel('notifications-realtime')` and `supabase.removeChannel()` called inside a React Query hook, bypassing `api.js` — `src/features/notifications/hooks.js` ~line 163
- [ ] `[VALIDATION]` `reminderSchema.remind_date` — `z.string().min(1)` — no ISO date format validation; any non-empty string passes — `src/features/notifications/schema.js`
- [ ] `[VALIDATION]` `reminderSchema.remind_time` — `z.string().optional()` — no `HH:mm` format validation; malformed time strings reach the DB — `src/features/notifications/schema.js`

---

## profile

### IMPORTANT

- [ ] `[VALIDATION]` `profileSchema.phone` — `z.string().optional()` — completely unvalidated; accepts any string including non-numeric — `src/features/profile/schema.js`
- [ ] `[VALIDATION]` `profileSchema.full_name` — `z.string().min(1)` with no `max()` — unlimited length — `src/features/profile/schema.js`
- [ ] `[VALIDATION]` `changePasswordSchema.newPassword` — `z.string().min(8)` — no complexity rules; weak passwords accepted — `src/features/profile/schema.js`

---

## proposals

### IMPORTANT

- [ ] `[RAW-ERROR]` `toast.error(err?.message || t('common:error.title'))` — if `err.message` is truthy, raw Supabase error text (may contain table/column names) is shown directly to the user — `src/features/proposals/ProposalFormPage.jsx:133`
- [ ] `[VALIDATION]` `proposalSchema.currency` — `z.string().default('USD')` — not validated against a currency enum; any string accepted — `src/features/proposals/schema.js`
- [ ] `[VALIDATION]` `proposalSchema.proposal_date`, `survey_date`, `installation_date`, `completion_date` — all use `optionalStr()` (`z.string().optional().or(z.literal(''))`) — no ISO date format validation — `src/features/proposals/schema.js`
- [ ] `[VALIDATION]` `proposalSchema.site_id` — `z.string().min(1)` — UUID foreign key not validated with `.uuid()` — `src/features/proposals/schema.js`
- [ ] `[VALIDATION]` `proposalItemSchema.unit` — `z.string().default('adet')` — not constrained to allowed unit values — `src/features/proposals/schema.js`

---

## simCards

### IMPORTANT

- [ ] `[RAW-ERROR]` `toast.error(err?.message || 'Import failed')` — raw Supabase error message shown to user; fallback uses hardcoded English string, not i18n — `src/features/simCards/SimCardImportPage.jsx:238`
- [ ] `[CONSOLE]` `console.error('[handleImport] caught error:', err)` — logs the full Supabase error object to browser console (may include query hints, constraint names, or internal details) — `src/features/simCards/SimCardImportPage.jsx:237`
- [ ] `[VALIDATION]` `simCardSchema.phone_number` — `z.string().min(1)` — no format validation for Turkish or international phone numbers — `src/features/simCards/schema.js`
- [ ] `[VALIDATION]` `simCardSchema.imsi` — `z.string().optional().or(z.literal(''))` — IMSI numbers must be exactly 15 digits; no regex or length enforcement — `src/features/simCards/schema.js`
- [ ] `[VALIDATION]` `simCardSchema.currency` — `z.string().default('TRY')` — not constrained to currency enum — `src/features/simCards/schema.js`
- [ ] `[VALIDATION]` `simCardSchema.capacity` — `z.string().optional().or(z.literal(''))` — accepts any string; should be constrained to known capacity values — `src/features/simCards/schema.js`

---

## siteAssets

### IMPORTANT

- [ ] `[CONSOLE]` `console.error('Bulk registration failed:', error)` — logs the full Supabase error object to browser console, potentially exposing DB constraint names and table details — `src/features/siteAssets/components/BulkAssetRegisterModal.jsx:127`
- [ ] `[VALIDATION]` `assetSchema.installed_at`, `warranty_expires_at` — both use `optionalString` (`z.string().optional()`) — no ISO date format validation; invalid date strings stored in DB — `src/features/siteAssets/schema.js`
- [ ] `[VALIDATION]` `assetSchema.serial_number` — `z.string().optional()` — no format or length constraint on a field that identifies physical hardware — `src/features/siteAssets/schema.js`

---

## subscriptions

### CRITICAL

- [ ] `[SUPABASE]` `useCurrentProfile()` query function makes direct `supabase.auth.getUser()` and `supabase.from('profiles').select(...)` DB calls inside `hooks.js`, completely bypassing the `api.js` data layer — `src/features/subscriptions/hooks.js:67–75`

### IMPORTANT

- [ ] `[SUPABASE]` `supabase` is imported in a page component but no direct `.from()`, `.rpc()`, or `.auth.` calls are detected; this is a dead/unused import that indicates the file previously made direct DB calls — `src/features/subscriptions/SubscriptionFormPage.jsx:8`
- [ ] `[RAW-ERROR]` `toast.error(err?.message || t('common:errors.saveFailed'))` — if `err.message` exists, raw Supabase error text is shown to the user — `src/features/subscriptions/SubscriptionFormPage.jsx:243`
- [ ] `[RAW-ERROR]` `toast.error(err?.message || t('common:errors.saveFailed'))` — same issue, second catch block — `src/features/subscriptions/SubscriptionFormPage.jsx:252`
- [ ] `[RAW-ERROR]` `toast.error(err?.message || t('staticIp.success.assigned'))` — raw error shown if present; the fallback is a **success** string, which would display incorrect feedback on error — `src/features/subscriptions/components/StaticIpModal.jsx:39`
- [ ] `[RAW-ERROR]` `toast.error(err?.message)` — **no fallback** — if `err.message` is undefined, the toast renders the string `"undefined"` to the user — `src/features/subscriptions/components/StaticIpCard.jsx:37`
- [ ] `[VALIDATION]` `subscriptionSchema.start_date` — `z.string().min(1)` — no ISO date format validation — `src/features/subscriptions/schema.js`
- [ ] `[VALIDATION]` `subscriptionSchema.currency` — `z.string().default('TRY')` — not constrained to a currency enum — `src/features/subscriptions/schema.js`
- [ ] `[VALIDATION]` `subscriptionSchema.site_id` — `z.string().min(1)` — UUID foreign key not validated with `.uuid()` — `src/features/subscriptions/schema.js`
- [ ] `[VALIDATION]` `paymentMethodSchema.iban` — `z.string().optional().or(z.literal(''))` — no IBAN format validation; this is a financial field that should be format-checked (TR + 24 digits) — `src/features/subscriptions/schema.js`

---

## tasks

### IMPORTANT

- [ ] `[VALIDATION]` `taskSchema.assigned_to` — `z.string().optional().or(z.literal(''))` — UUID foreign key not validated with `.uuid()`; accepts any string — `src/features/tasks/schema.js`
- [ ] `[VALIDATION]` `taskSchema.work_order_id` — `z.string().optional().or(z.literal(''))` — UUID foreign key not validated with `.uuid()` — `src/features/tasks/schema.js`
- [ ] `[VALIDATION]` `taskSchema.due_date` — `z.string().optional().or(z.literal(''))` — no ISO date format validation — `src/features/tasks/schema.js`
- [ ] `[VALIDATION]` `taskSchema.due_time` — `z.string().optional().or(z.literal(''))` — no `HH:mm` time format validation — `src/features/tasks/schema.js`

---

## workHistory

_No issues found._

---

## workOrders

### IMPORTANT

- [ ] `[VALIDATION]` `workOrderSchema.site_id` — `z.string().min(1)` — UUID foreign key not validated with `.uuid()` — `src/features/workOrders/schema.js`
- [ ] `[VALIDATION]` `workOrderSchema.scheduled_date` — `z.string().optional().or(z.literal(''))` — no ISO date format validation — `src/features/workOrders/schema.js`
- [ ] `[VALIDATION]` `workOrderSchema.scheduled_time` — `z.string().optional().or(z.literal(''))` — no `HH:mm` time format validation — `src/features/workOrders/schema.js`
- [ ] `[VALIDATION]` `workOrderSchema.currency` — `z.string().default('TRY')` — not constrained to a currency enum — `src/features/workOrders/schema.js`
- [ ] `[VALIDATION]` `workOrderSchema.amount` — `z.number().optional()` — no upper bound; accepts arbitrarily large values — `src/features/workOrders/schema.js`
- [ ] `[VALIDATION]` `workOrderItemSchema.unit` — `z.string().default('adet')` — not constrained to the predefined `UNIT_OPTIONS` constant — `src/features/workOrders/schema.js`

---

## actionBoard

_No issues found._

---

## service

_Reserved / empty module. No issues._

---

## src/components/

### IMPORTANT

- [ ] `[CONSOLE]` `console.error('ErrorBoundary caught an error:', error, errorInfo)` — logs full React error object and component tree info to browser console; in production, this may expose internal component paths and prop data — `src/components/ErrorBoundary.jsx:18`

---

## src/hooks/

### IMPORTANT

- [ ] `[SUPABASE]` `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()` called directly in the global auth hook outside any `api.js` file — `src/hooks/useAuth.js:38,55`
  > Note: This is the core auth state manager and may be intentional, but it still violates the project's architectural pattern of isolating all Supabase calls in `api.js`.

---

## Notes

### Systemic Issues

1. **`z.string().optional().or(z.literal(''))` overuse** — This pattern appears in nearly every schema as a workaround for HTML form `<select>` and `<input>` returning empty strings. It prevents meaningful validation because any string (including invalid formats) passes. The consequence is that malformed dates, non-UUID IDs, invalid phone numbers, and empty-string-where-null-is-expected values silently reach the database. A dedicated `optionalStr()` Zod helper is used throughout — it should be replaced with field-specific validations.

2. **`currency` field not enum-validated** — Six schemas accept `currency` as `z.string().default('TRY')` or `.default('USD')`. If an unexpected currency string is stored, PDF generation, financial calculations, and display formatting will silently produce wrong results. All currency fields should use `z.enum(['TRY', 'USD', 'EUR'])`.

3. **UUID foreign keys as plain strings** — Fields like `site_id`, `work_order_id`, `assigned_to`, and `payment_method_id` are validated only as `z.string().min(1)`. Using `.uuid()` would catch a broad class of accidental or injected non-UUID values before they reach the DB.

4. **Raw `err?.message` in toast calls** — Six locations pass `err?.message` directly to `toast.error()`. Supabase error messages frequently contain internal details: table names (`"violates foreign key constraint on table "subscriptions""`, `"duplicate key value violates unique constraint "customers_tax_number_key""`). These strings should never be shown to end users. All catch blocks should use a translated generic error key and log the raw error to a proper error tracking service (Sentry is already installed).

5. **Direct Supabase in page components (`auth` module)** — `UpdatePasswordPage` and `VerifyEmailPage` both manage `supabase.auth` subscriptions directly in component lifecycle hooks. If auth logic changes, these two components require independent updates rather than one central `api.js` change.

6. **Realtime subscriptions in hooks files** — `calendar/hooks.js` and `notifications/hooks.js` set up Supabase Realtime channels with `supabase.channel()`. This is not a DB query, but it still couples the hooks layer directly to the Supabase client. Moving channel setup to dedicated `api.js` functions would maintain the architectural boundary.
