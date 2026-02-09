# Takvim Ekranı UI/UX Analizi

**Sayfa:** `/calendar` (Takvim)  
**Amaç:** Mevcut sorunları tespit etmek, görsel ve kullanılabilirlik iyileştirmeleri için yol haritası sunmak.  
**Değişiklik yapılmadı; sadece analiz.**

---

## 1. Mevcut Durum Özeti

- **Kütüphane:** `react-big-calendar` + drag&drop eklentisi.
- **Görünüm:** Kütüphanenin varsayılan CSS’i kullanılıyor (`react-big-calendar.css`), proje tasarım sistemi (design-system.md) ve dark mode ile uyumlu özel stil yok.
- **Araç çubuğu:** Kütüphane toolbar’ı kapatılmış (`toolbar={false}`); üstte özel butonlar (Haftalık/Aylık, Yeni İş Emri, Bugün, Önceki, Sonraki) ve altında iki filtre (Durum, Tip) var.
- **Olay stilleri:** İş emri durumuna göre renk sınıfları veriliyor (utils.js – `getEventClassName`), fakat takvim grid’i ve başlıklar kütüphane varsayılanında.

---

## 2. Tespit Edilen Sorunlar

### 2.1 Görsel / Tasarım

| Sorun | Açıklama |
|-------|----------|
| **Tasarım sistemi dışında** | Kırmızı marka, warm stone nötrler ve design-system’deki renkler takvim grid’ine, başlıklara, saat çubuğuna yansımıyor. Varsayılan CSS gri/mavi tonlarda, “generic” görünüyor. |
| **Dark mode uyumsuzluğu** | Sayfa dark modda olsa bile takvim içi arka plan, metin ve çizgiler kütüphane default’unda; çoğu yerde açık renk arka plan ve koyu metin kalıyor. Kontrast ve bütünlük bozuluyor. |
| **Bugün vurgusu zayıf** | “Bugün” kolonu/satırı hafif mavi/gri ile vurgulanıyor; projedeki primary (kırmızı) veya net bir “today” rengi kullanılmıyor. |
| **Boş alan hissi** | Event yoksa grid tamamen boş; zaman dilimleri ve günler belirgin, ama “bu hafta/ay boş” mesajı dışında görsel bir yönlendirme veya rahatlatıcı boş durum (illustration, kısa açıklama) yok. |
| **Tipografi ve yoğunluk** | Saat ve gün etiketleri kütüphane default font/boyutunda; proje tipografi token’ları (font-medium, text-sm vb.) tutarlı uygulanmıyor. |

### 2.2 Kontrol Yerleşimi ve Hiyerarşi (UX)

| Sorun | Açıklama |
|-------|----------|
| **Butonların hepsi aynı ağırlıkta** | “Haftalık / Aylık” görünüm seçici ile “Yeni İş Emri”, “Bugün”, “Önceki”, “Sonraki” aynı satırda ve benzer stil (hepsi kırmızı/outline). Birincil aksiyon (Yeni İş Emri) ile navigasyon (Önceki/Sonraki) görsel olarak aynı seviyede. |
| **Filtreler kopuk** | “Durum” ve “Tip” filtreleri başlık/butonların altında ayrı bir satırda; mobilde wrap olunca takvimle ilişkileri zayıf hissediliyor, “ne filtrelediğim” net değil. |
| **Tarih bağlamı zayıf** | Hangi hafta/ay görüntülendiği sadece grid başlıklarından (02 Pzt, 03 Sal…) anlaşılıyor; büyük, okunaklı “Şubat 2026” veya “2–8 Şubat 2026” gibi bir label yok. |
| **Mobil deneyim** | Butonlar wrap olunca çok satıra yayılıyor; “Bugün” ve “Önceki/Sonraki” için daha kompakt bir grup (örn. tek bir “navigasyon” grubu) düşünülebilir. |

### 2.3 Teknik / Stil Kaynağı

| Sorun | Açıklama |
|-------|----------|
| **Varsayılan .rbc-* CSS** | Tüm grid, slot, header stilleri kütüphanenin default CSS’inden geliyor. Projede `.rbc-calendar` veya `.rbc-time-view` vb. için override yok. |
| **Renkler CSS değişkenlerine bağlı değil** | Design system’deki `--color-primary-*`, `--color-neutral-*` ve dark mode değişkenleri takvimde kullanılmıyor. |
| **Event stilleri** | Sadece `eventPropGetter` ile class veriliyor; kütüphane event yüksekliği, padding, border-radius gibi detaylar default’ta, proje border-radius / gölge kurallarıyla uyumlu olmayabilir. |

---

## 3. İyileştirme Önerileri (Öncelik Sırasıyla)

### 3.1 Yüksek Öncelik (Görsel bütünlük ve dark mode)

1. **Takvim için özel CSS dosyası**
   - `src/features/calendar/CalendarOverrides.css` (veya `index.css` içinde bir blok) oluşturup `.rbc-calendar` ve alt sınıfları override etmek.
   - Arka plan: light’ta `surface`, dark’ta `#171717` / `#0a0a0a`.
   - Metin: primary text ve secondary text için design system renkleri.
   - Çizgiler: `border-neutral-200` / dark’ta `#262626`.
   - Bugün hücresi: `.rbc-today` için primary-50/primary-100 (açık vurgu) veya primary-500’den türeyen hafif arka plan.

2. **Dark mode**
   - Tüm `.rbc-*` arka plan, metin ve border’ları `.dark .rbc-calendar { ... }` (veya `&:where(.dark)`) ile dark token’lara çekmek.
   - Böylece takvim, uygulamanın geri kalanıyla aynı dark tema hissini verir.

3. **Tarih bağlamı**
   - Toolbar’da (veya PageHeader description’da) görünen aralığı net gösteren bir label:
     - Haftalık: “2–8 Şubat 2026”
     - Aylık: “Şubat 2026”
   - İsteğe bağlı: Bu label’a tıklanınca date picker ile hafta/ay atlama.

### 3.2 Orta Öncelik (Hiyerarşi ve kontrol düzeni)

4. **Buton hiyerarşisi**
   - **Birincil:** “Yeni İş Emri” – tek belirgin primary (kırmızı) buton.
   - **İkincil:** “Bugün” – outline veya ghost.
   - **Navigasyon:** “Önceki” / “Sonraki” – daha küçük veya icon-only (chevron) veya tek grupta “< Bugün >” gibi.

5. **Görünüm seçici**
   - Haftalık/Aylık’ı segmented control olarak bırakabilirsin; rengi primary ile uyumlu yap (zaten öyle ama border/background’u design system ile netleştir).

6. **Filtreler**
   - Durum ve Tip’i takvim kutusunun hemen üstünde, sağa hizalı veya takvimle aynı kartın içinde “Filtreler” satırı gibi konumlayabilirsin; mobilde collapsible “Filtreler” ile tek satırda toplanabilir.

### 3.3 Düşük Öncelik (İnce ayar ve boş durum)

7. **Event görünümü**
   - Border-radius, gölge ve padding’i design system’e göre ayarlamak (CSS override ile `.rbc-event`).
   - “Seçili” event için daha belirgin border (örn. primary-500).

8. **Boş durum**
   - EmptyState bileşeni kullanılıyor; metin yanında kısa bir “Yeni iş emri ekleyerek başlayın” ve birincil aksiyon butonu tekrarlanabilir. İsteğe bağlı: hafif bir illustration veya ikon.

9. **Saat çubuğu ve slotlar**
   - Çalışma saatleri (örn. 08:00–18:00) varsa, dışındaki saatleri daha soluk göstermek (opsiyonel).
   - Şu anki 00:00–23:00 yerine 06:00–22:00 gibi sınır + minSlotHeight ile okunaklı yükseklik tercih edilebilir.

---

## 4. Teknik Notlar (Uygularken)

- **react-big-calendar stilleri:** Resmi dokümantasyonda önerilen yol, kütüphane CSS’ini import ettikten sonra kendi CSS’inle override etmek. `!important` mümkün olduğunca az; spesifiklik artırarak (`.calendar-wrapper .rbc-calendar .rbc-time-view` gibi) çözmek daha sürdürülebilir.
- **Dark mode:** Tailwind’de `dark:` kullanıyorsan, takvim wrapper’ına `dark` class’ı sayfa/theme ile geliyor olmalı; override’larında `:where(.dark) .rbc-calendar { ... }` veya Tailwind’in dark variant’ı ile aynı mantık kullanılabilir.
- **components prop:** İleride header hücrelerine özel bileşen (tarih formatı, bugün vurgusu) vermek istersen, `components` prop ile `rbc-header` vb. özelleştirilebilir; ilk adım için sadece CSS yeterli.

---

## 5. Özet

| Kategori | Ana sorun | Önerilen ilk adım |
|----------|-----------|--------------------|
| Görsel | Takvim, design system ve dark mode dışında | Takvim için override CSS + dark tema |
| Hiyerarşi | Tüm butonlar aynı ağırlıkta | Yeni İş Emri primary, diğerleri secondary/ghost, navigasyon kompakt |
| Bağlam | Hangi hafta/ay belli değil | Toolbar’da “2–8 Şubat 2026” / “Şubat 2026” label |
| Filtreler | Takvimden kopuk hissediliyor | Takvim kutusuna yakın, aynı blokta veya collapsible |

İlk uygulama için en büyük kazanç: **takvim için ayrı bir override CSS ile design system renkleri + dark mode** ve **toolbar’da görünen tarih aralığı**. Sonrasında buton hiyerarşisi ve filtre yerleşimi güncellenebilir.
