# Finans Ozeti (Dashboard) V2 — Plan & Wireframe

> **Arsiv:** Uygulama tamamlandi; referans/tarihsel plan olarak **2026-03-21** tarihinde `docs/active/` altindan tasindi. Canli kod: `src/features/finance/FinanceDashboardPage.jsx`, `src/features/finance/components/dashboard/`.
>
> **Durum (arsiv aninda):** ~~Planlama (uretim oncesi)~~ → **Tamamlandi (T8)**
> **Ilgili:** `LAUNCH_READY_TODO.md` T8, `src/features/finance/FinanceDashboardPage.jsx`
> **Prensipler:** KOBi dili, sekme bazli kanallar, bar grafik (pasta yok), net kar iddiasi yok, i18n zorunlu, moduler feature yapisi, mobil + tablet.
> **Felsefe:** "Think fast, iterate faster." iPhone gibi — kullanim kilavuzuna gerek olmayan bir ekran. Teknoloji bilmeyen KOBi sahibi actiginda hemen anlayacak.

---

## 1. Hedef ve kapsam disi

| Hedef | Kapsam disi (simdilik) |
|--------|-------------------------|
| Sahip icin "abonelik / SIM / isler" kanallarini ayirmak | Nakit / vade / alacak takvimi (ileride) |
| Tahmini aylik gelir dili, musteri basi abonelik ortalamasi | Ileri duzey KPI seti |
| Secilen ay/yil + resmi/gayri resmi filtresi | Net kar KPI (gercek net kar icin tum veri akislari tamamlanmali) |
| Bar grafikler (kanala gore) | Pasta, mum grafik |
| Telefon ve tablet duzenleri | Parasut entegrasyonu |
| Ozet sekmesinde "Bu ay ne kadar kazandim?" sorusuna cevap | Tahsilat gecikme takibi (is bugun, para 7-8 ay sonra) |
| Genel giderlerin goruntulenmesi (maas, kira, yakit vb.) | Genel giderlerin kanallara dagilimi |

---

## 2. Sekme yapisi (4 sekme)

```
[ Ozet | Isler | Abonelikler | SIM Kartlar ]
```

| Sekme | Amac | Veri Kaynaklari |
|-------|------|-----------------|
| **Ozet** | Buyuk resim: toplam gelir, toplam gider, kalan + genel gider dokumu | Tum kanallar + genel giderler |
| **Isler** | Montaj, servis, is emri, teklif geliri | `income_type` IN (service, sale, installation, maintenance, other) |
| **Abonelikler** | Aylik tahmini abonelik geliri | `income_type` = subscription, `expense_code` = subscription_cogs |
| **SIM Kartlar** | SIM kart gelir/zarar | `income_type` = sim_rental, `expense_code` = sim_operator |

### Kanal esleme detayi (v_profit_and_loss source_type)

```
ISLER SEKMESI
  Gelir:  source_type IN ('service', 'sale', 'installation', 'maintenance', 'other')
  Gider:  cogs_try alani (teklif tamamlaninca otomatik hesaplanan maliyet)
  Not:    Manuel gelir kayitlari (installation, maintenance, other) buraya duser

ABONELIKLER SEKMESI
  Gelir:  source_type = 'subscription'
  Gider:  source_type = 'subscription_cogs'
  Not:    Tetikleyici: subscription_payment status -> 'paid' olunca otomatik olusur

SIM KARTLAR SEKMESI
  Gelir:  source_type = 'sim_rental'
  Gider:  source_type = 'sim_operator'
  Not:    Gelir sadece wholesale (aboneligi olmayan) lokasyonlar icin olusur

OZET SEKMESI
  Gelir:  Tum kanallardan toplam
  Gider:  Tum kanal giderleri + genel isletme giderleri
  Genel giderler: material, fuel, payroll, rent, utilities, communication,
                  vehicle, fixed_assets, sgk, tax_withholding, accounting,
                  insurance, software, food_transport, office_supplies, other
```

---

## 3. Filtreler (tum sekmelerde ortak)

| Filtre | Tip | Varsayilan | Aciklama |
|--------|-----|-----------|----------|
| **Yil** | Select (dropdown) | Guncel yil | 2023, 2024, 2025, 2026... (veritabanindaki en eski yildan baslayarak) |
| **Ay** | Select (dropdown) | Guncel ay | Ocak-Aralik. "Tum Yil" secenegi var |
| **Kayit Turu** | ViewModeToggle | Toplam | Toplam / Resmi / Gayri Resmi (mevcut bilesenimiz var) |

**URL parametreleri:** `?year=2026&month=03&viewMode=total&tab=overview`

**"Tum Yil" secildiginde:** O yilin 12 ayinin toplami gosterilir (yillik ozet).
**Ay secildiginde:** Sadece o ayin verileri gosterilir.

---

## 4. Sekme icerikleri

### 4.1 Ozet Sekmesi

**Amac:** "Bu ay/yil kar ettim mi?" sorusuna tek bakista cevap.

**Icerik:**
```
+------------------------------------------+
| TOPLAM GELIR               +185.000 TL   |  <- 3 kanalin toplami (yesil)
| TOPLAM GIDER               - 72.000 TL   |  <- kanal giderleri + genel giderler (kirmizi)
| ---------------------------------------- |
| KALAN                      +113.000 TL   |  <- basit fark (yesil/kirmizi renge gore)
+------------------------------------------+

+-- Genel Giderler Dokumu ----------+
| Personel Maasi          28.000 TL |
| Yakit                    8.500 TL |
| Kira                    12.000 TL |
| SGK Primi                9.200 TL |
| Muhasebe Hizmeti         2.500 TL |
| Diger                    1.800 TL |
+-----------------------------------+
```

**KPI sayisi:** 3 (toplam gelir, toplam gider, kalan)
**Grafik:** Yok (basit tutuyoruz)
**Brut kar marji:** Yok (ozet sekmesinde kanal bazli degiliz)
**Genel giderler listesi:** Son isleme gore siralama (last in, first show). Duz liste.

---

### 4.2 Isler Sekmesi

**Amac:** Montaj, servis, teklif islerinden ne kadar kazandim?

**KPI'lar (2-3 adet):**

| KPI | Hesaplama | Turkce Etiket |
|-----|-----------|---------------|
| Islerden gelen gelir | SUM(amount_try) WHERE source_type IN (...) AND direction='income' | "Islerden gelen gelir" |
| Is maliyeti | SUM(cogs_try) (teklif satirlarindan gelen COGS) | "Toplam is maliyeti" |
| Brut kar marji | (gelir - maliyet) / gelir * 100 | "Brut kar marji" |

**Bar grafik:**
- X ekseni: Aylar (secilen yil icindeki 12 ay veya son 6 ay)
- Y ekseni: TL
- 2 bar: Gelir (yesil) + Maliyet (kirmizi)
- Baslik: "Islerden aylik gelir"

**Veri notu:** Standalone is emirleri `service` olarak, teklif tamamlamalari `sale` olarak kaydedilir. Manuel girislerde kullanici `installation`, `maintenance`, `other` secebilir — hepsi bu sekmede gorulur.

---

### 4.3 Abonelikler Sekmesi

**Amac:** Abonelerden ayda ne kadar para geliyor?

**KPI'lar (2-3 adet):**

| KPI | Hesaplama | Turkce Etiket |
|-----|-----------|---------------|
| Tahmini aylik gelir | get_subscription_stats -> mrr | "Abonelerden tahmini aylik gelir" |
| Musteri basi gelir | mrr / distinct_customer_count | "Musteri basi abonelik geliri" |
| Brut kar marji | (subscription gelir - subscription_cogs) / subscription gelir * 100 | "Brut kar marji" |

**Bar grafik:**
- X ekseni: Aylar
- Y ekseni: TL
- 2 bar: Abonelik geliri (yesil) + Abonelik maliyeti (kirmizi)
- Baslik: "Aboneliklerden aylik gelir"

**Veri notu:**
- "Tahmini aylik gelir" anliktir (aktif aboneliklerin toplami), ay secimiyle degismez. Bunu kullaniciya kucuk bir hint ile acikliyoruz: "Bu rakam su anki aktif aboneliklerin toplamidir."
- Grafikteki gelir/gider ise secilen donemde gerceklesen odemelerdir (financial_transactions'tan).

---

### 4.4 SIM Kartlar Sekmesi

**Amac:** SIM kartlardan ne kadar gelir/zarar var?

**KPI'lar (2-3 adet):**

| KPI | Hesaplama | Turkce Etiket |
|-----|-----------|---------------|
| SIM gelir | SUM(amount_try) WHERE source_type='sim_rental' AND direction='income' | "SIM kartlardan gelen gelir" |
| SIM gider | SUM(amount_try) WHERE source_type='sim_operator' AND direction='expense' | "Operator gideri" |
| Brut kar marji | (gelir - gider) / gelir * 100 | "Brut kar marji" |

**Bar grafik:**
- X ekseni: Aylar
- Y ekseni: TL
- 2 bar: SIM geliri (yesil) + Operator gideri (kirmizi)
- Baslik: "SIM kartlardan aylik gelir"

---

## 5. Wireframe — mobil (telefon, ~390px)

```
+-------------------------------+
| =  Finans Ozeti               |
| [ Gelir Ekle ] [ Gider Ekle ] |
+-------------------------------+
| Yil [ 2026 v ]   Ay [ Mart v ]|
| Kayit: [ Top | Res | Gay ]    |
+-------------------------------+
| [ Ozet | Isler | Abone | SIM ]|  <- segment / tab (scrollable)
+-------------------------------+
|                                |
| +----------------------------+ |
| | Toplam gelir    +185.000   | |  <- KPI kartlari (stack)
| | Toplam gider     -72.000   | |
| | Kalan           +113.000   | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Genel Giderler             | |  <- Liste (Ozet sekmesinde)
| | Personel Maasi    28.000   | |
| | Yakit              8.500   | |
| | Kira              12.000   | |
| | ...                        | |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Kanal sekmesi secildiginde (ornek: Isler):**

```
+-------------------------------+
| ...filtreler...               |
| [ Ozet | *Isler* | Abon | SIM]|
+-------------------------------+
|                                |
| +----------------------------+ |
| | Islerden gelen    +42.000  | |
| | Is maliyeti       -18.000  | |
| | Brut kar marji      57.1%  | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | [ Bar grafik               | |
| |   h-48, aylik gelir/gider ]| |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Mobil notlar:**
- Segment: min 44px dokunma alani, 4 sekme scrollable veya esit genislik
- Grafik: `ResponsiveContainer` + `h-48`; etiketler `text-[11px]`
- KPI kartlari: dikey stack, tam genislik

---

## 6. Wireframe — tablet / masaustu

**Tablet (768px+):**
- Filtreler: yatay `flex-row` (yil + ay + viewmode tek satir)
- KPI: `grid-cols-3` (3 kart yan yana)
- Grafik: tam genislik, `h-64`

**Masaustu (1024px+):**
- KPI kartlari + grafik yan yana olabilir (`lg:grid-cols-2`: sol KPI stack, sag grafik)
- Veya ust KPI seridi + alt grafik (veri yogunluguna gore)

---

## 7. Moduler dosya yapisi

```
src/features/finance/
  FinanceDashboardPage.jsx          # Orchestrator: state, tab, filters, layout
  api.js                            # + fetchChannelMetrics(), fetchGeneralExpenses()
  hooks.js                          # + useChannelMetrics(), useGeneralExpenses()
  components/
    ViewModeToggle.jsx              # Mevcut (degismez)
    dashboard/                      # YENI
      FinanceDashboardTabs.jsx      # 4 sekme UI + activeTab
      FinanceDashboardFilters.jsx   # Yil + Ay + ViewMode
      OverviewTab.jsx               # Ozet: gelir/gider/kalan + genel giderler
      WorkTab.jsx                   # Isler: KPI + bar chart
      SubscriptionsTab.jsx          # Abonelikler: KPI + bar chart
      SimTab.jsx                    # SIM: KPI + bar chart
      ChannelKpiCard.jsx            # Tekrar kullanilabilir KPI kart
      ChannelBarChart.jsx           # Tekrar kullanilabilir bar grafik
```

---

## 8. API / veri katmani

### 8.1 Kanal metrikleri (yeni fonksiyon)

```javascript
// api.js
export async function fetchChannelMetrics({ channel, year, month, viewMode }) {
  // v_profit_and_loss'tan channel'a gore filtrelenmis veri cekilir
  // channel esleme:
  //   'work'          -> source_type IN ('service','sale','installation','maintenance','other') direction='income'
  //                      + cogs_try toplami (ayni satirlardaki cogs_try)
  //   'subscriptions' -> source_type = 'subscription' (income) + 'subscription_cogs' (expense)
  //   'sim'           -> source_type = 'sim_rental' (income) + 'sim_operator' (expense)
  //   'overview'      -> tum satirlar (gelir + gider toplami)
  //
  // Donus: { revenue, costs, grossMarginPct, monthlyBreakdown: [{period, revenue, costs}] }
}
```

### 8.2 Genel giderler (yeni fonksiyon)

```javascript
// api.js
export async function fetchGeneralExpenses({ year, month, viewMode }) {
  // v_profit_and_loss'tan direction='expense' AND source_type NOT IN
  //   ('subscription_cogs', 'sim_operator') olanlari cekilir
  // Bunlar kanal-spesifik olmayan genel isletme giderleri
  // Siralama: created_at DESC (son eklenen en ustte)
  //
  // Donus: [{ category: 'payroll', amount: 28000, created_at: '...' }, ...]
}
```

### 8.3 Mevcut fonksiyonlarin durumu

| Mevcut Fonksiyon | V2'de | Not |
|-----------------|-------|-----|
| fetchFinanceDashboardKpis | Kaldirilacak | Yeni fetchChannelMetrics ile degistirilir |
| fetchRevenueExpensesByMonth | Kaldirilacak | ChannelMetrics icinde monthlyBreakdown olarak |
| fetchExpenseByCategory | Kaldirilacak | Pie chart yok, genel giderler icin fetchGeneralExpenses |
| fetchRecentTransactions | Kaldirilacak (V2'de yok) | Ileride geri eklenebilir |
| fetchProfitAndLoss | Korunur | ReportsPage kullaniyor |
| get_subscription_stats RPC | Korunur | Abonelikler sekmesi "tahmini aylik gelir" icin |

### 8.4 Filtre mantigi

```javascript
// Yil + Ay -> period filtresi
// Ay secili:    period = '2026-03'
// Ay secili degil (tum yil): period IN ('2026-01', '2026-02', ... '2026-12')
//
// ViewMode:
//   'total'      -> filtre yok
//   'official'   -> is_official = true
//   'unofficial' -> is_official = false
```

---

## 9. i18n (`src/locales/tr/finance.json`)

Yeni `dashboardV2` bloku (mevcut `dashboard` kalir, ReportsPage breadcrumb icin kullaniliyor):

```json
{
  "dashboardV2": {
    "title": "Finans Ozeti",
    "tabs": {
      "overview": "Ozet",
      "work": "Isler",
      "subscriptions": "Abonelikler",
      "sim": "SIM Kartlar"
    },
    "filters": {
      "year": "Yil",
      "month": "Ay",
      "allMonths": "Tum Yil"
    },
    "overview": {
      "totalRevenue": "Toplam gelir",
      "totalExpenses": "Toplam gider",
      "remaining": "Kalan",
      "generalExpenses": "Genel Giderler",
      "noExpenses": "Bu donemde genel gider kaydi yok"
    },
    "work": {
      "revenue": "Islerden gelen gelir",
      "costs": "Toplam is maliyeti",
      "grossMargin": "Brut kar marji",
      "chartTitle": "Islerden aylik gelir",
      "noData": "Bu donemde is geliri kaydi yok"
    },
    "subscriptions": {
      "estimatedMonthly": "Abonelerden tahmini aylik gelir",
      "perCustomer": "Musteri basi abonelik geliri",
      "grossMargin": "Brut kar marji",
      "chartTitle": "Aboneliklerden aylik gelir",
      "hint": "Bu rakam su anki aktif aboneliklerin toplamidir.",
      "noData": "Bu donemde abonelik geliri yok"
    },
    "sim": {
      "revenue": "SIM kartlardan gelen gelir",
      "operatorCost": "Operator gideri",
      "grossMargin": "Brut kar marji",
      "chartTitle": "SIM kartlardan aylik gelir",
      "noData": "Bu donemde SIM kart geliri yok"
    },
    "chart": {
      "revenue": "Gelir",
      "costs": "Maliyet",
      "expenses": "Gider"
    },
    "loading": "Veriler yukleniyor...",
    "error": "Veriler yuklenirken bir hata olustu.",
    "noDataGeneral": "Secilen donemde veri bulunamadi."
  }
}
```

---

## 10. Brut kar marji hesaplama

Her kanal icin:

```
Brut Kar Marji (%) = (Kanal Geliri - Kanal Maliyeti) / Kanal Geliri * 100
```

| Kanal | Gelir | Maliyet | Not |
|-------|-------|---------|-----|
| Isler | SUM(amount_try) income rows | SUM(cogs_try) ayni satirlardaki maliyet | Teklif tamamlaninca cogs_try otomatik hesaplanir |
| Abonelikler | SUM subscription income | SUM subscription_cogs expense | Odeme tetikleyicisi her ikisini de olusturur |
| SIM | SUM sim_rental income | SUM sim_operator expense (mutlak deger) | Gelir sadece wholesale lokasyonlar |
| Ozet | Hesaplanmaz | -- | Ozet sekmesinde brut kar marji yok |

**Onemli:** Genel giderler (maas, kira vb.) brut kar marjina DAHIL EDILMEZ. Bunlar isletme gideridir, urun maliyeti degildir.

---

## 11. Responsive ozeti (Tailwind)

| Breakpoint | Davranis |
|------------|----------|
| default (<640px) | Sekmeler scrollable segment, KPI stack, grafik tam genislik h-48 |
| sm: (640px) | Filtreler daha iyi wrap |
| md: (768px) | KPI grid-cols-3, filtreler tek satir, grafik h-64 |
| lg: (1024px) | KPI + grafik yan yana mumkun |

Dark mode: tum yeni kartlarda `dark:` siniflari.

---

## 12. Test / QA

- [ ] Kanal esleme: Her sekmede dogru source_type'lar mi geliyor?
- [ ] ViewMode: Toplam/Resmi/Gayri Resmi her sekmede dogru filtre uyguluyor mu?
- [ ] Yil filtresi: Tum yil secildiginde 12 ayin toplami dogru mu?
- [ ] Ay filtresi: Tek ay secildiginde sadece o ayin verisi mi?
- [ ] Brut kar marji: Gelir 0 oldugunda "--" gosteriliyor mu (bolme hatasi yok mu)?
- [ ] Ozet sekmesi: 3 kanalin toplami + genel giderler = toplam gider dogru mu?
- [ ] Abonelik sekmesi: "Tahmini aylik gelir" anlik, grafik secilen doneme gore -- karisiklik yok mu?
- [ ] Mobil: 4 sekme 390px ekranda kullanilabilir mi?
- [ ] Dark mode: Tum yeni bilesenler dark mode'da gorunur mu?
- [ ] i18n: Tum metinler finance.json'dan geliyor mu, hardcode Turkce yok mu?

---

## 13. Uygulama plani — Phase by Phase

### Genel strateji

- Mevcut dashboard (FinanceDashboardPage.jsx) tum phase'ler bitene kadar AYNEN kalir
- Yeni bilesenler `components/dashboard/` altinda olusturulur
- Phase 5'te eski sayfa yenisiyle degistirilir, kullanilmayan kod temizlenir
- Her phase bagimsiz test edilebilir ama deploy Phase 5 sonrasi yapilir

---

### Phase 0 — Altyapi (i18n, API, hooks, ortak bilesenler)

**Amac:** Tum sekmelerin kullanacagi temel katmani kurmak. Hicbir UI degisikligi yok.

#### 0.1 i18n

**Dosya:** `src/locales/tr/finance.json`
**Is:** `dashboardV2` blokunu ekle (yukaridaki Section 9'daki tum key'ler)
**Kural:** Mevcut `dashboard` bloku kalir (ReportsPage breadcrumb kullanir)

#### 0.2 API fonksiyonlari

**Dosya:** `src/features/finance/api.js`

**Yeni fonksiyon 1: `fetchChannelMetrics`**
```javascript
fetchChannelMetrics({ channel, year, month, viewMode })
// Tek sorgu: v_profit_and_loss'tan period filtresiyle tum satirlari cek
// JS tarafinda channel'a gore filtrele ve aggrege et
//
// Return:
// {
//   revenue: number,          // toplam gelir (TL)
//   costs: number,            // toplam maliyet (TL, mutlak deger)
//   grossMarginPct: number|null, // (revenue-costs)/revenue*100, revenue=0 ise null
//   monthlyBreakdown: [       // bar grafik icin
//     { period: '2026-01', revenue: 12000, costs: 4500 },
//     { period: '2026-02', revenue: 15000, costs: 5200 },
//     ...
//   ]
// }
```

**Yeni fonksiyon 2: `fetchGeneralExpenses`**
```javascript
fetchGeneralExpenses({ year, month, viewMode })
// v_profit_and_loss'tan:
//   direction = 'expense'
//   source_type NOT IN ('subscription_cogs', 'sim_operator')
// Kategori bazli aggregate, created_at DESC siralama
//
// Return:
// [
//   { category: 'payroll', categoryLabel: 'Personel Maasi', amount: 28000 },
//   { category: 'fuel', categoryLabel: 'Yakit', amount: 8500 },
//   ...
// ]
```

**Yeni fonksiyon 3: `fetchOverviewTotals`**
```javascript
fetchOverviewTotals({ year, month, viewMode })
// Tum v_profit_and_loss satirlarindan:
//   totalRevenue: SUM(amount_try) WHERE direction='income'
//   totalChannelCosts: SUM(abs(amount_try)) WHERE direction='expense' AND source_type IN ('subscription_cogs','sim_operator') + SUM(cogs_try) for work
//   totalGeneralExpenses: SUM(abs(amount_try)) WHERE direction='expense' AND source_type NOT IN ('subscription_cogs','sim_operator')
//   totalExpenses: totalChannelCosts + totalGeneralExpenses
//   remaining: totalRevenue - totalExpenses
//
// Return: { totalRevenue, totalExpenses, remaining }
```

**Query key'ler:**
```javascript
export const dashboardV2Keys = {
  all: ['finance_dashboard_v2'],
  channel: (channel, year, month, viewMode) =>
    [...dashboardV2Keys.all, 'channel', channel, year, month, viewMode],
  overview: (year, month, viewMode) =>
    [...dashboardV2Keys.all, 'overview', year, month, viewMode],
  generalExpenses: (year, month, viewMode) =>
    [...dashboardV2Keys.all, 'general_expenses', year, month, viewMode],
};
```

#### 0.3 React Query hooks

**Dosya:** `src/features/finance/hooks.js`

```javascript
useChannelMetrics({ channel, year, month, viewMode })   // -> useQuery
useOverviewTotals({ year, month, viewMode })             // -> useQuery
useGeneralExpenses({ year, month, viewMode })             // -> useQuery
```

#### 0.4 Ortak UI bilesenleri

**Dosya:** `src/features/finance/components/dashboard/ChannelKpiCard.jsx`

```
+----------------------------------+
| Islerden gelen gelir             |  <- baslik (text-sm, neutral-500)
| +42.000 TL                      |  <- deger (text-xl, font-bold)
+----------------------------------+
```

**Props:**
- `title: string` — i18n key'den gelen Turkce etiket
- `value: string` — formatlanmis deger (formatCurrency veya `%57.1`)
- `loading: boolean` — Skeleton goster
- `variant: 'positive' | 'negative' | 'neutral'` — renk (yesil/kirmizi/gri)

**UI detaylari:**
- Card: `p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717]`
- Baslik: `text-sm text-neutral-500 dark:text-neutral-400 mb-1`
- Deger: `text-xl font-bold tabular-nums`
  - positive: `text-emerald-600 dark:text-emerald-400`
  - negative: `text-red-600 dark:text-red-400`
  - neutral: `text-neutral-900 dark:text-neutral-50`
- Loading: baslik + deger icin `Skeleton` (mevcut bilesenimiz)
- Mobil: tam genislik (stack), md: `grid-cols-3`

---

**Dosya:** `src/features/finance/components/dashboard/ChannelBarChart.jsx`

```
+-------------------------------------------+
| Islerden aylik gelir                      |  <- baslik
| +-------+-------+-------+-------+------+ |
| |       | ##    |       | ##    |      | |  <- bar chart
| | ##    | ##    | ##    | ##    | ##   | |
| | ## ## | ## ## | ## ## | ## ## | ## ##| |
| +-------+-------+-------+-------+------+ |
|  Oca     Sub     Mar     Nis     May     |
+-------------------------------------------+
```

**Props:**
- `title: string` — grafik basligi
- `data: Array<{ period, revenue, costs }>` — monthlyBreakdown
- `loading: boolean`
- `revenueLabel: string` — legend icin ("Gelir")
- `costsLabel: string` — legend icin ("Maliyet" veya "Gider")

**UI detaylari:**
- Recharts: `BarChart` + `ResponsiveContainer`
- 2 bar: revenue (`CHART_COLORS.revenue` = #3b82f6 blue) + costs (`CHART_COLORS.expense` = #f43f5e rose)
- Renkler `src/lib/chartTheme.js`'ten import (hardcode yok)
- XAxis: ay kisa adi (Oca, Sub, Mar...) — `text-[11px]`
- YAxis: `formatTL` helper (`chartTheme.js`'ten)
- Tooltip: `formatCurrency`, dark mode stili
- Yukseklik: mobil `h-48`, md+ `h-64`
- Bos veri: "Secilen donemde veri bulunamadi" mesaji (grafik yerine)

---

**Dosya:** `src/features/finance/components/dashboard/FinanceDashboardTabs.jsx`

```
[ *Ozet* | Isler | Abonelikler | SIM Kartlar ]
```

**Props:**
- `activeTab: string` — 'overview' | 'work' | 'subscriptions' | 'sim'
- `onChange: (tab) => void`

**UI detaylari:**
- Segment stili (ViewModeToggle ile ayni gorsel dil)
- `inline-flex rounded-lg border` yapisinda, aktif sekme `bg-primary-600 text-white`
- Her buton: `min-h-[44px]` (dokunma alani)
- Mobil: 4 buton, kucuk ekranlarda yazi `text-xs`, gerekirse kisa etiketler (Abone -> Abon.)
- Tab degisince URL `?tab=work` guncellenir

---

**Dosya:** `src/features/finance/components/dashboard/FinanceDashboardFilters.jsx`

```
| Yil [ 2026 v ]   Ay [ Mart v ]   [ Top | Res | Gay ] |
```

**Props:**
- `year, month, viewMode` — guncel degerler
- `onYearChange, onMonthChange, onViewModeChange` — handler'lar

**UI detaylari:**
- Yil Select: son 5 yil (veya veritabanindaki en eski yildan)
- Ay Select: 12 ay + "Tum Yil" secenegi (value: `null` veya `'all'`)
  - Ay label'lari: Ocak, Subat, Mart... (i18n veya date-fns tr locale)
- ViewModeToggle: mevcut bilesen, `size="md"`
- Layout: `flex flex-col md:flex-row gap-3 items-end`
- Card icinde: `p-4 border-neutral-200/60 dark:border-neutral-800/60`

---

#### Phase 0 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/locales/tr/finance.json` | Guncelleme (dashboardV2 bloku) |
| `src/features/finance/api.js` | Guncelleme (+3 fonksiyon, +1 key objesi) |
| `src/features/finance/hooks.js` | Guncelleme (+3 hook) |
| `src/features/finance/components/dashboard/ChannelKpiCard.jsx` | Yeni |
| `src/features/finance/components/dashboard/ChannelBarChart.jsx` | Yeni |
| `src/features/finance/components/dashboard/FinanceDashboardTabs.jsx` | Yeni |
| `src/features/finance/components/dashboard/FinanceDashboardFilters.jsx` | Yeni |

**Toplam:** 4 yeni dosya, 3 guncelleme. Gorunur UI degisikligi yok.

---

### Phase 1 — Ozet Sekmesi

**Amac:** "Bu ay ne kadar kazandim?" sorusuna cevap veren en basit sekme.

#### 1.1 OverviewTab.jsx

**Dosya:** `src/features/finance/components/dashboard/OverviewTab.jsx`

**Wireframe — mobil:**
```
+-------------------------------+
|                                |
| +----------------------------+ |
| | Toplam gelir               | |  <- ChannelKpiCard variant="positive"
| | +185.000 TL                | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Toplam gider               | |  <- ChannelKpiCard variant="negative"
| | -72.000 TL                 | |
| +----------------------------+ |
|                                |
| +============================+ |
| | KALAN                      | |  <- Vurgulu kart (daha buyuk, border kalin)
| | +113.000 TL                | |     yesil: pozitif, kirmizi: negatif
| +============================+ |
|                                |
| +----------------------------+ |
| | Genel Giderler             | |  <- Card icinde liste
| |----------------------------| |
| | Personel Maasi    28.000   | |  <- satir: sol etiket, sag tutar
| | Yakit              8.500   | |     text-sm, border-b
| | Kira              12.000   | |
| | SGK Primi          9.200   | |
| | Muhasebe Hizmeti   2.500   | |
| | Diger              1.800   | |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Wireframe — tablet/masaustu (md+):**
```
+-----------------------------------------------------+
| +----------------+----------------+------------------+|
| | Toplam gelir   | Toplam gider   | KALAN            ||
| | +185.000 TL    | -72.000 TL     | +113.000 TL      ||
| +----------------+----------------+------------------+|
|                                                       |
| +---------------------------------------------------+|
| | Genel Giderler                                     ||
| |---------------------------------------------------||
| | Personel Maasi    28.000   | Yakit        8.500   ||  <- md: 2 kolon
| | Kira              12.000   | SGK Primi    9.200   ||
| | Muhasebe Hizmeti   2.500   | Diger        1.800   ||
| +---------------------------------------------------+|
+-----------------------------------------------------+
```

**Veri kaynaklari:**
- `useOverviewTotals({ year, month, viewMode })` -> totalRevenue, totalExpenses, remaining
- `useGeneralExpenses({ year, month, viewMode })` -> kategori listesi

**UI detaylari:**
- Ust 3 kart: ChannelKpiCard kullanir
  - "Kalan" karti: daha buyuk font (`text-2xl`), kalin border veya hafif arka plan vurgusu
  - Pozitif kalan: emerald, negatif: red
- Genel giderler listesi:
  - Card icinde, baslik: "Genel Giderler" (bold)
  - Her satir: `flex justify-between py-2 border-b last:border-0`
  - Sol: kategori adi (i18n `finance:expenseCategories.${code}`)
  - Sag: `formatCurrency(amount)` (tabular-nums, text-neutral-700)
  - Siralama: created_at DESC (son eklenen ustte)
  - Bos durum: "Bu donemde genel gider kaydi yok"
- Responsive:
  - Mobil: KPI kartlari stack (tam genislik), gider listesi tek kolon
  - md+: KPI kartlari `grid-cols-3`, gider listesi `md:grid-cols-2`

**Loading state:** 3x KpiCard skeleton + gider listesi icin 4 satir skeleton
**Error state:** ErrorState bileseni (mevcut)
**Empty state:** KPI'lar "0 TL" gosterir, gider listesi "Bu donemde gider yok" mesaji

#### Phase 1 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/features/finance/components/dashboard/OverviewTab.jsx` | Yeni |

**Toplam:** 1 yeni dosya.

---

### Phase 2 — Abonelikler Sekmesi

**Amac:** En temiz veri kanali — subscription + subscription_cogs. Sablonu dogrulama firsati.

#### 2.1 SubscriptionsTab.jsx

**Dosya:** `src/features/finance/components/dashboard/SubscriptionsTab.jsx`

**Wireframe — mobil:**
```
+-------------------------------+
|                                |
| +----------------------------+ |
| | Abonelerden tahmini        | |  <- ChannelKpiCard variant="positive"
| | aylik gelir                | |
| | 172.500 TL                 | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Musteri basi               | |  <- ChannelKpiCard variant="neutral"
| | abonelik geliri            | |
| | 1.250 TL                   | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Brut kar marji             | |  <- ChannelKpiCard variant="positive" veya "negative"
| | %68.4                      | |
| +----------------------------+ |
|                                |
| (i) Bu rakam su anki aktif    |  <- hint text (text-xs, neutral-400, italic)
|     aboneliklerin toplamidir.  |
|                                |
| +----------------------------+ |
| | Aboneliklerden aylik gelir | |  <- ChannelBarChart
| | [ #### bar chart ####     ]| |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Wireframe — tablet/masaustu (md+):**
```
+-----------------------------------------------------+
| +----------------+----------------+------------------+|
| | Tahmini aylik  | Musteri basi   | Brut kar marji   ||
| | 172.500 TL     | 1.250 TL       | %68.4            ||
| +----------------+----------------+------------------+|
| (i) Bu rakam su anki aktif aboneliklerin toplamidir.  |
|                                                       |
| +---------------------------------------------------+|
| | Aboneliklerden aylik gelir          [h-64 chart]   ||
| | Oca  Sub  Mar  Nis  May  Haz  Tem  Agu  Eyl  Eki  ||
| +---------------------------------------------------+|
+-----------------------------------------------------+
```

**Veri kaynaklari:**
- `useChannelMetrics({ channel: 'subscriptions', year, month, viewMode })` -> revenue, costs, grossMarginPct, monthlyBreakdown
- `get_subscription_stats` RPC (mevcut) -> mrr, distinct_customer_count

**KPI hesaplamalari:**
- KPI 1 "Tahmini aylik gelir": `mrr` (get_subscription_stats'tan, anlik)
- KPI 2 "Musteri basi gelir": `mrr / distinct_customer_count`
- KPI 3 "Brut kar marji": `grossMarginPct` (channelMetrics'ten, secilen doneme gore)

**Ozel UI detaylari:**
- Hint metni: KPI kartlarinin altinda, grafik ustunde
  - `text-xs italic text-neutral-400 dark:text-neutral-500 px-1`
  - Icon: `(i)` veya lucide `Info` ikonu (w-3 h-3)
- Bar grafik: ChannelBarChart — revenueLabel="Gelir", costsLabel="Maliyet"
- XAxis aylar: "Tum Yil" seciliyse 12 ay; tek ay seciliyse o ayin son 6 ayi
- Bos veri: grafik yerine EmptyState ("Bu donemde abonelik geliri yok")

**Loading:** 3x KpiCard skeleton + grafik skeleton (h-48/h-64 gri kutu)
**Empty:** KPI'lar "0 TL" / "--%", grafik yerine noData mesaji

#### Phase 2 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/features/finance/components/dashboard/SubscriptionsTab.jsx` | Yeni |

**Toplam:** 1 yeni dosya.

---

### Phase 3 — SIM Kartlar Sekmesi

**Amac:** Abonelikler ile neredeyse ayni yapi, farkli veri kanali.

#### 3.1 SimTab.jsx

**Dosya:** `src/features/finance/components/dashboard/SimTab.jsx`

**Wireframe — mobil:**
```
+-------------------------------+
|                                |
| +----------------------------+ |
| | SIM kartlardan gelen gelir | |  <- ChannelKpiCard variant="positive"
| | 24.500 TL                  | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Operator gideri            | |  <- ChannelKpiCard variant="negative"
| | -18.200 TL                 | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Brut kar marji             | |  <- ChannelKpiCard
| | %25.7                      | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | SIM kartlardan aylik gelir | |  <- ChannelBarChart
| | [ #### bar chart ####     ]| |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Wireframe — tablet/masaustu (md+):**
```
+-----------------------------------------------------+
| +-----------------+-----------------+----------------+|
| | SIM gelir       | Operator gideri | Brut kar marji ||
| | 24.500 TL       | -18.200 TL      | %25.7          ||
| +-----------------+-----------------+----------------+|
|                                                       |
| +---------------------------------------------------+|
| | SIM kartlardan aylik gelir          [h-64 chart]   ||
| +---------------------------------------------------+|
+-----------------------------------------------------+
```

**Veri kaynaklari:**
- `useChannelMetrics({ channel: 'sim', year, month, viewMode })`

**KPI'lar:**
- KPI 1 "SIM gelir": `revenue` (variant: positive)
- KPI 2 "Operator gideri": `costs` gosterimde `-` ile (variant: negative)
- KPI 3 "Brut kar marji": `grossMarginPct`

**UI:** Abonelikler sekmesiyle ayni pattern, hint metni yok (SIM'de anlik/donemsel fark yok).

#### Phase 3 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/features/finance/components/dashboard/SimTab.jsx` | Yeni |

**Toplam:** 1 yeni dosya.

---

### Phase 4 — Isler Sekmesi

**Amac:** En karmasik kanal — 5 income_type, COGS teklif satirlarindan geliyor.

#### 4.1 WorkTab.jsx

**Dosya:** `src/features/finance/components/dashboard/WorkTab.jsx`

**Wireframe — mobil:**
```
+-------------------------------+
|                                |
| +----------------------------+ |
| | Islerden gelen gelir       | |  <- ChannelKpiCard variant="positive"
| | 42.000 TL                  | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Toplam is maliyeti         | |  <- ChannelKpiCard variant="negative"
| | -18.000 TL                 | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Brut kar marji             | |  <- ChannelKpiCard
| | %57.1                      | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| | Islerden aylik gelir       | |  <- ChannelBarChart
| | [ #### bar chart ####     ]| |
| +----------------------------+ |
|                                |
+-------------------------------+
```

**Wireframe — tablet/masaustu (md+):**
```
+-----------------------------------------------------+
| +-----------------+-----------------+----------------+|
| | Islerden gelir  | Is maliyeti     | Brut kar marji ||
| | 42.000 TL       | -18.000 TL      | %57.1          ||
| +-----------------+-----------------+----------------+|
|                                                       |
| +---------------------------------------------------+|
| | Islerden aylik gelir                [h-64 chart]   ||
| +---------------------------------------------------+|
+-----------------------------------------------------+
```

**Veri kaynaklari:**
- `useChannelMetrics({ channel: 'work', year, month, viewMode })`

**KPI'lar:**
- KPI 1 "Islerden gelen gelir": `revenue` (variant: positive)
- KPI 2 "Toplam is maliyeti": `costs` (variant: negative)
- KPI 3 "Brut kar marji": `grossMarginPct`

**COGS notu:** Isler sekmesinde maliyet `cogs_try` alanindan gelir (teklif satirlarindaki urun + iscilik + malzeme + nakliye maliyetleri). Bu deger teklif tamamlaninca trigger tarafindan hesaplanir. Manuel is emirlerinde (standalone WO) cogs_try genellikle null'dir — bu durumda maliyet 0 gosterilir ve brut kar marji %100 olur. Bu beklenen davranistir.

#### Phase 4 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/features/finance/components/dashboard/WorkTab.jsx` | Yeni |

**Toplam:** 1 yeni dosya.

---

### Phase 5 — Entegrasyon ve Temizlik

**Amac:** Yeni sekmeleri FinanceDashboardPage'e bagla, eski dashboard'u kaldir.

#### 5.1 FinanceDashboardPage.jsx yeniden yazimi

**Mevcut dosya:** `src/features/finance/FinanceDashboardPage.jsx` (345 satir)
**Yeni yapisi:**

```jsx
// FinanceDashboardPage.jsx — V2
// Orchestrator: sadece layout, state, routing

export function FinanceDashboardPage() {
  // URL state: year, month, viewMode, tab
  // PageHeader + quick actions (Gelir Ekle / Gider Ekle)
  // FinanceDashboardFilters
  // FinanceDashboardTabs
  // Aktif sekmeye gore: OverviewTab | WorkTab | SubscriptionsTab | SimTab
}
```

**Wireframe — tam sayfa (mobil):**
```
+-------------------------------+
| =  Finans Ozeti               |
| [ Gelir Ekle ] [ Gider Ekle ] |
+-------------------------------+
| Yil [ 2026 v ]   Ay [ Mart v ]|
| Kayit: [ Top | Res | Gay ]    |
+-------------------------------+
| [ Ozet | Isler | Abone | SIM ]|
+-------------------------------+
|                                |
|   << aktif sekme icerigi >>    |
|                                |
+-------------------------------+
```

**Sayfa sorumlulugu:**
- URL state yonetimi (`useSearchParams`)
- `year`, `month`, `viewMode`, `tab` parametreleri
- Varsayilanlar: guncel yil, guncel ay, 'total', 'overview'
- PageHeader + breadcrumb
- Quick action butonlari (Gelir Ekle -> /finance/income, Gider Ekle -> /finance/expenses)
- FinanceDashboardFilters render
- FinanceDashboardTabs render
- Aktif sekmeye gore ilgili Tab bilesenini render
- Her Tab bilesenine `{ year, month, viewMode }` props olarak gec

#### 5.2 Temizlik

**Kaldirilacak kodlar:**

| Dosya | Kaldirilacak | Neden |
|-------|-------------|-------|
| `api.js` | `fetchFinanceDashboardKpis()` | `fetchChannelMetrics` ile degistirildi |
| `api.js` | `fetchRevenueExpensesByMonth()` | `monthlyBreakdown` ile degistirildi |
| `api.js` | `fetchExpenseByCategory()` | Pie chart yok, `fetchGeneralExpenses` ile degistirildi |
| `api.js` | `fetchRecentTransactions()` | V2'de son islemler yok |
| `api.js` | `financeDashboardKeys` (eski) | Yeni `dashboardV2Keys` kullanilir |
| `hooks.js` | `useFinanceDashboardKpis` | Yeni hook'larla degistirildi |
| `hooks.js` | `useRevenueExpensesByMonth` | Yeni hook'larla degistirildi |
| `hooks.js` | `useExpenseByCategory` | Yeni hook'larla degistirildi |
| `hooks.js` | `useRecentTransactions` | V2'de yok |

**Korunacak kodlar:**
- `fetchProfitAndLoss`, `useProfitAndLoss` — ReportsPage kullaniyor
- `get_subscription_stats` RPC — Abonelikler sekmesi kullaniyor
- `ViewModeToggle` bileseni — Filters icinde kullaniyor
- `financeDashboardKeys` sadece mutation invalidation'larda kullaniliyorsa -> `dashboardV2Keys` ile degistir

**Mutation guncelleme:**
`useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction` icindeki `financeDashboardKeys.all` invalidation'larini `dashboardV2Keys.all` ile degistir.

#### Phase 5 ciktilari

| Dosya | Tip |
|-------|-----|
| `src/features/finance/FinanceDashboardPage.jsx` | Yeniden yazim |
| `src/features/finance/api.js` | Temizlik (4 fonksiyon + 1 key objesi kaldirilir) |
| `src/features/finance/hooks.js` | Temizlik (4 hook kaldirilir) |

**Toplam:** 3 dosya guncelleme. Eski dashboard tamamen degistirilir.

---

## 14. Phase ozeti

| Phase | Scope | Dosya sayisi | Bagimlilik |
|-------|-------|-------------|------------|
| **Phase 0** | Altyapi: i18n, API, hooks, ortak bilesenler | 4 yeni, 3 guncelleme | Yok |
| **Phase 1** | Ozet sekmesi (gelir/gider/kalan + genel giderler) | 1 yeni | Phase 0 |
| **Phase 2** | Abonelikler sekmesi (KPI + bar chart + hint) | 1 yeni | Phase 0 |
| **Phase 3** | SIM Kartlar sekmesi (KPI + bar chart) | 1 yeni | Phase 0 |
| **Phase 4** | Isler sekmesi (KPI + bar chart) | 1 yeni | Phase 0 |
| **Phase 5** | Entegrasyon + temizlik | 3 guncelleme | Phase 0-4 |

**Toplam:** 8 yeni dosya, 6 guncelleme. Mevcut dashboard Phase 5'e kadar degismez.

---

## 15. Test / QA

- [ ] Kanal esleme: Her sekmede dogru source_type'lar mi geliyor?
- [ ] ViewMode: Toplam/Resmi/Gayri Resmi her sekmede dogru filtre uyguluyor mu?
- [ ] Yil filtresi: Tum yil secildiginde 12 ayin toplami dogru mu?
- [ ] Ay filtresi: Tek ay secildiginde sadece o ayin verisi mi?
- [ ] Brut kar marji: Gelir 0 oldugunda "--" gosteriliyor mu (bolme hatasi yok mu)?
- [ ] Ozet sekmesi: 3 kanalin toplami + genel giderler = toplam gider dogru mu?
- [ ] Abonelik sekmesi: "Tahmini aylik gelir" anlik, grafik secilen doneme gore -- karisiklik yok mu?
- [ ] Mobil: 4 sekme 390px ekranda kullanilabilir mi?
- [ ] Dark mode: Tum yeni bilesenler dark mode'da gorunur mu?
- [ ] i18n: Tum metinler finance.json'dan geliyor mu, hardcode Turkce yok mu?
- [ ] Eski dashboard fonksiyonlari temizlendikten sonra ReportsPage hala calisiyor mu?
- [ ] Mutation invalidation: Gelir/gider ekleme sonrasi dashboard verisi guncellenior mu?

---

## 16. Revizyon gecmisi

| Tarih | Not |
|--------|-----|
| 2026-03-20 | Ilk plan — wireframe, i18n semasi, modul yapisi, responsive |
| 2026-03-20 | V2 guncelleme — 4 sekme (Ozet eklendi), kanal esleme netlestirildi, brut kar marji formulleri, yil+ay filtresi, genel gider dokumu, API tasarimi |
| 2026-03-20 | Phase-by-phase uygulama plani — 6 phase, her phase icin UI/UX wireframe, dosya listesi, veri kaynaklari, responsive detaylari |
