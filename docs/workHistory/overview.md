# Work History Module

## Overview
The Work History module provides a specialized, high-performance search interface for auditing past field activities. Unlike the standard Work Orders list, this module is optimized for deep historical lookups across thousands of records, allowing users to trace service history by Account Number, Company Name, or specific technician assignments over custom date ranges.

## Routes
- `/work-history` - Advanced search and audit interface for historical jobs

## Pages

### WorkHistoryPage (`/work-history`)
**Purpose:** Comprehensive audit tool for finding specific past jobs or analyzing service trends for a client.

**Features:**
- Dual-mode primary search: Toggle between "Account Number" and "Company Name"
- Multi-dimensional filtering: Date range, Work Type, and Assigned Technician
- Deep linking: Supports `siteId` from URL params to show history for a specific location automatically
- Performance-optimized: Uses a specialized database RPC for rapid searching
- Visual result set with technician avatars and status badges

**Key Components:**
- `Card` - Contains the advanced search form with segmented controls for search type
- `Table` - Displays audit-friendly columns (Customer, Account No, Type, Date, Workers)
- `Select` - For filtering by technician or job type
- `Input[type="date"]` - For defining strict audit windows

**API Calls:**
- `useSearchWorkHistory(filters)` - Main search hook, only active when criteria are provided
- `useProfiles()` - Fetches staff list for the "Worker" filter
- `api.searchWorkHistory()` - Calls the `search_work_history` RPC

**User Flow:**
1. Select search mode (e.g., "By Account No")
2. Enter the target identifier (e.g., "12345")
3. Optionally narrow down by date range (e.g., "Last 6 months")
4. Review the results table and click a row to view the full original Work Order

**File:** `src/features/workHistory/WorkHistoryPage.jsx`

***

## API & Data

**API File:** `src/features/workHistory/api.js`

**Key Functions:**
- `searchWorkHistory(filters)` - Executes the `search_work_history` RPC and applies secondary client-side filters for date and worker ID.

**React Query Hooks:**
- `useSearchWorkHistory()` - Auditing hook with conditional execution (enabled only when filters are present).

**Database Tables:**
- `work_orders` - The primary source of data
- `profiles` - Used for technician name resolution

***

## Business Rules
1. **Conditional Fetching:** To prevent accidental full-table scans, the search only executes if at least one filter (search string, date, or site) is provided.
2. **Search Logic:** "Account Number" search is exact/partial match on the site's unique ID, while "Company Name" uses case-insensitive pattern matching.
3. **Data Integrity:** Results are read-only in this view; any edits must be performed by navigating to the original Work Order detail.

***

## Technical Notes
- **RPC Optimization:** Uses a custom Postgres function `search_work_history` to handle complex joins and text searching on the server side.
- **Client-side Refinement:** While the primary search is handled by RPC, secondary filters (like specific worker ID or exact date sub-ranges) are applied on the client to reduce RPC complexity.
- **Integration:** This page is frequently targeted by the "View History" buttons found on `SiteCard` and `CustomerDetailPage`.
