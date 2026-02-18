# Müşteri Detay Sayfası Analizi

> **Tarih:** 2026-02-18  
> **Sayfa:** `/customers/:id` — Müşteri listesinde tıklanınca açılan detay sayfası  
> **Önem:** Yüksek — Sık kullanılacak ekran

---

## 1. Layout / Div Farkı

### Mevcut Durum

| Sayfa | PageContainer maxWidth | Görsel Sonuç |
|-------|------------------------|--------------|
| **CustomerDetailPage** | `lg` (1024px) | Dar, ortada kutu |
| CustomersListPage | `full` (100%) | Tam genişlik |
| ProfilePage | `xl` (1280px) | Geniş, ortada |
| RecurringExpensesPage | `xl` (1280px) | Geniş, ortada |
| WorkOrderDetailPage | `lg` (1024px) | Dar |
| SubscriptionDetailPage | `lg` (1024px) | Dar |

**Sorun:** Müşteri detay sayfası `maxWidth="lg"` kullanıyor. Geniş ekranlarda (örn. 1920px) içerik dar bir kolonda kalıyor, yanlarda boşluk oluşuyor. Diğer list/form sayfaları (`xl` veya `full`) daha geniş alan kullanıyor.

**Öneri:** `maxWidth="xl"` ile diğer detay sayfalarıyla uyumlu hale getirilebilir. Müşteri detayı çok bilgi içerdiği için geniş alan daha uygun.

---

## 2. UX Eksikleri ve Sorunlar

### 2.1 Bilgi Hiyerarşisi

- **Başlık alanı:** `PageHeader` description'da Badge'ler var (site sayısı, vergi no). Bu bilgiler başlık altında küçük kalıyor.
- **Öncelik sırası:** En kritik bilgiler (iletişim, lokasyonlar) ile ikincil bilgiler (notlar, SIM kartlar) aynı seviyede sunuluyor.
- **Hızlı erişim:** "Yeni iş emri", "Lokasyon ekle" gibi sık kullanılan aksiyonlar sayfa içinde dağınık.

### 2.2 Aksiyon Yerleşimi

- **Düzenle / Sil:** Sağ üstte, iyi konumda.
- **Lokasyon ekle:** Sites bölümünde — scroll gerekebilir.
- **Yeni iş emri:** Her SiteCard içinde — tek tıkla müşteri seviyesinde "hızlı iş emri" yok.
- **SIM kart ekle:** SIM Cards tablosu header'ında — aşağıda, görünürlüğü düşük.

**Öneri:** Üstte sabit veya PageHeader actions içinde "Hızlı aksiyonlar" dropdown'u (Yeni iş emri, Lokasyon ekle, SIM ekle).

### 2.3 Mobil Deneyim

- **Grid:** `lg:grid-cols-3` — mobilde tek kolon, sidebar aşağı iniyor. Uzun sayfa, scroll yoğun.
- **SiteCard grid:** `md:grid-cols-2` — mobilde tek kolon, kartlar uzun.
- **İletişim bilgileri:** Telefon için arama butonu var; email için `mailto:` linki yok.
- **Tablo:** Work History ve SIM Cards tabloları mobilde dar, yatay scroll veya sütun gizleme gerekebilir.

### 2.4 Boş / Yükleme Durumları

- **Sites:** Boş durumda Card + "Lokasyon ekle" butonu — iyi.
- **Work History:** Table `emptyMessage` — iyi.
- **SIM Cards:** Table `emptyMessage` — iyi.
- **Notlar:** "Not yok" metni — iyi.
- **İletişim:** Telefon/email yoksa hiçbir şey gösterilmiyor — kullanıcı "bilgi yok" anlamında bir ipucu alamıyor.

### 2.5 İçerik Yoğunluğu

- **Tek sayfada:** Lokasyonlar, İş geçmişi, SIM kartlar, Site Assets, İletişim, Notlar.
- **Scroll:** Uzun müşterilerde sayfa çok uzuyor.
- **Sekmeler (Tabs):** Yok. Tüm içerik tek akışta — alternatif olarak "Genel / Lokasyonlar / İş Emirleri / SIM" gibi sekmeler düşünülebilir.

### 2.6 Erişilebilirlik ve Görünürlük

- **Breadcrumb:** Var — Müşteriler > [Firma adı].
- **Geri dönüş:** Breadcrumb'daki "Müşteriler" ile — iyi.
- **Email:** `mailto:` linki yok — tıklanabilir olmalı.
- **Adres:** Harita/lokasyon linki yok — Google Maps açılabilir.

### 2.7 Tutarlılık

- **Diğer detay sayfaları:** WorkOrderDetailPage, SubscriptionDetailPage benzer yapıda (2+1 grid, sidebar).
- **Card header:** Bazı bölümler `Card header={}` kullanıyor, bazıları raw `h2` — stil tutarsızlığı olabilir.

---

## 3. Özet — Öncelik Sırasıyla

| # | Sorun | Önem | Çaba |
|---|-------|------|------|
| 1 | `maxWidth="lg"` — dar layout | Yüksek | Düşük |
| 2 | Hızlı aksiyonlar dağınık | Yüksek | Orta |
| 3 | Email `mailto:` linki yok | Orta | Düşük |
| 4 | İletişim yoksa "bilgi yok" ipucu yok | Orta | Düşük |
| 5 | Mobilde tablo/scroll deneyimi | Orta | Orta |
| 6 | Uzun sayfa — sekme alternatifi | Düşük | Yüksek |
| 7 | Card header stil tutarlılığı | Düşük | Düşük |

---

## 4. Hızlı Düzeltmeler (Quick Wins)

1. **PageContainer:** `maxWidth="xl"` yap.
2. **Email:** `customer.email` varsa `<a href="mailto:...">` ile sarmala.
3. **İletişim boş:** Telefon ve email yoksa "İletişim bilgisi eklenmemiş" benzeri metin göster.
4. **PageHeader actions:** "Yeni iş emri" butonunu header'a ekle (en sık kullanılan aksiyon).

---

**Son Güncelleme:** 2026-02-18
