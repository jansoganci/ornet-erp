# Turkcell Cost Clarity vs Ornet ERP — Hat Yapısı Karşılaştırması

**Tarih:** 9 Mart 2025  
**Amaç:** Turkcell Cost Clarity aracının Ornet ERP’deki mevcut hat/SIM yapısıyla uyumluluğunu analiz etmek.

---

## 1. Veri Yapısı Karşılaştırması

### 1.1 Alan Eşleştirmesi

| Alan | Turkcell Cost Clarity | Ornet ERP sim_cards |
|------|----------------------|---------------------|
| **Hat numarası** | `hatNo` / `telefonNo` (10 hane: 5XXXXXXXXX) | `phone_number` (serbest format, UNIQUE) |
| **Operatör** | `operator` (string) | `operator` (enum: TURKCELL, VODAFONE, TURK_TELEKOM) |
| **Kapasite** | `kapasite` | `capacity` |
| **Müşteri / Alıcı** | `musteriUnvani` / `kiminUzerine` (düz metin) | `buyer_id` (FK → customers), `customer_id`, `site_id` |
| **Aylık maliyet** | `aylikMaliyet` | `cost_price` |
| **Aylık satış** | `aylikSatisFiyat` / `aylikSatisTutari` | `sale_price` |
| **Tarife** | `tariffName` / `tarife` | ❌ **YOK** |
| **Fatura tutarı** | `invoiceAmount` / `faturaTutari` | ❌ **YOK** |
| **Ödenecek tutar** | `paymentAmount` / `odenecekTutar` | ❌ **YOK** |
| **KDV / ÖİV** | `kdv`, `oiv` | ❌ **YOK** |
| **Account no** | `accountNo` (InventoryLine) | ❌ Kaldırıldı (migration 68) |
| **GPRS seri no** | `gprsSeriNo` | ❌ Kaldırıldı (migration 68) |
| **IMSI** | `imsi` | ❌ Kaldırıldı (migration 68) |
| **Abonelik bağlantısı** | Yok | `subscriptions.sim_card_id` (FK) |
| **Lokasyon** | Yok | `site_id` → customer_sites |

---

## 2. Uyumluluk Analizi

### 2.1 ✅ Uyumlu Alanlar

| Alan | Durum |
|------|-------|
| Hat no ↔ phone_number | Eşleşebilir (normalizasyon gerekli: 10 hane) |
| Operatör | Turkcell = TURKCELL enum |
| Kapasite | capacity |
| Aylık maliyet | cost_price |
| Aylık satış | sale_price |

### 2.2 ⚠️ Eksik / Farklı Alanlar (Ornet’te)

| Alan | Turkcell’de | Ornet’te | Etki |
|------|-------------|----------|------|
| **Tarife** | Her hat için tarife adı (örn. "GPRS 100MB") | Yok | Fatura karşılaştırmasında tarife bilgisi tutulamaz |
| **Fatura tutarı** | Gerçek fatura tutarı (PDF’den) | Yok | Anomali tespiti yapılamaz |
| **Ödenecek tutar** | PDF’den | Yok | — |
| **KDV / ÖİV** | PDF’den | Yok | — |

### 2.3 ⚠️ Ornet’e Özgü (Turkcell’de Yok)

| Alan | Açıklama |
|------|----------|
| buyer_id, customer_id, site_id | İlişkisel müşteri modeli |
| subscriptions.sim_card_id | Abonelik bağlantısı |
| status (available, active, subscription, cancelled) | İş akışı durumu |
| activation_date, deactivation_date | Yaşam döngüsü |

---

## 3. İşlevsellik Karşılaştırması

### 3.1 Turkcell Cost Clarity Ne Yapıyor?

1. **Excel + PDF yükle** → Geçici veri (DB yok)
2. **Karşılaştır** → hatNo üzerinden eşleştirme
3. **Anomali tespiti** → Beklenen maliyet vs gerçek fatura farkı
4. **Kar/zarar** → Satış − fatura
5. **Export** → Excel’e dışa aktar

### 3.2 Ornet ERP Şu An Ne Yapıyor?

1. **sim_cards tablosu** → Kalıcı hat envanteri
2. **Excel import** → bulkCreate (yeni kayıtlar)
3. **Müşteri/lokasyon** → buyer_id, customer_id, site_id
4. **Abonelik** → subscription ↔ sim_card bağlantısı
5. **Finansal view** → view_sim_card_financials (toplam gelir/maliyet/kar)

### 3.3 Ornet’te Eksik Olan İşlevler

| İşlev | Turkcell’de | Ornet’te |
|-------|-------------|----------|
| PDF fatura parse | Var | ❌ Yok |
| Fatura vs envanter karşılaştırma | Var | ❌ Yok |
| Anomali tespiti (beklenen vs gerçek) | Var | ❌ Yok |
| Tarife takibi | Var | ❌ Yok |
| Aylık fatura tutarı saklama | Geçici (session) | ❌ Yok |

---

## 4. Olası Hatalar (Mevcut Ornet Hat Aracı)

### 4.1 SimCardImportPage

| Risk | Açıklama |
|------|----------|
| **phone_number formatı** | Turkcell 10 hane (5XXXXXXXXX) bekler; Ornet örnekte +90 555 123 4567. Normalizasyon yok; DB’de farklı formatlar birikebilir. |
| **Duplicate** | bulkCreate = INSERT. Aynı phone_number tekrar gelirse UNIQUE constraint hatası. Upsert/merge yok. |
| **buyer_name eşleşmesi** | Tam eşleşme (toLowerCase). "Metbel" vs "Metbel Ltd." eşleşmez → hata. |
| **Header mapping** | Sadece `includes` ile kısmi eşleşme. "HAT NO" vs "Hat No" vs "GSM" — varyasyonlar sınırlı. |

### 4.2 API / Filtreler

| Risk | Açıklama |
|------|----------|
| **year/month filtresi** | SimCardsListPage yearParam, monthParam gönderiyor; `fetchSimCards` bu parametreleri kullanmıyor. Filtre etkisiz. |
| **dateFrom/dateTo** | API’de var ama UI’da year/month’tan türetilmiyor. |

### 4.3 Veri Tutarlılığı

| Risk | Açıklama |
|------|----------|
| **cost_price vs fatura** | Ornet sadece beklenen maliyeti (cost_price) tutuyor. Gerçek fatura tutarı yok → anomali analizi yapılamaz. |
| **Tarife** | Turkcell faturalarında tarife bilgisi var; Ornet’te saklanmıyor. |

---

## 5. Uyumluluk Özeti

### 5.1 Doğrudan Uyumlu Değil

Turkcell Cost Clarity’nin tam işlevselliği Ornet’e **doğrudan** taşınamaz çünkü:

1. **Tarife** alanı Ornet’te yok.
2. **Fatura tutarı** (gerçek aylık fatura) Ornet’te yok.
3. Turkcell **geçici veri** (Excel + PDF upload) kullanıyor; Ornet **kalıcı DB** kullanıyor.
4. **Müşteri modeli** farklı: Turkcell düz metin, Ornet FK ilişkileri.

### 5.2 Uyumlu Hale Getirmek İçin Gerekli Değişiklikler

| Değişiklik | Zorluk | Açıklama |
|------------|--------|----------|
| **sim_cards’a tarife alanı** | Düşük | `tariff_name TEXT` veya benzeri eklenebilir. |
| **Aylık fatura tutarı** | Orta | Yeni tablo: `sim_card_invoice_records` (sim_card_id, period, amount, pdf_parsed_at) veya sim_cards’a `last_invoice_amount`, `last_invoice_date` gibi alanlar. |
| **PDF parse entegrasyonu** | Orta | parsePDF mantığı Ornet’e taşınabilir; sonuçlar DB’ye yazılır. |
| **phone_number normalizasyonu** | Düşük | Import ve karşılaştırmada 10 haneye normalize (0/90 prefix temizleme). |
| **Import: upsert/merge** | Orta | Var olan phone_number için UPDATE, yoksa INSERT. |

### 5.3 Kısmi Entegrasyon Senaryoları

| Senaryo | Açıklama |
|---------|----------|
| **A) Sadece PDF parse** | Turkcell PDF parse’ı Ornet’e eklenir; sonuçlar geçici state’te gösterilir veya yeni bir “fatura kaydı” tablosuna yazılır. |
| **B) Excel import iyileştirme** | Turkcell’deki esnek header mapping + normalizasyon Ornet SimCardImport’a uyarlanır. |
| **C) Fatura karşılaştırma sayfası** | Ornet’te yeni sayfa: sim_cards’dan veri + PDF upload → karşılaştırma (Turkcell mantığı). Tarife ve fatura tutarı bu sayfada geçici tutulabilir. |
| **D) Tam entegrasyon** | sim_cards + yeni fatura tablosu + tarife alanı + PDF parse. En kapsamlı çözüm. |

---

## 6. Sonuç ve Öneri

| Soru | Cevap |
|------|-------|
| **Sistemime uygun mu?** | **Kısmen.** Temel alanlar (hat no, maliyet, satış) uyumlu; tarife ve fatura tutarı Ornet’te yok. |
| **Doğrudan entegre edilebilir mi?** | Hayır. Schema ve iş akışı farklı. |
| **Birlikte bir şey üretilebilir mi?** | Evet. Turkcell’den alınabilecekler: PDF parse mantığı, Excel header esnekliği, karşılaştırma algoritması, anomali paneli UI. Ornet’e uyarlanacaklar: DB’ye yazma, müşteri/lokasyon ilişkisi, abonelik bağlantısı. |

**Öneri:** Önce kafandaki hedef yapıyı netleştir; ardından hangi senaryoya (A/B/C/D) daha yakın olduğunu belirleyelim. Böylece adım adım bir plan çıkarabiliriz.
