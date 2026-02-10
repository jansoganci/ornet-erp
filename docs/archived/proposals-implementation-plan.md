# Proposals Module — Implementation Plan

**Date:** February 10, 2026  
**Status:** Analysis complete — ready for implementation  
**Template reference:** ORNEK TEKLIF FORMU 010724.pdf  
**Current component:** `src/features/proposals/components/ProposalPdf.jsx`

---

## 1. Current State

### 1.1 Database (`00027_proposals.sql`)

**`proposal_items`:**
- id, proposal_id, sort_order, description, quantity, unit, unit_price_usd, total_usd (GENERATED)
- cost_usd, margin_percent (present but not used in UI)

**`proposals`:**
- id, proposal_no, site_id, title, notes, scope_of_work, currency, total_amount_usd, status
- created_by, created_at, sent_at, accepted_at, rejected_at, updated_at

**Findings:**
- Cost fields exist in DB but are not in UI; PDF correctly excludes them.
- Single `cost_usd` is too coarse; need per-type cost tracking.
- No terms, header fields, logo, or discount in schema.

### 1.2 UI

- **ProposalItemsEditor:** description, quantity, unit, unit_price_usd, total — no cost fields.
- **ProposalDetailPage:** items and customer-facing data only — no cost summary or Net Kar.
- **ProposalFormPage:** no logo, header fields, discount, or terms editor.

### 1.3 API & schema

- `api.js` already handles `cost_usd` and `margin_percent`.
- `schema.js` has optional cost_usd and margin_percent; needs five cost fields and new proposal fields.

---

## 2. Database Schema (Single Source of Truth)

### 2.1 `proposals` — new columns

```sql
-- Logo (single image: branding + contact info)
logo_url TEXT

-- Header (8 fields for PDF)
company_name TEXT       -- FİRMA ADI
survey_date DATE        -- KEŞİF TARİHİ
authorized_person TEXT  -- YETKİLİ KİŞİ
installation_date DATE  -- MONTAJ TARİHİ
customer_representative TEXT  -- MÜŞTERİ TEMSİLCİSİ
completion_date DATE    -- BİTİŞ TARİHİ
-- proposal_date → created_at, project_name → title

-- Discount
discount_percent DECIMAL(5,2)  -- İskonto Oranı (0-100)

-- Terms (5 sections, editable)
terms_engineering TEXT   -- MÜHENDİSLİK HİZMETLERİ
terms_pricing TEXT       -- FİYATLANDIRMA
terms_warranty TEXT      -- GARANTİ
terms_other TEXT         -- DİĞER
terms_attachments TEXT   -- EKLER
```

### 2.2 `proposal_items` — new columns

```sql
-- Cost tracking: INTERNAL ONLY, never in PDF. Used for Net Kar in UI.
product_cost_usd DECIMAL(12,2)
labor_cost_usd DECIMAL(12,2)
shipping_cost_usd DECIMAL(12,2)
material_cost_usd DECIMAL(12,2)
misc_cost_usd DECIMAL(12,2)
```

**Why columns on `proposal_items`:**
- No extra joins; cost is per line item.
- Simpler and faster; one row per item.

---

## 3. Cost Tracking (Internal Only)

- **Stored per item:** product, labor, shipping, material, misc (all USD).
- **Never shown in PDF.**
- **Used in UI for:**
  - Total costs per proposal
  - **Net Kar (Net Profit)** = Grand Total (after discount) − Total Costs
  - Optional breakdown (product/labor/shipping/material/misc) on detail page.

**Calculations:**
- Item total cost = sum of the five cost fields (× quantity if stored per unit; clarify in implementation).
- Proposal total costs = sum of item total costs.
- Net Kar = proposal grand total (after discount) − total costs.
- Margin % = (revenue − total cost) / revenue × 100 (optional).

**UI placement (form):**
- Cost fields in an **expandable section below each item** (expanded by default).
- Desktop: collapsible row; mobile: accordion.
- Label: e.g. “Maliyet Takibi” (Internal), distinct from customer-facing fields.

**Detail page:**
- Net Kar as a stat card with other financial metrics.
- Optionally a small “Financial summary” card: total costs, revenue, Net Kar (and margin % if desired).

---

## 4. PDF Template Alignment (ProposalPdf.jsx)

### 4.1 Structure to implement

| Section | Status | Action |
|--------|--------|--------|
| Logo | ❌ Missing | Single image top-left from `logo_url` |
| Header grid | ❌ Missing | 2×4 grid: FİRMA ADI, KEŞİF TARİHİ, YETKİLİ KİŞİ, TEKLİF TARİHİ, PROJE ADI, MONTAJ TARİHİ, MÜŞTERİ TEMSİLCİSİ, BİTİŞ TARİHİ |
| Items table | ⚠️ Partial | Add **Sıra** column; keep Description, Quantity, Unit, Unit Price, Total |
| Discount & totals | ❌ Missing | Ara Toplam → İskonto Oranı → İskonto Tutarı → Genel Toplam |
| Terms | ❌ Missing | 5 sections (engineering, pricing, warranty, other, attachments) |
| Signature box | ❌ Missing | “Teklifiniz uygun bulunmuştur” + Kaşe / Ad soyad / İmza |
| Bank info | ✅ Correct | Do not show bank account information |
| Footer | ⚠️ Optional | Page numbers (e.g. “-- 1 of 3 --”) if multi-page |

### 4.2 Logo and company info

- One uploaded image per proposal (`logo_url`).
- Image may include branding and contact (web, email, phone).
- PDF: render image top-left only; no separate contact fields in DB.

### 4.3 Discount in PDF

- **Ara Toplam** = sum of line totals (before discount).
- **İskonto Oranı** = `discount_percent` (%).
- **İskonto Tutarı** = Ara Toplam × (discount_percent / 100).
- **Genel Toplam** = Ara Toplam − İskonto Tutarı.

---

## 5. UI/UX Summary

### 5.1 Proposal form

- **Logo:** Single image upload → `logo_url`.
- **Header:** Editor for 8 header fields (company_name, survey_date, authorized_person, installation_date, customer_representative, completion_date; proposal_date = created_at, project_name = title).
- **Items:** Existing table + **Sıra**; under each item, expandable cost block (expanded by default): product, labor, shipping, material, misc.
- **Discount:** `discount_percent` input.
- **Terms:** Collapsible section with 5 text areas (engineering, pricing, warranty, other, attachments).

### 5.2 Proposal detail page

- **Stat cards:** Include **Net Kar** = Grand Total − Total Costs.
- Optionally: cost breakdown and margin %.

### 5.3 PDF

- No cost fields, no bank info.
- Logo, header grid, items (with Sıra), discount/totals, terms, signature box.

---

## 6. Implementation Phases

### Phase 1 — Database

- Migration: add to `proposals`: logo_url, company_name, survey_date, authorized_person, installation_date, customer_representative, completion_date, discount_percent, terms_engineering, terms_pricing, terms_warranty, terms_other, terms_attachments.
- Migration: add to `proposal_items`: product_cost_usd, labor_cost_usd, shipping_cost_usd, material_cost_usd, misc_cost_usd.

### Phase 2 — Schema & API

- `schema.js`: add new proposal and item fields; validate cost and discount.
- `api.js`: create/update proposals and items with new fields; logo upload (storage) if applicable.

### Phase 3 — Form UI

- Logo upload component; header fields; discount; terms editor.
- ProposalItemsEditor: cost block (expanded by default) with five cost inputs.

### Phase 4 — Detail page

- Net Kar stat card; optionally cost summary card.

### Phase 5 — PDF

- Logo, header grid, Sıra, discount/totals, 5 terms sections, signature box; no bank info; optional page numbers.

### Phase 6 — i18n & tests

- Translations for new labels (cost, discount, terms, Net Kar, etc.).
- Test form, detail page, PDF, and that cost/bank never appear in PDF.

---

## 7. Decisions (for reference)

- **Cost storage:** Columns on `proposal_items` (not separate table).
- **Company contact in PDF:** From single logo image only; no company_website/email/phone in DB.
- **Cost in PDF:** Never; internal only, for Net Kar and reporting.
- **Discount:** Single `discount_percent` on proposal; totals in PDF as above.
- **Terms:** Five editable text fields on proposal, rendered as five sections in PDF.

---

## 8. Files to Touch

| Area | Files |
|------|------|
| DB | New migration (e.g. `00029_proposal_cost_terms_logo.sql`) |
| Schema | `src/features/proposals/schema.js` |
| API | `src/features/proposals/api.js` (+ logo upload if needed) |
| Form | `ProposalFormPage.jsx`, `ProposalItemsEditor.jsx`, new/used: logo upload, header editor, terms editor |
| Detail | `ProposalDetailPage.jsx` |
| PDF | `ProposalPdf.jsx` |
| i18n | `src/locales/tr/proposals.json` |
