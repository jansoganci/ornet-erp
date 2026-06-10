# Supabase Query Optimization Analysis — Ornet ERP

> Created: 2026-05-31
> Based on: Codex 5.3 codebase scan + manual file-by-file verification
> Status: Analysis only — no implementation, no migrations, no code changes

---

## Executive Summary

Six known Supabase query performance issues were identified by an automated scan and then manually verified against the actual source files and database migrations.

### Verified Findings

| # | Issue | Module | Verdict | Risk | Migration Needed? |
|---|-------|--------|---------|------|-------------------|
| 1 | Work History client-side filtering after RPC | workHistory | **TRUE** | HIGH | Yes (RPC signature) |
| 2 | Materials import N+1 update loop | materials | **TRUE** | HIGH | Yes (new RPC) |
| 3 | SIM card subscription picker client-side search | simCards | **PARTIALLY TRUE** | MEDIUM | Yes (view or RPC) |
|| 4 | Collection customer summary status filter in JS | finance | **PARTIALLY TRUE** | MEDIUM | No |
| 5 | Subscription collection stats aggregated in JS | subscriptions/collection | **PARTIALLY TRUE** | LOW | Optional (RPC) |
| 6 | Work order materials delete-all + reinsert | workOrders | **PARTIALLY TRUE** | LOW | No (app-side only) |

### Recommended Fix Order

1. **Work History client-side filtering** — highest impact, simplest fix, affects core search UX
2. **Materials import N+1** — high impact on import performance, clear fix path
3. **SIM card subscription picker search** — improves UX responsiveness, straightforward
4. **Collection customer summary status filter** — improves Tahsilat page scalability
5. **Subscription collection stats** — low impact, optional optimization
6. **Work order materials delete-all** — lowest risk/impact, defer

### Which Require DB Migrations

- Items 1, 2, 3 require new or modified DB objects (RPC functions, views)
- Item 5 would optionally need a new RPC
- Item 6 requires only app-side code changes

### Which Should Be Postponed

- Item 5 (subscription collection stats) — `fetchCollectionStats` runs 2 parallel queries with specific column selection; the JS aggregation logic includes conditional `official_invoice` rules that would be complex and risky to replicate in SQL. Current data volumes do not justify the risk.
- Item 6 (work order materials delete-all) — `work_order_materials` rows per order are typically < 20. Write amplification is negligible. Only worth fixing if `work_order_materials` grows to 100+ rows per order.

---

## Priority Matrix

| Priority | Issue | Module | Risk Level | Migration? | Suggested Action |
|----------|-------|--------|-----------|-----------|-----------------|
|| 1 | Work History: 5 filters applied in JS after RPC | workHistory | HIGH | Yes | Add filter params to RPC |
| 2 | Materials: row-by-row update loop in bulkUpsert | materials | HIGH | Yes | Create bulk upsert RPC |
| 3 | SIM picker: search applied client-side | simCards | MEDIUM | Yes | Use `sim_cards_list` view; add `.ilike()` or RPC |
| 4 | Collection summary: status filter in JS | finance | MEDIUM | No | Use PostgREST `.gt()` on existing view columns |
| 5 | Subscription collection: JS aggregation | subscriptions | LOW | Optional | Defer; create RPC if needed later |
| 6 | Work order materials: delete-all + reinsert | workOrders | LOW | No | Defer; app-side diff if needed |

---

## 1. Work History Client-Side Filtering

### Current Behavior

**File:** `src/features/workHistory/api.js` (lines 4-34)

The `searchWorkHistory` function calls a Supabase RPC with only `search_query` and `search_type` parameters, then applies **five** additional filters in JavaScript:

```js
// Line 4-10: RPC call — only 2 parameters
export async function searchWorkHistory(filters = {}) {
  const { search, type = 'both', dateFrom, dateTo, workType, workerId, siteId } = filters;
  const { data, error } = await supabase.rpc('search_work_history', {
    search_query: normalizeForSearch(search || ''),
    search_type: type
  });
  // Lines 14-31: 5 client-side filters
  if (siteId)     results = results.filter(r => r.site_id === siteId);
  if (dateFrom)   results = results.filter(r => r.scheduled_date >= dateFrom);
  if (dateTo)     results = results.filter(r => r.scheduled_date <= dateTo);
  if (workType && workType !== 'all')   results = results.filter(r => r.work_type === workType);
  if (workerId && workerId !== 'all')   results = results.filter(r => r.assigned_to.includes(workerId));
```

**Current RPC signature** (`supabase/migrations/00195_work_orders_detail_status_rank.sql`, lines 112-170):

```sql
CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no'
)
RETURNS SETOF work_orders_detail
```

- Returns **all columns** from `work_orders_detail` view (`SELECT *`)
- `SECURITY DEFINER` — runs as postgres, bypasses `security_invoker` on the view
- Has explicit `field_worker` scope filter (limits to assigned work orders)
- Built-in Turkish normalization via `normalize_tr_for_search()`
- No pagination (`LIMIT`) on returned rows

**Current `work_orders_detail` view** (`supabase/migrations/00195_work_orders_detail_status_rank.sql`, lines 6-56):

Returns 30+ columns from `work_orders` JOIN `customer_sites` JOIN `customers`. Includes:
- `site_id`, `scheduled_date`, `work_type`, `assigned_to` (UUID[]) — all used by client-side filters
- `company_name_search`, `account_no_search` — search-normalized columns

**Current RLS:** The RPC is `SECURITY DEFINER`; the view has `security_invoker = true`. The field_worker scope is enforced inside the function body.

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| Client-side filtering | `src/features/workHistory/api.js` | 14-31 |
| RPC call | `src/features/workHistory/api.js` | 7-10 |
| Current RPC definition | `supabase/migrations/00195_work_orders_detail_status_rank.sql` | 112-170 |
| Current view definition | `supabase/migrations/00195_work_orders_detail_status_rank.sql` | 6-56 |
| Field_worker scope | `supabase/migrations/00195_work_orders_detail_status_rank.sql` + 00126 | internal to RPC |

### Verdict: TRUE

The five filters ARE applied client-side. The RPC returns all matching rows (potentially thousands) and JavaScript discards most of them on every keystroke/search.

The `work_orders_detail` view has all the columns needed for SQL-side filtering:
- `site_id` (UUID) — filter param: `p_site_id UUID DEFAULT NULL`
- `scheduled_date` (DATE) — filter params: `p_date_from DATE DEFAULT NULL`, `p_date_to DATE DEFAULT NULL`
- `work_type` (TEXT) — filter param: `p_work_type TEXT DEFAULT NULL`
- `assigned_to` (UUID[]) — filter param: `p_worker_id UUID DEFAULT NULL`

### Before/After

**Before (current):**
1. User types search term and/or applies filters
2. RPC returns ALL matching work orders
3. JS filters by siteId, dateFrom, dateTo, workType, workerId
4. Extra data transferred over network, extra CPU on browser

**After (proposed):**
1. User types search term and/or applies filters
2. RPC accepts all filter parameters, applies them in SQL
3. Only matching rows returned
4. Network payload shrinks, browser stays fast

### Required Code Changes

**File: `src/features/workHistory/api.js`** (no app-side changes needed — just pass filters)

Actually, minimal change: pass additional filter fields to the RPC:

```js
export async function searchWorkHistory(filters = {}) {
  const { search, type = 'both', dateFrom, dateTo, workType, workerId, siteId } = filters;
  const { data, error } = await supabase.rpc('search_work_history', {
    search_query: normalizeForSearch(search || ''),
    search_type: type,
    p_site_id: siteId || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_work_type: workType === 'all' ? null : workType || null,
    p_worker_id: workerId === 'all' ? null : workerId || null,
  });
  if (error) throw error;
  return data ?? [];  // Remove lines 14-31
}
```

### Required DB/RPC Changes

**New migration** — `CREATE OR REPLACE FUNCTION search_work_history` with 7 parameters:

```sql
CREATE OR REPLACE FUNCTION public.search_work_history(
  search_query TEXT,
  search_type  TEXT DEFAULT 'account_no',
  p_site_id    UUID DEFAULT NULL,
  p_date_from  DATE DEFAULT NULL,
  p_date_to    DATE DEFAULT NULL,
  p_work_type  TEXT DEFAULT NULL,
  p_worker_id  UUID DEFAULT NULL
)
RETURNS SETOF work_orders_detail
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_uid      UUID;
  norm_query TEXT;
BEGIN
  v_role     := get_my_role();
  v_uid      := auth.uid();
  norm_query := normalize_tr_for_search(search_query);

  -- field_worker scope + all filters in WHERE clause
  -- ... (existing logic) AND
  --   (p_site_id IS NULL OR site_id = p_site_id) AND
  --   (p_date_from IS NULL OR scheduled_date >= p_date_from) AND
  --   (p_date_to IS NULL OR scheduled_date <= p_date_to) AND
  --   (p_work_type IS NULL OR work_type = p_work_type) AND
  --   (p_worker_id IS NULL OR p_worker_id = ANY(assigned_to))
END;
$$;
```

Changing the parameter list creates a PostgreSQL function overload (it does not replace the old 2-parameter signature automatically). The old signature must be dropped first, then the new function recreated, and then `GRANT EXECUTE` reapplied:

```sql
DROP FUNCTION IF EXISTS public.search_work_history(text, text);
```

### Risks

- **Parameter order:** The first two parameters (`search_query`, `search_type`) must remain in the same position for backward compatibility if the function is called from anywhere else. Supabase RPC calls are positional.
- **field_worker scope:** Must preserve the existing scope filter inside the function body (currently: `v_uid = ANY(assigned_to)` for field_workers).
- **NULL handling:** All new parameters must use `IS NULL OR` pattern so they act as no-ops when not provided.
- **`assigned_to` type:** `UUID[]` — the `p_worker_id` parameter of type `UUID` is compared with `p_worker_id = ANY(assigned_to)`. This is valid SQL.

### Test Plan

1. Call RPC with no filters — should return same results as current behavior
2. Call RPC with `p_site_id` only — should return rows for that site only
3. Call RPC with `p_date_from` + `p_date_to` — should return rows in date range
4. Call RPC with `p_worker_id` — should return rows assigned to that worker
5. Call RPC with all filters — combined filtering should work
6. Login as `field_worker` — should still scope to assigned work orders
7. Login as `admin` — should have no scope restriction
8. Edge: all params NULL — should behave identically to current 2-param call
9. Edge: empty search_query — should return all work orders (subject to other filters)

### Recommended Implementation Prompt Summary

For Cursor Auto:
> 1. Update `search_work_history` RPC to accept 5 new optional filter parameters: `p_site_id UUID DEFAULT NULL`, `p_date_from DATE DEFAULT NULL`, `p_date_to DATE DEFAULT NULL`, `p_work_type TEXT DEFAULT NULL`, `p_worker_id UUID DEFAULT NULL`.
> 2. Add `AND` conditions in all 6 RETURN QUERY branches for these parameters.
> 3. Drop the old 2-parameter signature first (`DROP FUNCTION IF EXISTS public.search_work_history(text, text);`), recreate the 7-parameter function, then reapply `GRANT EXECUTE` for the new signature.
> 4. Update `src/features/workHistory/api.js` to pass all filter values to the RPC call and remove lines 14-31 (client-side filtering).

---

## 2. Materials Import N+1 Update Pattern

### Current Behavior

**File:** `src/features/materials/api.js` (lines 185-224)

The `bulkUpsertMaterials` function:

1. Fetches existing materials by code (`in('code', codes)`) — 1 query (line 189)
2. **For each material to update: runs a separate `.update()` query** (lines 203-212)
3. All inserts are batched in a single `.insert()` call (lines 214-221) — this part is fine

```js
// Line 203-212: N+1 WRITE pattern
for (const row of toUpdate) {
  const { data, error } = await supabase
    .from('materials')
    .update(row)
    .eq('id', existingMap.get(row.code))
    .select()
    .single();
  if (error) throw error;
  results.push(data);
}
```

### Why Normal `.upsert()` Is Not Used

**Migration `00086_soft_delete_materials.sql` explains the constraint:**

```sql
-- Drop the full unique constraint on code so soft-deleted codes can be reused
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_key;
-- Replace with a partial unique index: only active (non-deleted) records must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_code_active
  ON materials (code)
  WHERE deleted_at IS NULL;
```

Supabase `.upsert()` uses `ON CONFLICT (code)` which requires a `UNIQUE` constraint. The partial unique index (`WHERE deleted_at IS NULL`) cannot be used with `ON CONFLICT` because PostgreSQL requires a full `UNIQUE` constraint for conflict detection. Hence the separate fetch → split → loop workaround.

**Current materials table columns** (from `MATERIAL_LIST_SELECT` line 18):

```
id, code, name, description, unit, category, is_active, created_at,
unit_price, cost_price, currency
```

Plus `deleted_at` (from migration 00086).

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| Update loop | `src/features/materials/api.js` | 203-212 |
| Explanation comment | `src/features/materials/api.js` | 185-187 |
| Partial unique index | `supabase/migrations/00086_soft_delete_materials.sql` | 10-12 |
| Batch insert (fine) | `src/features/materials/api.js` | 214-221 |

### Verdict: TRUE

The row-by-row update loop IS the bottleneck for imports. For N materials to update, this makes N sequential API round-trips to Supabase. Each round-trip has network latency + query parsing + index lookup overhead.

### Before/After

**Before (current):**
- 50 materials to update → 50 sequential `.from('materials').update().eq('id', X).select().single()` calls
- Example estimate (not measured benchmark): ~50ms each → ~2.5 seconds wall-clock time
- Failed row at position 35 leaves materials 1-34 updated, 35+ untouched

**After (proposed):**
- 1 RPC call with all data as JSON parameter
- Server-side loop in PL/pgSQL — zero network round-trips per row
- Single REST call, single transaction
- All-or-nothing atomicity

**Note:** Timing figures in this section are rough estimates for illustration, not measured benchmarks.

### Required Code Changes

**File: `src/features/materials/api.js`**

Replace the loop (lines 203-212) and the batch insert (lines 214-221) with a single RPC call:

```js
export async function bulkUpsertMaterials(rows) {
  const { data, error } = await supabase
    .rpc('bulk_upsert_materials', { p_rows: rows });
  if (error) throw error;
  return data;
}
```

The initial fetch + split logic (lines 188-199) can also move into the RPC.

### Required DB/RPC Changes

**New migration** — Create RPC function `bulk_upsert_materials(p_rows JSONB)`:

```sql
CREATE OR REPLACE FUNCTION public.bulk_upsert_materials(p_rows JSONB)
RETURNS SETOF materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSONB;
  existing_id UUID;
  result materials%ROWTYPE;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    SELECT id INTO existing_id FROM materials
    WHERE code = r->>'code' AND deleted_at IS NULL;

    IF existing_id IS NOT NULL THEN
      UPDATE materials
      SET
        name = COALESCE(r->>'name', name),
        description = COALESCE(r->>'description', description),
        unit = COALESCE(r->>'unit', unit),
        unit_price = COALESCE((r->>'unit_price')::DECIMAL, unit_price),
        cost_price = COALESCE((r->>'cost_price')::DECIMAL, cost_price),
        currency = COALESCE(r->>'currency', currency),
        is_active = COALESCE((r->>'is_active')::BOOLEAN, is_active)
      WHERE id = existing_id
      RETURNING * INTO result;
      RETURN NEXT result;
    ELSE
      INSERT INTO materials (code, name, description, unit, unit_price, cost_price, currency, is_active)
      VALUES (
        r->>'code',
        r->>'name',
        r->>'description',
        COALESCE(r->>'unit', 'adet'),
        COALESCE((r->>'unit_price')::DECIMAL, 0),
        (r->>'cost_price')::DECIMAL,
        COALESCE(r->>'currency', 'TRY'),
        COALESCE((r->>'is_active')::BOOLEAN, true)
      )
      RETURNING * INTO result;
      RETURN NEXT result;
    END IF;
  END LOOP;
  RETURN;
END;
$$;
```

### Risks

- **Security (critical):** Materials writes are admin-only. Any `SECURITY DEFINER` RPC must enforce admin-only access inside the function body:
  `IF get_my_role() <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;`
  Do not broaden write capability to all authenticated users.
- **Data type mismatches:** JSONB `->>'field'` returns TEXT — must cast to appropriate types (DECIMAL, BOOLEAN) with COALESCE for null safety.
- **Column coverage:** Import payload shape and table columns must be verified against the current codebase before finalizing the RPC contract.
- **Backward compatibility:** The current function updates via `id` lookup from the pre-fetched map. The RPC must look up by `code` + `deleted_at IS NULL`.

### Test Plan

1. Import 50 new materials (all inserts) — verify all created
2. Import 50 existing materials (all updates) — verify all updated
3. Import 25 new + 25 existing — verify correct split
4. Import with invalid data types — verify proper error
5. Verify RLS: non-admin callers should be rejected
6. Verify `deleted_at` materials are NOT resurrected by update
7. Performance: 50 items should complete in < 500ms (vs 2.5s+ before)

### Recommended Implementation Prompt Summary

> 1. Create new SQL migration (00221) with `bulk_upsert_materials(JSONB)` RPC function that loops over JSON array, updates existing (by code WHERE deleted_at IS NULL) or inserts new materials.
> 2. Enforce admin-only access in the RPC body with:
>    `IF get_my_role() <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;`
>    and do not broaden material write permissions to all authenticated users.
> 3. Update `src/features/materials/api.js` `bulkUpsertMaterials` to call `supabase.rpc('bulk_upsert_materials', { p_rows: rows })` instead of the split + loop pattern.
> 4. Remove the fetch-existing-split logic (lines 188-199) since the RPC handles it internally.

---

## 3. SIM Card Subscription Picker Client-Side Search

### Current Behavior

**File:** `src/features/simCards/api.js` (lines 264-286)

```js
export async function fetchSimCardsForSubscription(siteId, search = '') {
  // Line 265-274: Fetches ALL eligible SIMs for the site
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`*, buyer:buyer_id (company_name), customer_sites:site_id (site_name)`)
    .is('deleted_at', null)
    .or(`site_id.eq.${siteId},status.eq.available`)
    .order('phone_number');
  // Line 278-285: Client-side search with Turkish normalization
  if (!search.trim()) return data;
  const normalizedTerm = normalizeForSearch(search.trim());
  return (data || []).filter(s =>
    normalizeForSearch(s.phone_number).includes(normalizedTerm) ||
    normalizeForSearch(s.buyer?.company_name).includes(normalizedTerm)
  );
}
```

**Problems:**
- `select('*')` over-fetches all sim_cards columns
- All eligible SIMs fetched, then filtered in JS (wasteful when site has 500+ SIMs)
- `normalizeForSearch` handles Turkish characters — not easily replicated in SQL without unaccent

### What About `sim_cards_list` View?

**Migration `00219_sim_cards_list_view.sql`:**

```sql
CREATE OR REPLACE VIEW public.sim_cards_list AS
SELECT
  sc.*,
  cc.company_name_search AS customer_company_name_search,
  normalize_tr_for_search(sc.customer_label) AS customer_label_search
FROM public.sim_cards sc
LEFT JOIN public.customers cc
  ON cc.id = sc.customer_id
  AND cc.deleted_at IS NULL;
```

The current query uses:
- `buyer:buyer_id (company_name)` — the buyer is a separate relation from `customers` (linked via `buyer_id`)
- `customer_sites:site_id (site_name)` — site info

The `sim_cards_list` view only joins `customers` (via `customer_id`), NOT the buyer relation. So the view does NOT replace the current query as-is. The search columns (`company_name_search`, `customer_label_search`) cover customer name search but NOT buyer name search.

Additionally, the current search also covers `phone_number` directly (which exists on `sim_cards` as a plain text column).

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| fetchSimCardsForSubscription | `src/features/simCards/api.js` | 264-286 |
| sim_cards_list view | `supabase/migrations/00219_sim_cards_list_view.sql` | 4-12 |
| `select('*')` | `src/features/simCards/api.js` | 267-271 |
| normalizeForSearch import | `src/features/simCards/api.js` | 2 |
| Existing API that uses ilike | `src/features/materials/api.js` | 33-36 |

### Verdict: PARTIALLY TRUE

The client-side search IS real, but the severity depends on SIM count. For a site with 50 SIMs, it's negligible. For 500+, it's wasteful. The `normalizeForSearch` dependency makes pure SQL pushdown harder — would need `pg_unaccent` or a DB-level `normalize_tr_for_search` function (which exists!).

The `sim_cards_list` view doesn't fully cover this query's needs (buyer relation missing), so either:
- Option A: Extend `sim_cards_list` to include buyer search columns
- Option B: Keep fetching from `sim_cards` directly but add `.ilike()` before fetching

### Before/After

**Before (current):**
1. Fetch ALL sim_cards for site (or available ones) — potentially hundreds
2. For each search keystroke, filter in JS using `normalizeForSearch`
3. Full dataset transferred each time React Query re-fetches

**After (proposed):**
1. If search term exists, add `.ilike()` on `phone_number` and `buyers.company_name` in the Supabase query
2. Only matching rows returned
3. Normalization: use DB-level `normalize_tr_for_search()` via RPC or add search columns to the query

### Required Code Changes

**File: `src/features/simCards/api.js`**

Replace client-side filter with SQL pushdown:

```js
export async function fetchSimCardsForSubscription(siteId, search = '') {
  let query = supabase
    .from('sim_cards')
    .select(`
      id, phone_number, imsi, serial_no, status, sale_price,
      buyer:buyer_id (id, company_name),
      customer_sites:site_id (site_name)
    `)
    .is('deleted_at', null)
    .or(`site_id.eq.${siteId},status.eq.available`)
    .order('phone_number');

  if (search.trim()) {
    const term = normalizeForSearch(search.trim());
    // Use .or() with ilike on phone_number and buyer company_name
    // Illustrative only: nested buyer filter is unverified and must be tested first.
    query = query.or(
      `phone_number.ilike.%${term}%,buyer.company_name.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
```

### Required DB/RPC Changes

Nested `buyer.company_name.ilike` is currently unverified in this flow and should not be treated as proven.

However, **Turkish normalization** is a concern. The current JS code does `normalizeForSearch` (ş→s, ğ→g, etc.) before searching. PostgreSQL `.ilike()` does NOT normalize Turkish characters by default. Options:

1. Use `normalize_tr_for_search()` via a custom RPC wrapper
2. Add `postgres`-level generated search columns (like `company_name_search`) for SIM phone/buyer names
3. Accept that `.ilike()` without normalization is good enough (user types "sirket", finds "şirket" — doesn't work perfectly but functional)

**Recommendation (safer):** Do not proceed with SIM search pushdown until nested relation filtering is tested. Prefer extending `sim_cards_list` (or a dedicated RPC/search column approach) using `normalize_tr_for_search` for deterministic behavior.

### Risks

- **Buyer relation in `ilike` is unverified:** `buyer.company_name.ilike` must be tested in this project before implementation.
- **Normalization mismatch:** Without DB-level `normalize_tr_for_search()`, SQL `.ilike()` will miss Turkish character variations. E.g., searching "sirket" won't match "şirket" in the DB.
- **`select('*')` → explicit columns:** Changing from `select('*')` to explicit columns could break if any consuming component depends on a column not in the new list.

### Test Plan

1. Fetch SIMs with no search — should return all eligible SIMs
2. Fetch SIMs with search "555" — should match phone numbers containing 555
3. Fetch SIMs with search "firma" — should match buyer company names
4. Compare result set with current JS filter — should be identical
5. Turkish character test: search "seker" → should find "şeker" (if normalization added)
6. Edge: empty search string — should skip `.ilike()` entirely
7. Edge: special characters in search — should be handled by `normalizeForSearch`

### Recommended Implementation Prompt Summary

> 1. Optionally add `phone_search` (generated column from `normalize_tr_for_search(phone_number)`) and `buyer_name_search` to `sim_cards` or `sim_cards_list` view in a migration.
> 2. Update `fetchSimCardsForSubscription` in `src/features/simCards/api.js` to:
>    - Replace `select('*')` with explicit columns
>    - Only add SQL search pushdown after validating nested relation behavior in this project
>    - Remove client-side filter logic (lines 278-285)

---

## 4. Finance Collection Customer Summary Filtering

### Current Behavior

**File:** `src/features/finance/api.js` (lines 911-936)

```js
export async function fetchCollectionSummaries(filters = {}) {
  let query = supabase.from('v_collection_customer_summary').select('*');
  if (filters.search) {
    query = query.ilike('customer_name', `%${filters.search}%`);
  }
  if (filters.payment_status) {
    // Filter customers that have at least one document with this status
    // We'll do client-side filtering for simplicity
  }
  const { data, error } = await query;
  // Client-side payment_status filtering
  if (filters.payment_status) {
    return (data || []).filter((row) => {
      if (filters.payment_status === 'unpaid') return row.unpaid_count > 0;
      if (filters.payment_status === 'partial') return row.partial_count > 0;
      if (filters.payment_status === 'paid') return row.paid_count > 0;
      return true;
    });
  }
  return data || [];
}
```

### Current View Definition

**Migration `00214_collection_customer_summary_profit.sql`** — the latest version of `v_collection_customer_summary`:

```sql
SELECT
  c.id AS customer_id,
  c.company_name AS customer_name,
  COUNT(ft.id) AS document_count,
  COALESCE(SUM(ft.amount_try), 0) AS total_billed,
  COALESCE(SUM(ft.output_vat), 0) AS total_vat,
  COALESCE(SUM(ft.cogs_try), 0) AS total_cost,
  -- total_collected: subquery sum from payment rows
  -- outstanding: total_billed - total_collected
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'unpaid') AS unpaid_count,
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'partial') AS partial_count,
  COUNT(ft.id) FILTER (WHERE ft.payment_status = 'paid') AS paid_count,
  COALESCE(SUM(ft.amount_try - COALESCE(ft.cogs_try, 0)), 0) AS total_profit
FROM customers c
LEFT JOIN financial_transactions ft ON ft.customer_id = c.id
  AND ft.direction = 'income' AND ft.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_name
HAVING COUNT(ft.id) > 0
ORDER BY outstanding DESC;
```

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| Client-side filter | `src/features/finance/api.js` | 925-933 |
| `select('*')` | `src/features/finance/api.js` | 912 |
| Comment "for simplicity" | `src/features/finance/api.js` | 919-920 |
| View definition (latest) | `supabase/migrations/00214_collection_customer_summary_profit.sql` | 7-51 |

### Verdict: PARTIALLY TRUE

The `payment_status` filter IS applied client-side. However:
- `unpaid_count`, `partial_count`, `paid_count` are **computed columns** in the view (using `FILTER (WHERE ft.payment_status = ...)`)
- PostgreSQL/PostgREST CAN filter on these: `query.gt('unpaid_count', 0)` is valid and works
- The fix is much simpler than the Codex analysis suggested — no new view needed

**For `payment_status = 'unpaid'`, use `query.gt('unpaid_count', 0)` instead of client-side `.filter()`**

This is a **1-line change** that pushes the filter to SQL.

The `select('*')` is on a view with ~11 columns — the over-fetching concern is minimal since this is already an aggregated summary view (1 row per customer, not per transaction).

### Before/After

**Before (current):**
1. Fetch ALL customer summaries (N rows where N = number of customers with documents)
2. If `payment_status` filter set, iterate all rows in JS and check `unpaid_count > 0` etc.
3. Unnecessary data transfer for the full dataset

**After (proposed):**
1. Fetch ONLY customer summaries matching the status filter
2. `.gt('unpaid_count', 0)` pushed to SQL
3. Database returns only filtered results
4. Network payload shrinks, filter response is instant

### Required Code Changes

**File: `src/features/finance/api.js`**

Replace the client-side filter block with SQL:

```js
export async function fetchCollectionSummaries(filters = {}) {
  let query = supabase.from('v_collection_customer_summary').select('*');

  if (filters.search) {
    query = query.ilike('customer_name', `%${filters.search}%`);
  }
  if (filters.payment_status) {
    if (filters.payment_status === 'unpaid') {
      query = query.gt('unpaid_count', 0);
    } else if (filters.payment_status === 'partial') {
      query = query.gt('partial_count', 0);
    } else if (filters.payment_status === 'paid') {
      query = query.gt('paid_count', 0);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

### Required DB/RPC Changes

**None.** The view already has `unpaid_count`, `partial_count`, `paid_count` as integer columns. PostgREST can filter on them directly via `.gt()` / `.eq()`. No migration needed.

### Risks

- **`unpaid_count` is a COUNT — not a boolean.** If a customer has 5 unpaid documents, `unpaid_count = 5`, `.gt('unpaid_count', 0)` returns them correctly. If they have 0 unpaid documents, `unpaid_count = 0`, not NULL.
- **`total_profit` column** (added in 00214) is fine — it's an additional column, not affected by the filter change.
- **No finance rule violation** — this is a read-only query on a finance view. No data mutation, no accounting logic change.

### Test Plan

1. Fetch summaries with no filter — should return all customers (same as before)
2. Fetch with `payment_status = 'unpaid'` — should return customers where `unpaid_count > 0`
3. Fetch with `payment_status = 'partial'` — should return customers where `partial_count > 0`
4. Fetch with `payment_status = 'paid'` — should return customers where `paid_count > 0`
5. Combine search + payment_status filter — both should work
6. Compare result counts with current JS filter — should be identical

### Recommended Implementation Prompt Summary

> 1. In `src/features/finance/api.js`, replace the client-side filter block (lines 925-933) with SQL `.gt()` filters that check `unpaid_count`, `partial_count`, and `paid_count` directly on the view.
> 2. Remove the client-side filter logic entirely.
> 3. No database changes required.

---

## 5. Subscription Collection Stats JavaScript Aggregation

### Current Behavior

**File:** `src/features/finance/collectionApi.js` (lines 83-152)

This file is under `src/features/finance/`, not `src/features/subscriptions/`. The function `fetchCollectionStats` aggregates `subscription_payments` data in JavaScript.

```js
export async function fetchCollectionStats(filters = {}) {
  // 2 parallel queries (NOT N+1 — only 2 total)
  let pendingQuery = supabase.from('subscription_payments')
    .select('amount, vat_amount, total_amount, should_invoice, subscriptions!inner(status, official_invoice)')
    .eq('status', 'pending');
  let paidQuery = supabase.from('subscription_payments')
    .select('amount, total_amount, should_invoice')
    .eq('status', 'paid');
  // ... date filters ...
  const [{ data: pending }, { data: paid }] = await Promise.all([pendingQuery, paidQuery]);
  // JS aggregation:
  const overdueCount = rows.filter(r => r.payment_month < currentPeriod).length;
  const pendingNetTotal = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingGrossTotal = rows.reduce((sum, r) => {
    const invoice = r.subscriptions?.official_invoice ?? r.should_invoice;
    return sum + (invoice ? Number(r.total_amount || 0) : Number(r.amount || 0));
  }, 0);
  // ... similar for paid rows ...
}
```

### CLAUDE.md Compliance Check

CLAUDE.md says:
- **"Do not use `subscription_payments` as the ledger for reporting totals"** (line 67)
- **"`financial_transactions` — All P&L, VAT, income/expense UI, and aggregates should read this table"** (line 67)

**However:** This function is part of the **subscription collection desk**, not the general finance reporting system. It shows pending/paid subscription payment status — which is fundamentally about subscription payment tracking, not ledger reporting. The `financial_transactions` table only gets subscription income AFTER the payment is marked `paid` (via the trigger). So for **pending** subscription payments (not yet in the ledger), `subscription_payments` is the correct source.

**Verdict:** This function is NOT violating CLAUDE.md rules. It serves a different purpose (collection desk) vs. general finance reporting.

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| fetchCollectionStats | `src/features/finance/collectionApi.js` | 83-152 |
| Parallel query (not N+1) | `src/features/finance/collectionApi.js` | 119 |
| Conditional official_invoice logic | `src/features/finance/collectionApi.js` | 136-138 |
| Overdue calculation | `src/features/finance/collectionApi.js` | 131 |

### Verdict: PARTIALLY TRUE (low impact)

The Codex analysis flagged this as "HIGH" but it's actually **LOW**:
- Only **2 parallel queries** — not N+1. `Promise.all` executes them concurrently.
- No `select('*')` — selects only needed columns (`amount, vat_amount, total_amount, should_invoice`)
- The subscription join (`subscriptions!inner(status, official_invoice)`) is efficient
- The JS aggregation (`reduce`, `filter`) is on already-fetched, narrow data — negligible CPU cost

The true optimization would be to move `SUM()` and `COUNT()` to SQL, but:
- The `official_invoice` conditional logic in `pendingGrossTotal` is non-trivial to replicate in SQL
- The overdue calculation uses JS date comparison
- Current data volumes make this a non-issue

### Before/After

**Before (current):**
- 2 parallel queries fetch all pending and paid rows
- Row-level data transferred to browser (N rows with amount fields)
- JS does SUM, COUNT, and conditional gross calculation

**After (if implemented):**
- 1 RPC call returns pre-computed stats (6-7 numbers)
- Zero row-level data transferred
- Slightly less JS code

**Recommendation: DEFER.** The optimization is not worth the risk of mis-matching the `official_invoice` conditional logic, especially since the function is already efficient (narrow selects, parallel queries).

### Required Code Changes

**None — defer this item.** If implemented later:

```js
// Replace 2 queries + JS aggregation with:
export async function fetchCollectionStats(filters = {}) {
  const { data, error } = await supabase.rpc('get_collection_stats', {
    p_year: filters.year || null,
    p_month: filters.month || null
  });
  if (error) throw error;
  return data;
}
```

### Required DB/RPC Changes

**Optional — defer.** Would need a new RPC:

```sql
CREATE OR REPLACE FUNCTION get_collection_stats(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ ... $$
```

The challenge is the `official_invoice` conditional logic:

```js
const invoice = r.subscriptions?.official_invoice ?? r.should_invoice;
return sum + (invoice ? total_amount : amount);
```

In SQL, this would use `CASE WHEN` on the join with `subscriptions`.

### Risks

- **Conditional logic mismatch:** The `??` (nullish coalescing) on `r.subscriptions?.official_invoice` treats NULL and false differently. SQL `COALESCE` would need to match this exact behavior.
- **`should_invoice` on subscription_payments:** If this column can differ from `subscriptions.official_invoice`, the SQL logic must replicate the app's `??` precedence.
- **Date boundary logic:** The JS `endOfMonth(new Date())` and `payment_month` comparison must be replicated exactly in SQL.

### Test Plan (if implemented)

1. Fetch stats with no filters — compare with current function output
2. Fetch stats with specific year/month — compare
3. Verify `pendingGrossTotal` matches exactly (especially official_invoice = false cases)
4. Verify overdue count matches exactly
5. Check that only `subscription_payments` with `status = 'pending'` are counted

### Recommended Implementation Prompt Summary

> **DO NOT IMPLEMENT.** Defer this item. The current implementation is already efficient (2 parallel queries, narrow selects). The conditional `official_invoice` logic makes SQL replication risky for minimal gain.

---

## 6. Work Order Materials Delete-All + Reinsert Pattern

### Current Behavior

**File:** `src/features/workOrders/api.js` (lines 387-400)

```js
export async function updateWorkOrder({ id, items, materials_discount_percent, ...data }) {
  // ... update work_order record (line 375-384) ...

  if (items !== undefined) {
    // Line 387: DELETE ALL existing materials
    await supabase.from('work_order_materials').delete().eq('work_order_id', id);
    // Lines 388-401: INSERT all materials fresh
    if (items.length > 0) {
      const materialRows = items.map(...)
      await supabase.from('work_order_materials').insert(materialRows);
    }
  }
}
```

This same pattern also appears in `createWorkOrder` (lines 252-264) and `createWorkOrderFromProposal` (lines 324-341), but those are inserts into an empty table, so the delete-all issue only applies to `updateWorkOrder`.

### Current `work_order_materials` Table Schema

**Migration `00010_work_order_materials.sql`** (base table):

```sql
CREATE TABLE IF NOT EXISTS work_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(work_order_id, material_id)
);
```

**Later migrations** (00048, 00051) added:
- `description TEXT NOT NULL`
- `unit TEXT DEFAULT 'adet'`
- `unit_price_usd DECIMAL(12,2) NOT NULL DEFAULT 0`
- `cost_usd DECIMAL(12,2)`
- `sort_order INT NOT NULL DEFAULT 0`
- `unit_price DECIMAL(12,2) NOT NULL DEFAULT 0`
- `cost DECIMAL(12,2)`
- Removed `UNIQUE(work_order_id, material_id)` constraint
- Made `material_id` nullable (ON DELETE SET NULL)
- Changed `quantity` to `DECIMAL(10,2)`

### Foreign Key References

- `work_orders(id) ON DELETE CASCADE` — deleting a work order cascades to delete materials
- `materials(id) ON DELETE SET NULL` — deleting a material sets `material_id` to NULL
- No other tables reference `work_order_materials.id` (confirmed by lack of FK references in migration search)

### Audit/Finance Considerations

The `work_order_materials` table is used by finance triggers/views (via joins in migrations like 00155, 00187), but they read the table in aggregate (SUM of costs/prices per work order), not by individual row ID. So changing row IDs on every update does NOT affect finance.

### Evidence

| Item | File | Line(s) |
|------|------|---------|
| Delete-all + reinsert | `src/features/workOrders/api.js` | 387, 399 |
| createWorkOrder (fine) | `src/features/workOrders/api.js` | 252-264 |
| createWorkOrderFromProposal (fine) | `src/features/workOrders/api.js` | 324-341 |
| Base table creation | `supabase/migrations/00010_work_order_materials.sql` | 5-17 |
| FK: no references to id | — | No found references |
| Table structure migrations | 00048, 00051 | ALTER TABLE additions |

### Verdict: PARTIALLY TRUE (low impact)

The delete-all + reinsert pattern IS used. However:
- No other table references `work_order_materials.id` — so ID changes don't cascade
- Finance reading uses aggregate `SUM()`, not individual IDs — safe
- Work orders typically have 1-10 materials — write amplification is negligible
- Lock contention is minimal (single-user edit pattern: one person edits one work order at a time)
- The UNIQUE constraint was removed (migration 00048), so the delete-all was a pragmatic workaround for the old constraint

**The pattern is safe but not optimal.**

### Before/After

**Before (current):**
- User updates work order with 5 materials (1 changed, 1 removed, 1 added)
- Delete all 5, insert all 5 (10 DB operations)
- IDs of unchanged rows change (no downstream impact)
- 2 round-trips to Supabase

**After (proposed diff-based):**
1. Fetch existing materials
2. Determine: to_delete, to_insert, to_update
3. Execute targeted operations
4. 2-3 round-trips to Supabase (same as before)
5. Order IDs preserved, only changed rows affected

**Net gain:** Minimal at current scale. Only worth implementing if `work_order_materials` grows large.

### Required Code Changes

**Defer — not needed now.** If implemented later:

```js
if (items !== undefined) {
  // Fetch existing
  const { data: existing } = await supabase
    .from('work_order_materials')
    .select('id, material_id, description, sort_order')
    .eq('work_order_id', id);

  const existingMap = new Map(existing.map(m => [m.material_id, m]));
  const materialIds = new Set(items.filter(i => i.material_id).map(i => i.material_id));
  
  // Delete removed
  const toDelete = existing.filter(m => !materialIds.has(m.material_id)).map(m => m.id);
  if (toDelete.length > 0) {
    await supabase.from('work_order_materials').delete().in('id', toDelete);
  }
  
  // Insert new
  const toInsert = items.filter(i => !i.material_id || !existingMap.has(i.material_id));
  if (toInsert.length > 0) { /* insert */ }
  
  // Update changed
  const toUpdate = items.filter(i => i.material_id && existingMap.has(i.material_id));
  for (const item of toUpdate) { /* update each */ }
  // (Still N updates for changed items, but far fewer than full reinsert)
}
```

### Required DB/RPC Changes

**None.** App-side change only.

### Risks

- **Identifying "changed" rows:** Without a stable identifier from the form, diffing by `material_id` is the safest approach. But the UNIQUE constraint was removed (migration 00048), so multiple rows with the same `material_id` are possible. The diff must use a temporary client-side ID or sort_order as tiebreaker.
- **Edge case: same material, different quantity/price:** If the user keeps the same material but changes quantity, the diff must detect this and issue an UPDATE instead of DELETE+INSERT.
- **Transaction safety:** The current delete-all approach is atomic within a single Supabase request. A multi-step diff approach would need manual cleanup if a middle step fails.

### Test Plan (if implemented)

1. Add 1 material to empty work order — verify only INSERT
2. Edit quantity of existing material — verify UPDATE (not DELETE+INSERT)
3. Remove a material — verify only that row DELETE'd
4. Add + remove + update in one save — verify correct operations
5. Verify finance/aggregate view totals are unaffected
6. Edge: work order with 0 materials — should not error
7. Edge: same material added twice (possible since UNIQUE constraint removed)

### Recommended Implementation Prompt Summary

> **DO NOT IMPLEMENT.** Defer this item. The current delete-all + reinsert pattern is safe (no FK references to `work_order_materials.id`, finance reads are aggregate SUM). Work order material counts are typically < 20 rows. Fix only if `work_order_materials` averages 50+ rows per work order.

---

## Final Implementation Roadmap

### Phase 1: Safe, High Impact (Do First)

| Order | Issue | Migration? | Est. Effort | Impact |
|-------|-------|-----------|-------------|--------|
| 1 | Work History client-side filtering | Yes (RPC) | 1-2 hours | HIGH — affects all search |
| 2 | Materials import N+1 | Yes (RPC) | 2-3 hours | HIGH — affects all imports |
| 3 | Collection summary status filter | No | 30 min | MEDIUM — Tahsilat page |
| 4 | SIM subscription picker search | Optional (view) | 1-2 hours | MEDIUM — SIM picker UX |

### Phase 2: Medium Risk (Defer — valid improvements, lower priority)

| Order | Issue | Migration? | Reason |
|-------|-------|-----------|--------|
| 5 | Subscription collection stats | Yes (optional) | Low impact; complex conditional logic |
| 6 | Work order materials diff | No | Low impact; safe as-is |

### Phase 3: Not Recommended (Postpone Indefinitely)

None — all six items are valid improvements. Items 5 and 6 are intentionally deferred due to low impact and higher relative risk for current priorities.

---

## Open Questions

1. **Work History RPC:** Does `search_work_history` have any callers besides `workHistory/api.js`? Check `search_files` for `search_work_history` across `src/` and `supabase/functions/`.
2. **SIM buyer `ilike`:** Does Supabase/PostgREST support `.ilike()` on nested relations in `.select()`? Verify with a test query.
3. **SIM Turkish normalization:** Should we add `normalize_tr_for_search(phone_number)` generated column to `sim_cards`, or keep JS-side normalization? A generated column would enable full SQL pushdown.
4. **CollectionApi route:** `collectionApi.js` lives under `src/features/finance/` but queries `subscription_payments`. Is this the right location, or should it be under `src/features/subscriptions/`? (Route: `/subscriptions/collection` → `CollectionDeskPage`)
5. **`fetchCollectionStats` usage:** How many components call `fetchCollectionStats`? If only the CollectionDeskPage, the optimization priority is very low.
6. **Work order materials `material_id` uniqueness:** Since the `UNIQUE(work_order_id, material_id)` constraint was removed, can the same material appear twice? If yes, diff-based update becomes more complex.
