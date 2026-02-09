# Güvenlik Sistemi ERP/CRM — Soru Bombardımanı Cevaplar

> Proje dokümanları (work-order-system-implementation-plan, roadmap, requirements) ve mevcut kod baz alınarak hazırlanmıştır. **Senin kararın** gereken maddeler işaretlidir.

---

## 1. KAPSAM & İŞ AKIŞI

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Hangi güvenlik sistemleri?** | Projede **alarm + servis/montaj** odaklı. Kamera, yangın, access control ayrıca modellenmemiş; iş emri tipi “diğer” ile kapsanabilir. **Karar:** Hepsi tek sistemde mi, yoksa sadece alarm/servis mi? |
| **Müşteri profili kim?** | Dokümanda özel segment yok. **Şirket (company_name)** + **lokasyonlar (customer_sites)** var; konut/işyeri/AVM/fabrika ayrımı yok. **Karar:** Segmentasyon gerekirse sonra eklenir. |
| **Kaç kişilik ekip?** | Dokümanda sayı yok. **assigned_to** 1–3 kişi (UUID[]). Roller: admin, field_worker, accountant. **Karar:** Sen belirleyeceksin; sistem küçük/orta ekip için yeterli. |
| **Günde kaç iş emri ortalama?** | Dokümanda yok. **Karar:** 10–50–100+ için mevcut liste/filtre/tarih yapısı yeterli; çok büyük ölçekte sayfalama/performans eklenir. |
| **Mevcut sistem var mı?** | **Evet. Excel kullanılıyor; sıfırdan DB/uygulama ile değiştiriliyor.** (Implementation plan: "Replace Excel-based workflow") |

---

## 2. FİNANSAL MODÜL (ERP TARAFI)

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Faturalandırma lazım mı?** | **Roadmap Faz 3:** Fatura tetikleme **Paraşüt API** ile planlı (iş tamamlanınca veya abonelik tahsilatı sonrası). İş emri → fatura otomatik **planlanıyor**, henüz yok. |
| **Teklif/proforma lazım mı?** | Projede **yok**. Müşteri kartı/requirements’ta “teklif” geçiyor ama modül/ekran tanımlı değil. **Karar:** İstersen ayrı fazda eklenir. |
| **Stok takibi lazım mı?** | **Malzeme kataloğu (materials)** var; iş emrinde malzeme kullanımı (work_order_materials) var. **Stok miktarı / depo hareketi** tablosu yok. **Karar:** Stok takibi istersen ayrı tablo + ekran gerekir. |
| **Satın alma modülü?** | **Yok.** Tedarikçi siparişi planlı değil. **Karar:** İstersen sonra eklenir. |
| **Ödeme takibi?** | **Roadmap Faz 2:** Kasa (accounts) + işlem (transactions) planlı. Tahsilat / alacak-verecek ayrıntısı dokümanda net değil. **Karar:** Faz 2’de “gelir/gider” ile başlanır; alacak/verecek detayı sen netleştirirsin. |
| **Maliyet hesabı?** | İş emrinde **amount** ve **currency** var. İş emri başına **kar/zarar (maliyet vs gelir)** analizi yok. **Karar:** İstersen malzeme maliyeti + işçilik ile rapor eklenir. |

---

## 3. CRM TARAFI (MÜŞTERİ YÖNETİMİ)

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Lead/fırsat yönetimi?** | **Yok.** Potansiyel müşteri, pipeline, aşama takibi tanımlı değil. **Karar:** İstersen lead/opportunity tabloları + ekran eklenir. |
| **Satış süreci?** | **Yok.** Teklif → Onay → Sözleşme → Montaj workflow’u yok. Sadece iş emri (keşif/montaj/servis/bakım/diğer) var. **Karar:** İstersen ayrı süreç modülü. |
| **Müşteri kategorileri?** | **Yok.** VIP, kurumsal, bireysel segmentasyon yok. **Karar:** İstersen customer’a category/tag alanı eklenir. |
| **İletişim geçmişi?** | **Yok.** Arama, email, WhatsApp log tablosu yok. **Karar:** İstersen activity/contact_log tablosu. |
| **Kampanya/pazarlama?** | **Yok.** SMS/email kampanyası planlı değil. **Karar:** İstersen sonra. |
| **Müşteri portali?** | **Yok.** Müşterinin kendi iş emirlerini görmesi planlı değil. **Karar:** İstersen ayrı portal + rol. |

---

## 4. SERVİS & BAKIM

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Periyodik bakım otomatik iş emri?** | **Yok.** Yıllık bakım zamanı gelince uyarı veya otomatik iş emri oluşturma yok. **Karar:** İstersen cron/trigger + “son bakım tarihi” ile eklenir. |
| **SLA takibi?** | **Yok.** “4 saat içinde yanıt” gibi SLA alanı veya takip yok. **Karar:** İstersen SLA alanları + rapor. |
| **Garanti takibi?** | **Yok.** Montaj sonrası X ay garanti süresi alanı yok. **Karar:** İstersen site veya iş emri tarafında garanti bitiş tarihi eklenir. |
| **Yedek parça/malzeme tüketimi?** | **Var.** İş emrinde **work_order_materials** ile hangi malzeme, kaç adet kullanıldığı kaydediliyor. **Stoktan otomatik düşme** yok (stok modülü yok). **Karar:** Stok modülü gelirse stoktan düşüm eklenir. |
| **Teknisyen performansı?** | **Yok.** Günde kaç iş tamamladı, rating sistemi yok. **Karar:** İstersen rapor/dashboard (tamamlanan iş sayısı vb.). |
| **Mobil app lazım mı?** | **Planlı değil.** Teknisyen sahada app’den iş emri görsün/tamamlasın henüz yok. **Karar:** İstersen PWA veya native mobil fazı. |

---

## 5. ALARM SİSTEMİ ÖZEL

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Alarm paneli entegrasyonu?** | **Yok.** Alarm merkezi API entegrasyonu yok. **Karar:** İstersen ayrı entegrasyon projesi. |
| **Hesap numarası (account_no) nedir?** | **customer_sites.account_no** — Lokasyon bazlı “hesap numarası”; alarm merkezi takip numarası olarak kullanılıyor. Servis/bakım için zorunlu olabilecek şekilde işaretleniyor (ACCOUNT_NO_REQUIRED_TYPES). **Tam tanım senin iş sürecine göre.** |
| **Test sinyalleri takip?** | **Yok.** Montaj sonrası test başarılı/başarısız alanı yok. **Karar:** İstersen iş emri veya site tarafına test sonucu alanı. |
| **Alarm olayları?** | **Yok.** Hırsızlık, yangın alarmları sisteme düşsün yapısı yok. **Karar:** İstersen events tablosu + alarm merkezi entegrasyonu. |
| **Remote configuration?** | **Yok.** Panel uzaktan ayarlama modülü yok. **Karar:** İstersen sonra. |

---

## 6. PROJE YÖNETİMİ

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Büyük projeler (100 daireli site vb.)?** | **Müşteri → birden fazla site** var. Bir “proje” üst yapısı (site grupları, bloklar) yok. **Karar:** İstersen project veya site_group tablosu. |
| **Alt yüklenici?** | **Yok.** Başka firmalara iş atama / outsource takibi yok. **Karar:** İstersen tedarikçi/alt yüklenici + atama. |
| **Proje timeline / Gantt?** | **Yok.** Gantt, milestone takibi yok. **Karar:** İstersen ayrı modül. |
| **Keşif/survey süreç?** | **Keşif** iş emri tipi var (work_type: kesif). Keşif → Teklif → Onay workflow’u ayrı tanımlı değil. **Karar:** İstersen aşama alanı veya süreç eklenir. |

---

## 7. RAPORLAMA & ANALİTİK

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Hangi raporlar lazım?** | Dokümanda: Dashboard iskeleti (bugünkü iş sayısı, açık görev). **Detay rapor listesi yok.** **Karar:** Günlük/aylık iş emri sayısı, teknisyen performansı, müşteri bazlı gelir, malzeme tüketimi, en çok servis isteyen müşteriler — bunlar senin önceliğine göre eklenir. |
| **Dashboard KPI’lar?** | Şu an basit: bugünkü iş, açık görev. **Karar:** Açık iş emri sayısı, aylık ciro, teknisyen doluluk vb. sen belirleyeceksin. |
| **Excel export?** | **Yok.** Raporları Excel’e aktarma tanımlı değil. **Karar:** İstersen export API + buton. |

---

## 8. KULLANICI ROLLERİ

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Kimler kullanacak?** | **Var:** admin, field_worker, accountant (profiles.role). Satış elemanı ve müşteri rolleri yok. **Karar:** Satış rolü eklenebilir; müşteri portalı açılırsa müşteri rolü. |
| **İzin yönetimi?** | RLS ve role var; **detaylı izin matrisi** (teknisyen fiyat görmesin, muhasebe iş emri oluşturmasın) dokümanda tek tek yazılı değil. **Karar:** İhtiyaca göre policy ve UI’da alan gizleme eklenir. |

---

## 9. ENTEGRASYONLAR

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Muhasebe yazılımı (Logo, Netsis, Mikro)?** | **Paraşüt** planlı (Faz 3 fatura tetikleme). Diğer ERP entegrasyonu yok. **Karar:** İstersen API/export. |
| **WhatsApp Business API?** | **Yok.** **Karar:** İstersen bildirim/entegrasyon. |
| **SMS gateway?** | **Yok.** **Karar:** İstersen toplu SMS. |
| **Google Calendar?** | Projede **takvim (calendar)** var; Google senkron dokümanda geçmiyor. **Karar:** İstersen senkron eklenir. |
| **E-Fatura / E-Arşiv (GİB)?** | **Dokümanda yok.** Paraşüt üzerinden giderilebilir. **Karar:** Sen netleştirirsin. |

---

## 10. MOBİL & SAHA

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Teknisyen mobil app?** | **Planlı değil.** İş emri listesi, fotoğraf, imza, GPS, çalışma saati log’u yok. **Karar:** İstersen PWA veya native ile eklenir. |
| **Offline çalışsın mı?** | **Yok.** **Karar:** Mobil gelirse offline queue + senkron düşünülür. |

---

## 11. MEVCUT SİSTEM

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Şu an neyle yönetiliyor?** | **Excel.** Geçiş: Excel → veritabanı + web uygulaması. |
| **Veri taşınacak mı?** | Implementation planda **“fresh database”** ve rollback stratejisi var; eski veri import’u ayrı dokümanda yok. **Karar:** Eski müşteri/iş emri import’u istersen migration/script yazılır. |
| **Kaç yıllık geçmiş data?** | **Dokümanda yok.** **Karar:** Sen söyle; buna göre import kapsamı belirlenir. |

---

## 12. İŞ MODELİ

| Soru | Cevap (proje bazlı) |
|------|---------------------|
| **Gelir modeli?** | Dokümanda: **montaj/servis** iş emirleri, **abonelik tahsilatı** (Faz 3), **fatura (Paraşüt)**. Aylık izleme ücreti, yıllık bakım kontratı, malzeme satışı ayrı modül olarak tanımlı değil. **Karar:** Hangileri kullanılacaksa sözleşme/abonelik alanları eklenir. |
| **Sözleşme yönetimi?** | **Yok.** PDF sözleşme saklama, yenileme takibi yok. **Karar:** İstersen contract tablosu + dosya yükleme. |

---

## Özet: Şu An Projede Ne Var / Ne Planlı?

- **Var:** Müşteri (şirket) + lokasyonlar (site, account_no), iş emirleri (keşif/montaj/servis/bakım/diğer), malzeme kataloğu + iş emrinde malzeme kullanımı, günlük iş listesi, iş geçmişi arama, takvim, dashboard iskeleti, roller (admin, field_worker, accountant).
- **Planlı (roadmap):** Kasa + işlem (Faz 2), abonelik + tahsilat + Paraşüt fatura (Faz 3).
- **Yok / karar senin:** Lead/CRM, SLA, garanti, periyodik bakım otomatik, alarm merkezi entegrasyonu, stok takibi, satın alma, teklif/proforma, müşteri portali, mobil/offline, detaylı raporlar, Excel export, sözleşme yönetimi, kampanya, iletişim logu.

Bu dokümandaki **Karar** maddelerini sen doldurursan, bir sonraki adımda hangi özelliklerin ekleneceği netleşir.
