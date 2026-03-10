# Materials Module

## Overview
The Materials module serves as the central catalog for all physical equipment and parts used in field operations. It allows the company to maintain a standardized list of items (detectors, sirens, cables, cameras, etc.) with unique codes and units of measurement, ensuring consistency across work orders and inventory tracking.

## Routes
- `/materials` - Main catalog list with filtering and CRUD modals

## Pages

### MaterialsListPage (`/materials`)
**Purpose:** Central interface for managing the parts catalog and inventory definitions.

**Features:**
- Catalog search by Part Code or Name
- Category-based filtering (e.g., Detectors, Cameras, Cables)
- Real-time status tracking (Active/Inactive parts)
- Modal-driven CRUD workflow for rapid data entry
- Responsive table with custom renderers for codes and units

**Key Components:**
- `MaterialFormModal` - Unified modal for adding and editing parts
- `Table` - Displays part code, name, category, and unit
- `SearchInput` - Debounced search for the parts database
- `Badge` - Visual indicators for categories and active status

**API Calls:**
- `useMaterials(filters)` - Fetches the filtered catalog
- `useMaterialCategories()` - Dynamically retrieves unique categories for the filter dropdown
- `useDeleteMaterial()` - Mutation to remove a part from the catalog

**User Flow:**
1. Search for a part by its internal code (e.g., "DET-001")
2. Filter by "Cables" to see available wiring options
3. Click a row to update part details (e.g., change unit from 'adet' to 'metre')
4. Use "Add New" to register a newly stocked equipment type

**File:** `src/features/materials/MaterialsListPage.jsx`

***

## Components

### MaterialFormModal
**Purpose:** Provides a focused interface for defining part attributes.
**Used in:** `MaterialsListPage`
**Features:** 
- Fields for unique Code, Name, Category, and Unit.
- "Is Active" toggle to retire old parts without deleting historical data.
- Auto-focus on the Code field for faster entry.
**File:** `src/features/materials/MaterialFormModal.jsx`

***

## API & Data

**API File:** `src/features/materials/api.js`

**Key Functions:**
- `fetchMaterials(filters)` - Queries the `materials` table with search and category logic
- `createMaterial(data)` - Standard insert for new parts
- `updateMaterial(id, data)` - Standard update for existing parts
- `deleteMaterial(id)` - Removes part record
- `fetchMaterialCategories()` - Returns unique values from the `category` column

**React Query Hooks:**
- `useMaterials()` - Main catalog hook
- `useActiveMaterials()` - Filtered hook for parts selection in Work Orders
- `useCreateMaterial()` / `useUpdateMaterial()` - Mutation hooks

**Database Tables:**
- `materials` - Core catalog data (code, name, category, unit, is_active)

***

## Business Rules
1. **Unique Codes:** Every material should have a unique part code for clear identification in the field.
2. **Active Status:** Only "Active" materials are typically available for selection in new Work Orders.
3. **Standard Units:** Supports standardized units like `adet` (piece), `metre` (meter), and `paket` (pack).
4. **Soft Retirement:** Instead of deleting parts used in historical work orders, they should be marked as `is_active = false`.

***

## Technical Notes
- **Modal Workflow:** Uses a single modal for both Create and Edit to maintain a dry codebase.
- **Dynamic Categories:** Category filters are derived from actual data in the database rather than a hardcoded list.
- **Integration:** This module provides the data source for the `MaterialSelector` used in the Work Orders module.
