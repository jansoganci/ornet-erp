# Ornet ERP — Kullanıcı Kılavuzu

**Belge dili:** Türkçe  
**Hedef kitle:** Ofis personeli, dispetçerler ve saha teknisyenleri  
**Uygulama adı:** Ornet ERP  

Bu kılavuz, ekrandaki menü ve terimlerle birebir uyumludur; arayüzde gördüğünüz başlıklar (ör. **Operasyon Merkezi**, **Tahsilat Masası**, **İş Emri**) bu belgede de aynı şekilde kullanılmıştır.

---

## 1. Giriş ve gezinme

### 1.1 Yan menü (kenar çubuğu) nasıl okunur?

Sol taraftaki menü, işe göre gruplanmıştır. Sık kullanılanlar üstte; diğerleri grupların altında açılır.

| Menüde göreceğiniz ad | Kısaca ne işe yarar? |
|----------------------|------------------------|
| **Ana Sayfa** | Genel özet ve hızlı erişim |
| **Operasyon Merkezi** | Gelen taleplerin havuzu, takvim ve özet (yazma yetkisi gerekir) |
| **Müşteriler** | Müşteri ve lokasyon kayıtları |
| **İş Emirleri** | Planlanan ve yürütülen saha işleri |
| **Teklifler** | Fiyat teklifleri (yazma yetkisi gerekir) |
| **Planlama** → **İş Geçmişi** | Geçmiş iş kayıtlarına arama |
| **Gelir ve Altyapı** | **Abonelikler**, **SIM Kart Yönetimi**, fatura analizi, **Varlık Takibi** |
| **Finans** | **Finans Özeti**, **Gelirler**, **Giderler**, **KDV Raporu**, **Döviz Kurları**, **Tekrarlanan Ödemeler**, **Raporlar** (yönetici / muhasebe rolüne göre) |
| **Ayarlar** → **Malzeme Listesi** | Stok / malzeme kartları |

Mobilde alt çubukta da en sık kullanılan sayfalar kısayol olarak görünür.

**[Ekran Görüntüsü: Yan menü ve mobil alt çubuk]**

### 1.2 “Tek defter” mantığı (finansın özü)

Ornet ERP’de gelir ve giderler, raporların da dayandığı **tek bir finans kaynağında** toplanır. Abonelik tahsilatı, teklif veya iş emri tamamlanması gibi sistem olayları bu deftere uygun şekilde işlenir; siz manuel **Gelir Ekle** veya **Gider Ekle** dediğinizde de kayıtlar aynı yapıya girer. Böylece **Finans Özeti**, **KDV Raporu** ve **Kar Zarar Raporu** tutarlı kalır.

### 1.3 Hız ve güncellik

Arayüz hızlı çalışacak şekilde düzenlenmiştir; liste ve detay sayfaları birçok işlemde **anında güncellenir** (sayfayı yenilemeniz gerekmez).

> **Profesyonel İpucu:** Sık baktığınız sayfayı tarayıcıda yer imine ekleyin; **Ana Sayfa** ve **Operasyon Merkezi** günlük operasyonun kalbidir.

---

## 2. Müşteri ve lokasyon yönetimi

### 2.1 Yeni müşteri ve birden fazla lokasyon

1. **Müşteriler** menüsüne gidin.  
2. **Müşteri Ekle** ile formu açın.  
3. **Müşteri Adı**, iletişim ve adres bilgilerini doldurun.  
4. Formda **Lokasyon Bilgisi** bölümünden ilk lokasyonu ekleyebilirsiniz; bu adım isteğe bağlıdır — lokasyonları sonra **Müşteri Detayı** üzerinden de çoğaltabilirsiniz.  
5. Kaydettikten sonra müşteri kartında **Lokasyonlar** sekmesinden **Yeni Lokasyon Ekle** ile şube / adres bazlı kayıtlar ekleyin.

Her lokasyon için **Hesap No**, **Alarm Merkezi**, yetkili kişi ve telefon gibi alanlar sahadaki doğru adresleşmeyi kolaylaştırır.

**[Ekran Görüntüsü: Müşteri formu ve lokasyon alanları]**

> **Profesyonel İpucu:** Çok şubeli firmalarda iş emri ve abonelikleri her zaman doğru **Lokasyon** ile eşleştirin; liste ve tahsilatta karışıklık yaşanmaz.

### 2.2 Müşteri detayından neler takip edilir?

**Müşteri Detayı**nda sekmeler üzerinden **Genel**, **Lokasyonlar**, **İş Emirleri**, **SIM Kartlar** ve **Varlıklar** görülebilir. Özet kutularda aktif abonelikler, açık iş emirleri ve ekipman uyarıları öne çıkar.

**[Ekran Görüntüsü: Müşteri detayı — sekmeler]**

> **Profesyonel İpucu:** Telefonla müşteri ararken detay sayfasındaki **Ara** kısayolunu kullanın; iletişim bilgisi tek yerde kalır.

---

## 3. Excel ile toplu yükleme (içe aktarma)

Büyük listeleri tek tek girmek yerine **Excel ile toplu yükle** akışını kullanın (ör. **Müşteriler** listesinde **İçe Aktar**).

**Önerilen adımlar (ekrandaki “Excel ile nasıl yüklenir?” ile aynı mantık):**

1. **Şablonu indirin** — Sütun başlıklarını değiştirmeyin.  
2. **Excel’i doldurun** — Her satır bir kayıt; zorunlu hücreleri boş bırakmayın.  
3. **Dosyayı seçin** — `.xlsx` / `.xls` yükleyin; sistem önizleme gösterir.  
4. **Uyarıları kontrol edin** — Hatalı satırları Excel’de düzeltip yeniden yükleyin.  
5. **İçe aktarın** — Sonuçta **Eklenen**, **Güncellenen**, **Atlanan**, **Hatalı** özetini okuyun.

**[Ekran Görüntüsü: Excel içe aktarma — önizleme ve sonuç özeti]**

> **Profesyonel İpucu:** Önce küçük bir deneme dosyası (10–20 satır) ile test edin; canlı veriye geçmeden sütun eşlemesini doğrulayın.

---

## 4. Operasyon Merkezi (pano)

**Operasyon Merkezi**; gelen aramaları ve talepleri **Talep Havuzu**nda toplar, **Takvim** ile planı gösterir, **Özet** ile sayısal takip sunar. Buradaki kayıtlar, planlandığında **İş Emri** ile sahaya döner.

### 4.1 Talep alımı: Hızlı giriş satırı

Üstteki hızlı satırda kısa sürede kayıt açarsınız:

1. **Müşteri ara…** ile müşteriyi seçin.  
2. **Lokasyon seç…** ile şubeyi işaretleyin.  
3. **Problem açıklaması…** alanına çağrının özetini yazın.  
4. Kaydı tamamlayın; ipucu satırında **Enter ile kaydet** ifadesi yer alır — klavyeyle çok hızlı çalışmak için uygundur.

**[Ekran Görüntüsü: Operasyon Merkezi — hızlı giriş satırı]**

> **Profesyonel İpucu:** Telefonu kapatmadan önce **Enter** ile kaydedin; elinizi fareye götürmeden saniyeler içinde talep oluşur.

### 4.2 Onay ve “trafik lambası” (iletişim durumu)

Kartlarda iletişim durumu şu etiketlerle görünür (anlamları):

| Gösterge | Durum | Arayüzdeki ad | Pratik anlam |
|----------|--------|----------------|----------------|
| 🔴 | Henüz aranmadı | **Aranmadı** | Talep kaydı var, müşteriyle temas kurulmadı. |
| 🟡 | Ulaşılamadı | **Cevap Yok** | Arandı fakat yanıt alınamadı / meşgul. |
| 🟢 | Randevu / onay | **Onaylandı** | Tarih veya iş için müşteri onayı alındı. |

İsterseniz **Arama Sırası** ile sırayla arayıp, **Cevap Yok**, **Onaylandı** gibi sonuçları işaretleyebilirsiniz.

**[Ekran Görüntüsü: İletişim durumu rozetleri ve arama sırası]**

> **Profesyonel İpucu:** **Cevap Yok** kayıtlarını gün içinde tekrar **Arama Sırası**na alın; düşen talep kalmaz.

### 4.3 Planlama: **Planla** ve İş Emri

1. Havuzdaki talepte **Planla** (veya zamanlama akışı) ile tarih ve saat seçin.  
2. **İş Tipi** (ör. **Keşif**, **Montaj**, **Servis**, **Bakım**) ve gerekirse notları girin.  
3. **İş Emri Oluştur** ile talep, planlanmış bir **İş Emri**ne dönüşür; personel ataması iş emri tarafında yapılır.

**[Ekran Görüntüsü: Planlama / İş Emri Oluştur penceresi]**

> **Profesyonel İpucu:** Aynı müşteride ikinci bir iş varsa önce talebi net yazın; sahada “ne için gidildiği” tartışmasını bitirir.

### 4.4 “Bumerang” etkisi: **Başarısız** iş ve havuza dönüş

Sahada iş **Başarısız** olarak kapanabildiğinde (ör. müşteri yerinde değil, parça eksik, erişim yok), sistem bu durumu **Başarısız İş Emri** bilgisiyle kaydeder. **Yeniden Planla** veya havuza dönüş mesajıyla talep tekrar **Talep Havuzu**na alınır; böylece iş “kaybolmaz”, yeniden tarihlenir.

Deneme sayısı kartlarda **“X. deneme”** şeklinde görünebilir.

**[Ekran Görüntüsü: Başarısız iş emri ve yeniden planlama]**

> **Profesyonel İpucu:** Başarısızlık nedenini doğru seçin (ör. **Parça gerekli**); depo ve dispetçer aynı dili konuşsun.

---

## 5. Abonelik ve tekrarlayan ödemeler

### 5.1 On iki aylık ödeme ızgarası (**Ödeme Takvimi**)

**Abonelikler** menüsünden aboneliği açtığınızda **Ödeme Takvimi** bölümünde dönem dönem ödemeleri görürsünüz. Hücreler genelde tahsil durumunu gösterir; **Ödeme Sıklığı** (**Aylık**, **3 Aylık**, **6 Aylık**, **Yıllık**) faturanın kaç ayda bir yenileneceğini belirler.

**[Ekran Görüntüsü: Abonelik detayı — Ödeme Takvimi]**

> **Profesyonel İpucu:** Şüpheli tutarda önce abonelikteki **KDV Oranı (%)** ve satır tutarlarını kontrol edin; tutarlar net / KDV ayrımına göre tanımlıdır.

### 5.2 Tahsilat Masası ile hızlı tahsilat

**Abonelikler** içinde **Tahsilat Masası** sekmesi (veya menüden **Tahsilat Masası**), bekleyen dönem ödemelerini listeler. **Bekleyen**, **Gecikmiş**, **Tahsil Edilmiş** özetleri üstte yer alır. Satırda **Öde** ile tahsilatı işlersiniz; gerekirse **Aboneliğe Git** ile detaya geçersiniz.

**[Ekran Görüntüsü: Tahsilat Masası — liste ve Öde]**

> **Profesyonel İpucu:** Müşteri adıyla **Müşteri ara…** filtresini kullanın; telefonla tahsilat sırasında ekranı kaydırma süresi kısalır.

### 5.3 SIM kart ve abonelik bağlantısı

**SIM Kart Yönetimi**nde hatlar **Boşta**, **Abonelik**, **İptal Edildi** gibi durumlarda izlenir. Abonelik formunda SIM ilişkilendirildiğinde, abonelik yaşam döngüsüyle uyum için durumlar senkronize olabilir (ör. iptal / duraklama sonrası hattın güncellenmesi).

**[Ekran Görüntüsü: Abonelik — SIM ataması ve SIM listesi durumu]**

> **Profesyonel İpucu:** Hangi hattın hangi lokasyonda olduğunu **Lokasyon** ve **Hesap No** ile eşleştirin; saha ve muhasebe aynı numarayı kastediyor olur.

---

## 6. Finans ve muhasebe kullanımı

### 6.1 Manuel gelir ve gider

- **Gelirler** ve **Giderler** sayfalarında **Gelir Ekle** / **Gider Ekle** kullanılır.  
- Gider tarafında tutarlar **Net Tutar (KDV Hariç)** olarak girilir; **Faturalı** işaretlendiğinde **KDV Oranı (%)** ile vergi hesaplanır.  
- Gelirde **Para Birimi** ve gerektiğinde **Döviz Kuru** ile **Tutar (TRY)** tutarlılığı sağlanır.

**[Ekran Görüntüsü: Gelir Ekle / Gider Ekle formları]**

> **Profesyonel İpucu:** **Finans Özeti**nde **Hızlı Giriş** ile tek ekrandan gelir/gider açın; günlük kasa işlerinde süreyi kısaltır.

### 6.2 KDV ve döviz

- **KDV Raporu**: **Çıktı KDV**, **Girdi KDV** ve **Net KDV Ödenecek** özetini dönem seçerek görürsünüz.  
- **Döviz Kurları**: **TCMB'den Getir** ile güncel kur çekilebilir veya **Kur Ekle** ile manuel girilebilir.

**[Ekran Görüntüsü: KDV Raporu ve Döviz Kurları]**

> **Profesyonel İpucu:** Dövizli gelir girdiğiniz günün kurunu kaydedin; ay sonu **Kar Zarar Raporu**nda sapma olmaz.

### 6.3 Tekrarlanan ödemeler (kira, maaş vb.)

**Tekrarlanan Ödemeler** bölümünde düzenli gider şablonları tanımlanır; **Kira**, **Personel Maaşı**, **Elektrik / Su / Doğalgaz** gibi hazır gider kategorileri listeden seçilebilir. Kayıtlar **Tekrarlayan** etiketiyle izlenir.

**[Ekran Görüntüsü: Tekrarlanan Ödemeler listesi ve şablon]**

> **Profesyonel İpucu:** Aynı ödemeyi her ay tek tek girmek yerine şablonlayın; unutulan gider riski azalır.

---

## 7. Saha operasyonları (mobil ve günlük iş)

### 7.1 Günlük İşler (**Günlük İş Listesi**)

**Günlük İşler** sayfası (**Günlük İş Listesi**), seçilen güne göre planlanmış **İş Emirleri**ni listeler. **Tarih Seçin**, **Personel Filtresi** ve hafta ileri/geri kısayolları ile sahayı daraltırsınız. Tabloda **İş Tipi**, **Müşteri / Lokasyon**, **Saat** ve **Durum** görünür.

**[Ekran Görüntüsü: Günlük İşler — liste ve tarih seçimi]**

### 7.2 İşi tamamlamak: durum, notlar, malzeme

Teknisyen, ilgili **İş Emri Detayı**na giderek:

- **Durum Güncelle** ile **Bekliyor** → **Planlandı** → **Devam Ediyor** → **Tamamlandı** akışını işletir.  
- **Notlar** alanına saha gözlemlerini yazar.  
- **Kullanılan Malzemeler** bölümünde malzeme satırlarını kaydeder.

Uygulama şu an için iş emrine doğrudan **fotoğraf dosyası yükleme** alanı sunmuyorsa, kritik görselleri şirket politikasına uygun şekilde (ör. WhatsApp / kurumsal depolama) arşivleyip **Notlar**a referans eklemek pratik bir yöntemdir.

**[Ekran Görüntüsü: İş Emri Detayı — durum, notlar, malzemeler]**

> **Profesyonel İpucu:** İşi **Tamamlandı** yapmadan önce malzeme satırlarını kontrol edin; stok ve maliyet raporları doğrudan bu kayıtlara dayanır.

---

## 8. Kısa terim sözlüğü (arayüzle aynı adlar)

| Terim | Kullanım yeri |
|--------|----------------|
| **Müşteri** | Firma / cari kaydı |
| **Lokasyon** | Şube veya adres bazlı kayıt |
| **İş Emri** | Planlanan saha işi |
| **Operasyon Merkezi** | Talep havuzu ve planlama |
| **Talep Havuzu** | Henüz sahaya tam bağlanmamış talepler |
| **Tahsilat Masası** | Bekleyen abonelik ödemeleri |
| **Abonelik** | Dönemsel sözleşme ve ödemeler |
| **Ödeme Takvimi** | Abonelik ödeme ızgarası |
| **SIM Kart Yönetimi** | Hat envanteri |
| **Finans Özeti** | Mali özet panosu |
| **KDV Raporu** | KDV özet raporu |
| **Döviz Kurları** | Kur tablosu |
| **Tekrarlanan Ödemeler** | Düzenli gider şablonları |
| **Günlük İşler** | Günlük iş listesi ekranı |

---

## 9. Destek ve güvenlik

- Oturumunuzu paylaşmayın; **Çıkış Yap** ile ortak PC’lerde kapatın.  
- Yetkiniz olmayan menüleri göremez veya düzenleyemezsiniz; bu normaldir.  
- Liste boşsa veya hata mesajı alırsanız **Yenile** veya **Tekrar Dene** kullanın.

---

*Bu belge son kullanıcı akışlarını anlatır; teknik kurulum veya veritabanı yönetimi konularını kapsamaz.*
