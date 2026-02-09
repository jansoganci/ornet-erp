# Şirket Yönetim Sistemi — Problemler ve Çözüm Taslağı

Bu doküman, Excel tabanlı mevcut iş süreçlerinden web tabanlı tek bir yönetim sistemine geçiş için toplanan problemler, hedefler ve teknik kararları içerir.

Hey, seninle beraber oturup birazcık soru cevap yapmamız lazım. İlk olarak şöyle, dayımın işlerini devralacağım. Onun işlerini devralabilmem için de bir tane sistem inşa etmem lazım. Bu sistemde de şirketi yöneteceğim. Şirketi yönetmek için de şu an bütün işler Excel üzerinde ve saçma sapan bir sistem kurmuş dayım. Yani o sistemi kullanabilecek pozisyonda ve şeyde değilim, burada da değilim ve gereksiz yere gereksiz şekilde işleri kontrol etmeye çalışıyor. Yani bir iş yaptığında o iş hatalıysa başka bir yerde ortaya çıkıyor ama Excel'lar arası çok dolaşıyor ve atıyorum iki saatte halledecek işler dört saatte beş saatte hallediliyor. Bunları bir yapıya geçirip tüm şirketi bu sistem üzerinden yönetmek, otomatikman finansallarını, raporlamalarını, işte müşteri kayıtlarını oluşturulması, müşterilerin yönetilmesi, operasyonların yönetilmesi ve işte sistem satın alma, işte alarm, her türlü alarm sistemi satıyor ya da kiralıyor işte bu süreçlerin yönetilmesi, montajların servis ekiplerinin yönetilmesi vesaire bu sistemin üzerine almayı düşünüyorum. Kafamda bir sürü şey var, yapı var. Bunu nasıl sana tam olarak aktarabilirim açıkçası bilmiyorum ama tek tek sana mesajlar ileteceğim. Sen de bana web-based bir app kurma konusunda bir uzman gibi düşünüp yardım edeceksin. Şimdi bu sistemin bir ön taslağını kuracağız. Daha yeni çalışmaya başladım. Yapılacak bir sürü iş var. Bilmediğim bir sürü konu var. Ama şu an bir ön taslak hazırlamak istiyorum. Belki bir tane çok ufak bir prototip hazırlamak istiyorum. Durum bu şekilde. Benimle konuşmaya şimdi hazır mısın? Bir strateji belirleyelim, kendine bir görev tanımla hatta bu konuda hani tam olarak nasıl bir görev tanımı verilebilir bilemiyorum ama belki bir solution architect olarak çalışabilirsin. Hani o mimarlı, o psikolojide. Diyeceklerim şimdilik bu kadar.

Şimdi ilk olarak bu iş kesinlikle otomatikleşmeli dediğim ilk üç ana süreç nedir demişsin. Müşterilerin şimdi servis formları ve montaj formları var. Bunları manuel bir şekilde bir sisteme giriyoruz. Excel'e giriyoruz sistem diyorsan Excel'dir şu an. Sistem falan yok şu an. Bunların hepsini Excel'e giriyoruz tamam mı? Yarın öbür gün belki iki sene sonra müşteri arıyor diyor ki böyle böyle böyle böyle bir durum vardı. Siz bana yardım etmediniz falan filan. Ağlayıp zırlıyor. İşte bir şekilde bize kitlemeye çalışıyor. Biz de burada geriye dönüp o Excel'e bakıyoruz. O Excel'de de belki var 10 tane, 15 tane sayfa. İşte zaman yıla göre ayrılıyor, aylara göre ayrılıyor. Yani çok şey komplike bir hale gelmiş durumda. ve yönetilmesi pek kolay değil. Şimdi biz burada ne yapmak istiyorum? Müşterilerin servis kayıtlarını tuttuğum bir tane ekran olmalı. Bir tane sistem olmalı. Bu birinci ihtiyacım. Müşterilerin işte servisi montajları burada tutacağım. İşte nerede, ne kadar para harcanmış, şey işte ne kadar tutar yazmışız. Müşterinin ismi, adresi, neler yapılmış, ne zaman yapılmış işte ekran numaraları var. Onlar girilmesi lazım. Zaman çok önemli. Hangi saat? Bir sürü farklı farklı detaylar var. Onları da ileteceğim sana. İşte montaj mı, servis mi, başka bir şey mi? Hangi malzemeler kullanıldı montajsa? Eğer montajsa o montajın mesela şeyini de eklememiz lazım. Teklifini de o adama eklememiz lazım. Gibi gibi bir sürü problem var. Bu ilk aklına gelen süreç.

İkinci benim gördüğüm büyük problemse işin finans tarafında. Şu an mesela dayımın aylık aboneleri var, kiraladıklar. Bu kiraladıkların bir kısmı kredi kartından kesiliyor, bir kısmı elden alınıyor falan filan. Bir kısmı hesaba gönderiyormuş, dayıma havale yapıyormuş. Bir sürü osduruktan bir ayrım var. Bunların hepsini biz manuel yapıyoruz. Yani mesela abonelik sistemi yok. Abonelik sistemi var ama abonelik sistemi şöyle yok. Bir otomatik bir yapı yok. Yani ben garantinin posu varmış. Garanti bir şey pos diye geçiyor. İnternetten bizim elimizde şu an müşterilerin kredi kartı bilgileri var. Kredi kartının numaraları, kredi kartı işte son kullanma tarihleri ve CCV'leri. Oradan biz otomatik çat çat çat çat çat paraları çekiyoruz. Daha sonrasında fatura gönderiyoruz ilgili kişilere. Şimdi bu durum var 400 tane abonelik. 400 tane abonenin 200-250 tanesini bu sistemle gönderiyoruz. Falan onları da elden alıyoruz. Elden alanlarda bir problem yok. Onlara faturalarını yine manuel kesiyoruz. O noktada bir problem var. Ama bu şeyi ben yapıyı otomatik sisteme çevirmek istiyorum. Yani böyle Easyco gibi. Artık nasıl bir aracı bir şeyle üçüncü parti bir şirketle çalışırız bilmiyorum. Kullanıcıların abonelik sistemlerini şey üzerinden yürütmek istiyorum. Çünkü oturup da ben 250 için kredi kartı bilgisini elimde tutmak istemiyorum. İkincisi manuel olarak kredi kartını gir, son kullanma tarihini gir, ismi gir, parayı gir vesaire vesaire. Yani hataya çok açık bir sistem. Aynı zamanda otomatik değil. Tüm bu ödeme sistemleri ödemeler bittikten sonra ben bir de gidiyorum. Paraşüt üzerine. Faturalarını oluşturuyorum. Kira faturalarını, birisinin ürün satmışız, işte montaj yapmışız, satış faturasını oluşturuyorum. Bunların aslında zaten ciddi ise paraşütün apisi var. API üzerinden şak diye paraşüte gitmedi. Hop paraşütün şeyinde sistemde fatura oluşmalı diye düşünüyorum. ikinci bu yani hem ödeme alma, aboneliklerin ödemesini alınması hem de fatura yönetim problemi. Sürekli fatura kesmek zorunda kalıyorum. ya da bize gelen bize kesilen faturaları tek tek incelemek zorunda kalıyorum. Çünkü bizim sistemimizde tuttuğumuz ürün isimleriyle bize gelen ürün isimleri işte atıyorum A şirketinden 10 kalem ürün almışız. 10 kalem ürünün bir fiki ismi başka, onların fatura yazdığı isim başka. Böyle olunca da bütün ürünleri tek tek kontrol etmemiz gerekiyor. Fiyatlarını kontrol etmemiz gerekiyor. Hani hata olmuş mu? Bize işte yanlış ürün göndermişler mi, fazla fiyat yazmışlar mı falan filan diyor. Ama aslında bunların hepsini bir şekilde kontrol edebiliriz internet şeyden sistem üzerinden işte bir mapping koyarız. Bizdeki ürün isimleri, aslında tedarikçilerdeki ürün isimleri hani onlara göre bir kontrol şeması yapıp hani mesela bunu da otomatize edebiliriz. Bu da bence bir büyük bir problem. Bu anlattığım yapı ikinci problem. Şimdi burası Türkiye olduğu için her şey legal olarak yani ödemeler şunlar bunlar tam olarak alınmıyor. Mesela dayımın 28 tane tuttuğu farklı kasa var. Bir tanesi kredi kartı için. Kredi kartından para çekiyoruz demiştim ya. Onun için bir kasa tutuyor. Bir kasayı cash nakit için tutuyor. Bir kasayı elden aldıkları için tutuyor. Bir kasayı genel manada şirketin kasası olarak tutuyor. Bir kasayı kendi kişisel kasası, bir kasayı emeklilik kasası işte emeklilik için ayda para kasası. Hadi o kişisel onu kendi telefonundan şuradan buradan bir yerden yönetir ama işte böyle bir beş altı tane şirkete ait yani şirketin finansalını çevirdiği şeyler var, kasalar var. Bu kasaları da mesela bir şekilde bu ikinci adımda konuşup bir tecrübe yani böyle filtre edirmemiz lazım bu gerçekler. Onu demek istedim.

Şimdilik şu ana kadar gördüğüm üçüncü büyük problem ise elimizde bir sürü yapılacak iş var. Bir sürü yapılacak iş var. Ve sürekli bu yapılacak işlerin notlarını alırız. Ama bu notları doğru düzgün göremiyoruz. Çünkü yapılacak iş çok olduğu için arada işte şeyler oluyor. Kaçaklar oluyor. İşte o işler atlanmış, şu kişiyi aramamışız falan filan. Ya da şu servise gideceğiz demişiz, gitmemişiz. Gibi gibi bir sürü problem oluyor. Aynı zamanda şimdi bir servise de gidiyoruz. Bir servis formu yazılıyor. İşte montaj formu yazılıyor. Ben de istiyorum ki bir tane sistem yapalım. Servis formu, işte montaj formu kalksın. Onun yerine bu sistem üzerine kişi, yani daha doğrusu bizim servis elemanlarımız, gitsin şey, o dokümanı doldursun. O dokümanı doldurunca ne olacak? Otomatikman bizim sistemimize artık o servis formu işlenmiş olacak. Servis formumuz bizim artık dijitalde durmuş olacak. Ve sisteme entegre etmiş olacağız. Böylelikle kolaylıkla o günlerde ne yapıldı, hangi işler bitti, tamamlandı. İşte bizim o listemizde olacak demiştim ya, yapılacak işlerin listesi. Orada hangileri tamamlanmalı. Ve müşterilerin adresine göre mesela daha sonraki günlerde ben buraya işte şu günü planla, bu günü planla gibi şeyler koyabilirim hani günlük servis veyahut da günlük montaj ekipleri için programda bu şekilde kolaylıkla hazırlayabilir mi? Bu şekilde artık bizim işlerimiz, açık olan işler, kapanmış işler sistemsel olarak daha kolay yönetilebilir olur. Bunu bilmiyorum anlatabildim mi. Bu ikinci problemle ilgili aklıma bir şey geldi. İkinci problemimiz şöyle bir problem. Bu otomatikman banka hesabına geliyor. İşte bizim yaptığımız ödemelerin bir kısmını kişisel kredi kartıyla yapıyoruz. Yine dayımın üzerine. Şimdi bu şirkete gelen paralar da var. Dayımın kendi hayatı için kendi yaşam için kullandığı paralar da var. Yani buradaki bu finans yönetimini de bir şekilde oturtmamız lazım. Mesela kredi kartı ekstrelerini yüklediğimizde veya da bankaya aylık dökümünü yüklediğimizde bize bizim şirket için yaptığımız harcamaları şeye bir şekilde işleyebilmemiz lazım sisteme. Anlatabiliyor muyum? Bunları böyle daha otomatikleştirmemiz lazım. Nasıl yapabiliriz bunu? İşte kelime gruplarıyla yakalayabiliriz. Onlar için de belki bir mapping falan filan kurabiliriz. İkinci problem içinde aklıma gelen hani çözüm falan filan bu. Şimdi sen üç tane ana problem verdin. En çok gördüğün şu ana kadar bunlara bir oturup şey yapalım konuşalım. Öncelikle sen bana fikirlerini beğen etmeden önce benim ne dediğimi, neler anlattığımı bana düzgünce bir listelemeni istiyorum. Ardından oturup konuşuruz.

;Evet, yapı doğru ama aklıma geldikçe de bazı şeyleri söyleyeceğim. Bak şimdi unuttum yine notlarımı kontrol edeyim. Mesela teklif yönetimi çok kötü. Teklifler müşterinin sisteminden öğreniyoruz. Müşterinin sisteminden servis takibi yapan arkadaşlarımı özellikle montaj mesela montajları takip etmeye çalışıyoruz. Montajı doğru mu iş yapmış, yanlış mı iş yapmış, eksik iş yapmış mı? İşte şeyin montaj yapan ekibin yorumlarını okuyoruz. Bazen işler bitmiyor, yarım kalıyor meclise ve kartın ötürü. Onların notlarını sisteme giriyoruz. Mesela takip için onları kullanıyoruz. Şimdi buradan teklif için önce teklifi buluyorsunuz. Sonra sistem bakın neler yapılmış, neler yapılmamış kontrol ediyorsun. Kağıtla exeli teklifi. Ondan sonra bunu ayrı bir Excelde de ekranla şey giriyorsun, tarih giriyorsun, tarih işte account numarası bu müşterinin account numarası. Servisi kim yaptı? İşte montaj mı, servis mi veyahut da başka bir şey mi. Onun bilgisini giriyorsun. Açıklamayı giriyorsun, bir de kullanılan malzemeleri giriyorsun. Böyle bir yapı var. Aynı zamanda her şey Excel'de yönetildiği için de bu teklifler de bittiği zaman montaj tamamlandığı zaman o Excel'i o dosyadan alıp açık işlerden alıp tamamlanmış işlere geçirmemiz gerekiyor teklifi. Şimdi bunu bazen unutuyoruz falan filan. Sanki işte 2006-2021 Ocak ayında açık işler gözüküyor. Aslında şu an hepsi bitti. Hepsinin montajını yaptık. Planladığımız bütün şeylere çok şükür yaptık ama hala açık işler gözüküyor. Mesela bunun yönetimini de kolaylaştırmamız lazım. Bu da bir problem. Tabi buradan sonra mesela iş bitti, montajı tamamladık, faturasını keseceğiz. Önce giriyoruz sisteme. Bizim işte Excellerden müşterinin teklifini buluyoruz. O tekliften dolar her şey dolar üzerinden şirkette hesaplanıyor. Çünkü bütün satın aldığımız her şey dolara bağlı. Ondan sonra bunları TL hesaplıyoruz, TL'sini hesaplıyoruz kalem kalem. Ardından bunların hepsini paraşüte giriyoruz. Paraşütle de faturayı oluşturup buradan şeye gönderiyoruz. İşte müşteriye gönderiyoruz. Mesela böyle bir şey var. Daha sonrasında da bu gönderdik ya bunu kasa defteri var. aylık tutulan kasa defterine giriyoruz. En sonunda da ay sonuna doğru da kasa defterine girilendirip gerçekten kasayı işliyoruz. Yani kaç tane adım hepsi manuel yapılıyor, hepsini bir kişi yapıyor. Öyle olunca da şu an şirket büyüyemiyor, şirket yönetilemiyor. Anladın mı?

Bir garip durumda mesela işte bizim satın aldığımız tedarikçilerden bize ekstralar şeyler geliyor. Faturalar, fişler geliyor. Hepsi paraşüt gibi uygulamanın üzerine e-fatura göndermiyor. Şimdi mesela o gelenleri telefondan uygulamanın içerisine geçişi şey görsek, oradan OCR ile tarasak, bu bir satın alma şeyiyse önceden onlara girsek, işte bu bir satın alma şeydi, bu bir faturadır, bu bir vergi makbuzudur işte gibi gibi gibi. Ya da bu sadece bir fiştir. Bu sayede işte satın alma fişler stoklara gireriz onu. Faturaysa fatura klasmanında listeleriz. Ve finansallara ödemeleri o şekilde atarız. Vergisi vergi olarak atarız. Hani böyle bir şey yapmamız mümkün mü acaba? Aklıma bu geliyor. Veyahut da böyle ekstra kredi kartı ekstrası şu hani son ödeme tarihi olanların uygulamada mesela şey uyarısını istiyorum. Uyarı vermesini istiyorum. Son ödeme tarihi geldi gibi ya da son ödeme tarihi bu ya da son ödeme tarihine bir hafta kaldı gibi. Çünkü işte bu tarz hani böyle son ödeme tarihi olanları uyarmasını söyledim sana. Oosayara söyledim, fatura fiş yönetimi için. Ödeme takipleri ile ilgili zaten konuştuk. Ha mesela arada şu an o kadar çok manuel işlem olduğu için arada ödeme almadığımız insanlar varmış. Bunu fark ettik. Arada kiralamasını başlattığımız zaman kiralama parası vermeyen bir kişiyi fark ettik. Heriften üç ayda para almamışız. Denememişiz bile atlamışız. İbi gibi. Hani yani adama kiraladığımız sistemi satıyoruz çünkü Excel'e girmemişiz bu rafin işlemi, tamam mı? Daha sonrasında ortaya çıktı. Yani böyle bir garip bir olay var. Bir de bu arada dayım sim kart alıyor. Turkcell'den mesela çok ucuza tanıdığı sayesinde. O sim kartları dışarıya kiralıyor. Buradan da bir gelir elde ediyor. Kiralarken de o sim kartların bir sürü işte sim kartı açma, kapama, uzaktan resetleme, ekstra hak alma, şunu bunu falan filan. Hemen hemen her şeyini kontrol edebiliyor. Hani onun yönetiminde mesela şu an sıkıntılı. Her şey manuel olduğu için o da manuel. Hani onu da otomatikleştirmemiz lazım. Sim kart yönetim servisi kullanmamız lazım atıyorum. Şirketin bu şeyin içinde uygulama içerisinde. Herhalde uygulama gibi bir şey yapacağız değil mi? Bir de bütün dediğim gibi gelen faturaların bir kısmı TL, bir kısmı dolar oluyor. Ama bizim sistem yani bizim şirketin hepsi dolar üzerinden hesaplanıyor. En son fatura kesim tarihinde TL'ye dönüyoruz. İş bitim bittiği tarihte. Yani çevrede de bir kur dönüşümü olması lazım. Anlık kuru çekiyor olabilmemiz lazım. Bu da önemli bir kriter bence.



---

## 0. Hedefler ve Nasıl Yardım Ediyorum

### Hedefler (öncelik sırasıyla)

1. **Modüler sistem** — Dokümanlar ve kod modül modül; her konu kendi dosyasında, bağımlılıklar net.
2. **Mobile First** — Tüm UI önce mobil; breakpoint’lerle tablet/desktop.
3. **i18n desteği** — Hardcode metin yok; dil değişimi ve yeni dil ekleme kolay.
4. **Basit ama etkileyici** — İlk adımda süper karmaşık değil; rakiplere/başkalarına gösterebilecek kadar düzgün ve çözümlü.
5. **Mimari** — Frontend ayrı, backend ayrı; kullanım takip edilebilir, yapı düzgün ve akıcı.

### Nasıl yardım ediyorum?

- **Kararları dokümana döküyorum:** Design token’lar, i18n kuralları, tech stack, frontend/ops — hepsi **ayrı ayrı modüler dosyalarda** (`docs/` klasöründe). Tek bir büyük dosyada değil; her biri kendi dosyasında.
- **Sen ne yaparsın?** Bu dosyaları okuyup değiştirirsin; renk, dil, teknoloji kararı değişince sadece ilgili dosyayı güncellersin. Kod yazarken hangi renk, hangi key, hangi kütüphane kullanılacağı bu dokümanlardan okunur.
- **Geliştirme aşamasında rol:** Solution Architect → **Application Developer**. Artık uygulama geliştirme aşamasındayız; ben kodu yazarım (bileşenler, sayfalar, API/veritabanı), sen karar verirsin / test edersin / geri bildirim verirsin. İş planı **roadmap**’e göre ilerler; her fazın alt maddelerini ayrı ayrı planlayıp uygularız. Detay: [docs/roadmap.md](docs/roadmap.md).
- **Modüler dokümanlar:** Tüm “nasıl yapacağız?” kararları ve iş planı `docs/` altında:
  - [docs/roadmap.md](docs/roadmap.md) — **Geliştirme roadmap’i:** Faz 0 (kurulum), Faz 1 (MVP çekirdek), Faz 2–3 (finans, abonelik); rol geçişi.
  - [docs/design-tokens.md](docs/design-tokens.md) — Renk, tipografi, spacing, radius, shadow, breakpoint.
  - [docs/i18n.md](docs/i18n.md) — Dil kuralları, dosya yapısı, anahtar isimlendirme.
  - [docs/tech-stack.md](docs/tech-stack.md) — Teknoloji kararları tablosu.
  - [docs/frontend-and-ops.md](docs/frontend-and-ops.md) — Klasör yapısı, auth, MVP sayfaları, deploy.
  - [docs/README.md](docs/README.md) — Dokümanların indeksi ve hedeflerin özeti.

---

## 1. Genel Bağlam

- **Durum:** Tüm işler Excel üzerinde; çok sayfa, çok dosya, veriler birbirine linkli değil; manuel kopyala-yapıştır.
- **Sonuç:** Hata riski yüksek, işler gecikiyor (2 saatlik iş 4–5 saate çıkıyor), geçmişe dönük arama zor, şirket büyümesi engelleniyor.
- **Hedef:** Tek bir web uygulaması üzerinden operasyon, finans, müşteri ve servis/montaj yönetimi; minimum etkileşim, maksimum fayda.

---

## 2. Ana Problem Alanları

### 2.1 Problem 1: Servis ve Montaj Kayıtları

**Mevcut durum:**
- Servis formları ve montaj formları Excel’e manuel giriliyor.
- Yıl/ay bazlı sayfalar, 10–15+ sayfa; geçmişe dönük arama zor.
- Müşteri şikayet/geçmiş sorgulandığında Excel’ler arasında gezmek gerekiyor.

**İhtiyaçlar:**
- Müşteri bazlı **servis kayıtları** ekranı: ad, adres, ne yapıldı, ne zaman, saat, tutar, açıklama, panel/ekran numaraları.
- **Montaj kayıtları:** Montaj mı / servis mi / diğer ayrımı; kullanılan malzemeler; montaj ise ilgili **teklif** ile ilişki.
- Zaman bilgisi (tarih + saat) kritik.
- Saha ekipleri bu formları **uygulama üzerinden** dolduracak (kağıt/Excel kalkacak); doldurulunca veri doğrudan sisteme girecek.

**Veri yapısı düşüncesi:**
- Müşteri (customers)
- Teklif (quotes)
- Servis/Montaj işi (service_jobs veya work_orders) — tek tabloda tip ile ayrım da olabilir.

---

### 2.2 Problem 2: Finans Yönetimi

**Mevcut durum:**
- ~400 abone; ~200–250’si kredi kartı ile ödeme.
- Kredi kartı bilgileri (numara, SKT, CVV) elle tutuluyor; Garanti sanal POS ile manuel çekim.
- Faturalar manuel kesiliyor (Paraşüt vb.).
- Elden / havale ödeyenler ayrı; hepsi farklı süreçler.
- **Çoklu kasa:** 7–8 farklı “kasa”/hesap: kredi kartı tahsilat, nakit, elden alınanlar, şirket kasası, kişisel, emeklilik vb. Hepsi ayrı takip.
- Giderler: Kredi kartı ekstresi / banka dökümü yükleniyor; şirket / kişisel harcama ayrımı zor; hepsi manuel işleniyor.
- Şirket içi muhasebe **dolar** üzerinden; fatura kesiminde **TL**’ye (o günkü kur ile) çevriliyor. Kur dönüşümü tutarlı ve takip edilebilir olmalı.

**İhtiyaçlar:**
- **Abonelik ve tahsilat otomasyonu:** Kredi kartı bilgilerini uygulama içinde tutmadan, ödeme altyapısı (ödeme linki, abonelik çekimi vb.) ile otomatik tahsilat.
- Tahsilat sonrası **otomatik fatura** kesimi ve müşteriye mail.
- Havale: Banka dökümü / bildirim ile eşleştirip fatura ve tahsilat kaydı.
- **Çoklu kasa/hesap yönetimi:** Tüm kasalar tek ekranda; hareketler, bakiyeler, filtreleme.
- **Fiş / fatura girişi:** Gelen fiş, fatura, vergi makbuzu; OCR ile okunup sınıflandırma (satın alma → stok, fatura → ödeme, vergi → vergi). Tedarikçi ürün adı ↔ şirket içi ürün adı **mapping** ile eşleştirme.
- **Kur:** Merkez Bankası kuru (veya tanımlı kaynak); dolar hesaplar, fatura kesim anında TL’ye çevirme.
- **Ödeme takip uyarıları:** Son ödeme tarihi, vade yaklaşan faturalar için uygulama içi uyarı.

**Veri yapısı düşüncesi:**
- Ödemeler (payments)
- İşlemler / para akışları (transactions)
- Banka ekstreleri (bank_statements)
- Hesaplar / kasalar (accounts) — 7–8 kasa tipi
- Satın almalar (purchases) + stok (inventory) + tedarikçi–ürün mapping

---

### 2.3 Problem 3: Yapılacak İşler ve Takip

**Mevcut durum:**
- Yapılacak işler notlarda / Excel’de; çok iş olunca bazıları atlanıyor (aranmayan müşteri, gidilmeyen servis vb.).
- Servis/montaj formu kağıtta dolduruluyor; biten iş “açık işler”den “tamamlanan”a manuel taşınıyor; bazen unutuluyor (örn. 2021’deki işler hâlâ açık görünüyor).

**İhtiyaçlar:**
- **Yapılacak işler listesi:** Tek yerden görülebilir; durum (açık / devam / tamamlandı); atama, tarih, müşteri.
- Servis/montaj formu uygulama üzerinden doldurulunca ilgili iş otomatik “tamamlandı” veya “işlendi” olarak güncellenmeli.
- **Günlük planlama:** Tarih seçip o günkü servis/montaj işlerini listeleyebilme; ekip bazlı program.

**Veri yapısı düşüncesi:**
- Yapılacak işler (tasks / todo_items) — müşteri, teklif, servis işi ile ilişkili.

---

## 3. Diğer Problemler ve İhtiyaçlar

### 3.1 Teklif Yönetimi

- Teklifler şu an müşteri/Excel tarafında; montaj bitince “açık işler”den “tamamlanan”a taşıma manuel; bazen unutuluyor.
- İstenen: Teklif oluşturma, müşteriye bağlama, montaj/servis işi ile eşleştirme; montaj tamamlanınca durumun otomatik güncellenmesi; teklif → fatura akışı.

### 3.2 Sim Kart Yönetimi

- Turkcell’den uygun fiyata alınan sim kartlar dışarıya kiralanıyor.
- Açma/kapama, uzaktan reset, ek hak vb. işlemler manuel; bir sim kart / abonelik yönetim modülü (entegrasyon veya basit kayıt) gerekli.

### 3.3 Gelen Evrak: Fiş / Fatura / Makbuz

- Tedarikçilerden gelen fiş, fatura, vergi makbuzu; bir kısmı e-fatura değil.
- İstenen: Telefondan fotoğraf yükleme → OCR → tür (fiş / fatura / vergi makbuzu) ve kalemler; satın alma → stok, fatura → ödemeler, vergi → vergi kaydı. Tedarikçi ürün adı ↔ şirket ürün adı mapping.

### 3.4 Ödeme / Vade Uyarıları

- Son ödeme tarihi yaklaşan veya gelen faturalar için uygulama içi uyarı (örn. “Son ödeme tarihine 1 hafta kaldı”).
- Tahsilat atlanan abonelerin fark edilmesi (örn. kiralama başlayıp hiç tahsilat yapılmaması).

### 3.5 Kur ve Para Birimi

- Şirket içi hesaplar **USD**; fatura kesiminde **TL** (o günkü kur).
- Anlık kur çekme (Merkez Bankası veya tanımlı API) ve tutarlı kur dönüşümü zorunlu.

---

## 4. Hedef Özellikler (Özet Liste)

| Alan | Özellik |
|------|--------|
| Müşteri | CRM + müşteri kartı: iletişim, adresler, geçmiş servis/montaj, aramalar, notlar |
| Servis / Montaj | Teknik servis ve montaj modülü; saha formları uygulama üzerinden; teklif ile entegrasyon |
| Finans | Dolar bazlı hesaplama; kur dönüşümü; çoklu kasa/hesap; otomatik fatura, tahsilat uyarıları |
| Abonelik | Abonelik ve tahsilat otomasyonu (kart bilgisi tutmadan); otomatik fatura + mail |
| Stok / Satın alma | Fiş/fatura OCR; tedarikçi–ürün mapping; stok girişi ve gider ataması |
| İş takip | Yapılacak işler listesi; servis/montaj tamamlanınca otomatik güncelleme; günlük planlama |
| Sim kart | Sim kart kiralama ve işlem takibi (modül veya entegrasyon) |

---

## 5. Teknoloji ve Tasarım Kararları

### 5.1 Kullanılması Düşünülen Teknolojiler

| Katman | Teknoloji | Not |
|--------|-----------|-----|
| Frontend | React | — |
| Styling | Tailwind CSS | — |
| Backend / DB / Auth | Supabase | Auth, PostgreSQL, Realtime, Edge Functions |
| Otomasyon | N8N (veya Make / Zapier) | Tekrarlayan işler, entegrasyonlar |
| Mantık / Zamanlama | Edge Functions + N8N | Fatura, tahsilat, uyarılar |

### 5.2 Tasarım ve Geliştirme İlkeleri

- **i18n:** Metinler hardcode Türkçe/İngilizce olmayacak; çeviri anahtarları ile (ileride çok dil).
- **Mobile first:** Saha ekipleri servis/montaj formlarını mobilde dolduracak.
- **Sade ve temiz:** Gereksiz karmaşıklık yok; minimum etkileşim, maksimum fayda.
- **Hız:** Çalışan bir sistem; “think fast, iterate faster” — MVP odaklı.

---

## 6. Veri / Tablo Düşüncesi (Özet)

Aşağıdakiler senin belirttiğin alanlarla uyumlu, yüksek seviye tablo fikirleri:

- **customers** — Müşteri bilgileri, iletişim, adresler
- **quotes** — Teklifler (müşteri, kalemler, tutar, para birimi, durum)
- **service_jobs** veya **work_orders** — Servis/montaj işleri (müşteri, teklif, tip, tarih/saat, malzeme, tutar, durum)
- **payments** — Tahsilatlar (müşteri, abonelik, tutar, yöntem, tarih)
- **inventory** — Stok kalemleri; tedarikçi ürün adı ↔ iç ürün adı mapping
- **transactions** — Para hareketleri (hesap/kasa, tutar, açıklama, tarih)
- **bank_statements** — Banka dökümü satırları (işlem eşleştirme için)
- **accounts** — Kasalar / hesaplar (tip: nakit, kredi kartı, banka, kişisel, emeklilik vb.)
- **purchases** — Satın almalar (tedarikçi, fatura/fiş, kalemler, stok artışı)
- **tasks** veya **todo_items** — Yapılacak işler (müşteri, iş, atanan, tarih, durum)

Bu liste MVP ve sonraki aşamalar için genel çerçeve; detay şema Supabase üzerinde modül modül netleştirilebilir.

---

## 7. MVP Yaklaşımı

- **İlk sürüm:** Hem senin hem dayının işini gerçekten hafifleten, tek bir akışı (örn. servis/montaj kayıtları + müşteri kartı veya abonelik + tek kasa) uçtan uca çözen küçük ama çalışan bir set.
- **Sonra:** Diğer kasalar, tam finans otomasyonu, OCR, sim kart, teklif detayları vb. adım adım eklenir.

---

## 8. Geliştirmeye Başlamadan Önce: Hazırlık Kontrol Listesi

*Solution architect perspektifi: Türkiye (İstanbul / şirket) bağlamında, uygulamayı yazmaya geçmeden önce netleştirilmesi ve hazırlanması gerekenler.*

### 8.1 Önce Ne Yapman Gerekiyor? (Sıra Önerisi)

| Sıra | Konu | Neden önce? |
|------|------|-------------|
| 1 | **Yasal / uyum (Türkiye)** | KVKK, e-fatura/e-arşiv, veri saklama; sonradan eklemek pahalı ve riskli. |
| 2 | **Ödeme altyapısı kararı** | Kredi kartı saklamadan abonelik tahsilatı için hangi sağlayıcı (iyzico, PayTR, Stripe TR vb.); API ve sözleşme süreçleri zaman alır. |
| 3 | **Hesap ve erişimler** | Supabase, domain, Paraşüt API, kur API; geliştirme başlamadan hesaplar ve (gerekirse) sandbox’lar açık olmalı. |
| 4 | **Veri ve süreç** | Excel’deki “gerçek” kasa listesi, abone sayısı, teklif/servis alanları; MVP için hangi verilerin taşınacağına karar. |
| 5 | **Rol ve onay** | Kim admin, kim saha, kim sadece rapor görür; dayının onayı ve ilk kullanıcı olarak dahil edilmesi. |

---

### 8.2 Türkiye’ye Özel: Yasal ve Uyum

- **KVKK**
  - Müşteri adı, telefon, adres, (ileride) ödeme bilgisi kişisel veri. Bu verileri toplayan, işleyen sistem için:
    - Aydınlatma metni, açık rıza (gerekiyorsa), veri işleme envanteri.
    - Veriler nerede tutuluyor? (Supabase EU bölgesi KVKK açısından yurtdışı aktarım sayılır; gerekirse Türkiye’de sunucu / yerel host seçenekleri değerlendirilir.)
  - **Yapılacak:** KVKK uyumunu şirket avukatı veya danışmanla netleştir; uygulama tasarımına (hangi ekranda hangi metin, hangi onay) baştan yerleştir.

- **E-fatura / e-arşiv**
  - Fatura kesimini Paraşüt veya başka bir servis üzerinden yapıyorsanız, GİB’e kayıtlı e-fatura/e-arşiv kullanımı zaten var. Yeni sistem sadece “fatura kes” komutunu API ile gönderecek.
  - **Yapılacak:** Paraşüt (veya kullanılan muhasebe) e-fatura/e-arşiv yetkilerini ve API erişimini teyit et; test ortamı varsa iste.

- **Ticari kayıtlar ve vergi**
  - Faturalar, kasalar, gelir-gider kayıtları vergi mevzuatına uygun tutulmalı. Sistem “kayıt tutan” bir araç; nihai sorumluluk muhasebeci/vergi danışmanında.
  - **Yapılacak:** Muhasebeci ile “hangi verileri hangi formatta tutacağız, raporları nasıl alacağız” konuş; MVP’de en azından temel liste ve tarih/tutar alanlarını buna göre düzenle.

- **Sözleşmeler**
  - Abonelik / kiralama için müşteriyle yapılan sözleşmeler ve “ödeme yapıyorum” onayı önemli. Otomatik tahsilatta genelde ödeme sağlayıcısı (iyzico vb.) sözleşme/onay metnini de yönetir.
  - **Yapılacak:** Mevcut abonelik sözleşmelerinin otomatik tahsilata uygun olup olmadığını kontrol ettir; gerekirse metin güncellemesi.

---

### 8.3 Teknik Hazırlık

- **Hesap ve erişimler**
  - [ ] **Supabase:** Proje oluşturuldu mu? Bölge seçimi (EU önerilir; KVKK için yurtdışı aktarım değerlendirilecek).
  - [ ] **Domain:** Uygulama için kullanılacak alan adı (örn. app.sirket.com) alındı mı? SSL (Supabase / Vercel otomatik verir).
  - [ ] **Paraşüt API:** API key, dokümantasyon ve (varsa) sandbox erişimi.
  - [ ] **Kur:** TCMB veya kullanılacak kur API’si (günlük kur çekmek için); API key gerekebilir.

- **Ödeme altyapısı (kritik)**
  - Kredi kartı bilgisini **sistemde tutmadan** abonelik tahsilatı için bir ödeme sağlayıcı gerekir. Türkiye’de yaygın seçenekler: iyzico, PayTR, Stripe (Türkiye’de sınırlı), vb.
  - **Yapılacak:** Hangi sağlayıcı ile çalışılacağına karar ver; sözleşme, entegrasyon dokümanı ve test ortamını al. PCI-DSS açısından kart numarası/CVV saklamıyorsanız yükünüz azalır; yine de sağlayıcının “abonelik / tekrarlayan ödeme” destekleyip desteklemediğini netleştir.

- **Hosting ve ortam**
  - Frontend: Vercel / Netlify vb. (React için uygun).
  - Backend: Supabase (DB + Auth + Edge Functions). Ayrı sunucu gerekmez.
  - **Yapılacak:** Geliştirme (dev) ve production ortamları için ayrı Supabase projeleri veya branch’ler planla; production’da env (API key, domain) doğru ayarlanacak.

---

### 8.4 Veri ve Süreç Hazırlığı

- **Mevcut Excel’ler**
  - Kaç tane “kasa” gerçekten kullanılıyor? Hepsinin adı ve amacı listelenmeli; MVP’de en az 1–2 kasa ile başlanabilir.
  - Servis/montaj formunda hangi alanlar **zorunlu**? (Müşteri, tarih, saat, adres, tutar, tip, teklif no vb.) Liste çıkar; MVP ekranı buna göre tasarlanır.
  - Aboneler: 400 abone, ~250 kredi kartı — liste Excel’de mi? Taşınacak müşteri/abonelik alanları netleştir (isim, iletişim, tutar, periyot, başlangıç tarihi vb.).

- **Migrasyon**
  - MVP’de geçmiş veriyi toplu taşımak zorunlu değil; “yeni sistemden itibaren” kayıt tutulabilir. Geçmişi taşıyacaksanız: hangi Excel’den hangi tabloya, hangi alanlar — basit bir eşleme tablosu yaz; sonra tek seferlik script veya manuel giriş planı.

- **Kur ve para birimi**
  - İç hesaplar USD; fatura TL (o günkü kur). TCMB API veya başka bir kur kaynağı seç; “fatura kesim anındaki kur” kaydedilsin (audit için).

---

### 8.5 Operasyonel ve İnsan Tarafı

- **Roller**
  - Admin (sen / dayı): tüm veri, kasa, rapor, kullanıcı yönetimi.
  - Saha: sadece kendi atandığı işler, servis/montaj formu doldurma.
  - (İsteğe) Muhasebe: sadece finans / fatura / kasa görünümü.
  - **Yapılacak:** Rolleri 3–4 maddeyle yaz; Supabase RLS ve ekran yetkileri buna göre tasarlanacak.

- **Onay ve kullanım**
  - Dayının “bu ekran böyle olsun, bu liste böyle çıksın” demesi MVP’nin kabul kriteridir. İlk canlı kullanımı birlikte yapmak (örn. bir hafta paralel Excel + sistem) faydalı.
  - **Yapılacak:** MVP için 3–5 tane “bitmiş sayarız” kriteri belirle (örn. “Bir servis kaydı saha ekibi tarafından girildi, müşteri kartında göründü”).  

- **Destek ve hata**
  - Şirket içinde “sistemle ilgili sorun kime gidecek?” (sen). Hata/istek için basit bir kanal (telefon, WhatsApp, form) tanımlanabilir.

---

### 8.6 Özet: Gerekli Olanların Kontrolü

| Kategori | Sahip miyiz? | Eksikse ne yapılacak? |
|----------|----------------|------------------------|
| KVKK / veri uyumu | Netleştir | Avukat/danışman + aydınlatma/rıza metni ve ekran tasarımı |
| E-fatura / Paraşüt | Var | API erişimi ve test ortamı al |
| Ödeme sağlayıcı (abonelik) | Yok | iyzico / PayTR vb. seç, sözleşme + entegrasyon |
| Supabase + domain | Kontrol et | Hesap aç, bölge ve domain ayarla |
| Kur API | Kontrol et | TCMB veya alternatif, API key |
| Kasa listesi (gerçek) | Netleştir | Excel’den 7–8 kasanın listesi ve MVP’de kaç tanesi |
| Servis/montaj alan listesi | Netleştir | Zorunlu alanlar listesi çıkar |
| Roller (admin, saha, vb.) | Netleştir | Kısa rol tanımı yaz |
| MVP kabul kriterleri | Netleştir | 3–5 madde “MVP bitti” kriteri |

**Sonuç:** Geliştirmeye “sıfırdan kod yazmak” ile değil, yukarıdaki maddeleri mümkün olduğunca doldurduktan sonra başlamak daha doğru. Özellikle **Türkiye tarafında** KVKK ve ödeme sağlayıcı kararı, **ilk yapılacaklar** olarak öne çıkıyor; paralel olarak Supabase, domain ve Paraşüt API hazırlığı yapılabilir.

---

### 8.7 Başlamak için elimizde her şey var mı?

**Evet, kod yazmaya başlamak için yeterli var.** Aşağıdaki “Hazır” maddeler tamam; “Hâlâ karar verilmeli” olanlar paralel gidebilir veya MVP’nin ilk aşamasında ertelenebilir.

| Durum | Ne? | Açıklama |
|--------|-----|----------|
| **Hazır** | Design token’lar | `docs/design-tokens.md` — renk, tipografi, spacing, breakpoint tanımlı. |
| **Hazır** | i18n kuralları | `docs/i18n.md` — dil, dosya yapısı, anahtar isimlendirme. |
| **Hazır** | Tech stack | `docs/tech-stack.md` — React, Tailwind, Supabase, form, state kararları. |
| **Hazır** | Frontend / ops | `docs/frontend-and-ops.md` — klasör yapısı, auth, MVP sayfaları, deploy. |
| **Hazır** | Problem ve hedefler | Ana doküman — ne çözeceğimiz, MVP yaklaşımı net. |
| **Karar verilmeli** | **Supabase + env** | Proje açılmadan uygulama çalışmaz. İlk gün: Supabase proje + `.env.local` ile başlanabilir. |
| **Karar verilmeli** | **Servis/montaj zorunlu alanlar** | Formda hangi alanlar zorunlu? Liste yoksa varsayılan bir set ile başlanır; sonra güncellenir. |
| **Karar verilmeli** | **Kasa listesi (MVP’de kaç tane?)** | Finans ekranı için. MVP’de 1–2 kasa ile başlanabilir; liste sonra genişletilir. |
| **Canlıya çıkmadan önce** | KVKK / veri uyumu | Aydınlatma metni, rıza; avukat/danışman ile netleştir. |
| **Canlıya çıkmadan önce** | Ödeme sağlayıcı (abonelik) | iyzico / PayTR vb. seçim; abonelik modülü bu karara bağlı. |
| **Canlıya çıkmadan önce** | Paraşüt API, kur API | Fatura ve kur için; entegrasyon aşamasında gerekir. |
| **İsteğe / sonra** | MVP kabul kriterleri (3–5 madde) | “MVP bitti” demek için; geliştirme sırasında da yazılabilir. |
| **İsteğe / sonra** | Roller (admin, saha) | Dokümanda taslak var; RLS ve ekranları yazarken netleşir. |
| **İsteğe / sonra** | Domain | Production deploy için; lokal/Vercel preview ile başlanabilir. |

**Özet:** Proje (React + Supabase) oluşturup login, müşteri listesi, servis formu iskeleti gibi ilk ekranlara **hemen başlanabilir.** Supabase hesabı ve `.env` olmadan çalıştıramazsın; onu ilk adımda aç. Servis formu alanları ve kasa listesi için “varsayılan set” ile ilerleyip senin/dayının geri bildirimiyle güncellemek yeterli. KVKK ve ödeme sağlayıcı, canlıya almadan önce netleşmeli; kod yazmak için bloklayıcı değil.

---

## 9. Karar ve Standartlar Dokümanı (Çalışmadan Önce Verilecek Kararlar)

*Tüm kararlar burada toplanır; ileride değişebilir ama şu an “nasıl yapacağız?” net olsun. Design, dil, teknoloji, frontend, operasyon — hepsi tek yerde.*

### 9.1 Tasarım Sistemi (Design Tokens — Renk, Boyut, Spacing)

**Amaç:** Renkler, font boyutları, spacing (boşluklar), border-radius vb. **tek yerden** tanımlı olsun; kodda sabit değer yazmayalım. İleride “marka rengi değişsin” veya “sistem başka şirkete açılsın, kendi teması olsun” dersen bu yapı hazır olur.

**Yapılacaklar:**

| Karar | Seçenekler / Öneri | Dokümana yazılacak |
|-------|--------------------|--------------------|
| **Renkler** nerede? | CSS değişkenleri (örn. `--color-primary`) + Tailwind `theme` extend | Bir “Design tokens” dosyası: primary, secondary, success, danger, neutral tonları; arka plan, yazı, border. |
| **Tipografi** (font ailesi, boyutlar) | Sistem fontu veya tek bir font (örn. Inter, Plus Jakarta Sans) | Font ailesi; h1–h6 ve body için boyutlar; font-weight’ler. |
| **Spacing** (boşluklar) | Tailwind scale (4, 8, 12, 16, 24, 32…) veya özel scale | Hangi scale kullanılacak; “xs, sm, md, lg” gibi isimlendirme. |
| **Border radius, shadow** | Küçük set (örn. sm, md, lg) | Değerler ve kullanım yeri (buton, kart, input). |
| **Sisteme girebilir mi?** | MVP’de: config dosyası (JS/JSON). İleride: admin panelinde “Tema / Marka” ekranı, DB’de saklama. | Karar: “Faz 1: `theme.json` veya Tailwind config; Faz 2: DB + admin’den düzenleme.” |

**Çıktı:** Projede `design-tokens.md` (veya `docs/design-system.md`) — renk kodları, font adları, spacing sayıları; geliştirici bu dosyaya bakarak kod yazar.

---

### 9.2 Dil ve Metinler (i18n)

**Amaç:** Hiçbir metin hardcode Türkçe/İngilizce olmasın; çeviri anahtarları ile. İleride dil eklemek kolay olsun.

**Yapılacaklar:**

| Karar | Seçenekler / Öneri | Dokümana yazılacak |
|-------|--------------------|--------------------|
| **Varsayılan dil** | `tr` (Türkçe) | `defaultLocale: 'tr'` |
| **Desteklenecek diller (MVP)** | Sadece `tr`; yapı İngilizce’ye açık | `supportedLocales: ['tr']`; ileride `['tr','en']` |
| **Çeviriler nerede?** | Dosya bazlı: `locales/tr.json`, `locales/en.json` | Klasör yapısı ve namespace (örn. `common`, `customers`, `finance`) |
| **Hangi kütüphane?** | react-i18next + i18next | Kurulum ve kullanım kuralı (örn. `t('customers.title')`) |
| **Tarih/sayı formatı** | i18n locale’e göre (TR: 1.234,56 / EN: 1,234.56) | Karar: `Intl` + locale; para birimi: TRY, USD ayrı alan. |

**Çıktı:** `docs/i18n.md` — varsayılan dil, dosya yapısı, örnek anahtar isimlendirmesi; yeni ekran eklerken hangi dosyaya hangi key ekleneceği.

---

### 9.3 Teknoloji Stack (Net Karar)

**Yapılacaklar:** Aşağıdaki tabloyu doldur; “neden bu?” tek cümle yaz. Değişirse doküman güncellenir.

| Katman | Karar | Neden / Not |
|--------|--------|-------------|
| **Frontend** | React | — |
| **Styling** | Tailwind CSS | Design tokens ile uyumlu; utility-first. |
| **State (global)** | ? (Zustand / React Query / Context) | Karar ver: sadece sunucu state mi, UI state de mi? |
| **Routing** | React Router | SPA; korumalı rotalar (auth). |
| **Form** | ? (React Hook Form / Formik) | Karar ver; validasyon (Zod/Yup) ile birlikte. |
| **Backend / DB** | Supabase | Auth, PostgreSQL, Realtime, Edge Functions. |
| **Otomasyon** | N8N (veya Make/Zapier) | Tekrarlayan işler, webhook. |
| **Hosting (frontend)** | Vercel / Netlify | Karar ver. |
| **API / Edge** | Supabase Edge Functions | Fatura, tahsilat, kur çekme vb. |

**Çıktı:** `docs/tech-stack.md` — yukarıdaki tablo doldurulmuş; yeni bir geliştirici “ne kullanıyoruz?” sorusuna buradan cevap alır.

---

### 9.4 Frontend Yapısı ve Operasyonlar

**Yapılacaklar:**

| Konu | Karar | Dokümana yazılacak |
|------|--------|--------------------|
| **Klasör yapısı** | Örn. `src/components`, `src/pages`, `src/hooks`, `src/lib`, `src/locales` | Basit bir ağaç; nereye ne koyulacağı. |
| **Auth akışı** | Supabase Auth; login sayfası; korumalı route’lar; rol bilgisi `user_metadata` veya ayrı tablo | Giriş/çıkış ve “saha kullanıcısı sadece kendi işleri” nasıl sağlanacak. |
| **Mobile first** | Tüm UI önce mobil (breakpoint: 640px), sonra tablet/desktop | Tailwind `sm:`, `md:` kullanım kuralı. |
| **MVP sayfaları** | Liste: Login, Dashboard (basit), Müşteri listesi, Müşteri detay (kart), Servis/Montaj formu, Yapılacak işler listesi | Faz 2’de eklenecekler ayrı başlık. |
| **Deploy** | Kim, nasıl? (Git push → Vercel otomatik; env değişkenleri nerede?) | Kısa adım listesi. |
| **Env** | `.env.example` içinde hangi değişkenler (Supabase URL, key, API’ler); production env nerede tutulacak | Liste. |
| **Backup** | Supabase backup (otomatik); kritik veri export sıklığı (isteğe) | Tek cümle. |

**Çıktı:** `docs/frontend-and-ops.md` (veya 9.4’ü `tech-stack.md` içinde genişlet) — yapı, auth, MVP sayfaları, deploy ve env.

---

### 9.5 Eksik Ne Var? (Kısa Özet)

| Ne | Durum | Yapılacak |
|----|--------|-----------|
| **Design tokens** | Henüz yok | `design-tokens.md` veya `docs/design-system.md` yaz; renk, font, spacing, radius değerlerini tek yerde topla. İleride bu değerler admin’den girilebilir (Faz 2). |
| **i18n standardı** | Karar: hardcode yok | `docs/i18n.md` yaz; default locale, dosya yapısı, key isimlendirme. |
| **Tech stack tablosu** | Kısmen var (doc’ta) | `docs/tech-stack.md` oluştur; state, form, hosting kararlarını doldur. |
| **Frontend yapı + auth + MVP sayfaları** | Dağınık | Tek dokümanda: klasör yapısı, auth akışı, MVP sayfa listesi. |
| **Deploy ve env** | Belirsiz | Kim deploy edecek, `.env.example` içeriği, production env nerede. |
| **Tüm kararlar tek yerde mi?** | Hayır | Bu bölüm (Bölüm 9) “karar ve standartlar” merkezi; ayrı dosyalar (`design-system.md`, `i18n.md`, `tech-stack.md`, `frontend-and-ops.md`) buradan beslenir veya buraya referans verir. |

**Sonuç:** Çalışmaya başlamadan önce **yapılması gereken**: (1) Design token’ları ve i18n kurallarını yazmak, (2) Tech stack ve frontend/ops kararlarını tabloya dökmek. Böylece renk/boyut/dil/teknoloji “nasıl?” sorusu cevapsız kalmaz; ileride değişirse sadece bu dokümanlar güncellenir.

---

## 10. Doküman Bilgisi

- **Amaç:** Tüm problemlerin ve çözüm taslağının tek yerde toplanması.
- **Format:** Markdown.
- **Güncelleme:** Yeni problem veya karar eklendikçe bu dosyaya eklenebilir.
