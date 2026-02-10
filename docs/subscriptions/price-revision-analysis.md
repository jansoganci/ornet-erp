# Price Revision Page – Analysis & Proposed Solutions

**Page:** `/subscriptions/price-revision`  
**Scope:** Table layout (horizontal scroll) + Notes system (yearly price change timeline)  
**Status:** Analysis only – no implementation until approved.

---

## 1. Current Implementation Summary

### 1.1 Page & Components

| Item | Location / Detail |
|------|-------------------|
| **Page component** | `src/features/subscriptions/PriceRevisionPage.jsx` |
| **Route** | `App.jsx`: `<Route path="subscriptions/price-revision" element={<PriceRevisionPage />} />` |
| **Layout** | `PageContainer` with `maxWidth="xl"` (1280px), `padding="default"` |
| **Data** | `useSubscriptions(filters)` → `subscriptions_detail` view |
| **Save** | `useBulkUpdateSubscriptionPrices()` → RPC `bulk_update_subscription_prices(p_updates)` |
| **UI pieces** | Filters (service type, billing frequency, start month), single `Table`, Save button, Empty/Error states |

No separate child components for the table; column config and render functions are defined inline in the page.

### 1.2 Database & API

- **Source:** View `subscriptions_detail` (migration `00016_subscriptions.sql`).
- **View joins:** `subscriptions` + `customer_sites` + `customers` + `payment_methods` (optional) + `profiles` (managed_by, sold_by).
- **Key columns used on price-revision:**  
  `id`, `company_name`, `site_name`, `account_no`, `start_date`, `subscription_type`, `service_type`, `billing_frequency`, `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`.
- **Subscriptions table** (`00016`, `00022`): has `notes` (TEXT) and `setup_notes` (TEXT) – general free-text fields, not a timeline.
- **Audit:** `audit_logs` stores `price_change` actions (single and bulk) with `old_values` / `new_values` JSONB and `description` (e.g. "Fiyat güncellendi (toplu revizyon)"). No user-written “revision note” per change.
- **Bulk update:** Migration `00024_bulk_update_subscription_prices.sql` – updates `subscriptions` and pending `subscription_payments`, writes to `audit_logs`; no note parameter.

### 1.3 Table Layout (Current)

- **Component:** `src/components/ui/Table.jsx`.
- **Desktop:** `<div class="hidden lg:block overflow-x-auto">` → horizontal scroll when content is wider than container.
- **Mobile:** `lg:hidden` card stack (one card per row); no horizontal scroll there.
- **Columns (11):**

| # | Column key | Header (TR) | Current styling / width |
|---|------------|-------------|--------------------------|
| 1 | company_name | Müşteri | `min-w-[120px]` on wrapper div, company + site_name |
| 2 | account_no | Hesap No | font-mono, no fixed width |
| 3 | start_date | Başlangıç | `formatDate`, whitespace-nowrap |
| 4 | subscription_type | Tip | Badge |
| 5 | service_type | Hizmet Türü | text |
| 6 | billing_frequency | Ödeme Sıklığı | text (Aylık/Yıllık) |
| 7 | base_price | Baz Fiyat | Input `w-24` |
| 8 | sms_fee | SMS Ücreti | Input `w-20` |
| 9 | line_fee | Hat Ücreti | Input `w-20` |
| 10 | vat_rate | KDV | Input `w-16` |
| 11 | cost | Maliyet | Input `w-24` |

- **Table:** `min-w-full`, no column `width` in config; cells use `whitespace-nowrap` and `px-6 py-4`.
- **Effective width:** With 11 columns and inputs, total width easily exceeds 1280px → horizontal scroll on desktop.

### 1.4 Notes System (Current)

- **In app:** No timeline or “revision notes” on the price-revision page.  
- **Subscriptions:** `subscriptions.notes` and `subscriptions.setup_notes` are shown on **Subscription Detail** (`SubscriptionDetailPage.jsx`) as static blocks (setup notes + general notes). Not tied to a specific price change or year.
- **Audit:** `audit_logs` gives automated history of price changes (who, when, old/new values) but no free-text “note” per revision. Only `description` is set (fixed string like “Fiyat güncellendi (toplu revizyon)”).
- **Conclusion:** There is no dedicated “notes for yearly price revision” or “timeline of price change notes” anywhere; only generic notes and system audit.

---

## 2. Problems & Constraints

### 2.1 Table (Left–Right Scroll)

- **Problem:** 11 columns cause horizontal scroll on typical desktop (e.g. 1280px or 1440px).
- **Constraint:** User requirement: avoid left–right scroll where possible (no “if possible I do not wanna scroll left to right or vice versa”).
- **Constraint:** Must keep editing in place (inputs for base_price, sms_fee, line_fee, vat_rate, cost) and keep filters; only layout/priorities/abbreviations can change.

### 2.2 Notes

- **Problem:** No way to record “why” or “what was agreed” for a yearly price increase (e.g. “2025 zam notu”, “müşteri ile görüşüldü”).
- **Constraint:** Should support a timeline (e.g. one note per revision / per year), not only a single blob.
- **Constraint:** Should fit existing patterns (i18n, modals/UI, Supabase, RLS) and not break bulk update flow.

---

## 3. Proposed Solutions

### 3.1 Table Layout – Fit 11 Columns Without Horizontal Scroll

**Goal:** Same 11 data points, no horizontal scroll on common desktop widths (e.g. up to ~1280px content width).

**Approach: combine responsive behavior, abbreviations, and column priorities.**

1. **Shorten headers (abbreviations / tooltips)**  
   - Use short labels in the header to save width; full text in `title` tooltip or in a small “column help” if needed.  
   - Example mapping (can be tuned with i18n):

   | Current header | Short (example) | Tooltip |
   |----------------|------------------|--------|
   | Müşteri | Müş. | Müşteri |
   | Hesap No | H.No | Hesap No |
   | Başlangıç | Başl. | Başlangıç Tarihi |
   | Tip | Tip | Abonelik Tipi |
   | Hizmet Türü | Hizmet | Hizmet Türü |
   | Ödeme Sıklığı | Ödem. | Ödeme Sıklığı |
   | Baz Fiyat | Baz | Baz Fiyat |
   | SMS Ücreti | SMS | SMS Ücreti |
   | Hat Ücreti | Hat | Hat Ücreti |
   | KDV | KDV | KDV (%) |
   | Maliyet | Maliyet | Maliyet |

   Add i18n keys under `priceRevision.columnsShort` (and keep long keys for tooltip/mobile).

2. **Constrain column widths**  
   - Set explicit `width` (or `minWidth`/`maxWidth` if Table supports it) so the table doesn’t grow unbounded:
     - Müşteri: ~140px  
     - Hesap No: ~80px  
     - Başlangıç: ~90px  
     - Tip: ~70px  
     - Hizmet: ~80px  
     - Ödem.: ~70px  
     - Baz / SMS / Hat / KDV / Maliyet: keep inputs but narrow (e.g. `w-20` / `w-16` where already used), total ~120–130px for the 5 numeric columns.  
   - Total target: ~800–950px so it fits in xl (1280px) with padding and filters.

3. **Narrow inputs and cell padding**  
   - Use consistent small inputs (e.g. `w-18` or `w-20` for price fields, `w-14` for vat_rate) and optionally `px-3 py-2` for table cells on this page to save horizontal space.

4. **Sticky first column (optional)**  
   - Keep “Müşteri” (and optionally Hesap No) sticky left so when user does scroll on very small viewports, context stays visible. Implement only if we still need a minimal scroll on very narrow desktop.

5. **Table component**  
   - Table currently doesn’t use `column.width` in the cell, only in `<th>`. Ensure `width` is applied to `<td>` as well (or that table-layout is fixed and only th widths are used). If not, extend Table to support optional `width` on columns and apply to both `th` and `td`.

**Deliverables:**  
- New i18n keys for short headers + tooltips.  
- Column config in `PriceRevisionPage.jsx` with `width` and short headers.  
- Slightly smaller, consistent input widths.  
- Optional: sticky first column only if needed.

**Result:** Same 11 columns, no horizontal scroll on xl layout, and still editable in place.

---

### 3.2 Notes System – Timeline of Yearly Price Change Notes

**Goal:** Per-subscription timeline of notes tied to price revisions (e.g. one note per year / per revision).

#### 3.2.1 Database Schema Options

| Option | Pros | Cons |
|-------|------|------|
| **A. New table `subscription_price_revision_notes`** | Clear model, easy to query “notes for this subscription”, good for RLS and reporting. | New table + migration, one more join or fetch. |
| **B. JSONB on `subscriptions`** (e.g. `price_revision_notes JSONB`) | No new table; one column. | Harder to query by date/author; schema drift if structure changes. |
| **C. Reuse `audit_logs` and add optional `user_note`** | Reuses existing audit trail. | Mixes “system event” with “user note”; audit_logs is generic and might be heavy to query for “last N notes per subscription”. |

**Recommendation: Option A – new table `subscription_price_revision_notes`.**

- **Table:**  
  - `id` (uuid, PK),  
  - `subscription_id` (uuid, FK → subscriptions, ON DELETE CASCADE),  
  - `note` (TEXT),  
  - `revision_date` (DATE or TIMESTAMPTZ) – “effective” date of the revision (e.g. 2025-01-01 for 2025 zam),  
  - `created_at` (TIMESTAMPTZ),  
  - `created_by` (UUID → profiles),  
  - optional: `audit_log_id` (UUID → audit_logs) to link to the price_change audit entry if we add a note at save time.  

- **Indexes:** `(subscription_id, revision_date DESC)` (and optionally `created_at DESC`) for “timeline for this subscription”.

- **RLS:** Same as subscriptions (e.g. admin/accountant can select/insert; policy aligned with subscriptions_detail / subscriptions).

- **When to create a note:**  
  - **Option 1:** User adds note in the UI when editing prices (e.g. “2025 zam” note) and we save it together with the bulk update (one note per subscription that had edits + optional note text).  
  - **Option 2:** User can add a note without changing price (e.g. “2025 anlaşma notu”).  
  Support at least Option 1; Option 2 can be same API: “add note” with optional `revision_date`.

#### 3.2.2 API

- **Create note:** `POST`-style insert into `subscription_price_revision_notes` (subscription_id, note, revision_date, created_by).  
- **List notes:** Query by `subscription_id`, order by `revision_date DESC` or `created_at DESC`.  
- **Bulk save from price-revision page:** Either:  
  - Call existing `bulk_update_subscription_prices` for prices, then for each row that had a “revision note” in the form, insert one note (revision_date = e.g. selected year or today); or  
  - Extend RPC to accept optional `note` per item and insert into `subscription_price_revision_notes` in the same transaction.  

Recommendation: keep RPC for prices only; in the app, after successful bulk update, call a “create revision notes” API for rows that have note text. Simpler and keeps “notes” separate from “price update”.

#### 3.2.3 UI Design

- **Where to show notes (price-revision page):**  
  - **Per row:** Small “note” icon/button in each row (e.g. in the Müşteri cell or a dedicated 12th column). Click opens a **modal** or **slide-over** with:  
    - Timeline of existing notes (date + text + author if we store it).  
    - Form to add a new note (text + optional revision date, default e.g. current year-01-01).  
  - **Why modal/slide-over:** Keeps the table compact; timeline can be long and needs space.  
  - Avoid inline expandable section in the table (many rows → noisy and heavy).

- **When saving prices:**  
  - If we want “one note for this batch” (e.g. “2025 toplu zam”): one global note field above the table that applies to all rows that are being updated; we create one note per updated subscription with that text and revision_date.  
  - If we want “per-row note”: each row can have an optional note input (or “add note” that opens modal); on save we persist notes only for rows that have note content.  

Recommendation: **per-row “Notes” button** that opens a **modal** with:  
- Timeline of existing revision notes (list by revision_date desc).  
- “Add note” form (note text, revision date).  
- No need to change the bulk-update RPC; after bulk update success, for each row that has a new note in local state, call “create revision note” API.

- **Subscription Detail page:** Optionally add a “Fiyat revizyon notları” section that shows the same timeline (read-only) by loading `subscription_price_revision_notes` for that subscription.

#### 3.2.4 i18n

- New keys under `subscriptions.priceRevision.notes` (or `subscriptions.revisionNotes`): e.g. `title`, `add`, `revisionDate`, `empty`, `timelineTitle`, and column header “Not” if we add a notes column.

---

## 4. Summary

| Area | Current state | Proposed direction |
|------|----------------|--------------------|
| **Table layout** | 11 columns, no width limits, `overflow-x-auto` → horizontal scroll | Short headers + tooltips, fixed column widths, slightly smaller inputs → fit in xl without scroll; optional sticky first column. |
| **Notes** | Only generic `notes`/`setup_notes` and audit_logs (no user note per revision) | New table `subscription_price_revision_notes`; per-row “Notes” button on price-revision page opening modal with timeline + add form; optional “revision notes” block on Subscription Detail. |

---

## 5. Open Points / Questions

1. **Short headers:** Are the suggested abbreviations (Müş., H.No, Başl., Ödem., Baz, SMS, Hat, KDV, Maliyet) acceptable for your users, or do you prefer different abbreviations?
2. **Notes – one per revision vs many:** Should we allow multiple notes per subscription per year (e.g. “Ocak notu”, “Mart güncelleme”) or exactly one note per “revision date”?
3. **Notes – revision_date default:** Should “revision date” default to first day of current year (e.g. 2025-01-01) or to “today”?
4. **Bulk “batch note”:** Do you need a single “batch note” (e.g. “2025 toplu zam”) applied to all updated subscriptions when saving, in addition to (or instead of) per-row notes?

Once you confirm these and approve the overall approach, implementation can follow this document (table first, then notes DB + API + UI).

---

## UPDATE: User Answers

1. **Short headers:** ❌ **REJECTED** – User wants full column names.  
   → **See:** [`price-revision-alternatives.md`](./price-revision-alternatives.md) for 6 alternative solutions (Options A-F).

2. **Notes – one per revision vs many:** ✅ **CONFIRMED** – One note per year (one revision per year). Timeline shows all historical notes (2026, 2027, 2028, etc.).

3. **Notes – revision_date default:** ⏳ **PENDING** – Need to decide: first day of current year (e.g. 2025-01-01) or "today"?

4. **Bulk "batch note":** ✅ **NO** – Not needed. Only per-row notes.

**Next step:** User must choose one table layout solution from the alternatives document.
