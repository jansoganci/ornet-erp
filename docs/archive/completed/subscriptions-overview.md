# Subscriptions Module

## Overview
The Subscriptions module manages recurring revenue for security services (alarm monitoring, camera maintenance, internet, etc.). it handles the full lifecycle of a subscription including automated payment record generation, price revisions, bulk imports, and status management (active, paused, cancelled).

## Routes
- `/subscriptions` - List of all subscriptions with MRR stats and filtering
- `/subscriptions/:id` - Detailed view of a specific subscription and its payment history
- `/subscriptions/new` - Create a new subscription
- `/subscriptions/:id/edit` - Edit subscription details and pricing
- `/subscriptions/price-revision` - Admin-only tool for bulk updating subscription prices

## Pages

### SubscriptionsListPage (`/subscriptions`)
**Purpose:** Central dashboard for monitoring recurring revenue and managing the subscription portfolio.

**Features:**
- MRR (Monthly Recurring Revenue) and status count statistics
- Advanced filtering by status, type, and search (customer, account no, site)
- Bulk import tool for migrating existing Excel data
- Compliance alerts for missing or invalid data
- Quick access to price revision tool (Admin only)

**Key Components:**
- `StatCard` - Displays MRR, Active, Paused, and Overdue counts
- `SubscriptionStatusBadge` - Color-coded status indicator
- `SubscriptionImportModal` - Handles bulk Excel/CSV data migration
- `ComplianceAlert` - Warns about data integrity issues

**API Calls:**
- `useSubscriptions(filters)` - Fetches filtered subscription list
- `useSubscriptionStats()` - Fetches high-level MRR and count stats
- `useCurrentProfile()` - Checks user role for admin-only features

**User Flow:**
1. View overall MRR and health metrics
2. Filter for specific customer segments or statuses
3. Click a row to manage specific subscription details
4. Use "Add New" to register a new recurring service

**File:** `src/features/subscriptions/SubscriptionsListPage.jsx`

***

### SubscriptionDetailPage (`/subscriptions/:id`)
**Purpose:** 360-degree view of a specific subscription, including site info, pricing, and a 12-month payment grid.

**Features:**
- Visual 12-month payment grid (MonthlyPaymentGrid)
- Status management (Pause, Cancel, Reactivate)
- Detailed pricing breakdown (Base, SMS, Line fees + VAT)
- Payment method tracking
- Internal notes and setup documentation

**Key Components:**
- `MonthlyPaymentGrid` - Interactive grid showing paid/pending months
- `SubscriptionPricingCard` - Detailed breakdown of monthly and total costs
- `PauseSubscriptionModal` / `CancelSubscriptionModal` - Handles status transitions with reasons
- `PaymentRecordModal` - (Nested) used to record a payment for a specific month

**API Calls:**
- `useSubscription(id)` - Fetches subscription and site details
- `useSubscriptionPayments(id)` - Fetches the payment history for the grid
- `useReactivateSubscription()` - Mutation to bring a paused sub back to active

**User Flow:**
1. Review payment history in the 12-month grid
2. Record a payment for a pending month
3. Update subscription status if customer requests a pause or cancellation
4. Navigate to the customer or site detail for broader context

**File:** `src/features/subscriptions/SubscriptionDetailPage.jsx`

***

### SubscriptionFormPage (`/subscriptions/new` or `/subscriptions/:id/edit`)
**Purpose:** Unified form for creating or updating subscription records with live price calculation.

**Features:**
- Integrated `CustomerSiteSelector` for easy assignment
- Live computed pricing (Subtotal, VAT, Total)
- Conditional fields based on subscription type (e.g., Card info for `recurring_card`)
- Assignment tracking (Sold by / Managed by)
- Auto-creation of payment methods for new card subscriptions

**Key Components:**
- `CustomerSiteSelector` - Shared component to pick customer and site
- `Textarea` - For setup and general notes
- `Controller` (RHF) - For checkbox and radio group handling

**API Calls:**
- `useCreateSubscription()` - Mutation to save new record and generate 12 payments
- `useUpdateSubscription()` - Mutation to update details and recalc pending payments
- `useProfiles()` - Fetches staff list for assignment dropdowns

**User Flow:**
1. Select Customer and Site
2. Choose subscription type and service (Alarm, Camera, etc.)
3. Enter pricing components (Base, SMS, Line fees)
4. Verify "Live Total" before saving

**File:** `src/features/subscriptions/SubscriptionFormPage.jsx`

***

### PriceRevisionPage (`/subscriptions/price-revision`)
**Purpose:** Efficient bulk-editing tool for updating prices across many subscriptions at once.

**Features:**
- Filter by service type, billing frequency, or start month (for yearly subs)
- Inline table editing for all price components
- Bulk save functionality via custom RPC
- Unauthorized access protection for non-admin users

**Key Components:**
- `Table` - Custom renderers for inline `Input` fields
- `Select` - For advanced filtering

**API Calls:**
- `useBulkUpdateSubscriptionPrices()` - Calls `bulk_update_subscription_prices` RPC
- `useSubscriptions(filters)` - Fetches the target list for revision

**User Flow:**
1. Filter for a specific group (e.g., "Yearly Alarm" customers)
2. Edit prices directly in the table rows
3. Review changes (highlighted state)
4. Click "Save" to update all records and recalculate future payments

**File:** `src/features/subscriptions/PriceRevisionPage.jsx`

***

## Components

### MonthlyPaymentGrid
**Purpose:** Displays a 12-month interactive grid of payment statuses.
**Used in:** `SubscriptionDetailPage`
**File:** `src/features/subscriptions/components/MonthlyPaymentGrid.jsx`

### SubscriptionPricingCard
**Purpose:** Shows a clean breakdown of monthly fees, taxes, and total amount.
**Used in:** `SubscriptionDetailPage`
**File:** `src/features/subscriptions/components/SubscriptionPricingCard.jsx`

### SubscriptionStatusBadge
**Purpose:** Standardized badge for active, paused, and cancelled states.
**Used in:** `SubscriptionsListPage`, `SubscriptionDetailPage`
**File:** `src/features/subscriptions/components/SubscriptionStatusBadge.jsx`

### SubscriptionImportModal
**Purpose:** Handles file upload and mapping for bulk migration.
**Used in:** `SubscriptionsListPage`
**File:** `src/features/subscriptions/components/SubscriptionImportModal.jsx`

***

## API & Data

**API File:** `src/features/subscriptions/api.js`

**Key Functions:**
- `fetchSubscriptions(filters)` - Fetches from `subscriptions_detail` view
- `createSubscription(data)` - Inserts record and triggers `generate_subscription_payments` RPC
- `updateSubscription(id, data)` - Updates record and recalculates pending payments if price changed
- `pauseSubscription(id, reason)` - Sets status and marks future payments as `skipped`
- `bulkUpdateSubscriptionPrices(updates)` - RPC call for efficient mass updates

**React Query Hooks:**
- `useSubscriptions(filters)` - Main list hook
- `useSubscription(id)` - Detail hook
- `useSubscriptionPayments(id)` - Payment history hook
- `useSubscriptionStats()` - MRR and health stats hook

**Database Tables:**
- `subscriptions` - Core subscription data (pricing, type, status)
- `subscription_payments` - Individual monthly/yearly payment records
- `payment_methods` - Stored card/bank info for customers
- `audit_logs` - Tracks changes to subscriptions (especially price changes)

***

## Business Rules
1. **Payment Generation:** Creating a subscription automatically generates 12 months of `pending` payment records (or 1 for yearly).
2. **Price Recalculation:** When a subscription price is updated, all future `pending` payment records are automatically updated to the new amount.
3. **Status Transitions:** 
   - Pausing a sub marks all future pending payments as `skipped`.
   - Reactivating a sub generates new pending payments starting from the current month.
   - Cancelling allows an optional "Write Off" of all remaining unpaid amounts.
4. **Card Security:** The system only stores the last 4 digits and bank name of cards; actual recurring billing is handled via external providers (Paraşüt/Iyzico integration planned).
5. **Billing Day:** Subscriptions are restricted to billing days 1-28 to avoid February/month-end issues.

***

## Technical Notes
- **Views:** Most read operations use the `subscriptions_detail` view which joins customer, site, and profile data for performance.
- **Audit Logging:** Every price change and status transition is logged in the `audit_logs` table for financial accountability.
- **RPCs:** Heavy logic (generating 12 payments, bulk updates) is handled via Postgres RPCs to ensure atomicity and speed.
- **Dependencies:** Heavily relies on the `customers` and `customerSites` modules for relational integrity.
