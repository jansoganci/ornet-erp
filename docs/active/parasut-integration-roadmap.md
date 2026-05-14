# Paraşüt Entegrasyonu — Uygulama Yol Haritası (PR Blueprint)

Tarih: 2026-05-14
Statü: Planlama tamamlandı, kodlama bekliyor
İlgili dokümanlar:
- `docs/analysis/parasut-integration-audit.md` (mevcut durum denetimi)
- `CLAUDE.md` (finans modülü kuralları — değişmez referans)

---

## 0. Karara bağlanmış varsayımlar

| Konu | Karar |
|---|---|
| e-Fatura mükellefiyeti | Evet (mükellefiz). Birincil akış `e_invoices`, alıcı mükellef değilse otomatik `e_archives`. |
| Fatura kararı | `subscriptions.official_invoice` + ödeme satırındaki `should_invoice` zaten belirliyor. Yeni kural yok. |
| Onay modeli | İki adımlı: **Hazırla (müsvedde)** → **Resmileştir**. |
| Müşteri eşleştirme | Manuel + bir kerelik toplu eşleştirme. `customers.parasut_contact_id` kesin anahtar. |
| Otomatik kişi oluşturma | **Yok.** Kullanıcı checkbox ile onaylamadan Paraşüt'te kişi açılmaz. |
| Tetikleyicilerden Paraşüt yazma | **Yok.** Her fatura kullanıcı butonuyla başlar. |
| Aylık SIM cron'u | Paraşüt'e gitmez (fleet toplamı, müşteri bazlı değil). |
| Frontend'de credential | **Yok.** Tüm yazma yalnız Edge Function üzerinden. `VITE_PARASUT_*` yok. |
| İptal/iade faturası | Otomasyon yok, Paraşüt UI'dan manuel. |

---

## 1. Mimari özet

```
React UI
   │
   │ supabase.functions.invoke('parasut-dispatch', { action, payload })
   ▼
Supabase Edge Function: parasut-dispatch
   ├── core/
   │   ├── parasut-client.ts     fetch wrapper, rate limit, retry, backoff
   │   ├── oauth-store.ts        token oku/refresh/yaz (FOR UPDATE)
   │   ├── idempotency.ts        deterministic key, response cache
   │   ├── job-poller.ts         trackable_jobs polling
   │   ├── mappers.ts            ERP → Paraşüt payload dönüşümü
   │   ├── errors.ts             domain hata taksonomisi
   │   └── logger.ts             structured JSON log + audit
   ├── handlers/
   │   ├── bulk-match.ts             P1
   │   ├── create-contact.ts         P1
   │   ├── prepare-invoice.ts        P2  → müsvedde oluştur
   │   ├── finalize-invoice.ts       P2  → e-fatura/e-arşiv + job poll
   │   ├── cancel-draft.ts           P2  → sadece müsveddeyi sil
   │   ├── sync-payment.ts           P3
   │   ├── delete-payment.ts         P3
   │   └── fetch-history.ts          P4
   └── index.ts                  router
```

State machine (her `financial_transactions` income satırı için):

```
not_required  →  ready  →  draft  →  sent  →  confirmed
                   │         │         │         │
                   └─────────┴─────────┴─────────┴───→ failed
```

`confirmed`'den geri dönüş yok. `draft`'tan iptal mümkün (Paraşüt müsveddesi silinir, ERP `ready`'ye döner).

---

## 2. Yeni şema (toplu özet, fazlarda parçalanır)

```sql
-- customers
ADD parasut_contact_id TEXT UNIQUE
ADD identity_type TEXT CHECK (IN 'vkn','tckn')
ADD tax_office TEXT

-- financial_transactions (subscription_payments için zaten parasut_invoice_id var)
ADD parasut_e_document_id TEXT
ADD parasut_sync_status TEXT
  CHECK (IN 'not_required','ready','draft','sent','confirmed','failed')
ADD parasut_synced_at TIMESTAMPTZ
ADD parasut_error TEXT
ADD parasut_trackable_job_id TEXT

-- yeni tablolar
parasut_oauth_tokens          (tek satır, FOR UPDATE)
parasut_idempotency           (unique key, response cache)
parasut_match_candidates      (toplu eşleştirme sonuçları)
parasut_audit_log             (correlation_id, request/response JSONB)
```

---

## 3. Fazlar — PR bazında

Her faz **bir PR**. Bir önceki birleşmeden sonraki başlamaz. Her PR'ın **kabul kriterleri** (Tanımlı: Done) tanımlı.

---

### PR-1 · Şema temeli + müşteri eşleştirme alanları
**Branch:** `feat/parasut-01-schema-customer-matching`
**Süre:** ½ gün
**Bağımlılık:** yok

#### Dosyalar
- `supabase/migrations/00215_parasut_customer_matching.sql` (yeni)
  - `customers` → `parasut_contact_id`, `identity_type`, `tax_office`
  - `parasut_match_candidates` tablosu + RLS (admin SELECT/UPDATE)
  - `idx_customers_parasut_contact` partial index
- `src/features/customers/schema.js` — zod şemasına `identity_type`, `tax_office` ekle
- `src/features/customers/CustomerFormPage.jsx` — yeni iki alan (vergi dairesi, kimlik türü dropdown)
- `src/locales/tr/customers.json` — yeni labellar
- `docs/ai_context/SYSTEM_MAP.md` — schema güncellemesi

#### Kabul kriterleri
- [ ] Migration up/down idempotent
- [ ] Mevcut müşteri kayıtları (NULL `identity_type`) kırılmıyor
- [ ] Form'da `tax_number` girilince `identity_type` zorunlu hâle geliyor
- [ ] RLS: sadece `canWrite` yazabilir
- [ ] `make build` yeşil, lint yeşil

---

### PR-2 · OAuth altyapısı + Edge Function iskeleti
**Branch:** `feat/parasut-02-oauth-edge-function`
**Süre:** 1 gün
**Bağımlılık:** PR-1
**Ön koşul:** Paraşüt'ten `CLIENT_ID`, `CLIENT_SECRET`, kullanıcı e-posta/şifre, `company_id` temin edilmiş.

#### Dosyalar
- `supabase/migrations/00216_parasut_oauth_audit.sql` (yeni)
  - `parasut_oauth_tokens` (tek satır PK=1, FOR UPDATE pattern)
  - `parasut_audit_log` + RLS (admin SELECT)
  - `parasut_idempotency` + unique index on `key`
- `supabase/functions/parasut-dispatch/index.ts` — router (action whitelist)
- `supabase/functions/parasut-dispatch/core/parasut-client.ts`
  - `fetch` wrapper, `Authorization: Bearer`, JSON:API content-type
  - Rate limit: 8 istek / 10 sn (token bucket)
  - Retry: 429/5xx → exponential backoff + jitter, max 3 deneme
- `supabase/functions/parasut-dispatch/core/oauth-store.ts`
  - `getValidToken()` → SELECT FOR UPDATE, expiry check, refresh
  - İlk kurulum için `password` grant + `refresh_token` saklama
- `supabase/functions/parasut-dispatch/core/logger.ts`
  - JSON log + `parasut_audit_log` INSERT
- `supabase/functions/parasut-dispatch/core/errors.ts`
  - `ParasutAuthError`, `ParasutRateLimitError`, `ParasutValidationError`, `ParasutJobError`
- `supabase/functions/parasut-dispatch/handlers/ping.ts`
  - `GET /v4/{company_id}/me` çağırır, dönen şirket adını döner
- `.env.example` — yeni secret listesi (yorumla, sadece referans)
- `docs/active/parasut-integration-roadmap.md` — bu dosyayı PR-2'nin status'üyle güncelle

#### Supabase secrets (deploy öncesi)
```
PARASUT_BASE_URL=https://api.parasut.com/v4
PARASUT_OAUTH_URL=https://api.parasut.com/oauth/token
PARASUT_CLIENT_ID=...
PARASUT_CLIENT_SECRET=...
PARASUT_USERNAME=...
PARASUT_PASSWORD=...
PARASUT_COMPANY_ID=...
```

#### Kabul kriterleri
- [ ] `supabase functions invoke parasut-dispatch --body '{"action":"ping"}'` şirket adını döner
- [ ] Token refresh tek seferde olur (paralel istek race testi yapıldı)
- [ ] 429 simülasyonunda backoff devreye giriyor
- [ ] Audit log her çağrıda yazılıyor
- [ ] Frontend'de hiçbir Paraşüt referansı yok (sadece edge function invoke)

---

### PR-3 · Toplu müşteri eşleştirme + admin UI
**Branch:** `feat/parasut-03-customer-matching`
**Süre:** 1.5 gün
**Bağımlılık:** PR-2

#### Dosyalar
- `supabase/functions/parasut-dispatch/handlers/bulk-match.ts`
  - Paraşüt `GET /contacts` (sayfalı, page[size]=100)
  - Ornet customers ile match:
    - `exact_vkn` → tax_number eşit + identity_type='vkn'
    - `exact_tckn` → tax_number eşit + identity_type='tckn'
    - `name_only` → normalize edilmiş ad eşleşmesi
  - Sonuçları `parasut_match_candidates`'a yaz
  - Sadece **admin** tetikleyebilir
- `supabase/functions/parasut-dispatch/handlers/create-contact.ts`
  - Yeni müşteri için POST /contacts
  - Sadece kullanıcı onaylarsa çağrılır
- `src/features/customers/parasutMatchingApi.js` (yeni)
- `src/features/customers/parasutMatchingHooks.js` (yeni)
  - `useMatchCandidates`, `useRunBulkMatch`, `useAcceptMatch`, `useRejectMatch`
- `src/features/customers/ParasutMatchingPage.jsx` (yeni)
  - Yan yana liste UI (Ornet ↔ Paraşüt adayı)
  - Filtreler: `pending` / `accepted` / `rejected`
  - "Toplu Eşleştirmeyi Başlat" butonu (admin)
  - Otomatik eşleşenler (`exact_vkn/exact_tckn`) tek tık onay
- `src/App.jsx` — route ekle: `/customers/parasut-matching` (admin guard)
- `src/components/layout/navItems.js` — "Ayarlar" altına link
- `src/locales/tr/customers.json` — yeni stringler

#### Kabul kriterleri
- [ ] Bir test müşterisi (Paraşüt'te var) ile exact_vkn match doğru çalışıyor
- [ ] `parasut_contact_id` UNIQUE constraint çakışmaları handle ediliyor
- [ ] "Kabul Et" sonrası `customers.parasut_contact_id` doluyor
- [ ] Bulk match idempotent — iki kez çalıştırılınca duplicate row yok
- [ ] Sadece admin görüyor ve çalıştırabiliyor

---

### PR-4 · Fatura kesim akışı — Abonelik ödemeleri (en sık kullanılan)
**Branch:** `feat/parasut-04-invoice-subscription`
**Süre:** 2.5 gün
**Bağımlılık:** PR-3
**En kritik PR.** Üretim için zorunlu test senaryoları aşağıda.

#### Dosyalar
- `supabase/migrations/00217_parasut_sync_status.sql`
  - `financial_transactions` → `parasut_e_document_id`, `parasut_sync_status`, `parasut_synced_at`, `parasut_error`, `parasut_trackable_job_id`
  - Index: `idx_ft_parasut_sync_status` (where status in ('ready','draft','sent'))
  - Trigger: subscription_payment paid + official_invoice=true + should_invoice=true olduğunda → ilgili financial_transaction satırının `parasut_sync_status='ready'` olarak işaretlenmesi
- `supabase/functions/parasut-dispatch/core/idempotency.ts`
  - Key formatı: `invoice:financial_tx:{uuid}:v1`
  - `acquire` → INSERT … ON CONFLICT DO NOTHING, çatışırsa eski response döndür
- `supabase/functions/parasut-dispatch/core/mappers.ts`
  - `financialTxToSalesInvoicePayload(tx, customer)` — JSON:API formatına çevir
  - KDV, kur, kalemler, açıklama, tarih (YYYY-MM-DD, Türkiye saati)
- `supabase/functions/parasut-dispatch/core/job-poller.ts`
  - Trackable job poll: 2sn → 5sn → 10sn → 20sn (max 60sn)
- `supabase/functions/parasut-dispatch/handlers/prepare-invoice.ts`
  - Input: `financial_transaction_id`
  - Doğrulama: customer.parasut_contact_id var mı, identity_type/tax_office dolu mu, tutar > 0, KDV mantıklı mı
  - POST /sales_invoices (henüz e-belge yok = müsvedde)
  - `parasut_sync_status='draft'`, `parasut_invoice_id` yaz
- `supabase/functions/parasut-dispatch/handlers/finalize-invoice.ts`
  - Önce GET /e_invoice_inboxes?filter[vkn]=... → mükellef mi?
  - Mükellefse POST /e_invoices, değilse POST /e_archives
  - trackable_job_id sakla, poll et
  - Başarıda `parasut_sync_status='confirmed'`, `parasut_e_document_id` yaz
- `supabase/functions/parasut-dispatch/handlers/cancel-draft.ts`
  - Sadece status='draft' iken çalışır
  - DELETE /sales_invoices/{id}
  - ERP'de `parasut_sync_status='ready'`'ye geri al
- `src/features/finance/parasutApi.js` (yeni)
- `src/features/finance/parasutHooks.js` (yeni)
- `src/features/finance/components/ParasutInvoicePanel.jsx` (yeni)
  - State'e göre buton: Hazırla / Resmileştir / İptal Et / Görüntüle
  - Önizleme modal'ı: kalemler, KDV, toplam, alıcı, kararı (e-fatura/e-arşiv)
  - `confirmed` rozet + Paraşüt link
- `src/features/subscriptions/SubscriptionDetailPage.jsx` — panel'i ödemeler bölümüne entegre et
- `src/locales/tr/finance.json` — yeni stringler

#### Test senaryoları (zorunlu, manuel)
1. ✅ official_invoice=true + e-Fatura mükellefi alıcı → e_invoices, confirmed
2. ✅ official_invoice=true + e-Fatura mükellefi olmayan alıcı → e_archives, confirmed
3. ✅ official_invoice=false → ParasutInvoicePanel görünmez (sync_status='not_required')
4. ✅ should_invoice=false (peşin nakit, makbuzsuz) → panel görünmez
5. ✅ `parasut_contact_id` yok → "Hazırla" butonu disabled, eşleştirme linki gösterilir
6. ✅ Müsvedde oluştu → "İptal Et" basıldı → Paraşüt'te silindi, ERP `ready` döndü
7. ✅ Müsvedde → Resmileştir → trackable_job error → status='failed', hata mesajı UI'da
8. ✅ Aynı transaction için "Hazırla" iki kez tıklanırsa idempotency çalışıyor (tek müsvedde)
9. ✅ Resmileştir başarılı → "İptal Et" butonu görünmüyor (geri dönüş yok)

#### Kabul kriterleri
- [ ] 9 senaryonun hepsi yeşil (manuel test + ekran görüntüsü PR'a eklenir)
- [ ] Audit log her aşamada doğru satır yazıyor
- [ ] `parasut_sync_status` state machine ihlal edilmiyor (DB constraint veya trigger)
- [ ] `confirmed` sonrası iptal endpoint'i 403 dönüyor

---

### PR-5 · Tahsilat senkronizasyonu (kısmi ödeme dahil)
**Branch:** `feat/parasut-05-payment-sync`
**Süre:** 1.5 gün
**Bağımlılık:** PR-4

#### Dosyalar
- `supabase/functions/parasut-dispatch/handlers/sync-payment.ts`
  - Input: `financial_transaction_payment_id`
  - Parent transaction `parasut_invoice_id` var mı kontrolü
  - POST /sales_invoices/{id}/payments
  - Dönen `payment_id` ve `transaction_id`'yi `financial_transaction_payments`'a yaz
- `supabase/functions/parasut-dispatch/handlers/delete-payment.ts`
  - Input: `financial_transaction_payment_id`
  - DELETE /transactions/{transaction_id}
- `supabase/migrations/00218_parasut_payment_meta.sql`
  - `financial_transaction_payments` → `parasut_payment_id`, `parasut_transaction_id`, `parasut_synced_at`
- `src/features/finance/CollectionDeskPage.jsx` — tahsilat sonrası otomatik invoke (eğer parent'ta `parasut_invoice_id` varsa)
- `src/features/finance/PaymentsList.jsx` (varsa) — payment satırında "Paraşüt'e senkronize edildi" rozeti

#### Kabul kriterleri
- [ ] Kısmi ödeme: 1000 TL faturaya 400 + 600 ayrı ayrı senkron, Paraşüt'te `remaining=0`
- [ ] Ödeme silme: ERP'den DELETE → Paraşüt'ten de silindi
- [ ] Parent'ta `parasut_invoice_id` yoksa sessizce skip (hata değil, sadece audit log)

---

### PR-6 · Teklif & bağımsız iş emri fatura akışı
**Branch:** `feat/parasut-06-invoice-proposal-wo`
**Süre:** 1.5 gün
**Bağımlılık:** PR-4

PR-4'teki `ParasutInvoicePanel` zaten generic — sadece `ProposalDetailPage` ve `WorkOrderDetailPage`'e entegrasyon + mapper'da kalemleri çıkarma farkı.

#### Dosyalar
- `supabase/functions/parasut-dispatch/core/mappers.ts` — `proposalToInvoicePayload`, `workOrderToInvoicePayload`
- `src/features/proposals/ProposalDetailPage.jsx` — panel ekle (proposal `completed` iken görünür)
- `src/features/work-orders/WorkOrderDetailPage.jsx` — panel ekle (WO `completed` + `proposal_id IS NULL` iken görünür)

#### Kabul kriterleri
- [ ] Teklif kalemleri Paraşüt faturasında doğru görünüyor (birim, miktar, KDV)
- [ ] Proposal'a bağlı WO için panel görünmüyor (çift fatura riski yok)
- [ ] USD bazlı teklif için kur Paraşüt'e doğru gönderiliyor

---

### PR-7 · Read-only geçmiş + müşteri detay sekmesi
**Branch:** `feat/parasut-07-history-tab`
**Süre:** 1 gün
**Bağımlılık:** PR-3

#### Dosyalar
- `supabase/functions/parasut-dispatch/handlers/fetch-history.ts`
  - Input: `customer_id`
  - GET /sales_invoices?filter[contact_id]=X&include=payments,active_e_document
  - Sayfalı, sadece son 12 ay
- `src/features/customers/CustomerDetailPage.jsx` — yeni "Paraşüt Faturaları" sekmesi
- `src/features/customers/components/ParasutHistoryTab.jsx` (yeni)

#### Kabul kriterleri
- [ ] Müşteri detay sayfasında geçmiş faturalar tablosu (tarih, no, tutar, ödeme durumu)
- [ ] `parasut_contact_id` yoksa boş state + eşleştirme linki

---

### PR-8 · Gün sonu mutabakat + Sentry alarmları
**Branch:** `feat/parasut-08-reconciliation`
**Süre:** ½ gün
**Bağımlılık:** PR-6

#### Dosyalar
- `supabase/functions/parasut-reconcile/index.ts` (yeni cron function)
  - Günde 1 kez 02:30 UTC çalışır
  - ERP: dünkü `parasut_sync_status='confirmed'` count + sum
  - Paraşüt: `?filter[issue_date]=yyyy-mm-dd` count + sum
  - Fark varsa `parasut_audit_log` + Sentry alarm
- Sentry tag'leri: `parasut.operation`, `parasut.http_status`, `parasut.job_status`
- `src/features/finance/components/ParasutHealthCard.jsx` — finans dashboard'a küçük kart
  - Son 24 saat: başarılı / failed / pending kontrolü
  - Failed varsa kırmızı rozet

#### Kabul kriterleri
- [ ] Manuel fark senaryosu test edildi (DB'de bir confirmed satır silinsin → alarm)
- [ ] Sentry'de Paraşüt errorları ayrı filtrelenebiliyor

---

## 4. Toplam efor & sıralama

| PR | İçerik | Süre | Paralel? |
|---|---|---|---|
| PR-1 | Şema temeli | ½ gün | — |
| PR-2 | OAuth + edge function | 1 gün | — |
| PR-3 | Müşteri eşleştirme | 1.5 gün | — |
| PR-4 | Abonelik faturası | 2.5 gün | — |
| PR-5 | Tahsilat senkronu | 1.5 gün | PR-6 ile paralel olabilir |
| PR-6 | Teklif & WO faturası | 1.5 gün | PR-5 ile paralel olabilir |
| PR-7 | Read-only geçmiş | 1 gün | PR-5/6 ile paralel olabilir |
| PR-8 | Mutabakat + Sentry | ½ gün | En son |

**Toplam:** ~10 iş günü tek geliştirici, paralel çalışırsa ~7 iş günü.

İlk değer hızlı gelir: **PR-1 → PR-4** bittiğinde abonelik tahsilatı tamamen Paraşüt'e gidiyor (= günlük en sık kullanılan akış).

---

## 5. Geri dönüş planı (rollback)

Her PR için:
- Migration'lar idempotent + reversible (`DROP COLUMN IF EXISTS`, `DROP TABLE IF EXISTS`).
- Edge function deploy edilmeden frontend'de bir feature flag: `VITE_PARASUT_ENABLED=false` ile UI tamamen gizli kalır.
- Üretim sorununda: feature flag kapat → veriler veritabanında kalır, eski akış (manuel fatura) devam eder.
- `parasut_contact_id` ve `parasut_invoice_id` kolonları geri alınmaz — gelecek için saklanır.

---

## 6. Açık riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Resmileştirilmiş yanlış faturaya iptal faturası gerekmesi | Yüksek (operasyonel maliyet) | İki adımlı onay + zorunlu önizleme + `parasut_contact_id` doğrulaması |
| Aynı transaction için çift fatura | Yüksek | Idempotency tablosu + DB unique constraint |
| Token refresh race condition | Orta | `SELECT FOR UPDATE` + tek refresh point |
| Paraşüt rate limit aşımı | Düşük | 8/10sn token bucket + retry |
| Yanlış e-fatura/e-arşiv kararı | Yüksek | Her seferinde canlı `e_invoice_inboxes` sorgu, cache yok |
| trackable_job timeout | Orta | 60sn poll, sonra failed işaretle + manuel retry butonu |
| Müşteri yanlış eşleştirildi | Yüksek | Sadece `exact_vkn`/`exact_tckn` otomatik, ad eşleşmesi manuel onay |

---

## 7. Faz dışı (gelecek için not)

Bu yol haritası kapsamında **olmayan** ama ileride değerlendirilebilecek:
- Paraşüt → Ornet gider faturası içe çekme (Module 13 v2)
- Webhook tabanlı tahsilat geri besleme (Paraşüt → Ornet)
- Çoklu şirket (multi-company) desteği
- e-İrsaliye, e-SMM entegrasyonları
- İade faturası otomasyonu

---

## 8. Hazırda olması gereken ön koşullar (kodlamadan önce)

- [ ] Paraşüt'ten OAuth credential paketi alınmış (`client_id`, `client_secret`, kullanıcı, şifre, `company_id`)
- [ ] Paraşüt'te test/sandbox şirket açılmış (üretim verisini kirletmemek için)
- [ ] Test e-Fatura mükellefi VKN listesi hazır (en az 1 mükellef + 1 mükellef olmayan)
- [ ] Mevcut müşterilerin VKN/TCKN ve vergi dairesi verisinin tamlığı incelendi (eksikse PR-1 sonrası backfill ekrani gerekebilir)
- [ ] Sentry projesi ayağa kalkmış (`VITE_SENTRY_DSN` dolu)

---

## 9. Statü takibi

PR'lar birleştikçe bu dosyanın başına işaret konur:

```
PR-1  [ ] Şema temeli
PR-2  [ ] OAuth + Edge Function
PR-3  [ ] Müşteri eşleştirme
PR-4  [ ] Abonelik faturası
PR-5  [ ] Tahsilat senkronu
PR-6  [ ] Teklif & WO faturası
PR-7  [ ] Geçmiş sekmesi
PR-8  [ ] Mutabakat + alarm
```

PR-8 yeşilse bu dosya `docs/archive/completed/` altına taşınır.
