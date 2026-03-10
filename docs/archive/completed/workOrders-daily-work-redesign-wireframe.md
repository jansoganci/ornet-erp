# Daily Work – Haftalık Görünüm Redesign Wireframe

Steve Jobs felsefesi: breadcrumb ve sayfa başlığı yok, haftalık çubuk + minimal personel filtresi, bugün vurgulu.

---

## Kararlar

- **Breadcrumb** ve **sayfa başlığı** ("Günlük iş listesi") kaldırılıyor.
- **Ayrı tarih metni** yok; bugün hafta çubuğunda renkle vurgulanıyor.
- **Tarih seçimi:** Haftalık çubuk (7 gün); önceki/sonraki hafta okları. Date input yok.
- **Personel filtresi:** Tek satır, minimal (Tümü | isimler). Reset butonu yok.
- **Bugün / Yarın** kısayolları kaldırılıyor (hafta çubuğu yeterli).
- Liste: Seçili güne göre mevcut DailyWorkCard listesi. "X kayıt" sadeleştirilebilir.

---

## Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [‹]    Pzt 9   Sal 10   Çar 11   Per 12   Cum 13   Cmt 14   Paz 15    [›]     │
│         ─────   ──────   ──────   ──────   ██████   ──────   ──────              │
│                   (seçili)              (bugün vurgulu)                          │
└─────────────────────────────────────────────────────────────────────────────────┘
   Önceki hafta    7 gün, tıklanabilir. Bugün farklı arka plan.    Sonraki hafta

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Tümü  |  Ahmet Y.  |  Mehmet K.  |  Ayşe D.                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
   Minimal personel filtresi – pill/link stili, tek satır. "Tümü" varsayılan.

┌─────────────────────────────────────────────────────────────────────────────────┐
│  09:00 · Acme Ltd · Montaj – Keşif                                           →  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  11:30 · Beta A.Ş. · Servis bakımı                                            →  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  14:00 · Gamma · Yeni kurulum                                                 →  │
└─────────────────────────────────────────────────────────────────────────────────┘
   Seçili günün iş emirleri (mevcut DailyWorkCard içeriği, aynı kart stili).

┌─────────────────────────────────────────────────────────────────────────────────┐
│  (Boş durum: Bu gün için planlanmış iş yok)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Bugünün planları (TodayPlansSection – sadece bugün seçiliyken veya her zaman)  │
│  …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout specs

| Bölüm | İçerik | Notlar |
|-------|--------|--------|
| **Üst** | Hafta çubuğu | Sol: `[‹]` önceki hafta. Ortada: 7 gün (Pzt … Paz), gün numarası (9, 10, …). Bugün: farklı bg (örn. primary veya nötr koyu). Seçili gün: ince border veya ring. Sağ: `[›]` sonraki hafta. Tıklanabilir. |
| **Filtre** | Personel | Tek satır: "Tümü" + personel isimleri (pill veya link). Seçili olan vurgulu. Dropdown da olabilir; görsel ağırlık hafif. |
| **Liste** | İş emirleri | Seçili güne göre. Mevcut DailyWorkCard; başlık/badge sadeleştirilebilir. |
| **TodayPlansSection** | (mevcut) | Seçili gün = bugün ise göster; veya her zaman göster, içerik bugüne ait. |

---

## Hafta çubuğu detay

- **Gün etiketi:** Kısa gün adı (Pzt, Sal, …) + gün numarası (9, 10, …). İsteğe ay adı (9 Şub) eklenebilir.
- **Bugün:** Arka plan rengi farklı (primary-100 / dark:primary-900/30 veya neutral-200).
- **Seçili gün:** Ring veya border; tıklanınca liste o güne güncellenir.
- **Oklar:** `ChevronLeft` / `ChevronRight`; tıklanınca hafta bir hafta kayar (state: haftanın başlangıç tarihi).

---

## Wireframe görseli

Görsel proje assets klasöründe: `.cursor/projects/Users-jans-Downloads-Projelerim-ornet-erp/assets/daily-work-wireframe.png`  
(IDE veya dosya gezgininden açabilirsin.)

---

## Dosya referansı

- Uygulama: [src/features/workOrders/DailyWorkListPage.jsx](src/features/workOrders/DailyWorkListPage.jsx)
- API: `get_daily_work_list(target_date, worker_id)` – tek tarih; hafta için 7 gün state, seçilen günün `target_date` ile istek.
