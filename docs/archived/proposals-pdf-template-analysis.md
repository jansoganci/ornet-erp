# Proposal PDF Template Analysis

**Date:** February 10, 2026  
**Template:** ORNEK TEKLIF FORMU 010724.pdf  
**Current Component:** `src/features/proposals/components/ProposalPdf.jsx`

---

## PDF Template Structure Analysis

### 1. **Top Header Section** (Missing in current PDF)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ [LOGO IMAGE]                                    │
│ (Contains company branding + contact info)     │
└─────────────────────────────────────────────────┘
```

**Required:**
- Company logo image (top-left, high resolution)
- Logo image file contains company branding and contact details (website, email, phone) embedded in the image
- User uploads a single logo image file per proposal
- Display logo image in top-left area of PDF

**Current State:** ❌ Not present

---

### 2. **Header Fields Grid** (Missing in current PDF)

**Layout:** 2-column grid, 4 rows

```
FİRMA ADI : [value]          KEŞİF TARİHİ : [date]
YETKİLİ KİŞİ : [name]        TEKLİF TARİHİ : [date]
PROJE ADI : [name]            MONTAJ TARİHİ : [date]
MÜŞTERİ TEMSİLCİSİ : [name]   BİTİŞ TARİHİ : [date]
```

**Fields Required:**
1. `company_name` (FİRMA ADI) - Company name
2. `survey_date` (KEŞİF TARİHİ) - Survey/inspection date
3. `authorized_person` (YETKİLİ KİŞİ) - Authorized person name
4. `proposal_date` (TEKLİF TARİHİ) - Proposal date (currently using `created_at`)
5. `project_name` (PROJE ADI) - Project name (currently using `title`)
6. `installation_date` (MONTAJ TARİHİ) - Installation date
7. `customer_representative` (MÜŞTERİ TEMSİLCİSİ) - Customer representative name
8. `completion_date` (BİTİŞ TARİHİ) - Completion date

**Current State:** ❌ Not present (only shows date, title, customer name, site info in simple format)

---

### 3. **Items Table** (Partially implemented)

**Template Columns:**
- Açıklama (Description)
- Birim (Unit)
- B.Fiyatı (Unit Price)
- Sıra (Sequence/Row number)
- Toplam (Total)

**Current Columns:**
- ✅ Açıklama (Description)
- ✅ Adet (Quantity)
- ✅ Birim (Unit)
- ✅ Birim Fiyat ($) (Unit Price)
- ✅ Toplam ($) (Total)
- ❌ Sıra (Sequence number) - Missing

**Current State:** ⚠️ Correct structure, just missing sequence numbers

---

### 4. **Terms & Conditions Sections** (Missing in current PDF)

**Template has 5 sections:**

1. **MÜHENDİSLİK HİZMETLERİ** (Engineering Services)
   - Content about internet requirements, remote access, etc.

2. **FİYATLANDIRMA** (Pricing)
   - Payment terms, cable pricing, TCMB exchange rate, VAT exclusion

3. **GARANTİ** (Warranty)
   - 24-month warranty on materials, warranty terms

4. **DİĞER** (Other)
   - Contract cancellation terms, installation scope, working hours

5. **EKLER** (Attachments)
   - List of attached documents

**Current State:** ❌ Not present

---

### 5. **Signature/Approval Box** (Missing in current PDF)

**Template shows:**
```
Teklifiniz uygun bulunmuştur
Kaşe / Ad soyad / İmza
[Signature area]
```

**Current State:** ❌ Not present

---

### 6. **Bank Account Information** (Present in template, needs REMOVAL)

**Template shows:**
```
BANKA HESAP BİLGİLERİ:
YAPIKREDİ IBAN: TR44 0006 7010 0000 0084 1625 20
İŞBANKASI IBAN: TR77 0006 4000 0011 1420 3319 87
GARANTİ IBAN: TR83 0006 2000 4000 0006 6811 09
```

**Requirement:** ❌ **REMOVE** - Should NOT appear in PDF

**Current State:** ✅ Not present (good)

---

### 7. **Footer** (Partially implemented)

**Template:** Page numbers (-- 1 of 3 --)

**Current:** Simple text footer "Ornet Güvenlik Sistemleri"

**Current State:** ⚠️ Present but different format

---

### 8. **Discount & Totals Section** (Missing in current PDF)

**Template shows after items table:**
```
Ara Toplam (Subtotal): $X,XXX.XX
İskonto Oranı (% Discount Rate): XX%
İskonto Tutarı (Discount Amount): $XXX.XX
Genel Toplam (Grand Total): $X,XXX.XX
```

**Required:**
- Display subtotal before discount
- Show discount percentage and amount
- Show final grand total after discount

**Current State:** ❌ Not present (only shows grand total without discount breakdown)

---

### 9. **Net Profit Display** (Missing in UI, not in PDF)

**Required in Proposal Detail Page UI:**
- Net Kar (Net Profit) = Grand Total - Total Costs
- Display as stat card alongside other financial metrics
- Calculate from: `grand_total - (sum of all cost fields per item)`

**Note:** This is INTERNAL only, never shown in customer-facing PDF

**Current State:** ❌ Not present

---

## Required Changes to ProposalPdf.jsx

### **Missing Components:**

1. ❌ **Image component** for logo rendering (single logo image file)
2. ❌ **Header fields grid** (8 fields in 2x4 grid)
3. ❌ **Terms sections** (5 sections with titles and content)
4. ❌ **Signature/approval box**
5. ❌ **Sequence numbers** in items table
6. ❌ **Discount & totals section** (subtotal, discount %, discount amount, grand total)

### **Current Components (Keep but may need adjustment):**

1. ✅ **Items table** - Keep but add sequence numbers
2. ✅ **Scope of work** - Keep as is
3. ✅ **Grand total** - Keep as is
4. ✅ **Page structure** - Keep but add multi-page support for terms

### **Layout Changes Required:**

1. **Top section:** Add logo image (top-left)
2. **Header fields:** Replace current simple header with 2x4 grid
3. **Items table:** Add "Sıra" column
4. **After items:** Add discount & totals section (subtotal, discount, grand total)
5. **After totals:** Add 5 terms sections
6. **Bottom:** Add signature box
7. **Remove:** Bank account section (if exists)

---

## Database Fields Needed

### **New fields in `proposals` table:**

```sql
-- Company logo (single image file containing branding + contact info)
logo_url TEXT

-- Header fields
company_name TEXT  -- FİRMA ADI
survey_date DATE  -- KEŞİF TARİHİ
authorized_person TEXT  -- YETKİLİ KİŞİ
installation_date DATE  -- MONTAJ TARİHİ
customer_representative TEXT  -- MÜŞTERİ TEMSİLCİSİ
completion_date DATE  -- BİTİŞ TARİHİ
-- Note: proposal_date uses created_at, project_name uses title

-- Discount
discount_percent DECIMAL(5,2)  -- İskonto Oranı (0-100)

-- Terms sections
terms_engineering TEXT  -- MÜHENDİSLİK HİZMETLERİ
terms_pricing TEXT  -- FİYATLANDIRMA
terms_warranty TEXT  -- GARANTİ
terms_other TEXT  -- DİĞER
terms_attachments TEXT  -- EKLER
```

### **New fields in `proposal_items` table:**

```sql
-- Cost tracking (INTERNAL ONLY - never shown in PDF)
-- Used to calculate Net Kar (Net Profit) for UI display
product_cost_usd DECIMAL(12,2)
labor_cost_usd DECIMAL(12,2)
shipping_cost_usd DECIMAL(12,2)
material_cost_usd DECIMAL(12,2)
misc_cost_usd DECIMAL(12,2)
```

---

## Summary of Required Changes

### **ProposalPdf.jsx Changes:**

| Component | Status | Action Required |
|-----------|--------|----------------|
| Logo rendering | ❌ Missing | Add `<Image>` component from @react-pdf/renderer (single logo_url) |
| Header fields grid | ❌ Missing | Replace simple header with 2x4 grid layout |
| Items table sequence | ❌ Missing | Add "Sıra" column with row numbers |
| Discount & totals | ❌ Missing | Add subtotal, discount %, discount amount, grand total |
| Terms sections (5) | ❌ Missing | Add all 5 terms sections after totals |
| Signature box | ❌ Missing | Add approval/signature section at bottom |
| Bank account info | ✅ Good | Ensure it's NOT included |
| Multi-page support | ⚠️ May need | Add if terms content is long |

### **Database Changes:**

| Table | Fields Needed | Purpose |
|-------|---------------|---------|
| `proposals` | 12 new fields | Logo URL, header fields (8), discount, terms (5) |
| `proposal_items` | 5 new cost fields | Internal cost tracking (not in PDF, for Net Kar calculation) |

### **Form UI Changes:**

| Component | Changes Needed |
|-----------|----------------|
| `ProposalFormPage` | Add logo image upload (single file), header fields editor, discount field, terms editor |
| `ProposalItemsEditor` | Add cost fields (expanded by default, internal only - never in PDF) |
| `ProposalDetailPage` | Add Net Kar (Net Profit) stat card = Grand Total - Total Costs |

---

## Next Steps (Analysis Only - No Implementation)

1. ✅ **Analysis complete** - This document lists all required changes
2. ⏳ **Await approval** - Review this analysis before implementation
3. ⏳ **Implementation** - Will proceed after approval
