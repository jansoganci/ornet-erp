# Abonelikler: Güncel Sistem vs Hedef Sistem

Bu dokümanda mevcut abonelik yapısı ile hedeflenen yapı madde madde karşılaştırılmaktadır. Eksik kalmaması ve geri bildirime hazırlık için kullanılabilir.

---

## 1. Güncel Sistem (Şu An Ney Var?)

### 1.1 Müşteri / Lokasyon
- Müşteri (customers) ve lokasyon (customer_sites) bilgisi tutuluyor.
- Abonelik **lokasyon (site)** bazında: Her site için bir aktif abonelik.

### 1.2 Abonelik Tipi (Nasıl Tahsil?)
- **Kart (Otomatik)** – `recurring_card`
- **Nakit** – `manual_cash`
- **Banka Transferi** – `manual_bank`
- (Veritabanında `annual` ve `internet_only` tipleri tanımlı ama arayüzden kaldırıldı.)

### 1.3 Ödeme Bilgileri (Ayrı Bölüm)
- Ayrı bir **“Ödeme Bilgileri”** bölümü var.
- **Ödeme yöntemi** dropdown: Müşteriye kayıtlı ödeme yöntemlerinden biri seçiliyor.
- **“Yeni Ödeme Yöntemi Ekle”** butonu: Popup açılıyor; kart (son 4, marka, kart sahibi, son kullanma), banka (banka adı, IBAN) veya nakit (etiket) giriliyor.
- Bu kayıtlar `payment_methods` tablosunda müşteriye bağlı tutuluyor; abonelik `payment_method_id` ile bir tanesine bağlanıyor.
- Kart seçiliyken “ödeme yöntemi” zorunlu; nakit/havale için opsiyonel.

### 1.4 Abonelikte Tutulan Diğer Bilgiler
- Başlangıç tarihi, fatura günü (ayın kaçı).
- Fiyatlandırma: Temel fiyat, SMS ücreti, hat ücreti, KDV oranı, maliyet (admin), para birimi.
- Satışı yapan (sold_by), yöneteni (managed_by).
- Notlar, kurulum notları.
- Durum: aktif / duraklatıldı / iptal.

### 1.5 Sistem / Hizmet Türü
- **Yok.** Müşteriye ne sattığınız (sadece alarm, sadece kamera, alarm+kamera, alarm+kamera+internet vb.) girilmiyor.
- Eski tipler “sadece internet” ve “yıllık” formdan kaldırıldı; ayrı bir “hizmet türü” alanı yok.

### 1.6 Ödeme Sıklığı (Aylık / Yıllık)
- **Arayüzde yok.** Sadece aylık 12 dönem için ödeme kaydı üretiliyor.
- Veritabanında “yıllık” (annual) tipi ve tek yıllık ödeme kaydı üreten mantık var ama formda “Yıllık” seçeneği kaldırıldı.
- Yani “bu müşteri aylık mı yıllık mı ödüyor?” bilgisi kullanıcıya tek alandan girilmiyor.

### 1.7 KDV / Fatura / Gayri Resmi Belge
- Abonelikte **KDV oranı** var (varsayılan %20).
- Ödeme kaydı girilirken: Fatura no, fatura tipi (e-fatura, e-arşiv), KDV oranı, “fatura kesilsin mi?” seçenekleri var.
- **Gayri resmi belge** (belge türü / müşteri tercihi) ayrıca tutulmuyor; “kredi kartı hariç soracağız” ihtiyacı karşılanmıyor.

### 1.8 Nakit Tahsilat
- Sadece abonelik tipi “Nakit” seçiliyor.
- **Nakit tahsil eden kişi** (kim aldı) bilgisi tutulmuyor.

### 1.9 Havale
- “Banka transferi” tipi var.
- Müşteri IBAN’ı `payment_methods` üzerinden (opsiyonel) girilebiliyor.
- Sizin ihtiyacınız: Müşteri sizin IBAN’ınıza atıyor; müşteri IBAN’ı tutmaya gerek yok – bu net değil tek ekrandan.

### 1.10 Özet (Güncel)
- Tahsil şekli: Kart / Nakit / Banka seçiliyor; kart için ayrıca “ödeme yöntemi” ayrı bölümde seçiliyor veya yeni ekleniyor.
- Ödeme bilgisi: Ayrı bölüm + popup; tek ekrandan “nasıl ödüyor + detay” girilmiyor.
- Müşteriye ne sattığımız (alarm, kamera, internet kombinasyonu) yok.
- Aylık / yıllık ödeme ayrımı formda yok.
- Nakit tahsil eden kişi yok; gayri resmi belge tercihi yok; havale için “müşteri IBAN’ı gerekmez” tek ekranda net değil.

---

## 2. Hedef Sistem (Neyi Amaçlıyoruz?)

### 2.1 Tahsil Şeklini Tek Yerden Takip (CRM)
- **Amaç:** Sisteme girip “bu nakit ödüyor, bu havale atıyor, bu kredi kartıyla ödüyor” bilgisini tek yerden görebilmek ve takip edebilmek.
- Kart tahsilatı ileride **iyzico** ile otomatiklenecek; şimdilik “kredi kartıyla ödüyor” bilgisi ve gerekirse referans bilgisi (son 4, marka vb.) tutulacak.
- Bu bilgi **ayrı bir “Ödeme Bilgileri” bölümü veya popup olmadan**, abonelik tipinin seçildiği tek ekranda, tip seçiminin hemen altında girilebilsin.

### 2.2 Ödeme Bilgisi: Tek Yer, Tip Bazlı
- **Kart:** Aynı ekranda (abonelik detayında) kart referans bilgisi (son 4, marka, kart sahibi vb.); ayrı bölüm/popup yok. İleride iyzico entegrasyonu ayrı yapılacak.
- **Nakit:** Sadece **“Nakit tahsil eden”** (kim tahsil ediyor – personel veya isim) bilgisi.
- **Havale:** Müşteri sizin IBAN’ınıza atıyor; müşteri IBAN’ı tutulmayacak. Sadece “havale ile ödüyor” bilgisi; istenirse kısa not.

### 2.3 Müşteri Bilgileri (Zaten + Ek)
- Müşteri ve lokasyon bilgisi tutulmaya devam.
- **KDV:** Müşteri KDV’li mi KDV’siz mi – tutulacak.
- **Gayri resmi belge:** Kredi kartı hariç diğer ödemelerde müşteriye sorulacak; cevap (istemiyor / istiyor / vb.) tutulacak.

### 2.4 Müşteriye Ne Sattığımız (Sistem / Hizmet Türü)
- **Amaç:** Abonelikte “bu lokasyonda ne var?” bilgisini girebilmek.
- Olası türler (netleştirilecek):
  - Sadece alarm
  - Sadece kamera
  - Sadece internet
  - Alarm + kamera
  - Alarm + kamera + internet
  - İleride başka türler
- Bu bilgi raporlama ve CRM için kullanılacak (“bunda sadece alarm var, bunda alarm + kamera + internet var”).

### 2.5 Ödeme Sıklığı (Aylık / Yıllık)
- **Amaç:** Bazı müşteriler aylık, bazıları yıllık ödüyor; bunu ayrı bir alanla tutmak.
- Abonelikte “Ödeme sıklığı: Aylık / Yıllık” gibi net bir alan olacak; faturalama ve ödeme kayıtları buna göre (aylık 12 dönem veya yıllık 1 dönem) üretilebilecek.

### 2.6 Özet (Hedef)
- Tahsil: Kart / Nakit / Havale tek ekranda; detay (kart referansı, nakit tahsil eden, havale notu) aynı yerde, tip bazlı.
- CRM: Kim nakit, kim havale, kim kart – sistem üzerinden takip.
- Müşteriye ne sattığımız: Alarm / kamera / internet kombinasyonu abonelikte.
- Aylık / yıllık ödeme sıklığı ayrı alan.
- KDV ve gayri resmi belge tercihi tutulacak; nakit için “kim tahsil ediyor” tutulacak.

---

## 3. Karşılaştırma Özeti

| Konu | Güncel | Hedef |
|------|--------|--------|
| Tahsil şekli (kart/nakit/havale) | Var (abonelik tipi) | Aynı; tek ekranda kalacak |
| Ödeme detayı (kart ref, nakit eden, havale) | Ayrı “Ödeme Bilgileri” + popup | Tip seçiminin hemen altında, tek ekranda |
| Müşteri IBAN (havale) | Opsiyonel payment_methods’ta | Tutulmayacak; müşteri bize atıyor |
| Nakit tahsil eden | Yok | Var (personel/isim) |
| Alarm/kamera/internet türü | Yok | Var (abonelikte hizmet türü) |
| Aylık / yıllık ödeme | Formda yok (DB’de annual mantığı var) | Net alan: aylık / yıllık |
| KDV | Var | Aynı + müşteri KDV tercihi net |
| Gayri resmi belge | Yok | Var (kart hariç müşteri tercihi) |
| Kart tahsil | Manuel; referans bilgisi ayrı bölümde | iyzico’ya geçiş hedefli; referans tek ekranda |

---

## 4. Veri Girişi ve Toplu Açma

### 4.1 Mevcut Veriyi Sisteme Alma (Excel ile Toplu İçe Aktarım)
- **Durum:** ~350–400 müşteri, mevcut ödemeler yaklaşık aylık 30-40bin ₺ civarında; bu veriyi sisteme tek seferde almak gerekiyor.
- **Hedef:** Excel üzerinden **toplu içe aktarım** (import). Excel’de kolonlar tanımlanacak; dosyayı yükleyince müşteri / lokasyon / abonelik (ve gerekirse ödeme kayıtları) otomatik oluşturulacak.
- Böylece mevcut ödemeler ve müşteri seti tek hamlede içeri alınacak; sonrasında günlük işler yeni form ve raporlarla devam edecek.

### 4.2 Günlük Kullanım İçin Rahat Veri Girişi (Form)
Tek ekranda, dropdown’lar ve net alanlarla girilebilsin:

| Alan | Açıklama |
|------|----------|
| **Hizmet türü** | Dropdown: Aylık kiralık alarm, aylık kiralık kamera, aylık kiralık internet, alarm+kamera, alarm+kamera+internet vb. (tek tıkla seçim). |
| **Başlangıç tarihi** | Tarih alanı. |
| **Fiyatlandırma** | Temel fiyat (base_price), SMS ücreti (sms_fee), hat ücreti (line_fee) – mevcut üç alan aynen kalacak; toplam buna göre hesaplanacak. |
| **KDV** | KDV oranı girilsin ve gösterilsin; mevcut yapıdaki gibi kalsın. |
| **Ödeme tipi** | Dropdown: Kredi kartı / Nakit / Havale. |
| **Kredi kartı seçiliyse** | **Banka adı** + **Son 4 hane** (kart sahibi adı yerine banka adı; karşılaştırma için son 4 önemli). Kart sahibi bilgisi zaten iyzico tarafında olacak. |
| **Nakit seçiliyse** | **Tahsil edecek kişi** – dropdown veya seçim (personel listesinden veya serbest metin). |
| **Havale seçiliyse** | Abonelik kurulumunda ekstra zorunlu alan yok; müşteri sizin IBAN’ınıza atıyor. İstenirse **dekont no** veya referans no, **ödeme kaydı** girerken (tahsilatı işlerken) opsiyonel girilebilir – böylece “bu ayki havale dekontu şu” diye takip edilir. |

### 4.3 Fatura: Resmi / Gayri Resmi (Toggle)
- **Resmi (aktif):** Fatura kesilecek ve **Paraşüt**’e API ile iletilecek. Resmi muhasebe / e-fatura tarafında görünsün.
- **Gayri resmi (inaktif):** Sadece bu CRM’deki finansal takipte kalsın; Paraşüt’e gönderilmesin, resmi fatura kesilmesin. İç raporlama ve tahsilat takibi için kullanılsın.
- Formda tek bir **toggle** (açık/kapalı veya “Resmi fatura / Gayri resmi”) ile seçilebilsin; ilk toplu açmada da Excel’de bu bilgi kolon olarak gelebilir.

### 4.4 Havale İçin Kısa Özet
- **Abonelik oluştururken:** Sadece “Havale ile ödüyor” seçimi yeterli; müşteri IBAN’ı veya dekont alanı zorunlu değil.
- **Ödeme kaydı girerken (aylık tahsilatı işlerken):** İstenirse **dekont no** veya açıklama opsiyonel girilebilir; “bu ayki havale şu dekontla geldi” takibi yapılabilir. Zorunlu değil.

---

## 5. Sonraki Adım

Bu dokümanı inceleyip eksik veya yanlış gördüğünüz maddeleri not edebilirsiniz. Geri bildirimle birlikte hedef sistem netleşince uygulama adımları (Excel şablonu, import akışı, form alanları, veritabanı, Paraşüt API) ayrıca planlanabilir.
