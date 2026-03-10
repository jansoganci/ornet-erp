# Proposal Site Selection - Optional Analysis

**Date:** February 10, 2026  
**Status:** Analysis Complete - Ready for Implementation  
**Goal:** Make `site_id` optional in proposal creation process

---

## Executive Summary

Making `site_id` optional in proposals requires changes across **database schema**, **views**, **validation schemas**, **UI components**, and **business logic**. The PDF generation already handles missing site data gracefully, but several other areas need updates to prevent crashes.

**Risk Level:** Medium - Requires careful migration and testing  
**Breaking Changes:** Yes - Existing queries using `proposals_detail` view will need updates

---

## 1. Database Constraints Analysis

### 1.1 Current State

**File:** `supabase/migrations/00027_proposals.sql`

```sql
CREATE TABLE proposals (
  ...
  site_id UUID NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,
  ...
);
```

**Findings:**
- ✅ `site_id` has `NOT NULL` constraint
- ✅ Foreign key constraint exists: `REFERENCES customer_sites(id) ON DELETE RESTRICT`
- ❌ Must be changed to allow `NULL` values

### 1.2 View Dependencies

**File:** `supabase/migrations/00030_proposals_detail_company_name.sql`

```sql
CREATE VIEW proposals_detail AS
SELECT
  ...
FROM proposals p
JOIN customer_sites cs ON cs.id = p.site_id  -- INNER JOIN - will exclude NULL site_id rows
JOIN customers c ON c.id = cs.customer_id;
```

**Critical Issue:**
- ❌ Uses `INNER JOIN` - proposals with `NULL site_id` will be **completely excluded** from view
- ❌ All API calls use `proposals_detail` view - missing proposals will cause data loss
- ❌ Must change to `LEFT JOIN` to include proposals without sites

**Impact:**
- `fetchProposals()` - Will not return proposals without sites
- `fetchProposal(id)` - Will return `null` for proposals without sites (404-like behavior)
- List page - Proposals without sites won't appear
- Detail page - Will show error state for proposals without sites

---

## 2. Code Dependencies Analysis

### 2.1 Validation Schema

**File:** `src/features/proposals/schema.js` (Line 23)

```javascript
export const proposalSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')), // ❌ Required
  ...
});
```

**Required Changes:**
- Make `site_id` optional: `z.string().optional().nullable()`
- Update default value: `site_id: null` instead of `site_id: ''`

### 2.2 Form Component

**File:** `src/features/proposals/ProposalFormPage.jsx`

**Current Implementation:**
- Line 152: Hidden input for `site_id`
- Line 156-164: `CustomerSiteSelector` component (requires selection)
- Line 163: Shows error if `site_id` is missing

**Required Changes:**
- Make `CustomerSiteSelector` optional (allow no selection)
- Remove validation error display when `site_id` is empty
- Update form to handle `null` site_id

### 2.3 Detail Page

**File:** `src/features/proposals/ProposalDetailPage.jsx`

**Current Implementation:**
- Line 478-507: Site info card (shows `site_name`, `site_address`, `account_no`)
- Line 392: Creates work order with `siteId: proposal.site_id` (will fail if null)
- Line 160: Breadcrumb uses `proposal.customer_id` (comes from view, will be null if no site)

**Required Changes:**
- Conditionally render site info card only if `proposal.site_id` exists
- Disable "Add Work Order" button if `site_id` is null (or require site selection first)
- Handle missing `customer_id` in breadcrumbs gracefully

### 2.4 List Page

**File:** `src/features/proposals/ProposalsListPage.jsx`

**Current Implementation:**
- Line 124-127: Shows `customer_company_name` and `site_name`
- Already handles missing `site_name` conditionally ✅

**Required Changes:**
- Handle missing `customer_company_name` (will be null if no site)
- Show fallback text when no customer/site info available

### 2.5 PDF Generation

**File:** `src/features/proposals/components/ProposalPdf.jsx`

**Current Implementation:**
- Line 316-325: Conditionally renders customer/site info
- Uses `safeStr()` helper - already handles null gracefully ✅

**Status:** ✅ **No changes needed** - PDF already handles missing site data

### 2.6 Work Order Creation

**File:** `src/features/proposals/ProposalDetailPage.jsx` (Line 388-395)

```javascript
onClick={() => {
  const params = new URLSearchParams({
    proposalId: id,
    customerId: proposal.customer_id,  // ❌ Will be null if no site
    siteId: proposal.site_id,            // ❌ Will be null if no site
  });
  navigate(`/work-orders/new?${params.toString()}`);
}}
```

**File:** `src/features/workOrders/WorkOrderFormPage.jsx`

**Current Implementation:**
- Line 7: `site_id: z.string().min(1, ...)` - **Required** in work order schema
- Work orders **cannot** be created without a site

**Required Changes:**
- Disable "Add Work Order" button if proposal has no `site_id`
- Show message: "Site must be added to proposal before creating work orders"
- OR: Allow site selection during work order creation from proposal

---

## 3. API Functions Analysis

### 3.1 Fetch Functions

**File:** `src/features/proposals/api.js`

**Current Implementation:**
- `fetchProposals()` - Uses `proposals_detail` view (will exclude NULL site_id)
- `fetchProposal(id)` - Uses `proposals_detail` view (will return null for NULL site_id)

**Status:** ✅ **No code changes needed** - Fix view, API will work automatically

### 3.2 Create/Update Functions

**File:** `src/features/proposals/api.js`

**Current Implementation:**
- `createProposal()` - Inserts directly into `proposals` table
- `updateProposal()` - Updates directly into `proposals` table

**Required Changes:**
- Ensure `site_id` can be `null` in insert/update operations
- No validation needed - database constraint change handles this

---

## 4. Business Logic Analysis

### 4.1 Work Order Creation Flow

**Current Flow:**
1. Proposal created with site ✅
2. Proposal accepted ✅
3. Work orders created from proposal (requires site) ✅

**New Flow (with optional site):**
1. Proposal created **without** site ✅
2. Proposal accepted ✅
3. **Site must be added** before work orders can be created ❌
4. Work orders created from proposal ✅

**Required Changes:**
- Add validation: Cannot create work orders from proposal without site
- Add UI: "Add Site" button/modal in proposal detail page
- Update proposal form: Allow editing `site_id` even after creation

### 4.2 Proposal Acceptance Flow

**Question:** Can proposals be accepted without sites?

**Answer:** Yes - Business requirement states "Site can be added later when proposal is accepted"

**Required Changes:**
- No blocking validation needed
- Allow status changes regardless of site presence

---

## 5. Complete Change List

### 5.1 Database Changes

**New Migration:** `00032_make_proposal_site_optional.sql`

```sql
-- 1. Make site_id nullable
ALTER TABLE proposals 
  ALTER COLUMN site_id DROP NOT NULL;

-- 2. Update proposals_detail view to use LEFT JOIN
DROP VIEW IF EXISTS proposals_detail;

CREATE VIEW proposals_detail AS
SELECT
  p.id,
  p.proposal_no,
  p.site_id,
  p.title,
  p.notes,
  p.scope_of_work,
  p.currency,
  p.total_amount_usd,
  p.status,
  p.created_by,
  p.created_at,
  p.sent_at,
  p.accepted_at,
  p.rejected_at,
  p.updated_at,
  p.company_name,
  p.survey_date,
  p.authorized_person,
  p.installation_date,
  p.customer_representative,
  p.completion_date,
  p.discount_percent,
  p.terms_engineering,
  p.terms_pricing,
  p.terms_warranty,
  p.terms_other,
  p.terms_attachments,
  -- Site info (nullable)
  cs.site_name,
  cs.address AS site_address,
  cs.account_no,
  -- Customer info (nullable if no site)
  c.id AS customer_id,
  c.company_name AS customer_company_name,
  c.phone AS customer_phone,
  -- Work order counts
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete
FROM proposals p
LEFT JOIN customer_sites cs ON cs.id = p.site_id  -- Changed to LEFT JOIN
LEFT JOIN customers c ON c.id = cs.customer_id;   -- Changed to LEFT JOIN

GRANT SELECT ON proposals_detail TO authenticated;
```

**Files to Create:**
- `supabase/migrations/00032_make_proposal_site_optional.sql`

### 5.2 Schema Changes

**File:** `src/features/proposals/schema.js`

**Changes:**
```javascript
// Line 23: Change from required to optional
site_id: z.string().optional().nullable(),

// Line 78: Change default value
site_id: null,  // Instead of ''
```

**Files to Modify:**
- `src/features/proposals/schema.js`

### 5.3 Form Component Changes

**File:** `src/features/proposals/ProposalFormPage.jsx`

**Changes:**
1. Remove validation error display (line 163) - site selection is optional
2. Update `CustomerSiteSelector` to allow empty selection
3. Handle `null` site_id in form reset (line 80)

**Files to Modify:**
- `src/features/proposals/ProposalFormPage.jsx`
- `src/features/workOrders/CustomerSiteSelector.jsx` (if needed for optional mode)

### 5.4 Detail Page Changes

**File:** `src/features/proposals/ProposalDetailPage.jsx`

**Changes:**
1. **Line 469-508:** Conditionally render site info card only if `proposal.site_id` exists
2. **Line 160:** Handle missing `customer_id` in breadcrumbs (show proposal title only)
3. **Line 388-395:** Disable "Add Work Order" button if `proposal.site_id` is null, show tooltip/message
4. **Line 99:** Handle missing `customer_id` when populating form

**Files to Modify:**
- `src/features/proposals/ProposalDetailPage.jsx`

### 5.5 List Page Changes

**File:** `src/features/proposals/ProposalsListPage.jsx`

**Changes:**
1. **Line 124:** Handle missing `customer_company_name` (show fallback: "No Customer" or proposal title)
2. **Line 125:** Already handles missing `site_name` ✅

**Files to Modify:**
- `src/features/proposals/ProposalsListPage.jsx`

### 5.6 Work Order Form Changes

**File:** `src/features/workOrders/WorkOrderFormPage.jsx`

**Changes:**
1. **Line 44-45:** Handle missing `prefilledSiteId` from URL params (allow empty)
2. **Line 71:** Don't prefill site if `prefilledSiteId` is empty/null

**Note:** Work orders still require `site_id` - this is intentional. Users must add site to proposal first.

**Files to Modify:**
- `src/features/workOrders/WorkOrderFormPage.jsx` (minor - handle null prefills)

---

## 6. Potential Risks & Breaking Changes

### 6.1 High Risk Areas

1. **View Query Results**
   - **Risk:** Existing queries expecting `customer_id` and `site_name` may break
   - **Mitigation:** All display code already uses conditional rendering ✅
   - **Testing:** Verify list, detail, and PDF generation with NULL site_id

2. **Work Order Creation**
   - **Risk:** Users try to create work orders from proposals without sites
   - **Mitigation:** Disable button + show clear message
   - **Testing:** Verify button is disabled and message is clear

3. **Breadcrumb Navigation**
   - **Risk:** Missing `customer_id` breaks breadcrumb links
   - **Mitigation:** Handle null `customer_id` gracefully
   - **Testing:** Verify breadcrumbs work with/without site

### 6.2 Medium Risk Areas

1. **Form Editing**
   - **Risk:** Editing existing proposals with sites might accidentally clear site_id
   - **Mitigation:** Form validation prevents accidental clearing
   - **Testing:** Verify site_id persists when editing other fields

2. **Search/Filter**
   - **Risk:** Searching by customer name won't find proposals without sites
   - **Mitigation:** This is expected behavior - proposals without sites won't have customer names
   - **Testing:** Verify search works correctly

### 6.3 Low Risk Areas

1. **PDF Generation**
   - **Status:** ✅ Already handles missing data gracefully
   - **Testing:** Verify PDF renders correctly with NULL site_id

2. **Status Changes**
   - **Status:** ✅ No dependencies on site_id
   - **Testing:** Verify status changes work regardless of site presence

---

## 7. Step-by-Step Implementation Plan

### Phase 1: Database Migration (Critical - Do First)

1. ✅ Create migration file: `00032_make_proposal_site_optional.sql`
2. ✅ Run migration in development
3. ✅ Test view queries return proposals with NULL site_id
4. ✅ Verify existing proposals still work correctly

### Phase 2: Schema & Validation (Critical)

1. ✅ Update `proposalSchema` - make `site_id` optional
2. ✅ Update `proposalDefaultValues` - set `site_id: null`
3. ✅ Test form validation allows empty site_id
4. ✅ Test form validation still works for other fields

### Phase 3: UI Components (High Priority)

1. ✅ Update `ProposalFormPage` - make site selection optional
2. ✅ Update `ProposalDetailPage` - handle missing site gracefully
3. ✅ Update `ProposalsListPage` - handle missing customer/site
4. ✅ Add "Add Site" functionality to detail page (if needed)
5. ✅ Disable work order creation when site is missing

### Phase 4: Business Logic (Medium Priority)

1. ✅ Update work order creation flow - require site before creation
2. ✅ Add validation messages for missing site
3. ✅ Test complete flow: Create proposal → Accept → Add site → Create work order

### Phase 5: Testing & Validation (Critical)

1. ✅ Test creating proposal without site
2. ✅ Test editing proposal to add site later
3. ✅ Test PDF generation with missing site
4. ✅ Test work order creation blocked when site missing
5. ✅ Test work order creation allowed after site added
6. ✅ Test existing proposals still work correctly
7. ✅ Test search/filter with proposals without sites

---

## 8. Testing Checklist

### 8.1 Create Proposal Without Site
- [ ] Form allows empty site selection
- [ ] Validation passes without site
- [ ] Proposal saves successfully
- [ ] Proposal appears in list
- [ ] Proposal detail page loads correctly
- [ ] PDF generates correctly

### 8.2 Edit Proposal to Add Site
- [ ] Form allows selecting site for existing proposal
- [ ] Site selection saves correctly
- [ ] Detail page shows site info after adding
- [ ] Work order creation becomes available

### 8.3 Work Order Creation
- [ ] Button disabled when site is missing
- [ ] Clear message shown when disabled
- [ ] Button enabled after site added
- [ ] Work order creation works correctly

### 8.4 Existing Proposals
- [ ] All existing proposals still load correctly
- [ ] Site info displays correctly
- [ ] No regressions in functionality

---

## 9. Additional Considerations

### 9.1 User Experience

**Question:** How do users know they need to add a site before creating work orders?

**Recommendation:**
- Show clear message in proposal detail: "Site required to create work orders"
- Disable "Add Work Order" button with tooltip
- Add "Add Site" button prominently displayed

### 9.2 Data Migration

**Question:** Do we need to migrate existing proposals?

**Answer:** No - All existing proposals have sites. Migration only affects new proposals.

### 9.3 Future Enhancements

**Potential Features:**
1. Bulk site assignment for multiple proposals
2. Site suggestions based on customer name
3. Quick site creation from proposal form
4. Site validation before proposal acceptance (optional)

---

## 10. Summary

**Total Files to Modify:** 6
- Database: 1 migration file (new)
- Schema: 1 file
- Components: 4 files

**Total Files to Create:** 1
- Migration: `00032_make_proposal_site_optional.sql`

**Risk Level:** Medium
- Database changes are reversible
- UI changes are additive (don't break existing functionality)
- Requires thorough testing

**Estimated Implementation Time:** 2-3 hours
- Database migration: 30 min
- Schema updates: 15 min
- UI updates: 1-1.5 hours
- Testing: 30-45 min

---

## 11. Next Steps

1. ✅ **Review this analysis** - Confirm approach and identify any missed dependencies
2. ⏳ **Create migration file** - Database changes first
3. ⏳ **Update schema** - Validation changes
4. ⏳ **Update UI components** - Form, detail, list pages
5. ⏳ **Test thoroughly** - All scenarios covered
6. ⏳ **Deploy** - Staged rollout recommended

---

**Status:** ✅ Analysis Complete - Ready for Implementation
