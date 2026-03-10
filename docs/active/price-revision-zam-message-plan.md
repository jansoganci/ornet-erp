# Fiyat Revizyonu — Zam %, Mesaj ve Excel Export Planı

> **Tarih:** 2026-03-09  
> **Durum:** Planlama — Geliştirmeye hazır  
> **Sayfa:** `/subscriptions/price-revision` (PriceRevisionPage)

---

## 1. Özet

Bu plan, Fiyat Revizyonu sayfasına şu özellikleri ekler:

| # | Özellik | Açıklama |
|---|---------|----------|
| 1 | **Zam %** | Kullanıcı zam oranı girer → base_price otomatik hesaplanır |
| 2 | **Müşteri Mesajı** | Seçenek B formatında, KDV yok, baz + hat + sms ayrıntılı |
| 3 | **Kopyala** | Her satırda mesajı panoya kopyalama butonu |
| 4 | **Excel Export** | Zam sonrası veya mevcut ekran verisini indirme (detay üretim öncesi netleşecek) |

---

## 2. Zam % Özelliği

### 2.1 Davranış

- Her satırda **Zam %** input alanı (opsiyonel)
- Kullanıcı % girer (örn: 20) → **base_price** otomatik hesaplanır: `yeni_base = eski_base × (1 + zam/100)`
- **sms_fee** ve **line_fee** zam % ile değişmez — değişiklik yapılacaksa **manuel** tutar girişi yapılır
- Zam % silindiğinde veya 0 yapıldığında → base_price eski haline döner (orijinal değer)

### 2.2 Hesaplama Mantığı

```
zam_percent = kullanıcının girdiği değer (örn: 20)
orijinal_base = subscriptions'dan gelen base_price
yeni_base = orijinal_base × (1 + zam_percent / 100)
```

- `editsById` içinde `zam_percent` tutulur
- `base_price` zam % girildiğinde otomatik güncellenir (edit olarak)
- Kaydet sırasında sadece `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost` RPC'ye gider — `zam_percent` gönderilmez

### 2.3 UI

- Fiyat kolonlarından önce veya sonra **Zam %** kolonu
- Input: `type="number"`, `placeholder="%"`, `className="w-20"`
- Zam yapılmış satırlar görsel olarak vurgulanabilir (örn: yeşil arka plan)

---

## 3. Müşteri Mesajı Özelliği

### 3.1 Mesaj Formatı (Seçenek B — KDV yok)

**Örnek — hem abonelik hem SIM değişti:**
```
Merhaba, [Hizmet] [sıklık] kira bedeli [Ay] ayı itibariyle mevcut piyasa koşulları ve maliyet artışları nedeniyle yükseldi:
• Abonelik ücreti: 300,00₺'den 360,00₺'ye
• SIM kart ücreti: 70,00₺'den 80,00₺'ye
• Toplam: 370,00₺'den 440,00₺'ye

Mevcut fiyatlar [Ay] ayı itibariyle yansıyacaktır. Bilgilerinize sunar, iyi çalışmalar dilerim.
```

**Örnek — sadece abonelik değişti (SIM aynı):**
```
Merhaba, [Hizmet] [sıklık] kira bedeli [Ay] ayı itibariyle mevcut piyasa koşulları ve maliyet artışları nedeniyle yükseldi:
• Abonelik ücreti: 300,00₺'den 360,00₺'ye
• Kalan bölümler değişmeyecek
• Toplam: 370,00₺'den 430,00₺'ye

Mevcut fiyatlar [Ay] ayı itibariyle yansıyacaktır. Bilgilerinize sunar, iyi çalışmalar dilerim.
```

### 3.2 Kurallar

| Kural | Açıklama |
|-------|----------|
| **KDV** | Mesajda KDV'den bahsedilmez. Tüm tutarlar KDV hariç. |
| **Toplam** | base_price + sms_fee + line_fee |
| **Satır gösterimi** | Sadece 0'dan büyük olanlar: base_price, sms_fee, line_fee |
| **Değişmeyen kalemler** | Değişmeyen bölümler için tek satır: "Kalan bölümler değişmeyecek" |

### 3.3 Dinamik Parçalar

| Yer tutucu | Kaynak | Örnek |
|------------|--------|-------|
| [Hizmet] | service_type → mesaj etiketi | Alarm Sistemi, Kamera Sistemi, İnternet Paketi |
| [sıklık] | billing_frequency | aylık, 6 aylık, yıllık |
| [Ay] | Seçilen ay (yeni state) | Şubat, Mart |

### 3.4 Hizmet Etiketleri (mesaj için)

| service_type | Mesaj etiketi |
|--------------|---------------|
| alarm_only | Alarm Sistemi |
| camera_only | Kamera Sistemi |
| internet_only | İnternet Paketi |
| alarm_camera | Alarm ve Kamera Sistemi |
| alarm_camera_internet | Alarm, Kamera ve İnternet Sistemi |
| camera_internet | Kamera ve İnternet Sistemi |

### 3.5 Mesaj Ne Zaman Gösterilir?

- Satırda **fiyat değişikliği** varsa (orijinal vs edited)
- En az bir alan (base_price, sms_fee, line_fee) değişmişse
- Değişiklik yoksa: "Fiyat değişikliği yapın" veya benzeri boş durum

### 3.6 Ay Seçimi

- Filtrelerin yanına **"Mesaj ayı"** select eklenir
- Seçenekler: Ocak, Şubat, ..., Aralık
- Varsayılan: Mevcut ay
- Mesaj şablonunda "[Ay] ayı itibariyle" buradan doldurulur

---

## 4. Kopyala Özelliği

### 4.1 Davranış

- Her satırda mesaj varsa **Kopyala** butonu
- Tıklanınca `navigator.clipboard.writeText(mesaj)` ile panoya kopyalanır
- Kısa süre "Kopyalandı!" feedback (toast veya buton metni değişimi)

### 4.2 UI

- Mesaj kutusunun yanında veya altında buton
- İkon: `Copy` (lucide-react)
- Kopyalandığında: `Check` ikonu + "Kopyalandı!" (2 sn sonra eski haline döner)

---

## 5. Excel Export Özelliği

### 5.1 Kapsam (öncelik)

- **Faz 1:** Mevcut ekrandaki veriyi export et (filtrelenmiş subscriptions + varsa edit'ler)
- **Detay:** Hangi kolonlar, format (xlsx vs csv) üretim öncesi netleşecek

### 5.2 Olası Kolonlar

- Müşteri, Site, Hesap No, Hizmet Türü, Ödeme Sıklığı
- base_price, sms_fee, line_fee, vat_rate, cost
- (Zam yapıldıysa) yeni değerler
- Toplam (base + sms + line)

### 5.3 Teknoloji

- `xlsx` paketi (SheetJS) — projede yok, eklenmeli
- Veya CSV export (daha basit, paket gerektirmez)

---

## 6. Dosya Değişiklikleri

### 6.1 Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/features/subscriptions/PriceRevisionPage.jsx` | Zam % kolonu, mesaj üretimi, kopyala butonu, ay seçici, Excel butonu |
| `src/locales/tr/subscriptions.json` | Yeni i18n anahtarları |

### 6.2 Yeni / Yardımcı

| Dosya | Açıklama |
|-------|----------|
| `src/features/subscriptions/utils/priceRevisionMessage.js` | Mesaj üretim fonksiyonu (opsiyonel — PriceRevisionPage içinde de olabilir) |
| `src/features/subscriptions/utils/exportPriceRevision.js` | Excel/CSV export fonksiyonu (Faz 2) |

### 6.3 İncelenecek

| Dosya | Not |
|-------|-----|
| `src/lib/utils.js` | formatCurrency var; mesajda "150,00₺" için küçük wrapper gerekebilir |
| `package.json` | Excel için xlsx eklenmeli (Faz 2) |

---

## 7. i18n Anahtarları

### 7.1 Yeni Anahtarlar (subscriptions.json → priceRevision)

```json
{
  "priceRevision": {
    "zamPercent": "Zam %",
    "zamPercentPlaceholder": "%",
    "messageColumn": "Mesaj",
    "copyMessage": "Kopyala",
    "copied": "Kopyalandı!",
    "messageAyLabel": "Mesaj ayı",
    "exportExcel": "Excel İndir",
    "noPriceChange": "Fiyat değişikliği yapın",
    "messageTemplate": {
      "greeting": "Merhaba,",
      "intro": "{{service}} {{frequency}} kira bedeli {{month}} ayı itibariyle mevcut piyasa koşulları ve maliyet artışları nedeniyle yükseldi:",
      "basePrice": "Abonelik ücreti",
      "simFee": "SIM kart ücreti",
      "smsFee": "SMS ücreti",
      "total": "Toplam",
      "unchangedParts": "Kalan bölümler değişmeyecek",
      "closing": "Mevcut fiyatlar {{month}} ayı itibariyle yansıyacaktır. Bilgilerinize sunar, iyi çalışmalar dilerim."
    },
    "serviceLabelsForMessage": {
      "alarm_only": "Alarm Sistemi",
      "camera_only": "Kamera Sistemi",
      "internet_only": "İnternet Paketi",
      "alarm_camera": "Alarm ve Kamera Sistemi",
      "alarm_camera_internet": "Alarm, Kamera ve İnternet Sistemi",
      "camera_internet": "Kamera ve İnternet Sistemi"
    },
    "frequencyLabelsForMessage": {
      "monthly": "aylık",
      "6_month": "6 aylık",
      "yearly": "yıllık"
    },
    "months": {
      "1": "Ocak", "2": "Şubat", "3": "Mart", "4": "Nisan",
      "5": "Mayıs", "6": "Haziran", "7": "Temmuz", "8": "Ağustos",
      "9": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık"
    }
  }
}
```

---

## 8. Uygulama Sırası

### Faz 1 — Zam % + Mesaj + Kopyala (öncelik)

| Adım | İş | Dosya |
|------|-----|-------|
| 1 | i18n anahtarlarını ekle | subscriptions.json |
| 2 | Ay seçici state + UI | PriceRevisionPage |
| 3 | Zam % kolonu + hesaplama mantığı | PriceRevisionPage |
| 4 | Mesaj üretim fonksiyonu | PriceRevisionPage veya utils |
| 5 | Mesaj + Kopyala kolonu | PriceRevisionPage |
| 6 | Zam yapılmış satır vurgulama (opsiyonel) | PriceRevisionPage |

### Faz 2 — Excel Export

| Adım | İş | Dosya |
|------|-----|-------|
| 1 | xlsx paketi ekle veya CSV ile başla | package.json |
| 2 | Export fonksiyonu | utils veya PriceRevisionPage |
| 3 | Export butonu | PriceRevisionPage |
| 4 | Kolon listesi ve format netleştirme | — |

---

## 9. Edge Case'ler

| Durum | Davranış |
|-------|----------|
| Zam % boş | base_price orijinal değerde kalır |
| Zam % 0 | base_price orijinal değerde kalır |
| Sadece line_fee değişti | Mesajda SIM satırı + "Kalan bölümler değişmeyecek" + toplam |
| base_price=0, line_fee>0 | Abonelik satırı atlanır, SIM + toplam gösterilir |
| service_type null/boş | "Abonelik" veya varsayılan etiket |
| billing_frequency null | "aylık" varsayılan |

---

## 10. Test Senaryoları

1. Zam % 20 gir → base_price doğru hesaplansın
2. base_price + line_fee değiştir → mesajda her ikisi de görünsün
3. Kopyala tıkla → panoda mesaj olsun
4. Ay değiştir → mesajda ay güncellensin
5. Filtre değiştir → liste güncellensin, mesajlar doğru kalsın
6. Kaydet → zam % ile hesaplanan base_price DB'ye yazılsın

---

## 11. Kapsam ve Kısıtlamalar

| Konu | Karar |
|------|-------|
| **Mevcut ekran** | Korunacak. Filtreler, inline düzenleme, Kaydet, Revizyon Notları modalı aynen kalacak. Sadece yeni kolonlar/özellikler eklenecek. |
| **Zam %** | Sadece **base_price**'ı etkiler. sms_fee ve line_fee değişecekse manuel tutar girişi yapılır. |
| **Revizyon notları** | Mevcut haliyle kalacak — otomasyona gerek yok |
| **static_ip_fee** | Şimdilik mesajda yok; ileride eklenebilir |
| **Excel import** | Bu planda yok — sadece export |

---

## 12. Notlar

- **Değişmeyen kalemler:** Mesajda değişmeyen bölümler için "Kalan bölümler değişmeyecek" ifadesi kullanılır.

---

*Plan onaylandıktan sonra Faz 1 geliştirmesine başlanacak.*
