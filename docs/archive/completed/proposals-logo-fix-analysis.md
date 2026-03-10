# Proposal Logo Implementation - Analysis & Fix Proposal

**Date:** February 10, 2026  
**Problem:** Logo should be static (not per-proposal), but currently stored in database

---

## Current State Analysis

### 1. Database Schema

**Migration `00029_proposal_cost_terms_logo.sql` (line 18):**
```sql
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
```

**Status:** ❌ **WRONG** - Logo URL stored per proposal in database

**Impact:**
- Each proposal can have a different logo (not desired)
- Requires logo upload/storage per proposal
- Logo should be static company branding

---

### 2. Current Implementation

**ProposalPdf.jsx (lines 284-290):**
```jsx
{/* Logo (top-left) */}
<View style={styles.topRow}>
  <View style={styles.logoWrap}>
    {safeStr(prop.logo_url) && (
      <Image src={prop.logo_url} style={styles.logo} />
    )}
  </View>
</View>
```

**Status:** Uses `prop.logo_url` from database (per-proposal)

**ProposalFormPage.jsx (lines 207-212):**
```jsx
<Input
  label={t('proposals:form.fields.logoUrl')}
  placeholder={t('proposals:form.placeholders.logoUrl')}
  error={errors.logo_url?.message}
  {...register('logo_url')}
/>
```

**Status:** Has logo URL input field (should be removed)

---

### 3. Static Logo Files Location

**Current location (project root):**
- `/Users/jans./Downloads/Projelerim/ornet-erp/ornet.logo.png` - Company logo with contact info (top-left)
- `/Users/jans./Downloads/Projelerim/ornet-erp/falan.png` - Certifications/icons (top-right)

**Status:** Files exist but not in proper asset location

---

### 4. @react-pdf/renderer Image Component

**Research findings:**
- `Image` component accepts:
  - **URLs** (HTTP/HTTPS) ✅
  - **Data URIs** (base64) ✅
  - **Public directory paths** (e.g., `/image.png`) ✅
- Does **NOT** support direct filesystem paths ❌
- Does **NOT** support `import` statements from `src/` ❌

**For static assets:**
- Files in `public/` folder are served at root path (`/filename.png`)
- Can be referenced as `/ornet.logo.png` if file is in `public/`
- Works in both dev and production builds

---

## Proposed Solution

### Option A: Public Directory (Recommended)

**Approach:** Move logo files to `public/` and reference via absolute paths

**Steps:**

1. **Move logo files:**
   ```
   ornet.logo.png → public/ornet.logo.png
   falan.png → public/falan.png
   ```

2. **Update ProposalPdf.jsx:**
   ```jsx
   {/* Logo (top-left) */}
   <View style={styles.topRow}>
     <View style={styles.logoWrap}>
       <Image src="/ornet.logo.png" style={styles.logo} />
     </View>
     {/* Certifications/icons (top-right) */}
     <View style={styles.certWrap}>
       <Image src="/falan.png" style={styles.cert} />
     </View>
   </View>
   ```

3. **Remove from database:**
   - Create migration to drop `logo_url` column
   - Remove from schema.js
   - Remove from ProposalFormPage.jsx
   - Remove from api.js (if any references)
   - Update i18n (remove logo-related keys)

4. **Update styles:**
   ```jsx
   topRow: {
     flexDirection: 'row',
     justifyContent: 'space-between', // Logo left, certs right
     alignItems: 'flex-start',
     marginBottom: 20,
   },
   logoWrap: {
     width: 120,
     height: 50,
   },
   logo: {
     width: 120,
     height: 50,
     objectFit: 'contain',
   },
   certWrap: {
     width: 80, // Adjust based on falan.png dimensions
     height: 50,
   },
   cert: {
     width: 80,
     height: 50,
     objectFit: 'contain',
   },
   ```

**Pros:**
- ✅ Simple - just move files and update paths
- ✅ Works in dev and production
- ✅ No build-time processing needed
- ✅ Standard Vite/public folder pattern

**Cons:**
- ⚠️ Files are publicly accessible (acceptable for logos)

---

### Option B: Base64 Embedding (Not Recommended)

**Approach:** Convert PNGs to base64 strings and embed in code

**Steps:**
1. Convert `ornet.logo.png` and `falan.png` to base64
2. Store as constants in ProposalPdf.jsx
3. Use data URIs: `src="data:image/png;base64,..."`

**Pros:**
- ✅ No file dependencies
- ✅ Works offline

**Cons:**
- ❌ Large base64 strings in code (harder to maintain)
- ❌ Not maintainable (can't swap logos easily)
- ❌ Increases bundle size

**Verdict:** ❌ Not recommended

---

### Option C: Import via Vite (Doesn't Work)

**Approach:** Try `import logo from '../assets/ornet.logo.png'`

**Problem:**
- @react-pdf/renderer runs in Node.js context (server-side PDF generation)
- Vite imports return URLs like `/src/assets/logo.png` which don't resolve in PDF context
- Image component needs actual file paths or URLs

**Verdict:** ❌ Doesn't work for PDF generation

---

## Recommended Implementation Plan

### Phase 1: Move Logo Files
1. Move `ornet.logo.png` → `public/ornet.logo.png`
2. Move `falan.png` → `public/falan.png`
3. Verify files are accessible at `/ornet.logo.png` and `/falan.png` in browser

### Phase 2: Update ProposalPdf.jsx
1. Remove `prop.logo_url` check
2. Add static Image components:
   - Left: `/ornet.logo.png`
   - Right: `/falan.png`
3. Update `topRow` style to `justifyContent: 'space-between'`
4. Add `certWrap` and `cert` styles

### Phase 3: Remove logo_url from Database & Code
1. **Migration:** Create `00031_remove_proposal_logo_url.sql`:
   ```sql
   -- Drop logo_url column from proposals table
   ALTER TABLE proposals DROP COLUMN IF EXISTS logo_url;
   
   -- Update proposals_detail view to remove logo_url reference
   CREATE OR REPLACE VIEW proposals_detail AS
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
     -- logo_url removed here
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
     cs.site_name,
     cs.address AS site_address,
     cs.account_no,
     c.id AS customer_id,
     c.company_name AS customer_company_name,
     c.phone AS customer_phone,
     (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
     (SELECT bool_and(wo.status = 'completed')
        FROM proposal_work_orders pwo
        JOIN work_orders wo ON wo.id = pwo.work_order_id
       WHERE pwo.proposal_id = p.id
     ) AS all_installations_complete
   FROM proposals p
   JOIN customer_sites cs ON cs.id = p.site_id
   JOIN customers c ON c.id = cs.customer_id;
   ```
2. **schema.js:** Remove `logo_url` field (line 29)
3. **ProposalFormPage.jsx:** Remove logo URL input field (lines 207-212) and remove from reset() (line 84)
4. **api.js:** Check for logo_url references (none found in create/update, but verify)
5. **i18n:** Remove `form.fields.logoUrl` and `form.placeholders.logoUrl` from proposals.json

---

## File Changes Summary

| File | Action | Change |
|------|--------|--------|
| `ornet.logo.png` | Move | Root → `public/ornet.logo.png` |
| `falan.png` | Move | Root → `public/falan.png` |
| `ProposalPdf.jsx` | Update | Use static `/ornet.logo.png` and `/falan.png` paths, remove `prop.logo_url` check |
| `00031_remove_proposal_logo_url.sql` | Create | Drop `logo_url` column + update view |
| `schema.js` | Update | Remove `logo_url` field (line 29) |
| `ProposalFormPage.jsx` | Update | Remove logo URL input section (lines 207-212) and from reset() (line 84) |
| `locales/tr/proposals.json` | Update | Remove `form.fields.logoUrl` and `form.placeholders.logoUrl` |

---

## Questions to Resolve

1. **Logo dimensions:** What are the actual dimensions of `ornet.logo.png` and `falan.png`? (affects style sizing)
2. **falan.png purpose:** Is this always shown, or conditional? (affects rendering logic)
3. **Logo positioning:** Should logos be:
   - Always visible (current plan)
   - Conditional (only if files exist)
   - Configurable per proposal (unlikely, but confirm)

---

## Next Steps

1. ✅ **Analysis complete** - This document outlines the fix
2. ⏳ **Await confirmation** - Review approach before implementation
3. ⏳ **Implement** - Move files, update code, remove database column

---

## Notes

- **Public folder:** Files in `public/` are copied to build output root
- **Path reference:** Use `/filename.png` (leading slash = root)
- **No import needed:** Direct string paths work for @react-pdf/renderer
- **Backward compatibility:** Existing proposals with `logo_url` will show static logo after fix (old data ignored)
