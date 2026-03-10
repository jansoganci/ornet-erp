# Geliştirme Roadmap’i (İş Planı)

Roadmap, yüksek seviyede fazları ve her fazdaki iş paketlerini tanımlar. Bir faza geçtiğimizde, o fazın alt maddelerini ayrı ayrı planlayıp (görev listesi, ekran taslağı, API) adım adım ilerleriz.

---

## Rol: Solution Architect → Application Developer

**Geliştirme aşamasında:**

- **Önceki rol (Solution Architect):** Ne yapacağız, nasıl yapacağız, hangi kararlar — dokümanlar ve mimari.
- **Şimdiki rol (Application Developer):** Kodu yazmak, bileşenleri kurmak, sayfaları ve API/veritabanı şemasını hayata geçirmek. Sen karar verirsin / test edersin / geri bildirim verirsin; ben roadmap’e ve dokümanlara göre uygularım.
- **Strateji:** Roadmap’teki fazlara sırayla gideriz. Her fazda “bu fazın 5 maddesi” varsa, o 5 maddeyi tek tek ele alırız; her biri için gerekiyorsa alt plan (görev listesi, ekran akışı) çıkarırız. Think fast, iterate faster — basit ama çalışan.

---

## Faz 0: Proje Kurulumu

*Amaç: Repo, frontend iskeleti, Supabase bağlantısı, design token + i18n entegre; “uygulama ayağa kalkıyor” anı.*

| # | İş paketi | Kısa açıklama | Alt planda |
|---|------------|----------------|------------|
| 0.1 | **Repo + React + Vite** | Proje oluşturma, Tailwind, ESLint, `docs/` ile uyumlu klasör yapısı | Gerekirse: dosya ağacı, komutlar |
| 0.2 | **Design token → Tailwind** | `docs/design-tokens.md` değerlerinin `tailwind.config.js` ve (isteğe) CSS değişkenlerine aktarılması | Renk/font/spacing eşlemesi |
| 0.3 | **i18n kurulumu** | react-i18next, `locales/tr/` yapısı, `docs/i18n.md` ile uyumlu namespace’ler | Örnek key’ler, kullanım |
| 0.4 | **Supabase projesi + env** | Supabase proje açma, Auth açma, `.env.local` ve `.env.example` | URL, anon key, güvenlik |
| 0.5 | **Auth boilerplate** | Login sayfası (email/şifre), Supabase Auth, korumalı layout / route guard | Ekran akışı, rol (basit) |

**Çıktı:** Çalışan bir uygulama; giriş yapılabiliyor, korumalı bir “iç” alan var, tasarım ve dil tek kaynaktan geliyor.

---

## Faz 1: MVP Çekirdek

*Amaç: Müşteri listesi, müşteri kartı, servis/montaj formu, yapılacak işler listesi; saha ekibinin günlük kullanabileceği minimum set.*

| # | İş paketi | Kısa açıklama | Alt planda |
|---|------------|----------------|------------|
| 1.1 | **Veritabanı şeması (MVP)** | `customers`, `work_orders` (servis/montaj), `tasks` tabloları; Supabase’de oluşturma, RLS taslağı | Tablo alanları, ilişkiler |
| 1.2 | **Müşteri listesi + müşteri kartı** | `/customers`, `/customers/:id` — liste (arama), detay (iletişim, adres, geçmiş işler) | Ekran alanları, API |
| 1.3 | **Servis / montaj formu** | Form ekranı (müşteri seçimi, tarih/saat, tip, açıklama, malzeme vb.); kayıt `work_orders`’a | Zorunlu alanlar, validasyon |
| 1.4 | **Yapılacak işler listesi** | `/tasks` — açık/tamamlanan, tarih, atanan kişi; form tamamlanınca ilgili işin durumu güncellenir | Filtre, durum akışı |
| 1.5 | **Dashboard iskeleti** | `/` veya `/dashboard` — basit özet (bugünkü iş sayısı, açık görev sayısı); ileride genişletilir | Kartlar, veri kaynağı |

**Çıktı:** Saha ekibi bir servis/montaj kaydı girebiliyor, müşteri kartında geçmiş görünüyor, yapılacak işler tek listede takip edilebiliyor.

---

## Faz 2: Finans ve Kasa İskeleti

*Amaç: Kasaların ve para hareketlerinin sisteme girmesi; tek veya birkaç kasa ile başlama.*

| # | İş paketi | Kısa açıklama | Alt planda |
|---|------------|----------------|------------|
| 2.1 | **Hesaplar (kasa) tablosu + ekran** | `accounts` tablosu, kasa listesi, bakiye (hesaplanan veya kayıtlı) | Kasa tipleri, MVP’de kaç tane |
| 2.2 | **İşlem girişi** | Gelir/gider kaydı (kasa, tutar, tarih, açıklama); `transactions` tablosu | Form, liste |
| 2.3 | **Kur ve para birimi** | TCMB (veya seçilen) kur API, fatura/teklif için USD → TL dönüşüm alanları | Nerede kullanılacak |

**Çıktı:** En az bir kasa üzerinden gelir/gider girilebiliyor; kur bilgisi sistemde kullanıma hazır.

---

## Faz 3: Abonelik, Fatura, Genişletmeler

*Amaç: Abonelik tahsilatı (ödeme sağlayıcı entegrasyonu), fatura tetikleme (Paraşüt API), OCR/fiş (isteğe).*

| # | İş paketi | Kısa açıklama | Alt planda |
|---|------------|----------------|------------|
| 3.1 | **Abonelik listesi + ödeme sağlayıcı** | Abone kayıtları, tahsilat (iyzico/PayTR vb.); kart bilgisi uygulamada tutulmaz | Entegrasyon, webhook |
| 3.2 | **Fatura tetikleme (Paraşüt)** | İş/montaj tamamlanınca veya abonelik tahsilatı sonrası Paraşüt API ile fatura oluşturma | API dokümanı, Edge Function |
| 3.3 | **Fiş/fatura girişi + OCR (isteğe)** | Gelen evrakın yüklenmesi, tür (fiş/fatura/makbuz), stok/ödeme ataması | Öncelik sonraya bırakılabilir |

**Çıktı:** Abonelikler otomatik tahsil edilebiliyor, faturalar API ile kesilebiliyor.

---

## Nasıl İlerleriz?

1. **Faz 0’dan başla.** Faz 0 bittiğinde: proje çalışıyor, giriş var, tasarım ve dil hazır.
2. **Faz 1’e geç.** Her iş paketini (1.1, 1.2, …) ayrı konuşuruz; gerekirse alt görev listesi çıkarırız, ben kodu yazarım, sen dener/güncelleme istersin.
3. **Faz 2 ve 3** roadmap’te durur; sırası gelince aynı yöntemle (paket → alt plan → uygulama) ilerleriz.
4. **Rol:** Application developer olarak bileşenleri, sayfaları, API ve veritabanı şemasını senin onayın ve dokümanlara uygun şekilde yazarım; mimari ve ürün kararları seninle birlikte.

Bu dosya tek iş planı referansıdır; faz tarihleri veya öncelik değişirse sadece bu dosya güncellenir.
