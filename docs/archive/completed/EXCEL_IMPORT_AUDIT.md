# Excel Import Audit — Priority 1.3

> **Date:** 2026-03-19  
> **Scope:** Customer, SIM Card, Material, and Asset (Site Assets) importers  
> **Goal:** Audit mapping logic and propose fixes before implementation

---

## 1. Customer Import

**Files:** `src/features/customers/importUtils.js`, `importApi.js`, `CustomerImportPage.jsx`

### Current Mapping (Excel → DB)

| Excel Column      | DB Table        | DB Column        | Status |
|-------------------|-----------------|------------------|--------|
| MÜŞTERİ           | customers       | company_name     | ✅     |
| ABONE ÜNVANI      | customers       | subscriber_title | ✅     |
| MERKEZ            | customer_sites  | alarm_center     | ✅     |
| ACC.              | customer_sites  | account_no       | ✅     |
| LOKASYON          | customer_sites  | site_name        | ✅     |
| İL                | customer_sites  | city             | ✅     |
| İLÇE              | customer_sites  | district         | ✅     |
| BAĞLANTI TARİHİ  | customer_sites  | connection_date  | ✅     |

**Schema:** `address` is optional (migration 00134). `alarm_center`, `connection_date` exist (migration 00135).

### Proposed Fixes

| Issue | Fix |
|-------|-----|
| **None** | Mapping is correct. UTC date handling already in place (excelSerialToDate). |
| **Excel Template link** | Already present: "Şablon İndir" button on `CustomerImportPage`. |
| **Import button visibility** | Already on Customers list: "İçe Aktar" (Upload icon). |

### Recommendation

**No changes needed** for customer import mapping. Schema alignment is correct.

---

## 2. SIM Card Import

**Files:** `src/features/simCards/SimCardImportPage.jsx`, `api.js`

### Unique Constraints (DB)

- `phone_number` — UNIQUE (partial index on `deleted_at IS NULL`)
- `imsi` — UNIQUE when not null (partial index)

### Current Handling

| Behavior | Implementation |
|----------|----------------|
| Pre-fetch existing | `fetchExistingSimIdentifiers()` returns `phone_number`, `imsi` |
| Filter duplicates | Rows with existing phone or imsi are **skipped** before insert |
| Bulk insert | `bulkCreateMutation` inserts filtered rows |
| On error | `toast.error` + `toast.warning` (partial failure) — no crash |

### Proposed Fixes

| Issue | Fix |
|-------|-----|
| **Silent skip on all duplicates** | When all rows are skipped, show `toast.warning` (already done). No crash. |
| **DB constraint violation** | If insert fails (e.g. race), catch shows generic error. Consider: try row-by-row fallback or surface first row error. |
| **Excel Template** | Already present: "Şablon İndir" button. |
| **Import button** | SimCardsListPage has `handleImport` → `/sim-cards/import` ✅ |

### Recommendation

**No mapping changes.** Duplicate handling is correct — pre-filters phone/imsi, skips without crashing.

---

## 3. Material Import

**Files:** `src/features/materials/MaterialImportPage.jsx`

### Current Mapping

| Excel Column | DB (materials) | Status |
|--------------|----------------|--------|
| Kod          | code           | ✅     |
| Ad           | name           | ✅     |
| Kategori     | category       | ✅     |
| Birim        | unit           | ✅     |
| Açıklama     | description    | ✅     |

### Proposed Fixes

| Issue | Fix |
|-------|-----|
| **None** | Mapping correct. Uses `bulkUpsertMaterials` (upsert by code). |
| **Template** | Already present. |
| **Import button** | MaterialsListPage has button → `/materials/import` ✅ |

### Recommendation

**No mapping changes.** All good.

---

## 4. Asset Import (Varlık / Site Assets) — **Crucial**

**Files:** `src/features/siteAssets/importUtils.js`, `SiteAssetsImportPage.jsx`, `api.js`

### User Requirements

- Use `fn_upsert_site_assets_batch` RPC ✅ (already used via `bulkCreateAssets`)
- Excel columns: `site_acc`, `equipment_name`, `quantity`, `installation_date`
- Lookup `site_id` from `site_acc` (account_no)
- If `site_acc` not found → skip row, do not crash
- Summary: "X rows imported, Y rows failed (Site not found)."

### Current Mapping

| Excel Column   | Internal Field      | RPC / DB          | Status |
|----------------|---------------------|-------------------|--------|
| ACC            | account_no          | → site_id lookup  | ✅     |
| EKİPMAN        | equipment_name      | equipment_name    | ✅     |
| ADET           | quantity            | quantity          | ✅     |
| KURULUM TARİHİ | installation_date   | installation_date | ✅     |
| MÜŞTERİ        | company_name        | (display only)    | ℹ️     |

**Note:** User spec says `site_acc`; current template uses `ACC`. Same meaning.

### RPC Signature (`fn_upsert_site_assets_batch`)

```sql
-- Expects: p_items JSONB array
-- Each item: { site_id, equipment_name, quantity?, installation_date? }
-- site_id must be UUID — resolved from account_no before call
```

### Current Flow

1. Parse Excel → `validateAndMapRows` → rows with `account_no`, `equipment_name`, `quantity`, `installation_date`
2. `fetchSitesByAccountNos(accountNos)` → map `account_no` → `{ id, site_name }`
3. Rows with unresolved `account_no` → excluded from payload, shown as warning
4. Payload built with `site_id` from map
5. `bulkCreateAssets(payload)` → `fn_upsert_site_assets_batch`

### Proposed Fixes

| Issue | Fix |
|-------|-----|
| **account_no not globally unique** | `fetchSitesByAccountNos` uses `account_no` only. If two sites share same ACC (different customers), last one wins. **Option:** Add optional `company_name` filter when resolving. Defer if account_no is known to be unique in practice. |
| **Summary report** | Add explicit: "X imported, Y failed (Site not found)" in result. Currently: `resultSummary` shows only `count`. Add `failedCount` when `unresolvedAccountNos.size > 0`. |
| **Template column naming** | User wants `site_acc` — consider adding alias "HESAP NO / ACC" in template header for clarity. Current "ACC" is acceptable. |
| **Excel Template** | Already present: "Şablon İndir" → `varlik-takip-sablonu.xlsx`. |
| **Import button** | SiteAssetsListPage has "Excel İçe Aktar" button ✅ |

### Recommendation

1. **Enhance result summary** when some rows are skipped due to unresolved ACC:
   - e.g. `"{{imported}} satır içe aktarıldı, {{failed}} satır atlandı (Lokasyon bulunamadı)."`
2. **Optional:** If `account_no` can be duplicated across customers, extend `fetchSitesByAccountNos` to accept `company_name` and filter by customer.

---

## 5. UI — "Excel'den Aktar" Visibility

| Page               | Route              | Import Button | Template |
|--------------------|--------------------|---------------|----------|
| Customers          | /customers         | ✅ "İçe Aktar"| ✅       |
| Varlık Takibi      | /equipment         | ✅ "Excel İçe Aktar" | ✅ |
| SIM Cards          | /sim-cards         | ✅ `actions.import` | ✅ |
| Materials          | /materials         | ✅ `materials:import.title` | ✅ |

**Verified:** All list pages have visible import buttons.

---

## 6. Summary of Proposed Code Changes

| Area | Change |
|------|--------|
| **Customer** | None. |
| **SIM** | Ensure list page has import button; no mapping change. |
| **Material** | Ensure list page has import button; no mapping change. |
| **Asset** | 1) Result summary: add failed count when ACC unresolved. 2) Optional: company_name disambiguation for site lookup. |

---

## 7. Excel Template Column Reference

### Customer Template (`musteri-sablonu.xlsx`)

```
MÜŞTERİ | ABONE ÜNVANI | MERKEZ | ACC. | LOKASYON | İL | İLÇE | BAĞLANTI TARİHİ
```

### Asset Template (`varlik-takip-sablonu.xlsx`)

```
MÜŞTERİ | ACC | EKİPMAN | ADET | KURULUM TARİHİ
```

*(MÜŞTERİ optional for display; ACC is required for site lookup.)*

### SIM Template (`sim-kart-sablonu.xlsx`)

```
HAT NO | ANA ŞİRKET | AYLIK MALIYET | AYLIK SATIS FIYAT | TARİH | MÜŞTERİ ÜNVANI | IMSI | GPRS SERI NO | ACCOUNT NO | OPERATOR | KAPASITE | STATUS | NOTLAR
```

### Material Template (`malzeme-icerik-sablonu.xlsx`)

```
Kod | Ad | Kategori | Birim | Açıklama
```
