# İş Emri Detay Sayfası — Redesign Analizi

> **Tarih:** 2026-02-18  
> **Hedef:** `src/features/workOrders/WorkOrderDetailPage.jsx`  
> **Referans:** Müşteri detay redesign (stil + UX yaklaşımı)  
> **Durum:** KARARLAR KESİNLEŞTİ — Implement edilmeye hazır

---

## Kesinleşen Kararlar

| # | Konu | Karar |
|---|------|-------|
| 1 | Tab yapısı | **Seçenek A** — Tab yok, tek scroll |
| 2 | Mobil FAB | **Korunacak** — Mevcut sabit alt bar kalacak (veya mobil için ayrı versiyon sonra) |
| 3 | Teklif linki | **Ayrı kart** — Hero içinde değil, kendi kartı |
| 4 | Başla/Tamamla konumu | **Hero'nun hemen altında** — Kolay erişilebilir (detay aşağıda) |

---

## 1. Mevcut Yapı Özeti

### 1.1 Layout
- `maxWidth="lg"` — dar sayfa genişliği (müşteri detayda `full` yaptık)
- `PageHeader` — breadcrumb, başlık (iş tipi + form_no), description (status + priority badge), actions (Düzenle, Sil)
- **2 kolon grid** (`lg:grid-cols-3`):
  - **Sol (2/3):** Site bilgisi kartı, Açıklama kartı, Malzemeler tablosu
  - **Sağ (1/3):** Tarih/saat, Atanan personel, Tutar, Teklif linki, Dahili notlar, Durum aksiyonları (Başla, Tamamla, İptal)
- **Mobil:** Alt sabit FAB bar (Başla/Tamamla, Düzenle)

### 1.2 İçerik Blokları
| Blok | Konum | İçerik |
|------|-------|--------|
| Site bilgisi | Sol | Firma, lokasyon adı, adres, site telefonu, hesap no |
| Açıklama | Sol | `workOrder.description` |
| Malzemeler | Sol | Tablo (malzeme, miktar, birim fiyat, toplam) + ara toplam, indirim, genel toplam, net kar |
| Tarih/Saat | Sağ | `scheduled_date`, `scheduled_time` |
| Atanan | Sağ | `assigned_workers` avatar + isim |
| Tutar | Sağ | `workOrder.amount` |
| Teklif | Sağ | `proposal_id` varsa → `/proposals/:id` link |
| Dahili notlar | Sağ | `workOrder.notes` |
| Durum aksiyonları | Sağ | Başla / Tamamla / İptal |

### 1.3 Veri Kaynağı
- `useWorkOrder(id)` → `work_orders_detail` view + `work_order_materials` join
- `work_orders_detail`: `form_no`, `work_type`, `status`, `priority`, `scheduled_date`, `scheduled_time`, `description`, `notes`, `amount`, `currency`, `assigned_workers` (JSON), `account_no`, `site_name`, `site_address`, `city`, `district`, `site_phone`, `panel_info`, `customer_id`, `company_name`, `customer_phone`, `proposal_id` (work_orders tablosundan)

---

## 2. UX Sorunları

| # | Sorun | Açıklama |
|---|-------|----------|
| 1 | Dar genişlik | `maxWidth="lg"` — müşteri detayda full yaptık, tutarlılık için burada da full |
| 2 | Bilgi hiyerarşisi | Başlık ve status/priority aynı satırda; iş emri kimliği net değil |
| 3 | Sidebar yoğunluğu | Sağ kolon sıkışık; durum aksiyonları, metrikler, notlar bir arada |
| 4 | Mobil FAB | Sabit alt bar sadece 2–3 buton; ana içerikle kopuk |
| 5 | Tab yok | Tek scroll — müşteri detayda tab ile bölümlendi, burada da mantıklı mı? |

---

## 3. Tab İhtiyacı Değerlendirmesi

**Müşteri detay:** 5 tab — çünkü 5 farklı domain (genel özet, lokasyonlar, iş emirleri, SIM, ekipman).

**İş emri detay:** Tek entity. İçerik blokları:
- Kimlik + site + açıklama + tarih + atanan + tutar
- Malzemeler (tablo)
- Teklif linki, notlar

**Seçenek A — Tab yok:**
- Hero + tek kolon, bölümler alt alta
- Daha basit, tek scroll

**Seçenek B — 2–3 tab:**
- **Genel:** Site, açıklama, tarih, atanan, tutar, notlar, teklif
- **Malzemeler:** Malzeme tablosu + toplamlar
- **İsteğe bağlı:** İş geçmişi (aynı lokasyondaki diğer iş emirleri) — bu müşteri detayda zaten var

**Öneri:** **Tab yok** veya **2 tab** (Genel + Malzemeler). İş emri tek kayıt için tab sayısı az tutulmalı.

---

## 4. Önerilen Yeni Yapı (Müşteri Detay Stiline Uyumlu)

### 4.1 Genel Layout (Tab yok — Seçenek A)
```
┌────────────────────────────────────────────────────────────────────────┐
│ SAYFA (maxWidth="full", tek kolon, tek scroll)                         │
│                                                                        │
│ ← İş Emirleri              [Düzenle] [Sil]                             │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ HERO CARD                                                          │ │
│ │  [🔧 Icon]  Montaj #12345                          ● Bekliyor       │ │
│ │             Pizza Bulls — Merkez Ofis                              │ │
│ │  [📅 18.02.2026] [🕐 09:00] [💰 2.500 TL] [👤 1 Atanan]          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─ DURUM AKSİYONLARI (desktop, lg:block) ─────────────────────────────┐ │
│ │  [Başla] / [Tamamla]  veya  [İptal]     ← Hero'nun hemen altında   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│   Lokasyon & Müşteri kartı                                             │
│   Açıklama kartı                                                        │
│   Planlama & Atama (tarih, saat, atanan)                               │
│   Malzemeler tablosu + toplamlar                                        │
│   Teklif linki kartı (varsa, ayrı kart)                                 │
│   Dahili Notlar kartı (varsa)                                           │
│                                                                        │
│ ┌─ MOBİL FAB (lg:hidden) ─────────────────────────────────────────────┐ │
│ │  [Başla/Tamamla] [Düzenle]  ← Sabit alt bar, mevcut davranış       │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Hero Bileşeni (WorkOrderHero)
```
Props: { workOrder, onEdit, onDelete }

- Breadcrumb: ← İş Emirleri
- Sağda: [Düzenle] [Sil]
- Büyük Wrench/Tool ikonu (primary renk)
- Başlık: work_type (Montaj) + form_no (#12345)
- Alt satır: company_name — site_name
- Status badge (sağda)
- 4 stat kutusu (grid):
  [📅 Tarih] [🕐 Saat] [💰 Tutar] [👤 Atanan]
```

### 4.3 Bölüm Sırası (tek scroll)

1. **WorkOrderHero** — İş emri kimliği + 4 stat
2. **WorkOrderStatusActions** — Başla / Tamamla / İptal (desktop, hero altında)
3. **Lokasyon & Müşteri** — Site bilgisi kartı (compact)
4. **Açıklama** — Açıklama metni kartı
5. **Planlama & Atama** — Tarih, saat, atanan personel (grid kartı)
6. **Malzemeler** — Tablo + ara toplam, indirim, genel toplam, net kar
7. **Teklif** — Ayrı kart (varsa)
8. **Dahili Notlar** — Ayrı kart (varsa)
9. **Mobil FAB** — Sabit alt bar (mobil only)

---

## 5. Bileşen Önerisi

| Bileşen | Açıklama |
|---------|----------|
| `WorkOrderHero` | Müşteri Hero gibi; iş emri kimliği + 4 stat + breadcrumb + Düzenle/Sil |
| `WorkOrderStatusActions` | Başla / Tamamla / İptal — Hero altında, desktop only (`lg:block`) |
| `WorkOrderSiteCard` | Site + müşteri bilgisi (compact) |
| `WorkOrderMaterialsSection` | Malzeme tablosu + ara toplam, indirim, genel toplam, net kar |
| `WorkOrderProposalCard` | Teklif linki — ayrı kart (`proposal_id` varsa) |

---

## 6. Başla / Tamamla Butonları — Konum Seçenekleri (Karar: A)

| Konum | Avantaj | Dezavantaj |
|-------|---------|------------|
| **A) Hero'nun hemen altında** | Sayfa açılır açılmaz görünür, scroll gerekmez | Hero ile ayrı blok |
| B) Hero içinde (stat kutularının altı) | Tüm kritik bilgi tek yerde | Hero kartı büyür |
| C) Sayfa sonunda | İçeriği okuduktan sonra aksiyon | Scroll gerekir |
| D) Sticky sidebar (sağda) | Her zaman görünür | Dar ekranda yer kaplar |

**Karar:** **A) Hero'nun hemen altında** — Desktop'ta hero card'dan hemen sonra, ayrı bir "Durum Aksiyonları" satırı veya kartı. Mobilde mevcut FAB bar korunacak (veya ayrı mobil versiyon yapılacak).

**Uygulama:**
- Desktop: Hero altında `WorkOrderStatusActions` bileşeni (`lg:block`)
- Mobil: Sabit FAB bar (`lg:hidden`) — mevcut davranış

---

## 7. Mevcut vs Önerilen Karşılaştırma

| Özellik | Mevcut | Önerilen |
|---------|--------|----------|
| Genişlik | lg | full |
| Header | PageHeader | WorkOrderHero |
| Layout | 2 kolon (2/3 + 1/3) | Tek kolon, tek scroll (tab yok) |
| Bilgi hiyerarşisi | Dağınık | Hero + bölümler |
| Başla/Tamamla | Sağ sidebar | Hero altında (desktop) |
| Mobil | Sabit FAB | FAB korunacak |
| Teklif | Sağ sidebar kartı | Ayrı kart (aynı mantık, farklı konum) |

---

## 8. Sonraki Adım

1. **Wireframe:** Kesin layout (yukarıdaki)
2. **Uygulama adımları:** Bileşen listesi + sıra
3. **Implement:** WorkOrderHero → WorkOrderStatusActions → diğer bölümler

---

**Son Güncelleme:** 2026-02-18 — Kararlar kesinleşti (Seçenek A, FAB korunacak, teklif ayrı kart, Başla/Tamamla hero altında)
