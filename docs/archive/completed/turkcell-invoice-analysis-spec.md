# Turkcell Invoice Analysis — Specification

**Date:** March 9, 2025  
**Status:** Planning (no development started)  
**Reference PDF:** TURKCELL GPRS HATLAR MART 26.pdf

---

## 1. Overview

This document consolidates the current system, target structure, and requirements for Turkcell GPRS line invoice analysis within Ornet ERP.

**Core idea:** No Excel upload. Inventory already lives in Ornet (`sim_cards`). User uploads only the monthly Turkcell invoice PDF. System compares PDF against inventory and surfaces insights.

---

## 2. Current System (Ornet ERP)

### 2.1 sim_cards Table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| phone_number | TEXT | UNIQUE, 10-digit format varies (+90, 0, raw) |
| operator | enum | TURKCELL, VODAFONE, TURK_TELEKOM |
| capacity | TEXT | e.g. 100MB, 1GB |
| status | enum | available, active, subscription, cancelled |
| buyer_id | UUID | FK → customers |
| customer_id | UUID | FK → customers |
| site_id | UUID | FK → customer_sites |
| cost_price | DECIMAL | Expected monthly cost (₺) |
| sale_price | DECIMAL | Monthly sale price (₺) |
| currency | TEXT | Default TRY |
| notes | TEXT | |
| activation_date, deactivation_date | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | Soft delete |

### 2.2 Relationships

- `subscriptions.sim_card_id` → sim_cards (subscription assignment)
- `buyer_id`, `customer_id`, `site_id` → customers, customer_sites

### 2.3 Current Features

- SIM list, create, edit, delete
- Excel import (bulk create)
- Export to Excel
- Filters: status, operator, search
- Financial views: `view_sim_card_stats`, `view_sim_card_financials`

### 2.4 Known Issues (Current Tool)

| Issue | Description |
|-------|-------------|
| phone_number format | No normalization; DB may have +90, 0, or 10 digits |
| Import duplicate | bulkCreate = INSERT only; no upsert on existing phone_number |
| buyer_name match | Exact match; "Metbel" vs "Metbel Ltd." fails |
| year/month filter | UI sends params but API does not use them |

---

## 3. Target Structure (Turkcell Invoice Analysis)

### 3.1 User Flow

1. User uploads monthly Turkcell invoice PDF (e.g. "TURKCELL GPRS HATLAR MART 26.pdf")
2. System parses PDF → line items (hat no, tariff, amount, KDV, ÖİV)
3. System fetches TURKCELL sim_cards from Ornet
4. System compares: PDF lines vs sim_cards (match key: 10-digit phone)
5. User sees: alerts, tables, charts

### 3.2 Insights to Surface

| Insight | Logic | Meaning |
|---------|-------|---------|
| **Invoice only** | In PDF, not in sim_cards | Turkcell charges for lines not in our inventory → wasted spend (e.g. 5 lines ≈ 1100 ₺/month) |
| **Inventory only** | In sim_cards, not in PDF | Line not on this month's invoice (cancelled? error?) |
| **Price mismatch** | cost_price ≠ invoice amount | Turkcell changed price/tariff without notice |
| **Package overage** | Invoice amount >> expected (e.g. 6 → 1223 ₺) | Line exceeded package limit |
| **Loss-making lines** | sale_price < invoice amount | Losing money on this line |
| **Overall P&L** | Total sale_price vs total invoice | Monthly profit/loss |

### 3.3 Visualization (Planned)

- Summary cards (totals, counts)
- Alert panel (anomalies, invoice-only, loss lines)
- Line table (filterable, sortable)
- Charts (e.g. tariff distribution, P&L over time)

---

## 4. PDF Format (Validated)

### 4.1 Line Format

```
F2-5312148492?M2m Standart Tarifesi#6$6+0.91!0.46
```

**Pattern:** `F2-{10 digits}?{tariff name}#{invoice amount}${payment amount}+{KDV}!{ÖİV}`

**Regex (from Turkcell Cost Clarity):**
```
F2-(\d{10})\?([^#]*)#([\d.]+)\$([\d.]+)\+([\d.]+)!([\d.]+)
```

### 4.2 Observed Values

| Field | Examples |
|-------|----------|
| Tariff | M2m Standart Tarifesi, Kurumsal Blg Internet Tarifesi |
| Amount (M2m) | 4.7, 5, 5.8, 5.9, 6 ₺ |
| Amount (Kurumsal) | 245, 930, 1223 ₺ (package overage) |

### 4.3 Match Key

- PDF: 10-digit hat no (5XXXXXXXXX)
- sim_cards: `phone_number` — must normalize to 10 digits for comparison

---

## 5. Data Sources

| Source | Location | Key Fields |
|--------|----------|------------|
| **Inventory** | Ornet `sim_cards` (operator = TURKCELL) | phone_number, cost_price, sale_price, buyer, customer, site |
| **Invoice** | PDF upload (parsed) | hatNo, tariff, invoiceAmount, paymentAmount, kdv, oiv |

**Match key:** Normalize `phone_number` to 10 digits; compare with PDF `hatNo`.

---

## 6. Gap Analysis

### 6.1 Ornet Has, PDF Provides

| Ornet | PDF | Use |
|-------|-----|-----|
| cost_price | invoice amount | Compare expected vs actual |
| sale_price | — | P&L per line |
| phone_number | hat no | Match key |
| buyer, customer, site | — | Context for alerts |

### 6.2 Ornet Missing (PDF Has)

| Field | In PDF | In Ornet | Note |
|-------|--------|----------|------|
| Tariff | Yes | No | Can show from PDF; optional to store |
| Invoice amount | Yes | No | Per-upload; optional to persist |
| KDV, ÖİV | Yes | No | For display/export |

### 6.3 Optional Persistence

- **Option A:** Session-only (parse → compare → display; no DB write)
- **Option B:** Store invoice records (e.g. `turkcell_invoice_lines` table) for history and trends

---

## 7. Reference: Turkcell Cost Clarity

External repo: https://github.com/jansoganci/turkcell-cost-clarity

**Reusable:**
- PDF parse logic (regex, format)
- Compare algorithm (match, invoice-only, list-only)
- UI patterns (summary cards, anomaly panel, tables)

**Different in Ornet:**
- Inventory from DB (sim_cards), not Excel
- Customer/site/buyer from relations
- Subscription linkage

---

## 8. Next Steps (When Ready)

1. PDF parse library (adapt from Turkcell Cost Clarity)
2. New page: e.g. `/sim-cards/invoice-analysis`
3. API or client-side: fetch sim_cards (TURKCELL), normalize phone_number
4. Compare logic: PDF vs sim_cards
5. UI: summary cards, alerts, table, charts
6. (Optional) DB table for invoice history

---

## 9. Related Docs

- `turkcell-invoice-analysis-vision.md` — Turkish vision summary
- `turkcell-cost-clarity-vs-ornet-comparison.md` — Compatibility analysis
- `./analysis-turkcell-cost-clarity.md` — Turkcell Cost Clarity repo analysis
