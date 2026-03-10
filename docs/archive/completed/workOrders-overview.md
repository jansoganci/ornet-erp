# Work Orders Module

## Overview
The Work Orders module is the operational core of the system, managing all field activities including surveys, installations, service calls, and maintenance. It tracks the entire lifecycle of a job from scheduling and technician assignment to material usage and completion.

## Routes
- `/work-orders` - Comprehensive list of all work orders with status and type filters
- `/work-orders/:id` - Detailed view of a work order, including site info and materials used
- `/work-orders/new` - Create a new work order (supports pre-filling via URL params)
- `/work-orders/:id/edit` - Edit existing work order details
- `/daily-work` - Technician-focused view for daily schedules and assignments

## Pages

### WorkOrdersListPage (`/work-orders`)
**Purpose:** Central management interface for tracking all field operations and historical jobs.

**Features:**
- Multi-criteria search (Customer, Account No, Form No)
- Status and Work Type filtering
- Quick status indicators with color-coded badges
- Technician assignment visualization (avatar stack)
- Direct navigation to detail or creation forms

**Key Components:**
- `Table` - Responsive data display with custom renderers for status and dates
- `SearchInput` - Debounced search for operational efficiency
- `Badge` - Visual status and priority indicators

**API Calls:**
- `useWorkOrders(filters)` - Fetches the filtered list of jobs
- `api.fetchWorkOrders()` - Backend call to `work_orders_detail` view

**User Flow:**
1. Monitor incoming or pending jobs
2. Filter by "In Progress" to see active field work
3. Click any row to view full details or update status
4. Use "Add New" to schedule a new task

**File:** `src/features/workOrders/WorkOrdersListPage.jsx`

***

### WorkOrderDetailPage (`/work-orders/:id`)
**Purpose:** Comprehensive view of a single job, providing technicians and office staff with all necessary context.

**Features:**
- Site and Customer contact information with quick-call links
- Job description and internal office notes
- Material usage list with quantities and units
- Status transition workflow (Start -> Complete or Cancel)
- Admin-only delete functionality with RLS protection

**Key Components:**
- `PageHeader` - Displays job type, form number, and status workflow buttons
- `Card` - Modular sections for Site Info, Description, and Materials
- `Modal` - Confirmation dialogs for status changes and deletion

**API Calls:**
- `useWorkOrder(id)` - Fetches full job details including material joins
- `useUpdateWorkOrderStatus()` - Mutation for quick lifecycle transitions
- `useDeleteWorkOrder()` - Admin-only job removal

**User Flow:**
1. Technician arrives at site and clicks "Start"
2. Review job description and site notes
3. Perform work and verify materials used
4. Click "Complete" to finalize the job

**File:** `src/features/workOrders/WorkOrderDetailPage.jsx`

***

### WorkOrderFormPage (`/work-orders/new` or `/work-orders/:id/edit`)
**Purpose:** Unified interface for scheduling and documenting jobs.

**Features:**
- `CustomerSiteSelector` for rapid assignment
- Material selector with quantity tracking
- Technician multi-select (up to 3 workers)
- Account Number validation (required for Service/Maintenance)
- Pre-filling from Calendar or Customer pages via URL params

**Key Components:**
- `MaterialSelector` - Dynamic list for adding/removing parts
- `WorkerSelector` - Dropdown for technician assignment
- `AccountNoWarning` - Real-time validation for required site data
- `SiteFormModal` - Quick-add site without leaving the form

**API Calls:**
- `useCreateWorkOrder()` - Saves new job and material links
- `useUpdateWorkOrder()` - Updates details and syncs material list (delete/re-insert pattern)

**User Flow:**
1. Select Customer and Site (or create new site via modal)
2. Choose Work Type and Priority
3. Assign technicians and set scheduled date/time
4. Add materials used and save

**File:** `src/features/workOrders/WorkOrderFormPage.jsx`

***

### DailyWorkListPage (`/daily-work`)
**Purpose:** High-efficiency view for dispatchers and technicians to manage the current day's load.

**Features:**
- Date-based navigation (Prev/Next/Today/Tomorrow)
- Technician-specific filtering
- Optimized "DailyWorkCard" for mobile readability
- Quick reset to current day

**Key Components:**
- `DailyWorkCard` - Compact, information-dense card for mobile field use
- `Input[type="date"]` - Native date picker for rapid scheduling checks

**API Calls:**
- `useDailyWorkList(date, workerId)` - Calls `get_daily_work_list` RPC

**User Flow:**
1. Dispatcher checks "Tomorrow" to balance loads
2. Technician opens page to see their specific assignments for the day
3. Click card to open job details and begin work

**File:** `src/features/workOrders/DailyWorkListPage.jsx`

***

## Components

### CustomerSiteSelector
**Purpose:** Handles the two-step process of picking a customer then a specific site.
**Used in:** `WorkOrderFormPage`, `SubscriptionFormPage`
**File:** `src/features/workOrders/CustomerSiteSelector.jsx`

### MaterialSelector
**Purpose:** Dynamic form section to search and add materials to a job.
**Used in:** `WorkOrderFormPage`
**File:** `src/features/workOrders/MaterialSelector.jsx`

### WorkerSelector
**Purpose:** Multi-select interface for assigning technicians.
**Used in:** `WorkOrderFormPage`
**File:** `src/features/workOrders/WorkerSelector.jsx`

### DailyWorkCard
**Purpose:** Mobile-optimized card showing customer, time, and job type.
**Used in:** `DailyWorkListPage`
**File:** `src/features/workOrders/DailyWorkCard.jsx`

***

## API & Data

**API File:** `src/features/workOrders/api.js`

**Key Functions:**
- `fetchWorkOrders(filters)` - Queries `work_orders_detail` view
- `createWorkOrder(data)` - Inserts job and material associations
- `updateWorkOrder(data)` - Updates job and syncs materials (re-insertion pattern)
- `deleteWorkOrder(id)` - Removes job and materials (requires Admin role)
- `fetchDailyWorkList(date, workerId)` - RPC for optimized daily scheduling

**React Query Hooks:**
- `useWorkOrders()` - Main list hook
- `useWorkOrder(id)` - Detail hook with material joins
- `useDailyWorkList()` - Specialized scheduling hook

**Database Tables:**
- `work_orders` - Core job data (type, status, schedule)
- `work_order_materials` - Junction table for parts used
- `materials` - Catalog of available parts
- `profiles` - Technician/User records

***

## Business Rules
1. **Account Number Requirement:** Service and Maintenance jobs *must* have an Account Number associated with the site before saving.
2. **Technician Limit:** A maximum of 3 technicians can be assigned to a single work order.
3. **Status Workflow:** Jobs typically move from `pending` -> `in_progress` -> `completed`.
4. **Delete Permissions:** Only users with the `admin` role can delete work orders. This is enforced via RLS and checked in the API.
5. **Material Sync:** Updating a work order's materials follows a "delete all then re-insert" pattern to ensure consistency with the form state.

***

## Technical Notes
- **Views:** Uses `work_orders_detail` for most reads to avoid complex client-side joins.
- **URL Pre-filling:** Supports `customerId`, `siteId`, `date`, and `time` params for seamless transitions from other modules.
- **Mobile Optimization:** Uses a dual-view pattern (Table for desktop, Cards for mobile) in the list and daily views.
