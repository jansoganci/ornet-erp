# Müşteri Detay Sayfası — Redesign Planı

> **Tarih:** 2026-02-18  
> **Kaynak:** Figma tasarımı (3 screenshot)  
> **Hedef:** `src/features/customers/CustomerDetailPage.jsx`  
> **Durum:** PLAN — Kararlar kesinleşti, implement edilmeye hazır

---

## Kesinleşen Kararlar

| # | Konu | Karar |
|---|------|-------|
| tax_office | Figma'da vardı | ❌ Eklenmeyecek — Hero'dan çıkarıldı |
| description | İş emirlerinde başlık | ✅ `work_orders_detail` view'ında `wo.description` mevcut |
| worker_name | Atanan teknisyen | ✅ `assigned_workers[0]?.name` (JSON array olarak geliyor) |
| Arızalı durum | Asset status değeri | ✅ `'faulty'` (not: `'fault'` değil) |
| Abonelik uyarısı | Bitiş tarihi uyarısı | ❌ Kaldırıldı — abonelik müşteri iptal edene kadar devam eder |
| Tab URL persist | URL'e yaz mı? | ✅ `useSearchParams` ile `?tab=overview` formatında |

---

## 1. Tasarım Analizi (Screenshot'lardan)

### Screenshot 1 — Üst Alan
```
┌─ Breadcrumb ──────────────────────────────────────── Actions ─┐
│ ← Müşteriler                   [+ Yeni İş Emri] [Düzenle] [Sil] │
└───────────────────────────────────────────────────────────────┘

┌─ Hero Card ───────────────────────────────────────────────────┐
│  [📋 Icon]  Anadolu Holding A.Ş.              ● Aktif          │
│             MUS-001                                            │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ 📍 Lokasyon    │  │ 💳 Vergi No    │  │ 📅 Aylık Gelir   │  │
│  │   3 Adres      │  │  1234567890    │  │   4.400 TL  🔴   │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘

┌─ Tab Bar ─────────────────────────────────────────────────────┐
│ [⊞ Genel ▼]  [📍 Lokasyonlar 3]  [🔧 İş Emirleri 6]          │
│              [📶 SIM 4]           [📦 Ekipman 7]              │
└───────────────────────────────────────────────────────────────┘
```
> **Not:** Figma'daki "Vergi Dairesi" stat kutusu kaldırıldı → 3 kutu kalıyor.

### Screenshot 1 — Genel Tab İçeriği (Üst)
```
┌─ Metrik Kartlar (2x2 Grid) ───────────────────────────────────┐
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ ✅ 3                │  │ 🕐 2                │             │
│  │ Aktif Abonelik      │  │ Açık İş Emri        │             │
│  └─────────────────────┘  └─────────────────────┘             │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ 📶 3                │  │ ⚠️ 1               │             │
│  │ Aktif SIM Kart      │  │ Arızalı Ekipman     │             │
│  └─────────────────────┘  └─────────────────────┘             │
└───────────────────────────────────────────────────────────────┘

┌─ Uyarılar (sadece arızalı ekipman varsa gösterilir) ──────────┐
│ 🔴 1 arızalı ekipman mevcut                                   │
│    Teknik servis ekibi ile koordinasyon sağlanmalıdır.        │
└───────────────────────────────────────────────────────────────┘
```
> **Not:** Abonelik süresi uyarısı kaldırıldı. Sadece `faulty` ekipman varsa alert gösterilir.

### Screenshot 2 — Genel Tab İçeriği (Alt)
```
┌─ Son İş Emirleri ─────────────────────────────────────────────┐
│ ● Zon 12 sensoru yanlış alarm veriyor        15.02.2025       │
│   Merkez Ofis - Ahmet Yılmaz                                  │
│ ● Yıllık genel bakım ve kontrol              10.02.2025       │
│   Depo / Lojistik - Mehmet Kaya                               │
│ ● 3. kata yeni kamera sistemi kurulumu        5.02.2025       │
│   Yönetim Binası - Ali Demir                                  │
│                               [Tüm İş Emirleri →]            │
└───────────────────────────────────────────────────────────────┘

┌─ Lokasyon Özeti (2-col compact grid) ────────────────────────┐
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │ ● Merkez Ofis               │  │ ● Depo / Lojistik       │  │
│  │ Paradox - 48 Zon  1.200/ay  │  │ DSC - 64 Zon  1.200/ay  │  │
│  └─────────────────────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────┐                                │
│  │ ● Yönetim Binası            │                                │
│  │ Honeywell - 96 Zon 2.000/ay │                                │
│  └─────────────────────────────┘                                │
│                               [Tüm Lokasyonlar →]             │
└───────────────────────────────────────────────────────────────┘

┌─ Müşteri Bilgileri (2-col grid) ──────────────────────────────┐
│ Müşteri No    MUS-001        │ Vergi No       1234567890       │
│ Kayıt Tarihi  15 Mart 2019   │ Toplam Lok.    3                │
│ Toplam Ekip.  7              │                                  │
└───────────────────────────────────────────────────────────────┘
```

### Screenshot 3 — Genel Tab İçeriği (En Alt)
```
┌─ İletişim ────────────────────────────────────────────────────┐
│ [📗] Telefon 1    +90 312 555 0101                             │
│ [📗] Telefon 2    +90 532 555 0202                    [↗]      │
│ [💜] E-posta      guvenlik@anadoluholding.com.tr               │
│ [💜] Adres        Atatürk Bulvarı No:45, Kızılay/Ankara        │
└───────────────────────────────────────────────────────────────┘

┌─ Notlar ──────────────────────────────────────────────────────┐
│ 📄  Notlar                                                    │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ VIP müşteri. Özel fiyatlandırma uygulanmaktadır.        │   │
│ │ Aylık kontrol ziyareti yapılmalıdır...                  │   │
│ └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Tam Sayfa Wireframe

```
┌────────────────────────────────────────────────────────────────────────┐
│ SAYFA (maxWidth="full", tek kolon, sidebar YOK)                        │
│                                                                        │
│ ← Müşteriler              [+ Yeni İş Emri] [✏️ Düzenle] [🗑️ Sil]     │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ HERO CARD                                                          │ │
│ │  [🏢]  Anadolu Holding A.Ş.                          ● Aktif      │ │
│ │        MUS-001                                                     │ │
│ │                                                                    │ │
│ │  [📍 3 Adres]   [💳 1234567890 Vergi]   [📅 4.400 TL/ay 🔴]      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ [⊞ Genel] [📍 Lokasyonlar 3] [🔧 İş Emirleri 6] [📶 SIM 4] [📦 7]   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                        │
│   ── GENEL TAB ──────────────────────────────────────────────────     │
│                                                                        │
│   ┌──────────────────────┐  ┌──────────────────────┐                  │
│   │ ✅  3                │  │ 🕐  2                │                  │
│   │ Aktif Abonelik       │  │ Açık İş Emri         │                  │
│   └──────────────────────┘  └──────────────────────┘                  │
│   ┌──────────────────────┐  ┌──────────────────────┐                  │
│   │ 📶  3                │  │ ⚠️  1               │                  │
│   │ Aktif SIM Kart       │  │ Arızalı Ekipman      │                  │
│   └──────────────────────┘  └──────────────────────┘                  │
│                                                                        │
│   [sadece faulty asset varsa:]                                         │
│   🔴 1 arızalı ekipman mevcut — Teknik servis ile koordine edilmeli.  │
│                                                                        │
│   Son İş Emirleri                                                     │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   ● Zon 12 sensoru yanlış alarm veriyor              15.02.2025        │
│     Merkez Ofis - Ahmet Yılmaz                                        │
│   ● Yıllık genel bakım ve kontrol                    10.02.2025        │
│     Depo / Lojistik - Mehmet Kaya                                     │
│   ● 3. kata yeni kamera sistemi kurulumu              5.02.2025        │
│     Yönetim Binası - Ali Demir                                        │
│                                        [Tüm İş Emirleri →]            │
│                                                                        │
│   Lokasyon Özeti                                                      │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   [● Merkez Ofis  Paradox-48  1.200/ay] [● Depo  DSC-64  1.200/ay]   │
│   [● Yönetim B.   Honeywell-96 2.000/ay]                              │
│                                         [Tüm Lokasyonlar →]           │
│                                                                        │
│   Müşteri Bilgileri                                                   │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   Müşteri No: MUS-001    │ Vergi No: 1234567890                        │
│   Kayıt Tarihi: 15.2019  │ Toplam Lokasyon: 3                         │
│   Toplam Ekipman: 7      │                                             │
│                                                                        │
│   İletişim                                                            │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   [📗 Telefon 1  +90 312 555 0101          ]                          │
│   [📗 Telefon 2  +90 532 555 0202       ↗  ]                          │
│   [💜 E-posta   mail@firma.com             ]                          │
│   [💜 Adres     Atatürk Bulvarı...         ]                          │
│                                                                        │
│   Notlar                                                              │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │ VIP müşteri. Özel fiyatlandırma...                             │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ── DİĞER TABLAR ─────────────────────────────────────────────────   │
│   LOKASYONLAR: SiteCard grid + Yeni Lokasyon Ekle butonu               │
│   İŞ EMİRLERİ: Tam iş emirleri tablosu + Yeni İş Emri butonu           │
│   SIM: SIM kartlar tablosu + Yeni SIM Kart Ekle butonu                 │
│   EKİPMAN: Site assets tablosu + Ekipman Ekle butonu                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mevcut vs Yeni Yapı Karşılaştırması

| Özellik | Mevcut | Yeni |
|---------|--------|------|
| Layout | 2-kolon (main + sidebar) | Tek kolon, tam genişlik |
| Navigasyon | Tek scroll | Sekmeli (5 tab) |
| Tab URL | — | `?tab=overview` (`useSearchParams`) |
| Header | PageHeader | Hero Card (ikon, kod, 3 stat) |
| İletişim | Sidebar kartı | Genel tab'ın sonunda |
| Notlar | Sidebar kartı | Genel tab'ın sonunda |
| İş geçmişi | Alt alta tablo | Liste (max 5) + tam tablo ayrı tab |
| Lokasyonlar | SiteCard grid (sayfada) | Özet kartlar + ayrı Lokasyonlar tab'ında full |
| SIM kartlar | Tablo (sayfada) | Ayrı SIM tab'ında |
| Ekipman | Tablo (sayfada) | Ayrı Ekipman tab'ında |
| Metrikler | Sadece lokasyon badge | 4 MetricCard (2x2) |
| Uyarılar | Yok | Sadece arızalı ekipman varsa |

---

## 4. Yeni Bileşen Mimarisi

### 4.1 Dosya Yapısı

```
src/features/customers/
├── CustomerDetailPage.jsx              ← Ana sayfa (tamamen yeniden yazılacak)
│
├── components/
│   ├── CustomerHero.jsx                ← Hero card
│   ├── CustomerTabBar.jsx              ← Tab navigasyon çubuğu
│   ├── CustomerMetricCard.jsx          ← Küçük 2x2 stat kartı
│   ├── CustomerAlertItem.jsx           ← Kırmızı uyarı satırı
│   ├── RecentWorkOrderRow.jsx          ← Kompakt iş emri satırı
│   ├── LocationSummaryCard.jsx         ← Kompakt lokasyon özet kartı
│   └── ContactRow.jsx                  ← İletişim satırı (tel/mail/adres)
│
└── tabs/
    ├── CustomerOverviewTab.jsx         ← Genel tab (tüm overview)
    ├── CustomerLocationsTab.jsx        ← Lokasyonlar tab
    ├── CustomerWorkOrdersTab.jsx       ← İş Emirleri tab
    ├── CustomerSimCardsTab.jsx         ← SIM tab
    └── CustomerEquipmentTab.jsx        ← Ekipman tab
```

### 4.2 Bileşen Detayları

#### `CustomerHero.jsx`
```
Props: { customer, sites, monthlyRevenue, onEdit, onDelete, onNewWorkOrder }
İçerik:
  - Breadcrumb: ← Müşteriler
  - Sağda: [+ Yeni İş Emri] [Düzenle] [Sil] butonları
  - Büyük Building2 ikonu (primary renk kutucuk içinde)
  - company_name (h1, büyük)
  - account_number altında küçük (MUS-001)
  - Sağda ● Aktif badge
  - 3 stat kutusu (yatay flex):
      [📍 X Lokasyon] [💳 Vergi No: xxx] [📅 X.XXX TL/ay (kırmızı)]
```

#### `CustomerTabBar.jsx`
```
Props: { activeTab, onTabChange, counts }
counts: { locations, workOrders, simCards, equipment }
Sekmeler:
  - overview  → ⊞ Genel
  - locations → 📍 Lokasyonlar [3]
  - workOrders → 🔧 İş Emirleri [6]
  - simCards  → 📶 SIM [4]
  - equipment → 📦 Ekipman [7]
State: URL ile sync — useSearchParams parent'ta
```

#### `CustomerMetricCard.jsx`
```
Props: { icon: ReactNode, label: string, value: number, variant }
variant: 'success' | 'warning' | 'info' | 'error' | 'default'
Görünüm: Büyük sayı + etiket + renkli ikon kutusu
```

#### `CustomerAlertItem.jsx`
```
Props: { count: number, message: string }
Tek kullanım: arızalı ekipman uyarısı
Görünüm: Kırmızı sol kenarlık + hafif kırmızı arka plan + uyarı metni
```

#### `RecentWorkOrderRow.jsx`
```
Props: { workOrder, onClick }
Gösterilecek alanlar:
  - workOrder.description || tCommon(`workType.${workOrder.work_type}`)
  - workOrder.site_name + ' - ' + workOrder.assigned_workers?.[0]?.name
  - workOrder.scheduled_date
  - Durum rengi nokta (workOrderStatusVariant ile)
Tıklanınca → /work-orders/:id
```

#### `LocationSummaryCard.jsx`
```
Props: { site, primarySubscription, onTabSwitch }
Gösterilecek alanlar:
  - Renkli nokta (site.is_active → yeşil, değilse gri)
  - site.site_name (bold)
  - site.panel_info (küçük, gri)
  - primarySubscription?.base_price + '/ay' (sağda)
Tıklanınca → onTabSwitch('locations')
```

#### `ContactRow.jsx`
```
Props: { icon, bgColor, label, value, href, showExternalIcon }
Görünüm: [renkli ikon kutu] [etiket üst/değer alt] [↗ opsiyonel]
tel:   → window.location.href = `tel:xxx`
mailto → href={`mailto:xxx`}
adres  → href Google Maps deep link
```

---

## 5. Veri Gereksinimleri

### 5.1 Mevcut Veri — Tamamı Hazır

| Alan | Kaynak | Durum |
|------|--------|-------|
| `customer.company_name` | `customers` | ✅ |
| `customer.account_number` | `customers` | ✅ |
| `customer.phone`, `phone_secondary` | `customers` | ✅ |
| `customer.email` | `customers` | ✅ |
| `customer.tax_number` | `customers` | ✅ |
| `customer.address`, `city`, `district` | `customers` | ✅ |
| `customer.notes` | `customers` | ✅ |
| `customer.created_at` | `customers` | ✅ (Supabase otomatik) |
| `sites[]` | `customer_sites` | ✅ |
| `workOrders[].description` | `work_orders_detail` | ✅ `wo.description` mevcut |
| `workOrders[].assigned_workers` | `work_orders_detail` | ✅ JSON array `[{id, name}]` |
| `simCards[]` | `sim_cards` | ✅ |
| `assets[]` | `site_assets_detail` | ✅ |
| `subscriptions[]` | `subscriptions` | ✅ |

### 5.2 Hesaplanan Değerler (Frontend)

```javascript
const customerSubscriptions = allSubscriptions.filter(s => siteIds.includes(s.site_id));

const monthlyRevenue = customerSubscriptions
  .filter(s => s.status === 'active')
  .reduce((sum, s) => sum + Number(s.base_price || 0), 0);

const activeSubscriptionsCount = customerSubscriptions.filter(s => s.status === 'active').length;

const openWorkOrdersCount = workOrders.filter(
  wo => !['completed', 'cancelled'].includes(wo.status)
).length;

const activeSimCardsCount = simCards.filter(s => s.status === 'active').length;

const faultyEquipmentCount = assets.filter(a => a.status === 'faulty').length; // ← 'faulty'!

// Alert — sadece arızalı ekipman
const alerts = faultyEquipmentCount > 0
  ? [{ count: faultyEquipmentCount }]
  : [];
```

### 5.3 Kaldırılan Alanlar

| Alan | Neden Kaldırıldı |
|------|------------------|
| `customer.tax_office` | DB'ye eklenmeyecek karar verildi |
| Abonelik süresi uyarısı | Abonelik müşteri iptal edene kadar devam eder |

---

## 6. Tab İçerikleri

### Genel Tab (`CustomerOverviewTab`)
1. MetricCard 2x2 grid (Aktif Abonelik, Açık İş Emri, Aktif SIM, Arızalı Ekipman)
2. Uyarılar (sadece `faultyEquipmentCount > 0` ise gösterilir)
3. Son İş Emirleri listesi (max 5, `RecentWorkOrderRow`, "Tüm İş Emirleri" → tab switch)
4. Lokasyon Özeti (max 6, `LocationSummaryCard`, "Tüm Lokasyonlar" → tab switch)
5. Müşteri Bilgileri 2-col grid (account_number, tax_number, created_at, site count, equipment count)
6. İletişim listesi (`ContactRow` × telefon/email/adres)
7. Notlar (gri kutu, yoksa italik "Not yok")

### Lokasyonlar Tab (`CustomerLocationsTab`)
- Mevcut SiteCard grid (kod değişmeyecek, sadece buraya taşınacak)
- "Yeni Lokasyon Ekle" butonu
- SiteFormModal (mevcut)

### İş Emirleri Tab (`CustomerWorkOrdersTab`)
- Mevcut workOrderColumns tablosu (kod değişmeyecek)
- "Yeni İş Emri" butonu
- Boş durum

### SIM Tab (`CustomerSimCardsTab`)
- Mevcut simCardColumns tablosu (kod değişmeyecek)
- "Yeni SIM Kart Ekle" butonu
- Boş durum

### Ekipman Tab (`CustomerEquipmentTab`)
- Mevcut SiteAssetsCard içeriği (kod değişmeyecek)
- Boş durum

---

## 7. CustomerDetailPage.jsx Yeni Yapısı

```jsx
export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab) => setSearchParams({ tab });

  // Mevcut tüm hook'lar korunur
  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: sites = [] } = useSitesByCustomer(id);
  const { data: workOrders = [] } = useWorkOrdersByCustomer(id);
  const { data: simCards = [] } = useSimCardsByCustomer(id);
  const { data: assets = [] } = useAssetsByCustomer(id);     // ← yeni hook
  const { data: allSubscriptions = [] } = useSubscriptions({});

  const siteIds = sites.map(s => s.id);
  const customerSubscriptions = allSubscriptions.filter(s => siteIds.includes(s.site_id));

  // Hesaplanan değerler
  const monthlyRevenue = customerSubscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + Number(s.base_price || 0), 0);

  const counts = {
    activeSubscriptions: customerSubscriptions.filter(s => s.status === 'active').length,
    openWorkOrders: workOrders.filter(wo => !['completed','cancelled'].includes(wo.status)).length,
    activeSimCards: simCards.filter(s => s.status === 'active').length,
    faultyEquipment: assets.filter(a => a.status === 'faulty').length,
    locations: sites.length,
    workOrders: workOrders.length,
    simCards: simCards.length,
    equipment: assets.length,
  };

  // Modal state'ler (mevcut)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">

      <CustomerHero
        customer={customer}
        monthlyRevenue={monthlyRevenue}
        locationCount={sites.length}
        onEdit={() => navigate(`/customers/${id}/edit`)}
        onDelete={() => setShowDeleteModal(true)}
        onNewWorkOrder={() => navigate(`/work-orders/new?customerId=${id}`)}
      />

      <CustomerTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {activeTab === 'overview' && (
        <CustomerOverviewTab
          customer={customer}
          sites={sites}
          workOrders={workOrders}
          assets={assets}
          counts={counts}
          customerSubscriptions={customerSubscriptions}
          onTabSwitch={setActiveTab}
        />
      )}
      {activeTab === 'locations' && (
        <CustomerLocationsTab
          sites={sites}
          customerId={id}
          subscriptionsBySite={subscriptionsBySite}
          onAddSite={handleAddSite}
          onEditSite={handleEditSite}
          onNewWorkOrder={handleNewWorkOrder}
          navigate={navigate}
        />
      )}
      {activeTab === 'workOrders' && (
        <CustomerWorkOrdersTab
          customerId={id}
          workOrders={workOrders}
          onNewWorkOrder={() => navigate(`/work-orders/new?customerId=${id}`)}
        />
      )}
      {activeTab === 'simCards' && (
        <CustomerSimCardsTab
          simCards={simCards}
          onAddSimCard={() => navigate(`/sim-cards/new?customerId=${id}`)}
        />
      )}
      {activeTab === 'equipment' && (
        <CustomerEquipmentTab customerId={id} sites={sites} />
      )}

      {/* Mevcut modal'lar */}
    </PageContainer>
  );
}
```

---

## 8. Uygulama Adımları (Sıralı)

| # | Dosya | Açıklama | Bağımlılık |
|---|-------|----------|------------|
| 1 | `CustomerMetricCard.jsx` | Küçük stat kartı | — |
| 2 | `CustomerAlertItem.jsx` | Kırmızı uyarı satırı | — |
| 3 | `ContactRow.jsx` | İletişim satırı | — |
| 4 | `RecentWorkOrderRow.jsx` | Kompakt iş emri satırı | — |
| 5 | `LocationSummaryCard.jsx` | Kompakt lokasyon kartı | — |
| 6 | `CustomerHero.jsx` | Hero card | 1 |
| 7 | `CustomerTabBar.jsx` | Tab navigasyon | — |
| 8 | `CustomerOverviewTab.jsx` | Genel tab | 1-5 |
| 9 | `CustomerLocationsTab.jsx` | Mevcut SiteCard taşınır | — |
| 10 | `CustomerWorkOrdersTab.jsx` | Mevcut tablo taşınır | — |
| 11 | `CustomerSimCardsTab.jsx` | Mevcut tablo taşınır | — |
| 12 | `CustomerEquipmentTab.jsx` | Mevcut SiteAssetsCard taşınır | — |
| 13 | `CustomerDetailPage.jsx` | Ana sayfa yeniden yazılır | 1-12 |
| 14 | `customers.json` | Yeni i18n anahtarları | — |

---

**Son Güncelleme:** 2026-02-18 — Tüm kararlar kesinleşti
