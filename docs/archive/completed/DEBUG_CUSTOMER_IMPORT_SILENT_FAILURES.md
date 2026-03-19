# Customer Import — Silent Failure Analysis

> Analysis of 4 out of ~360 records silently failing to import.  
> Files: `importUtils.js`, `importApi.js`, `CustomerImportPage.jsx`

---

## 1. Newline Characters in Cell Values (Alt+Enter)

### Where it could cause a silent skip

| Location | Behavior |
|----------|----------|
| **ACC. field** | `sanitizeCell()` in `importUtils.js:27-36` splits on `[\r\n]` and takes the **first line only**. Multi-line ACC values are truncated, not rejected. |
| **All other fields** (MÜŞTERİ, ABONE ÜNVANI, MERKEZ, LOKASYON, İL, İLÇE, BAĞLANTI TARİHİ) | `get()` uses `trim()` only — **no newline handling**. Newlines stay in the value. |

### DB schema

- All relevant columns are `TEXT` (no length limit). PostgreSQL accepts `\n` and `\r\n`.
- The DB does **not** reject newlines.

### Risk

- **ACC.**: If the first line is empty (e.g. `"\nB66E-1"`), `sanitizeCell` returns `""` → validation error "ACC. required" → row excluded from import (not silent; appears in error list).
- **Other fields**: Newlines are passed through. No silent skip from newlines alone.

### Fix

Apply newline sanitization to all text fields, not just ACC:

```javascript
// importUtils.js - add a sanitizeText helper
function sanitizeText(val) {
  if (val == null) return '';
  const s = String(val).trim();
  // Replace internal newlines with space to avoid DB/display issues
  return s.replace(/[\r\n]+/g, ' ').trim();
}

// Use in get() or create getSanitized():
const get = (key) => sanitizeText(raw[key] ?? '');
// Keep sanitizeCell for ACC. (handles scientific notation) but also apply newline replace
```

---

## 2. Special Characters (@, parentheses, dots, slashes, Turkish)

### Where it could cause a silent skip

- No encoding/escaping is applied before insert.
- PostgreSQL `TEXT` accepts all these characters.
- `normalize_tr_for_search()` maps Turkish chars (ş, ğ, ı, İ, ö, ü, ç) for search only; it does not affect insert.

### Risk

- **None.** Special characters and Turkish characters do not cause silent skips.

---

## 3. Field Length Validation

### Where it could cause a silent skip

- All relevant columns are `TEXT` (no length limit).
- No `VARCHAR(n)` constraints on `company_name`, `subscriber_title`, `site_name`, etc.

### Risk

- **None.** Length is not a cause of silent failures.

---

## 4. Multi-Value ACC Fields ("B66E-1 - B66E-2")

### Where it could cause a silent skip

- `sanitizeCell()` only splits on `[\r\n]`, not on `" - "`.
- A value like `"B66E-1 - B66E-2"` is passed through unchanged.
- No regex or strict pattern validation is applied to ACC.

### Risk

- **None.** Multi-value ACC fields are not rejected.

---

## 5. Silent Failure Patterns

### A. Parse phase — empty rows skipped

**Location:** `importUtils.js:79-80`

```javascript
if (arr.every((v) => v === '' || v == null)) continue;
```

- Fully empty rows are skipped and never added to `rows`.
- No count or log of how many rows were skipped.

**Effect:** If 4 rows are completely empty, you get 356 rows instead of 360. The UI shows "356 valid rows" with no indication that 4 rows were dropped at parse time.

**Fix:** Track and report skipped empty rows:

```javascript
let skippedEmpty = 0;
for (let i = 1; i < data.length; i++) {
  const arr = data[i];
  if (arr.every((v) => v === '' || v == null)) {
    skippedEmpty++;
    continue;
  }
  // ...
}
// Return or log skippedEmpty; show in UI if > 0
```

---

### B. Validation phase — rows with errors excluded

**Location:** `importUtils.js:106-144`, `CustomerImportPage.jsx:107-108`

- `validateAndMapRows` pushes **every** row into `rows`, even when there are validation errors.
- `rowsWithErrors` = set of `rowIndex` for rows that have at least one error.
- `validRows = data.filter((_, i) => !rowsWithErrors.has(i))` — rows with errors are excluded from import.

**Effect:** Rows with missing required fields or invalid dates are excluded. They appear in the red error card and in `console.log('[Import] Hatalı satırlar:', ...)`. This is not fully silent, but easy to miss if the user does not scroll to the error list.

---

### C. Import phase — batch insert catch block

**Location:** `importApi.js:165-182`

```javascript
try {
  const { error: insertErr } = await supabase
    .from('customer_sites')
    .insert(batch.map((b) => b.payload));
  if (insertErr) throw insertErr;
  // ...
} catch (err) {
  for (const item of batch) {
    errors.push({ row: item.rowNum, message: err?.message || String(err) });
    results[item.index] = { rowNum: item.rowNum, status: 'failed', message: err?.message || String(err) };
  }
}
```

- When a batch fails, **all rows in that batch** are marked as failed.
- The error is stored in `errors` and `results`, but:
  - No `console.error` or structured logging.
  - No toast when `result.failed > 0` (only the summary card is updated).
- Batch size is 50; if one row in a batch causes a DB error, all 50 are marked failed, not just 4.

**Effect:** Batch failures are recorded but not logged. Users may overlook the failure count in the summary.

---

### D. "Customer insert returned no ID"

**Location:** `importApi.js:125-129`

```javascript
if (!customerId) {
  errors.push({ row: rowNum, message: 'Customer insert returned no ID' });
  results.push({ rowNum, status: 'failed', message: 'Customer insert returned no ID' });
  continue;
}
```

- This happens when `existingCustomerMap[customerKey]` is undefined.
- Possible causes:
  - ID mapping bug (e.g. `inserted[i]` misaligned with `newCustomerPayloads[i]`).
  - Unicode normalization differences (e.g. "Firma" vs "Firma" with different codepoints) leading to different keys.

**Effect:** Rows are marked as failed with this message. They appear in `importResult.errors` and in the result summary, but again no logging.

---

## 6. Logging to Capture the 4 Failing Records

Add logging at these points:

### Parse phase (`importUtils.js`)

```javascript
let skippedEmpty = 0;
for (let i = 1; i < data.length; i++) {
  const arr = data[i];
  if (arr.every((v) => v === '' || v == null)) {
    skippedEmpty++;
    console.warn('[Import] Skipped empty row:', i + 2);
    continue;
  }
  // ...
}
if (skippedEmpty > 0) {
  console.warn('[Import] Total empty rows skipped:', skippedEmpty);
}
```

### Validation phase (already present)

- `console.log('[Import] Hatalı satırlar:', invalidRowsList)` — keep this and ensure it lists row numbers and fields.

### Import phase (`importApi.js`)

```javascript
} catch (err) {
  console.error('[Import] Site batch failed', {
    batchRowNums: batch.map((b) => b.rowNum),
    error: err?.message || String(err),
    firstPayload: batch[0]?.payload,
  });
  for (const item of batch) {
    errors.push({ row: item.rowNum, message: err?.message || String(err) });
    results[item.index] = { rowNum: item.rowNum, status: 'failed', message: err?.message || String(err) };
  }
}
```

And for "Customer insert returned no ID":

```javascript
if (!customerId) {
  console.warn('[Import] Customer insert returned no ID', {
    rowNum,
    company_name: row.company_name,
    customerKey,
    existingKeysSample: Object.keys(existingCustomerMap).slice(0, 5),
  });
  errors.push({ row: rowNum, message: 'Customer insert returned no ID' });
  // ...
}
```

### UI — toast for partial failure

In `CustomerImportPage.jsx`, after `setImportResult(result)`:

```javascript
if (result.failed > 0) {
  toast.warning(
    t('customers:import.partialFailure', { failed: result.failed, created: result.created })
  );
}
```

---

## 7. Summary Table

| Scenario | Could cause silent skip? | Fix |
|----------|--------------------------|-----|
| Newlines in cells | ACC: truncation; others: no | Sanitize newlines in all text fields |
| Special chars / Turkish | No | — |
| Field length | No | — |
| Multi-value ACC | No | — |
| Empty rows at parse | **Yes** | Count and report skipped empty rows |
| Validation errors | Partially (easy to miss) | Keep error list; add toast for partial failure |
| Batch insert failure | No (recorded but not logged) | Add `console.error` with row numbers |
| Customer no ID | No (recorded but not logged) | Add `console.warn` with row details |

---

## 8. Recommended Next Steps

1. Add parse-phase logging for skipped empty rows.
2. Add import-phase logging for batch failures and "Customer insert returned no ID".
3. Add a toast when `result.failed > 0`.
4. Optionally add `sanitizeText()` for newlines in all text fields.
5. Re-run the import with the same Excel file and inspect the console to identify the exact 4 failing rows.
