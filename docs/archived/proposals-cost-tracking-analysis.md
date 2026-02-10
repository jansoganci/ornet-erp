# Proposal Cost Tracking - Analysis & Recommendations

**Date:** February 10, 2026  
**Status:** Analysis Complete - Ready for Implementation

---

## Current State Analysis

### 1. Database Schema (`00027_proposals.sql`)

**Current `proposal_items` table columns:**
```sql
- id (UUID)
- proposal_id (UUID)
- sort_order (INT)
- description (TEXT)
- quantity (DECIMAL)
- unit (TEXT)
- unit_price_usd (DECIMAL) -- Customer-facing
- total_usd (GENERATED) -- Customer-facing
- cost_usd (DECIMAL) -- ❌ Single cost field (not used in UI)
- margin_percent (DECIMAL) -- ❌ Not used in UI
```

**Findings:**
- ✅ Cost fields exist in database but are **NOT displayed in UI**
- ✅ PDF correctly excludes cost fields (customer-facing only)
- ❌ Single `cost_usd` field is too limiting (can't track product vs labor vs other)
- ❌ Cost fields not accessible in form UI

### 2. UI Components

**`ProposalItemsEditor.jsx`:**
- Shows: description, quantity, unit, unit_price_usd, total
- Missing: All cost fields
- Desktop: Table layout with 6 columns
- Mobile: Card layout with stacked fields

**`ProposalDetailPage.jsx`:**
- Shows: Items list with customer-facing fields only
- Missing: Cost summary, profit margin display

### 3. API Functions (`api.js`)

**Current handling:**
- `createProposal()` - Handles `cost_usd` and `margin_percent` (lines 89-90)
- `updateProposalItems()` - Handles `cost_usd` and `margin_percent` (lines 152-153)
- ✅ API already structured to handle cost fields

### 4. Schema Validation (`schema.js`)

**Current:**
```javascript
cost_usd: z.coerce.number().min(0).optional().nullable()
margin_percent: z.coerce.number().min(0).max(100).optional().nullable()
```

---

## Recommendations

### ✅ RECOMMENDATION 1: Database Schema

**Add three separate cost columns to `proposal_items` table:**

```sql
-- Migration: 00029_add_proposal_cost_tracking.sql

ALTER TABLE proposal_items
  ADD COLUMN product_cost_usd DECIMAL(12,2),
  ADD COLUMN labor_cost_usd DECIMAL(12,2),
  ADD COLUMN other_costs_usd DECIMAL(12,2);

-- Keep cost_usd for backward compatibility (can be deprecated later)
-- Keep margin_percent (can be calculated: (revenue - total_cost) / revenue * 100)
```

**Why add columns instead of separate table?**
- ✅ Simpler queries (no joins needed)
- ✅ Cost is inherently part of each item
- ✅ Better performance for cost calculations
- ✅ Easier to maintain data consistency
- ❌ Separate table would be overkill for 3 fields

**Decision: Add columns to `proposal_items` table** ✅

---

### ✅ RECOMMENDATION 2: UI Placement

**Desktop View:**
- Add cost fields in an **expandable/collapsible section** below each item row
- OR add cost columns in a separate "Cost Tracking" section (collapsed by default)
- Visual separator: Light background, border-top, "Internal Costs" label

**Mobile View:**
- Show cost fields in a collapsible section below customer-facing fields
- Use accordion pattern: "📊 Maliyet Takibi" (Cost Tracking)

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ Customer-Facing Fields (always visible) │
│ - Description, Qty, Unit, Price, Total   │
├─────────────────────────────────────────┤
│ 🔽 Internal Cost Tracking (expandable)  │
│ - Product Cost                           │
│ - Labor Cost                             │
│ - Other Costs                            │
│ - Total Cost (calculated)                │
│ - Margin % (calculated)                  │
└─────────────────────────────────────────┘
```

**Decision: Expandable section below each item** ✅

---

### ✅ RECOMMENDATION 3: Proposal-Level Cost Summary

**Add cost summary card on `ProposalDetailPage.jsx`:**

**New stat card showing:**
- Total Product Costs: $X,XXX.XX
- Total Labor Costs: $X,XXX.XX
- Total Other Costs: $X,XXX.XX
- **Total Costs: $X,XXX.XX**
- **Total Revenue: $X,XXX.XX** (existing)
- **Profit Margin: XX.X%** (calculated)

**Placement:**
- Add as 4th stat card in the stat cards row
- OR add as separate "Financial Summary" card below items table

**Decision: Add as 4th stat card + separate Financial Summary card** ✅

---

### ✅ RECOMMENDATION 4: Schema & API Updates

**Update `schema.js`:**
```javascript
export const proposalItemSchema = z.object({
  description: z.string().min(1, ...),
  quantity: z.coerce.number().positive(),
  unit: z.string().default('adet'),
  unit_price_usd: z.coerce.number().min(0),
  // NEW: Three separate cost fields
  product_cost_usd: z.coerce.number().min(0).optional().nullable(),
  labor_cost_usd: z.coerce.number().min(0).optional().nullable(),
  other_costs_usd: z.coerce.number().min(0).optional().nullable(),
  // Keep for backward compatibility (deprecated)
  cost_usd: z.coerce.number().min(0).optional().nullable(),
  margin_percent: z.coerce.number().min(0).max(100).optional().nullable(),
});
```

**Update `api.js`:**
- Update `createProposal()` to handle new cost fields
- Update `updateProposalItems()` to handle new cost fields
- Calculate `margin_percent` automatically if not provided

---

## Implementation Plan

### Phase 1: Database Migration
1. Create migration `00029_add_proposal_cost_tracking.sql`
2. Add three new columns to `proposal_items`
3. Test migration on dev database

### Phase 2: Schema & API Updates
1. Update `schema.js` with new cost fields
2. Update `api.js` functions to handle new fields
3. Update default values in `schema.js`

### Phase 3: UI Components
1. Update `ProposalItemsEditor.jsx`:
   - Add expandable cost section for desktop
   - Add accordion cost section for mobile
   - Add cost input fields
   - Calculate total cost and margin
2. Update `ProposalDetailPage.jsx`:
   - Add cost summary stat card
   - Add financial summary card
   - Calculate proposal-level totals

### Phase 4: Translations
1. Add cost-related translations to `locales/tr/proposals.json`:
   - `items.costTracking`
   - `items.productCost`
   - `items.laborCost`
   - `items.otherCosts`
   - `items.totalCost`
   - `items.margin`
   - `detail.costSummary`
   - `detail.profitMargin`

### Phase 5: Testing
1. Test cost input in form
2. Test cost calculations
3. Verify PDF still excludes cost fields
4. Test proposal-level cost summary

---

## Questions Answered

### Q1: Check current proposal_items table schema - what columns exist?
**A:** See "Current State Analysis" section above. Current columns include `cost_usd` (single field) and `margin_percent`, but they're not used in UI.

### Q2: Should I add cost columns to proposal_items table, or create separate proposal_costs table?
**A:** ✅ **Add columns to `proposal_items` table**
- Simpler queries (no joins)
- Better performance
- Cost is inherently part of each item
- Easier data consistency

### Q3: Where in the UI should cost input fields appear?
**A:** ✅ **Expandable section below each item in the form**
- Desktop: Collapsible row section
- Mobile: Accordion below customer fields
- Visual separator to distinguish internal costs
- Keep customer-facing fields always visible

### Q4: Do we need cost summary at proposal level?
**A:** ✅ **Yes, add cost summary**
- Add 4th stat card showing total costs
- Add financial summary card with:
  - Total Product/Labor/Other Costs
  - Total Costs
  - Total Revenue
  - Profit Margin %

---

## Next Steps

1. ✅ Review this analysis
2. ⏳ Create database migration
3. ⏳ Update schema & API
4. ⏳ Update UI components
5. ⏳ Add translations
6. ⏳ Test implementation

---

## Notes

- **Backward Compatibility:** Keep `cost_usd` column for now (can migrate existing data later)
- **PDF:** Cost fields should NEVER appear in PDF (already correct)
- **Permissions:** Cost fields visible to admin/accountant roles (same as proposal editing)
- **Calculations:** 
  - Total Cost = product_cost + labor_cost + other_costs
  - Margin % = (revenue - total_cost) / revenue * 100
  - Profit = revenue - total_cost
