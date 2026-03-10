# Proposal PDF Redesign - Implementation Plan

**Date:** February 10, 2026  
**Based on:** ORNEK TEKLIF FORMU 010724.pdf template

---

## Analysis of Current ProposalPdf.jsx

### Current Structure:
1. ✅ Basic header with date, title, customer name, site info
2. ✅ Scope of work section
3. ✅ Items table (description, quantity, unit price, total)
4. ✅ Grand total
5. ✅ Simple footer

### Missing Elements (from PDF template):
1. ❌ Company logo (top-left)
2. ❌ Company contact info (top-right: web, email, phone)
3. ❌ 8 header fields:
   - FİRMA ADI (Company Name)
   - KEŞİF TARİHİ (Survey Date)
   - YETKİLİ KİŞİ (Authorized Person)
   - TEKLİF TARİHİ (Proposal Date)
   - PROJE ADI (Project Name)
   - MONTAJ TARİHİ (Installation Date)
   - MÜŞTERİ TEMSİLCİSİ (Customer Representative)
   - BİTİŞ TARİHİ (Completion Date)
4. ❌ Terms/conditions sections (5 sections)
5. ❌ Signature/approval box
6. ❌ Bank account information (needs to be REMOVED)

---

## Required Changes

### 1. Database Schema Changes

#### Migration: `00029_proposal_cost_tracking_and_terms.sql`

**Add to `proposal_items`:**
```sql
ALTER TABLE proposal_items
  ADD COLUMN product_cost_usd DECIMAL(12,2),
  ADD COLUMN labor_cost_usd DECIMAL(12,2),
  ADD COLUMN shipping_cost_usd DECIMAL(12,2),
  ADD COLUMN material_cost_usd DECIMAL(12,2),
  ADD COLUMN misc_cost_usd DECIMAL(12,2);
```

**Add to `proposals`:**
```sql
ALTER TABLE proposals
  ADD COLUMN company_logo_url TEXT,
  ADD COLUMN survey_date DATE,
  ADD COLUMN authorized_person TEXT,
  ADD COLUMN installation_date DATE,
  ADD COLUMN customer_representative TEXT,
  ADD COLUMN completion_date DATE,
  ADD COLUMN terms_engineering TEXT DEFAULT 'Mühendislik hizmetleri...',
  ADD COLUMN terms_pricing TEXT DEFAULT 'Fiyatlandırma...',
  ADD COLUMN terms_warranty TEXT DEFAULT 'Garanti...',
  ADD COLUMN terms_other TEXT DEFAULT 'Diğer şartlar...',
  ADD COLUMN terms_attachments TEXT DEFAULT 'Ekler...';
```

**Company info storage options:**
- Option A: Store in `proposals` table (per-proposal customization)
- Option B: Store in settings/config table (global)
- **Decision: Option A** - allows per-proposal customization

---

### 2. UI Form Updates (`ProposalFormPage.jsx`)

**New sections to add:**

1. **Company Info Section** (collapsible):
   - Logo upload (Supabase Storage)
   - Company name
   - Website
   - Email
   - Phone

2. **Header Fields Section**:
   - Survey Date
   - Authorized Person
   - Installation Date
   - Customer Representative
   - Completion Date

3. **Cost Tracking** (expandable under each item):
   - Product Cost
   - Labor Cost
   - Shipping Cost
   - Material Cost
   - Misc Cost
   - Total Cost (calculated)
   - Margin % (calculated)

4. **Terms & Conditions Editor** (collapsible):
   - Engineering Terms
   - Pricing Terms
   - Warranty Terms
   - Other Terms
   - Attachments Terms

---

### 3. PDF Component Updates (`ProposalPdf.jsx`)

**New layout structure:**

```
┌─────────────────────────────────────────────────┐
│ [LOGO]          Company Contact Info            │
│                  Web: www.example.com           │
│                  Email: info@example.com        │
│                  Phone: +90 XXX XXX XX XX       │
├─────────────────────────────────────────────────┤
│ Header Fields Grid (2 columns x 4 rows):        │
│ FİRMA ADI | KEŞİF TARİHİ                        │
│ YETKİLİ KİŞİ | TEKLİF TARİHİ                    │
│ PROJE ADI | MONTAJ TARİHİ                       │
│ MÜŞTERİ TEMSİLCİSİ | BİTİŞ TARİHİ               │
├─────────────────────────────────────────────────┤
│ Scope of Work                                    │
├─────────────────────────────────────────────────┤
│ Items Table                                      │
├─────────────────────────────────────────────────┤
│ Terms Sections (5 sections)                      │
├─────────────────────────────────────────────────┤
│ Signature/Approval Box                          │
└─────────────────────────────────────────────────┘
```

**Required changes:**
1. Add Image component for logo
2. Add company contact info section (top-right)
3. Add header fields grid
4. Add terms sections (5 sections)
5. Add signature box
6. Remove bank account section (if exists)

---

### 4. File Upload Implementation

**Supabase Storage bucket:**
- Bucket name: `proposal-logos`
- Public access: Yes (for PDF rendering)
- File path: `{proposal_id}/{filename}`

**Upload component:**
- Use `@supabase/storage-js` (already installed)
- Upload on form submit or on file select
- Store URL in `proposals.company_logo_url`

---

## Implementation Steps

### Phase 1: Database Migration
1. Create migration file
2. Add cost columns to `proposal_items`
3. Add terms columns to `proposals`
4. Add header date fields to `proposals`
5. Add company info fields to `proposals`

### Phase 2: Schema & API Updates
1. Update `schema.js` with new fields
2. Update `api.js` to handle new fields
3. Add logo upload function to `api.js`

### Phase 3: UI Form Updates
1. Add logo upload component
2. Add company info section
3. Add header fields section
4. Update `ProposalItemsEditor` with cost fields (expanded by default)
5. Add terms editor section

### Phase 4: PDF Component Updates
1. Add logo rendering
2. Add company contact info
3. Add header fields grid
4. Add terms sections
5. Add signature box
6. Remove bank account section

### Phase 5: Translations
1. Add all new field labels
2. Add terms section labels
3. Add cost field labels

---

## Default Terms Text (from PDF template)

**Note:** User should provide actual default text from PDF. Placeholder values:

- `terms_engineering`: "Mühendislik hizmetleri..."
- `terms_pricing`: "Fiyatlandırma..."
- `terms_warranty`: "Garanti..."
- `terms_other`: "Diğer şartlar..."
- `terms_attachments`: "Ekler..."

---

## File Structure

```
src/features/proposals/
├── api.js (update)
├── schema.js (update)
├── hooks.js (update)
├── ProposalFormPage.jsx (update)
├── ProposalDetailPage.jsx (update)
└── components/
    ├── ProposalPdf.jsx (major update)
    ├── ProposalItemsEditor.jsx (update - add cost fields)
    ├── LogoUpload.jsx (new)
    ├── TermsEditor.jsx (new)
    └── HeaderFieldsEditor.jsx (new)
```

---

## Next Steps

1. ✅ Create database migration
2. ⏳ Update schema.js
3. ⏳ Update api.js (add logo upload)
4. ⏳ Create LogoUpload component
5. ⏳ Create TermsEditor component
6. ⏳ Create HeaderFieldsEditor component
7. ⏳ Update ProposalItemsEditor (cost fields)
8. ⏳ Update ProposalFormPage (add new sections)
9. ⏳ Update ProposalPdf.jsx (complete redesign)
10. ⏳ Add translations
