# Finance Module — Master Specification (v3.4)

**Document Version:** 3.4
**Date:** February 12, 2026
**Status:** Master Spec — Final, Ready for Module 1 Implementation
**Implementation Strategy:** Module-by-module build → test → use → next module
**Supersedes:** v3.3, v3.2 (Feb 12), v3.1, v3.0, finance-module-requirements.md (v2.0), finance-module-analysis.md (v1.0)

### v3.4 Changelog

| # | Fix | Severity |
|---|-----|----------|
| 1 | **Base Price Policy documented:** base_price, sms_fee, line_fee are ALWAYS monthly NET amounts. System multiplies by billing frequency automatically | Documentation |
| 2 | **MRR formula simplified:** No CASE/division needed — just `SUM(base_price + sms_fee + line_fee)` since prices are always monthly | Critical |
| 3 | **get_subscription_stats() fixed (00038):** Removed VAT multiplication from MRR, removed unnecessary CASE statement | Critical |
| 4 | **bulk_update_subscription_prices() fixed (00039):** Added 6_month ELSIF — pending payments now get correct `subtotal × 6` | Critical |

### v3.3 Changelog

| # | Fix | Severity |
|---|-----|----------|
| 1 | 6-month billing added: migration 00037, frontend updated, spec updated | Module 0.5 |
| 2 | All billing_frequency references now handle 3 values: monthly, 6_month, yearly | Structural |

### v3.2 Changelog

| # | Fix | Severity |
|---|-----|----------|
| 1 | MRR: must be calculated from `subscriptions` table (not `subscription_payments`) with `/12` for yearly | Critical |
| 2 | v_profit_and_loss: subscription COGS now billing-frequency-aware | Critical |
| 3 | billing_frequency: documented as `monthly` / `yearly` only — 6-month resolved in v3.3 | Moderate |
| 4 | sim_cards: confirmed inventory-only for Modules 1–9, no revenue calculation | Moderate |
| 5 | Added Appendix D: Billing Frequency Reference with yearly edge cases | Documentation |

### v3.1 Changelog

| # | Fix | Severity |
|---|-----|----------|
| 1 | RLS policy: removed `OR true` — admin/accountant only | Critical |
| 2 | Flow 2 (SIM fees): marked PENDING VERIFICATION — duplication risk | Critical |
| 3 | MRR formula: changed `total_amount` → `amount` (net, KDV haric) | Critical |
| 4 | COGS: unified to Option A (per-sale from proposal_items only) | Critical |
| 5 | `cost_usd` fallback: confirmed valid — field exists on proposal_items | Corrected |
| 6 | `period` field: changed to GENERATED column | Moderate |
| 7 | Added "amount_try is always NET" clarification section | Moderate |
| 8 | `should_invoice`/`has_invoice`: added direction-based NULL convention | Moderate |
| 9 | Restructured from Phase-based to Module-based (14 modules) | Structural |
| 10 | EBITDA, DSO, Cash Conversion moved to Module 14 | Moderate |

---

## 1. Executive Summary

### Project Overview

The Finance Module consolidates all financial tracking for Ornet ERP into a single source of truth, replacing the current Excel-based system. It supports mixed accounting (official + unofficial), automatic VAT calculation, dual currency (USD/TRY), and a unified P&L dashboard.

### Scope

| In Scope (Modules 1–9) | Out of Scope (Modules 10+) |
|---|---|
| Income/expense ledger | Full double-entry accounting |
| 4 confirmed revenue flows + 1 pending verification | Parasut API integration |
| VAT management (20%, official/unofficial) | Bank statement OCR |
| Currency conversion (TCMB manual) | Invoice automation |
| P&L dashboard + KPI cards | Cash flow forecasting |
| Quick entry forms | Excel export |

### Key Metrics

| Metric | Target |
|--------|--------|
| Daily manual entries | 35–50 (down from 60–70) |
| Revenue streams unified | 4 confirmed + 1 pending |
| VAT accuracy | 100% auto-calculated |
| Excel replacement | Full |
| 3-view reporting | Total / Official / Unofficial |

---

## 2. Business Context

### Company Profile

- Turkish security/alarm company
- ~1M TRY annual revenue
- 2,500+ SIM cards in the field
- Mixed accounting: resmi (official) + gayriresmi (unofficial)
- Current system: 100% manual Excel tracking

### Current Pain Points

1. **Data duplication** — Bank → Excel, expense recorded twice
2. **Manual reconciliation** — Line-by-line credit card checks
3. **No integration** — Excel, Parasut, ERP disconnected
4. **No automation** — VAT, currency, P&L all manual
5. **No history** — No month-over-month or trend analysis
6. **Currency chaos** — USD pricing, manual TRY conversion

### What We Replace

The monthly Excel spreadsheet:

```
DATE | CUSTOMER | PAYMENT | JOB TYPE | COST | INPUT VAT | SALES | SALES VAT | TOTAL | PROFIT | VAT
```

Every row becomes a `financial_transactions` record or `subscription_payments` entry, connected to ERP entities.

---

## 3. Current System Analysis

### Existing Tables — Finance-Relevant Fields

| Table | Finance-Relevant Fields | Notes |
|-------|------------------------|-------|
| **subscription_payments** | `amount`, `vat_amount`, `total_amount`, `payment_month`, `status`, `should_invoice`, `payment_vat_rate`, `payment_method` | Recurring revenue — auto-generated |
| **subscriptions** | `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`, `currency`, `service_type` | `line_fee` = SIM fee component |
| **proposals** | `total_amount_usd`, `currency`, `site_id` | Revenue source — manual link |
| **proposal_items** | `cost_usd`, `product_cost_usd`, `labor_cost_usd`, `material_cost_usd`, `shipping_cost_usd`, `misc_cost_usd`, `unit_price_usd`, `quantity` | COGS calculation |
| **work_orders** | `amount`, `currency`, `proposal_id`, `site_id` | Optional link for income |
| **sim_cards** | `cost_price`, `sale_price`, `customer_id`, `site_id`, `status` | Bulk rental — projected revenue only |
| **customers** | `id`, `company_name` | Reference |
| **customer_sites** | `id`, `account_no`, `site_name` | Reference |

### Service Types (subscriptions)

- `alarm_only`, `camera_only`, `internet_only`

### Billing Frequencies (subscriptions)

| Value | Behavior | Payment Records | Notes |
|-------|----------|----------------|-------|
| `monthly` | 12 records/year, each = 1 month's amount | `amount = subtotal` | Default |
| `6_month` | 2 records/year, each = 6 months' amount | `amount = subtotal × 6` | Added in migration 00037 |
| `yearly` | 1 record/year, = 12 months' amount | `amount = subtotal × 12` | Annual upfront |

CHECK constraint: `billing_frequency IN ('monthly', '6_month', 'yearly')` (migrations 00022 + 00037).

### Base Price Policy (CRITICAL)

**RULE:** `base_price`, `sms_fee`, `line_fee` are ALWAYS entered as **monthly NET amounts** (KDV haric), regardless of billing frequency.

The system multiplies by billing frequency automatically in `generate_subscription_payments()`:

| billing_frequency | User enters (monthly) | System creates payment |
|---|---|---|
| `monthly` | base_price = 1,000 | 12 × 1,000 = 1,000/month |
| `6_month` | base_price = 1,000 | 2 × 6,000 = 6,000/6-months |
| `yearly` | base_price = 1,000 | 1 × 12,000 = 12,000/year |

**All three result in 12,000/year.** The only difference is billing frequency.

**Evidence:**
1. `generate_subscription_payments()` multiplies `subtotal × v_multiplier` (6 or 12)
2. `subscriptions_detail` view: `profit = monthly_gross - cost` (no frequency multiplier)
3. `SubscriptionPricingCard.jsx`: `profit = subtotal - cost` (monthly - monthly)
4. Form UI shows same pricing fields regardless of billing_frequency

**Implication for MRR:** Since prices are always monthly, MRR = `SUM(base_price + sms_fee + line_fee)` — no division needed.

### subscriptions.cost Semantics

The `cost` field is always a **monthly** operational cost, regardless of `billing_frequency`:

| billing_frequency | cost meaning | Revenue per payment | COGS per payment |
|-------------------|-------------|--------------------|--------------------|
| `monthly` | Monthly cost | `subtotal` (1 month) | `cost` (1 month) |
| `6_month` | Monthly cost | `subtotal × 6` (6 months) | `cost × 6` (6 months) |
| `yearly` | Monthly cost | `subtotal × 12` (12 months) | `cost × 12` (12 months) |

**Evidence:** `subscriptions_detail` view calculates `profit = monthly_gross_revenue - cost`. If cost were yearly, profit would be negative for most subscriptions.

### Amount Convention — Always NET (KDV Haric)

All financial amounts in Ornet ERP are stored as **NET** amounts (KDV haric):

| Source | Field | Type |
|--------|-------|------|
| subscriptions | `base_price`, `sms_fee`, `line_fee`, `cost` | NET |
| subscription_payments | `amount` = NET, `vat_amount` = VAT, `total_amount` = GROSS |
| proposals | `total_amount_usd` | NET |
| proposal_items | `unit_price_usd`, `cost_usd`, all 5 cost fields | NET |
| work_orders | `amount` | NET |
| financial_transactions | `amount_original`, `amount_try` | NET |

**Rule:** Database always stores NET separately from VAT. Invoices show: `NET + VAT = GROSS`.

### Proposal Items COGS Formula

```
COGS per item:
  IF any of (product_cost_usd, labor_cost_usd, material_cost_usd, shipping_cost_usd, misc_cost_usd) filled:
    Total COGS = SUM(product_cost_usd + labor_cost_usd + material_cost_usd + shipping_cost_usd + misc_cost_usd) × quantity
  ELSE:
    Total COGS = cost_usd × quantity
```

Both `cost_usd` (simple, from 00027) and the 5 detailed fields (from 00029) exist on `proposal_items`. The detailed fields take priority when present.

---

## 4. Revenue Sources — 4 Confirmed Flows + 1 Pending

### Flow 1: Subscriptions (Auto)

**Source:** `subscription_payments`
**Trigger:** Payment recorded in subscription module (status = `paid`)

```
subscriptions.base_price + sms_fee + line_fee → generate_subscription_payments()
→ subscription_payments (amount, vat_amount, total_amount, payment_month)
→ v_profit_and_loss (source_type = 'subscription')
```

**Fields used:** `amount` (NET), `vat_amount`, `payment_month`, `should_invoice`, `payment_vat_rate`
**Currency:** TRY
**Auto/Manual:** Auto-generated

---

### Flow 2: Subscription SIM Fees (line_fee) — PENDING VERIFICATION

> **VERIFIED (v3.2): No duplication risk at the database level.**
>
> SIM cards have TWO revenue sources, but they are **disconnected in the database**:
> - **Type A:** SIM fees embedded in subscriptions (`subscriptions.line_fee` → `subscription_payments`)
> - **Type B:** Bulk SIM rentals from `sim_cards` table → manual entry to `financial_transactions`
>
> **Database evidence:** `sim_cards` table has NO `subscription_id` FK. `subscriptions` table has NO FK to `sim_cards`.
> The two systems are completely independent. No join path exists between them.
>
> **Revenue rules for Modules 1–9:**
> - Subscription SIM revenue: ONLY via `subscriptions.line_fee` → `subscription_payments` (Flow 1)
> - Bulk rental SIM revenue: Manual `financial_transactions` entry (Flow 3)
> - `sim_cards` table: **Inventory tracking ONLY** — never used for revenue calculation
>
> **Remaining risk:** A physical SIM card could exist in BOTH tables (as `sim_cards` row AND as part of a subscription's `line_fee`).
> This is a business process issue, not a database issue. Users must ensure they don't double-enter revenue.
> Module 10+ could add `subscription_id` FK to `sim_cards` for reconciliation.

**Source:** `subscriptions.line_fee` via `subscription_payments`
**Note:** SIM fee is not a separate line item; it is embedded in subscription pricing. When user enters `line_fee` (Hat Ucreti), it flows to `subscription_payments` as part of `amount`.
**Currency:** TRY
**Auto/Manual:** Auto (same as Flow 1)

---

### Flow 3: Bulk SIM Rentals (Manual)

**Source:** `financial_transactions`
**Trigger:** User manually creates income transaction

```
User references sim_cards table for pricing (sale_price = monthly fee per card)
→ User creates financial_transactions (direction = 'income', income_type = 'sim_rental')
→ Links: customer_id, optional description "10 SIM - Company X"
→ v_profit_and_loss
```

**Important:** The `sim_cards` table is used as **inventory reference only**. Revenue is NOT auto-calculated from `sim_cards.sale_price`. The user manually enters the total amount.

**Modules 1–9:** Manual entry. User sums N cards × sale_price, enters as one transaction.
**Module 10+:** Subscription automation (one subscription per corporate SIM rental).
**Currency:** TRY
**Auto/Manual:** Manual

---

### Flow 4: Accepted Proposals (Manual + COGS)

**Source:** `financial_transactions` + COGS from `proposal_items`
**Trigger:** User creates income after proposal accepted

```
proposals (total_amount_usd) → financial_transactions (direction = 'income', proposal_id)
COGS: SUM(proposal_items cost fields) × quantity → financial_transactions.cogs_try (USD → TRY via exchange_rates)
→ v_profit_and_loss
```

**COGS calculation (Option A — per-sale):** Query `proposal_items` where `proposal_id = X`:
- If 5 detailed cost fields present: `SUM(product_cost_usd + labor_cost_usd + material_cost_usd + shipping_cost_usd + misc_cost_usd) × quantity`
- Fallback: `SUM(cost_usd × quantity)`
- Convert USD → TRY via `exchange_rates`

**Currency:** USD → TRY (exchange_rates)
**Auto/Manual:** Manual entry, COGS auto-derived from proposal_items

---

### Flow 5: Completed Work Orders (Manual)

**Source:** `financial_transactions`
**Trigger:** User creates income after work order completed

```
work_orders (amount, currency, proposal_id)
→ User creates financial_transactions (direction = 'income', work_order_id, optional proposal_id)
→ COGS: If proposal_id present → from proposal_items; else manual cogs_try
→ v_profit_and_loss
```

**Link:** `work_order_id` FK on `financial_transactions`.
**COGS:** Via `proposal_id` → `proposal_items` (Option A). If no linked proposal, user enters `cogs_try` manually.
**Currency:** TRY (work_orders) or USD if from proposal
**Auto/Manual:** Manual

---

## 5. Database Schema

### 5.1 financial_transactions

```sql
CREATE TABLE financial_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Direction
  direction             TEXT NOT NULL CHECK (direction IN ('income', 'expense')),

  -- For income: type of revenue
  income_type           TEXT CHECK (income_type IN (
    'subscription', 'sim_rental', 'sale', 'service', 'installation', 'maintenance', 'other'
  )),

  -- Amount (dual storage) — ALWAYS NET (KDV haric)
  amount_original       DECIMAL(12,2) NOT NULL,
  original_currency     TEXT NOT NULL DEFAULT 'TRY' CHECK (original_currency IN ('USD', 'TRY')),
  amount_try            DECIMAL(12,2) NOT NULL,
  exchange_rate         DECIMAL(10,4),

  -- VAT (direction-dependent, see convention below)
  -- Income: should_invoice is used, has_invoice must be NULL
  -- Expense: has_invoice is used, should_invoice must be NULL
  should_invoice        BOOLEAN,
  has_invoice           BOOLEAN,
  output_vat            DECIMAL(12,2),
  input_vat             DECIMAL(12,2),
  vat_rate              DECIMAL(5,2) DEFAULT 20,

  -- COGS (for income only — Option A: per-sale from proposal_items)
  cogs_try              DECIMAL(12,2),

  -- Period (auto-derived from transaction_date)
  period                TEXT GENERATED ALWAYS AS (to_char(transaction_date, 'YYYY-MM')) STORED,

  -- Core fields
  transaction_date      DATE NOT NULL,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  site_id               UUID REFERENCES customer_sites(id) ON DELETE SET NULL,
  description           TEXT,
  payment_method        TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),
  reference_no          TEXT,

  -- Links
  work_order_id         UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  proposal_id           UUID REFERENCES proposals(id) ON DELETE SET NULL,

  -- Invoice (Module 13+)
  invoice_no            TEXT,
  invoice_type          TEXT CHECK (invoice_type IN ('e_fatura', 'e_arsiv', 'kagit')),
  parasut_invoice_id    TEXT,

  -- Meta
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Direction-based flag convention:
  -- Income rows:  should_invoice = true/false, has_invoice = NULL
  -- Expense rows: has_invoice = true/false, should_invoice = NULL
  CONSTRAINT chk_direction_flags CHECK (
    (direction = 'income'  AND has_invoice IS NULL)
    OR
    (direction = 'expense' AND should_invoice IS NULL)
  )
);

CREATE INDEX idx_ft_direction ON financial_transactions(direction);
CREATE INDEX idx_ft_period ON financial_transactions(period);
CREATE INDEX idx_ft_date ON financial_transactions(transaction_date);
CREATE INDEX idx_ft_customer ON financial_transactions(customer_id);
CREATE INDEX idx_ft_work_order ON financial_transactions(work_order_id);
CREATE INDEX idx_ft_proposal ON financial_transactions(proposal_id);
CREATE INDEX idx_ft_should_invoice ON financial_transactions(should_invoice) WHERE should_invoice IS NOT NULL;
CREATE INDEX idx_ft_has_invoice ON financial_transactions(has_invoice) WHERE has_invoice IS NOT NULL;

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: admin and accountant have full access; field_worker cannot see financial data
CREATE POLICY "ft_select" ON financial_transactions FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_insert" ON financial_transactions FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_update" ON financial_transactions FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "ft_delete" ON financial_transactions FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
```

### 5.2 expense_categories

```sql
CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name_tr     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  icon        TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 10 default categories
INSERT INTO expense_categories (code, name_tr, name_en, is_system, sort_order) VALUES
  ('material', 'Malzeme / Ekipman', 'Material / Equipment', true, 1),
  ('sim_operator', 'Operator Faturaları', 'SIM Card Operator Bills', true, 2),
  ('fuel', 'Yakıt', 'Fuel', true, 3),
  ('payroll', 'Personel Maaşı', 'Payroll', true, 4),
  ('rent', 'Kira', 'Rent / Office', true, 5),
  ('utilities', 'Elektrik / Su / Doğalgaz', 'Utilities', true, 6),
  ('communication', 'Haberleşme', 'Communication', true, 7),
  ('vehicle', 'Araç Giderleri', 'Vehicle Expenses', true, 8),
  ('fixed_assets', 'Demirbaş', 'Fixed Assets', true, 9),
  ('other', 'Diğer', 'Other', true, 10);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_select" ON expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec_manage" ON expense_categories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));

-- Add category to financial_transactions (expense only)
ALTER TABLE financial_transactions ADD COLUMN expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_ft_expense_category ON financial_transactions(expense_category_id);
```

### 5.3 exchange_rates

```sql
CREATE TABLE exchange_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency        TEXT NOT NULL DEFAULT 'USD',
  buy_rate        DECIMAL(10,4),
  sell_rate       DECIMAL(10,4),
  effective_rate  DECIMAL(10,4) NOT NULL,
  rate_date       DATE NOT NULL,
  source          TEXT DEFAULT 'TCMB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency, rate_date)
);

CREATE INDEX idx_exchange_rate_date ON exchange_rates(rate_date DESC);
CREATE INDEX idx_exchange_currency ON exchange_rates(currency);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "er_select" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "er_manage" ON exchange_rates FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
```

### 5.4 v_profit_and_loss (UNION view)

```sql
CREATE OR REPLACE VIEW v_profit_and_loss AS
-- Subscription payments (recurring revenue)
SELECT
  sp.id::TEXT AS source_id,
  'subscription' AS source_type,
  'income' AS direction,
  sp.payment_month AS period_date,
  to_char(sp.payment_month, 'YYYY-MM') AS period,
  cs.customer_id,
  sub.site_id,
  sp.amount AS amount_try,           -- NET (KDV haric)
  sp.vat_amount AS output_vat,
  NULL::DECIMAL AS input_vat,
  sp.should_invoice AS is_official,
  'TRY' AS original_currency,
  sp.amount AS amount_original,
  NULL::DECIMAL AS exchange_rate,
  -- COGS: cost is always monthly, multiply by billing period months
  CASE
    WHEN sub.billing_frequency = 'yearly' THEN sub.cost * 12
    WHEN sub.billing_frequency = '6_month' THEN sub.cost * 6
    ELSE sub.cost
  END AS cogs_try,
  sp.payment_method,
  sp.created_at
FROM subscription_payments sp
JOIN subscriptions sub ON sp.subscription_id = sub.id
JOIN customer_sites cs ON sub.site_id = cs.id
WHERE sp.status = 'paid'

UNION ALL

-- Financial transactions (income)
SELECT
  ft.id::TEXT,
  COALESCE(ft.income_type, 'other'),
  'income',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  ft.amount_try,                     -- NET (KDV haric)
  ft.output_vat,
  NULL,
  ft.should_invoice,                 -- is_official for income
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  ft.cogs_try,                       -- Per-sale COGS (Option A)
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
WHERE ft.direction = 'income'

UNION ALL

-- Financial transactions (expense)
SELECT
  ft.id::TEXT,
  ec.code,
  'expense',
  ft.transaction_date,
  ft.period,
  ft.customer_id,
  ft.site_id,
  -ft.amount_try,                    -- Negative for P&L summation
  NULL,
  ft.input_vat,
  ft.has_invoice,                    -- is_official for expense
  ft.original_currency,
  ft.amount_original,
  ft.exchange_rate,
  NULL,                              -- No COGS on expenses
  ft.payment_method,
  ft.created_at
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ft.expense_category_id = ec.id
WHERE ft.direction = 'expense';

GRANT SELECT ON v_profit_and_loss TO authenticated;
```

---

## 6. VAT System

### Rules

- **Output VAT:** 20% on official income (`should_invoice = true`)
- **Input VAT:** 20% if `has_invoice = true`, else 0%
- **Net VAT Payable:** `Output VAT - Input VAT`

### Official vs Unofficial

| Income | Flag | VAT |
|--------|------|-----|
| Official | `should_invoice = true` | Output VAT calculated |
| Unofficial | `should_invoice = false` | No VAT |

| Expense | Flag | VAT |
|---------|------|-----|
| Official | `has_invoice = true` | Input VAT 20% deductible |
| Unofficial | `has_invoice = false` | Input VAT 0% |

### Formulas

All amounts are **NET** (KDV haric). VAT is calculated on top:

```
output_vat = amount_try × (vat_rate / 100)   WHEN should_invoice = true
input_vat  = amount_try × (vat_rate / 100)   WHEN has_invoice = true

Monthly Output VAT = SUM(output_vat) FROM official income
Monthly Input VAT  = SUM(input_vat) FROM official expenses
Net VAT Payable    = Output VAT - Input VAT
```

### Examples

**Official expense + official sale:**
```
Expense: 1,000 TL (net) + 200 TL input VAT = 1,200 TL gross
Sale:    2,000 TL (net) + 400 TL output VAT = 2,400 TL gross
Net VAT: 400 - 200 = 200 TL payable
Profit:  2,000 - 1,000 = 1,000 TL
```

**Unofficial expense + official sale:**
```
Expense: 1,000 TL (net) + 0 TL input VAT (no invoice)
Sale:    2,000 TL (net) + 400 TL output VAT
Net VAT: 400 TL (full, no deduction)
Profit:  2,000 - 1,000 = 1,000 TL
```

---

## 7. Currency System

### Rules

- **Subscriptions:** TRY
- **One-time sales / proposals:** USD default
- **Expenses:** TRY
- **Bulk SIM rental:** TRY

### Dual Storage

| Field | Purpose |
|-------|---------|
| `amount_original` | Business amount, NET (USD or TRY) |
| `original_currency` | 'USD' or 'TRY' |
| `amount_try` | Legal amount, NET, always TRY |
| `exchange_rate` | Rate used (null if TRY) |

### Conversion

```
amount_try = amount_original × exchange_rate  (when original_currency = 'USD')
amount_try = amount_original                   (when original_currency = 'TRY')
```

### TCMB API

- **Endpoint:** https://evds2.tcmb.gov.tr/service/evds/
- **Series:** TP.DK.USD.S.YTL
- **Modules 1–9:** Manual rate entry in UI
- **Module 10+:** Daily cron sync

### Table: exchange_rates

| Column | Purpose |
|--------|---------|
| currency | 'USD' |
| buy_rate, sell_rate | TCMB rates |
| effective_rate | Sell rate (invoicing) |
| rate_date | Business day |
| source | 'TCMB' |

---

## 8. UI/UX Specification

### 8.1 Tab-Based Structure

| Tab | Route | Content |
|-----|-------|---------|
| **Dashboard** | /finance | KPIs, charts, summary |
| **Gelirler** | /finance/income | Income list, quick entry |
| **Giderler** | /finance/expenses | Expense list, quick entry |
| **KDV** | /finance/vat | VAT summary report |
| **Kur** | /finance/exchange | Exchange rate management |
| **Raporlar** | /finance/reports | P&L, exports |

### 8.2 3-View Mode Toggle (CRITICAL)

**Applies to:** Dashboard, Gelirler, Giderler, KDV, Raporlar

| Mode | Filter |
|------|--------|
| **TOPLAM** | All transactions |
| **SADECE RESMI** | `should_invoice = true` (income), `has_invoice = true` (expense) |
| **SADECE GAYRI RESMI** | `should_invoice = false` (income), `has_invoice = false` (expense) |

**UI:** Segmented control or pill buttons at top of each financial view. Default: TOPLAM.

### 8.3 Quick Entry Form

- **Trigger:** Floating action button (FAB) or keyboard shortcut (e.g. Ctrl+N)
- **Position:** Slide-over or modal
- **Fields (expense):** date, amount, category, payment method, has_invoice, description, vat_rate
- **Fields (income):** date, amount, income_type, customer, payment method, should_invoice, work_order_id (optional), proposal_id (optional), original_currency, exchange_rate (if USD)
- **Smart defaults:**
  - Date: today
  - Currency: TRY (expense), USD (income from proposal), TRY (income from subscription/sim)
  - VAT rate: 20%
  - Income: `should_invoice = true`, `has_invoice = NULL` (enforced by CHECK)
  - Expense: `has_invoice = true`, `should_invoice = NULL` (enforced by CHECK)
- **After save:** Form resets, keeps date + category for batch entry
- **Tab order:** Optimized for tab-tab-tab-enter

### 8.4 Dashboard Layout

```
+-------------------------------------------------------------+
| [TOPLAM] [SADECE RESMI] [SADECE GAYRI RESMI]  [+ Hizli Giris] |
+-------------------------------------------------------------+
| KPI Cards (row 1)                                            |
| [MRR] [ARPC] [Gross Margin] [Net Profit] [VAT Payable] ...  |
+-------------------------------------------------------------+
| Revenue vs Expenses (chart)                                  |
+-------------------------------------------------------------+
| Recent Transactions | Top Customers | Expense by Category    |
+-------------------------------------------------------------+
```

---

## 9. COGS — Unified Approach (Option A: Per-Sale)

### Decision

**COGS is always per-sale, derived from `proposal_items` cost fields.** Operational expenses (materials, SIM operator bills, fuel, etc.) are NOT treated as COGS — they are operating expenses.

### How It Works

| Revenue Source | COGS Method |
|----------------|-------------|
| Subscription (monthly) | `subscriptions.cost` (monthly cost, used as-is) |
| Subscription (6_month) | `subscriptions.cost × 6` (cost is monthly, payment covers 6 months) |
| Subscription (yearly) | `subscriptions.cost × 12` (cost is monthly, payment covers 12 months) |
| Proposal income | Auto-calculated from `proposal_items` (5 detailed fields or `cost_usd` fallback) |
| Work order income | Via linked `proposal_id` → `proposal_items`. If no proposal, user enters `cogs_try` manually |
| Bulk SIM rental | User enters `cogs_try` manually (e.g., operator cost per card × quantity) |

### COGS Auto-Calculation (Proposals)

```sql
-- When user creates income from proposal_id = X:
SELECT COALESCE(
  -- Try 5 detailed fields first
  SUM(
    COALESCE(product_cost_usd, 0) +
    COALESCE(labor_cost_usd, 0) +
    COALESCE(material_cost_usd, 0) +
    COALESCE(shipping_cost_usd, 0) +
    COALESCE(misc_cost_usd, 0)
  ) * quantity,
  -- Fallback to cost_usd
  SUM(COALESCE(cost_usd, 0) * quantity)
) AS total_cogs_usd
FROM proposal_items
WHERE proposal_id = :proposal_id;

-- Convert to TRY:
-- cogs_try = total_cogs_usd × exchange_rate
```

### Gross Profit Formula

```
Gross Profit = Revenue (amount_try) - COGS (cogs_try)
Gross Margin % = Gross Profit / Revenue × 100
```

**Important:** Expense categories (material, fuel, etc.) are operating expenses. They appear in the P&L below the Gross Profit line, not as COGS.

---

## 10. KPI Dashboard — 6 Core KPIs (Modules 1–9)

### Core KPIs

| # | KPI | Formula |
|---|-----|---------|
| 1 | **MRR** (Monthly Recurring Revenue) | From `subscriptions` table: `SUM(base_price + sms_fee + line_fee)` WHERE `status = 'active'` — prices are always monthly, no division needed |
| 2 | **ARPC** (Avg Revenue Per Customer) | `MRR / COUNT(DISTINCT customer_id) FROM active subscriptions` |
| 3 | **Gross Margin %** | `(Revenue - COGS) / Revenue × 100` using `cogs_try` from v_profit_and_loss |
| 4 | **Net Profit** | `SUM(amount_try) FROM v_profit_and_loss` (income positive, expense negative) |
| 5 | **VAT Payable** | `SUM(output_vat) - SUM(input_vat) WHERE is_official = true` |
| 6 | **Material Cost %** | `SUM(cogs_try) / Revenue × 100` |

### Advanced KPIs (Module 14)

| # | KPI | Requires |
|---|-----|----------|
| 7 | **CLV** (Customer Lifetime Value) | Subscription history analysis |
| 8 | **EBITDA** | Depreciation, amortization, interest, tax expense categories |
| 9 | **Cash Conversion Cycle** | AR/AP tracking (Module 10) |
| 10 | **DSO** (Days Sales Outstanding) | AR tracking (Module 10) |
| 11 | **Cash Runway** | Bank accounts (Module 11) |
| 12 | **Revenue Per Technician** | `Total Revenue / COUNT(profiles WHERE role = field_worker)` |

### SQL for Core KPIs

```sql
-- KPI 1: MRR (from subscriptions table, NET — KDV haric)
-- base_price, sms_fee, line_fee are ALWAYS monthly amounts.
-- No CASE statement needed. No division. No VAT.
-- Cannot use subscription_payments (non-monthly subs store period totals).
SELECT COALESCE(SUM(base_price + sms_fee + line_fee), 0) AS mrr
FROM subscriptions
WHERE status = 'active';

-- KPI 3: Gross Margin (current month from v_profit_and_loss)
WITH monthly AS (
  SELECT
    SUM(CASE WHEN direction = 'income' THEN amount_try ELSE 0 END) AS revenue,
    SUM(CASE WHEN direction = 'income' THEN COALESCE(cogs_try, 0) ELSE 0 END) AS total_cogs
  FROM v_profit_and_loss
  WHERE period = to_char(CURRENT_DATE, 'YYYY-MM')
)
SELECT
  revenue,
  total_cogs,
  revenue - total_cogs AS gross_profit,
  CASE WHEN revenue > 0
    THEN (revenue - total_cogs) / revenue * 100
    ELSE 0
  END AS gross_margin_pct
FROM monthly;

-- KPI 5: Net VAT Payable (current month, official only)
SELECT
  COALESCE(SUM(CASE WHEN direction = 'income' THEN output_vat ELSE 0 END), 0) AS total_output_vat,
  COALESCE(SUM(CASE WHEN direction = 'expense' THEN input_vat ELSE 0 END), 0) AS total_input_vat,
  COALESCE(SUM(CASE WHEN direction = 'income' THEN output_vat ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN direction = 'expense' THEN input_vat ELSE 0 END), 0) AS net_vat_payable
FROM v_profit_and_loss
WHERE is_official = true AND period = to_char(CURRENT_DATE, 'YYYY-MM');
```

---

## 11. Data Flow Diagrams

### Revenue Flow

```
                    +---------------------+
                    | subscription_payments|
                    | (status=paid)       |
                    +----------+----------+
                               |
                               v
+--------------+    +----------------------+    +-----------------+
| subscriptions |-->|   v_profit_and_loss  |--->| P&L Dashboard   |
| (cost=COGS)  |   |   (UNION ALL)        |   | KPI Cards       |
+--------------+    +----------------------+    +-----------------+
                               ^
+--------------+    +----------+----------+
| work_orders  |--->| financial_transactions |
| proposals    |   | (direction=income)    |
+--------------+    | (cogs_try=per-sale)  |
                    +----------------------+
```

### COGS Calculation (Option A: Per-Sale)

```
proposal (accepted)
    |
    v
proposal_items --> IF 5 detailed fields present:
    |                SUM(product + labor + material + shipping + misc) x qty
    |              ELSE:
    |                SUM(cost_usd x qty)
    v
total_cogs_usd x exchange_rate --> financial_transactions.cogs_try (TRY)
```

### Expense Entry Flow

```
User --> Quick Entry Form
    |         |
    |         +-- date, amount_try (NET), category, has_invoice, vat_rate
    |         |
    |         v
    |    financial_transactions (direction=expense, should_invoice=NULL)
    |         |
    |         +-- input_vat auto-calculated: amount_try x vat_rate/100 IF has_invoice
    |         |
    v         v
    +--> v_profit_and_loss --> P&L / VAT Report
```

### P&L Structure

```
Revenue (Gelir)
  - Subscriptions (auto from subscription_payments)
  - Proposals (manual, from financial_transactions)
  - Work Orders (manual, from financial_transactions)
  - SIM Rentals (manual, from financial_transactions)
  = Total Revenue

- COGS (Maliyet) — from cogs_try on income rows
  = Gross Profit (Brut Kar)

- Operating Expenses (Giderler) — from financial_transactions WHERE direction='expense'
  - Material / Equipment
  - SIM Operator Bills
  - Fuel
  - Payroll
  - Rent
  - Utilities
  - Communication
  - Vehicle
  - Fixed Assets
  - Other
  = Total Operating Expenses

= Net Profit (Net Kar) = Gross Profit - Operating Expenses
```

---

## 12. Module-Based Implementation Plan — 14 Modules

**Philosophy:** Build → Test → Use → Next module. Each module is independently deployable and testable. No rush. Must be solid and error-free.

---

### Module 1: Core Tables

**Goal:** Create the 3 foundation tables + the P&L view.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Create migration `financial_transactions` | `00040_financial_transactions.sql` |
| 2 | Create migration `expense_categories` + seed | `00041_expense_categories.sql` |
| 3 | Create migration `exchange_rates` | `00042_exchange_rates.sql` |
| 4 | Create `v_profit_and_loss` view | `00043_v_profit_and_loss.sql` |
| 5 | Run migrations, verify tables, test RLS | Manual Supabase validation |

**Test:** Insert sample row, verify `period` auto-generated, CHECK constraint works, RLS blocks field_worker.

---

### Module 2: Data Layer (API + Hooks + Schema)

**Goal:** Feature folder with full CRUD for all 3 tables.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Create `src/features/finance/` folder structure | api.js, hooks.js, schema.js, index.js |
| 2 | API: financial_transactions CRUD | fetchTransactions, createTransaction, updateTransaction, deleteTransaction |
| 3 | API: expense_categories CRUD | fetchCategories, createCategory, updateCategory |
| 4 | API: exchange_rates CRUD | fetchRates, createRate, getLatestRate |
| 5 | API: v_profit_and_loss query | fetchProfitAndLoss(period, viewMode) |
| 6 | Hooks: React Query hooks for all API functions | ~15 hooks |
| 7 | Schema: Zod validation schemas | transactionSchema, categorySchema, rateSchema |

**Test:** Import hooks in a test page, verify data fetching works.

---

### Module 3: Expense Entry

**Goal:** Quick expense entry form with category and VAT.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | ExpenseEntryModal (slide-over or modal) | QuickEntryModal.jsx |
| 2 | Fields: date, amount, category, payment_method, has_invoice, description, vat_rate | react-hook-form + zod |
| 3 | Auto-calculate input_vat on save | `amount_try × vat_rate / 100` when `has_invoice = true` |
| 4 | Smart defaults: today, TRY, 20%, has_invoice=true | Pre-filled form |
| 5 | Batch-friendly: reset form, keep date + category | UX optimization |

**Test:** Create 10 expenses rapidly, verify v_profit_and_loss shows them.

---

### Module 4: Income Entry

**Goal:** Income entry form with proposal/work order linking and COGS auto-fill.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | IncomeEntryModal | QuickEntryModal.jsx (direction toggle or separate) |
| 2 | Fields: date, amount, income_type, customer, payment_method, should_invoice, currency | react-hook-form + zod |
| 3 | Optional links: proposal_id, work_order_id (searchable selects) | Customer/Proposal/WO pickers |
| 4 | COGS auto-fill: when proposal_id selected, query proposal_items | Auto-populate cogs_try |
| 5 | USD support: currency toggle, exchange_rate field, auto-calculate amount_try | Dual currency |

**Test:** Create income from proposal, verify COGS auto-calculated. Create manual income, verify cogs_try editable.

---

### Module 5: Transaction Lists (Gelirler + Giderler)

**Goal:** List pages for income and expenses with filters.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | IncomeListPage (/finance/income) | Table with filters |
| 2 | ExpenseListPage (/finance/expenses) | Table with filters |
| 3 | Filters: period (month picker), customer, category, payment_method | Filter bar |
| 4 | 3-view mode toggle component | ViewModeToggle.jsx (reusable) |
| 5 | Edit/delete actions on each row | Inline actions |

**Test:** 3-view mode correctly filters official/unofficial. Period filter works.

---

### Module 6: VAT Report

**Goal:** KDV tab showing output, input, net VAT by period.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | VatReportPage (/finance/vat) | VAT summary page |
| 2 | Monthly breakdown: output VAT, input VAT, net payable | Table or cards |
| 3 | 3-view mode (official only is the main use case) | ViewModeToggle integration |
| 4 | Period selector (month/quarter) | Date range filter |

**Test:** Verify Net VAT = Output - Input. Official view shows only invoiced transactions.

---

### Module 7: Currency Management

**Goal:** Exchange rate manual entry + lookup.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | ExchangeRatePage (/finance/exchange) | Rate management page |
| 2 | Add rate form: date, buy_rate, sell_rate, effective_rate | Entry form |
| 3 | Rate history table | Sortable table |
| 4 | getLatestRate() helper for income entry | API function |

**Test:** Add USD rate for today, create USD income, verify TRY conversion correct.

---

### Module 8: Dashboard + KPIs

**Goal:** Finance dashboard with 6 core KPIs.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | FinanceDashboardPage (/finance) | Dashboard layout |
| 2 | 6 KPI cards: MRR, ARPC, Gross Margin, Net Profit, VAT Payable, Material Cost % | KpiCard.jsx |
| 3 | Revenue vs Expenses chart (by month) | Simple bar/line chart |
| 4 | Recent transactions widget | Last 10 entries |
| 5 | Expense by category widget | Pie or bar chart |
| 6 | 3-view mode on dashboard | ViewModeToggle |

**Test:** Verify MRR = `SUM(base_price + sms_fee + line_fee)` from `subscriptions` table (no division — prices are always monthly NET). Gross Margin uses cogs_try (not expense categories).

---

### Module 9: Routes, Nav, i18n + P&L Report

**Goal:** Wire everything together, add translations, basic P&L report.

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Routes: /finance/* (6 sub-routes) | App.jsx integration |
| 2 | Nav item: Finance (sidebar + mobile) | navItems.js |
| 3 | i18n: src/locales/tr/finance.json | All labels, placeholders |
| 4 | Register namespace in i18n.js | i18n wiring |
| 5 | P&L report page (/finance/reports) | ReportsPage.jsx |
| 6 | P&L structure: Revenue → COGS → Gross Profit → OpEx → Net Profit | Period-based report |
| 7 | Mobile-responsive all pages | Responsive testing |
| 8 | Quick entry FAB + keyboard shortcut (Ctrl+N) | Global FAB component |

**Test:** Full end-to-end: create income + expense, view dashboard, check VAT report, generate P&L.

---

### Module 10: Collection Tracking & Accounts Receivable

| # | Task | Deliverable |
|---|------|-------------|
| 1 | `payment_status` on financial_transactions | 'pending', 'paid', 'partial', 'overdue' |
| 2 | `due_date`, `paid_date` fields | Date tracking |
| 3 | AR aging report | 30/60/90 days buckets by customer |
| 4 | Customer credit limit | Optional `customers.credit_limit_try` |
| 5 | Collection dashboard | Overdue by customer, total outstanding AR |

---

### Module 11: Bank Accounts & Cash Flow

| # | Task | Deliverable |
|---|------|-------------|
| 1 | `bank_accounts` table | Company bank accounts (name, IBAN, bank_name, currency, is_active) |
| 2 | Bank balance tracking | Opening balance, running balance per account |
| 3 | Cash on hand / petty cash | Optional flag on bank_accounts |
| 4 | Cash flow statement | Operating / investing / financing sections |
| 5 | Bank reconciliation module | Match transactions to bank statement rows |

---

### Module 12: Withholding Tax (Tevkifat)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | `customers.is_withholding_agent` | BOOLEAN — belirlenmiş alıcı flag |
| 2 | financial_transactions columns | `withholding_applicable`, `withholding_rate`, `withholding_code`, `withholding_amount`, `net_vat_collected` |
| 3 | Auto withholding | Apply when customer is belirlenmiş alıcı AND invoice > 15,000 TRY |
| 4 | Withholding code 607 | Security services (guvenlik hizmetleri) |
| 5 | Withholding certificate tracking | Optional table for tevkifat makbuzları |

---

### Module 13: Parasut API Integration

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Auto-invoice from proposals | "Generate Invoice" → USD→TRY, VAT, push to Parasut |
| 2 | Auto-invoice from work orders | Same flow for completed work orders |
| 3 | e-Fatura / e-Arsiv | Push to Parasut API, receive invoice ID |
| 4 | Invoice status sync | Parasut status → ERP (sent, paid, etc.) |
| 5 | Parasut expense import | Pull purchase invoices for expense matching |

---

### Module 14: Advanced KPIs & Reporting

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Add depreciation, amortization, interest, tax expense categories | Enable EBITDA calculation |
| 2 | EBITDA KPI | Revenue - COGS - OpEx + Depreciation + Amortization |
| 3 | CLV (Customer Lifetime Value) | AVG(months_active) × ARPC |
| 4 | DSO (Days Sales Outstanding) | (AR / Revenue) × 30 — requires Module 10 |
| 5 | Cash Conversion Cycle | DSO + Days Inventory - Days Payable — requires Module 10+11 |
| 6 | Cash Runway | Cash / Monthly Burn — requires Module 11 |
| 7 | Revenue Per Technician | Total Revenue / COUNT(field_workers) |
| 8 | Forecasting & budget vs actual | Revenue/expense projections |
| 9 | TCMB API auto-sync (daily cron) | Automated exchange rates |

---

## 13. Success Criteria

### Modules 1–9 (Core Finance)

- [ ] `financial_transactions`, `expense_categories`, `exchange_rates` created with correct RLS
- [ ] `v_profit_and_loss` returns correct UNION, amounts are NET
- [ ] `period` auto-generated from `transaction_date`
- [ ] Direction CHECK constraint enforces `should_invoice`/`has_invoice` convention
- [ ] Income form: create with customer, work_order_id, proposal_id, auto COGS
- [ ] Expense form: create with category, has_invoice, auto input_vat
- [ ] 3-view mode works on all financial views
- [ ] Dashboard shows 6 core KPIs
- [ ] MRR calculated from `subscriptions` table (NET) — `SUM(base_price + sms_fee + line_fee)`, no division needed
- [ ] COGS = per-sale (Option A), NOT expense categories
- [ ] Gross Margin uses `cogs_try` from income rows
- [ ] VAT summary shows output, input, net (official transactions only)
- [ ] Quick entry: tab flow, smart defaults, batch-friendly
- [ ] 35–50 entries/day manageable
- [ ] Excel spreadsheet no longer needed for daily tracking

### Overall

- [ ] All 4 confirmed revenue flows documented and traceable
- [ ] Flow 2 (SIM fees) researched and resolved (no duplication)
- [ ] VAT auto-calculated (official/unofficial)
- [ ] USD/TRY dual storage functional
- [ ] Monthly P&L one-click
- [ ] Historical comparison (this month vs last month)

### Modules 10–14 Success Criteria

- [ ] One-time receivables tracked (payment_status, due_date, paid_date)
- [ ] AR aging report functional
- [ ] Company bank accounts created
- [ ] Cash flow statement generated
- [ ] Withholding tax auto-calculated for belirlenmiş alıcı
- [ ] Parasut API integrated (auto-invoicing)
- [ ] EBITDA, DSO, Cash Runway KPIs operational
- [ ] TCMB API auto-sync (daily)

---

## Appendix A: Key Decisions

| Decision | Rationale |
|----------|-----------|
| 3-view mode on ALL reports | Turkish SMB reality — must separate resmi/gayriresmi |
| Tab-based UI | Clear navigation, matches mental model |
| Bulk SIM manual entry (Modules 1–9) | No subscription type for sim_rental yet; iterate in Module 10+ |
| COGS = Option A (per-sale) | Avoids double-counting with operating expenses. Each income carries its own cost |
| `cost_usd` fallback valid | Field exists on proposal_items (00027), 5 detailed fields added later (00029) |
| Module-based implementation | Build → test → use → next. No rush. Solid and error-free |
| Quick entry 35–50/day | User volume from requirements |
| TCMB manual (Modules 1–9) | Avoid API key/cron setup initially |
| `period` GENERATED column | Prevents date/period mismatch. One source of truth |
| `should_invoice`/`has_invoice` CHECK | Prevents confusion: income uses should_invoice, expense uses has_invoice |
| RLS: admin/accountant only | Financial data is sensitive, field workers should not access |
| SIM revenue: VERIFIED | No DB link between sim_cards and subscriptions. sim_cards = inventory only. No duplication at DB level |
| MRR from subscriptions table | subscription_payments stores period totals — can't use for MRR. Prices are always monthly, so MRR = SUM(base_price + sms_fee + line_fee) with no division |
| billing_frequency: monthly, 6_month, yearly | 3 frequencies supported. 6-month added in migration 00037 (Module 0.5) |
| All amounts NET (KDV haric) | Consistent with existing tables. VAT stored separately |
| EBITDA/DSO/Cash Runway in Module 14 | Require infrastructure from Modules 10–11 first |

---

## Appendix B: File Structure

```
src/features/finance/
├── api.js                        # Supabase API calls (3 tables + view)
├── hooks.js                      # React Query hooks (~15 hooks)
├── schema.js                     # Zod schemas (transaction, category, rate)
├── index.js                      # Barrel exports
├── FinanceDashboardPage.jsx      # Module 8: Dashboard + 6 KPIs
├── IncomeListPage.jsx            # Module 5: Income transactions list
├── ExpenseListPage.jsx           # Module 5: Expense transactions list
├── VatReportPage.jsx             # Module 6: VAT summary
├── ExchangeRatePage.jsx          # Module 7: Exchange rate management
├── ReportsPage.jsx               # Module 9: P&L report
├── components/
│   ├── QuickEntryModal.jsx       # Module 3+4: Income/Expense entry form
│   ├── ViewModeToggle.jsx        # Module 5: 3-view mode (toplam/resmi/gayriresmi)
│   ├── KpiCard.jsx               # Module 8: Single KPI card
│   └── FinanceKPICards.jsx       # Module 8: All 6 KPI cards
└── ...

src/locales/tr/finance.json       # Module 9: All Turkish translations
```

---

## Appendix C: subscription.cost Semantics — VERIFIED

The `subscriptions.cost` field represents the **monthly operational cost** of maintaining a subscription (e.g., SIM data plan cost, monitoring center fee).

**Evidence:** `subscriptions_detail` view (migration 00022) calculates:
```sql
profit = (base_price + sms_fee + line_fee) * (1 + vat_rate / 100) - cost
```
Profit = monthly_gross_revenue - cost. If cost were yearly, profit would be negative. Therefore cost is monthly.

**In v_profit_and_loss:**
- Monthly subscriptions: `cogs_try = cost` (1 month revenue, 1 month cost)
- Yearly subscriptions: `cogs_try = cost × 12` (12 months revenue, 12 months cost)

---

## Appendix D: Billing Frequency Reference

### How generate_subscription_payments() Works

**Source:** `00022_subscription_target_fields.sql` (original), updated by `00041_add_6_month_billing.sql`

```
Monthly subscription (base_price=1000, sms_fee=50, line_fee=30, vat_rate=20):
  subtotal = 1080
  vat = 216
  total = 1296
  → Creates 12 records: each with amount=1080, vat_amount=216, total_amount=1296

6-Month subscription (base_price=1000, sms_fee=50, line_fee=30, vat_rate=20):
  subtotal = 1080
  vat = 216
  total = 1296
  → Creates 2 records: each with amount=6480, vat_amount=1296, total_amount=7776

Yearly subscription (base_price=1000, sms_fee=50, line_fee=30, vat_rate=20):
  subtotal = 1080
  vat = 216
  total = 1296
  → Creates 1 record: amount=12960, vat_amount=2592, total_amount=15552
```

### Why MRR Cannot Use subscription_payments

| billing_frequency | Records/Year | amount per record | SUM for current month | Actual MRR |
|-------------------|-------------|-------------------|----------------------|------------|
| monthly | 12 | 1,080 | 1,080 | 1,080 |
| 6_month | 2 | 6,480 | 6,480 (if payment month) or 0 (other months) | 1,080 |
| yearly | 1 | 12,960 | 12,960 (if payment month) or 0 (other months) | 1,080 |

Using `SUM(subscription_payments.amount)` for MRR would show inflated amounts in payment months and 0 in other months for non-monthly subscriptions. This is wrong — MRR should be constant at 1,080/month regardless of billing frequency.

**Solution:** Calculate MRR from `subscriptions` table directly. Since base_price/sms_fee/line_fee are ALWAYS monthly, no division is needed:
```sql
SELECT COALESCE(SUM(base_price + sms_fee + line_fee), 0) AS mrr
FROM subscriptions WHERE status = 'active';
```

### Impact on Other KPIs

| KPI | Uses subscription_payments? | Non-monthly handling |
|-----|---------------------------|-----------------|
| MRR | NO — uses subscriptions table | No division needed — prices are always monthly |
| ARPC | NO — derived from MRR | Inherits MRR logic |
| Gross Margin | YES — via v_profit_and_loss | `cogs_try = cost × 12` (yearly), `cost × 6` (6_month) |
| Net Profit | YES — via v_profit_and_loss | amount_try already correct (full billing period) |
| VAT Payable | YES — via v_profit_and_loss | vat_amount already correct (full billing period) |

### 6-Month Subscriptions — IMPLEMENTED (Module 0.5)

**Status:** Fully supported as of migration `00037_add_6_month_billing.sql`.

**Changes made:**
1. **Migration 00037:** Added `'6_month'` to billing_frequency CHECK constraint, rewrote `generate_subscription_payments()` with multiplier/payments/interval pattern
2. **Migration 00038:** Fixed `get_subscription_stats()` — MRR now NET, no division
3. **Migration 00039:** Fixed `bulk_update_subscription_prices()` — added 6_month handling
4. **Frontend schema.js:** `BILLING_FREQUENCIES = ['monthly', '6_month', 'yearly']`
5. **Frontend importUtils.js:** Added 6-month mappings for bulk import
6. **UI components:** SubscriptionDetailPage, SiteCard, PriceRevisionPage updated for 3 frequencies
7. **i18n:** Added `"6_month": "6 Aylik"` translations
8. **MRR:** `SUM(base_price + sms_fee + line_fee)` — no division needed since prices are always monthly
9. **v_profit_and_loss:** `cogs_try = cost × 6` for 6_month subscriptions

---

**End of Master Specification**
