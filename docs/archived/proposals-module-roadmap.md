This is the translated and refined technical roadmap, keeping your specific operational logic (Manual approval, 1:N work orders, and the "Invoicing?" decision point) at the core.

---

# Proposal Management Module — Technical Roadmap

**Date:** February 9, 2026

**Scope:** USD-based pricing, TCMB (Central Bank) FX integration, manual approval → multiple work orders → invoicing logic → financial records + Paraşüt.

**UI Language:** Turkish Only.

---

## 1. Data Schema & Logic

### 1.1 Audit Trail Rule

* **USD Amount** and **Exchange Rate** must be stored in separate columns.
* Do not store only the converted TRY value; storing the original currency + rate is mandatory for audit and precision.

### 1.2 Proposal Numbering

* **Format:** `DD.MM.YYYY-NNNN` (e.g., `09.02.2026-0001`).
* Combination of Date + daily (or general) sequence; stored as `proposal_no`.

### 1.3 Proposed Tables

**`proposals`**

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → customer_sites |
| `status` | enum | draft, sent, approved, rejected |
| `proposal_no` | TEXT | Format: DD.MM.YYYY-NNNN |
| `title` | TEXT | Title of the proposal |
| `currency` | TEXT | 'USD' (Fixed) |
| `total_amount_usd` | DECIMAL(12,2) | Total USD amount |
| `exchange_rate` | DECIMAL(12,6) | TCMB rate locked at approval/invoicing (null while draft) |
| `exchange_rate_date` | DATE | The date the FX rate was pulled from TCMB |
| `total_amount_try` | DECIMAL(12,2) | total_amount_usd * exchange_rate (Audit column) |
| `approved_at` | TIMESTAMPTZ | Timestamp when marked as "Approved" in system |
| `approved_by` | UUID | FK → profiles (Admin who updated the status) |
| `created_by` | UUID | FK → profiles |

* **No Expiration:** The `valid_until` field is removed.
* **Manual Approval:** Clients do not approve within the system. Admin creates proposal → downloads PDF → sends manually. Once the client accepts externally, Admin manually updates the status to "Approved."

**`proposal_items`**

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | PK |
| `proposal_id` | UUID | FK → proposals |
| `sort_order` | INT | Item sequence |
| `description` | TEXT | Item description |
| `quantity` | DECIMAL(12,2) | Quantity |
| `unit_price_usd` | DECIMAL(12,2) | Unit price in USD |
| `total_usd` | DECIMAL(12,2) | quantity * unit_price_usd |
| `margin_percent` | DECIMAL(5,2) | Margin % (Admin view only) |

**`exchange_rates` (TCMB)**

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | PK |
| `currency` | TEXT | 'USD' |
| `buy_rate` | DECIMAL(12,6) | Buying rate |
| `sell_rate` | DECIMAL(12,6) | Selling rate (Used for invoices/proposals) |
| `rate_date` | DATE | Date of the rate |
| `source` | TEXT | 'TCMB' |

### 1.4 Work Order Logic (1 Proposal → N Work Orders)

* One proposal can generate **multiple installation work orders** (e.g., a 3-day job requires 3 separate dates/orders).
* Add **`proposal_id`** to the `work_orders` table.
* **Flow:** From an "Approved" proposal, click "Add Work Order" to open one or more entries for different dates.

### 1.5 Invoicing Logic

* When an installation is completed, the system asks: **"Should we invoice?"**
* **If Yes:** Apply **20% VAT**. Convert the USD amount to TRY using the rate, add VAT, and sync with the internal finance system + Paraşüt.
* **If No:** Use **VAT-exclusive** price. Local financial record only (not sent to Paraşüt).

---

## 2. TCMB Integration

* **Source:** TCMB EVDS (USD Selling Rate).
* **Trigger:** Display "Current Rate" on the proposal/invoice screen. Lock the rate at the moment of invoice approval.
* **Fallback:** If TCMB is unreachable, allow manual rate entry or "Try again later."

---

## 3. Main Workflow

1. **Creation:** Admin selects Customer/Site. **If missing:** Add via Customer/Site tabs (modals/inline) without leaving the page. Save as draft, download PDF, and send manually.
2. **Manual Approval:** Once client accepts via email/phone, Admin marks as "Approved."
3. **Work Orders:** Create one or multiple installation orders linked to the proposal.
4. **Completion:** Team finishes installation; Admin clicks **"Installation Completed."**
5. **The "Invoicing?" Redirect:** System redirects the user to the **"Invoice / Revenue Entry"** page.
* **Yes:** Pull current TCMB rate. Display: "Current Rate: X.XXXX TRY." Calculate VAT (20%). User can **revise** amounts or the rate. Approval creates a financial transaction + Paraşüt sync.
* **No:** VAT-exclusive; local record only.



---

## 4. UI/UX (Minimalist / Turkish)

* **Admin Dashboard:** Dropdown + "+" button for missing customers/sites. Quick-add items, USD-only entry, and a "Show current TRY value" info toggle.
* **PDF Generation:** Simple, clean, typography-focused Turkish PDF.
* **Invoice Page:** The system forces this screen after completion. It must show the "Invoice?" toggle clearly with editable rate/total fields.

---

## 5. Technical Summary Table

| Feature | Decision |
| --- | --- |
| **Proposal No** | `DD.MM.YYYY-NNNN` (Stored in DB) |
| **In-line Entry** | Add Customers/Sites without page refresh |
| **Approval** | Manual (Admin marks as approved) |
| **Relation** | 1 Proposal → N Work Orders (`proposal_id` link) |
| **Invoicing** | Triggered after installation; supports VAT toggle + Manual revision |
| **Language** | 100% Turkish UI |

---

**Next Step:** Would you like me to generate the **SQL Migration** for these specific tables or the **TypeScript/React** logic for the "Add Customer" modal that keeps the user on the proposal page