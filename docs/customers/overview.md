# Customers Module

## Overview
The Customers module is the primary database for client companies. It manages corporate information, contact details, and serves as the parent for all customer sites, work orders, and subscriptions. It provides a 360-degree view of the customer relationship, including their service history and active inventory.

## Routes
- `/customers` - List of all customer companies with search
- `/customers/:id` - Detailed view of a customer, their sites, work history, and SIM cards
- `/customers/new` - Create a new customer company
- `/customers/:id/edit` - Edit customer company details

## Pages

### CustomersListPage (`/customers`)
**Purpose:** High-level directory of all client companies for rapid lookup and navigation.

**Features:**
- Quick search by Company Name or Phone Number
- Grid-based card view for visual clarity
- Direct access to customer account numbers and primary contact info
- Responsive layout (1 column mobile, 3 columns desktop)

**Key Components:**
- `Card` - Interactive cards showing company summary
- `SearchInput` - Debounced search for large customer lists
- `Badge` - Displays the system-generated account number

**API Calls:**
- `useCustomers({ search })` - Fetches filtered list of companies
- `api.fetchCustomers()` - Queries `customers` table with site counts

**User Flow:**
1. Search for a company by name
2. View summary (Account No, Phone, City)
3. Click card to enter the detailed customer dashboard

**File:** `src/features/customers/CustomersListPage.jsx`

***

### CustomerDetailPage (`/customers/:id`)
**Purpose:** The central hub for all data related to a specific client.

**Features:**
- Site management (List of locations with `SiteCard`)
- Work Order history table
- SIM Card inventory table
- Contact sidebar with quick-call and email actions
- Unified "Add" actions for Sites, Work Orders, and SIM Cards

**Key Components:**
- `SiteCard` - Modular display of a specific location's details
- `SiteFormModal` - Modal for creating/editing locations
- `Table` - Used for Work History and SIM Card lists
- `PageHeader` - Displays company name and total site count

**API Calls:**
- `useCustomer(id)` - Fetches core company data
- `useSitesByCustomer(id)` - Fetches all associated locations
- `useWorkOrdersByCustomer(id)` - Fetches job history
- `useSimCardsByCustomer(id)` - Fetches assigned data cards

**User Flow:**
1. Review customer's sites and active equipment
2. Check work history to see recent service calls
3. Create a new work order for a specific site
4. Update company notes or contact info

**File:** `src/features/customers/CustomerDetailPage.jsx`

***

### CustomerFormPage (`/customers/new` or `/customers/:id/edit`)
**Purpose:** Interface for onboarding new clients or updating corporate records.

**Features:**
- Corporate name and Tax Number tracking
- Primary and secondary phone number masking
- Email validation
- Multi-line notes for general customer context

**Key Components:**
- `Input` - Standardized fields with validation error support
- `Textarea` - For internal customer-level notes
- `maskPhone` (Util) - Ensures consistent phone formatting during entry

**API Calls:**
- `useCreateCustomer()` - Saves new corporate record
- `useUpdateCustomer()` - Updates existing record

**User Flow:**
1. Enter company name and official tax info
2. Input contact phone and email
3. Add any high-level relationship notes
4. Save to generate the unique system ID

**File:** `src/features/customers/CustomerFormPage.jsx`

***

## Components

### SiteCard
**Purpose:** Displays a specific customer location with its address, contact, and panel info.
**Used in:** `CustomerDetailPage`
**File:** `src/features/customerSites/SiteCard.jsx`

### SiteFormModal
**Purpose:** Modal form to manage locations (sites) without leaving the customer dashboard.
**Used in:** `CustomerDetailPage`, `WorkOrderFormPage`
**File:** `src/features/customerSites/SiteFormModal.jsx`

***

## API & Data

**API File:** `src/features/customers/api.js`

**Key Functions:**
- `fetchCustomers(filters)` - Fetches from `customers` table with `customer_sites(count)`
- `fetchCustomer(id)` - Fetches single record with `customer_sites(*)` join
- `createCustomer(data)` - Standard insert
- `updateCustomer(id, data)` - Standard update
- `deleteCustomer(id)` - Removes customer record (Note: RLS and FK constraints apply)

**React Query Hooks:**
- `useCustomers()` - Main list hook
- `useCustomer(id)` - Detail hook
- `useCreateCustomer()` - Mutation hook

**Database Tables:**
- `customers` - Core company data (name, tax_no, phone)
- `customer_sites` - Related table for locations (managed in `customerSites` feature)

***

## Business Rules
1. **Account Numbers:** Every customer is assigned a unique system-level account number for identification.
2. **Site Relationship:** A customer can have multiple sites (locations), but every site must belong to exactly one customer.
3. **Contact Validation:** Company name and primary phone are mandatory for all customer records.
4. **Data Integrity:** Deleting a customer is generally restricted if they have active sites or work orders (enforced by DB constraints).

***

## Technical Notes
- **Modular Sites:** While sites are displayed here, their logic is isolated in the `customerSites` feature folder.
- **Phone Masking:** Uses a custom `maskPhone` utility to standardize Turkish phone formats (e.g., 05xx xxx xx xx).
- **Relational Hub:** This module serves as the primary entry point for pre-filling `customerId` in the Work Order and SIM Card modules.
