# Teklif Detay Sayfası — Redesign Analizi

> **Tarih:** 2026-02-18  
> **Hedef:** `src/features/proposals/ProposalDetailPage.jsx`  
> **Referans:** `docs/customer-detail-redesign-plan.md`, Work Order Detail Page  
> **Durum:** PLAN — Kararlar kesinleşti, implement edilmeye hazır

---

## Kesinleşen Kararlar

| # | Konu | Karar |
|---|------|-------|
| 1 | Tab bar | ❌ Yok — single scroll |
| 2 | Özet kartı | ✅ Ayrı ProposalSummaryCard (tarihler, yetkili) |
| 3 | Sil butonu | ✅ Her durumda hero'da gösterilecek |
| 4 | Completion banner | ✅ Mevcut konumda kalsın (Malzemeler sonrası, İş Emirleri öncesi) |

---

## 1. Mevcut Durum Özeti

### 1.1 Layout

| Özellik | Proposal Detail (Mevcut) | Customer Detail (Yeni) | Work Order Detail (Yeni) |
|---------|---------------------------|------------------------|---------------------------|
| PageContainer | `maxWidth="lg"` | `maxWidth="full"` | `maxWidth="full"` |
| Header | PageHeader (breadcrumb, title, actions) | Hero Card | Hero Card |
| Ana yapı | 3-kolon grid (2+1) | Tab bar + tab içerikleri | Tek kolon, single scroll |
| Mobil FAB | Var | Yok | Var |

### 1.2 Mevcut İçerik Sırası

```
1. PageHeader (breadcrumb, title, status badge, proposal_no, Edit, PDF)
2. 4 Stat Card (Toplam, Net Kar, Durum, İş Emirleri)
3. 3-kolon grid:
   Sol (2 col):
     - Malzemeler tablosu
     - İş Kapsamı (scope_of_work)
     - Tamamlandı banner (status=completed)
     - Bağlı İş Emirleri (accepted/completed)
   Sağ (1 col):
     - Lokasyon bilgisi kartı
     - Dahili Notlar
     - Aksiyon butonları (duruma göre)
4. Mobil FAB
5. Modallar (status confirm, delete, unlink)
```

### 1.3 Mevcut Veri Kaynakları

| Veri | Kaynak | Alanlar |
|------|--------|--------|
| Proposal | `proposals_detail` | id, proposal_no, title, status, currency, total_amount, discount_percent, created_at, sent_at, accepted_at, rejected_at, company_name, site_id, customer_id, customer_company_name, site_name, site_address, city, account_no, notes, scope_of_work, work_order_count, all_installations_complete |
| Items | `proposal_items` | description, quantity, unit, unit_price, line_total, cost |
| Work Orders | `proposal_work_orders` + `work_orders_detail` | id, work_type, form_no, status, scheduled_date, description |

---

## 2. UX Eksikleri ve Tutarsızlıklar

### 2.1 Layout Tutarsızlıkları

1. **maxWidth="lg"** — Müşteri ve iş emri detay sayfaları `full` kullanıyor; teklif dar kalıyor.
2. **PageHeader vs Hero** — Diğer detay sayfalarında Hero Card var; teklifte klasik PageHeader.
3. **Stat kartları** — 4 ayrı kart var ama Hero içinde özet stat yok; bilgi dağınık.

### 2.2 Bilgi Hiyerarşisi

1. **Başlık ve kimlik** — PageHeader'da title + status + proposal_no; Hero'da daha vurgulu olabilir.
2. **Müşteri/Lokasyon** — Sağ sidebar'da; ana içerikle eşit öncelikte değil.
3. **Aksiyonlar** — Sağda dikey liste; Work Order'da hero altında yatay, mobilde FAB.

### 2.3 Tekrarlar ve Dağınıklık

1. **Durum** — Hem PageHeader description'da hem stat kartında gösteriliyor.
2. **İş emirleri sayısı** — Stat kartında ve Linked Work Orders kartında tekrar.
3. **Edit / PDF** — Header'da ve sağdaki aksiyon listesinde tekrar.

### 2.4 Mobil Deneyim

- FAB var ve işlevsel.
- 3-kolon grid mobilde tek kolona düşüyor; sıralama mantıklı (items önce, site/actions sonra).
- Hero yoksa üst alan sadece PageHeader ile sınırlı.

---

## 3. Önerilen Yeni Yapı (Customer/Work Order Uyumlu)

### 3.1 Genel Yaklaşım

- **Tek kolon, single scroll** (Work Order gibi; teklifte tab bar gerekmez — içerik zaten modüler).
- **Hero Card** — Başlık, teklif no, müşteri, durum, 3–4 özet stat.
- **maxWidth="full"** — Diğer detay sayfalarıyla tutarlı.
- **Lokasyon + Özet bilgiler** — 1x2 grid (desktop), Work Order'daki gibi.
- **Mobil FAB** — Korunacak.

### 3.2 Önerilen Wireframe

```
┌────────────────────────────────────────────────────────────────────────┐
│ SAYFA (maxWidth="full", tek kolon)                                     │
│                                                                        │
│ ← Teklifler                    [PDF İndir] [Düzenle] [Sil?]           │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ HERO CARD                                                          │ │
│ │  [📄 Icon]  Güvenlik Kamera Sistemi Kurulumu      ● Gönderildi     │ │
│ │             TKL-2025-001                                          │ │
│ │             Deneme Holding → Merkez Ofis                          │ │
│ │                                                                    │ │
│ │  [💰 Toplam] [📈 Net Kar] [📋 İş Emri 2/3] [📅 Gönderim]          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ [Draft: Gönderildi İşaretle | Sent: Onayla / Reddet | Accepted: Tamamla]│
│ (Sadece aksiyon gerektiğinde, boş kart yok)                           │
│                                                                        │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────┐│
│ │ LOKASYON BİLGİSİ            │ │ ÖZET BİLGİLER                       ││
│ │ Firma, Site, Adres, Hesap   │ │ Oluşturulma, Gönderim, Onay tarihi  ││
│ │                             │ │ Yetkili, Müşteri Temsilcisi          ││
│ └─────────────────────────────┘ └─────────────────────────────────────┘│
│                                                                        │
│ ┌─ MALZEMELER ──────────────────────────────────────────────────────┐│
│ │ [Items list + subtotal, discount, total]                            ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ ┌─ İŞ KAPSAMI ───────────────────────────────────────────────────────┐│
│ │ scope_of_work metni                                                ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ [Tamamlandı banner — sadece status=completed]                         │
│                                                                        │
│ ┌─ BAĞLI İŞ EMİRLERİ ───────────────────────────────────────────────┐│
│ │ [Work order rows + Yeni İş Emri]                                   ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ ┌─ DAHİLİ NOTLAR ────────────────────────────────────────────────────┐│
│ │ notes (varsa)                                                      ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ [Mobil FAB]                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Bileşen Mimarisi

### 4.1 Yeni/Değişecek Bileşenler

| Bileşen | Açıklama | Yeniden mi? |
|---------|----------|-------------|
| `ProposalHero` | Breadcrumb, actions, icon, title, proposal_no, müşteri→site, status badge, 4 stat kutusu | Yeni |
| `ProposalStatusActions` | Draft: Gönderildi | Sent: Onayla/Reddet | Accepted: Tamamla — boşsa render etme | Yeni |
| `ProposalSiteCard` | Lokasyon bilgisi (WorkOrderSiteCard benzeri) | Mevcut kartı refactor veya yeni |
| `ProposalSummaryCard` | Oluşturulma, gönderim, onay tarihleri; yetkili, müşteri temsilcisi | Yeni (veya Hero'ya sıkıştırılabilir) |

### 4.2 Mevcut Bileşenler (Korunacak / Hafif Revize)

- Items tablosu (Card içinde)
- Scope of Work kartı
- Completion banner
- Linked Work Orders kartı
- Notes kartı
- Modallar
- Mobil FAB

### 4.3 Dosya Yapısı Önerisi

```
src/features/proposals/
├── ProposalDetailPage.jsx          ← Ana sayfa (yeniden yapılandırılacak)
├── components/
│   ├── ProposalHero.jsx           ← Yeni
│   ├── ProposalStatusActions.jsx  ← Yeni
│   ├── ProposalSiteCard.jsx       ← Yeni (veya mevcut inline'dan çıkar)
│   ├── ProposalSummaryCard.jsx    ← Yeni (opsiyonel)
│   ├── ProposalStatusBadge.jsx    ← Mevcut
│   └── ProposalPdf.jsx            ← Mevcut
```

---

## 5. ProposalHero İçeriği

### 5.1 Üst Satır

- **Sol:** `← Teklifler` breadcrumb
- **Sağ:** [PDF İndir] [Düzenle] [Sil] — Sil her durumda gösterilecek

### 5.2 Kimlik

- **İkon:** FileText veya FileCheck (primary renk kutusu)
- **Başlık:** `proposal.title` (h1)
- **Alt satır:** `proposal_no` (font-mono)
- **Alt satır 2:** `customer_company_name → site_name` (link müşteriye)
- **Sağ:** ProposalStatusBadge

### 5.3 Stat Kutuları (4 adet)

| # | İkon | Etiket | Değer |
|---|------|--------|-------|
| 1 | DollarSign | Toplam | formatCurrency(grandTotal) |
| 2 | TrendingUp | Net Kar | formatCurrency(netProfit) |
| 3 | ClipboardList | İş Emirleri | X/Y Tamamlandı |
| 4 | Calendar | Gönderim / Onay | sent_at veya accepted_at tarihi |

---

## 6. ProposalStatusActions

- **Draft:** "Gönderildi İşaretle" (primary)
- **Sent:** "Onayla" (primary), "Reddet" (outline/ghost)
- **Accepted:** "Montajı Tamamla" (primary)
- **Completed / Rejected / Cancelled:** Render etme (return null)

---

## 7. Lokasyon + Özet Kartları (1x2 Desktop)

### 7.1 Sol: ProposalSiteCard

- Site adı, adres, hesap no
- Müşteri linki (customer_company_name → /customers/:id)
- Site yoksa: "Lokasyon seçilmedi" metni

### 7.2 Sağ: ProposalSummaryCard (ayrı kart)

- Oluşturulma tarihi
- Gönderim tarihi (varsa)
- Onay/Red tarihi (varsa)
- Yetkili kişi (authorized_person)
- Müşteri temsilcisi (customer_representative)

---

## 8. Karar Noktaları (Kesinleşti)

| # | Konu | Karar |
|---|------|-------|
| 1 | Tab bar | Yok — single scroll |
| 2 | Özet kartı | Ayrı ProposalSummaryCard |
| 3 | Sil butonu | Her durumda hero'da |
| 4 | Completion banner | Mevcut konumda (Malzemeler sonrası, İş Emirleri öncesi) |

---

## 9. Veri Kontrolü

| Alan | proposals_detail | Not |
|------|------------------|-----|
| customer_company_name | ✅ | |
| site_name, site_address, city, account_no | ✅ | |
| sent_at, accepted_at, rejected_at | ✅ | |
| authorized_person, customer_representative | ✅ | proposals tablosu |
| created_at | ✅ | |
| work_order_count, all_installations_complete | ✅ | |

Tüm gerekli alanlar mevcut.

---

## 10. Uygulama Sırası (Öneri)

| # | Adım | Dosya |
|---|------|-------|
| 1 | ProposalHero | components/ProposalHero.jsx |
| 2 | ProposalStatusActions | components/ProposalStatusActions.jsx |
| 3 | ProposalSiteCard | components/ProposalSiteCard.jsx |
| 4 | ProposalSummaryCard | components/ProposalSummaryCard.jsx |
| 5 | ProposalDetailPage refactor | ProposalDetailPage.jsx |
| 6 | i18n güncellemeleri | locales/tr/proposals.json |

---

**Son Güncelleme:** 2026-02-18 — Kararlar kesinleşti, implement edilmeye hazır
