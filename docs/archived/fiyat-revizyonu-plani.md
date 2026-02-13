# Fiyat Revizyonu – Geliştirme Planı

Bu doküman, abonelik fiyatlarını (baz fiyat, SMS, hat, KDV, maliyet) toplu revize etmek için eklenecek özelliğin planıdır. Kod yazılmadan önce referans için.

---

## 1. Güncel Durum

- **Abonelik listesi:** Tüm abonelikler listeleniyor; tekile gitmek için satıra tıklanıyor.
- **Abonelik düzenleme:** `SubscriptionFormPage` ile tek abonelik açılıyor; tüm alanlar (fiyat dahil) orada düzenleniyor.
- **Fiyat güncelleme mantığı:** `api.js` içindeki `updateSubscription`:
  - `subscriptions` satırını güncelliyor.
  - `base_price`, `sms_fee`, `line_fee`, `vat_rate` değiştiyse bekleyen `subscription_payments` kayıtlarının `amount`, `vat_amount`, `total_amount` değerlerini yeniden hesaplayıp güncelliyor.
  - Audit log: `price_change` veya `update`.
- **Yetki:** Sayfa bazında rol kontrolü yok; sadece bazı bileşenler (örn. maliyet alanı) `currentProfile?.role === 'admin'` ile admin’e özel gösteriliyor.

**İhtiyaç:** 40–50 aboneliği tek ekranda görüp sadece fiyat alanlarını toplu revize edebilmek; tek toplu kaydetme isteği.

---

## 2. Hedef / İstenenler

| Konu | Hedef |
|------|--------|
| **Sayfa** | Yeni sayfa: “Fiyat revizyonu”. Sadece **admin** rolü erişebilsin. |
| **İçerik** | Tek sayfada tablo: tüm (filtrelenmiş) abonelikler listelenir. |
| **Kolonlar (sadece okunur)** | Müşteri adı, lokasyon, hesap no, başlangıç tarihi, abonelik tipi (Kart/Nakit/Havale), hizmet türü, ödeme sıklığı (Aylık/Yıllık). |
| **Kolonlar (düzenlenebilir)** | Baz fiyat, SMS ücreti, hat ücreti, KDV oranı, **maliyet (cost)**. |
| **Filtreler** | 1) Hizmet türü (alarm_only, camera_only, alarm_camera, …). 2) Ödeme sıklığı: Aylık / Yıllık. 3) Yıllık seçiliyse: Başlangıç ayı (Ocak … Aralık veya Tümü). |
| **Kaydetme** | **Toplu kaydetme:** “Değişiklikleri kaydet” butonu; yalnızca değişen satırlar tek bir toplu istek ile backend’e gönderilir (40–50 abonelik tek istek). |
| **Veri / performans** | Liste tek sayfada; filtrelerle azalacak. Sunucu tarafında filtreleme tercih edilir (gereksiz veri çekilmez). |

---

## 3. Backend / Veritabanı

### 3.1 Mevcut yapı

- `subscriptions`: `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`, `billing_frequency`, `service_type`, `start_date`, …
- `subscription_payments`: `subscription_id`, `amount` (subtotal), `vat_amount`, `total_amount`, `status` (pending/paid/…).
- Fiyat değişince bekleyen ödemelerin tutarları mevcut `updateSubscription` ile güncelleniyor.

### 3.2 Yapılacaklar

| Nerede | Ne |
|--------|-----|
| **Supabase (migration)** | Yeni **RPC:** `bulk_update_subscription_prices`. Parametre: `p_updates JSONB` (ör. `[{ "id": "uuid", "base_price": 100, "sms_fee": 5, "line_fee": 10, "vat_rate": 20, "cost": 80 }, ...]`). |
| **RPC mantığı** | Her kayıt için: (1) `subscriptions` içinde ilgili satırı güncelle (`base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`). (2) Aynı `subscription_id` için `subscription_payments` tablosunda `status = 'pending'` olan satırların `amount`, `vat_amount`, `total_amount` değerlerini yeni fiyata göre hesaplayıp güncelle. (3) İstenirse audit log. Tüm işlem tek transaction içinde. |
| **Güvenlik** | RPC `SECURITY DEFINER` + içeride gerekirse `auth.role() = 'admin'` veya sadece authenticated; admin kontrolü uygulama tarafında da yapılacak. |

- Mevcut `updateSubscription` ve diğer subscription akışları **değişmeyecek**; sadece bu yeni RPC eklenecek.

---

## 4. Frontend – Hangi Kodlar Değişecek / Eklenecek

| Dosya / yer | Değişiklik |
|-------------|------------|
| **Yeni sayfa** | `src/features/subscriptions/PriceRevisionPage.jsx` (veya `SubscriptionPriceRevisionPage.jsx`). Route: örn. `/subscriptions/price-revision`. Admin kontrolü: `useCurrentProfile()` ile `role === 'admin'` değilse yönlendirme veya “Yetkiniz yok” mesajı. |
| **Tablo** | Sayfada tek tablo. Okunur kolonlar: müşteri, lokasyon, hesap no, başlangıç, tip, hizmet türü, ödeme sıklığı. Düzenlenebilir kolonlar: baz fiyat, SMS, hat, KDV, maliyet (input veya inline-edit hücre). State: sayfa ilk veriyi çeker; kullanıcı değiştirdikçe “dirty” satırlar (id + yeni değerler) tutulur. |
| **Filtreler** | Hizmet türü (select/çoklu), Ödeme sıklığı (Aylık/Yıllık/Tümü), Başlangıç ayı (yıllık seçiliyse: 1–12 veya Tümü). Filtreler API’ye parametre olarak gider; liste bu parametreyle tek seferde çekilir. |
| **API (subscriptions)** | Yeni fonksiyon: `bulkUpdateSubscriptionPrices(updates)` — `updates` = `[{ id, base_price, sms_fee, line_fee, vat_rate, cost }, ...]`. Supabase `rpc('bulk_update_subscription_prices', { p_updates: updates })` çağrısı. |
| **Hooks** | Yeni: `useBulkUpdateSubscriptionPrices()` (mutation). Başarıda subscription listesini (ve gerekirse bu sayfanın verisini) invalidate eder. Listeyi çekmek için mevcut `fetchSubscriptions` veya filtreli yeni bir fetch kullanılabilir. |
| **Navigasyon** | Abonelikler menüsü veya abonelik listesi sayfasına “Fiyat revizyonu” linki/butonu. Sadece admin görür. |
| **Route** | `App.jsx`: `/subscriptions/price-revision` route’u eklenir; layout içinde. |
| **Locales** | `subscriptions.json` (veya ilgili namespace): sayfa başlığı, kolon başlıkları, filtre etiketleri, “Değişiklikleri kaydet”, başarı/hata mesajları, “Yetkiniz yok” vb. |

---

## 5. Uygulama Adımları (Kaç Adımda İmplement Edilecek)

Aşağıdaki sıra bağımlılıklara göre; her adım test edilebilir.

| Adım | Kısa açıklama | Çıktı |
|------|----------------|--------|
| **1** | **Veritabanı:** Migration ile `bulk_update_subscription_prices(p_updates jsonb)` RPC’sini yaz. İçeride subscription güncelleme + bekleyen payment tutarlarını güncelleme (mevcut formülle). | RPC çalışır; tek istekle birden fazla abonelik fiyatı güncellenir. |
| **2** | **API + Hook:** `api.js` (veya subscriptions altında uygun dosya) içinde `bulkUpdateSubscriptionPrices(updates)`; hooks’ta `useBulkUpdateSubscriptionPrices`. | Frontend’den toplu güncelleme çağrılabilir. |
| **3** | **Filtreli liste:** Fiyat revizyonu sayfası için ihtiyaç duyulan liste API’si: mevcut `fetchSubscriptions`’a filtre parametreleri (service_type, billing_frequency, start_month) eklenebilir veya yeni bir `fetchSubscriptionsForPriceRevision(filters)` yazılır. | Sayfa açıldığında filtrelenmiş abonelik listesi doldurulur. |
| **4** | **Sayfa + tablo + filtreler:** `PriceRevisionPage.jsx`: admin kontrolü, filtre UI, tablo (okunur + düzenlenebilir kolonlar), “dirty” state yönetimi. | Kullanıcı listeyi görür, filtreler, fiyatları düzenler (henüz kaydetme butonu mock veya sonraki adımda bağlanır). |
| **5** | **Kaydetme:** “Değişiklikleri kaydet” butonu; sadece değişen satırları `bulkUpdateSubscriptionPrices`’a gönder; başarı/hata mesajı ve liste yenileme. | Toplu revizyon akışı tamamlanır. |
| **6** | **Navigasyon + locales:** Menüde/listede “Fiyat revizyonu” (sadece admin); route; çeviri anahtarları. | Erişim ve metinler tamamlanır. |

**Özet:** 6 adım. 1–2 backend/veri, 3 veri/API, 4–5 sayfa ve akış, 6 navigasyon ve metinler.

---

## 6. Özet Tablo

| Konu | Karar |
|------|--------|
| Sayfa | Yeni sayfa: Fiyat revizyonu; admin only. |
| Tablo | Tek sayfada; okunur kolonlar + düzenlenebilir: base_price, sms_fee, line_fee, vat_rate, cost. |
| Filtreler | Hizmet türü, Ödeme sıklığı (Aylık/Yıllık), Yıllık için başlangıç ayı. |
| Kaydetme | Toplu; tek istek (RPC) ile tüm değişen abonelikler güncellenir. |
| DB | Yeni RPC: `bulk_update_subscription_prices`; subscription + pending payment güncellemesi. |
| Implement | 6 adım: Migration → API/Hook → Filtreli liste → Sayfa/Tablo/Filtreler → Kaydetme → Nav/Locales. |

Bu plan, geliştirme sırasında referans alınacak güncel dokümandır. Soru veya değişiklik olursa bu dosya güncellenebilir.
