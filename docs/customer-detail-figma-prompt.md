# Figma Tasarım Brief: Müşteri Detay Sayfası

> Bu doküman, Ornet ERP müşteri detay sayfasının yeniden tasarımı için Figma'da kullanılacak detaylı prompt/brief'tir.

---

## 1. Proje ve Ekran Bağlamı

**Proje:** Ornet ERP — Türkiye'deki bir güvenlik şirketi için iş emri ve ERP sistemi.

**Ekran:** Müşteri Detay Sayfası (`/customers/:id`)

**Ne zaman açılır:** Kullanıcı müşteri listesinde bir müşteriye tıkladığında bu sayfa açılır.

**Kullanıcı tipleri:** Saha teknisyenleri, ofis personeli, muhasebe, yöneticiler.

**Önem:** Bu ekran en sık kullanılan sayfalardan biri. Müşteriye ait tüm bilgilere tek noktadan erişim sağlar.

---

## 2. Ekranın Amacı

- Müşteriye ait tüm bilgileri tek sayfada göstermek
- Hızlı aksiyonlara (yeni iş emri, lokasyon ekle, düzenle) erişim sağlamak
- Lokasyonlar, iş geçmişi, SIM kartlar, ekipman gibi ilişkili verilere göz atmak
- İletişim bilgilerine (telefon, e-posta) hızlı erişim (arama, mail gönderme)

---

## 3. Mevcut Ekranda Neler Var?

### 3.1 Sayfa Başlığı (Header)
- **Breadcrumb:** Müşteriler > [Firma Adı]
- **Başlık:** Müşteri firma adı (örn. "Pizza Bulls")
- **Badge'ler:** Lokasyon sayısı (örn. "1 Lokasyon"), Vergi numarası
- **Aksiyonlar:**
  - Yeni İş Emri (primary buton)
  - Düzenle (outline buton)
  - Sil (çöp kutusu ikonu)

### 3.2 Ana İçerik (Sol / Geniş Alan)

#### A) Lokasyonlar Bölümü
- **Başlık:** "Lokasyonlar" + "Yeni Lokasyon Ekle" butonu
- **Lokasyon Kartları** (her lokasyon için bir kart):
  - Lokasyon adı (örn. "Genel merkez")
  - Hesap no badge (örn. "MC 1010")
  - Adres (şehir, ilçe, tam adres)
  - Yetkili kişi + telefon (varsa)
  - Panel bilgisi (varsa, küçük kutu içinde)
  - **Abonelikler:** Her abonelik için: hizmet tipi, durum, fiyat, detay linki
  - "Hizmet Ekle" butonu
  - **Alt aksiyonlar:** "İş Geçmişi" butonu, "Yeni İş Emri" butonu
  - Hover'da "Düzenle" ikonu
- **Boş durum:** Lokasyon yoksa "Bu müşteri için henüz lokasyon eklenmemiş" + "Yeni Lokasyon Ekle" butonu

#### B) Geçmiş İşler Bölümü
- **Başlık:** "Geçmiş İşler" + iş sayısı badge
- **Tablo:** İş tipi, Lokasyon, Durum, Planlanan tarih
- Satıra tıklanınca iş emri detayına gider
- **Boş durum:** "Bu müşteri için iş kaydı yok"

#### C) SIM Kart Yönetimi Bölümü
- **Başlık:** "SIM Kart Yönetimi" + sayı badge + "Yeni SIM Kart Ekle" butonu
- **Tablo:** Hat no, Durum, Lokasyon, Satış fiyatı
- Satıra tıklanınca SIM kart düzenleme sayfasına gider
- **Boş durum:** "SIM Kart Bulunamadı"

#### D) Ekipman Bölümü
- **Başlık:** "Ekipman" + sayı badge + "Ekipman Ekle" butonu
- **Tablo:** Ekipman tipi, Seri no, Konum notu, Durum
- **Boş durum:** "Ekipman Kaydı Yok"

### 3.3 Sidebar (Sağ, Dar Alan)

#### A) İletişim Bilgileri Kartı
- **Başlık:** "İletişim Bilgileri"
- **Telefon:** Etiket + numara + arama butonu (tıklanınca `tel:` açılır)
- **İkinci telefon:** (varsa) aynı yapı
- **E-posta:** Etiket + adres (tıklanınca `mailto:` açılır)
- **Boş durum:** "İletişim bilgisi eklenmemiş" (hiçbiri yoksa)

#### B) Notlar Kartı
- **Başlık:** "Notlar"
- **İçerik:** Müşteri notları (çok satırlı metin)
- **Boş durum:** "Not yok"

### 3.4 Diğer UI Elemanları
- **FAB (Floating Action Button):** Sağ alt köşede kırmızı + butonu — finans modülü için "Hızlı gider girişi" açar (bu sayfaya özel değil, global)
- **Modal'lar:** Lokasyon ekleme/düzenleme, müşteri silme onayı

---

## 4. Mevcut UX Sorunları (Çözülmesi Gerekenler)

1. **Layout:** İçerik solda sıkışık, sağda boş alan. Bilgi yoğunluğu ile ekran kullanımı dengesiz.
2. **Bilgi hiyerarşisi:** Tüm bölümler aynı görsel ağırlıkta. Kritik bilgiler (iletişim, lokasyonlar) öne çıkmıyor.
3. **Tekrarlayan aksiyonlar:** "Yeni İş Emri" hem header'da hem her lokasyon kartında. Kullanıcı kafası karışabilir.
4. **Uzun sayfa:** Tek scroll'da çok fazla bölüm. Mobilde daha da zor.
5. **Lokasyon kartı:** Abonelik metni sıkışık, okunması zor.
6. **Tablolar:** Mobilde yatay scroll veya sütun gizleme ihtiyacı.
7. **Görsel tutarlılık:** Bölüm başlıkları ve kart stilleri arasında tutarsızlık.

---

## 5. Tasarım Hedefleri

- **Okunabilirlik:** Bilgiler net, hiyerarşik ve taranabilir olmalı.
- **Hızlı erişim:** Sık kullanılan aksiyonlar (yeni iş emri, lokasyon ekle, düzenle) kolay bulunmalı.
- **Responsive:** Desktop (1920px), tablet (768px), mobil (375px) için uyumlu.
- **Dark mode:** Uygulama dark mode destekliyor; tasarım hem light hem dark için düşünülmeli.
- **Türkçe:** Tüm metinler Türkçe, RTL değil.

---

## 6. Önerilen İyileştirme Yönleri (Tasarımcıya Fikir)

- **Sekmeli yapı:** "Genel | Lokasyonlar | İş Emirleri | SIM Kartlar | Ekipman" — sayfa uzunluğunu azaltır, odaklanmayı artırır.
- **Hero / Özet alanı:** Sayfa üstünde müşteri adı, iletişim (telefon/email) ve ana aksiyonların olduğu kompakt bir "özet kartı".
- **Lokasyon kartı yeniden düşünme:** Abonelikler ayrı satırlarda, daha okunaklı. Belki accordion veya expandable row.
- **Sticky sidebar:** İletişim bilgileri scroll'da sabit kalsın (desktop).
- **Aksiyon sadeleştirme:** Header'da tek bir "Hızlı işlemler" dropdown (Yeni iş emri, Lokasyon ekle, SIM ekle, Düzenle).
- **Boş durumlar:** Daha davetkar, illustrasyonlu veya ikonlu empty state'ler.
- **Tablo alternatifi:** Mobilde kart listesi, desktop'ta tablo.

---

## 7. Teknik Kısıtlamalar

- **Framework:** React, Tailwind CSS
- **Bileşenler:** Card, Button, Badge, Table, Modal, IconButton mevcut
- **Renkler:** Primary (kırmızı ton), neutral gray scale, success/warning/error durum renkleri
- **İkonlar:** Lucide React (MapPin, Phone, Mail, FileText, Building2, Cpu, vb.)

---

## 8. Figma Çıktı Beklentisi

- Desktop (1440px veya 1920px) ana layout
- Tablet (768px) ve mobil (375px) varyantları
- Light ve dark mode örnekleri
- Boş durum (empty state) örnekleri
- Lokasyon kartı — 1 abonelik ve 3+ abonelik varyantları
- Component'ler: Header, Lokasyon kartı, İletişim kartı, Tablo bölümü

---

## 9. Kısa Özet (AI / Hızlı Brief İçin)

> **Ornet ERP müşteri detay sayfası.** Türkçe, B2B güvenlik şirketi ERP. Sayfa: firma adı, breadcrumb, aksiyonlar (yeni iş emri, düzenle, sil). Ana alan: lokasyon kartları (adres, hesap no, abonelikler, iş geçmişi/yeni iş emri butonları), geçmiş işler tablosu, SIM kart tablosu, ekipman tablosu. Sidebar: iletişim (telefon, email, tıklanabilir), notlar. Sorunlar: layout dağınık, bilgi hiyerarşisi zayıf, sayfa uzun. Hedef: sekme veya hero ile daha odaklı, responsive, dark mode uyumlu tasarım.
