# Work Order System - Implementation Plan

> **Status:** Planning Phase
> **Created:** 2026-02-05
> **Last Updated:** 2026-02-05

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Migration Plan](#2-database-migration-plan)
3. [Backend Changes](#3-backend-changes)
4. [Frontend Changes](#4-frontend-changes)
5. [UI/UX Structure](#5-uiux-structure)
6. [i18n Keys](#6-i18n-keys)
7. [Race Conditions & Edge Cases](#7-race-conditions--edge-cases)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Order](#9-implementation-order-phases)

---

## 1. Overview

### Business Goal
Replace Excel-based workflow with a database system for tracking security system installation and maintenance work.

### Key Changes
| Area | Current State | Target State |
|------|---------------|--------------|
| Customer structure | 1 customer = 1 account_no | 1 company → N locations → N account_no's |
| Work order location | Links to customer only | Links to specific site |
| Assignees | Single worker | 1-3 workers (UUID[]) |
| Materials | Free text | Standardized catalog + quantities |
| Work types | service/installation | montaj/servis/bakım/keşif/diğer |
| Form tracking | None | form_no field |

### New Entities
- `customer_sites` - Location/branch records with account_no
- `materials` - Product catalog
- `work_order_materials` - Junction table for materials used

---

## 2. Database Migration Plan

### 2.1 Migration Files

| Order | File | Purpose | Dependencies |
|-------|------|---------|--------------|
| 00006 | `00006_rebuild_customers.sql` | Modify customers table (remove address/account_no, add company_name) | None |
| 00007 | `00007_add_customer_sites.sql` | Create customer_sites table | 00006 |
| 00008 | `00008_add_materials.sql` | Create materials table | None |
| 00009 | `00009_rebuild_work_orders.sql` | Modify work_orders (add site_id, form_no, work_type, assigned_to[]) | 00007 |
| 00010 | `00010_work_order_materials.sql` | Create junction table | 00008, 00009 |
| 00011 | `00011_views_and_functions.sql` | Create views and helper functions | 00010 |
| 00012 | `00012_seed_materials.sql` | Seed initial materials data | 00008 |

### 2.2 Migration Execution Order

```bash
# Run in Supabase SQL Editor in this exact order:
1. 00006_rebuild_customers.sql
2. 00007_add_customer_sites.sql
3. 00008_add_materials.sql
4. 00009_rebuild_work_orders.sql
5. 00010_work_order_materials.sql
6. 00011_views_and_functions.sql
7. 00012_seed_materials.sql
```

### 2.3 Rollback Strategy

Since this is a fresh database, rollback is simple:

```sql
-- Full rollback (drop new tables, restore old schema)
DROP VIEW IF EXISTS work_orders_detail CASCADE;
DROP VIEW IF EXISTS work_orders_with_customer CASCADE;
DROP TABLE IF EXISTS work_order_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS customer_sites CASCADE;

-- Then restore from complete_schema.sql backup
```

**Backup before migration:**
```bash
# Export current schema
pg_dump --schema-only -f backup_schema_$(date +%Y%m%d).sql
```

### 2.4 Data Validation Queries

Run these after migration to verify schema:

```sql
-- 1. Verify customer_sites table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_sites';

-- 2. Verify materials table has seed data
SELECT COUNT(*) FROM materials;  -- Should be 20

-- 3. Verify work_orders has new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_orders'
AND column_name IN ('site_id', 'form_no', 'work_type', 'assigned_to');

-- 4. Verify foreign key constraints
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';

-- 5. Verify RLS policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- 6. Test view works
SELECT * FROM work_orders_detail LIMIT 1;
```

### 2.5 Migration Testing Checklist

- [ ] All migration files execute without errors
- [ ] `customer_sites` table created with correct constraints
- [ ] `materials` table created and seeded (20 items)
- [ ] `work_order_materials` junction table created
- [ ] `work_orders` table modified (site_id, form_no, work_type, assigned_to[])
- [ ] Old `customers.account_number` column removed
- [ ] Old `customers.address/city/district` columns removed
- [ ] `work_orders_detail` view returns correct joined data
- [ ] RLS policies applied to all new tables
- [ ] Helper functions (`search_work_history`, `get_daily_work_list`) work
- [ ] Unique constraint on `customer_sites.account_no` (nulls allowed)

---

## 3. Backend Changes

### 3.1 File Structure Overview

```
src/features/
├── customers/
│   ├── api.js           # MODIFY - add site-related API calls
│   ├── hooks.js         # MODIFY - add site hooks
│   ├── schema.js        # MODIFY - update customer schema, add site schema
│   ├── CustomersListPage.jsx      # MODIFY - show site count
│   ├── CustomerDetailPage.jsx     # MODIFY - show sites list
│   ├── CustomerFormPage.jsx       # MODIFY - remove address fields
│   └── index.js         # UPDATE exports
│
├── customerSites/       # NEW FEATURE MODULE
│   ├── api.js           # NEW - site CRUD operations
│   ├── hooks.js         # NEW - React Query hooks
│   ├── schema.js        # NEW - Zod validation
│   ├── SiteFormModal.jsx          # NEW - create/edit site modal
│   └── index.js         # NEW - exports
│
├── materials/           # NEW FEATURE MODULE
│   ├── api.js           # NEW - materials CRUD
│   ├── hooks.js         # NEW - React Query hooks
│   ├── schema.js        # NEW - Zod validation
│   ├── MaterialsListPage.jsx      # NEW - admin materials management
│   ├── MaterialFormModal.jsx      # NEW - create/edit material
│   └── index.js         # NEW - exports
│
├── workOrders/
│   ├── api.js           # MAJOR REWRITE
│   ├── hooks.js         # MAJOR REWRITE
│   ├── schema.js        # MAJOR REWRITE
│   ├── WorkOrdersListPage.jsx     # MODIFY - new filters
│   ├── WorkOrderDetailPage.jsx    # MODIFY - show site info, materials
│   ├── WorkOrderFormPage.jsx      # MAJOR REWRITE
│   ├── CustomerSiteSelector.jsx   # NEW COMPONENT
│   ├── MaterialSelector.jsx       # NEW COMPONENT
│   ├── WorkerSelector.jsx         # NEW COMPONENT
│   ├── DailyWorkListPage.jsx      # NEW PAGE
│   └── index.js         # UPDATE exports
│
└── workHistory/         # NEW FEATURE MODULE
    ├── api.js           # NEW - search functions
    ├── hooks.js         # NEW - React Query hooks
    ├── WorkHistoryPage.jsx        # NEW - search by account_no/company
    └── index.js         # NEW - exports
```

### 3.2 API Function Specifications

#### 3.2.1 Customer Sites API (`src/features/customerSites/api.js`)

```javascript
// Query keys
export const siteKeys = {
  all: ['customerSites'],
  lists: () => [...siteKeys.all, 'list'],
  listByCustomer: (customerId) => [...siteKeys.lists(), { customerId }],
  details: () => [...siteKeys.all, 'detail'],
  detail: (id) => [...siteKeys.details(), id],
  byAccountNo: (accountNo) => [...siteKeys.all, 'accountNo', accountNo],
};

// API Functions
export async function fetchSitesByCustomer(customerId: string): Promise<Site[]>
export async function fetchSiteByAccountNo(accountNo: string): Promise<Site | null>
export async function fetchSite(id: string): Promise<Site>
export async function createSite(data: CreateSiteInput): Promise<Site>
export async function updateSite(id: string, data: UpdateSiteInput): Promise<Site>
export async function deleteSite(id: string): Promise<void>
export async function searchSites(query: string): Promise<Site[]>  // search by account_no or address
```

#### 3.2.2 Materials API (`src/features/materials/api.js`)

```javascript
// Query keys
export const materialKeys = {
  all: ['materials'],
  lists: () => [...materialKeys.all, 'list'],
  list: (filters) => [...materialKeys.lists(), filters],
  active: () => [...materialKeys.lists(), { active: true }],
  details: () => [...materialKeys.all, 'detail'],
  detail: (id) => [...materialKeys.details(), id],
  categories: () => [...materialKeys.all, 'categories'],
};

// API Functions
export async function fetchMaterials(filters?: MaterialFilters): Promise<Material[]>
export async function fetchActiveMaterials(): Promise<Material[]>  // For dropdown
export async function fetchMaterial(id: string): Promise<Material>
export async function createMaterial(data: CreateMaterialInput): Promise<Material>
export async function updateMaterial(id: string, data: UpdateMaterialInput): Promise<Material>
export async function deleteMaterial(id: string): Promise<void>
export async function fetchMaterialCategories(): Promise<string[]>
```

#### 3.2.3 Work Orders API Updates (`src/features/workOrders/api.js`)

```javascript
// Updated query keys
export const workOrderKeys = {
  all: ['workOrders'],
  lists: () => [...workOrderKeys.all, 'list'],
  list: (filters) => [...workOrderKeys.lists(), filters],
  details: () => [...workOrderKeys.all, 'detail'],
  detail: (id) => [...workOrderKeys.details(), id],
  bySite: (siteId) => [...workOrderKeys.all, 'site', siteId],
  byCustomer: (customerId) => [...workOrderKeys.all, 'customer', customerId],
  daily: (date) => [...workOrderKeys.all, 'daily', date],
  materials: (workOrderId) => [...workOrderKeys.detail(workOrderId), 'materials'],
};

// Updated API Functions
export async function fetchWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrderDetail[]>
export async function fetchWorkOrder(id: string): Promise<WorkOrderDetail>
export async function createWorkOrder(data: CreateWorkOrderInput): Promise<WorkOrder>
export async function updateWorkOrder(id: string, data: UpdateWorkOrderInput): Promise<WorkOrder>
export async function deleteWorkOrder(id: string): Promise<void>

// New functions
export async function fetchDailyWorkList(date: string, assignedTo?: string): Promise<WorkOrderDetail[]>
export async function fetchWorkOrdersBySite(siteId: string): Promise<WorkOrderDetail[]>
export async function fetchWorkOrdersByCustomer(customerId: string): Promise<WorkOrderDetail[]>
export async function searchWorkHistory(params: SearchParams): Promise<WorkOrderDetail[]>

// Materials management
export async function fetchWorkOrderMaterials(workOrderId: string): Promise<WorkOrderMaterial[]>
export async function addWorkOrderMaterial(workOrderId: string, materialId: string, quantity: number): Promise<void>
export async function updateWorkOrderMaterial(id: string, quantity: number): Promise<void>
export async function removeWorkOrderMaterial(id: string): Promise<void>
export async function setWorkOrderMaterials(workOrderId: string, materials: MaterialInput[]): Promise<void>
```

### 3.3 React Query Hooks

#### 3.3.1 Site Hooks (`src/features/customerSites/hooks.js`)

```javascript
export function useSitesByCustomer(customerId: string)
export function useSite(id: string)
export function useSiteByAccountNo(accountNo: string)
export function useCreateSite()
export function useUpdateSite()
export function useDeleteSite()
export function useSearchSites(query: string)
```

#### 3.3.2 Material Hooks (`src/features/materials/hooks.js`)

```javascript
export function useMaterials(filters?: MaterialFilters)
export function useActiveMaterials()  // For dropdowns
export function useMaterial(id: string)
export function useCreateMaterial()
export function useUpdateMaterial()
export function useDeleteMaterial()
export function useMaterialCategories()
```

#### 3.3.3 Updated Work Order Hooks (`src/features/workOrders/hooks.js`)

```javascript
// Existing (modified)
export function useWorkOrders(filters?: WorkOrderFilters)
export function useWorkOrder(id: string)
export function useCreateWorkOrder()
export function useUpdateWorkOrder()
export function useDeleteWorkOrder()

// New hooks
export function useDailyWorkList(date: string, assignedTo?: string)
export function useWorkOrdersBySite(siteId: string)
export function useWorkOrdersByCustomer(customerId: string)
export function useSearchWorkHistory(params: SearchParams)
export function useWorkOrderMaterials(workOrderId: string)
export function useSetWorkOrderMaterials()
```

### 3.4 Zod Schemas

#### 3.4.1 Customer Schema Updates (`src/features/customers/schema.js`)

```javascript
import { z } from 'zod';
import i18n from '@/lib/i18n';

export const customerSchema = z.object({
  company_name: z.string().min(1, i18n.t('errors:validation.required')),
  phone: z.string().min(1, i18n.t('errors:validation.required')),
  phone_secondary: z.string().optional().or(z.literal('')),
  email: z.string().email(i18n.t('errors:validation.email')).optional().or(z.literal('')),
  tax_number: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const customerDefaultValues = {
  company_name: '',
  phone: '',
  phone_secondary: '',
  email: '',
  tax_number: '',
  notes: '',
};
```

#### 3.4.2 Site Schema (`src/features/customerSites/schema.js`)

```javascript
import { z } from 'zod';
import i18n from '@/lib/i18n';

export const siteSchema = z.object({
  customer_id: z.string().min(1, i18n.t('errors:validation.required')),
  account_no: z.string().optional().or(z.literal('')),
  site_name: z.string().optional().or(z.literal('')),
  address: z.string().min(1, i18n.t('errors:validation.required')),
  city: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  contact_phone: z.string().optional().or(z.literal('')),
  panel_info: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const siteDefaultValues = {
  customer_id: '',
  account_no: '',
  site_name: '',
  address: '',
  city: '',
  district: '',
  contact_name: '',
  contact_phone: '',
  panel_info: '',
  notes: '',
};
```

#### 3.4.3 Work Order Schema (`src/features/workOrders/schema.js`)

```javascript
import { z } from 'zod';
import i18n from '@/lib/i18n';

// Work type enum
export const WORK_TYPES = ['kesif', 'montaj', 'servis', 'bakim', 'diger'] as const;

// Work types that require account_no
export const ACCOUNT_NO_REQUIRED_TYPES = ['servis', 'bakim'];
export const ACCOUNT_NO_WARNING_TYPES = ['montaj'];

export const workOrderSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')),
  form_no: z.string().optional().or(z.literal('')),
  work_type: z.enum(WORK_TYPES),
  work_type_other: z.string().max(30).optional().or(z.literal('')),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduled_date: z.string().optional().or(z.literal('')),
  scheduled_time: z.string().optional().or(z.literal('')),
  assigned_to: z.array(z.string()).min(1).max(3),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  amount: z.number().optional().or(z.literal('')),
  currency: z.string().default('TRY'),
}).refine((data) => {
  // If work_type is 'diger', work_type_other is required
  if (data.work_type === 'diger') {
    return data.work_type_other && data.work_type_other.length > 0;
  }
  return true;
}, {
  message: i18n.t('workOrders:validation.workTypeOtherRequired'),
  path: ['work_type_other'],
});

export const workOrderDefaultValues = {
  site_id: '',
  form_no: '',
  work_type: 'servis',
  work_type_other: '',
  status: 'pending',
  priority: 'normal',
  scheduled_date: '',
  scheduled_time: '',
  assigned_to: [],
  description: '',
  notes: '',
  amount: '',
  currency: 'TRY',
};

// Material input schema (for form)
export const workOrderMaterialSchema = z.object({
  material_id: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional().or(z.literal('')),
});
```

### 3.5 Error Handling Strategy

```javascript
// src/lib/errorHandler.js - Add new error types

export const ERROR_CODES = {
  // Existing
  NETWORK_ERROR: 'network_error',
  AUTH_ERROR: 'auth_error',

  // New for this feature
  ACCOUNT_NO_REQUIRED: 'account_no_required',
  SITE_NOT_FOUND: 'site_not_found',
  DUPLICATE_ACCOUNT_NO: 'duplicate_account_no',
  INVALID_WORK_TYPE: 'invalid_work_type',
  MATERIAL_NOT_FOUND: 'material_not_found',
};

// Error handler for API calls
export function handleApiError(error, context) {
  if (error.code === '23505') { // Unique violation
    if (error.message.includes('account_no')) {
      return { code: ERROR_CODES.DUPLICATE_ACCOUNT_NO, message: 'Bu hesap numarası zaten kullanımda' };
    }
  }
  // ... existing error handling
}
```

### 3.6 Cache Invalidation Strategy

```javascript
// When creating a work order:
queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: workOrderKeys.bySite(siteId) });
queryClient.invalidateQueries({ queryKey: workOrderKeys.byCustomer(customerId) });
queryClient.invalidateQueries({ queryKey: siteKeys.detail(siteId) }); // Update work count

// When creating a site:
queryClient.invalidateQueries({ queryKey: siteKeys.listByCustomer(customerId) });
queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }); // Update site count

// When updating materials on work order:
queryClient.invalidateQueries({ queryKey: workOrderKeys.materials(workOrderId) });
queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(workOrderId) });
```

---

## 4. Frontend Changes

### 4.1 New Pages

| Route | Component | Location | Purpose |
|-------|-----------|----------|---------|
| `/daily-work` | `DailyWorkListPage` | `src/features/workOrders/` | Daily work list view |
| `/work-history` | `WorkHistoryPage` | `src/features/workHistory/` | Search work history |
| `/materials` | `MaterialsListPage` | `src/features/materials/` | Materials management (admin) |

### 4.2 Modified Pages

#### 4.2.1 `CustomersListPage.jsx`

**Changes:**
- [ ] Update table/cards to show site count per customer
- [ ] Remove account_number display (it's per-site now)
- [ ] Add "Sites: N" badge to customer cards

#### 4.2.2 `CustomerDetailPage.jsx`

**Changes:**
- [ ] Remove single address display
- [ ] Add "Sites" section with list of all sites
- [ ] Each site shows: name, account_no, address
- [ ] "Add Site" button to open SiteFormModal
- [ ] Click site → expand to show details + "View Work History"
- [ ] Work history now filtered by site OR by all customer sites

#### 4.2.3 `CustomerFormPage.jsx`

**Changes:**
- [ ] Rename "name" field to "company_name"
- [ ] Remove address, city, district fields
- [ ] Add tax_number field
- [ ] After customer creation → redirect to detail page (to add sites)

#### 4.2.4 `WorkOrdersListPage.jsx`

**Changes:**
- [ ] Add work_type filter dropdown (keşif/montaj/servis/bakım/diğer)
- [ ] Update type display (Turkish labels)
- [ ] Show site name + account_no in list
- [ ] Add "account_no" search field

#### 4.2.5 `WorkOrderDetailPage.jsx`

**Changes:**
- [ ] Show site info section (site_name, account_no, address)
- [ ] Show company info section
- [ ] Show form_no field
- [ ] Show work_type with Turkish label
- [ ] Show multiple assigned workers
- [ ] Add "Materials Used" section with table
- [ ] Add breadcrumb: Work Orders > [Company] > [Site] > WO-123

#### 4.2.6 `WorkOrderFormPage.jsx`

**MAJOR REWRITE** - See Section 4.4 for detailed form structure.

### 4.3 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CustomerSiteSelector` | `src/features/workOrders/` | Select customer → then select site |
| `SiteFormModal` | `src/features/customerSites/` | Create/edit site in modal |
| `MaterialSelector` | `src/features/workOrders/` | Select materials with quantity |
| `WorkerSelector` | `src/features/workOrders/` | Multi-select workers (1-3) |
| `AccountNoWarning` | `src/features/workOrders/` | Warning/error for missing account_no |
| `DailyWorkCard` | `src/features/workOrders/` | Card for daily work list |
| `WorkHistoryTable` | `src/features/workHistory/` | Search results table |
| `SiteCard` | `src/features/customerSites/` | Site display in customer detail |
| `MaterialBadge` | `src/features/materials/` | Material display with quantity |

### 4.4 Work Order Form Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Yeni İş Emri Oluştur                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Müşteri Seçimi ────────────────────────────────────────┐ │
│ │ [Search: Müşteri ara...]                      [+Yeni]   │ │
│ │                                                         │ │
│ │ Selected: ERGUN POLAT İNŞAAT                           │ │
│ │                                                         │ │
│ │ Lokasyon: [Dropdown: Nişantaşı Şubesi ▼]    [+Yeni]    │ │
│ │ Hesap No: 12345                                         │ │
│ │ Adres: Nişantaşı Mah. No:15                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ İş Bilgileri ──────────────────────────────────────────┐ │
│ │ Form No:        [________________]                      │ │
│ │                                                         │ │
│ │ İş Tipi:        ○ Keşif  ○ Montaj  ○ Servis            │ │
│ │                 ○ Bakım  ○ Diğer: [________]           │ │
│ │                                                         │ │
│ │ ⚠️ Servis için hesap numarası gereklidir               │ │
│ │                                                         │ │
│ │ Tarih:          [__/__/____]  Saat: [__:__]            │ │
│ │                                                         │ │
│ │ Atanan Personel (1-3):                                 │ │
│ │ [x] Ahmet Yılmaz                                       │ │
│ │ [x] Mehmet Demir                                       │ │
│ │ [ ] Ali Kaya                                           │ │
│ │                                                         │ │
│ │ Öncelik:        [Normal ▼]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Kullanılan Malzemeler ─────────────────────────────────┐ │
│ │ [Malzeme Seç ▼]              Adet: [__]    [+ Ekle]    │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ DK230 - Optik Duman Dedektörü           7 adet  [x] │ │
│ │ │ SR408 - Flaşörlü Yangın Sireni          4 adet  [x] │ │
│ │ │ DD-T - Dedektör Tabanı                  7 adet  [x] │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Notlar ────────────────────────────────────────────────┐ │
│ │ Yapılan İşler:                                          │ │
│ │ [                                                    ]  │ │
│ │ [                                                    ]  │ │
│ │                                                         │ │
│ │ Ek Notlar:                                              │ │
│ │ [                                                    ]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [İptal]  [Kaydet]              │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Form Validation (Conditional Logic)

```javascript
// Validation rules based on work_type
const validateWorkOrder = (data, site) => {
  const errors = [];

  // Always required
  if (!data.site_id) errors.push({ field: 'site_id', message: 'Lokasyon gerekli' });
  if (!data.work_type) errors.push({ field: 'work_type', message: 'İş tipi gerekli' });
  if (data.assigned_to.length === 0) errors.push({ field: 'assigned_to', message: 'En az 1 personel seçin' });
  if (data.assigned_to.length > 3) errors.push({ field: 'assigned_to', message: 'En fazla 3 personel seçilebilir' });

  // work_type specific
  if (data.work_type === 'diger' && !data.work_type_other) {
    errors.push({ field: 'work_type_other', message: 'Diğer açıklaması gerekli' });
  }

  // account_no validation (based on site)
  const hasAccountNo = site?.account_no && site.account_no.trim() !== '';

  if (['servis', 'bakim'].includes(data.work_type) && !hasAccountNo) {
    errors.push({ field: 'site_id', message: 'Bu iş tipi için hesap numarası gerekli' });
  }

  return errors;
};

// Warning (not blocking) for montaj without account_no
const getWarnings = (data, site) => {
  const warnings = [];

  const hasAccountNo = site?.account_no && site.account_no.trim() !== '';

  if (data.work_type === 'montaj' && !hasAccountNo) {
    warnings.push('Montaj için hesap numarası girilmedi. Sonra eklenebilir.');
  }

  return warnings;
};
```

### 4.6 CustomerSiteSelector Component Flow

```
┌─────────────────────────────────────────────────────────┐
│ State: No customer selected                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [🔍 Müşteri ara veya yeni ekle...]                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (user types search)
┌─────────────────────────────────────────────────────────┐
│ State: Searching                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [🔍 "ERGUN POL..."]                                 │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ERGUN POLAT İNŞAAT (3 lokasyon)                     │ │
│ │ POLAT GÜVENLIK LTD (1 lokasyon)                     │ │
│ │ ─────────────────────────────────────               │ │
│ │ [+ Yeni Müşteri Ekle: "ERGUN POL..."]              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (user selects customer)
┌─────────────────────────────────────────────────────────┐
│ State: Customer selected, no site                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Müşteri: ERGUN POLAT İNŞAAT               [Değiştir]│ │
│ │                                                     │ │
│ │ Lokasyon: [Seçiniz ▼]                    [+ Yeni]  │ │
│ │ ├─ Nişantaşı Şubesi (12345)                        │ │
│ │ ├─ Beyoğlu Şubesi (12346)                          │ │
│ │ └─ Kadıköy Şubesi (12347)                          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (user selects site)
┌─────────────────────────────────────────────────────────┐
│ State: Site selected                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Müşteri: ERGUN POLAT İNŞAAT               [Değiştir]│ │
│ │                                                     │ │
│ │ Lokasyon: Nişantaşı Şubesi                [Değiştir]│ │
│ │ Hesap No: 12345                                     │ │
│ │ Adres: Nişantaşı Mah. Teşvikiye Cad. No:15         │ │
│ │ Yetkili: Ahmet Bey (0532 123 4567)                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 5. UI/UX Structure

### 5.1 Navigation Updates

**File:** `src/components/layout/navItems.js`

```javascript
const navItems = [
  { to: '/', icon: Home, labelKey: 'nav.dashboard', exact: true },
  { to: '/customers', icon: Users, labelKey: 'nav.customers' },
  { to: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders' },
  { to: '/daily-work', icon: CalendarCheck, labelKey: 'nav.dailyWork' },    // NEW
  { to: '/work-history', icon: Search, labelKey: 'nav.workHistory' },       // NEW
  { to: '/calendar', icon: Calendar, labelKey: 'nav.calendar' },
  { to: '/tasks', icon: CheckSquare, labelKey: 'nav.tasks' },
  // Admin only:
  { to: '/materials', icon: Package, labelKey: 'nav.materials', adminOnly: true }, // NEW
];
```

### 5.2 Breadcrumb Structure

| Page | Breadcrumb |
|------|------------|
| Daily Work | Günlük İşler |
| Work History | İş Geçmişi |
| Work Order List | İş Emirleri |
| Work Order Detail | İş Emirleri > [Company] > [Site] > WO-123 |
| Work Order Form (new) | İş Emirleri > Yeni İş Emri |
| Work Order Form (edit) | İş Emirleri > [Company] > [Site] > Düzenle |
| Customer Detail | Müşteriler > [Company] |
| Materials | Malzemeler |

### 5.3 User Flows

#### Flow 1: Keşif - New Customer, No Account No

```
1. User clicks "Yeni İş Emri" from dashboard or sidebar
2. Work Order form opens
3. User searches for customer → Not found
4. User clicks "+ Yeni Müşteri Ekle"
5. Quick customer form appears (inline or modal):
   - Company Name*
   - Phone*
6. User saves customer
7. Customer created, site form appears:
   - Address*
   - Site Name (optional)
   - Account No (optional - keşif doesn't need it)
8. User saves site
9. Back to work order form with customer+site pre-selected
10. User selects work_type: "Keşif"
11. No warning shown (keşif doesn't require account_no)
12. User selects workers, adds notes
13. User saves work order
```

#### Flow 2: Montaj - New Customer, Account No Added Later

```
1. User creates work order as above (keşif flow)
2. Selects work_type: "Montaj"
3. Warning shown: "Montaj için hesap numarası girilmedi. Sonra eklenebilir."
4. User can:
   a) Ignore warning, save work order
   b) Click "Hesap No Ekle" → updates site inline
5. Work order saved
6. Later: User goes to Customer Detail > Sites > Edit > Adds account_no
```

#### Flow 3: Servis - Existing Customer, Account No Required

```
1. User clicks "Yeni İş Emri"
2. Searches customer → Found: "ERGUN POLAT İNŞAAT"
3. Selects site: "Nişantaşı Şubesi (12345)"
4. Selects work_type: "Servis"
5. Form validates: account_no exists ✓
6. User fills other fields
7. Saves work order
```

#### Flow 4: Servis - Missing Account No (Blocked)

```
1. User creates work order for site without account_no
2. Selects work_type: "Servis"
3. Error shown: "Bu iş tipi için hesap numarası gerekli"
4. Form submit blocked
5. User must either:
   a) Change work_type to kesif/montaj
   b) Add account_no to site first (click "Hesap No Ekle")
```

#### Flow 5: Search Work History

```
1. User navigates to "İş Geçmişi" page
2. Sees search form:
   - Search by: [Account No / Company Name] radio
   - Search input
   - Date range (optional)
   - Work type filter (optional)
   - Worker filter (optional)
3. User enters account_no: "12345"
4. Results show all work orders for that site
5. User can click any result to view details

OR:

3. User selects "Company Name", enters "ERGUN POLAT"
4. Results show all work orders for ALL sites of matching companies
```

#### Flow 6: Daily Work List

```
1. User navigates to "Günlük İşler" (or from dashboard quick link)
2. Page shows today's date with date picker
3. List shows all work orders for selected date:
   - Time | Customer | Site | Work Type | Workers | Form No | Status
4. User can filter by:
   - Worker (default: show all if admin, own if field_worker)
   - Work type
5. User can click any row to view/edit work order
```

### 5.4 Form Access Points

| Access Point | Action |
|--------------|--------|
| Dashboard "+" button | Opens WorkOrderFormPage (new) |
| Work Orders list "+ Yeni" button | Opens WorkOrderFormPage (new) |
| Customer Detail "İş Emri Oluştur" button | Opens WorkOrderFormPage with customer pre-selected |
| Site row "İş Emri" action | Opens WorkOrderFormPage with customer+site pre-selected |
| Daily Work list row click | Opens WorkOrderDetailPage |
| Work History result click | Opens WorkOrderDetailPage |

### 5.5 Dashboard Updates

Add to dashboard (`src/features/dashboard/DashboardPage.jsx`):

```javascript
// Quick stats card updates
- "Bugünün İşleri" → Links to /daily-work
- Add "İş Geçmişi Ara" quick action button

// Quick action buttons
<QuickActionButton
  icon={Plus}
  label="Yeni İş Emri"
  to="/work-orders/new"
/>
<QuickActionButton
  icon={Search}
  label="İş Geçmişi Ara"
  to="/work-history"
/>
<QuickActionButton
  icon={CalendarCheck}
  label="Günlük İşler"
  to="/daily-work"
/>
```

---

## 6. i18n Keys

### 6.1 File Structure

```
src/locales/tr/
├── common.json          # UPDATE - add work types, nav items
├── customers.json       # UPDATE - rename fields, add sites section
├── workOrders.json      # MAJOR UPDATE
├── materials.json       # NEW FILE
├── dailyWork.json       # NEW FILE
├── workHistory.json     # NEW FILE
└── errors.json          # UPDATE - add new error messages
```

### 6.2 Translation Key Structure

#### `common.json` Updates

```json
{
  "nav": {
    "dailyWork": "Günlük İşler",
    "workHistory": "İş Geçmişi",
    "materials": "Malzemeler"
  },
  "workType": {
    "kesif": "Keşif",
    "montaj": "Montaj",
    "servis": "Servis",
    "bakim": "Bakım",
    "diger": "Diğer"
  }
}
```

#### `customers.json` Updates

```json
{
  "form": {
    "fields": {
      "companyName": "Firma Adı",
      "taxNumber": "Vergi Numarası"
    },
    "placeholders": {
      "companyName": "Firma veya şahıs adı",
      "taxNumber": "Vergi numarası (opsiyonel)"
    }
  },
  "sites": {
    "title": "Lokasyonlar",
    "addButton": "Lokasyon Ekle",
    "editButton": "Düzenle",
    "noSites": "Henüz lokasyon eklenmedi",
    "siteCount": "{{count}} lokasyon",
    "fields": {
      "siteName": "Lokasyon Adı",
      "accountNo": "Hesap Numarası",
      "address": "Adres",
      "city": "İl",
      "district": "İlçe",
      "contactName": "Yetkili Kişi",
      "contactPhone": "Yetkili Telefon",
      "panelInfo": "Panel Bilgisi"
    },
    "placeholders": {
      "siteName": "örn: Nişantaşı Şubesi",
      "accountNo": "Alarm izleme hesap no",
      "address": "Tam adres",
      "contactName": "Lokasyondaki yetkili",
      "contactPhone": "Yetkili telefon numarası"
    }
  }
}
```

#### `workOrders.json` Updates

```json
{
  "form": {
    "sections": {
      "customerSelection": "Müşteri Seçimi",
      "workInfo": "İş Bilgileri",
      "materials": "Kullanılan Malzemeler",
      "notes": "Notlar"
    },
    "fields": {
      "formNo": "Form Numarası",
      "workType": "İş Tipi",
      "workTypeOther": "Diğer Açıklama",
      "assignedTo": "Atanan Personel",
      "selectCustomer": "Müşteri Seç",
      "selectSite": "Lokasyon Seç",
      "scheduledDate": "Tarih",
      "scheduledTime": "Saat",
      "description": "Yapılan İşler",
      "addMaterial": "Malzeme Ekle",
      "quantity": "Adet"
    },
    "placeholders": {
      "formNo": "Kağıt form numarası",
      "workTypeOther": "Maksimum 30 karakter",
      "searchCustomer": "Müşteri ara veya yeni ekle...",
      "description": "Yapılan işlerin detaylı açıklaması"
    },
    "buttons": {
      "addCustomer": "Yeni Müşteri Ekle",
      "addSite": "Yeni Lokasyon Ekle",
      "addAccountNo": "Hesap No Ekle",
      "changeCustomer": "Değiştir"
    }
  },
  "validation": {
    "siteRequired": "Lokasyon seçimi gerekli",
    "workTypeRequired": "İş tipi seçimi gerekli",
    "workTypeOtherRequired": "'Diğer' seçildiğinde açıklama gerekli",
    "assignedToMin": "En az 1 personel seçin",
    "assignedToMax": "En fazla 3 personel seçilebilir",
    "accountNoRequired": "Bu iş tipi için hesap numarası gerekli"
  },
  "warnings": {
    "montajNoAccountNo": "Montaj için hesap numarası girilmedi. Sonra eklenebilir."
  },
  "list": {
    "filters": {
      "workType": "İş Tipi",
      "allTypes": "Tüm Tipler",
      "searchAccountNo": "Hesap No ile ara"
    }
  },
  "detail": {
    "siteInfo": "Lokasyon Bilgileri",
    "companyInfo": "Firma Bilgileri",
    "materialsUsed": "Kullanılan Malzemeler",
    "noMaterials": "Malzeme kaydı yok"
  }
}
```

#### `materials.json` (NEW)

```json
{
  "title": "Malzemeler",
  "list": {
    "title": "Malzeme Listesi",
    "addButton": "Malzeme Ekle",
    "searchPlaceholder": "Malzeme ara...",
    "noMaterials": "Henüz malzeme eklenmedi",
    "columns": {
      "code": "Kod",
      "name": "Malzeme Adı",
      "category": "Kategori",
      "unit": "Birim",
      "status": "Durum"
    }
  },
  "form": {
    "createTitle": "Yeni Malzeme",
    "editTitle": "Malzeme Düzenle",
    "fields": {
      "code": "Ürün Kodu",
      "name": "Ürün Adı",
      "category": "Kategori",
      "unit": "Birim",
      "isActive": "Aktif"
    },
    "placeholders": {
      "code": "örn: DK230",
      "name": "örn: Optik Duman Dedektörü",
      "category": "Kategori seçin"
    }
  },
  "categories": {
    "dedektor": "Dedektör",
    "siren": "Siren",
    "panel": "Panel",
    "buton": "Buton",
    "kablo": "Kablo",
    "aksesuar": "Aksesuar",
    "kamera": "Kamera",
    "diger": "Diğer"
  },
  "units": {
    "adet": "Adet",
    "metre": "Metre",
    "paket": "Paket"
  },
  "status": {
    "active": "Aktif",
    "inactive": "Pasif"
  }
}
```

#### `dailyWork.json` (NEW)

```json
{
  "title": "Günlük İşler",
  "subtitle": "{{date}} tarihli işler",
  "filters": {
    "date": "Tarih",
    "worker": "Personel",
    "allWorkers": "Tüm Personel",
    "workType": "İş Tipi"
  },
  "table": {
    "time": "Saat",
    "customer": "Müşteri",
    "site": "Lokasyon",
    "accountNo": "Hesap No",
    "workType": "İş Tipi",
    "workers": "Personel",
    "formNo": "Form No",
    "status": "Durum"
  },
  "empty": {
    "title": "Bu tarihte iş yok",
    "description": "Seçili tarihte planlanmış iş bulunamadı"
  },
  "today": "Bugün",
  "yesterday": "Dün",
  "tomorrow": "Yarın"
}
```

#### `workHistory.json` (NEW)

```json
{
  "title": "İş Geçmişi",
  "subtitle": "Geçmiş işleri arayın",
  "search": {
    "label": "Arama Kriteri",
    "byAccountNo": "Hesap Numarası ile",
    "byCompanyName": "Firma Adı ile",
    "placeholder": {
      "accountNo": "Hesap numarası girin",
      "companyName": "Firma adı girin"
    },
    "button": "Ara",
    "filters": {
      "dateRange": "Tarih Aralığı",
      "from": "Başlangıç",
      "to": "Bitiş",
      "workType": "İş Tipi",
      "worker": "Personel"
    }
  },
  "results": {
    "title": "Arama Sonuçları",
    "count": "{{count}} kayıt bulundu",
    "noResults": "Sonuç bulunamadı",
    "columns": {
      "date": "Tarih",
      "customer": "Müşteri",
      "site": "Lokasyon",
      "accountNo": "Hesap No",
      "workType": "İş Tipi",
      "workers": "Personel",
      "formNo": "Form No"
    }
  }
}
```

#### `errors.json` Updates

```json
{
  "validation": {
    "accountNoRequired": "Hesap numarası gerekli",
    "accountNoDuplicate": "Bu hesap numarası zaten kullanımda",
    "siteRequired": "Lokasyon gerekli",
    "maxWorkersExceeded": "En fazla 3 personel seçilebilir",
    "workTypeOtherRequired": "'Diğer' seçildiğinde açıklama zorunlu"
  },
  "api": {
    "siteNotFound": "Lokasyon bulunamadı",
    "materialNotFound": "Malzeme bulunamadı",
    "duplicateAccountNo": "Bu hesap numarası başka bir lokasyonda kullanılıyor"
  }
}
```

---

## 7. Race Conditions & Edge Cases

### 7.1 Race Conditions

| Scenario | Risk | Solution |
|----------|------|----------|
| Creating customer + site + work_order simultaneously | Data consistency | Use transaction or sequential creation with proper error handling |
| Multiple users editing same work order | Lost updates | Optimistic locking with `updated_at` check |
| Updating account_no while form is open | Stale validation | Re-fetch site data on form submit |
| Deleting site while work order form open | Orphaned reference | Check site exists before save, show error if deleted |

### 7.2 Race Condition Solutions

#### Sequential Creation with Rollback

```javascript
async function createWorkOrderWithNewCustomerAndSite(customerData, siteData, workOrderData) {
  let customerId = null;
  let siteId = null;

  try {
    // Step 1: Create customer
    const customer = await createCustomer(customerData);
    customerId = customer.id;

    // Step 2: Create site
    const site = await createSite({ ...siteData, customer_id: customerId });
    siteId = site.id;

    // Step 3: Create work order
    const workOrder = await createWorkOrder({ ...workOrderData, site_id: siteId });

    return { customer, site, workOrder };
  } catch (error) {
    // Rollback on failure
    if (siteId) await deleteSite(siteId).catch(() => {});
    if (customerId) await deleteCustomer(customerId).catch(() => {});
    throw error;
  }
}
```

#### Optimistic Locking

```javascript
async function updateWorkOrder(id, data) {
  const { data: result, error } = await supabase
    .from('work_orders')
    .update(data)
    .eq('id', id)
    .eq('updated_at', data.original_updated_at) // Optimistic lock
    .select()
    .single();

  if (error) throw error;
  if (!result) {
    throw new Error('CONFLICT: Record was modified by another user');
  }
  return result;
}
```

### 7.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Customer exists but no sites | Show "Add Site" prompt before creating work order |
| Site has no account_no + user tries servis | Block form submit, show error with "Add Account No" button |
| form_no duplicates | Allow (not unique) - paper forms may have duplicates across years |
| Deleting customer with sites | Cascade delete sites (or block if work orders exist) |
| Deleting site with work orders | Block deletion, show "X work orders reference this site" |
| Multiple workers assigned, one is deleted | Keep UUID in array, show "Unknown Worker" in UI, allow admin cleanup |
| Material deleted while in use | Soft delete (is_active=false), keep historical references |
| account_no changed after work orders created | Allow change, work orders keep historical reference |

### 7.4 Edge Case UI Patterns

```javascript
// Customer with no sites
if (customer && customer.sites.length === 0) {
  return (
    <Alert type="warning">
      <p>Bu müşteriye ait lokasyon yok.</p>
      <Button onClick={openAddSiteModal}>Lokasyon Ekle</Button>
    </Alert>
  );
}

// Site without account_no for servis/bakim
if (requiresAccountNo && !site.account_no) {
  return (
    <Alert type="error">
      <p>Bu iş tipi için hesap numarası gerekli.</p>
      <Button onClick={() => openEditSiteModal(site.id)}>Hesap No Ekle</Button>
    </Alert>
  );
}

// Deleted worker in assigned_to array
const resolvedWorkers = assigned_to.map(id => {
  const worker = workers.find(w => w.id === id);
  return worker || { id, full_name: 'Bilinmeyen Personel', deleted: true };
});
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Component/Function | Test Cases |
|--------------------|------------|
| `workOrderSchema` | Valid data passes, invalid work_type fails, work_type_other required when diger |
| `validateWorkOrder()` | account_no validation per work_type |
| `CustomerSiteSelector` | Customer search, site selection, new customer flow |
| `MaterialSelector` | Add/remove materials, quantity validation |
| `WorkerSelector` | Multi-select 1-3, max limit enforced |

### 8.2 Integration Tests

| Flow | Test Steps |
|------|------------|
| Create work order (happy path) | Select customer → Select site → Fill form → Save → Verify in DB |
| Create with new customer | Search → Not found → Create customer → Create site → Create WO |
| account_no validation | Select site without account_no → Select "servis" → Verify blocked |
| Materials tracking | Add materials → Save → Verify in work_order_materials table |
| Search by account_no | Create WO → Search by account_no → Verify found |
| Search by company name | Create WO for company with 2 sites → Search → Verify both sites' WOs returned |

### 8.3 Manual Test Scenarios

#### Scenario 1: Complete New Customer Flow
- [ ] Create new work order
- [ ] Search for non-existent customer
- [ ] Click "Yeni Müşteri Ekle"
- [ ] Fill customer info (company_name, phone)
- [ ] Save customer
- [ ] Add site with address only (no account_no)
- [ ] Save site
- [ ] Select work_type: keşif
- [ ] Select 2 workers
- [ ] Add notes
- [ ] Save work order
- [ ] Verify customer appears in customers list
- [ ] Verify site appears in customer detail
- [ ] Verify work order appears in work orders list

#### Scenario 2: account_no Validation
- [ ] Go to existing customer with site (no account_no)
- [ ] Start new work order
- [ ] Select the site
- [ ] Select work_type: servis
- [ ] Verify error message shown
- [ ] Verify form submit blocked
- [ ] Click "Hesap No Ekle"
- [ ] Add account_no
- [ ] Verify error clears
- [ ] Verify form submits successfully

#### Scenario 3: Materials Tracking
- [ ] Create new work order
- [ ] Add 3 different materials with quantities
- [ ] Save work order
- [ ] Open work order detail
- [ ] Verify materials list shows correctly
- [ ] Edit work order
- [ ] Remove 1 material, change quantity of another
- [ ] Save
- [ ] Verify changes persisted

#### Scenario 4: Daily Work List
- [ ] Create 3 work orders for today
- [ ] Assign different workers
- [ ] Navigate to Daily Work page
- [ ] Verify all 3 shown
- [ ] Filter by worker
- [ ] Verify only that worker's orders shown
- [ ] Change date
- [ ] Verify list updates

#### Scenario 5: Work History Search
- [ ] Create work orders for same account_no on different dates
- [ ] Create work orders for same company, different sites
- [ ] Search by account_no
- [ ] Verify only that site's orders returned
- [ ] Search by company name
- [ ] Verify all sites' orders returned
- [ ] Apply date filter
- [ ] Verify filtered results

### 8.4 Sample Test Data

```sql
-- Test Customer
INSERT INTO customers (id, company_name, phone) VALUES
  ('c1', 'TEST FİRMA A.Ş.', '0212 555 1234');

-- Test Sites
INSERT INTO customer_sites (id, customer_id, account_no, site_name, address, city) VALUES
  ('s1', 'c1', '99001', 'Merkez', 'Test Adres 1', 'İstanbul'),
  ('s2', 'c1', '99002', 'Şube 1', 'Test Adres 2', 'İstanbul'),
  ('s3', 'c1', NULL, 'Şube 2 (Yeni)', 'Test Adres 3', 'İstanbul');

-- Test Work Orders
INSERT INTO work_orders (site_id, form_no, work_type, status, scheduled_date, assigned_to) VALUES
  ('s1', 'F001', 'montaj', 'completed', '2024-01-15', ARRAY['worker-uuid-1']),
  ('s1', 'F002', 'servis', 'completed', '2024-02-20', ARRAY['worker-uuid-1', 'worker-uuid-2']),
  ('s2', 'F003', 'bakim', 'pending', CURRENT_DATE, ARRAY['worker-uuid-1']);
```

---

## 9. Implementation Order (Phases)

### Phase 1: Database (Day 1)
- [x] Backup current schema
- [x] Run migration 00006_rebuild_customers.sql
- [x] Run migration 00007_add_customer_sites.sql
- [x] Run migration 00008_add_materials.sql
- [x] Run migration 00009_rebuild_work_orders.sql
- [x] Run migration 00010_work_order_materials.sql
- [x] Run migration 00011_views_and_functions.sql
- [x] Run migration 00012_seed_materials.sql
- [x] Run validation queries
- [x] Test RLS policies

### Phase 2: Backend - API & Hooks (Day 2-3)
- [x] Create `src/features/customerSites/` module
  - [x] api.js
  - [x] hooks.js
  - [x] schema.js
  - [x] index.js
- [x] Create `src/features/materials/` module
  - [x] api.js
  - [x] hooks.js
  - [x] schema.js
  - [x] index.js
- [x] Update `src/features/customers/` module
  - [x] api.js - add site queries
  - [x] hooks.js - add site hooks
  - [x] schema.js - update customer schema
- [x] Update `src/features/workOrders/` module
  - [x] api.js - complete rewrite
  - [x] hooks.js - add new hooks
  - [x] schema.js - new validation schema
- [x] Create `src/features/workHistory/` module
  - [x] api.js
  - [x] hooks.js
  - [x] index.js
- [x] Test all API functions with Supabase console

### Phase 3: Reusable Components (Day 4-5)
- [x] Create `CustomerSiteSelector.jsx`
- [x] Create `SiteFormModal.jsx`
- [x] Create `MaterialSelector.jsx`
- [x] Create `WorkerSelector.jsx`
- [x] Create `AccountNoWarning.jsx`
- [x] Create `SiteCard.jsx`
- [x] Create `DailyWorkCard.jsx`
- [ ] Test components in isolation

### Phase 4: Pages - Core (Day 6-8)
- [x] Rewrite `WorkOrderFormPage.jsx`
- [x] Update `WorkOrdersListPage.jsx`
- [x] Update `WorkOrderDetailPage.jsx`
- [x] Update `CustomerDetailPage.jsx` (add sites section)
- [x] Update `CustomerFormPage.jsx`
- [ ] Test CRUD flows end-to-end

### Phase 5: Pages - New Features (Day 9-10)
- [x] Create `DailyWorkListPage.jsx`
- [x] Create `WorkHistoryPage.jsx`
- [x] Create `MaterialsListPage.jsx` (admin)
- [x] Create `MaterialFormModal.jsx`
- [x] Add new routes to App.jsx

### Phase 6: Integration (Day 11-12)
- [x] Update navigation (navItems.js)
- [x] Update dashboard quick actions
- [x] Update breadcrumbs
- [x] Wire up all page links
- [x] Test user flows end-to-end

### Phase 7: i18n (Day 13)
- [x] Update common.json
- [x] Update customers.json
- [x] Update workOrders.json
- [x] Create materials.json
- [x] Create dailyWork.json
- [x] Create workHistory.json
- [x] Update errors.json
- [x] Test all strings appear correctly

### Phase 8: Polish (Day 14-15)
- [x] Loading states for all async operations
- [x] Error handling and toast messages
- [x] Empty states
- [x] Responsive design testing (mobile)
- [x] Dark mode testing
- [x] Form validation messages
- [x] Accessibility audit (aria labels, focus management)

### Phase 9: Testing & QA (Day 16-17)
- [ ] Run all manual test scenarios
- [ ] Fix bugs found
- [ ] Performance testing (large data sets)
- [ ] Cross-browser testing

### Phase 10: Documentation & Deployment (Day 18)
- [ ] Update database-schema.md
- [ ] Update API documentation
- [ ] Create user guide for new features
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## Appendix A: TypeScript Interfaces (Reference)

```typescript
// Customer
interface Customer {
  id: string;
  company_name: string;
  phone: string;
  phone_secondary?: string;
  email?: string;
  tax_number?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Virtual
  sites_count?: number;
}

// Site
interface CustomerSite {
  id: string;
  customer_id: string;
  account_no?: string;
  site_name?: string;
  address: string;
  city?: string;
  district?: string;
  contact_name?: string;
  contact_phone?: string;
  panel_info?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: Customer;
}

// Material
interface Material {
  id: string;
  code: string;
  name: string;
  category?: string;
  unit: string;
  is_active: boolean;
  created_at: string;
}

// Work Order
interface WorkOrder {
  id: string;
  site_id: string;
  form_no?: string;
  work_type: 'kesif' | 'montaj' | 'servis' | 'bakim' | 'diger';
  work_type_other?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_date?: string;
  scheduled_time?: string;
  assigned_to: string[]; // UUID[]
  description?: string;
  notes?: string;
  amount?: number;
  currency: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;
}

// Work Order Detail (with joins)
interface WorkOrderDetail extends WorkOrder {
  account_no?: string;
  site_name?: string;
  site_address: string;
  city?: string;
  district?: string;
  site_phone?: string;
  customer_id: string;
  company_name: string;
  customer_phone: string;
  assigned_workers: { id: string; name: string }[];
  materials?: WorkOrderMaterial[];
}

// Work Order Material
interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  material_id: string;
  quantity: number;
  notes?: string;
  // Joined
  material?: Material;
}
```

---

## Appendix B: Database View SQL (Reference)

```sql
CREATE OR REPLACE VIEW work_orders_detail AS
SELECT
  wo.id,
  wo.site_id,
  wo.form_no,
  wo.work_type,
  wo.work_type_other,
  wo.status,
  wo.priority,
  wo.scheduled_date,
  wo.scheduled_time,
  wo.assigned_to,
  wo.description,
  wo.notes,
  wo.amount,
  wo.currency,
  wo.created_by,
  wo.created_at,
  wo.updated_at,
  wo.completed_at,
  wo.cancelled_at,
  -- Site info
  s.account_no,
  s.site_name,
  s.address AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  s.panel_info,
  -- Customer info
  c.id AS customer_id,
  c.company_name,
  c.phone AS customer_phone,
  -- Assigned workers as JSON
  (
    SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.full_name)), '[]'::json)
    FROM profiles p
    WHERE p.id = ANY(wo.assigned_to)
  ) AS assigned_workers
FROM work_orders wo
JOIN customer_sites s ON wo.site_id = s.id
JOIN customers c ON s.customer_id = c.id;
```

---

**End of Implementation Plan**
