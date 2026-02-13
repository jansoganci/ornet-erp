# SIM Kart Yönetim Sistemi - Teknik Tasarım Dokümanı

Bu doküman, Ornet ERP bünyesinde kurulacak olan SIM Kart (Data Kart) Yönetim Sistemi'nin mimarisini, veritabanı yapısını ve uygulama planını detaylandırır.

## 1. Genel Bakış
Sistem, 2500+ M2M SIM kartın envanter takibini, müşteri atamalarını, yaşam döngüsünü (Boşta, Aktif, İnaktif) ve finansal karlılığını yönetmek için tasarlanmıştır. Gelecekteki Finans Modülü ile tam entegre çalışacaktır.

## 2. Veritabanı Mimarisi (Supabase)

### 2.1. `sim_cards` Tablosu
Ana envanter verilerini tutar.
- `id` (uuid, pk): Benzersiz kimlik.
- `phone_number` (text, unique): Hat numarası (Örn: 538...).
- `imsi` (text, unique): SIM kart kimliği.
- `iccid` (text): GPRS/EBS Seri No.
- `operator` (text): Turkcell, Vodafone vb.
- `capacity` (text): Paket boyutu (100MB, 1GB).
- `account_no` (text): AİM Abone No (585D vb.).
- `status` (enum): `available`, `active`, `inactive`, `sold`.
- `customer_id` (uuid, fk): `customers.id`.
- `site_id` (uuid, fk): `customer_sites.id`.
- `cost_price` (decimal): Aylık alış maliyeti.
- `sale_price` (decimal): Aylık satış fiyatı.
- `activation_date` (timestamptz): Aktivasyon tarihi.
- `notes` (text): Operasyonel notlar.

### 2.2. `sim_card_history` Tablosu
Tüm durum değişikliklerini ve atamaları loglar (Finansal geçmiş için).
- `sim_card_id` (uuid, fk)
- `action` (text): 'status_change', 'assignment', 'price_update'.
- `old_value` (jsonb)
- `new_value` (jsonb)
- `changed_by` (uuid, fk)

## 3. Servisler ve API Katmanı

### 3.1. `src/features/simCards/api.js`
- `getSimCards(filters)`: Durum, müşteri veya operatöre göre listeleme.
- `upsertSimCard(data)`: Tekli kart ekleme/güncelleme.
- `bulkImportSimCards(dataArray)`: Excel'den gelen veriyi toplu kaydetme.
- `updateSimStatus(id, status, metadata)`: Durum değişikliği ve tarih kaydı.

### 3.2. `src/features/simCards/hooks.js`
- `useSimCards()`: Liste verisi için Query.
- `useSimCardStats()`: Dashboard özet verileri için Query.
- `useImportSims()`: Toplu yükleme için Mutation.

## 4. Uygulama Planı (Phases)

### Faz 1: Altyapı ve Veritabanı (Hemen)
- [ ] Migration dosyasının oluşturulması (`00023_sim_card_management.sql`).
- [ ] RLS politikalarının (Security) tanımlanması.
- [ ] i18n çeviri dosyalarının hazırlanması (`tr/simCards.json`).

### Faz 2: Temel Yönetim Arayüzü
- [ ] `SimCardsListPage.jsx` (Filtrelenebilir tablo).
- [ ] `SimCardForm` (Manuel ekleme/düzenleme).
- [ ] Sidebar entegrasyonu.

### Faz 3: Toplu İşlemler ve Excel Import
- [ ] `xlsx` kütüphanesi entegrasyonu.
- [ ] `SimCardImportPage.jsx` (Sürükle-bırak Excel yükleme).
- [ ] Veri validasyonu (Hatalı satırları raporlama).

### Faz 4: Müşteri ve Saha Entegrasyonu
- [ ] Müşteri detay sayfasında "SIM Kartlar" sekmesi.
- [ ] İş emri kapatılırken SIM kart atama opsiyonu.

### Faz 5: Finansal Raporlama ve Dashboard
- [ ] Aylık toplam gelir/gider görünümü.
- [ ] Karlılık analizi grafikleri.
- [ ] Finans modülü için veri export endpointleri.

## 5. Revize Edilecek Mevcut Dosyalar
- `src/App.jsx`: Yeni rotalar eklenecek.
- `src/components/layout/navItems.js`: Menü eklenecek.
- `src/features/customers/CustomerDetailPage.jsx`: SIM sekmesi eklenecek.
- `src/lib/i18n.js`: Yeni namespace kaydedilecek.
