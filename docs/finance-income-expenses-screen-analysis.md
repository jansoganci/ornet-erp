# Gelirler & Giderler Ekranları Analizi

> **Ekranlar:** `/finance/income` (IncomePage), `/finance/expenses` (ExpensesPage)  
> **Amaç:** Tutarlılık, eksik öğeler, UX iyileştirmeleri.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

**Gelirler:** Başlık, Gelir Ekle butonu, filtreler (Dönem, Ödeme Yöntemi, Müşteri, View Mode), tablo veya EmptyState.

**Giderler:** Başlık, Gider Ekle butonu, filtreler (Dönem, Ödeme Yöntemi, Kategori, Müşteri, Tekrarlayan Tip, View Mode), tablo veya EmptyState. Ek olarak: Tekrarlayan badge, satır tıklama yok.

---

## 2. Diğer Ekranlarla Karşılaştırma

| Özellik | Gelirler | Giderler | Finans Özeti | SIM Kartları |
|---------|----------|----------|--------------|--------------|
| Breadcrumbs | ❌ | ❌ | ✅ | ✅ |
| PageContainer | default | default | maxWidth xl, space-y-6 | maxWidth xl |
| Filtre URL sync | ❌ | ❌ | ✅ | ✅ |
| EmptyState | action (yanlış prop) | action (yanlış prop) | - | icon + actionLabel + onAction |
| Table onRowClick | ❌ | ❌ | - | ✅ (düzenle) |
| Filtre Card | shadow-sm | shadow-sm | border only | border only |

---

## 3. Tespit Edilen Sorunlar

### 3.1 EmptyState – Yanlış Prop (Kritik)

**Mevcut:** Her iki sayfa da `action={<Button ...>}` kullanıyor.

**Sorun:** EmptyState component'i `action` prop'unu desteklemiyor. Sadece `actionLabel` ve `onAction` var. Bu yüzden **EmptyState'teki "Gelir Ekle" / "Gider Ekle" butonu görünmüyor**.

**Çözüm:** `action` yerine `actionLabel` ve `onAction` kullanılmalı:
```jsx
<EmptyState
  icon={TrendingUp}  // veya TrendingDown
  title={...}
  description={...}
  actionLabel={t('finance:income.addButton')}
  onAction={handleAdd}
/>
```

---

### 3.2 Breadcrumbs

**Mevcut:** Yok.

**Öneri:** 
- Gelirler: Dashboard → Finans Özeti → Gelirler
- Giderler: Dashboard → Finans Özeti → Giderler

---

### 3.3 Filtre URL Senkronizasyonu

**Mevcut:** period, paymentMethod, customerId, viewMode (ve Giderler'de categoryId, recurringFilter) useState ile tutuluyor.

**Öneri:** `useSearchParams` ile URL'e yazılmalı. Paylaşılabilir filtreler.

---

### 3.4 Table – Satır Tıklama (onRowClick)

**Mevcut:** Tablo satırları tıklanamaz. Düzenlemek için sadece Edit ikonuna tıklanıyor.

**Öneri:** `onRowClick={(row) => handleEdit(row)}` eklenebilir. SIM Kartları, Abonelikler gibi satıra tıklayınca düzenleme modalı açılır.

---

### 3.5 Giderler – Tekrarlayan Badge Butonu

**Mevcut:** Native `<button>` kullanılıyor (satır 161–166).

**Öneri:** `Button` component veya `Badge` component ile tutarlılık. Badge zaten kullanılıyor (variableBadge) – Tekrarlayan için de Badge kullanılabilir.

---

### 3.6 PageContainer & Filtre Card

**Mevcut:** PageContainer default, filtre Card'da `shadow-sm`.

**Öneri:** 
- `maxWidth="xl"` `padding="default"` `className="space-y-6"`
- Filtre Card: `shadow-sm` kaldır (Finans Özeti ile uyum)

---

### 3.7 Giderler – "Kaynak" Sütunu

**Mevcut:** `accessor: 'proposal_id'` ile sadece "Teklif" var mı kontrol ediliyor. work_order_id vb. gösterilmiyor.

**Not:** Bu iş mantığına bağlı – şimdilik dokunulmayabilir.

---

## 4. Öncelik Sıralaması

| # | Öğe | Öncelik | Etki |
|---|-----|---------|------|
| 1 | EmptyState action → actionLabel + onAction + icon | **Kritik** | Buton şu an görünmüyor |
| 2 | Breadcrumbs | Yüksek | Navigasyon tutarlılığı |
| 3 | Table onRowClick | Orta | UX – satıra tıklayınca düzenle |
| 4 | Filtre URL sync | Orta | Paylaşılabilir linkler |
| 5 | PageContainer + Filtre Card | Düşük | Görsel tutarlılık |
| 6 | Tekrarlayan badge → Badge component | Düşük | Component tutarlılığı |

---

## 5. Özet

**Mutlaka yapılmalı:**
1. EmptyState: `action` → `actionLabel` + `onAction` + `icon` (buton şu an çalışmıyor)

**Önerilen:**
2. Breadcrumbs
3. Table onRowClick
4. Filtre URL sync
5. PageContainer + filtre Card tutarlılığı
