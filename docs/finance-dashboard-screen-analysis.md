# Finans Özeti Ekranı Analizi

> **Ekran:** `/finance` (FinanceDashboardPage)  
> **Amaç:** UI/UX tutarlılığı, diğer ekranlarla uyum, eksik öğelerin tespiti.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

Finans Özeti sayfası: başlık, dönem + view mode filtresi, 8 KPI kartı, 2 grafik (Gelir vs Gider bar chart, Kategoriye göre gider pie chart), Son İşlemler listesi.

---

## 2. Diğer Ekranlarla Karşılaştırma

| Özellik | Finans Özeti | Abonelikler | SIM Kartları | Ana Dashboard |
|---------|--------------|-------------|--------------|---------------|
| PageContainer | default (maxWidth xl) | maxWidth="xl", padding="default" | maxWidth="xl" | default |
| PageHeader | sadece title | title + actions | title + breadcrumbs + actions | title + actions |
| Breadcrumbs | ❌ Yok | ❌ Yok | ✅ Dashboard → SIM Kartları | - |
| Quick actions (header) | ❌ Yok | Import, Yeni Ekle | Export, Import, Yeni Ekle | - |
| Filtre URL sync | ❌ Yok (useState) | ✅ searchParams | ✅ searchParams | - |
| KPI kartları | KpiCard (tıklanamaz) | StatCard (tıklanabilir, navigate) | SimCardStats | StatCard |
| Chart renkleri | Hardcoded hex | - | - | - |
| Empty state | div + text | EmptyState component | EmptyState component | - |
| Link butonları | native `<button>` | Button component | Button component | Button |

---

## 3. Tutarsızlıklar ve İyileştirme Alanları

### 3.1 Breadcrumbs

**Mevcut:** Yok.

**Öneri:** `breadcrumbs={[{ label: t('common:nav.dashboard'), to: '/' }, { label: t('finance:dashboard.title') }]}` eklenmeli. Diğer sayfalarla (SIM Kartları, İş Emirleri) tutarlılık.

---

### 3.2 PageContainer

**Mevcut:** `<PageContainer>` – varsayılan maxWidth="xl" kullanıyor.

**Öneri:** `maxWidth="xl"` ve `padding="default"` açıkça belirtilebilir (opsiyonel, zaten default). `className="space-y-6"` eklenebilir bölümler arası boşluk için.

---

### 3.3 Quick Actions (Header)

**Mevcut:** PageHeader'da sadece title. Kullanıcı Gelir/Gider eklemek veya alt sayfalara gitmek için sidebar'a gidiyor.

**Öneri:** Hızlı erişim butonları eklenebilir:
- **Gelir Ekle** → `/finance/income` (yeni gelir formu)
- **Gider Ekle** → `/finance/expenses` (yeni gider formu)
- İsteğe bağlı: **Giderler**, **Gelirler** linkleri

Abonelikler/SIM Kartları gibi ana aksiyonlar header'da olmalı.

---

### 3.4 Filtre URL Senkronizasyonu

**Mevcut:** `period` ve `viewMode` useState ile tutuluyor. Sayfa yenilenince veya link paylaşılınca sıfırlanıyor.

**Öneri:** `useSearchParams` ile `?period=2025-02&viewMode=total` URL'e yazılmalı. Paylaşılabilir, bookmark edilebilir.

---

### 3.5 Chart Renkleri (Design System)

**Mevcut:** Hardcoded hex:
- Bar chart: `#22c55e` (yeşil), `#ef4444` (kırmızı)
- Pie chart: `CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']`

**Öneri:** Tailwind/design system renkleri kullanılmalı:
- Gelir (revenue): `success-500` (#22c55e zaten success'e yakın)
- Gider (expenses): `error-500` (#ef4444 zaten error'a yakın)
- Pie: `success-500`, `info-500`, `warning-500`, `error-500`, `primary-500` vb.

CSS değişkenleri veya Tailwind config'den okunabilir.

---

### 3.6 Son İşlemler – "Gelirler" Linki

**Mevcut:** Native `<button>` ile link:
```jsx
<button
  type="button"
  onClick={() => navigate('/finance/income')}
  className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
>
```

**Öneri:** `Button` component `variant="ghost"` veya `variant="link"` ile kullanılmalı. Tutarlı hover/focus davranışı.

---

### 3.7 KPI Kartları – Tıklanabilirlik

**Mevcut:** KpiCard'lar tıklanamaz. Sadece bilgi gösteriyor.

**Öneri (opsiyonel):** Bazı KPI'lar ilgili sayfaya yönlendirilebilir:
- MRR, Ortalama Müşteri Geliri → `/finance/income`
- Net Kar → `/finance/reports`
- KDV Ödenecek → `/finance/vat`

Abonelikler StatCard'ları gibi. Kullanıcı deneyimi iyileşir.

---

### 3.8 Chart Card Wrapper

**Mevcut:** `<Card className="p-4">` – standart Card.

**Öneri:** Abonelikler tablo wrapper'ı gibi `rounded-2xl border shadow-sm` kullanılabilir. Mevcut Card da bu stilleri içeriyor olabilir; Card component'ine bakılmalı. Tutarlılık önemli.

---

### 3.9 Empty State (Grafikler / Son İşlemler)

**Mevcut:** `<div className="h-64 flex items-center justify-center text-neutral-500 text-sm">` + `t('common:empty.noData')`

**Öneri:** Grafik alanları için mevcut yaklaşım yeterli (EmptyState büyük, grafik alanına uymaz). Son İşlemler boşken EmptyState kullanılabilir ama mevcut minimal gösterim de kabul edilebilir. Öncelik düşük.

---

### 3.10 Filtre Card Stili

**Mevcut:** `Card className="p-4 shadow-sm border-neutral-200/60 dark:border-neutral-800/60 mb-6"`

**Karşılaştırma:** Subscriptions/SIM Cards filtre kartı: `Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60"` – shadow-sm farkı. Tutarlılık için shadow-sm kaldırılabilir veya diğerlerine eklenebilir. Küçük fark.

---

## 4. Öncelik Sıralaması

| # | Öğe | Öncelik | Etki |
|---|-----|---------|------|
| 1 | Breadcrumbs | Yüksek | Tutarlı navigasyon |
| 2 | Quick actions (Gelir Ekle, Gider Ekle) | Yüksek | Hızlı erişim |
| 3 | Filtre URL sync (period, viewMode) | Orta | Paylaşılabilir linkler |
| 4 | Chart renkleri → design system | Orta | Tutarlı görsel dil |
| 5 | Son İşlemler linki → Button component | Düşük | Tutarlı component kullanımı |
| 6 | KPI kartları tıklanabilirlik | Düşük | UX iyileştirmesi |
| 7 | PageContainer className="space-y-6" | Düşük | Boşluk tutarlılığı |

---

## 5. Özet Öneriler

**Yapılması önerilen:**
1. Breadcrumbs ekle (Dashboard → Finans Özeti)
2. PageHeader actions: Gelir Ekle, Gider Ekle butonları
3. useSearchParams ile period ve viewMode URL sync
4. Chart renklerini design system'e taşı (success, error, info, warning)
5. "Gelirler" linkini Button component ile değiştir

**Opsiyonel:**
- KPI kartlarına onClick ile ilgili sayfaya yönlendirme
- Filtre card shadow-sm tutarlılığı

---

## 6. Referans Kod (Subscriptions)

```jsx
// Breadcrumbs
breadcrumbs={[
  { label: t('common:nav.dashboard'), to: '/' },
  { label: t('finance:dashboard.title') },
]}

// Actions
actions={
  <div className="flex gap-2">
    <Button variant="outline" onClick={() => navigate('/finance/income')} leftIcon={<TrendingUp />}>
      {t('finance:quickActions.addIncome')}
    </Button>
    <Button variant="primary" onClick={() => navigate('/finance/expenses')} leftIcon={<TrendingDown />}>
      {t('finance:quickActions.addExpense')}
    </Button>
  </div>
}
```

**Not:** `finance:quickActions.addIncome` ve `finance:quickActions.addExpense` translation key'leri eklenmeli.
