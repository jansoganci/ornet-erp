# Turkcell Fatura Analizi — Hedef ve Vizyon

**Tarih:** 9 Mart 2025  
**PDF Örneği:** TURKCELL GPRS HATLAR MART 26.pdf

---

## 1. Senin Hedefin (Özet)

**Excel yok.** Envanter zaten Ornet ERP’de (`sim_cards` tablosu).

**Her ay sadece PDF yükle** → Turkcell fatura PDF’i → Sistem analiz etsin.

**Görmek istediğin bilgiler:**

| Bilgi | Açıklama |
|-------|----------|
| **Faturada olup envanterde olmayan** | Turkcell “bu hatlar size tanımlı” diyor ama sizde yok. Örn: 5 hat → ~1100 TL/ay boşuna ödeme |
| **Fiyat tutarsızlıkları** | Size bildirilen fiyat ≠ faturadaki fiyat. Statü/tarife değişmiş, haber verilmemiş |
| **Paket aşımı** | Paket limitini aşan hatlar → yüksek fatura (örn. 6 TL yerine 1223 TL) |
| **Zarar eden hatlar** | Satış < fatura → zarar |
| **Genel kar/zarar** | Toplam gelir vs toplam fatura |
| **Görselleştirme** | Grafikler, özet kartlar, tablolar |

---

## 2. PDF Formatı (Doğrulandı)

Örnek satırlar:
```
F2-5312148492?M2m Standart Tarifesi#6$6+0.91!0.46
F2-5354527967?M2m Standart Tarifesi#5.8$5.8+0.88!0.44
F2-5354527967?M2m Standart Tarifesi#0.4$0.4+0.06!0.03   ← düşük (indirim?)
F2-5356052579?Kurumsal Blg Internet Tarifesi#1223.9$1223.9+173.52!86.76  ← paket aşımı!
```

**Format:** `F2-{10 hane}?{tarife}#{faturaTutari}${odenecek}+{kdv}!{oiv}`

**Gözlemler:**
- M2m Standart: 4.7, 5, 5.8, 5.9, 6 TL (fiyat farkları)
- Kurumsal Blg Internet: 245, 930, 1223 TL (paket aşımı)
- Eşleştirme anahtarı: 10 haneli hat no (5XXXXXXXXX)

---

## 3. Veri Kaynakları

| Kaynak | Nereden | Ne içeriyor |
|--------|---------|-------------|
| **Envanter** | Ornet `sim_cards` | phone_number, cost_price, sale_price, buyer, customer, site |
| **Fatura** | PDF upload | hatNo, tarife, faturaTutari, odenecek, kdv, oiv |

**Karşılaştırma anahtarı:** `phone_number` (10 hane) = PDF’deki hat no

---

## 4. Çıkarılacak Bilgiler (İş Mantığı)

### 4.1 Faturada Olup Envanterde Olmayan
- PDF’de var, `sim_cards`’da yok
- **Anlam:** Turkcell size fatura kesiyor, siz bu hatları kullanmıyorsunuz / bilmiyorsunuz
- **Örnek:** 5 hat × ~220 TL ≈ 1100 TL/ay boşuna

### 4.2 Envanterde Olup Faturada Olmayan
- `sim_cards`’da var, PDF’de yok
- **Anlam:** Bu ay faturada görünmüyor (iptal? geçici? hata?)

### 4.3 Fiyat Tutarsızlığı
- Envanterdeki `cost_price` ≠ PDF’deki fatura tutarı
- **Anlam:** Turkcell fiyat/statü değiştirmiş, size bildirmemiş

### 4.4 Paket Aşımı
- Fatura tutarı beklenenden çok yüksek (örn. 6 TL yerine 200+ TL)
- **Anlam:** Hat paket limitini aşmış, ek ücret gelmiş

### 4.5 Zarar Eden Hatlar
- `sale_price` < fatura tutarı
- **Anlam:** Bu hattan zarar ediyorsunuz

### 4.6 Genel Kar/Zarar
- Toplam satış (sale_price) vs toplam fatura
- Aylık özet

---

## 5. Önerilen Akış

```
1. Kullanıcı: "Mart 2026 Faturası" için PDF yükler
2. Sistem: PDF parse → hat listesi (hatNo, tarife, tutar, kdv, oiv)
3. Sistem: sim_cards’dan TURKCELL hatlarını çeker (operator = TURKCELL)
4. Sistem: phone_number’ı 10 haneye normalize eder
5. Karşılaştırma:
   - Faturada olup envanterde olmayan
   - Envanterde olup faturada olmayan
   - Eşleşenler → fiyat farkı, kar/zarar
6. Görselleştirme: Kartlar, tablolar, grafikler
7. (Opsiyonel) Fatura kaydı DB’ye yazılır → aylık geçmiş
```

---

## 6. Sonraki Adım

Bu vizyon doğruysa, sıradaki adım:

1. **PDF parse** — Turkcell Cost Clarity’deki mantığı Ornet’e taşı
2. **Yeni sayfa** — Örn: `/sim-cards/invoice-analysis` veya `/turkcell-invoice`
3. **Karşılaştırma** — sim_cards (TURKCELL) vs PDF
4. **UI** — Özet kartlar, uyarılar, tablolar, grafikler

Onaylıyor musun? Varsa eklemek istediğin noktaları yaz, sonra teknik plana geçelim.
