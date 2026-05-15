# Material Import — Fiyat/Kur Desteği Genişletme Planı

**Goal:** `MaterialImportPage.jsx`'i, CSV'deki `Birim Satış Fiyat`, `Birim Maliyet Fiyat`, `Kur` kolonlarını okuyup `materials` tablosuna `unit_price`, `cost_price`, `currency` olarak kaydedecek şekilde genişletmek.

**Mevcut Durum:** Import sadece `Kod`, `Ad`, `Kategori`, `Birim`, `Açıklama` kolonlarını işliyor. Fiyat/kur desteği yok.

---

## Task 1: Yeni HEADERS + template güncelleme

**File:** `src/features/materials/MaterialImportPage.jsx`

`HEADERS` dizisine yeni kolonları ekle:
```js
const HEADERS = ['Kod', 'Ad', 'Kategori', 'Birim', 'Açıklama', 'Birim Satış Fiyat', 'Birim Maliyet Fiyat', 'Kur'];
```

Template (`downloadTemplate`) örnek satırını güncelle:
```js
const wsData = [HEADERS, ['DK230', 'Optik Duman Dedektörü', 'dedektor', 'adet', 'Duman algılama', '125.00', '50.00', 'USD']];
```

---

## Task 2: validateAndFormatData — yeni kolon okuma + parsing

**File:** `src/features/materials/MaterialImportPage.jsx`

`validateAndFormatData` fonksiyonunda 3 yeni değişken ekle:

```js
// --- Mevcut kolonlar (değişmiyor) ---
const code = row['Kod'] != null ? String(row['Kod']).trim() : '';
const name = row['Ad'] != null ? String(row['Ad']).trim() : '';
// ...

// --- YENİ: Fiyat ve kur parsing ---
const unitPriceRaw = row['Birim Satış Fiyat'] != null ? String(row['Birim Satış Fiyat']).trim() : '';
const costPriceRaw = row['Birim Maliyet Fiyat'] != null ? String(row['Birim Maliyet Fiyat']).trim() : '';
const currencyRaw = row['Kur'] != null ? String(row['Kur']).trim().toUpperCase() : '';
```

**Price parser helper** ekle (safe parse with comma-to-dot and $/₺ strip):
```js
function parsePrice(val) {
  if (!val) return null;
  // Remove $, ₺, TL, whitespace
  let cleaned = val.replace(/[$₺TL\s]/g, '').trim();
  // Replace comma decimal with dot (Turkish format)
  cleaned = cleaned.replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}
```

**Currency validator:**
```js
const currency = ['USD', 'TRY'].includes(currencyRaw) ? currencyRaw : null;
```

**Add to formattedData.push:**
```js
unit_price: parsePrice(unitPriceRaw),
cost_price: parsePrice(costPriceRaw),
currency: currency || 'TRY',
```

---

## Task 3: Preview tablosunu güncelle

**File:** `src/features/materials/MaterialImportPage.jsx`

Preview tablosunun `<thead>` ve satır hücrelerine yeni kolonları ekle.

thead'e:
```jsx
<th>{t('materials:fields.unitPrice')}</th>
<th>{t('materials:fields.costPrice')}</th>
<th>{t('materials:fields.currency')}</th>
```

Her satıra:
```jsx
<td>{row.unit_price ?? '-'}</td>
<td>{row.cost_price ?? '-'}</td>
<td>{row.currency || 'TRY'}</td>
```

---

## Task 4: i18n — materials.json güncelle

**File:** `src/locales/tr/materials.json`

Yeni field key'leri ekle (eğer yoksa):
```json
"fields": {
  "code": "Kod",
  "name": "Ad",
  "description": "Açıklama",
  "category": "Kategori",
  "unit": "Birim",
  "unitPrice": "Birim Satış Fiyat",
  "costPrice": "Birim Maliyet Fiyat",
  "currency": "Kur"
}
```

---

## Task 5: isEmptyRow kontrolünü genişlet

**File:** `src/features/materials/MaterialImportPage.jsx`

`isEmptyRow` fonksiyonu sadece `Kod`, `Ad` vs. bakıyor olabilir. Eğer tüm kolonlar boşsa satırı atla mantığı çalışıyordur zaten — kontrol et, dokunma gerekmezse bırak.

---

## Genişletilmiş CSV Kolon Haritası (opsiyonel plan notu)

CSV'den doğrudan import için `MaterialImportPage`'i genişletmek yerine, **yeni bir dönüşüm script'i** de yazılabilir. Ama mevcut plan **import ekranına fiyat/kur desteği eklemek** üzerine. Kullanıcı CSV'yi Excel'de açar, başlıkları düzenler, `.xlsx` kaydeder, import eder.

---

## Execution Order

| Sıra | Task | Bağımlılık |
|------|------|-----------|
| 1 | HEADERS + template | Yok |
| 2 | validateAndFormatData (parsePrice + yeni kolonlar) | Task 1 |
| 3 | Preview tablosu | Task 2 |
| 4 | i18n keys | Yok |
| 5 | isEmptyRow kontrolü | Yok |

---

## Verification

1. `/materials/import` sayfasına git → template indir → 3 yeni kolon görünür
2. Fiyatlı Excel yükle → preview'da fiyatlar ve kur gözükür
3. Import et → materials listesinde fiyatlar kaydedilmiş olur
4. Bir malzemeyi düzenleme modalında aç → fiyatlar doğru görünür
5. Yeni teklif aç → o malzemeyi seç → fiyat otomatik dolsun
