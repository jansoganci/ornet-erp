# Material Modülü Yeniden Yapılandırma — Kapsamlı Plan

> **Plan Tipi:** Frontend + UI + Migration revizyonu
> **Kapsam:** Import, Form, PDF, Proposal Detail (Tedarikçi Listesi)
> **Mapping Stratejisi:** `materials.name` = Müşteri Malzeme Adı (yüzey), `materials.description` = Ornet Malzeme Adı (gerçek ad)

---

## A. Import Sayfası — MaterialImportPage.jsx

### A1. HEADERS Değişikliği
- **Kaldır:** `'Kategori'`
- **Değiştir:** `'Ad'` → `'Müşteri Malzeme Adı'`
- **Değiştir:** `'Açıklama'` → `'Ornet Malzeme Adı'`
- **Yeni:** `['Kod', 'Müşteri Malzeme Adı', 'Birim', 'Birim Satış Fiyat', 'Birim Maliyet Fiyat', 'Kur', 'Ornet Malzeme Adı']`

### A2. Template Güncelleme
```js
const wsData = [HEADERS, ['ORN0001', 'Örnek Malzeme', 'adet', '125.00', '50.00', 'USD', 'Örnek Ornet Malzeme Adı']];
```

### A3. validateAndFormatData — Kolon Eşleme
Değişen okuma:
```js
const code = row['Kod'] != null ? String(row['Kod']).trim() : '';
const name = row['Müşteri Malzeme Adı'] != null ? String(row['Müşteri Malzeme Adı']).trim() : '';
const description = row['Ornet Malzeme Adı'] != null ? String(row['Ornet Malzeme Adı']).trim() : '';
const unit = row['Birim'] != null ? String(row['Birim']).trim() || 'adet' : 'adet';
```

**Kategori tamamen kalkacak:**
- `row['Kategori']` okuması silinecek
- `category: category || null` satırı `formattedData.push`'tan kalkacak

### A4. Hata Gösterme Düzeltmesi (ÖNEMLİ)
Şu an `data.length === 0` olunca hatalar gösterilmiyor çünkü hata UI'ı sadece preview branch'inde.

**Yapılacak:**
- `catch` bloğuna `console.error(err)` ekle
- `reader.onerror` handler'ı ekle (şu an yok)
- `hasProcessed` state'i ekle: dosya işlendi ama `data` boşsa veya `errors` varsa, upload kartı yerine **hata mesajı** göster
- `validateAndFormatData`'da `result` boş array (`[]`) olunca da toast bas (şu an `[]` truthy olduğu için toast basmıyor)

```js
const [hasProcessed, setHasProcessed] = useState(false);

// handleFileUpload sonunda:
reader.onerror = () => {
  setErrors([t('common:import.fileReadFailed')]);
  setIsParsing(false);
  setHasProcessed(true);
};

// UI'da:
if (hasProcessed && data.length === 0) {
  // Hata/boş sonuç göster, upload kartını gösterme
}
```

### A5. Preview Tablosu
- Kategori kolonu kaldır
- "Ad" → "Müşteri Malzeme Adı" (i18n key: `materials:fields.name`)
- "Açıklama" → "Ornet Malzeme Adı" (i18n key: `materials:fields.description`)
- Sıralama: Kod | Müşteri Malzeme Adı | Birim | Birim Fiyat | Maliyet | Kur | Ornet Malzeme Adı

---

## B. Zod Schema — schema.js

### B1. Kategori Kaldırma
- `category: z.string().optional().or(z.literal(''))` satırını sil
- `materialDefaultValues`'tan `category: ''` satırını sil
- category enum validation kalktığı için sorun yok — DB'de nullable

---

## C. MaterialFormModal — MaterialFormModal.jsx

### C1. UI Düzenleme
Mevcut form düzeni:
```
Kod
Ad (Müşteri Malzeme Adı olarak etiketlenecek)
Açıklama (Ornet Malzeme Adı olarak etiketlenecek)
[Kategori Select] + [Birim Select]   ← kategori kalkacak
[Fiyat] [Maliyet] [Kur]
Aktif
```

**Değişiklikler:**
- Kategori Select (lines 126-132) ve `categoryOptions` (lines 62-71) TAMAMEN KALKACAK
- `label={t('materials:form.fields.name')}` etiketi için i18n güncellenecek
- `label={t('materials:form.fields.description')}` etiketi için i18n güncellenecek
- Grid layout düzenlenecek (kategori gidince unit select tek başına kalacak veya grid bozulacak)

---

## D. i18n — src/locales/tr/materials.json

### D1. fields (import tablosu)
Değişim:
```json
"fields": {
  "code": "Malzeme Kodu",
  "name": "Müşteri Malzeme Adı",    // değişti
  "description": "Ornet Malzeme Adı", // değişti
  // "category": "Kategori" KALDIRILDI
  "unit": "Birim",
  ...
}
```

### D2. form.fields (modal)
```json
"form": {
  "fields": {
    "code": "Malzeme Kodu",
    "name": "Müşteri Malzeme Adı",    // değişti
    "description": "Ornet Malzeme Adı", // değişti
    // "category": "Kategori" KALDIRILDI
    ...
  }
}
```

### D3. list.columns (liste sayfası)
Kontrol edilecek — `MaterialsListPage.jsx`'teki kolon başlıkları

### D4. categories bloğu
Silinebilir (kullanılmıyorsa) veya kalabilir (zararı yok)

---

## E. PDF — ProposalPdf.jsx

### E1. Mevcut Durum (Line 528, 534-537)
```js
const materialDesc = item.materials?.description ? safeStr(item.materials.description) : '';
// ...
<Text style={{ fontSize: 9 }}>{safeStr(item.description)}</Text>
{materialDesc ? (
  <Text style={{ fontSize: 8, color: '#737373', marginTop: 2 }}>
    {materialDesc}
  </Text>
) : null}
```

Şu anda PDF'te:
- Üst satır: `item.description` (proposal_items.description = import'taki "Ornet Malzeme Adı")
- Alt satır (gri): `materials.description` (aynı şey, materials'dan joinlenmiş)

### E2. Yapılması Gereken
PDF'te müşteriye **sadece Malzeme Adı** gösterilecek. Bu şu demek:
- `item.description` yerine **proposal_items'ın kendi description'ı** kalır (`item.description` = proposal_items.description bu zaten kullanıcının formda girdiği veya malzeme seçilince otomatik doldurulan isim)
- Malzeme seçildiğinde combobox `materials.name` (Müşteri Malzeme Adı) ile `item.description`'ı dolduruyor zaten (ProposalItemsEditor'daki `onMaterialSelect`)
- `materialDesc` (gri alt yazı = materials.description = Ornet Malzeme Adı) **PDF'ten kaldırılacak**

**Değişiklik:**
```js
// Line 528-537 değişecek
// KALDIR: materialDesc ve alt satırdaki gri malzeme adı
// SADECE: item.description kalır, temiz
<Text style={{ fontSize: 9 }}>{safeStr(item.description)}</Text>
// materialDesc alt satırı SİLİNECEK
```

---

## F. Tedarikçi Listesi Butonu — ProposalDetailPage.jsx

### F1. Konum
Teklif kabul edildikten sonra (`proposal.status === 'completed'`), teklif detay sayfasında, 550-560 arasındaki action butonları bölgesinde yeni bir buton.

### F2. Davranış
- Buton: "Tedarikçi Listesi İndir" (geçici etiket)
- Tıklayınca:
  1. `proposal.items`'daki her satır için `item.materials` join'inden `material.description` (Ornet Malzeme Adı/gerçek ad) al
  2. Eğer `material_id` varsa ve `materials.description` doluysa onu kullan, yoksa `item.description`'ı kullan
  3. Excel/CSV oluştur: Sıra | Malzeme Kodu | Malzeme Adı | Miktar | Birim
  4. İndir: `tedarikci-listesi-{proposal.id}.xlsx`

### F3. Hangi Dosyalar Değişecek
**ProposalDetailPage.jsx:**
- Import: `* as XLSX from 'xlsx'` + `Download` icon from lucide-react
- Yeni fonksiyon: `handleDownloadSupplierList`
- Buton: `status === 'completed'` branch'ine buton ekle

**API (opsiyonel):**
- Proposal detail query'si zaten `proposal_items.materials(*)` join'i yapıyor olmalı (PDF'te `item.materials?.description` kullanıldığına göre)
- Eğer join yoksa, items query'sine `materials (id, code, description)` eklenecek

**i18n:**
- `proposals:detail.downloadSupplierList` yeni key

---

## Execution Sırası

| Sıra | Ne | Dosyalar | Bağımlılık |
|------|----|----------|-----------|
| 1 | **A1-A3** Import HEADERS + kolon eşleme | `MaterialImportPage.jsx` | Yok |
| 2 | **A4** Hata gösterme düzeltmesi | `MaterialImportPage.jsx` | 1 |
| 3 | **A5** Preview tablosu güncelleme | `MaterialImportPage.jsx` | 1 |
| 4 | **B** Schema — kategori kaldır | `schema.js` | Yok |
| 5 | **C** Modal — kategori kaldır | `MaterialFormModal.jsx` | 4 |
| 6 | **D** i18n güncelle | `materials.json` | 1, 5 |
| 7 | **E** PDF — gri malzeme adını kaldır | `ProposalPdf.jsx` | Yok |
| 8 | **F** Tedarikçi listesi butonu | `ProposalDetailPage.jsx` + i18n | 7 |

---

## Test/Verification

1. `/materials/import` → template indir → 7 kolon: Kod, Müşteri Malzeme Adı, Birim, Birim Satış Fiyat, Birim Maliyet Fiyat, Kur, Ornet Malzeme Adı
2. Kategori kolonu hiçbir yerde görünmüyor
3. Excel yükle → preview'da doğru kolonlar
4. Import et → materials listesinde adlar doğru
5. MaterialFormModal'da kategori yok, etiketler güncel
6. PDF indir → sadece Malzeme Adı, gri alt yazı yok
7. Teklif completed → "Tedarikçi Listesi İndir" butonu → Excel indir
