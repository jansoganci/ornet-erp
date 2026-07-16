# Import hazırlık notları

## Abonelik — `VERI - Sayfa7`

Hedef ekran: `/subscriptions/import`

```
❌ TUR formatı → 422 satır hata
❌ Fiyatlardaki "TL" → ~420 satır hata
❌ SIM/HAT "TL" → 243 satır hata
❌ Yıllık/6/3 aylık + boş ODEME NOTU → 231 satır hata
    ↓ (bunlar düzeltilse)
⚠️ Müşteri/lokasyon DB'de yoksa → satır satır import hatası
```

---

## SIM kart — `sim-kart-100726`

Hedef ekran: `/sim-cards/import`

```
❌ Boş AYLIK SATIS FIYAT → 1049 satır hata (yüklenmez)
❌ Boş ANA SIRKET → 1 satır (1247)
    ↓ (geri kalanlar)
✅ 1712 satır geçerli → import başlatılabilir
⚠️ Dosyada 49 tekrar hat no → atlanır
⚠️ Dosyada 3 tekrar IMSI → atlanır
⚠️ 2 satırda tarih bozuk (1218: "00-09-2019", 1491: "31-01-20224") → tarih boş kaydedilir
⚠️ DB'de zaten kayıtlı hat/IMSI varsa → atlanır
⚠️ MUSTERI UNVANI müşteriyle eşleştirilmez; sadece metin olarak kaydedilir
```
