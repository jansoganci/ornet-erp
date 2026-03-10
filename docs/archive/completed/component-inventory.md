# Component Inventory & Usage Map

> **Hedef:** Tüm sayfalarda tutarlı tasarım için component kullanımını standardize etmek.
> **Prensip:** Yeni component oluşturmadan önce mevcut component'lerin extend edilip edilemeyeceğini kontrol et.

---

## 📦 Mevcut Component Library

### Core UI Components (`src/components/ui/`)

| Component | Variants | Kullanım Sayısı | Durum |
|-----------|----------|-----------------|-------|
| **Button** | primary, secondary, outline, ghost, danger, success | ~50+ | ✅ İyi |
| **Card** | default, interactive, selected | ~40+ | ✅ İyi |
| **Input** | default, error, success | ~30+ | ✅ İyi |
| **Select** | default | ~20+ | ✅ İyi |
| **Textarea** | default | ~15+ | ✅ İyi |
| **Badge** | default, outline, success, error, warning | ~30+ | ✅ İyi |
| **Table** | default | ~15+ | ✅ İyi |
| **Modal** | default | ~20+ | ✅ İyi |
| **Spinner** | sm, md, lg | ~25+ | ✅ İyi |
| **Skeleton** | text, circle, rect | ~10+ | ✅ İyi |
| **EmptyState** | default | ~15+ | ✅ İyi |
| **ErrorState** | default | ~15+ | ✅ İyi |
| **SearchInput** | default | ~10+ | ✅ İyi |
| **IconButton** | ghost, primary | ~10+ | ✅ İyi |

### Özel Component'ler

| Component | Base Component | Kullanım | Durum |
|-----------|----------------|----------|-------|
| **MaterialCombobox** | Input + Modal | Work Orders, Proposals | ✅ OK (domain-specific) |
| **SimCardCombobox** | Input + Modal | Finance | ✅ OK (domain-specific) |

---

## 🎯 Feature-Specific Component'ler

### Dashboard
- **StatCard** → `Card` extend ediyor ✅
- **KpiCard** → `Card` extend ediyor ✅

### Finance
- **KpiCard** → `Card` extend ediyor ✅
- **ViewModeToggle** → Custom (Select benzeri) ⚠️ Kontrol et

### Subscriptions
- **SubscriptionStatusBadge** → `Badge` extend ediyor ✅
- **SubscriptionPricingCard** → `Card` extend ediyor ✅
- **MonthlyPaymentGrid** → `Card` extend ediyor ✅

### Proposals
- **ProposalStatusBadge** → `Badge` extend ediyor ✅

### Site Assets
- **AssetStatusBadge** → `Badge` extend ediyor ✅
- **SiteAssetsCard** → `Card` extend ediyor ✅

### Tasks
- **PlanGroupSection** → `Card` + `Badge` kullanıyor ✅

---

## ⚠️ Potansiyel Sorunlar

### 1. Custom Skeleton'lar
**Sorun:** Bazı sayfalarda custom skeleton component'leri var.

**Örnekler:**
- `DashboardPage.jsx` → `TodoListSkeleton` (inline component)
- `TasksPage.jsx` → `TasksSkeleton` (inline component)

**Çözüm:** 
- ✅ `Skeleton` component'ini kullan
- ✅ Gerekirse `Skeleton` component'ine yeni variant'lar ekle

### 2. Status Badge'leri
**Durum:** Her feature kendi status badge'ini oluşturmuş ama hepsi `Badge` component'ini extend ediyor ✅

**Öneri:** 
- Mevcut durum iyi, değişiklik gerekmez
- Yeni feature'larda da aynı pattern'i kullan

### 3. Card Variants
**Durum:** `Card` component'i iyi extend ediliyor ✅

**Örnekler:**
- `StatCard` → `Card` kullanıyor
- `KpiCard` → `Card` kullanıyor
- `SubscriptionPricingCard` → `Card` kullanıyor

---

## 📋 Component Kullanım Kuralları

### ✅ DO (Yapılması Gerekenler)

1. **Mevcut component'leri kullan**
   - Yeni bir component oluşturmadan önce mevcut component'lerin extend edilip edilemeyeceğini kontrol et
   - Örnek: Yeni bir card tipi gerekiyorsa `Card` component'ini extend et

2. **Variant pattern'i kullan**
   - Component'lere yeni özellik eklemek için variant ekle
   - Örnek: `Button` component'ine yeni variant eklemek

3. **Composition pattern'i kullan**
   - Küçük component'leri birleştirerek büyük component'ler oluştur
   - Örnek: `Card` + `Badge` + `Button` = Feature-specific component

### ❌ DON'T (Yapılmaması Gerekenler)

1. **Gereksiz component oluşturma**
   - Mevcut component'i extend edebiliyorsan yeni component oluşturma
   - Örnek: `Card` kullanılabilirken yeni bir `Box` component'i oluşturma

2. **Inline component'ler**
   - Sayfa içinde inline component tanımlama
   - Örnek: `DashboardPage` içinde `TodoListSkeleton` tanımlamak yerine `Skeleton` kullan

3. **Duplicate component'ler**
   - Aynı işlevi gören birden fazla component oluşturma
   - Örnek: `StatusBadge` ve `CustomBadge` gibi duplicate'ler

---

## 🔄 İyileştirme Planı

### Phase 1: Mevcut Durumu Standardize Et

1. **Custom Skeleton'ları temizle**
   - [ ] `DashboardPage.jsx` → `Skeleton` kullan
   - [ ] `TasksPage.jsx` → `Skeleton` kullan
   - [ ] Diğer sayfalarda custom skeleton var mı kontrol et

2. **Component kullanımını audit et**
   - [ ] Tüm sayfalarda aynı component'lerin kullanıldığından emin ol
   - [ ] Inline component'leri tespit et ve düzelt

### Phase 2: Component Library Genişletme

1. **21st.dev'den eksik component'leri ekle**
   - [ ] DatePicker (form'larda kullanılabilir)
   - [ ] Tabs (detail sayfalarında kullanılabilir)
   - [ ] Dropdown Menu (daha gelişmiş dropdown'lar için)
   - [ ] Dialog variants (Modal'a alternatif)

2. **Mevcut component'leri iyileştir**
   - [ ] `Table` component'ine sorting, filtering ekle
   - [ ] `Card` component'ine yeni variant'lar ekle
   - [ ] `Badge` component'ine yeni variant'lar ekle

### Phase 3: Sayfa Bazlı İyileştirme

1. **Dashboard** → StatCard'ları iyileştir
2. **Customers List** → Table'ı iyileştir
3. **Finance Dashboard** → Chart'ları iyileştir
4. **Work Orders** → Form UX'i iyileştir

---

## 📊 Component Kullanım İstatistikleri

### En Çok Kullanılan Component'ler

1. **Button** - 50+ kullanım
2. **Card** - 40+ kullanım
3. **Input** - 30+ kullanım
4. **Badge** - 30+ kullanım
5. **Spinner** - 25+ kullanım
6. **Modal** - 20+ kullanım
7. **Select** - 20+ kullanım
8. **Table** - 15+ kullanım
9. **EmptyState** - 15+ kullanım
10. **ErrorState** - 15+ kullanım

### Sayfa Bazlı Component Kullanımı

| Sayfa | Kullanılan Component'ler | Custom Component Var mı? |
|-------|--------------------------|--------------------------|
| Dashboard | Card, Button, Skeleton, ErrorState | ✅ StatCard (Card extend) |
| Customers List | Table, Button, SearchInput, Badge, EmptyState, ErrorState | ❌ Yok |
| Finance Dashboard | Card, Select, Spinner, ErrorState | ✅ KpiCard (Card extend) |
| Work Orders List | Table, Button, SearchInput, Badge, EmptyState, ErrorState | ❌ Yok |
| Tasks | Card, Button, Select, Modal, EmptyState, Skeleton, ErrorState | ❌ Yok (TasksSkeleton inline) |

---

## 🎨 Design Token Uyumluluğu

Tüm component'ler şu design token'ları kullanıyor:
- ✅ Color palette (primary, neutral, success, error, warning)
- ✅ Spacing scale (4px base)
- ✅ Typography (Inter font)
- ✅ Border radius (8px default)
- ✅ Dark mode support

---

## 📝 Notlar

- Component'ler `src/components/ui/` klasöründe
- Feature-specific component'ler `src/features/{feature}/components/` klasöründe
- Tüm component'ler Tailwind CSS kullanıyor
- Design token'lar `src/index.css` içinde tanımlı

---

**Son Güncelleme:** 2026-02-18
**Sonraki Adım:** Phase 1 - Custom Skeleton'ları temizle
