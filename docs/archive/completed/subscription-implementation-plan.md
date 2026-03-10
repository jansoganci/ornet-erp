# Subscription System - Implementation Plan

> Step-by-step implementation plan for the Ornet ERP subscription management module.
> Reference: `docs/subscription-system-architecture.md` for full technical details.

---

## Phase 1: Foundation

### Goal
Build the complete subscription CRUD system with manual payment recording. Users can create subscriptions, view them, record payments month-by-month, and manage lifecycle (pause/cancel/reactivate). All data persists in Supabase with RLS and audit logging.

---

### Step 1.1: Database Migration

**Deliverable:** Single SQL migration file `supabase/migrations/00016_subscriptions.sql`

- [ ] Create `payment_methods` table with all columns, constraints, indexes
- [ ] Create `subscriptions` table with all columns, constraints, indexes
- [ ] Create partial unique index `idx_subscriptions_active_site` (one active sub per site)
- [ ] Create `subscription_payments` table with unique constraint on `(subscription_id, payment_month)`
- [ ] Create `audit_logs` table
- [ ] Create `set_subscription_lifecycle_timestamps()` trigger function
- [ ] Attach lifecycle trigger to `subscriptions`
- [ ] Attach `update_updated_at_column()` triggers to all new tables
- [ ] Create `subscriptions_detail` view (joins sites, customers, payment methods, profiles)
- [ ] Create `generate_subscription_payments()` RPC function
- [ ] Create `get_overdue_invoices()` RPC function
- [ ] Create `get_subscription_stats()` RPC function
- [ ] Add RLS policies for all 4 tables (SELECT, INSERT, UPDATE, DELETE)
- [ ] Grant SELECT on view to authenticated
- [ ] Test migration: `npx supabase db reset` or apply to remote

---

### Step 1.2: Translations

**Deliverable:** `src/locales/tr/subscriptions.json`

- [ ] Create `subscriptions.json` translation file with all keys:
  - `nav`, `list` (title, searchPlaceholder, addButton, empty, columns)
  - `detail` (title, sections, fields, actions)
  - `form` (addTitle, editTitle, fields, placeholders, sections, success, validation)
  - `types` (recurring_card, manual_cash, manual_bank, annual, internet_only)
  - `statuses` (active, paused, cancelled)
  - `payment` (title, fields, statuses: pending/paid/failed/skipped/write_off, modal titles)
  - `compliance` (overdueAlert, dayCount)
  - `actions` (pause, cancel, reactivate, recordPayment)
  - `cancel` (title, message, warning, writeOffOption)
  - `pause` (title, message, reasonPlaceholder)
- [ ] Register namespace in `src/lib/i18n.js` (import + add to ns array + resources)
- [ ] Add `nav.subscriptions: "Abonelikler"` to `common.json`

---

### Step 1.3: API Layer

**Deliverable:** `src/features/subscriptions/api.js`, `paymentsApi.js`, `paymentMethodsApi.js`

**api.js (Subscriptions CRUD):**
- [ ] `fetchSubscriptions(filters)` — query `subscriptions_detail` view with search, status, type, managedBy filters
- [ ] `fetchSubscription(id)` — single subscription from `subscriptions_detail` by id
- [ ] `createSubscription(data)` — insert into `subscriptions`, call `generate_subscription_payments` RPC, insert audit log
- [ ] `updateSubscription(id, data)` — update subscription, recalculate pending payment amounts if price fields changed, insert audit log
- [ ] `pauseSubscription(id, reason)` — update status to 'paused', mark future pending payments as 'skipped', insert audit log
- [ ] `cancelSubscription(id, reason, writeOffUnpaid)` — update status to 'cancelled', optionally mark pending as 'write_off', insert audit log
- [ ] `reactivateSubscription(id)` — update status to 'active', regenerate payments from current month, insert audit log

**paymentsApi.js:**
- [ ] `fetchPaymentsBySubscription(subscriptionId)` — query subscription_payments ordered by payment_month ASC
- [ ] `recordPayment(paymentId, data)` — update status to 'paid', set payment_date/method/invoice_no, validate immutability, insert audit log
- [ ] `fetchOverdueInvoices()` — call `get_overdue_invoices()` RPC
- [ ] `fetchSubscriptionStats()` — call `get_subscription_stats()` RPC

**paymentMethodsApi.js:**
- [ ] `fetchPaymentMethods(customerId)` — query active methods for customer
- [ ] `createPaymentMethod(data)` — insert, handle is_default toggle
- [ ] `updatePaymentMethod(id, data)` — update
- [ ] `deletePaymentMethod(id)` — soft delete (is_active = false)

---

### Step 1.4: React Query Hooks

**Deliverable:** `src/features/subscriptions/hooks.js`

- [ ] Define `subscriptionKeys` factory (all, lists, list, details, detail, payments, stats, overdueInvoices)
- [ ] Define `paymentMethodKeys` factory (all, byCustomer)
- [ ] `useSubscriptions(filters)` — list query
- [ ] `useSubscription(id)` — detail query with `enabled: !!id`
- [ ] `useCreateSubscription()` — mutation with cache invalidation + toast
- [ ] `useUpdateSubscription()` — mutation with cache invalidation + toast
- [ ] `usePauseSubscription()` — mutation
- [ ] `useCancelSubscription()` — mutation
- [ ] `useReactivateSubscription()` — mutation
- [ ] `useSubscriptionPayments(subscriptionId)` — payment grid query
- [ ] `useRecordPayment()` — mutation with payment + subscription cache invalidation
- [ ] `useOverdueInvoices()` — query for compliance alert
- [ ] `useSubscriptionStats()` — query for KPI cards
- [ ] `usePaymentMethods(customerId)` — query
- [ ] `useCreatePaymentMethod()` — mutation
- [ ] `useDeletePaymentMethod()` — mutation

---

### Step 1.5: Zod Validation Schemas

**Deliverable:** `src/features/subscriptions/schema.js`

- [ ] `subscriptionSchema` — all form fields with proper types, preprocess for number fields, refine for card type requiring payment_method_id
- [ ] `subscriptionDefaultValues` — matching defaults
- [ ] `paymentRecordSchema` — payment_date (required), payment_method (required), invoice_no (optional), invoice_type (optional), notes (optional)
- [ ] `paymentMethodSchema` — method_type (required), conditional card/bank fields

---

### Step 1.6: SubscriptionsListPage

**Deliverable:** `src/features/subscriptions/SubscriptionsListPage.jsx`

- [ ] PageHeader with title + "Yeni Abonelik" button
- [ ] `ComplianceAlert` banner (conditionally rendered if overdue invoices exist)
- [ ] KPI cards row: MRR, Active count, Paused count, Overdue payment count (from `useSubscriptionStats`)
- [ ] Filter row: Status select, Type select, Search input
- [ ] Data table with columns: Musteri, Lokasyon, Hesap No, Tip, Aylik Toplam, Durum
- [ ] Status badge per row (active=success, paused=warning, cancelled=default)
- [ ] Subscription type badge (recurring_card, manual_cash, etc.)
- [ ] Amount formatted as currency (formatCurrency)
- [ ] Row click navigates to detail page
- [ ] Loading state (Spinner), Error state, Empty state
- [ ] Mobile responsive: card layout on small screens
- [ ] Dark mode support for all elements

---

### Step 1.7: SubscriptionFormPage

**Deliverable:** `src/features/subscriptions/SubscriptionFormPage.jsx`

- [ ] Dual-mode: create (`/subscriptions/new`) and edit (`/subscriptions/:id/edit`)
- [ ] react-hook-form + zodResolver setup
- [ ] **Section 1: Customer & Site Selection**
  - Reuse existing `CustomerSiteSelector` component from workOrders
  - Site selector with account_no display
  - Validation: check no active subscription exists for selected site (on create)
- [ ] **Section 2: Subscription Details**
  - Subscription type select (5 options)
  - Start date picker
  - Billing day select (1-28)
  - Status display (edit mode only, not editable in form)
- [ ] **Section 3: Pricing**
  - Base price input (DECIMAL)
  - SMS fee input
  - Line fee input
  - VAT rate display/select (20% default, 0% for cash/bank per BR-4)
  - Computed subtotal, VAT amount, total (live calculation)
  - Cost input (only visible if user role = admin)
  - Profit display (computed, admin-only)
- [ ] **Section 4: Payment Method**
  - Conditionally shown for `recurring_card` type
  - Select from customer's existing payment methods
  - "Add new payment method" button opens `PaymentMethodFormModal`
- [ ] **Section 5: Assignment**
  - Sold by (profile select, optional)
  - Managed by (profile select, optional)
- [ ] **Section 6: Notes**
  - Setup notes textarea (equipment info)
  - General notes textarea
- [ ] Save button with loading state
- [ ] Edit mode: pre-fill form from `useSubscription(id)`
- [ ] Mobile responsive layout
- [ ] Dark mode support

---

### Step 1.8: SubscriptionDetailPage

**Deliverable:** `src/features/subscriptions/SubscriptionDetailPage.jsx`

- [ ] Breadcrumbs: Abonelikler > Company Name > Site Name
- [ ] Header: subscription type badge + status badge + priority badge + Edit/Delete buttons
- [ ] **Left column (2/3):**
  - Customer & Site info card (company_name, site_name, account_no, address, phone)
  - `MonthlyPaymentGrid` component (12-month visual grid)
- [ ] **Right column (1/3):**
  - Pricing card (base, sms, line, subtotal, vat, total, cost/profit for admin)
  - Payment method card (card last4, brand, holder, expiry OR bank/cash info)
  - Assignment card (sold_by, managed_by names)
  - Notes card (setup_notes, notes)
  - Action buttons: Pause, Cancel (context-dependent based on current status)
  - Reactivate button (when paused)
- [ ] Loading skeleton
- [ ] Error state with retry
- [ ] Mobile responsive: single column stack
- [ ] Dark mode support

---

### Step 1.9: MonthlyPaymentGrid Component

**Deliverable:** `src/features/subscriptions/components/MonthlyPaymentGrid.jsx`

- [ ] 4x3 grid layout (4 columns x 3 rows = 12 months)
- [ ] Each cell shows: month abbreviation (Oca, Sub, Mar...), total amount, status icon
- [ ] Color coding by payment status:
  - `paid` → success green, checkmark icon
  - `pending` → neutral gray, empty circle
  - `failed` → error red, X mark
  - `skipped` → dark neutral, dash
  - `write_off` → warning amber, strikethrough
- [ ] Clicking `pending` or `failed` cell opens `PaymentRecordModal`
- [ ] Clicking `paid` cell shows payment details (date, method, invoice) in a popover or detail view
- [ ] `skipped` and `write_off` cells are non-interactive
- [ ] Summary row below grid: total paid, total pending, total collected amount
- [ ] Responsive: 3x4 on mobile (3 columns x 4 rows)
- [ ] Dark mode colors matching design system

---

### Step 1.10: PaymentRecordModal

**Deliverable:** `src/features/subscriptions/components/PaymentRecordModal.jsx`

- [ ] Modal with form (react-hook-form + zod)
- [ ] Title: "Odeme Kaydet — Ocak 2026"
- [ ] Pre-filled: amount, vat_amount, total_amount (read-only display)
- [ ] Form fields:
  - Payment date (date picker, defaults to today)
  - Payment method select (card / cash / bank_transfer)
  - Invoice number (optional text input)
  - Invoice type select (e_fatura / e_arsiv, optional)
  - Notes (optional textarea)
- [ ] Submit: calls `useRecordPayment()` mutation
- [ ] Success: closes modal, grid refreshes
- [ ] Error handling with toast
- [ ] Immutability check: if payment already paid+invoiced, show read-only view

---

### Step 1.11: Lifecycle Modals

**Deliverables:**
- `src/features/subscriptions/components/PauseSubscriptionModal.jsx`
- `src/features/subscriptions/components/CancelSubscriptionModal.jsx`

**PauseSubscriptionModal:**
- [ ] Reason textarea (required)
- [ ] Info text: "Duraklama surecinde odenmemis aylar 'atlandi' olarak isaretlenecek"
- [ ] Confirm/Cancel buttons
- [ ] Calls `usePauseSubscription()` mutation

**CancelSubscriptionModal:**
- [ ] Reason textarea (required)
- [ ] Display unpaid months count + total amount
- [ ] Checkbox: "Odenmemis aylari zarar yaz" (write off unpaid)
- [ ] Warning text: "Bu islem geri alinamaz"
- [ ] Confirm (danger) / Cancel buttons
- [ ] Calls `useCancelSubscription()` mutation

---

### Step 1.12: Supporting Components

**ComplianceAlert:**
- [ ] `src/features/subscriptions/components/ComplianceAlert.jsx`
- [ ] Red/warning banner: "X odeme 7 gunden fazla suredir faturasiz"
- [ ] Click navigates to overdue list or opens detail
- [ ] Uses `useOverdueInvoices()` query
- [ ] Only shown when count > 0

**SubscriptionStatusBadge:**
- [ ] `src/features/subscriptions/components/SubscriptionStatusBadge.jsx`
- [ ] active → success variant with dot
- [ ] paused → warning variant with dot
- [ ] cancelled → default variant

**SubscriptionPricingCard:**
- [ ] `src/features/subscriptions/components/SubscriptionPricingCard.jsx`
- [ ] Base price, SMS fee, Line fee rows
- [ ] Subtotal, VAT, Total calculation display
- [ ] Cost + Profit rows (conditionally rendered for admin role)

**PaymentMethodCard:**
- [ ] `src/features/subscriptions/components/PaymentMethodCard.jsx`
- [ ] Card display: brand icon, ****last4, holder name, expiry
- [ ] Bank display: bank name, IBAN (masked)
- [ ] Cash display: simple label

**PaymentMethodFormModal:**
- [ ] `src/features/subscriptions/components/PaymentMethodFormModal.jsx`
- [ ] Method type selector (card / bank_transfer / cash)
- [ ] Conditional fields based on type
- [ ] Card: last4, holder, expiry, brand
- [ ] Bank: bank_name, IBAN
- [ ] Calls `useCreatePaymentMethod()` mutation

---

### Step 1.13: Routing & Navigation

- [ ] Import all pages in `src/App.jsx`
- [ ] Add 4 routes inside protected routes section
- [ ] Add nav item to `src/components/layout/navItems.js` with `CreditCard` icon
- [ ] Verify navigation works on all screen sizes

---

### Step 1.14: Integration & Polish

- [ ] Verify all loading states (Spinner for pages, Skeleton for cards)
- [ ] Verify all error states (ErrorState component with retry)
- [ ] Verify all empty states (EmptyState component)
- [ ] Verify dark mode across all components
- [ ] Verify mobile responsiveness (test at 375px, 768px, 1024px)
- [ ] Verify toast notifications for all mutations (success + error)
- [ ] Verify audit logs are created for all state changes
- [ ] Run `npx vite build` — zero errors
- [ ] Manual smoke test: create subscription → record payment → pause → reactivate → cancel

---

### Phase 1 Deliverables Summary

| # | File | Type |
|---|------|------|
| 1 | `supabase/migrations/00016_subscriptions.sql` | Migration |
| 2 | `src/locales/tr/subscriptions.json` | Translations |
| 3 | `src/features/subscriptions/api.js` | API |
| 4 | `src/features/subscriptions/paymentsApi.js` | API |
| 5 | `src/features/subscriptions/paymentMethodsApi.js` | API |
| 6 | `src/features/subscriptions/hooks.js` | Hooks |
| 7 | `src/features/subscriptions/schema.js` | Validation |
| 8 | `src/features/subscriptions/SubscriptionsListPage.jsx` | Page |
| 9 | `src/features/subscriptions/SubscriptionFormPage.jsx` | Page |
| 10 | `src/features/subscriptions/SubscriptionDetailPage.jsx` | Page |
| 11 | `src/features/subscriptions/components/MonthlyPaymentGrid.jsx` | Component |
| 12 | `src/features/subscriptions/components/PaymentRecordModal.jsx` | Component |
| 13 | `src/features/subscriptions/components/PauseSubscriptionModal.jsx` | Component |
| 14 | `src/features/subscriptions/components/CancelSubscriptionModal.jsx` | Component |
| 15 | `src/features/subscriptions/components/ComplianceAlert.jsx` | Component |
| 16 | `src/features/subscriptions/components/SubscriptionStatusBadge.jsx` | Component |
| 17 | `src/features/subscriptions/components/SubscriptionPricingCard.jsx` | Component |
| 18 | `src/features/subscriptions/components/PaymentMethodCard.jsx` | Component |
| 19 | `src/features/subscriptions/components/PaymentMethodFormModal.jsx` | Component |
| 20 | `src/features/subscriptions/index.js` | Barrel export |
| 21 | Updated `src/lib/i18n.js` | Registration |
| 22 | Updated `src/App.jsx` | Routes |
| 23 | Updated `src/components/layout/navItems.js` | Navigation |
| 24 | Updated `src/locales/tr/common.json` | Nav label |

---

## Phase 2: Automation

### Goal
Automate recurring card charges via Iyzico, auto-generate invoices via Parasut API, and implement dunning (failed payment retry logic) with customer notifications. Eliminate manual work for card-based subscriptions.

---

### Step 2.1: Iyzico Payment Integration

- [ ] Register Iyzico merchant account and get API keys
- [ ] Store keys in Supabase Vault / environment variables
- [ ] Create `src/lib/iyzico.js` — API client wrapper
- [ ] Implement card tokenization flow:
  - [ ] Create Iyzico checkout form (hosted or API)
  - [ ] On success, store `cardToken` + `cardUserKey` in `payment_methods.iyzico_token`
  - [ ] Encrypt token at rest (Supabase Vault)
- [ ] Update `PaymentMethodFormModal` to support Iyzico tokenization
- [ ] Implement `chargeSubscription(subscriptionId)` function:
  - [ ] Read subscription + payment method + iyzico_token
  - [ ] Call Iyzico `payment/auth` endpoint
  - [ ] On success → mark payment as `paid`
  - [ ] On failure → mark payment as `failed`, set retry schedule

---

### Step 2.2: Monthly Auto-Charge Cron

- [ ] Create Supabase Edge Function: `functions/charge-subscriptions/index.ts`
- [ ] Logic:
  - [ ] Query active `recurring_card` subscriptions where `billing_day = today`
  - [ ] For each, find current month's `pending` payment
  - [ ] Call Iyzico charge API
  - [ ] Update payment status (paid/failed)
  - [ ] Insert audit log
- [ ] Schedule via Supabase pg_cron or external scheduler (daily at 08:00 UTC)
- [ ] Add monitoring: log success/failure counts
- [ ] Error handling: continue processing other subscriptions if one fails

---

### Step 2.3: Dunning (Failed Payment Retry)

- [ ] Create Supabase Edge Function: `functions/retry-failed-payments/index.ts`
- [ ] Retry schedule: day 1, day 3, day 7 after failure
- [ ] Logic:
  - [ ] Query `failed` payments where `next_retry_at <= now()` and `retry_count < 3`
  - [ ] Attempt charge via Iyzico
  - [ ] On success → `paid`
  - [ ] On failure → increment `retry_count`, set `next_retry_at` to next retry date
  - [ ] On final failure (retry_count = 3) → send notification
- [ ] Schedule: runs daily at 10:00 UTC
- [ ] Auto-pause: if any subscription has `failed` payment older than 30 days, pause with reason "odenmemis"

---

### Step 2.4: Parasut Invoice Integration

- [ ] Register Parasut API access
- [ ] Create `src/lib/parasut.js` — API client wrapper with OAuth2 token management
- [ ] Implement `createInvoice(paymentId)` function:
  - [ ] Read subscription + customer + payment details
  - [ ] Determine invoice type: `e_fatura` (if customer has tax_number) or `e_arsiv`
  - [ ] Call Parasut API to create sales invoice
  - [ ] Store `parasut_invoice_id` and `invoice_no` on payment record
  - [ ] Insert audit log
- [ ] Auto-invoke on payment success (both manual and auto-charge)
- [ ] Add "Create Invoice" button to PaymentRecordModal for manual trigger
- [ ] Handle Parasut API errors gracefully (retry, queue)

---

### Step 2.5: Customer Notifications

- [ ] SMS notification on failed payment (via existing SMS provider or new integration)
- [ ] Email notification on final dunning failure
- [ ] Notification templates (Turkish):
  - [ ] Payment failed: "Sayin {customer}, {month} odemeniz basarisiz oldu. Lutfen kart bilgilerinizi kontrol edin."
  - [ ] Final warning: "Sayin {customer}, 7 gun icinde odeme yapilmadigi takdirde aboneliginiz durdurulacaktir."
  - [ ] Subscription paused: "Sayin {customer}, odenmemis borcunuz nedeniyle aboneliginiz durdurulmustur."

---

### Phase 2 Deliverables

| # | Deliverable |
|---|-------------|
| 1 | `src/lib/iyzico.js` — Iyzico API client |
| 2 | Updated `PaymentMethodFormModal` — card tokenization |
| 3 | `supabase/functions/charge-subscriptions/` — monthly cron |
| 4 | `supabase/functions/retry-failed-payments/` — dunning cron |
| 5 | `src/lib/parasut.js` — Parasut API client |
| 6 | Auto-invoice flow on payment success |
| 7 | SMS/Email notification templates and sending logic |
| 8 | Updated migration for any new columns needed |

---

## Phase 3: Analytics & Advanced

### Goal
Provide business intelligence dashboards, Excel migration tooling, and advanced features for strategic decision-making.

---

### Step 3.1: Dashboard Analytics

- [ ] **MRR Trend Chart** — line chart showing MRR for last 12 months
  - [ ] Create `get_mrr_trend()` function (returns monthly MRR snapshots)
  - [ ] Use chart library (recharts or similar, confirm with user)
  - [ ] Widget on main dashboard or dedicated analytics page
- [ ] **Churn Rate Chart** — monthly churn percentage
  - [ ] Create `get_churn_trend()` function
  - [ ] Bar/line chart
- [ ] **Collection Rate** — paid vs expected payments per month
  - [ ] Create `get_collection_rate()` function
  - [ ] Percentage gauge or bar chart
- [ ] **Subscription Breakdown** — pie chart by type (card/cash/bank/annual)
- [ ] **Overdue Payments List** — table of subscriptions with unpaid months >15 days
- [ ] **Profit Margin by Type** — admin-only chart showing margin per subscription type
- [ ] **Invoice Compliance Report** — list of 7-day violations

---

### Step 3.2: Excel Import Tool

- [ ] Create `src/features/subscriptions/ImportPage.jsx`
- [ ] CSV file upload component
- [ ] Column mapping UI (auto-detect + manual correction)
- [ ] Preview table showing matched/unmatched rows
- [ ] Import button with progress indicator
- [ ] Validation report: duplicates, missing data, format errors
- [ ] Dry-run mode (preview without saving)
- [ ] Create `src/features/subscriptions/importApi.js` — ETL logic:
  - [ ] Parse CSV
  - [ ] Match customers by company_name (fuzzy match)
  - [ ] Match sites by account_no
  - [ ] Create missing customers/sites
  - [ ] Create subscriptions + 12 payment records
  - [ ] Create payment methods from card info
- [ ] Dual-run validation page: compare ERP totals vs uploaded Excel totals

---

### Step 3.3: Equipment & SIM Tracking (Future)

- [ ] Create `equipment` table (device tracking per site)
- [ ] Create `sim_cards` table (2500+ phone numbers)
- [ ] Link to customer_sites
- [ ] Revenue per SIM card tracking
- [ ] Active/inactive status management

---

### Step 3.4: Advanced Features

- [ ] Approval workflow for large manual payments (>10k TRY)
- [ ] Subscription price history table (separate from audit_logs for reporting)
- [ ] Predictive churn model (ML-based, flag at-risk subscriptions)
- [ ] Customer health score (composite metric: payment history + support tickets + age)
- [ ] Bulk subscription operations (mass price update, mass pause)

---

### Phase 3 Deliverables

| # | Deliverable |
|---|-------------|
| 1 | Analytics dashboard page with 6+ chart widgets |
| 2 | Database functions for MRR trend, churn, collection rate |
| 3 | Excel import page with CSV parser and validation |
| 4 | Equipment/SIM card tables and basic CRUD |
| 5 | Advanced features based on business priority |

---

## Implementation Order (Recommended)

```
Phase 1 (Foundation):
  1.1  Database migration           ← START HERE
  1.2  Translations
  1.3  API layer (3 files)
  1.4  React Query hooks
  1.5  Zod schemas
  1.6  SubscriptionsListPage
  1.7  SubscriptionFormPage
  1.8  SubscriptionDetailPage
  1.9  MonthlyPaymentGrid
  1.10 PaymentRecordModal
  1.11 Lifecycle modals
  1.12 Supporting components
  1.13 Routing & navigation
  1.14 Integration & polish

Phase 2 (Automation):
  2.1  Iyzico integration
  2.2  Monthly cron
  2.3  Dunning logic
  2.4  Parasut integration
  2.5  Notifications

Phase 3 (Analytics):
  3.1  Dashboard charts
  3.2  Excel import tool
  3.3  Equipment/SIM tracking
  3.4  Advanced features
```

---

## Notes

- Phase 1 should be implemented sequentially (steps 1.1 through 1.14) as each step depends on the previous
- Within Phase 1, steps 1.3-1.5 (API, hooks, schemas) can be built together before any UI work
- Steps 1.6, 1.7, 1.8 (pages) can be built in any order but ListPage first is recommended
- Phase 2 requires external service accounts (Iyzico, Parasut) — start registration early
- Phase 3 items are independent and can be prioritized based on business need
