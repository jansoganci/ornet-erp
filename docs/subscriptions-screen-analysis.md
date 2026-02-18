# Abonelikler Ekranı Analizi

> **Amaç:** Mevcut durumu değerlendirmek, diğer sayfalarla uyumu kontrol etmek.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

Abonelikler (`/subscriptions`) sayfası iyi yapılandırılmış bir liste ekranı. Başlık, aksiyonlar, KPI kartları, filtreler ve tablo bölümleri net bir hiyerarşiyle sunuluyor.

---

## 2. Diğer Sayfalarla Karşılaştırma

| Özellik | Abonelikler | İş Emirleri | Teklifler | Müşteriler |
|---------|-------------|-------------|-----------|-------------|
| PageContainer | maxWidth="xl" | maxWidth="xl" | maxWidth="xl" | maxWidth="full" |
| Ana buton | primary + shadow | primary + shadow | primary | primary |
| Filtre Card | p-4, border | p-4, border | p-4, border | — |
| SearchInput | ✓ | ✓ | ✓ | ✓ |
| Select placeholder | ❌ (options) | ✓ | ✓ | — |
| Tablo wrapper | rounded-2xl, border | rounded-2xl, border | Table direkt | — |
| EmptyState | ✓ | ✓ | ✓ | ✓ |

---

## 3. Uyumlu Olan Noktalar

1. **Filtre layout:** SearchInput + Select’ler yan yana, Work Orders / Proposals / Work History ile aynı pattern.
2. **Card padding:** `p-4 border-neutral-200/60 dark:border-neutral-800/60` – diğer sayfalarla uyumlu.
3. **Tablo wrapper:** `rounded-2xl border shadow-sm` – Work Orders ile aynı.
4. **URL sync:** searchParams ile search, status, type URL’de tutuluyor.
5. **Row click:** Satıra tıklayınca detay sayfasına gidiyor.
6. **EmptyState:** Icon, title, description, actionLabel kullanımı tutarlı.

---

## 4. Tutarsızlıklar ve İyileştirme Alanları

### 4.1 Select Placeholder Eksikliği

**Mevcut:** Select’lerde `options` içinde `{ value: 'all', label: t('common:filters.all') }` var; placeholder yok.

**Diğer sayfalar:** Work Orders `placeholder={t('workOrders:list.filters.statusPlaceholder')}` kullanıyor; Proposals `placeholder={t('filters.allStatuses')}` kullanıyor.

**Sonuç:** İki Select de "Tümü" gösteriyor; hangisinin durum, hangisinin tip filtresi olduğu ikonlardan anlaşılıyor. Placeholder ile "Tüm Durumlar" / "Tüm Tipler" gibi metinler daha net olur.

---

### 4.2 Stat Kartları – Dashboard StatCard ile Fark

**Mevcut:** Abonelikler sayfasında inline `StatCard` component’i var:

```jsx
function StatCard({ icon, label, value, color }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/20">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        ...
      </div>
    </Card>
  );
}
```

**Dashboard:** `StatCard` from `features/dashboard/StatCard` – farklı API (title, value, icon, onClick), daha sade, icon’da arka plan yok.

**Sonuç:** İki farklı StatCard pattern’i var. Abonelikler kendi ihtiyacına göre (MRR, aktif sayısı vb.) özelleştirilmiş; Dashboard’daki daha genel. Ortak bir StatCard’a taşımak mümkün ama zorunlu değil; mevcut hali işlevsel.

---

### 4.3 Badge variant="outline"

**Mevcut:** Tip sütununda `Badge variant="outline"` kullanılıyor.

**Sorun:** Badge component’inde `outline` variant tanımlı değil; `default` gibi davranıyor.

**Öneri:** `variant="default"` kullanmak veya Badge’e `outline` variant eklemek.

---

### 4.4 Ana Buton Stili

**Mevcut:** "Yeni Abonelik" butonu `className="shadow-lg shadow-primary-600/20"` ile.

**Karşılaştırma:** Work Orders aynı stili kullanıyor. Proposals `variant="primary"` ile daha sade. Dashboard quick actions revizyonunda büyük primary butonlar sadeleştirildi.

**Öneri:** Proposals ile uyum için `variant="primary"` yeterli; shadow opsiyonel.

---

### 4.5 Aksiyon Butonları Sırası

**Mevcut:** Fiyat Revizyonu | Toplu İçe Aktar | Yeni Abonelik (soldan sağa).

**Öneri:** Ana aksiyon (Yeni Abonelik) sağda kalmalı; ikincil butonlar solda. Mevcut sıra bu mantığa uygun.

---

## 5. Özet Değerlendirme

| Konu | Durum | Öncelik |
|------|-------|---------|
| Filtre layout | ✅ Uyumlu | — |
| Select placeholder | ⚠️ Eksik | Orta |
| Badge outline | ⚠️ Tanımsız variant | Düşük |
| Stat kartları | ⚠️ Farklı pattern | Düşük |
| Ana buton shadow | ⚠️ Proposals’tan farklı | Düşük |

---

## 6. Önerilen Düzenlemeler (Opsiyonel)

1. **Select placeholder:** Durum ve Tip Select’lerine `placeholder` eklemek (örn. "Tüm Durumlar", "Tüm Tipler").
2. **Badge:** `variant="outline"` → `variant="default"` veya Badge’e `outline` eklenmesi.
3. **Ana buton:** Shadow kaldırılıp sadece `variant="primary"` kullanılabilir (Proposals ile uyum).

Büyük bir revizyon gerekmiyor; ekran genel olarak diğer liste sayfalarıyla uyumlu ve kullanılabilir.
