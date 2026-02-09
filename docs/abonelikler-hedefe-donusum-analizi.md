# Abonelikler: Güncel Yapıdan Hedef Yapıya Dönüşüm Analizi

Full-stack perspektifle: hangi katmanda ne değişecek, yeni ne eklenecek, workflow nasıl revize edilecek. Kod yazmadan önce referans için.

---

## 1. Özet: Ne Değişecek?

| Alan | Değişiklik türü | Kısa açıklama |
|------|-----------------|----------------|
| Ödeme bilgisi UI | **Revizyon** | Ayrı bölüm + popup kalkacak; tip bazlı inline alanlar (kart: banka adı + son 4; nakit: tahsil eden; havale: opsiyonel not) |
| Hizmet türü | **Yeni** | Abonelikte dropdown: alarm, kamera, internet, alarm+kamera, alarm+kamera+internet vb. |
| Ödeme sıklığı | **Revizyon** | Aylık/Yıllık net alan (şu an formda yok; DB’de annual mantığı var) |
| Resmi / Gayri resmi fatura | **Yeni** | Abonelikte toggle; resmi → Paraşüt’e gidecek (ileride), gayri resmi → sadece CRM |
| Nakit tahsil eden | **Yeni** | Abonelikte “kim tahsil ediyor” (personel veya metin) |
| Kart referansı | **Revizyon** | Banka adı + son 4; ayrı ödeme yöntemi popup’ı yok, inline |
| Havale | **Revizyon** | Müşteri IBAN’ı yok; ödeme kaydında opsiyonel dekont no |
| Excel toplu açma | **Yeni** | 350–400 müşteri/abonelik tek seferde Excel’den içe aktarım |
| Fiyatlandırma | **Değişmeyecek** | base_price, sms_fee, line_fee olarak kalacak; tek tutar alanına indirgenmeyecek. |

---

## 2. Katman Bazlı Analiz

### 2.1 Veritabanı (Supabase migrations)

**Değişecek / eklenecek:**

| Tablo / obje | Değişiklik |
|--------------|------------|
| **subscriptions** | • `service_type` (TEXT veya ENUM): alarm_only, camera_only, internet_only, alarm_camera, alarm_camera_internet vb. (CHECK veya ayrı tablo).<br>• `billing_frequency` (TEXT): 'monthly' | 'yearly' – ödeme sıklığı (şu an annual tipi kaldırıldığı için bu net alan gerekli).<br>• `cash_collector_id` (UUID, FK profiles) veya `cash_collector_name` (TEXT): nakit tahsil eden.<br>• `official_invoice` (BOOLEAN, default true): resmi fatura → Paraşüt; false → sadece CRM.<br>• Kart referansı için iki seçenek: (A) `payment_method_id` kalsın, form sadece inline bank_name + card_last4 göstersin, kayıt anında ilgili payment_method oluşturulup bağlansın; (B) `card_bank_name` + `card_last4` doğrudan subscriptions’a eklenir, payment_method_id opsiyonel/kaldırılabilir. Hedef “tek ekranda gir, ayrı popup yok” olduğu için (A) veya (B) mimari tercih meselesi. |
| **subscription_payments** | • `reference_no` (TEXT) veya `dekont_no` (TEXT): havale ile ödeme kaydı girerken opsiyonel. |
| **payment_methods** | Kullanım değişecek: Kart için “banka adı + son 4” referansı yeterli dersen, card_holder zorunlu olmaktan çıkabilir; bank_name kullanılır. Mevcut yapı aynen kalabilir, sadece UI ve hangi alanların doldurulduğu değişir. İsterseniz ileride sadece “kart referansı” için basitleştirilmiş bir yapı da düşünülebilir. |
| **customers** | İsteğe bağlı: `prefers_vat` (boolean) veya `invoice_preference` – müşteri bazlı KDV/fatura tercihi. Şu an abonelikte vat_rate var; “müşteri KDV’li mi” ayrıca tutulacaksa burada veya abonelikte tutulabilir. |
| **subscriptions_detail (view)** | Yeni subscription alanları view’a eklenmeli: service_type, billing_frequency, cash_collector (veya adı), official_invoice, card_bank_name/card_last4 (eğer subscriptions’da tutuluyorsa). payment_methods join’i (A) seçilirse kalır, (B) seçilirse kalkar veya opsiyonel kalır. |
| **generate_subscription_payments (RPC)** | Şu an `subscription_type = 'annual'` ise 1 kayıt, değilse 12 aylık kayıt üretiyor. Hedefte `billing_frequency = 'yearly'` / `'monthly'` kullanılacaksa bu fonksiyon yeni alana göre güncellenmeli (annual tipi kaldırıldığı için frequency alanına bakacak). |

**Yeni migration(lar):**
- Bir veya birkaç migration: subscriptions’a yeni kolonlar; subscription_payments’a reference_no/dekont_no; view yeniden CREATE; RPC güncellemesi.

---

### 2.2 Backend (Supabase: API kullanımı, RPC, Edge Functions)

**Mevcut yapı:** Doğrudan Supabase client (from frontend) kullanılıyor; ayrı Node backend yok. “Backend” = Supabase tabloları + RPC + (ileride) Edge Function.

**Değişecek / eklenecek:**

| Konu | Açıklama |
|------|----------|
| **Abonelik create/update** | `subscriptions` insert/update payload’ına yeni alanlar eklenecek: service_type, billing_frequency, cash_collector_id (veya name), official_invoice. Kart için: bank_name + card_last4 ya subscription’da ya da payment_method oluşturup payment_method_id set edilecek (mevcut api.js create/update subscription akışı). |
| **Ödeme kaydı (record payment)** | `subscription_payments` update’e `reference_no` / `dekont_no` eklenmeli; PaymentRecordModal’da havale seçiliyse bu alan gösterilir (opsiyonel). paymentsApi.js ve ilgili schema güncellenir. |
| **generate_subscription_payments** | Yukarıda belirtildiği gibi billing_frequency’e göre 12 ay veya 1 yıllık kayıt üretecek şekilde güncellenir. |
| **Excel import** | **Yeni.** İki pratik yol: (1) **Frontend’de:** Excel/CSV parse (örn. xlsx veya papaparse), satır satır veya batch (örn. 50’şer) müşteri / site / abonelik insert; (2) **Edge Function:** Dosyayı yükleyip server’da parse edip toplu insert. 350–400 satır için frontend batch de çalışır; büyük dosyalar veya validasyon ağırlaşırsa Edge Function tercih edilebilir. Yeni: import API (batch create) veya Edge Function endpoint’i + frontend’de “Excel yükle” sayfası/modal. |
| **Paraşüt API** | Hedefte “resmi fatura → Paraşüt’e ilet” var. Bu aşamada sadece `official_invoice` (veya benzeri) alanı tutulur; Paraşüt entegrasyonu ayrı bir iş paketi (yeni kod, env, güvenlik). |

---

### 2.3 Frontend

**Değişecek dosyalar / bileşenler:**

| Dosya / bileşen | Değişiklik |
|-----------------|------------|
| **SubscriptionFormPage.jsx** | • “Ödeme Bilgileri” ayrı kartı ve “Yeni Ödeme Yöntemi Ekle” butonu + PaymentMethodFormModal kaldırılacak.<br>• Abonelik tipi (Kart/Nakit/Havale) seçiminin hemen altında, tip bazlı inline alanlar: Kart → Banka adı (input) + Son 4 (input); Nakit → Tahsil eden (dropdown profiles veya serbest metin); Havale → Opsiyonel not (textarea).<br>• Hizmet türü dropdown eklenecek (service_type).<br>• Ödeme sıklığı dropdown eklenecek (billing_frequency: Aylık / Yıllık).<br>• Resmi / Gayri resmi fatura toggle eklenecek (official_invoice).<br>• Form submit’te: kart için bank_name + card_last4 varsa ya mevcut payment_method seçilir ya da tek seferlik payment_method oluşturulup subscription’a bağlanır; nakit için cash_collector_id/name; havale için ekstra zorunlu alan yok. |
| **PaymentMethodFormModal.jsx** | Abonelik akışından çıkarılacak (subscription form’da açılmaz). İstenirse müşteri detayında “müşterinin ödeme yöntemleri” yönetimi için ayrı yerde kullanılabilir; hedef dokümanda “tek ekrandan gir” vurgusu olduğu için subscription tarafında kullanımı kalkar. |
| **SubscriptionFormPage – schema & default** | subscriptionSchema ve defaultValues: payment_method_id zorunluluğu kart için kalsın ama kart bilgisi inline geliyorsa önce payment_method oluşturulup id set edilebilir; veya schema’da payment_method_id opsiyonel, kart seçiliyse bank_name + card_last4 zorunlu yapılır. Yeni alanlar: service_type, billing_frequency, cash_collector_id veya cash_collector_name, official_invoice, (opsiyonel) card_bank_name, card_last4. |
| **SubscriptionDetailPage.jsx** | Yeni alanların gösterimi: hizmet türü, ödeme sıklığı, resmi/gayri resmi, nakit tahsil eden, kart için banka adı + son 4 (veya payment_method üzerinden). |
| **SubscriptionsListPage.jsx** | Liste kolonları: isteğe bağlı service_type, billing_frequency, official_invoice (ikon/badge). Filtre eklenebilir. |
| **PaymentRecordModal.jsx** | Ödeme kaydı girerken havale (bank_transfer) seçiliyse opsiyonel “Dekont no / Referans” alanı; kayıt subscription_payments.reference_no’ya yazılır. Schema ve paymentsApi buna göre güncellenir. |
| **schema.js (subscriptions)** | SUBSCRIPTION_TYPES aynı kalabilir (recurring_card, manual_cash, manual_bank). SERVICE_TYPES (hizmet türü) sabit listesi; BILLING_FREQUENCIES ['monthly','yearly']; subscriptionSchema’ya yeni alanlar ve koşullu validasyon (kart → bank_name + last4; nakit → cash_collector). |
| **api.js (subscriptions)** | createSubscription / updateSubscription: yeni alanları payload’a eklemek; kart için inline bank_name + card_last4 geliyorsa payment_methods’a insert edip id’yi subscription’a vermek (veya subscription’da tutuluyorsa oraya yazmak). |
| **paymentMethodsApi.js** | Kart için “tek kayıt oluştur” (customer_id, method_type: card, bank_name, card_last4) kullanılabilir; abonelik formundan çağrılır, popup kalkar. |
| **paymentsApi.js** | recordPayment’a reference_no / dekont_no eklenmeli; subscription_payments tablosunda bu kolon olacak. |
| **hooks.js** | Yeni alanlar için ekstra hook gerekmez; mevcut useSubscription, useCreateSubscription, useUpdateSubscription yeni alanları taşır. Excel import için useImportSubscriptions gibi bir mutation hook eklenebilir. |
| **locales (tr/subscriptions.json)** | Hizmet türü etiketleri, ödeme sıklığı, resmi/gayri resmi, nakit tahsil eden, dekont no vb. çeviri anahtarları. |

**Yeni eklenebilecek:**

| Ne | Açıklama |
|----|----------|
| **Excel import sayfası / modal** | Örn. `/subscriptions/import` veya liste sayfasında “Toplu içe aktar” butonu. Şablon indir (Excel), doldur, yükle; kolon eşleme (veya sabit kolon adları); önizleme; “İçe aktar” ile batch create (müşteri/site/abonelik). |
| **Import API / batch create** | Müşteri + site + abonelik (ve gerekirse ödeme kayıtları) toplu oluşturmak için: ya mevcut createSubscription’ı döngüyle çağırır ya da yeni bir “batchCreateSubscriptions” veya “importFromSheet” benzeri fonksiyon (frontend’de veya Edge Function’da). |

---

## 3. Workflow Revizyonu

### 3.1 Abonelik oluşturma / düzenleme (mevcut → hedef)

| Adım | Şu an | Hedef |
|------|--------|--------|
| 1 | Müşteri/lokasyon seçimi | Aynı. |
| 2 | Abonelik tipi (Kart/Nakit/Banka) | Aynı (dropdown). |
| 3 | Ayrı “Ödeme Bilgileri” kartı; ödeme yöntemi dropdown + “Yeni ödeme yöntemi” popup | **Kaldırılır.** Tip seçiminin hemen altında: Kart → Banka adı + Son 4; Nakit → Tahsil eden; Havale → Opsiyonel not. |
| 4 | Başlangıç tarihi, fatura günü | Aynı + **Ödeme sıklığı** (Aylık/Yıllık) eklenir. |
| 5 | Fiyat (base_price, sms_fee, line_fee) | Aynı kalacak: base_price, sms_fee, line_fee – tek tutar alanı yok. |
| 6 | KDV | Aynı. |
| 7 | - | **Hizmet türü** dropdown eklenir. |
| 8 | - | **Resmi / Gayri resmi** fatura toggle eklenir. |
| 9 | Kaydet | Kart için: bank_name + last4 varsa payment_method oluştur (veya güncelle) ve subscription’a bağla; nakit için cash_collector; havale için not. Diğer alanlar DB’e yazılır. |

### 3.2 Ödeme kaydı girme (tahsilat)

| Adım | Şu an | Hedef |
|------|--------|--------|
| Ödeme tarihi, ödeme tipi (kart/nakit/havale), fatura bilgisi | Aynı. | Havale seçiliyse **opsiyonel dekont no** alanı eklenir; subscription_payments.reference_no’ya yazılır. |
| Resmi/gayri resmi | - | Abonelikteki official_invoice’a göre fatura/Parasüt akışı ileride kullanılır (şimdilik sadece alan). |

### 3.3 Excel ile toplu açma (yeni)

| Adım | Açıklama |
|------|----------|
| 1 | Şablon indir (sabit kolonlar: müşteri adı, lokasyon, hizmet türü, başlangıç, base_price, sms_fee, line_fee, KDV, ödeme tipi, kart banka+son4 / nakit tahsil eden, resmi/gayri vb.). |
| 2 | Kullanıcı dosyayı yükler. |
| 3 | Parse (xlsx/csv); validasyon (zorunlu kolonlar, tarih/tutar formatı). |
| 4 | Önizleme (ilk N satır); hata varsa liste. |
| 5 | “İçe aktar” → Müşteri yoksa oluştur, site yoksa oluştur, abonelik oluştur, generate_subscription_payments çağrılır (veya batch’te). Hata olan satırlar loglanır / kullanıcıya gösterilir. |

---

## 4. Bağımlılık ve Sıra Önerisi

1. **Veritabanı:** Yeni kolonlar + view + RPC (billing_frequency’e göre generate_subscription_payments) – önce.
2. **Schema + API (subscriptions):** Yeni alanlar, create/update’te kart için payment_method oluşturma veya subscription’a bank_name+last4 yazma – DB’den hemen sonra.
3. **Form UI:** Ödeme bölümü revizyonu, inline alanlar, hizmet türü, sıklık, resmi/gayri – API ile birlikte.
4. **Detail + List:** Yeni alanların gösterimi – form bittikten sonra.
5. **Ödeme kaydı:** subscription_payments.reference_no + PaymentRecordModal’da dekont alanı – kısa.
6. **Excel import:** Şablon, yükleme sayfası, parse + batch create – son aşama.
7. **Paraşüt:** Sadece alan tutulur; gerçek API entegrasyonu ayrı iş paketi.

---

## 5. Kısa Checklist (Kod Değişecek Yerler)

- [ ] **DB:** subscriptions – service_type, billing_frequency, cash_collector_id veya name, official_invoice; (opsiyonel) card_bank_name, card_last4 veya payment_method_id ile devam.
- [ ] **DB:** subscription_payments – reference_no (veya dekont_no).
- [ ] **DB:** subscriptions_detail view – yeni kolonlar.
- [ ] **DB:** generate_subscription_payments – billing_frequency’e göre 12 ay / 1 yıl.
- [ ] **Frontend – schema.js:** SERVICE_TYPES, BILLING_FREQUENCIES; subscriptionSchema’ya yeni alanlar ve koşullu kurallar.
- [ ] **Frontend – SubscriptionFormPage:** Ödeme bölümü ve modal kaldır; inline tip bazlı alanlar; hizmet türü, sıklık, resmi/gayri.
- [ ] **Frontend – api.js (subscriptions):** Create/update’te yeni alanlar; kart için payment_method create + link.
- [ ] **Frontend – SubscriptionDetailPage + SubscriptionsListPage:** Yeni alanların gösterimi.
- [ ] **Frontend – PaymentRecordModal + paymentsApi:** reference_no / dekont no (havale).
- [ ] **Frontend – Excel import:** Sayfa/modal, parse, validasyon, batch create.
- [ ] **Locales:** Yeni metinler.
- [ ] **PaymentMethodFormModal:** Abonelik formundan kaldırılır (isteğe bağlı: başka sayfada kalsın).

---

## 6. Nasıl Entegre Edeceğiz? (Uygulama Planı)

Aşağıdaki sırayla ilerlenirse bağımlılıklar kırılmaz; her aşamada test edilebilir.

### Faz 1: Veritabanı (önce bunu bitir)

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 1.1 | Yeni migration dosyası aç | `supabase/migrations/00022_subscription_target_fields.sql` (veya sıradaki numara). |
| 1.2 | `subscriptions` tablosuna kolon ekle | `service_type` (TEXT, CHECK), `billing_frequency` (TEXT, 'monthly'/'yearly'), `cash_collector_id` (UUID FK profiles, nullable), `official_invoice` (BOOLEAN, default true), `card_bank_name`, `card_last4` (TEXT, nullable). |
| 1.3 | `subscription_payments` tablosuna kolon ekle | `reference_no` (TEXT, nullable) – havale dekont no. |
| 1.4 | View güncelle | `subscriptions_detail` DROP + CREATE; yeni subscription kolonlarını ekle. |
| 1.5 | RPC güncelle | `generate_subscription_payments`: `billing_frequency = 'yearly'` ise 1 kayıt, 'monthly' ise 12 kayıt. |
| 1.6 | Migration çalıştır | `supabase migration up` veya hosted SQL Editor. |

**Çıktı:** DB hedef yapıya hazır; mevcut veri bozulmaz.

---

### Faz 2: Schema + API (subscriptions)

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 2.1 | Sabit listeler | `schema.js`: SERVICE_TYPES, BILLING_FREQUENCIES. |
| 2.2 | Form şeması | subscriptionSchema: service_type, billing_frequency, cash_collector_id, official_invoice, card_bank_name, card_last4; kart için bank_name+last4, nakit için cash_collector zorunlu. |
| 2.3 | Default değerler | subscriptionDefaultValues: yeni alanlar. |
| 2.4 | Create/update API | `api.js`: yeni alanları gönder; kart için card_bank_name+card_last4 geliyorsa payment_method oluşturup payment_method_id bağla veya sadece subscription kolonlarına yaz. |

**Çıktı:** Yeni alanlar DB'e gidiyor.

---

### Faz 3: Form ve ödeme UI (tek ekran)

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 3.1 | Ödeme bölümünü kaldır | `SubscriptionFormPage.jsx`: Ödeme Bilgileri kartı + "Yeni Ödeme Yöntemi Ekle" + PaymentMethodFormModal kaldır. |
| 3.2 | Inline alanlar | Tip seçiminin altında: Kart → Banka adı, Son 4; Nakit → Tahsil eden (Select/Input); Havale → Opsiyonel not. |
| 3.3 | Yeni alanlar | Hizmet türü (Select), Ödeme sıklığı (Select), Resmi fatura (Toggle). |
| 3.4 | Edit'te doldur | subscription'dan yeni alanları forma reset(). |
| 3.5 | Çeviriler | `locales/tr/subscriptions.json`: yeni key'ler. |

**Çıktı:** Abonelik tek ekranda; ayrı ödeme popup yok.

---

### Faz 4: Detay ve liste

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 4.1 | Detay | `SubscriptionDetailPage.jsx`: Hizmet türü, sıklık, resmi/gayri, nakit tahsil eden, kart banka+son4. |
| 4.2 | Liste | `SubscriptionsListPage.jsx`: İsteğe bağlı kolon/filtre. |

---

### Faz 5: Ödeme kaydı – dekont no

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 5.1 | API | `paymentsApi.js` recordPayment: reference_no ekle. |
| 5.2 | Modal | `PaymentRecordModal.jsx`: Havale seçiliyse opsiyonel "Dekont no" input. |

---

### Faz 6: Excel toplu içe aktarım

| Sıra | Ne yapılacak | Nerede / nasıl |
|------|----------------|-----------------|
| 6.1 | Şablon | Kolonlar: müşteri, site, hizmet türü, başlangıç, base_price, sms_fee, line_fee, vat_rate, billing_frequency, ödeme tipi, card_bank_name, card_last4, cash_collector, official_invoice. |
| 6.2 | Import UI | Yeni sayfa veya modal: dosya seç, parse (xlsx/papaparse), önizleme, hata listesi. |
| 6.3 | Batch create | Satırlar için müşteri/site/abonelik oluştur; 50'şer veya tek seferde; hata raporu. |
| 6.4 | Paket | Gerekirse `npm install xlsx` veya `papaparse`. |

---

### Özet sıra

1. **Faz 1** → Migration yaz ve çalıştır.  
2. **Faz 2** → schema.js + api.js.  
3. **Faz 3** → SubscriptionFormPage (ödeme kaldır, inline + hizmet türü + sıklık + resmi/gayri).  
4. **Faz 4** → Detail + List.  
5. **Faz 5** → PaymentRecordModal + reference_no.  
6. **Faz 6** → Excel import.

Paraşüt API ayrı iş paketi; şimdilik `official_invoice` alanı yeterli.

---

Bu analiz, hedef dokümandaki “güncel vs hedef” ve “veri girişi + Excel” ile uyumlu; uygulama sırasında önce DB ve API, sonra form, en sonda import ve Paraşüt akışı izlenebilir.
