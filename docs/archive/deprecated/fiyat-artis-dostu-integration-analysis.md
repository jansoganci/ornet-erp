# Fiyat Artış Dostu → Ornet ERP Entegrasyon Analizi

> **Kaynak:** https://github.com/jansoganci/fiyat-artis-dostu  
> **Tarih:** 2026-03-09  
> **Amaç:** FAD uygulamasının işlevlerini Ornet ERP'ye nasıl entegre edebileceğimizi analiz etmek.

---

## 1. Fiyat Artış Dostu (FAD) — Ne Yapıyor?

### 1.1 Ana İşlevler

| Özellik | Açıklama |
|---------|----------|
| **Zam Yönetim Paneli** | Abonelik fiyatlarını toplu zam yapma, yeni fiyat hesaplama |
| **Excel Import** | Excel'den veri yükleme (MERKEZ, ACC, ABONE UNVANI, TL, SMS TL, HAT TL, KDV vb.) |
| **Çoklu Sekmeler** | Her sekme farklı abonelik kategorisi (A.Kira Elden, A.Kira Banka, Int.Aylık.KK, K.Kira KK vb.) |
| **Zam % Hesaplama** | Kullanıcı zam oranı girer → yeni TL ve KDV dahil otomatik hesaplanır |
| **Müşteri Mesajı** | Zam bildirimi için hazır mesaj şablonu ("Alarm Sistemi aylık kira bedeli Şubat ayı itibariyle...") |
| **Kopyala** | Mesajı panoya kopyalama (WhatsApp/SMS için) |
| **Maliyet Sekmesi** | Merkez bazlı maliyet (alarm merkezi yıllık maliyeti) + global SIM maliyeti |
| **Yapıştır** | Excel'den kopyalanan CSV/TSV veriyi yapıştırma |

### 1.2 Sekme Yapısı (10 sekme)

| Sekme | Tablo | Hizmet | Baz Alan | Ek Alanlar |
|-------|------|--------|----------|------------|
| A.Kira KK | zam_rows | Alarm Sistemi | tl_baz | hat_tl |
| A.Kira Elden | akira_elden | Alarm Sistemi | tl_baz | hat_tl |
| A.Kira Elden Met | akira_elden_met | Alarm Sistemi | tl_baz | hat_tl |
| A.Kira Banka | akira_banka | Alarm Sistemi | tl_baz | hat_tl |
| A.S.alma | asalma | Alarm Sistemi | tl_baz | hat_tl |
| A.S.alma Banka | asalma_banka | Alarm Sistemi | tl_baz | hat_tl |
| Int.Aylık.KK | int_kk | İnternet Paketi | tl_baz | sabit_ip, hat_tl |
| Int.Aylık.Banka | int_banka | İnternet Paketi | tl_baz | sabit_ip, hat_tl |
| K.Kira KK | kkira_kk | Kamera Sistemi | tl_baz | sabit_ip, hat |
| K.Kira Banka | kkira_banka | Kamera Sistemi | kiralik_tl | sms, hat |
| Maliyet | merkez_maliyetleri | — | — | — |

### 1.3 Veri Modeli (FAD)

- **zam_rows**, **akira_elden**, **akira_banka**, vb.: Her sekme için ayrı tablo
- **merkez_maliyetleri**: merkez, alarm_var, yillik_merkez_maliyeti, aylik_toplam
- **app_settings**: sim_maliyet (global SIM kart maliyeti)
- Excel sütunları: MERKEZ, ACC., ABONE UNVANI, BAGLANTI TARIHI, TL, SMS TL, HAT TL, KDV, vb.

### 1.4 Teknoloji (FAD)

- React 18, TypeScript, Vite
- shadcn/ui (Radix), Tailwind
- Supabase (PostgreSQL)
- TanStack Query, react-hook-form, zod
- xlsx (Excel), sonner (toast)

---

## 2. Ornet ERP — Mevcut Fiyat Revizyonu

### 2.1 Price Revision Sayfası

| Özellik | Durum |
|---------|-------|
| **Veri kaynağı** | `subscriptions_detail` view (gerçek abonelikler) |
| **Filtreler** | service_type, billing_frequency, start_month |
| **Düzenleme** | Inline (base_price, sms_fee, line_fee, vat_rate, cost) |
| **Kaydet** | `bulk_update_subscription_prices` RPC |
| **Revizyon notları** | `subscription_price_revision_notes` (planlanan) |

### 2.2 Veri Modeli (Ornet)

- **subscriptions**: site_id, base_price, sms_fee, line_fee, vat_rate, cost, service_type, billing_frequency
- **subscriptions_detail**: subscriptions + customer_sites + customers + payment_methods
- **service_type**: alarm_only, camera_only, internet_only, alarm_camera, alarm_camera_internet
- **subscription_type**: recurring_card, manual_cash, manual_bank, annual, internet_only

### 2.3 Eşleşme

| FAD | Ornet |
|-----|-------|
| merkez | — (Ornet'te yok; customer/site bazlı) |
| acc | account_no (customer_sites) |
| abone_unvani | company_name (customers) |
| tl_baz | base_price |
| sms_tl | sms_fee |
| hat_tl | line_fee |
| toplam_kdv_dahil | Hesaplanan (base_price + line_fee) * (1 + vat_rate/100) |

---

## 3. Farklar ve Zorluklar

| Konu | FAD | Ornet |
|------|-----|-------|
| **Veri kaynağı** | Excel import, ayrı tablolar | Canlı DB, subscriptions_detail |
| **Kategori** | 10 sekme (A.Kira Elden, Int.Aylık.KK vb.) | service_type (alarm_only, camera_only, internet_only) |
| **Merkez** | Var (alarm merkezi) | Yok |
| **Maliyet** | merkez_maliyetleri + sim_maliyet | cost (abonelik bazlı) |
| **Mesaj şablonu** | Var, kopyala butonu | Yok |
| **Excel workflow** | Excel → yükle → düzenle → kaydet | DB'den oku → düzenle → kaydet |
| **UI** | shadcn (Radix) | Kendi UI (Button, Input, Table) |

---

## 4. Entegrasyon Seçenekleri

### Seçenek A: Sadece Mesaj Şablonu Ekle (En Kolay)

**Ne yapılır:** Ornet Price Revision sayfasına FAD'deki gibi müşteri bildirim mesajı üretimi eklenir.

- Zam % veya yeni fiyat girildiğinde mesaj otomatik oluşur
- "Kopyala" butonu ile panoya kopyalanır
- service_type'a göre dinamik etiket (Alarm Sistemi, Kamera Sistemi, İnternet Paketi)

**Avantaj:** Düşük efor, yüksek değer (müşteriye bildirim göndermek için hazır metin)

**Dosyalar:** `PriceRevisionPage.jsx`, `subscriptions.json` (i18n)

---

### Seçenek B: Zam % Hesaplama + Mesaj (Orta)

**Ne yapılır:** FAD'deki zam % mantığı Ornet'e taşınır.

- Her satırda "Zam %" input'u
- Girildiğinde: yeni base_price = base_price * (1 + zam/100)
- Yeni KDV dahil = (yeni_base + line_fee) * (1 + vat_rate/100)
- Mesaj şablonu + kopyala

**Avantaj:** Kullanıcı sadece % girer, yeni fiyat otomatik hesaplanır.

**Dezavantaj:** Ornet şu an doğrudan fiyat düzenliyor; zam % opsiyonel kolon olarak eklenebilir.

---

### Seçenek C: Excel Import / Export (Orta)

**Ne yapılır:** FAD'deki Excel import/export mantığı Ornet'e uyarlanır.

- **Export:** Mevcut subscriptions → Excel (filtrelere göre)
- **Import:** Excel'den güncellenmiş fiyatlar → bulk update

**Avantaj:** Kullanıcı Excel'de toplu düzenleme yapıp geri yükleyebilir.

**Dezavantaj:** Sütun eşlemesi (FAD'deki MERKEZ, ACC vs Ornet'teki company_name, account_no) farklı; mapping gerekir.

---

### Seçenek D: Tam Entegrasyon — FAD'i Modül Olarak Ekle (Zor)

**Ne yapılır:** FAD'in tamamı Ornet içinde bir sayfa/modül olarak çalışır.

- Veri: Ornet subscriptions'dan export veya doğrudan subscriptions_detail
- Sekmeler: service_type + subscription_type kombinasyonuna göre (A.Kira Elden ≈ alarm_only + manual_cash)
- Maliyet: Ornet'te cost zaten var; merkez_maliyetleri ayrı bir kavram — eklenmeli mi?

**Avantaj:** Tek uygulama, tek veri kaynağı.

**Dezavantaj:** 
- FAD'in "merkez" kavramı Ornet'te yok
- 10 sekme → Ornet'in service_type yapısına map etmek karmaşık
- FAD ayrı Supabase tabloları kullanıyor; Ornet subscriptions kullanıyor — veri birleştirme zor

---

### Seçenek E: Hibrit — FAD Ayrı Kalır, Ornet'ten Veri Alır (Orta)

**Ne yapılır:** FAD uygulaması ayrı çalışır ama Ornet'ten veri çeker.

- Ornet'te "Export for Zam" butonu → subscriptions_detail'dan Excel/JSON export
- FAD bu dosyayı import eder (sütun mapping ile)
- FAD'de işlem yapılır, mesajlar kopyalanır
- İstenirse: FAD'deki güncel fiyatlar Ornet'e geri import (API veya Excel)

**Avantaj:** FAD'e dokunulmaz, Ornet'te minimal değişiklik.

**Dezavantaj:** İki uygulama, tekrarlanan veri yönetimi.

---

## 5. Önerilen Yol Haritası

### Faz 1: Hızlı Kazanç (1–2 gün)

1. **Mesaj şablonu** — Price Revision sayfasına FAD'deki mesaj formatı eklenir
2. **Kopyala butonu** — Her satırda "Mesajı Kopyala" butonu
3. **service_type etiketi** — Alarm Sistemi, Kamera Sistemi, İnternet Paketi dinamik

### Faz 2: Zam % Kolonu (1 gün)

1. **Zam %** input'u opsiyonel kolon olarak eklenir
2. Girildiğinde yeni base_price hesaplanır ve edit alanına yansır
3. Kaydetmeden önce kullanıcı kontrol edebilir

### Faz 3: Excel Export (1–2 gün)

1. **Export to Excel** — Filtrelenmiş abonelikleri Excel'e aktar
2. Sütunlar: Müşteri, Site, Hesap No, Hizmet, Baz Fiyat, SMS, Hat, KDV, Maliyet
3. Kullanıcı Excel'de düzenleyip (gelecekte) import edebilir

### Faz 4 (Opsiyonel): Merkez Maliyeti

- Ornet'te "merkez" kavramı yoksa, bu özellik atlanır veya "site grubu" / "bölge" gibi yeni bir kavramla modellenir.

---

## 6. Teknik Notlar

### 6.1 Mesaj Şablonu Örneği (FAD'den)

```
Merhaba, Alarm Sistemi aylık kira bedeli Şubat ayı itibariyle mevcut piyasa koşulları ve maliyet artışları nedeniyle 150,00₺'den 165,00₺'ye yükseldi. Mevcut fiyatlar Şubat ayı itibariyle yansıyacaktır. Bilgilerinize sunar, iyi çalışmalar dilerim.
```

### 6.2 Ornet'e Uyarlama

- `service_type` → alarm_only: "Alarm Sistemi", camera_only: "Kamera Sistemi", internet_only: "İnternet Paketi"
- Ay: Filtreden veya seçimden
- Eski/yeni fiyat: base_price ve düzenlenmiş değer

### 6.3 UI Uyumu

- FAD: shadcn Table, Input, Button
- Ornet: Kendi Table, Input, Button
- Entegrasyonda Ornet bileşenleri kullanılmalı (component-inventory'e uygun)

---

## 7. Sonuç

| Seçenek | Efor | Değer | Öneri |
|---------|------|-------|-------|
| A. Sadece mesaj şablonu | Düşük | Yüksek | ✅ İlk adım |
| B. Zam % + mesaj | Orta | Yüksek | ✅ İkinci adım |
| C. Excel export | Orta | Orta | Opsiyonel |
| D. Tam entegrasyon | Yüksek | Belirsiz | ❌ Şimdilik |
| E. Hibrit | Orta | Orta | FAD ayrı kalacaksa |

**Öneri:** Faz 1 (mesaj şablonu + kopyala) ile başlayın. Kullanıcı geri bildirimi sonrası Faz 2 ve 3 değerlendirilebilir.
