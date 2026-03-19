# Debug Prompt: Subscription Excel Import — HAT TL Not Saved + Duplicate Key Error

**Copy everything below the line and paste to an AI assistant. Include the full codebase context or relevant files.**

---

## Problem Summary

1. **HAT TL (sim_amount) not saved:** Excel column "HAT TL" with value 70 is not being stored in `subscriptions.sim_amount`. After import, `sim_amount` stays 0 in the database.
2. **React duplicate key warning:** Console shows `Encountered two children with the same key, 'subtotal'` on the subscriptions list page.

---

## Tech Stack

- React 19 + Vite 7
- Supabase (PostgreSQL)
- xlsx (SheetJS) for Excel parsing

---

## Data Flow

1. User uploads .xlsx → `parseXlsxFile()` in `importUtils.js`
2. `validateAndMapRows()` maps Excel columns to payload (base_price, sim_amount, etc.)
3. `importSubscriptionsFromRows()` in `importApi.js` sends payload to `bulk_import_subscriptions` RPC
4. RPC inserts into `subscriptions` table, then calls `generate_subscription_payments()`
5. List page reads from `subscriptions_detail` view (includes subtotal, sim_tl)

---

## Excel Format (User's Actual File)

Headers (tab-separated):
```
TÜR | MERKEZ | ACC. | MÜŞTERİ | LOKASYON | ABONE UNVANI | BAŞLANGIÇ | TL | SMS TL | HAT TL | MALIYET | ODEME SIKLIGI | ...
```

Sample row:
- TL = 570 (kiralama / rental)
- SMS TL = empty
- HAT TL = 70 (SIM fee — should go to sim_amount)

---

## Expected vs Actual

| Excel Column | Expected DB Column | Expected Value | Actual |
|--------------|-------------------|----------------|--------|
| TL           | base_price        | 570            | ✓ Works |
| HAT TL       | sim_amount        | 70             | ✗ Stays 0 |

---

## Relevant Files

1. **Import mapping:** `src/features/subscriptions/importUtils.js`
   - `parseXlsxFile()` — builds row objects from Excel (keys = first row headers)
   - `validateAndMapRows()` — `getMulti('HAT TL', ...)` and `findSimColumn(raw)` for sim_amount
   - `line_fee` is hardcoded to 0

2. **API:** `src/features/subscriptions/importApi.js`
   - Sends `sim_amount: row.sim_amount ?? 0` in RPC payload

3. **RPC:** `supabase/migrations/00140_add_sim_amount_to_subscriptions.sql`
   - Adds `sim_amount` column, updates `bulk_import_subscriptions` to accept and insert it

4. **Duplicate key:** `src/features/subscriptions/SubscriptionsListPage.jsx`
   - Two columns use `accessor: 'subtotal'` (lines ~249 and ~270)
   - Table component uses `column.key ?? column.accessor` for React key → duplicate key

---

## What to Investigate

### For HAT TL / sim_amount:

1. **Parsing:** Add `console.log(raw)` in `validateAndMapRows` for the first row. Check:
   - Does `raw` have a key that looks like "HAT TL"?
   - What is `raw['HAT TL']` or `raw[<hatKey>]`?

2. **Key mismatch:** Excel may use different whitespace (e.g. `\u00a0`). Headers are normalized in `parseXlsxFile` with `replace(/\u00a0/g, ' ')`. Verify the normalized header matches `'HAT TL'`.

3. **Value type:** `toNum()` handles string and number. If the cell is formatted as text "70", it should still parse. Check `sim_amountRaw` before `toNum`.

4. **RPC:** Confirm migration 00140 ran. In Supabase SQL Editor: `SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'sim_amount';` — should return one row.

### For duplicate key:

- Give the "totalAmount" column a unique `key` or `accessor`, e.g. `key: 'totalAmount'` or `accessor: 'total_amount_display'`, so it does not collide with the "monthly" column's `accessor: 'subtotal'`.

---

## Request

1. Fix the duplicate key in SubscriptionsListPage (add unique key to the second subtotal column).
2. Find why HAT TL (70) is not reaching sim_amount. Add debug logs if needed, then fix the root cause.
