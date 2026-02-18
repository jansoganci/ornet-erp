# SIM Kartları Ekranı Analizi

> **Amaç:** UI/UX iyileştirmeleri, diğer ekranlarla tasarım tutarlılığı.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

SIM Kartları (`/sim-cards`) sayfası: başlık, aksiyonlar (Export, Import, Yeni Ekle), SimCardStats KPI kartları, filtre kartı ve native HTML tablo ile liste gösterimi.

---

## 2. Diğer Ekranlarla Karşılaştırma

| Özellik | SIM Kartları | Abonelikler | İş Emirleri |
|---------|--------------|-------------|-------------|
| PageContainer | maxWidth="xl", padding yok | maxWidth="xl", padding="default" | maxWidth="xl", padding="default" |
| Ana buton | primary + shadow | primary (shadow yok) | primary + shadow |
| Filtre Card | p-4, border | p-4, border | p-4, border |
| Select placeholder | Yok (options) | placeholder | placeholder |
| Tablo | Native `<table>` | `Table` component | `Table` component |
| Tablo wrapper | `Card` | `div` rounded-2xl | `div` rounded-2xl |
| EmptyState | title, description | + icon, actionLabel, onAction | + icon, actionLabel, onAction |
| URL sync (filtreler) | Yok (useState) | searchParams | searchParams |
| Breadcrumbs | Yok | Var | Var |

---

## 3. Tutarsızlıklar ve İyileştirme Alanları

### 3.1 Tablo – Native HTML vs Table Component

**Mevcut:** Native `<table>` ile manuel thead/tbody.

**Diğer sayfalar:** `Table` component kullanıyor (mobilde kart stack, masaüstünde tablo, loading, empty state).

**Öneri:** `Table` component’e geçiş:
- Mobilde kart görünümü
- Loading state
- Tutarlı stil (rounded-lg, shadow-sm, border)
- `onRowClick` ile satır tıklama

---

### 3.2 Tablo Wrapper Stili

**Mevcut:** `<Card className="overflow-hidden">` içinde tablo.

**Diğer sayfalar:** `rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm bg-white dark:bg-[#171717]` ile div wrapper.

**Öneri:** Abonelikler / İş Emirleri ile aynı wrapper kullanılmalı.

---

### 3.3 Ana Buton

**Mevcut:** `className="shadow-lg shadow-primary-600/20"`

**Öneri:** Proposals / Abonelikler ile uyum için sadece `variant="primary"` kullanılmalı.

---

### 3.4 PageHeader

**Mevcut:** Sadece `title` ve `actions`. `description`, `breadcrumbs` yok.

**Öneri:** `breadcrumbs` eklenebilir (Dashboard → SIM Kartları). `description` opsiyonel.

---

### 3.5 Select Placeholder

**Mevcut:** `options` içinde `{ value: 'all', label: t('list.filters.all') }` – placeholder yok.

**Öneri:** Diğer sayfalarla uyum için `placeholder={t('list.filters.statusPlaceholder')}` veya benzeri eklenebilir.

---

### 3.6 EmptyState

**Mevcut:** Sadece `title` ve `description`.

**Diğer sayfalar:** `icon`, `actionLabel`, `onAction` ile “Yeni Ekle” butonu.

**Öneri:** `icon`, `actionLabel`, `onAction` eklenmeli.

---

### 3.7 Filtre URL Sync

**Mevcut:** `useState` ile search ve statusFilter; sayfa yenilenince sıfırlanıyor.

**Öneri:** `useSearchParams` ile URL’e yazılmalı (paylaşılabilir, bookmark).

---

### 3.8 SimCardStats – Renk Paleti

**Mevcut:** blue, green, purple, indigo, emerald – proje paletinden farklı.

**Abonelikler:** primary, success, warning, error (design system).

**Öneri:** Design system renklerine geçiş (primary, success, info, warning).

---

### 3.9 Aksiyon Butonları (Edit/Delete)

**Mevcut:** Her satırda `Button variant="ghost" size="sm"` + `leftIcon` (Edit2, Trash2). `text-red-600` kullanılıyor.

**Tasks sayfası:** `IconButton` kullanılıyor, `size="md"` ile daha büyük.

**Öneri:** `IconButton` kullanımı veya mevcut butonlarda `size="md"` ile tutarlılık.

---

### 3.10 Silme Onayı

**Mevcut:** `window.confirm()` ile native dialog.

**Öneri:** Modal ile onay (diğer sayfalardaki pattern ile uyum).

---

## 4. Eklenebilecek Veriler (DB’de Mevcut)

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| **city** | customer_sites.city | Lokasyon şehri (API’de select’e eklenmeli) |
| **site_name** | customer_sites | Tabloda “Lokasyon” sütunu yok; eklenebilir |
| **activation_date** | sim_cards | Aktivasyon tarihi (list.columns’ta var, tabloda yok) |

**Mevcut sütunlar:** Hat No, Durum, Operatör, Alıcı, Müşteri, Maliyet, Satış Fiyatı, Menü.

**Eksik:** Lokasyon (site_name), Şehir (city), Aktivasyon Tarihi.

---

## 5. Özet Öneriler

| Öncelik | İyileştirme | Zorluk |
|---------|-------------|--------|
| Yüksek | Native tablo → Table component | Orta |
| Yüksek | EmptyState’e icon + action | Düşük |
| Orta | Tablo wrapper stili (rounded-2xl, border) | Düşük |
| Orta | Ana buton shadow kaldırma | Düşük |
| Orta | Filtre URL sync (searchParams) | Düşük |
| Orta | Breadcrumbs | Düşük |
| Orta | SimCardStats renk paleti | Düşük |
| Düşük | Select placeholder | Düşük |
| Düşük | Şehir sütunu (API + kolon) | Orta |
| Düşük | Lokasyon sütunu | Düşük |
| Düşük | Aktivasyon tarihi sütunu | Düşük |
| Düşük | window.confirm → Modal | Orta |

---

## 6. Uygulama Sırası Önerisi

1. Table component’e geçiş + wrapper stili
2. EmptyState zenginleştirme
3. Ana buton, breadcrumbs, URL sync
4. SimCardStats renk paleti
5. Şehir / Lokasyon / Aktivasyon tarihi sütunları (API güncellemesi gerekebilir)
