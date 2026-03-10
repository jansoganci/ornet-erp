# KDV Raporu & Döviz Kurları Ekranları Analizi

> **Ekranlar:** `/finance/vat` (VatReportPage), `/finance/exchange` (ExchangeRatePage)  
> **Amaç:** Tutarlılık, eksik öğeler, UX iyileştirmeleri.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

**KDV Raporu:** Başlık, filtreler (Dönem Tipi, Dönem, View Mode), tablo veya EmptyState, toplam satırı.

**Döviz Kurları:** Başlık, TCMB Getir butonu, Kur Ekle formu, tablo veya EmptyState.

---

## 2. Diğer Finans Ekranlarıyla Karşılaştırma

| Özellik | KDV Raporu | Döviz Kurları | Gelirler/Giderler |
|---------|-------------|---------------|-------------------|
| Breadcrumbs | ❌ | ❌ | ✅ |
| PageContainer | default | default | maxWidth xl, space-y-6 |
| Filtre URL sync | ❌ | - | ✅ |
| EmptyState | icon, title, description | icon, title, description | icon + actionLabel + onAction |
| Filtre/Form Card | shadow-sm | shadow-sm | border only |

---

## 3. Tespit Edilen İyileştirmeler

### 3.1 Breadcrumbs

**Mevcut:** Yok.

**Öneri:** 
- KDV: Dashboard → Finans Özeti → KDV Raporu
- Döviz: Dashboard → Finans Özeti → Döviz Kurları

---

### 3.2 PageContainer

**Mevcut:** Varsayılan.

**Öneri:** `maxWidth="xl"` `padding="default"` `className="space-y-6"` – diğer finans sayfalarıyla uyum.

---

### 3.3 KDV Raporu – Filtre URL Senkronizasyonu

**Mevcut:** periodType, period, viewMode useState ile.

**Öneri:** `useSearchParams` ile `?periodType=month&period=2026-02&viewMode=total` – paylaşılabilir linkler.

---

### 3.4 Filtre/Form Card

**Mevcut:** `shadow-sm` kullanılıyor.

**Öneri:** `shadow-sm` kaldır – Finans Özeti, Gelirler, Giderler ile tutarlı.

---

### 3.5 KDV Raporu – EmptyState

**Mevcut:** icon, title, description. `description` ile `title` aynı (empty metni).

**Öneri:** description farklılaştırılabilir veya kaldırılabilir. Kritik değil.

---

### 3.6 Döviz Kurları – EmptyState

**Mevcut:** icon, title, description. Form zaten yukarıda – kullanıcı kur ekleyebilir.

**Öneri:** actionLabel/onAction gerekmez (form mevcut). Mevcut yapı yeterli.

---

### 3.7 Döviz Kurları – Form Erişimi

**Mevcut:** Kur Ekle formu herkese açık. TCMB butonu sadece admin/accountant için.

**Not:** Form herkese açık kalabilir; iş kuralına bağlı.

---

## 4. Öncelik Sıralaması

| # | Öğe | Öncelik |
|---|-----|---------|
| 1 | Breadcrumbs (her iki sayfa) | Yüksek |
| 2 | PageContainer (maxWidth, padding, space-y-6) | Orta |
| 3 | KDV: Filtre URL sync | Orta |
| 4 | Card shadow-sm kaldırma | Düşük |

---

## 5. Özet

**Yapılması önerilen:**
1. Breadcrumbs ekle
2. PageContainer tutarlılığı
3. KDV: useSearchParams ile filtre URL sync
4. Card shadow-sm kaldır
