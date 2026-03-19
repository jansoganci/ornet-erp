# SIM Profit Discrepancy Analysis

**Observed:** App profit 28,914 TL vs Excel 25,750 TL (~3,164 TL higher) and 18 rows missing.

---

## 1. View Logic (NULL Handling)

**Current view definition** (`view_sim_card_financials`):

```sql
COALESCE(SUM(sale_price - cost_price), 0) as total_monthly_profit
FROM sim_cards WHERE status = 'active';
```

**PostgreSQL behavior:**
- `sale_price - NULL` → `NULL` (NULL propagates)
- `SUM()` ignores NULLs
- So rows with `cost_price = NULL` contribute **nothing** to profit (undercount, not overcount)
- Rows with `cost_price = 0` contribute **full sale_price** as profit

**Conclusion:** The ~3,200 TL gap is **not** from NULL handling. It points to **zero-cost SIMs** (cost_price = 0) where Excel has a non-zero cost.

---

## 2. Zero-Cost SIMs (Most Likely Cause)

If Excel has cost values that are:
- Empty or invalid → import rejects the row (missing cost error)
- Parsed as 0 (e.g. "0", "0,00", or a format `parseCurrency` misreads) → row is imported with `cost_price = 0`

**Effect:** Each such SIM adds `sale_price` as profit instead of `sale_price - cost_price`. If Excel’s cost for those rows is ~3,200 TL total, that explains the gap.

**Action:** Run Query 1 in `sim-profit-diagnostic.sql` and sum the `profit` column. If that sum is ~3,200 TL, these rows are the cause.

---

## 3. Import Logic (18 Missing Rows)

**Validation (rows rejected before insert):**
- Missing phone → error
- Missing provider → error  
- Missing cost (`parseCurrency` returns null) → error
- Missing sale (`parseCurrency` returns null) → error

**Duplicate filter (rows skipped silently):**
- Phone exists in DB → skipped
- Phone already seen in file → skipped
- IMSI exists in DB or in file → skipped

**`parseCurrency` behavior:**
- Empty, null, "" → `null` → row rejected
- "0", "0,00", "0.00" → `0` → stored as 0
- "50,5", "50.5", "50 ₺" → parsed number

**Possible causes of 18 missing rows:**
1. **Validation errors** – missing phone/provider/cost/sale (shown in import UI)
2. **Duplicates** – same phone in Excel twice, or phone already in DB
3. **Header mismatch** – column names not in `headerMap`, so cost/sale not mapped and treated as missing

**Phone comparison:** Uses `trim().toLowerCase()`. Different formats (e.g. "0555 123 4567" vs "5551234567") are treated as different. So:
- Same number, different formats → both can be inserted (if DB allows)
- Same number, same format, twice in file → second skipped as duplicate

---

## 4. Diagnostic Steps

1. Run all queries in `docs/active/sim-profit-diagnostic.sql` in Supabase SQL Editor.
2. From Query 1: Sum `profit` for zero-cost SIMs. If ≈ 3,164 TL → these rows explain the gap.
3. From Query 2: Compare top 20 with Excel; check for cost_price = 0 where Excel has cost.
4. From Query 4: Confirm no duplicate `phone_number` in DB.
5. Re-import with validation errors visible; count how many rows are rejected and why.

---

## 5. Recommended Fixes

| Issue | Fix |
|-------|-----|
| Zero-cost inflating profit | In Excel, ensure cost column is filled and parses correctly. Or add import validation: warn when `cost_price = 0` and `sale_price > 0`. |
| View NULL safety | Change view to `SUM(COALESCE(sale_price,0) - COALESCE(cost_price,0))` for consistent behavior with NULLs. |
| 18 missing rows | Add import summary: "X valid, Y rejected (errors), Z skipped (duplicates)" and list rejected rows. |
| Cost parse failure | Log or show which rows had cost/sale parsed as 0 so you can verify against Excel. |

---

## 6. Quick Check (Run in SQL Editor)

```sql
-- Zero-cost SIMs total profit (likely equals the 3,164 TL gap)
SELECT COALESCE(SUM(sale_price), 0) AS inflated_profit
FROM sim_cards
WHERE deleted_at IS NULL AND status = 'active'
  AND (cost_price IS NULL OR cost_price = 0)
  AND COALESCE(sale_price, 0) > 0;
```

If `inflated_profit` ≈ 3,164 TL, zero-cost SIMs are the cause.
