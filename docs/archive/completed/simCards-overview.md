# SIM Cards Module

## Overview
The SIM Cards module manages the inventory of data cards used in security devices (GPRS communicators, cameras, etc.). It tracks card details (IMSI, ICCID), operator assignments, current status, and financial performance per card. A key feature is the bulk import capability to migrate large lists of cards from Excel.

## Routes
- `/sim-cards` - Inventory list with financial stats and filtering
- `/sim-cards/new` - Manual registration of a single SIM card
- `/sim-cards/:id/edit` - Edit card details or update assignment
- `/sim-cards/import` - Bulk import tool for Excel files

## Pages

### SimCardsListPage (`/sim-cards`)
**Purpose:** Central hub for SIM card inventory and high-level financial monitoring.

**Features:**
- Financial KPI dashboard (Total Revenue, Cost, Profit, Card counts)
- Search by Phone Number, IMSI, or Account Number
- Status filtering (Available, Active, Inactive, Sold)
- Excel export of the filtered inventory
- Quick actions for manual entry or bulk import

**Key Components:**
- `SimCardStats` - Displays total revenue, cost, and card distribution metrics
- `Table` - Custom row rendering with status badges and operator labels
- `Badge` - Color-coded indicators for card status (e.g., Success for Active, Info for Available)

**API Calls:**
- `useSimCards()` - Fetches the complete SIM inventory
- `useSimFinancialStats()` - Fetches aggregated revenue and cost data from views
- `useDeleteSimCard()` - Mutation to remove a card from inventory

**User Flow:**
1. Review inventory health via top stats
2. Search for a specific card by phone number or IMSI
3. Filter for "Available" cards to assign to a new installation
4. Export the current list for external reporting

**File:** `src/features/simCards/SimCardsListPage.jsx`

***

### SimCardFormPage (`/sim-cards/new` or `/sim-cards/:id/edit`)
**Purpose:** Detailed management of individual SIM card records and their assignments.

**Features:**
- Full technical detail tracking (IMSI, ICCID, Capacity)
- Operator selection (Turkcell, Vodafone, Turk Telekom)
- Assignment to Customers and specific Sites
- Financial tracking (Cost vs. Sale price)
- Pre-filling customer ID via URL params for seamless workflow from Customer module

**Key Components:**
- `Select` - For Operator and Status choices
- `Controller` (RHF) - For Customer and Site selection logic
- `Textarea` - For internal notes

**API Calls:**
- `useCreateSimCard()` - Mutation to save a new card
- `useUpdateSimCard()` - Mutation to update card details or assignment
- `useCustomers()` - Fetches customer list for assignment
- `useSitesByCustomer(id)` - Fetches sites for the selected customer

**User Flow:**
1. Enter technical card details (Phone, IMSI, ICCID)
2. Select the network operator
3. Assign to a customer/site if already deployed
4. Set cost and sale prices for financial tracking

**File:** `src/features/simCards/SimCardFormPage.jsx`

***

### SimCardImportPage (`/sim-cards/import`)
**Purpose:** Rapid bulk data entry tool for migrating SIM card lists from Excel.

**Features:**
- Drag-and-drop Excel file upload (.xlsx, .xls)
- Intelligent header mapping (Turkish character and case-insensitive)
- Real-time validation (identifies missing phone numbers or invalid formats)
- Preview table showing the first 10 valid rows
- Error log for rows that failed validation

**Key Components:**
- `XLSX` (Library) - Handles browser-side Excel parsing
- `Spinner` - Full-screen overlay during file processing
- `Badge` - Shows operator mapping results in preview

**API Calls:**
- `useBulkCreateSimCards()` - Mutation to batch-insert all valid rows

**User Flow:**
1. Upload an Excel file containing SIM data
2. Review the validation summary (Valid vs. Error counts)
3. Inspect errors and fix the source file if necessary
4. Click "Start Import" to batch-process all valid records

**File:** `src/features/simCards/SimCardImportPage.jsx`

***

## Components

### SimCardStats
**Purpose:** Visual dashboard showing card counts and financial totals.
**Used in:** `SimCardsListPage`
**File:** `src/features/simCards/components/SimCardStats.jsx`

***

## API & Data

**API File:** `src/features/simCards/api.js`

**Key Functions:**
- `fetchSimCards()` - Fetches all cards with customer/site joins
- `bulkCreateSimCards(array)` - Batch insert for import feature
- `fetchSimFinancialStats()` - Joins `view_sim_card_stats` and `view_sim_card_financials`
- `fetchSimCardHistory(id)` - Fetches audit log for a specific card

**React Query Hooks:**
- `useSimCards()` - Main inventory hook
- `useSimFinancialStats()` - Aggregated data hook
- `useBulkCreateSimCards()` - Import mutation hook

**Database Tables:**
- `sim_cards` - Core inventory data
- `sim_card_history` - Audit trail for status and assignment changes
- `view_sim_card_stats` - Postgres view for card counts by status
- `view_sim_card_financials` - Postgres view for revenue/cost calculations

***

## Business Rules
1. **Unique Identifiers:** Phone Number is the primary identifier for cards in the UI, but IMSI and ICCID are tracked for technical accuracy.
2. **Status Workflow:** Cards typically start as `available`, move to `active` when assigned, and can be marked `inactive` or `sold`.
3. **Financial Tracking:** Cost and Sale prices are tracked per card to calculate Monthly Recurring Revenue (MRR) and profit margins.
4. **Import Mapping:** The import tool automatically maps common Turkish headers (e.g., "HAT NO" -> `phone_number`).

***

## Technical Notes
- **Excel Parsing:** All Excel processing is done client-side using the `xlsx` library to reduce server load.
- **Financial Views:** Aggregated stats rely on Postgres views for consistent calculation logic across the app.
- **History Tracking:** Status and assignment changes are tracked in a separate history table for auditing.
