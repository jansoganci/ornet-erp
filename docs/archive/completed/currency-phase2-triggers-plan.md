# Phase 2: Finance Triggers – Currency Flexibility

> **Scope**: TRY and USD only. Update finance triggers to use new columns (`total_amount`, `unit_price`, `cost`, etc.) and document currency.  
> **Prerequisite**: Phase 1 migration (00051) applied.

---

## 1. Overview

| Trigger | Table | Change |
|---------|-------|--------|
| `auto_record_proposal_revenue` | proposals | Use `total_amount` + `currency`; COGS from `cost`, `product_cost`, etc. |
| `auto_record_work_order_revenue` | work_orders | Materials use `unit_price`, `cost`; currency from `work_orders.currency` |

Both triggers must respect document currency (TRY or USD) and convert to TRY correctly for `financial_transactions`.

---

## 2. Conversion Logic (Shared)

| Currency | amount_try | exchange_rate |
|----------|------------|---------------|
| TRY | amount_original | NULL |
| USD | ROUND(amount_original * rate, 2) | from exchange_rates |

---

## 3. Proposal Trigger: auto_record_proposal_revenue

**File**: New migration `00052_finance_triggers_currency.sql`

### 3.1 Revenue (total)

**Current** (00047):
```sql
v_total_usd := COALESCE(NEW.total_amount_usd, 0);
-- ... always treats as USD, fetches rate, converts
```

**New**:
- `v_total_orig := COALESCE(NEW.total_amount, NEW.total_amount_usd)` — prefer new column, fallback for app not yet updated
- `v_currency := UPPER(COALESCE(NEW.currency, 'USD'))`
- If TRY: `v_amount_try = v_total_orig`, `v_rate = NULL`
- If USD: fetch rate, `v_amount_try = ROUND(v_total_orig * v_rate, 2)`
- Insert: `amount_original = v_total_orig`, `original_currency = v_currency`, `amount_try = v_amount_try`, `exchange_rate = v_rate`

### 3.2 COGS (from proposal_items)

**Current** (00047): Uses `cost_usd`, `product_cost_usd`, etc. — always USD.

**New**:
- Sum from `cost`, `product_cost`, `labor_cost`, `material_cost`, `shipping_cost`, `misc_cost`
- Fallback: `COALESCE(pi.cost, pi.cost_usd)` etc. for transition period
- Same COGS logic: if any of 5 detail fields filled → sum them; else use `COALESCE(pi.cost, pi.cost_usd)`
- `v_cogs_orig` is in `proposals.currency`
- Conversion: same as revenue (TRY → no conversion; USD → fetch rate)

### 3.3 INSERT values

| Field | Revenue | COGS expense |
|-------|---------|-------------|
| amount_original | v_total_orig | v_cogs_orig |
| original_currency | v_currency (from proposal) | v_currency |
| amount_try | v_amount_try | v_cogs_try |
| exchange_rate | v_rate (NULL if TRY) | v_rate (NULL if TRY) |

---

## 4. Work Order Trigger: auto_record_work_order_revenue

**Same migration file**

### 4.1 Revenue – header amount (amount > 0)

**Current**: Already uses `NEW.currency`. No change.

### 4.2 Revenue – from materials (amount = 0)

**Current** (00049):
```sql
SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0) INTO v_subtotal_usd
...
v_currency := 'USD';
```

**New**:
- `SELECT COALESCE(SUM(wom.quantity * wom.unit_price), SUM(wom.quantity * wom.unit_price_usd), 0)` — prefer new, fallback
- `v_currency := UPPER(COALESCE(NEW.currency, 'TRY'))` — from document, not hardcoded USD
- Conversion: same shared logic (TRY → no conversion; USD → fetch rate)

### 4.3 COGS (work_order_materials)

**Current** (00049):
```sql
SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0) INTO v_cogs_usd
...
v_currency = 'USD' for expense
```

**New**:
- `v_cogs_orig := COALESCE(SUM(quantity * cost), SUM(quantity * cost_usd), 0)` — prefer `cost`, fallback `cost_usd`
- `v_currency := UPPER(COALESCE(NEW.currency, 'TRY'))` — same as revenue
- Conversion: TRY → no conversion; USD → fetch rate

### 4.4 Variable rename

Rename `v_cogs_usd` → `v_cogs_orig` (or keep and use for converted value). The COGS amount in original currency comes from materials; we convert to TRY for `amount_try` and `financial_transactions`.

---

## 5. Migration Structure

**File**: `supabase/migrations/00052_finance_triggers_currency.sql`

```sql
-- 1. Replace auto_record_proposal_revenue()
CREATE OR REPLACE FUNCTION auto_record_proposal_revenue() ...

-- 2. Replace auto_record_work_order_revenue()
CREATE OR REPLACE FUNCTION auto_record_work_order_revenue() ...
```

No trigger recreation needed — triggers already exist and call these functions. `CREATE OR REPLACE FUNCTION` updates the function body.

---

## 6. Backfill Considerations

**Proposal trigger**: No backfill — it fires on status change to `completed`. Existing completed proposals already have finance records (idempotency check).

**Work order trigger**: 00049 includes a backfill DO block. Phase 2 migration should NOT re-run that backfill (would create duplicates). The DO block in 00049 runs once. Our migration only replaces the function; no new backfill.

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| `total_amount` = 0 and `total_amount_usd` > 0 | Use `COALESCE(NEW.total_amount, NEW.total_amount_usd)` |
| `unit_price` = 0 and `unit_price_usd` > 0 (materials) | Use `COALESCE(wom.unit_price, wom.unit_price_usd)` or COALESCE in SUM |
| `cost` NULL, `cost_usd` filled | Use `COALESCE(pi.cost, pi.cost_usd)` |
| Missing exchange rate for USD | Keep existing fallback: `v_rate := 1` if NULL |
| `currency` NULL or invalid | Default: proposals → 'USD', work_orders → 'TRY' |

---

## 8. Summary of Column Mapping

| Source | Old (current) | New (Phase 2) |
|--------|---------------|---------------|
| Proposal revenue | total_amount_usd | COALESCE(total_amount, total_amount_usd) |
| Proposal currency | (implicit USD) | proposals.currency |
| Proposal COGS | cost_usd, product_cost_usd, ... | COALESCE(cost, cost_usd), COALESCE(product_cost, product_cost_usd), ... |
| WO revenue (header) | amount, currency | (unchanged) |
| WO revenue (materials) | unit_price_usd, v_currency='USD' | unit_price / unit_price_usd, work_orders.currency |
| WO COGS | cost_usd, 'USD' | cost / cost_usd, work_orders.currency |

---

*Ready for implementation.*
