# İş Geçmişi Ekranı Analizi

> **Amaç:** Ekranı sadeleştirmek, diğer sayfalardaki tasarım ve component diline yaklaştırmak.  
> **Tarih:** 2026-02-18

---

## 1. Mevcut Durum Özeti

İş Geçmişi (`/work-history`) sayfası **gelişmiş arama** odaklı bir ekran. Hesap no veya müşteri adıyla arama, tarih aralığı, iş tipi ve personel filtreleri sunuyor. Sonuçlar tablo halinde gösteriliyor.

---

## 2. Karmaşıklık Analizi

### 2.1 Obje Sayısı ve Görsel Yoğunluk

| Bölüm | Obje Sayısı | Açıklama |
|-------|-------------|----------|
| **Arama kartı** | 1 Card | İçinde çok fazla eleman |
| **Arama tipi toggle** | 2 buton | "Hesap No" / "Müşteri Adı" – custom pill switch |
| **Arama input** | 1 Input | Dinamik placeholder, sol ikon |
| **Tarih filtreleri** | 2 Input (date) | Başlangıç / Bitiş |
| **İş tipi** | 1 Select | 6+ seçenek |
| **Personel** | 1 Select | Tüm profiller |
| **Reset butonu** | 1 Button | Sağ alt köşe |
| **Sonuç başlığı** | 1 h3 + Badge | "Arama Sonuçları" + kayıt sayısı |
| **Tablo** | Table | 5 sütun |

**Toplam:** ~12+ interaktif obje, 2 görsel bölüm (arama + sonuç). İlk bakışta yoğun ve karmaşık görünüyor.

### 2.2 Diğer Sayfalarla Karşılaştırma

| Sayfa | Filtre yapısı | Sonuç alanı | Karmaşıklık |
|-------|---------------|-------------|-------------|
| **Müşteriler** | SearchInput tek satır | Table | Düşük |
| **Teklifler** | SearchInput + Select (durum) | Table | Düşük |
| **İş Emirleri** | SearchInput + 3 Select (durum, tip, öncelik) | Table | Orta |
| **İş Geçmişi** | Toggle + Input + 2 date + 2 Select + Reset | Table | **Yüksek** |

---

## 3. Tasarım ve Component Tutarsızlıkları

### 3.1 Arama Kartı

- **Custom toggle:** `flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl` ile kendi pill switch’i var. Diğer sayfalarda buna benzer bir pattern yok.
- **Label stili:** `text-xs font-black uppercase tracking-widest` – diğer sayfalardaki `Select` placeholder / label’lardan farklı.
- **Card padding:** `p-6` – Work Orders ve Proposals’ta `p-4` kullanılıyor.
- **Grid:** `md:col-span-4` / `md:col-span-8` – karmaşık grid, diğer sayfalarda `flex flex-col md:flex-row gap-4` tercih ediliyor.

### 3.2 Filtre Yerleşimi

- **Work Orders:** `SearchInput` + yan yana 3 `Select` (tek satır, `flex`).
- **Proposals:** `SearchInput` + 1 `Select` (tek satır).
- **İş Geçmişi:** Toggle + Input (üst satır) → 4 filtre (alt satır, `border-t` ile ayrılmış) → Reset (ayrı satır). 3 katmanlı yapı.

### 3.3 Component Kullanımı

| Öğe | İş Geçmişi | Diğer sayfalar |
|-----|------------|----------------|
| Arama | `Input` + `leftIcon` | `SearchInput` |
| Select label | `label={...}` | `placeholder={...}` (label yok) |
| Select leftIcon | Var (Filter, User, Calendar) | Var (Work Orders) veya yok (Proposals) |
| Reset | `Button variant="ghost" size="sm"` | Yok (Work Orders/Proposals’ta reset yok) |

### 3.4 Sonuç Bölümü

- **Başlık:** `h3 text-sm font-black uppercase tracking-widest` – diğer sayfalarda PageHeader veya doğrudan Table kullanılıyor, bu tarz başlık yok.
- **Table wrapper:** `rounded-2xl border ... shadow-sm` – Work Orders ile benzer, Proposals’ta Table doğrudan kullanılıyor (wrapper yok).
- **Badge variant:** `Badge variant="outline"` (work type) – Badge component’inde `outline` variant tanımlı değil, muhtemelen hata veya fallback.

### 3.5 Eksik / Hatalı Kullanımlar

- `Badge variant="outline"` – Badge’de `outline` yok.
- `t('dailyWork:filters.allWorkers')` – workHistory sayfasında dailyWork namespace’ine bağımlılık.
- `maxWidth="xl"` – Work Orders ve Proposals ile uyumlu.

---

## 4. Kullanıcı Akışı

1. Kullanıcı sayfaya gelir (boş veya `?siteId=X&type=account_no` ile).
2. Arama tipi seçer (Hesap No / Müşteri Adı).
3. Arama metnini girer.
4. İsteğe bağlı: tarih aralığı, iş tipi, personel seçer.
5. API otomatik tetiklenir (enabled: filters dolu).
6. Sonuçlar tabloda listelenir.
7. Satıra tıklayınca iş emri detayına gider.

**Sorun:** Boş sayfada kullanıcıya ne yapacağı net değil. Subtitle var ama arama alanı ve toggle hemen dikkat çekmiyor. Çok fazla filtre aynı anda sunuluyor.

---

## 5. Sadeleştirme Önerileri

### 5.1 Filtre Yapısını Basitleştirme

| Öneri | Açıklama |
|-------|----------|
| **A)** Toggle’ı kaldır, tek SearchInput | Placeholder’da “Hesap no veya müşteri adı…” yaz. Backend zaten her iki alanda da arama yapıyorsa, tek alan yeterli. |
| **B)** Toggle’ı Select’e çevir | “Ara: Hesap No / Müşteri Adı” şeklinde küçük bir Select. Daha az yer kaplar. |
| **C)** Toggle’ı koru, layout’u sadeleştir | Work Orders tarzı tek satır: SearchInput (veya Input) + yanında 2–3 Select. |

### 5.2 Filtre Sayısını Azaltma

- **Tarih:** 2 ayrı date input yerine “Son 7 gün / 30 gün / 3 ay / Tümü” gibi preset’ler + opsiyonel özel tarih.
- **İş tipi + Personel:** Korunabilir; ancak varsayılan “Tümü” ile başlayıp, sadece gerektiğinde daraltma mantığı kullanılabilir.

### 5.3 Component Uyumu

- `Input` → `SearchInput` (arama için).
- `label` kullanan Select’ler → `placeholder` kullan (Work Orders / Proposals ile uyum).
- Card padding: `p-6` → `p-4`.
- Filtre layout: `flex flex-col md:flex-row gap-4` (Work Orders / Proposals ile aynı).
- Sonuç başlığı: `h3` + Badge yerine sadece Table veya PageHeader altında minimal bir “X kayıt” metni.

### 5.4 Reset Butonu

- Work Orders ve Proposals’ta yok. URL parametreleriyle çalışıyorlar.
- İş Geçmişi’nde Reset, siteId dahil tüm filtreleri temizliyor. Deep link’ten gelen kullanıcı için siteId’nin korunması isteniyorsa, Reset’te siteId’yi korumak mantıklı (docs’ta da belirtilmiş).
- Öneri: Reset’i koruyalım ama daha az vurgulu yapalım (örn. ghost, küçük, filtre satırının sağında).

---

## 6. Önerilen Hedef Yapı

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: İş Geçmişi                                          │
│ Subtitle: Tüm tamamlanmış ve geçmiş iş emirlerini arayın         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ [SearchInput - Hesap no veya müşteri adı...]  [İş Tipi ▼] [Personel ▼] [Tarih ▼] [Sıfırla] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Table: Müşteri | Hesap No | İş Tipi | Tarih | Personel          │
│ (veya tarih aralığı için ayrı 2 input, preset’lerle birlikte)   │
└─────────────────────────────────────────────────────────────────┘
```

- Tek satır filtre (Work Orders / Proposals ile uyumlu).
- Toggle kaldırılıp tek SearchInput veya “Ara: Hesap No / Müşteri” Select’i.
- Tarih: preset + opsiyonel özel tarih veya 2 date input (daha kompakt).
- Reset: ghost, küçük, sağda.

---

## 7. Teknik Notlar

- **API:** `search_work_history` RPC kullanılıyor; `search` ve `type` parametreleri var. Toggle kaldırılırsa `type` için varsayılan veya birleşik arama mantığı gerekebilir.
- **URL sync:** `siteId`, `type`, `dateFrom`, `dateTo`, `workType`, `workerId` URL’e yazılabilir (deep link, paylaşılabilir arama).
- **Badge:** `variant="outline"` kullanımı kaldırılmalı veya Badge’e `outline` variant eklenmeli.
- **i18n:** `dailyWork:filters.allWorkers` → `workHistory:filters.allWorkers` veya `common:filters.all` gibi workHistory’ye özel bir key.

---

## 8. Özet

| Konu | Mevcut | Öneri |
|------|--------|-------|
| Filtre karmaşıklığı | Yüksek (toggle + 6+ obje) | Düşük (tek satır, 3–4 obje) |
| Component tutarlılığı | Orta (custom toggle, farklı Card padding) | Yüksek (SearchInput, standart Card, placeholder) |
| Görsel hiyerarşi | 3 katman (toggle+input, filtreler, reset) | 1–2 katman |
| Badge / i18n | Hatalı veya bağımlı | Düzeltilmiş |

**Sonuç:** Ekran işlevsel ama görsel ve yapısal olarak diğer sayfalardan ayrışıyor. Filtre sadeleştirmesi ve component standardizasyonu ile daha tutarlı ve anlaşılır hale getirilebilir.
