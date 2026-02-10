# Proposal & Invoicing Module — Architecture

**Date:** February 9, 2026
**Status:** Design — not yet implemented

---

## 1. Database Schema

Next migration: `00027_proposals.sql`

### 1.1 `proposals`

The source of truth for every quote you hand a customer.

```sql
CREATE TABLE proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_no       TEXT NOT NULL UNIQUE,          -- DD.MM.YYYY-NNNN (internal only, never on PDF)
  site_id           UUID NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,

  title             TEXT NOT NULL,                  -- "Güvenlik Kamera Sistemi Kurulumu"
  notes             TEXT,                           -- Internal notes (not on PDF)
  scope_of_work     TEXT,                           -- Appears on PDF as the work description block

  -- Money (always USD)
  currency          TEXT NOT NULL DEFAULT 'USD',
  total_amount_usd  DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','accepted','rejected','cancelled')),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,                   -- When PDF was downloaded/sent
  accepted_at       TIMESTAMPTZ,                   -- Manual: admin marks client agreement
  rejected_at       TIMESTAMPTZ,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Design decisions:**
- No `exchange_rate` on proposals. The rate is only locked at *finalization* (after installation completes), not at quote time. This matches real-world workflow: you quote in USD, the TRY conversion only matters when you invoice.
- `proposal_no` is stored but never rendered on PDF output. It's a purely internal tracking number.
- `site_id` links to a specific location. Customer info is resolved via `customer_sites.customer_id`.

### 1.2 `proposal_items`

Line items. Each is USD.

```sql
CREATE TABLE proposal_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,

  description       TEXT NOT NULL,                 -- "Hikvision DS-2CD2143G2-IS 4MP IP Kamera"
  quantity          DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit              TEXT DEFAULT 'adet',           -- adet, metre, set, etc.
  unit_price_usd    DECIMAL(12,2) NOT NULL,
  total_usd         DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price_usd) STORED,

  -- Admin-only cost tracking (never on PDF)
  cost_usd          DECIMAL(12,2),                 -- Your purchase cost per unit
  margin_percent    DECIMAL(5,2)                   -- Calculated or manual margin
);
```

**Why `GENERATED ALWAYS`:** `total_usd` can never drift from `quantity * unit_price_usd`. One less bug surface.

### 1.3 `proposal_work_orders` — junction

A proposal spawns N work orders. This is a junction, not a column on `work_orders`, because:
- A work order *can* exist independently (service calls, maintenance).
- The relationship is additive, not mandatory.

```sql
CREATE TABLE proposal_work_orders (
  proposal_id    UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  work_order_id  UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_id, work_order_id)
);
```

**Also add a convenience column on work_orders** for quick lookups:

```sql
ALTER TABLE work_orders ADD COLUMN proposal_id UUID REFERENCES proposals(id);
```

Both exist: the junction for strict relational queries, the FK for fast single-query joins in the `work_orders_detail` view.

### 1.4 `financial_records` — the bridge to accounting

Created *once* per proposal, at the moment the user confirms the "Financial Finalization" screen.

```sql
CREATE TABLE financial_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id         UUID NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,

  -- The date the installation was completed. This is the accounting anchor date.
  record_date         DATE NOT NULL,

  -- FX
  fx_rate             DECIMAL(12,6) NOT NULL,       -- TCMB rate (possibly manually overridden)
  fx_rate_source      TEXT NOT NULL DEFAULT 'tcmb',  -- 'tcmb' | 'manual'
  fx_rate_date        DATE NOT NULL,                 -- TCMB rate publication date

  -- Amounts
  subtotal_usd        DECIMAL(12,2) NOT NULL,
  subtotal_try        DECIMAL(12,2) NOT NULL,        -- subtotal_usd * fx_rate

  should_invoice      BOOLEAN NOT NULL DEFAULT false,
  vat_rate            DECIMAL(5,2) DEFAULT 20.00,    -- 20% standard
  vat_amount_try      DECIMAL(12,2) DEFAULT 0,       -- subtotal_try * vat_rate / 100
  grand_total_try     DECIMAL(12,2) NOT NULL,        -- subtotal_try + vat_amount_try

  -- Paraşüt sync
  parasut_invoice_id  TEXT,                          -- Returned from Paraşüt API
  parasut_synced_at   TIMESTAMPTZ,
  parasut_error       TEXT,                          -- Last sync error (if any)

  -- Audit
  finalized_by        UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.5 `financial_record_items`

Per-item breakdown in TRY. The user can revise individual item prices on the finalization screen before confirming.

```sql
CREATE TABLE financial_record_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_record_id UUID NOT NULL REFERENCES financial_records(id) ON DELETE CASCADE,
  proposal_item_id    UUID REFERENCES proposal_items(id),

  description         TEXT NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  unit                TEXT,
  unit_price_usd      DECIMAL(12,2) NOT NULL,       -- Original from proposal
  unit_price_try      DECIMAL(12,2) NOT NULL,        -- May be manually revised
  total_try           DECIMAL(12,2) NOT NULL,
  sort_order          INT NOT NULL DEFAULT 0
);
```

### 1.6 `exchange_rate_cache`

Locally cached TCMB rates. Avoids hitting the API on every page load.

```sql
CREATE TABLE exchange_rate_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency    TEXT NOT NULL DEFAULT 'USD',
  buy_rate    DECIMAL(12,6) NOT NULL,
  sell_rate   DECIMAL(12,6) NOT NULL,              -- This is what we use for invoicing
  rate_date   DATE NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency, rate_date)
);
```

### 1.7 Views

```sql
-- Enriched proposal view for list/detail pages
CREATE OR REPLACE VIEW proposals_detail AS
SELECT
  p.*,
  cs.site_name,
  cs.address   AS site_address,
  cs.account_no,
  c.id         AS customer_id,
  c.company_name,
  c.phone      AS customer_phone,
  (SELECT count(*) FROM proposal_work_orders pwo WHERE pwo.proposal_id = p.id) AS work_order_count,
  (SELECT bool_and(wo.status = 'completed')
     FROM proposal_work_orders pwo
     JOIN work_orders wo ON wo.id = pwo.work_order_id
    WHERE pwo.proposal_id = p.id
  ) AS all_installations_complete,
  fr.id        AS financial_record_id
FROM proposals p
JOIN customer_sites cs ON cs.id = p.site_id
JOIN customers c ON c.id = cs.customer_id
LEFT JOIN financial_records fr ON fr.proposal_id = p.id;
```

### 1.8 Proposal Number Generator

```sql
CREATE OR REPLACE FUNCTION generate_proposal_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  today_str TEXT;
  seq INT;
BEGIN
  today_str := to_char(CURRENT_DATE, 'DD.MM.YYYY');
  SELECT count(*) + 1 INTO seq
    FROM proposals
    WHERE created_at::date = CURRENT_DATE;
  RETURN today_str || '-' || lpad(seq::text, 4, '0');
END;
$$;
```

### 1.9 Auto-trigger: installation completed

When the *last* work order linked to a proposal is marked "completed", auto-update the proposal status:

```sql
CREATE OR REPLACE FUNCTION check_proposal_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prop_id UUID;
  all_done BOOLEAN;
BEGIN
  -- Only fire when a work order transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT pwo.proposal_id INTO prop_id
      FROM proposal_work_orders pwo
      WHERE pwo.work_order_id = NEW.id
      LIMIT 1;

    IF prop_id IS NOT NULL THEN
      SELECT bool_and(wo.status = 'completed') INTO all_done
        FROM proposal_work_orders pwo
        JOIN work_orders wo ON wo.id = pwo.work_order_id
        WHERE pwo.proposal_id = prop_id;

      IF all_done THEN
        UPDATE proposals SET status = 'completed' WHERE id = prop_id AND status = 'accepted';
        -- The UI will check this status to show the "Finalize" redirect
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_proposal_completion
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_proposal_completion();
```

---

## 2. Logic Flow — Installation Completed to Invoice

```
    ┌─────────────────────────────────────────────────────────┐
    │                    PROPOSAL LIFECYCLE                     │
    └─────────────────────────────────────────────────────────┘

    [draft] ──── Download PDF / Send ────► [sent]
                                              │
                          Client agrees       │
                          (externally)        │
                                              ▼
                                          [accepted]
                                              │
                          Create 1..N         │
                          Work Orders         │
                                              ▼
                                     ┌──── Work Orders ────┐
                                     │  WO-1: scheduled    │
                                     │  WO-2: scheduled    │
                                     │  WO-3: scheduled    │
                                     └────────────────────┘
                                              │
                          Each completed      │
                          individually        │
                                              ▼
                                    ALL work orders done?
                                     ╱            ╲
                                   No              Yes
                                   │                │
                              (wait)         DB trigger fires:
                                          proposal.status → 'completed'
                                                    │
                                                    ▼
                                     ┌──────────────────────────┐
                                     │   FINANCIAL FINALIZATION  │
                                     │        SCREEN             │
                                     └──────────────────────────┘
                                                    │
                                        ┌───────────┴───────────┐
                                        │                       │
                                   "Faturala"              "Faturalama"
                                   (Invoice)               (No Invoice)
                                        │                       │
                                        ▼                       ▼
                              ┌────────────────┐     ┌────────────────┐
                              │ Fetch TCMB rate│     │ Record with    │
                              │ Show USD→TRY   │     │ FX rate only   │
                              │ Add 20% KDV    │     │ No VAT         │
                              │ Allow revisions│     │ Local record   │
                              │ ─────────────  │     │ No Paraşüt     │
                              │ Confirm:       │     └────────────────┘
                              │  → Ledger entry│
                              │  → Paraşüt sync│
                              └────────────────┘
```

### The redirect mechanism (frontend):

```
WorkOrderDetailPage:
  When user clicks "Tamamlandı" (mark completed):
    1. mutation: updateWorkOrder({ status: 'completed' })
    2. onSuccess:
       - Refetch proposal status
       - If proposal.status === 'completed' AND no financial_record exists:
           → navigate('/proposals/{id}/finalize')
       - Else: stay on page, show success toast
```

This keeps the UX seamless. The trigger handles the database truth; the frontend just reads and redirects.

---

## 3. UI Structure

### 3.1 Proposal Creation Page — `/proposals/new`

```
┌─────────────────────────────────────────────────────┐
│  ← Teklifler                             Taslak Kaydet │
│                                                         │
│  Müşteri    [ Ornet Güvenlik ▾ ]  [ + Yeni ]           │
│  Lokasyon   [ Nişantaşı Şubesi ▾ ]  [ + Yeni ]        │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│                                                         │
│  Teklif Başlığı                                        │
│  [ Güvenlik Kamera Sistemi Kurulumu            ]       │
│                                                         │
│  Kapsam                                                │
│  [ Bina çevresi için 8 adet IP kamera ...      ]       │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│                                                         │
│  KALEMLER                                              │
│                                                         │
│  Açıklama                    Adet   Birim Fiyat  Toplam │
│  Hikvision 4MP Kamera         8    $  125.00   $1,000  │
│  NVR 16 Kanal                 1    $  480.00   $  480  │
│  Kablo + İşçilik              1    $  320.00   $  320  │
│                                          ──────────── │
│  [ + Kalem Ekle ]              Toplam    $1,800.00 USD │
│                                                         │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│                                                         │
│         [ PDF İndir ]              [ Teklifi Gönder ]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key interactions:**
- **[ + Yeni ] buttons** open inline modals for adding Customer / Site *without leaving the page*. Modal pre-fills parent reference. On save, the dropdown auto-selects the new record.
- **Item rows** are editable inline. Tab through cells. Enter adds a new row. Delete key removes empty rows.
- **No borders on item rows.** Rows are separated by whitespace only. Alternating subtle bg on hover.
- **Cost/Margin columns** are hidden by default. Toggle via a discreet admin-only icon. Never on PDF.

### 3.2 Proposal Detail Page — `/proposals/:id`

Two states depending on lifecycle:

**State A: Before completion** — Shows proposal info, linked work orders, and actions.

```
┌─────────────────────────────────────────────────────┐
│  ← Teklifler                                         │
│                                                       │
│  Güvenlik Kamera Sistemi Kurulumu                    │
│  Ornet Güvenlik  ·  Nişantaşı Şubesi                │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐          │
│  │ $1,800   │  │ Onaylandı│  │ 2/3 İş    │          │
│  │ USD      │  │ 05.02.26 │  │ Tamamlandı│          │
│  └──────────┘  └──────────┘  └───────────┘          │
│                                                       │
│  KALEMLER                                            │
│  8× Hikvision 4MP Kamera ............... $1,000.00   │
│  1× NVR 16 Kanal ....................... $  480.00   │
│  1× Kablo + İşçilik .................... $  320.00   │
│                                                       │
│  İŞ EMİRLERİ                                         │
│  ● 07.02 Pzt  Montaj - Kamera Montajı    ✓ Tamamlandı │
│  ● 08.02 Sal  Montaj - NVR + Kablolama   ✓ Tamamlandı │
│  ● 09.02 Çar  Montaj - Test + Devreye Al  ◷ Devam Ediyor │
│                                                       │
│                        [ + İş Emri Ekle ]            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**State B: All complete, no financial record yet** — Big CTA:

```
│  ┌────────────────────────────────────────────┐      │
│  │  Tüm kurulumlar tamamlandı.                │      │
│  │  Mali kayıt oluşturmak için devam edin.    │      │
│  │                                             │      │
│  │          [ Mali Kayıt Oluştur → ]           │      │
│  └────────────────────────────────────────────┘      │
```

### 3.3 Financial Finalization Page — `/proposals/:id/finalize`

The critical bridge screen. Appears only once per proposal.

```
┌─────────────────────────────────────────────────────┐
│  Mali Kayıt                                          │
│  Güvenlik Kamera Sistemi Kurulumu                    │
│  Ornet Güvenlik  ·  Nişantaşı Şubesi                │
│                                                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│                                                       │
│  DÖVİZ KURU                                          │
│                                                       │
│  TCMB Satış Kuru (09.02.2026)                        │
│  1 USD = [ 38.4250 ] TRY                     ↻ Yenile│
│                                                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│                                                       │
│  KALEMLER                          USD        TRY     │
│  8× Hikvision 4MP Kamera       $1,000    ₺38,425     │
│  1× NVR 16 Kanal               $  480    ₺18,444     │
│  1× Kablo + İşçilik            $  320    ₺12,296     │
│                               ─────────  ─────────   │
│  Ara Toplam                    $1,800    ₺69,165     │
│                                                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│                                                       │
│  FATURALAMA                                          │
│                                                       │
│  Fatura kesilecek mi?    [ ● Evet   ○ Hayır ]       │
│                                                       │
│  KDV (%20)                                ₺13,833    │
│  ──────────────────────────────────────────────────  │
│  GENEL TOPLAM                             ₺82,998    │
│                                                       │
│                                                       │
│             [ Onayla ve Kaydet ]                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Key interactions:**
- FX rate field is editable. Changing it recalculates all TRY columns live.
- Individual TRY prices per item are also editable (for rounding or negotiated discounts).
- "Hayır" hides the VAT row. Grand total = subtotal (no VAT). No Paraşüt sync.
- "Evet" shows VAT. On confirm: write `financial_records` + items, fire Paraşüt sync.
- The ↻ button re-fetches TCMB in case the cached rate is stale.

### 3.4 Proposals List Page — `/proposals`

```
┌─────────────────────────────────────────────────────┐
│  Teklifler                           [ + Yeni Teklif ]│
│                                                       │
│  ┌─ Filtreler ──────────────────────────────────┐    │
│  │ Durum: [Tümü ▾]    Müşteri: [Tümü ▾]        │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Ornet Güvenlik · Nişantaşı                          │
│  Güvenlik Kamera Sistemi Kurulumu                    │
│  $1,800 USD    Onaylandı · 05.02.2026    2/3 İş ✓   │
│                                                       │
│  ABC Holding · Levent Ofis                            │
│  Geçiş Kontrol Sistemi                                │
│  $4,200 USD    Taslak · 08.02.2026                   │
│                                                       │
│  ...                                                  │
└─────────────────────────────────────────────────────┘
```

Cards, not tables. Each card shows: customer + site, title, amount, status badge, work order progress. Click navigates to detail.

### 3.5 PDF Template

The PDF is the external-facing document. It must look premium.

**What appears on the PDF:**
- Company logo (top-left, small)
- Date (Turkish format: 9 Şubat 2026)
- Customer company name
- Site name + address
- Title
- Scope of work text block
- Item table: Description | Adet | Birim Fiyat | Toplam (all in USD)
- Grand total in USD
- Footer: company contact info, one line

**What does NOT appear on the PDF:**
- Proposal number
- Signature lines
- "Teklif" header or form-like framing
- Cost / margin columns
- Any boxes, heavy borders, or form fields

**Typography:**
- Font: Inter (available via Google Fonts, supports Turkish characters: ı, İ, ğ, Ğ, ü, Ü, ş, Ş, ö, Ö, ç, Ç)
- Title: 20px semibold
- Body: 11px regular
- Item table: 10px, generous row padding, no horizontal rules except header underline
- Color: #111 text on white. Amounts right-aligned in monospace weight.

**Generation approach:** Use `@react-pdf/renderer` (already usable in React). Render to blob, trigger download. No server-side generation needed.

---

## 4. API Strategy

### 4.1 TCMB Exchange Rate

**Source:** TCMB publishes daily FX rates as XML.

**Endpoint:**
```
https://www.tcmb.gov.tr/kurlar/today.xml
```

**Parsing:** The XML contains `<Currency CurrencyCode="USD">` with `<ForexSelling>` field. That's the rate we need.

**Architecture:**

```
Option A — Supabase Edge Function (recommended):
  - Edge Function: /functions/v1/tcmb-rate
  - Fetches XML, parses, returns { sell_rate, buy_rate, rate_date }
  - Caches in exchange_rate_cache table
  - Frontend calls this, never hits TCMB directly (avoids CORS)

Option B — Client-side via proxy:
  - TCMB blocks CORS, so direct browser fetch won't work
  - Would need a proxy (Cloudflare Worker or Supabase Edge Function anyway)
```

**Recommendation:** Option A. A single Supabase Edge Function:

```
GET /functions/v1/tcmb-rate?currency=USD

Response:
{
  "currency": "USD",
  "sell_rate": 38.4250,
  "buy_rate": 38.3180,
  "rate_date": "2026-02-09",
  "cached": false
}
```

**Caching logic:**
1. Check `exchange_rate_cache` for today's date
2. If found and `fetched_at` is within last 2 hours → return cached
3. If not → fetch from TCMB, parse, insert into cache, return

**Fallback:** If TCMB is unreachable (weekends, holidays, downtime), return the most recent cached rate with a `"stale": true` flag. The UI shows a warning and lets the user enter manually.

### 4.2 Paraşüt API

**Paraşüt** is a Turkish cloud accounting platform. Integration is *write-only* — we push invoices, we don't pull data.

**Auth:** OAuth2 client credentials flow.
```
POST https://api.parasut.com/oauth/token
{
  "client_id": "...",
  "client_secret": "...",
  "grant_type": "client_credentials",
  "redirect_uri": "urn:ietf:wg:oauth:2.0:oob"
}
```

**Create Sales Invoice:**
```
POST https://api.parasut.com/v4/{company_id}/sales_invoices

{
  "data": {
    "type": "sales_invoices",
    "attributes": {
      "item_type": "invoice",
      "description": "Güvenlik Kamera Sistemi Kurulumu",
      "issue_date": "2026-02-09",
      "due_date": "2026-02-09",
      "currency": "TRY"
    },
    "relationships": {
      "contact": {
        "data": { "id": "<parasut_contact_id>", "type": "contacts" }
      },
      "details": {
        "data": [
          {
            "type": "sales_invoice_details",
            "attributes": {
              "quantity": 8,
              "unit_price": 4803.13,
              "vat_rate": 20,
              "description": "Hikvision 4MP Kamera"
            }
          }
        ]
      }
    }
  }
}
```

**Architecture:**

```
Supabase Edge Function: /functions/v1/parasut-sync

Input: { financial_record_id: UUID }

Steps:
  1. Read financial_record + items from DB
  2. Map to Paraşüt invoice payload
  3. POST to Paraşüt API
  4. On success: update financial_records.parasut_invoice_id + parasut_synced_at
  5. On failure: update financial_records.parasut_error, return error to frontend
```

**Customer mapping:** Paraşüt has its own contact IDs. Add an optional `parasut_contact_id` column to the `customers` table. If missing, the Edge Function creates the contact in Paraşüt first, then stores the ID.

**Retry:** If the sync fails, the UI shows the error and a "Tekrar Dene" (Retry) button. No automatic retry — this is a financial operation, manual confirmation is appropriate.

---

## 5. Feature Module Structure

Following existing project conventions:

```
src/features/proposals/
├── api.js                          # Supabase calls
├── hooks.js                        # React Query hooks
├── schema.js                       # Zod schemas
├── index.js                        # Barrel exports
├── ProposalsListPage.jsx           # /proposals
├── ProposalDetailPage.jsx          # /proposals/:id
├── ProposalFormPage.jsx            # /proposals/new, /proposals/:id/edit
├── FinancialFinalizationPage.jsx   # /proposals/:id/finalize
└── components/
    ├── ProposalItemsEditor.jsx     # Inline item table
    ├── InlineCustomerModal.jsx     # Quick-add customer modal
    ├── InlineSiteModal.jsx         # Quick-add site modal
    ├── ProposalStatusBadge.jsx     # Status badges
    ├── FxRateInput.jsx             # Editable FX rate with refresh
    ├── InvoiceToggle.jsx           # Evet/Hayır toggle
    ├── FinalizationSummary.jsx     # TRY conversion table
    └── ProposalPdf.jsx             # @react-pdf/renderer template

src/locales/tr/proposals.json       # Turkish translations
```

**New dependency needed:** `@react-pdf/renderer` for PDF generation.

---

## 6. Routes

```jsx
<Route path="proposals" element={<ProposalsListPage />} />
<Route path="proposals/new" element={<ProposalFormPage />} />
<Route path="proposals/:id" element={<ProposalDetailPage />} />
<Route path="proposals/:id/edit" element={<ProposalFormPage />} />
<Route path="proposals/:id/finalize" element={<FinancialFinalizationPage />} />
```

---

## 7. Implementation Phases

### Phase 1 — Core CRUD + PDF
- Migration: tables, views, functions
- Proposal create/edit/list/detail pages
- Inline customer/site creation
- PDF generation and download
- Status: draft → sent → accepted/rejected

### Phase 2 — Work Order Bridge
- Junction table + FK
- "Add Work Order" from proposal detail
- Work order completion trigger
- Redirect to finalization screen
- Update `work_orders_detail` view to include `proposal_id`

### Phase 3 — Financial Finalization
- TCMB Edge Function + cache
- Finalization page with FX rate, item conversion, VAT toggle
- `financial_records` + `financial_record_items` creation
- Dashboard metrics: monthly revenue, USD/TRY breakdown

### Phase 4 — Paraşüt Integration
- Paraşüt Edge Function
- OAuth2 token management
- Invoice sync on finalization confirm
- Error handling + retry UI
- `parasut_contact_id` on customers table

---

## 8. Open Questions

1. **PDF library:** `@react-pdf/renderer` requires adding a dependency. Confirm this is acceptable.
2. **Paraşüt credentials:** Where to store `client_id`/`client_secret` — Supabase secrets (vault) is the recommendation.
3. **Multi-currency future:** Schema is USD-only by design. If EUR or GBP is ever needed, the `currency` column is already there but currently hardcoded.
4. **Partial invoicing:** Current design is one financial record per proposal. If a proposal needs to be invoiced in parts (e.g., 50% upfront), the schema would need a `financial_records` → many relationship.
