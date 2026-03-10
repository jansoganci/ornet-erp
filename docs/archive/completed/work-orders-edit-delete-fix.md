# İş Emri Düzenleme ve Silme – Ne Neden Bozuktu, Ne Yaptık?

## 1. Düzenleme (Edit) Neden Çalışmıyordu? – Kısa Cevap

**Sorun:** Kaydet’e basınca validation hatası alıyordun; form “gönderilmedi” diyordu, console’da sadece `Hatalar: Object` görünüyordu.

**Asıl nedenler:**

1. **Forma yanlış / eksik veri doluyordu (reset).**  
   Edit modunda `reset({ ...workOrder })` ile tüm `workOrder` objesi forma veriliyordu. Bu objede şemada olmayan alanlar da vardı (örn. `company_name`, `account_no`, `assigned_workers`). Ayrıca:
   - `assigned_to` bazen dizi değil veya `null` geliyordu → schema “dizi” bekliyor.
   - `materials` içinde `quantity` 0 olan satırlar olabiliyordu → schema `quantity` için `min(1)` bekliyordu.
   Bu yüzden zod validation gizlice patlıyordu ve hangi alanın hata verdiği belli değildi.

2. **`site_id` bazen formda boş kalıyordu.**  
   Lokasyon seçili görünse bile form state’inde `site_id` bazen set edilmiyordu; submit’te “lokasyon seçin” / required hatası çıkıyordu.

**Yapılan düzeltmeler:**

- **Sadece schema’daki alanlarla reset:**  
  Artık `reset()` sadece şemada tanımlı alanlarla yapılıyor; her alan açıkça yazılıyor, `...workOrder` ile gelen ekstra alanlar forma karışmıyor.
- **`assigned_to` her zaman dizi:**  
  `Array.isArray(workOrder.assigned_to) ? workOrder.assigned_to : []` ile garanti edildi.
- **`materials[].quantity` güvenli:**  
  Hem reset’te `Math.max(1, Number(wom.quantity) || 1)` kullanıldı hem de schema’da `quantity` için `min(0)` kabul edildi (0 gelen kayıtlar artık validation’ı düşürmüyor).
- **`site_id` fallback:**  
  Submit’te `site_id` boşsa `selectedSiteId` ve `workOrder?.site_id` kullanılıyor; böylece edit modunda lokasyon seçiliyse kayıt geçiyor.
- **Validation hata logu:**  
  `onInvalid` içinde hangi alanın hata verdiği console’a yazılıyor (`Hatalı alanlar: [...]` ve her alan için mesaj).

Özet: Düzenleme, “forma giren veri şemayla uyumsuz / eksikti” ve “site_id bazen boştu” yüzünden çalışmıyordu; reset ve submit mantığı bu iki noktaya göre düzeltildi.

---

## 2. Silme (Çöp Kovası) Neden “Çalışmıyor” Gibi Görünüyordu?

**Senaryo:** Çöp kovasına basıyorsun, bazen hiçbir şey olmuyor veya silindi sanıyorsun ama iş emri listede duruyor / tekrar açılabiliyor.

**Asıl neden: Yetki (RLS).**

Veritabanında (Supabase) **sadece `admin` rolüne sahip kullanıcılar** iş emri silebiliyor. Policy: `work_orders_delete_admin` → `get_my_role() = 'admin'`.

- Senin kullandığın hesap **admin değilse** (örn. `field_worker` veya `accountant`):
  - Delete isteği Supabase’e gidiyor.
  - RLS yüzünden **hiçbir satır silinmiyor** (0 row affected).
  - Supabase bazen bu durumda **hata fırlatmıyor**; sadece 0 satır döner. Eski kodda da hata kontrolü vardı ama “0 satır silindi” kontrolü yoktu.
  - Frontend “başarılı” sanıp yönlendiriyordu; listede veri cache’ten veya tekrar fetch’ten gelince iş emri hâlâ oradaydı.

Yani “buton çalışmıyor” değil; **silme işlemi sunucuda izin verilmediği için gerçekleşmiyordu**, ama uygulama bunu bazen hata gibi göstermiyordu.

**Yapılan düzeltmeler:**

1. **Silinen satır sayısının kontrolü (api.js):**  
   Delete sonrası `.select('id')` ile silinen satırlar döndürülüyor. Eğer `deletedRows` boşsa (0 satır silindi) → **bilerek `DELETE_PERMISSION_DENIED` hatası fırlatılıyor.** Böylece “sessizce 0 satır silindi” durumu kalmadı.

2. **Net yetki mesajı (hooks.js + workOrders.json):**  
   Bu hata (ve benzeri policy/permission hataları) yakalanınca artık şu mesaj gösteriliyor:  
   *“İş emri sadece yönetici (admin) hesabı tarafından silinebilir. Hesabınızın rolünü kontrol edin.”*

3. **Yönlendirme:**  
   Silme gerçekten başarılı olduğunda `window.location.replace('/work-orders')` ile listeye tam sayfa yönlendirme yapılıyor; liste güncel veriyle yükleniyor.

**Senin yapman gereken:**

- **İş emri silebilmek için** giriş yaptığın kullanıcının **admin** olması lazım.
- Supabase Dashboard → **Table Editor** → `profiles` → ilgili kullanıcının `role` sütununu **`admin`** yap.
- Sonra aynı hesapla çöp kovasına bas: ya silinecek ve listeye yönlendirileceksin ya da (başka bir teknik hata varsa) artık “sadece admin silebilir” mesajını göreceksin.

Özet: Silme “çalışmıyor” gibi görünmesinin nedeni, RLS’in silmeye izin vermemesi ve uygulamanın bunu bazen “başarı” gibi işlemesiydi; artık 0 satır silinirse yetki hatası veriliyor ve mesaj net.
