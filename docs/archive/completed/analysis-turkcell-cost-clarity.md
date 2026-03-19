# Turkcell Cost Clarity — Repo Analiz Raporu

**Repo:** https://github.com/jansoganci/turkcell-cost-clarity  
**Analiz Tarihi:** 9 Mart 2025  
**Analiz Türü:** Mimari, kod kalitesi, işlevsellik

---

## 1. Proje Özeti

**Turkcell Cost Clarity**, Turkcell GPRS hatlarının maliyet takibini ve fatura karşılaştırmasını yapan bir **client-side web uygulamasıdır**. Excel envanter listesi ile Turkcell fatura PDF’ini karşılaştırarak:

- Eşleşen / eşleşmeyen hatları bulur
- Maliyet farklarını (anomali) tespit eder
- Kar/zarar durumunu gösterir
- Excel’e export imkânı sunar

**Oluşturulma:** Lovable.dev ile scaffold edilmiş (README’de belirtiliyor).

---

## 2. Teknoloji Yığını

| Kategori | Teknoloji |
|----------|-----------|
| Framework | React 18.3 |
| Build | Vite 5.4 |
| Dil | TypeScript 5.8 |
| UI | shadcn/ui (Radix UI) + Tailwind CSS |
| Grafik | Recharts |
| PDF Parse | pdfjs-dist 3.11 |
| Excel | xlsx 0.18 |
| Router | React Router DOM 6.30 |
| Toast | Sonner |
| Test | Vitest + Testing Library |

---

## 3. Proje Yapısı

```
src/
├── App.tsx                 # Router + Toaster
├── main.tsx
├── pages/
│   ├── Index.tsx           # Ana sayfa (2 tab: Dashboard + Karşılaştırma)
│   └── NotFound.tsx
├── components/
│   ├── FileDropZone.tsx    # Dosya sürükle-bırak
│   ├── MatchedTab.tsx      # Eşleşen hatlar tablosu
│   ├── InvoiceOnlyTab.tsx  # Faturada fazla
│   ├── ListOnlyTab.tsx     # Faturada eksik
│   ├── SummaryTab.tsx      # Genel özet
│   └── dashboard/
│       ├── DashboardTab.tsx   # Hat yönetimi ana bileşeni
│       ├── SummaryCards.tsx   # Özet kartlar
│       ├── AnomalyPanel.tsx   # Uyarılar & anomaliler
│       ├── LineTable.tsx      # Hat listesi tablosu
│       └── TariffChart.tsx    # Tarife dağılımı pie chart
├── lib/
│   ├── parsePDF.ts         # Turkcell PDF fatura parse
│   ├── parseExcel.ts       # Envanter Excel parse (Karşılaştırma)
│   ├── parseDashboardExcel.ts  # Dashboard Excel parse
│   ├── compareData.ts      # Envanter vs fatura karşılaştırma
│   ├── exportExcel.ts      # Excel export
│   ├── storage.ts          # localStorage (anomali threshold)
│   └── utils.ts
├── types/
│   ├── invoice.ts          # InventoryLine, InvoiceLine, ComparisonResult
│   └── dashboard.ts        # GprsLine, DashboardStats
└── components/ui/          # ~45 shadcn bileşeni
```

---

## 4. İşlevsellik

### 4.1 İki Ana Modül

| Modül | Amaç |
|-------|------|
| **Hat Yönetimi (Dashboard)** | Excel takip listesi + PDF fatura yükle → Özet kartlar, anomali paneli, hat tablosu, tarife grafiği |
| **Karşılaştırma** | Envanter Excel + PDF fatura yükle → Karşılaştır → Eşleşen / Faturada fazla / Faturada eksik / Özet |

### 4.2 Veri Akışı

1. **Excel Parse:** `xlsx` ile ilk sheet okunur, başlıklar normalize edilip `HEADER_MAP` ile eşleştirilir.
2. **PDF Parse:** `pdfjs-dist` ile metin çıkarılır. Regex ile `F2-XXXXXXXXXX?TariffName#Amount$Payment+KDV!OIV` formatı aranır.
3. **Karşılaştırma:** `hatNo` (10 haneli GSM) üzerinden eşleştirme yapılır.
4. **Export:** `xlsx` ile JSON → Excel dosyası oluşturulur.

### 4.3 PDF Parse Formatı

- **Birincil pattern:** `F2-(\d{10})\?([^#]*)#([\d.]+)\$([\d.]+)\+([\d.]+)!([\d.]+)`
- **Yedek pattern:** Daha basit regex
- **Son çare:** 53/54/55 ile başlayan 10 haneli numara + TL tutarı

> ⚠️ PDF formatı değişirse parse başarısız olabilir. Konsola ham metin loglanıyor (debug amaçlı).

---

## 5. Güçlü Yönler

| Alan | Değerlendirme |
|------|---------------|
| **Modüler yapı** | Sayfa, bileşen, lib, types ayrımı net |
| **TypeScript** | Tip tanımları (`invoice.ts`, `dashboard.ts`) tutarlı |
| **UI** | shadcn/ui + Tailwind; dark mode destekli |
| **Responsive** | Mobil uyumlu grid ve tablo yapısı |
| **Excel esnekliği** | Türkçe karakter normalizasyonu, header varyasyonlarına tolerans |
| **Kullanıcı deneyimi** | Drag & drop, loading durumları, hata mesajları, toast bildirimleri |

---

## 6. Zayıf Yönler ve Riskler

### 6.1 PDF Parse

- **Format bağımlılığı:** Türkçe karakter, boşluk veya format değişikliği regex’i bozabilir.
- **CDN worker:** `pdf.worker.min.js` Cloudflare CDN’den yükleniyor; offline veya CDN kapanırsa hata çıkar.
- **Console.log:** Ham metin production’da da loglanıyor.

### 6.2 Veri Güvenliği

- **Client-side:** Tüm veri tarayıcıda işleniyor; sunucuya gönderilmiyor.
- **localStorage:** Sadece dark mode ve anomali threshold (şu an kullanılmıyor) saklanıyor.

### 6.3 TypeScript / Lint

- `noImplicitAny: false`, `strictNullChecks: false` — tip güvenliği zayıf.
- `(e: any)` kullanımı — hata yönetiminde tip bilgisi kayboluyor.

### 6.4 Build

- **CSS:** `@import` Tailwind `@layer` sonrasında; `@import` en üstte olmalı.
- **Chunk boyutu:** ~1.7 MB JS — code-splitting ile azaltılabilir.
- **pdfjs-dist:** `eval` kullanımı nedeniyle uyarı veriyor.

### 6.5 Test

- Sadece placeholder test: `expect(true).toBe(true)`.
- Parse, karşılaştırma, export mantığı için test yok.

### 6.6 Dokümantasyon

- README Lovable’a ait; proje özellikleri ve kullanım senaryoları yok.
- PDF formatı, Excel sütun şablonu açıklanmamış.

---

## 7. Kod Kalitesi

| Kriter | Durum |
|--------|-------|
| Tutarlılık | ✅ Bileşen ve lib isimlendirmesi tutarlı |
| Tekrar | ⚠️ `formatCurrency` birkaç yerde tekrarlanıyor; ortak util yapılabilir |
| Hata yönetimi | ✅ try/catch + toast; hata mesajları Türkçe |
| `storage.ts` | `storage.ts` kullanılmıyor; `loadAnomalyThreshold` hiç çağrılmıyor |

---

## 8. Ornet ERP ile Karşılaştırma

| Özellik | Turkcell Cost Clarity | Ornet ERP |
|---------|----------------------|-----------|
| Backend | Yok | Supabase |
| Veri saklama | Sadece upload/geçici | Kalıcı DB |
| i18n | Hardcoded Türkçe | i18next |
| Auth | Yok | Var |
| Modülerlik | Tek sayfa, 2 tab | Feature-based routing |

---

## 9. Öneriler

| Öncelik | Öneri |
|---------|-------|
| Yüksek | `@import` CSS sırasını düzelt |
| Yüksek | PDF worker’ı local/vendor’a al veya build’e dahil et |
| Orta | Parse/compare/export için unit test ekle |
| Orta | `formatCurrency` ortak util’e taşı |
| Orta | README’de Excel formatı ve PDF formatı dokümante et |
| Düşük | `storage.ts` kullanılmıyorsa kaldır veya AnomalyPanel’de threshold kullan |
| Düşük | `strictNullChecks: true` ve `noImplicitAny: true` için adım adım geçiş |

---

## 10. Sonuç

**Turkcell Cost Clarity**, Turkcell GPRS hat maliyetlerini Excel + PDF üzerinden karşılaştıran, tek sayfalık, client-side bir araç. Mimari sade ve modüler; UI modern ve kullanışlı. PDF parse formatına bağımlılık ve test eksikliği ana riskler. Ornet ERP’ye entegrasyon düşünülmüyorsa, mevcut haliyle bağımsız bir yardımcı uygulama olarak kullanılabilir.
