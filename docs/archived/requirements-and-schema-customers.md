# Müşteri listesi + Müşteri kartı: İhtiyaçlar ve Tablo Tanımı

Önce **ne lazım** ve **tabloda ne olacak** netleşsin; sonra ekran ve API buna göre yazılır. Bu dosya o ihtiyaç ve şema referansıdır.

---

## 1. Neden önce bu?

- Rastgele ekran yapmak yerine: **müşteri listesi ve kartında tam olarak ne göreceğiz, ne arayacağız?** buna cevap veriyoruz.
- **SQL tablosu** (kolonlar, tipler, anahtarlar) bu ihtiyaçlara göre tanımlanıyor; implementasyon bu şemayı takip ediyor.
- Sen bu dokümandaki listeyi ve tabloyu onaylar veya düzeltirsin; eksik alan varsa ekleriz. Sonra kod buna göre ilerler.

---

## 2. Müşteri listesi — Ne lazım?

**Amaç:** Müşteri aradığında veya geçmişe bakmak istediğinde tek ekranda liste; arama/filtre ile hızlı bulma (Excel sayfaları arasında gezmemek).

| İhtiyaç | Açıklama |
|--------|----------|
| **Listede görünecek** | Müşteri adı (veya firma adı), iletişim (telefon veya e-posta), varsa iç kod (account numarası). |
| **Arama** | Ada veya telefona göre arama (en azından metin araması). |
| **Tıklayınca** | Müşteri kartına (detay sayfasına) gitme. |
| **Sıralama** | En son iş yapılan veya ada göre; MVP’de basit (örn. ada göre). |

**Kaynak (senin söylediklerin):** “Müşterinin ismi, adresi, neler yapılmış, ne zaman yapılmış … account numarası … geriye dönüp Excel’e bakıyoruz.”

---

## 3. Müşteri kartı — Ne lazım?

**Amaç:** Tek bir müşteri için tüm bilgiler ve geçmiş; servis/montaj ekibi adres ve iletişim görsün, geçmiş işler listelensin.

| İhtiyaç | Açıklama |
|--------|----------|
| **Kimlik / iletişim** | Ad (firma veya yetkili), telefon, e-posta, adres. Birden fazla adres/telefon olabilir (ileride ayrı tablo; MVP’de tek adres, tek telefon da yeterli olabilir). |
| **İç kod** | Müşteriye özel numara/kod (account numarası); servis formunda ve raporlarda kullanılıyor. |
| **Geçmiş** | Bu müşteriye yapılan servis ve montaj işleri: ne yapıldı, ne zaman (tarih + saat), tutar, açıklama, panel/ekran numarası, tip (servis/montaj). Liste halinde; en son üstte. |
| **Aksiyonlar** | Karttan “yeni servis/montaj” açmak, “ara” (telefon) gibi butonlar; MVP’de en azından “yeni iş” linki. |

**Kaynak (senin söylediklerin):** “Müşterinin ismi, adresi, neler yapılmış, ne zaman yapılmış, saat, tutar, açıklama, ekran numaraları … montaj mı servis mi … kullanılan malzemeler … teklif.”

---

## 4. Müşteri tablosu (SQL) — Önerilen şema

Aşağıdaki alanlar **customers** tablosu için öneridir. Supabase (PostgreSQL) ile uyumlu; gerekirse tek tek ekleme/çıkarma yapılır.

| Kolon | Tip | Zorunlu | Açıklama |
|-------|-----|--------|----------|
| **id** | `uuid` | Evet | Primary key; varsayılan `gen_random_uuid()`. |
| **account_number** | `text` | Hayır | İç kullanım için müşteri kodu (örn. "M-2024-001"). Benzersiz olabilir; liste ve formda gösterilir. |
| **name** | `text` | Evet | Müşteri adı (şahıs veya firma adı). |
| **phone** | `text` | Hayır | Birincil telefon. |
| **phone_secondary** | `text` | Hayır | İkinci telefon (isteğe). |
| **email** | `text` | Hayır | E-posta (fatura vb. için). |
| **address** | `text` | Hayır | Adres (tek satır veya birkaç satır). İleride `customer_addresses` ile çoklu adres yapılabilir. |
| **notes** | `text` | Hayır | Serbest not. |
| **created_at** | `timestamptz` | Evet | Kayıt oluşturulma zamanı; varsayılan `now()`. |
| **updated_at** | `timestamptz` | Evet | Son güncelleme; varsayılan `now()`. |

**Önerilen kısıtlar / indeksler:**

- `PRIMARY KEY (id)`
- `UNIQUE (account_number)` — account_number doluysa benzersiz olsun (boş bırakılabilir).
- Liste araması için: `CREATE INDEX idx_customers_name ON customers (name);` ve isteğe `idx_customers_phone ON customers (phone);`.

**Açık noktalar (senin kararın):**

- Müşteri **şahıs mı firma mı?** Şu an tek `name`; istersen `company_name` + `contact_name` ayrılabilir.
- **Vergi no / vergi dairesi** fatura için gerekli mi? Gerekirse `tax_id`, `tax_office` eklenir.
- **Birden fazla adres** MVP’de gerekli mi? Gerekmezse tek `address` yeterli; gerekirse sonra `customer_addresses` tablosu eklenir.

---

## 5. Geçmiş işler (servis/montaj) — Hangi tablo?

Müşteri kartında “neler yapılmış” listesi, **work_orders** (veya **service_jobs**) tablosundan gelecek: her satır bir servis veya montaj işi; `customer_id` ile müşteriye bağlı. O tablonun şeması ayrı bir dokümanda (örn. `requirements-and-schema-work-orders.md`) tanımlanacak; burada sadece ilişki:

- **customers.id** → **work_orders.customer_id** (foreign key).
- Müşteri kartında: `work_orders` tablosundan `customer_id = X` olan kayıtlar tarih/saate göre listelenir.

Böylece “müşteri” ile “yapılan işler” ayrı tutulur; liste ve kart ihtiyaçları tek tabloda karmaşık hale gelmez.

---

## 6. Özet: Sıra

1. **Bu doküman:** Müşteri listesi ve kartı için ihtiyaçlar + **customers** tablo şeması.
2. **Sen:** Eksik/yanlış alan varsa söyle; şemayı buna göre güncelleriz (şahıs/firma, vergi no, çoklu adres vb.).
3. **Sonra:**  
   - Supabase’de **customers** tablosunu bu şemaya göre oluştururuz.  
   - Müşteri listesi ve müşteri kartı ekranlarını bu alanlara göre implement ederiz.

Bu sıra “önce ne lazım ve tabloda ne var netleşsin, sonra kod” mantığına uygun; rastgele bir sistem değil, tanımlı bir modele göre ilerliyoruz.
