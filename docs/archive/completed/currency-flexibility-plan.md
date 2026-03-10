# Currency Flexibility Plan

> **Status**: Planning only — no implementation yet.  
> **Goal**: Add currency selection for Proposals and Work Orders; remove strict USD assumption for all amounts (sale prices, material cost, labor cost, etc.).

---

## 1. Current Problem

| Area | Current Behavior | Issue |
|------|------------------|-------|
| **Proposals** | All amounts (unit price, costs) stored as `*_usd`, always interpreted as USD | User cannot enter TRY, EUR, CHF, etc. |
| **Work Orders** | Header `amount` has `currency`; line items (`unit_price_usd`, `cost_usd`) always USD | Mixed: header can be TRY, but materials always USD |
| **Finance flow** | Converts USD → TRY using exchange rate | If user enters 1000 TRY in cost field, system treats as 1000 USD → wrong conversion to ~40,000 TRY |

**User need**: Enter any currency (TRY, USD, EUR, CHF, etc.) for sale prices AND costs. System must respect the chosen currency and convert correctly to TRY for financial records.

---

## 2. Design Decision: Document-Level Currency

**Approach**: One currency per document (proposal or work order). All amounts in that document use the same currency.

- **Proposal**: `proposals.currency` — all item prices and costs in that proposal use this currency
- **Work Order**: `work_orders.currency` — header amount and all material prices/costs use this currency

**Rationale**: 
- Simpler UX (one selector per form)
- Typical business practice (one quote/invoice = one currency)
- Reduces complexity vs per-item currency

**Future extension**: Per-item currency could be added later if needed (each line has its own currency).

---

## 3. Supported Currencies

| Code | Name | Exchange to TRY |
|------|------|-----------------|
| TRY | Turkish Lira | No conversion (base) |
| USD | US Dollar | Via `exchange_rates` |
| EUR | Euro | Via `exchange_rates` |
| CHF | Swiss Franc | Via `exchange_rates` |

**Extensibility**: Keep currency list configurable (e.g. in a constant or settings table) so more can be added later.

---

## 4. Database Changes

### 4.1 Proposals

| Table | Current | New |
|-------|---------|-----|
| `proposals` | `currency` (default USD), `total_amount_usd` | Keep `currency`; add `total_amount` (DECIMAL) in document currency. Deprecate or repurpose `total_amount_usd` |
| `proposal_items` | `unit_price_usd`, `total_usd` (generated), `cost_usd`, `product_cost_usd`, `labor_cost_usd`, `material_cost_usd`, `shipping_cost_usd`, `misc_cost_usd` | Rename to `unit_price`, `cost`, `product_cost`, `labor_cost`, `material_cost`, `shipping_cost`, `misc_cost` — all in document currency |

**Migration strategy for proposals**:
1. Add new columns: `total_amount`, `unit_price`, `cost`, `product_cost`, `labor_cost`, `material_cost`, `shipping_cost`, `misc_cost`
2. Copy: `unit_price = unit_price_usd`, `cost = cost_usd`, etc.; `total_amount = total_amount_usd` where `currency = 'USD'`
3. For existing rows: set `proposals.currency = 'USD'` (they are all USD today)
4. Drop generated column `total_usd`; add new generated `line_total` = `quantity * unit_price`
5. Drop old `*_usd` columns

### 4.2 Work Orders

| Table | Current | New |
|-------|---------|-----|
| `work_orders` | `currency` (default TRY), `amount` | Already correct — no schema change |
| `work_order_materials` | `unit_price_usd`, `cost_usd` | Rename to `unit_price`, `cost` — amounts in `work_orders.currency` |

**Migration strategy for work_order_materials**:
1. Add `unit_price`, `cost`
2. Copy: `unit_price = unit_price_usd`, `cost = cost_usd`
3. Drop `unit_price_usd`, `cost_usd`

### 4.3 Financial Transactions

| Current | New |
|--------|-----|
| `original_currency` CHECK IN ('USD', 'TRY') | Expand: `CHECK (original_currency IN ('TRY', 'USD', 'EUR', 'CHF'))` or use a more flexible check |

### 4.4 Exchange Rates

| Current | New |
|---------|-----|
| Table has `currency`, `effective_rate` — supports any currency | Ensure exchange_rates has rows for USD, EUR, CHF (rate = 1 unit of that currency = X TRY). TRY typically doesn't need a row (1 TRY = 1 TRY). |

---

## 5. Finance Trigger Changes

### 5.1 Proposal Revenue (`auto_record_proposal_revenue`)

**Current**: Always uses `total_amount_usd`, treats as USD, fetches USD rate, converts to TRY.

**New**:
1. Use `proposals.total_amount` (or computed from items) and `proposals.currency`
2. If `currency = 'TRY'`: `amount_try = total_amount`, `exchange_rate = NULL`
3. If `currency` in ('USD','EUR','CHF'): fetch rate for that currency from `exchange_rates`, `amount_try = total_amount * rate`

### 5.2 Proposal COGS (same trigger)

**Current**: Sum of `cost_usd`, `product_cost_usd`, etc. — all treated as USD.

**New**: Sum of `cost`, `product_cost`, etc. — all in `proposals.currency`. Same conversion logic: TRY→no conversion; others→fetch rate and convert.

### 5.3 Work Order Revenue (`auto_record_work_order_revenue`)

**Current**: Already supports `work_orders.currency` for header amount. When amount=0, uses materials → always treats as USD.

**New**:
1. Header amount: Keep current logic (already uses `work_orders.currency`)
2. When amount=0, use materials: `unit_price` and `cost` are in `work_orders.currency` (not USD). Apply same conversion: if TRY no conversion; else fetch rate for that currency.

### 5.4 Work Order COGS (same trigger)

**Current**: `cost_usd` from work_order_materials, always USD.

**New**: `cost` from work_order_materials — currency from `work_orders.currency`. Convert to TRY same way.

---

## 6. Views and Computed Totals

- **proposals_detail**: Uses `p.*` — will include new `total_amount`. Ensure view or application computes `total_amount` from items if we remove `total_amount_usd`
- **proposal_items**: New `line_total` generated column = `quantity * unit_price`
- **work_orders_detail**: No change if we only change work_order_materials columns

---

## 7. API Layer Changes

| File | Change |
|------|--------|
| `proposals/api.js` | Send `unit_price`, `cost`, etc. instead of `*_usd`; use `total_amount` and `currency`; compute total from items in document currency |
| `workOrders/api.js` | Send `unit_price`, `cost` instead of `*_usd` |
| `proposals/hooks.js` | No schema change to hooks; ensure select includes new columns |
| `workOrders/hooks.js` | Same |

---

## 8. UI Changes

### 8.1 Proposal Form

| Location | Change |
|----------|--------|
| **ProposalFormPage** | Add Currency Select at top (with title, scope). Default: USD. Options: TRY, USD, EUR, CHF |
| **ProposalItemsEditor** | Replace hardcoded `$` with dynamic symbol/suffix from `proposals.currency` (₺, $, €, Fr.). Label: "Unit price (TRY)" or "Birim fiyat (USD)" etc. |
| **Cost fields** | Same — show currency from parent, not fixed $ |
| **Totals** | Format with selected currency (formatCurrency(amount, currency)) |

### 8.2 Work Order Form

| Location | Change |
|----------|--------|
| **WorkOrderFormPage** | Add visible Currency Select (currently hidden). Default: TRY. Options: TRY, USD, EUR, CHF. Place near Amount field |
| **Amount field** | Replace hardcoded ₺ with symbol from selected currency |
| **WorkOrderItemsEditor** | Replace hardcoded `$` with symbol from `work_orders.currency` |
| **Cost fields** | Same as proposals |

### 8.3 Detail Pages & PDF

| Location | Change |
|----------|--------|
| **ProposalDetailPage** | Use `proposal.currency` for all formatCurrency calls |
| **ProposalPdf** | Use proposal currency for formatting, not hardcoded USD |
| **WorkOrderDetailPage** | Use `workOrder.currency` for formatting |
| **ProposalsListPage** | `formatCurrency(proposal.total_amount, proposal.currency)` |

---

## 9. Schema & Validation (Zod)

| File | Change |
|------|--------|
| `proposals/schema.js` | Add `currency` to schema; rename `unit_price_usd`→`unit_price`, `cost_usd`→`cost`, etc.; add `CURRENCIES = ['TRY','USD','EUR','CHF']` |
| `workOrders/schema.js` | Add `CURRENCIES`; ensure `currency` in schema; rename item fields to `unit_price`, `cost` |
| `finance/schema.js` | Expand `CURRENCIES` to include EUR, CHF |

---

## 10. i18n

Add translations for:
- Currency names: TRY, USD, EUR, CHF
- Labels: "Currency", "Unit price (currency)", etc.
- Possibly reuse `finance:income.fields.currency` if shared

---

## 11. Exchange Rate Management

- **Exchange rates page**: Already supports `currency` filter. Ensure user can add EUR, CHF rates.
- **Default rates**: When a currency has no rate (e.g. CHF), options:
  - Block finance recording until rate exists
  - Fallback to 1 (risk of wrong data)
  - Show warning and require manual entry

**Recommendation**: Require exchange rate to exist for non-TRY currencies before completing proposal/work order that would trigger finance.

---

## 12. Migration Order (Implementation Phases)

### Phase 1: Database migration
1. New migration: Add new columns to proposals, proposal_items, work_order_materials
2. Copy data from old columns
3. Update views (drop total_usd, add line_total)
4. Expand financial_transactions CHECK
5. Drop old columns (or rename in separate step)

### Phase 2: Finance triggers
1. Update `auto_record_proposal_revenue` to use document currency
2. Update `auto_record_work_order_revenue` (00049) to use document currency for materials

### Phase 3: API & schema
1. Update proposals api.js, schema.js
2. Update workOrders api.js, schema.js
3. Update finance schema if needed

### Phase 4: UI
1. Add currency selector to ProposalFormPage
2. Add currency selector to WorkOrderFormPage (make visible)
3. Update ProposalItemsEditor — dynamic currency symbol
4. Update WorkOrderItemsEditor — dynamic currency symbol
5. Update detail pages, PDF, list pages

### Phase 5: Exchange rates
1. Only USD and TRY
2. Update ExchangeRatePage if needed to support multiple currencies

---

## 13. Files to Touch (Summary)

| Layer | Files |
|-------|------|
| **DB** | New migration(s): proposals, proposal_items, work_order_materials, financial_transactions, views |
| **Triggers** | Migration updating auto_record_proposal_revenue, auto_record_work_order_revenue |
| **API** | proposals/api.js, workOrders/api.js |
| **Schema** | proposals/schema.js, workOrders/schema.js, finance/schema.js |
| **UI** | ProposalFormPage, ProposalItemsEditor, WorkOrderFormPage, WorkOrderItemsEditor, ProposalDetailPage, ProposalPdf, WorkOrderDetailPage, ProposalsListPage |
| **Utils** | lib/utils.js formatCurrency — ensure supports EUR, CHF codes |
| **i18n** | locales/tr/proposals.json, workOrders.json, common.json |

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Existing proposals/work orders break | Migration copies USD values to new columns; old rows stay USD |
| Missing exchange rate for EUR/CHF | Validate before completion; or block finance auto-record until rate exists |
| PDF/legal docs show wrong currency | Ensure ProposalPdf uses proposal.currency |
| Mixed use of old/new columns | Single migration, atomic — no interim state in production |

---

## 15. Open Questions

1. **Per-item currency**: Do you ever need one line in EUR and another in USD in the same proposal? If yes, plan would need per-item `currency` column.
2. **Exchange rate source**: TCMB provides USD, EUR. CHF — manual entry or another source?
3. **Rounding**: When converting to TRY, round to 2 decimals — confirm acceptable.

---

*End of plan. Ready for review before implementation.*
