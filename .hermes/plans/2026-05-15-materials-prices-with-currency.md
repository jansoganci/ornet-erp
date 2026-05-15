# Materials Fiyat + Kur Desteği Ekleme Planı

**Goal:** `materials` tablosuna satış fiyatı, maliyet ve para birimi kolonları ekleyip, teklif (proposal) satırlarında malzeme seçilince fiyatların otomatik dolmasını sağlamak.

**Kapsam:** Migration → Schema → UI Form → Combobox → Proposal otomatik doldurma

---

## Task 1: Migration — materials tablosuna yeni kolonlar

**File:** `supabase/migrations/00204_materials_prices_with_currency.sql`

```sql
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';
```

- `unit_price`: satış fiyatı (nullable — zorunlu değil)
- `cost_price`: maliyet (nullable — zorunlu değil)
- `currency`: para birimi, varsayılan `'TRY'`, opsiyonel (`'TRY'` veya `'USD'`)

## Task 2: Zod Schema — schema.js

**File:** `src/features/materials/schema.js`

`materialSchema`'ya ekle:
```js
unit_price: z.number().min(0).optional().nullable(),
cost_price: z.number().min(0).optional().nullable(),
currency: z.enum(['TRY', 'USD']).default('TRY'),
```

## Task 3: API Select — materials/api.js

**File:** `src/features/materials/api.js`

`MATERIAL_LIST_SELECT` sorgusuna (veya eşdeğer select listesine) `unit_price`, `cost_price`, `currency` kolonlarını ekle ki Combobox ve diğer component'ler bu değerlere erişebilsin.

## Task 4: UI Form — MaterialFormModal.jsx

**File:** `src/features/materials/MaterialFormModal.jsx`

Form'a 3 yeni alan ekle:

| Alan | Etiket | Tip | Zorunlu? |
|------|--------|-----|----------|
| `unit_price` | Birim Fiyat (₺/$) | Input type="number" step="0.01" | Hayır |
| `cost_price` | Birim Maliyet (₺/$) | Input type="number" step="0.01" | Hayır |
| `currency` | Para Birimi | Select (TRY / USD) | Hayır (default TRY) |

İkisi de zorunlu değil — kullanıcı boş bırakabilir, sonradan düzenleyebilir.

## Task 5: Combobox Payload — MaterialCombobox.jsx

**File:** `src/components/ui/MaterialCombobox.jsx`

`mode === 'proposals'` dalında `onMaterialSelect` payload'ına `unit_price`, `cost_price`, `currency` ekle:

```js
const handleSelect = (material) => {
  if (mode === 'proposals') {
    onMaterialSelect?.({
      description: material.name,
      material_id: material.id,
      unit: PROPOSAL_ITEM_UNIT_SET.has(material.unit) ? material.unit : 'adet',
      unit_price: material.unit_price ?? null,
      cost_price: material.cost_price ?? null,
      currency: material.currency ?? 'TRY',
    });
  }
```

## Task 6: Proposal Otomatik Doldurma — ProposalItemsEditor.jsx

**File:** `src/features/proposals/components/ProposalItemsEditor.jsx`

`onMaterialSelect` callback'ine fiyat doldurma mantığı ekle:

```js
onMaterialSelect={(payload) => {
  setValue(`items.${flatIndex}.description`, payload.description);
  setValue(`items.${flatIndex}.material_id`, payload.material_id ?? null);
  if (payload.unit) setValue(`items.${flatIndex}.unit`, payload.unit);

  // Fiyatları para birimine göre uygun kolona doldur
  // payload.currency kontrol edilebilir veya proposal.currency baz alınabilir
  // Şimdilik TL varsayımı: proposal_items.unit_price / cost kullan
  setValue(`items.${flatIndex}.unit_price`, payload.unit_price ?? null);
  setValue(`items.${flatIndex}.cost`, payload.cost_price ?? null);
}}
```

**Not:** `ProposalItemsEditor` mevcut implementasyonuna bağlı olarak, eğer teklif USD ise `unit_price_usd` / `cost_usd` kolonlarına yazılması gerekebilir. Bunu implementasyon sırasında kontrol edip ona göre dallandıracağız.

---

## İşlem Sırası

| Sıra | Task | Bağımlılık |
|------|------|-----------|
| 1 | Migration | Yok |
| 2 | Zod Schema | Yok |
| 3 | API Select | Yok |
| 4 | UI Form | Task 2, 3 |
| 5 | Combobox Payload | Task 3 |
| 6 | Proposal Doldurma | Task 5 |

Task 1-3 bağımsız, paralel yapılabilir.
Task 4-5-6 sıralı.

---

## Verification

1. Migration çalıştır → `materials` tablosunda `unit_price`, `cost_price`, `currency` kolonları görünür
2. Materials sayfası → herhangi bir malzemeyi düzenle → "Birim Fiyat", "Birim Maliyet", "Para Birimi" alanları görünür
3. Bir malzemeye fiyat gir, kaydet
4. Yeni teklif aç → malzeme seç → fiyatlar otomatik dolsun
