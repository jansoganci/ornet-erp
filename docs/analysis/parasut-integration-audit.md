# Paraşüt Integration Audit

Date: 2026-05-14  
Scope: Full repository scan + full-file reads for all `parasut` / `Paraşüt` matches (code, migrations, frontend, docs, env)  
Mode: Read-only analysis, report-only output

---

## 1. Current Parasut References Summary

Below are all file+line matches for `parasut|paraşüt|parasüt|paraşut` found in the repository.

### A) Live code / schema / frontend

- `supabase/migrations/00040_financial_transactions.sql:54` — `parasut_invoice_id    TEXT,`
- `supabase/migrations/00016_subscriptions.sql:195` — `parasut_invoice_id  TEXT,`
- `src/locales/tr/subscriptions.json:181` — `"officialInvoice": "Resmi fatura (Paraşüt'e gönderilir)",`

### B) Docs (current + archive; planning/history)

- `docs/subscription-billing-automation-audit.md:137` — `` `parasut_invoice_id` field exists ... zero Parasut API integration ``
- `docs/subscription-billing-automation-audit.md:223` — `` `parasut_invoice_id` | TEXT | Always NULL — Parasut not integrated ``
- `docs/archive/deprecated/plan-customer-situation.md:56` — `**Paraşüt** → placeholder button, no action yet`
- `docs/archive/deprecated/plan-customer-situation.md:204` — `Paraşüt integration (placeholder only)`
- `docs/archive/deprecated/active-plans-consolidated.md:64` — `**Paraşüt** → placeholder button, no action yet`
- `docs/archive/deprecated/active-plans-consolidated.md:212` — `Paraşüt integration (placeholder only)`
- `docs/archive/deprecated/MASTER_PENDING_TASKS.md:32` — `... SituationActionsMenu ... Paraşüt placeholder`
- `docs/archive/deprecated/MASTER_PENDING_TASKS.md:66` — `Paraşüt integration (placeholder only)`
- `docs/archive/completed/tech-stack.md:17` — `... webhook, Paraşüt/ödeme entegrasyonu ...`
- `docs/archive/completed/subscriptions-overview.md:190` — `... Paraşüt/Iyzico integration planned`
- `docs/archive/completed/subscription-system-architecture.md:320` — `parasut_invoice_id  TEXT, -- Parasut API reference ...`
- `docs/archive/completed/subscription-system-architecture.md:590` — `... invoice_no manually (from Parasut)`
- `docs/archive/completed/subscription-system-architecture.md:596` — `... calls Parasut for invoice`
- `docs/archive/completed/subscription-system-architecture.md:935` — `| Parasut | Parasut Muhasebe | ... |`
- `docs/archive/completed/subscription-implementation-plan.md:357` — `... auto-generate invoices via Parasut API ...`
- `docs/archive/completed/subscription-implementation-plan.md:409` — `### Step 2.4: Parasut Invoice Integration`
- `docs/archive/completed/subscription-implementation-plan.md:411` — `Register Parasut API access`
- `docs/archive/completed/subscription-implementation-plan.md:412` — `Create src/lib/parasut.js`
- `docs/archive/completed/subscription-implementation-plan.md:416` — `Call Parasut API to create sales invoice`
- `docs/archive/completed/subscription-implementation-plan.md:417` — `Store parasut_invoice_id ...`
- `docs/archive/completed/subscription-implementation-plan.md:421` — `Handle Parasut API errors ...`
- `docs/archive/completed/subscription-implementation-plan.md:444` — `` `src/lib/parasut.js` — Parasut API client ``
- `docs/archive/completed/subscription-implementation-plan.md:552` — `2.4 Parasut integration`
- `docs/archive/completed/subscription-implementation-plan.md:569` — `... external service accounts (Iyzico, Parasut) ...`
- `docs/archive/completed/sim-card-management-status.md:40` — `Invoice | Paraşüt / invoice integration | ❌ | Planned`
- `docs/archive/completed/sim-card-management-status.md:79` — `Invoice integration | Paraşüt / invoice automation`
- `docs/archive/completed/roadmap.md:65` — `... fatura tetikleme (Paraşüt API) ...`
- `docs/archive/completed/roadmap.md:70` — `Fatura tetikleme (Paraşüt) ...`
- `docs/archive/completed/proposals-module-roadmap.md:9` — `... financial records + Paraşüt`
- `docs/archive/completed/proposals-module-roadmap.md:83` — `... sync with ... Paraşüt`
- `docs/archive/completed/proposals-module-roadmap.md:84` — `... not sent to Paraşüt`
- `docs/archive/completed/proposals-module-roadmap.md:103` — `... financial transaction + Paraşüt sync`
- `docs/archive/completed/proposals-module-architecture.md:120` — `-- Paraşüt sync`
- `docs/archive/completed/proposals-module-architecture.md:121` — `parasut_invoice_id  TEXT, -- Returned from Paraşüt API`
- `docs/archive/completed/proposals-module-architecture.md:122` — `parasut_synced_at   TIMESTAMPTZ,`
- `docs/archive/completed/proposals-module-architecture.md:123` — `parasut_error       TEXT,`
- `docs/archive/completed/proposals-module-architecture.md:307` — `No Paraşüt`
- `docs/archive/completed/proposals-module-architecture.md:310` — `→ Paraşüt sync`
- `docs/archive/completed/proposals-module-architecture.md:464` — `... No Paraşüt sync`
- `docs/archive/completed/proposals-module-architecture.md:465` — `... fire Paraşüt sync`
- `docs/archive/completed/proposals-module-architecture.md:574` — `### 4.2 Paraşüt API`
- `docs/archive/completed/proposals-module-architecture.md:576` — `Paraşüt is a Turkish cloud accounting platform ...`
- `docs/archive/completed/proposals-module-architecture.md:580` — `POST https://api.parasut.com/oauth/token`
- `docs/archive/completed/proposals-module-architecture.md:591` — `POST https://api.parasut.com/v4/{company_id}/sales_invoices`
- `docs/archive/completed/proposals-module-architecture.md:605` — `"<parasut_contact_id>"`
- `docs/archive/completed/proposals-module-architecture.md:628` — `Supabase Edge Function: /functions/v1/parasut-sync`
- `docs/archive/completed/proposals-module-architecture.md:634` — `Map to Paraşüt invoice payload`
- `docs/archive/completed/proposals-module-architecture.md:635` — `POST to Paraşüt API`
- `docs/archive/completed/proposals-module-architecture.md:636` — `update ... parasut_invoice_id + parasut_synced_at`
- `docs/archive/completed/proposals-module-architecture.md:637` — `update ... parasut_error`
- `docs/archive/completed/proposals-module-architecture.md:640` — `... parasut_contact_id ...`
- `docs/archive/completed/proposals-module-architecture.md:711` — `Phase 4 — Paraşüt Integration`
- `docs/archive/completed/proposals-module-architecture.md:712` — `Paraşüt Edge Function`
- `docs/archive/completed/proposals-module-architecture.md:716` — `` `parasut_contact_id` on customers table ``
- `docs/archive/completed/proposals-module-architecture.md:723` — `Paraşüt credentials ... client_id/client_secret ...`
- `docs/archive/completed/notification-system-concept.md:13` — `... requiring Parasut ...`
- `docs/archive/completed/notification-system-concept.md:125` — `PHASE 2 — After Parasut / iyzico integration`
- `docs/archive/completed/notification-system-concept.md:131` — `Source: Parasut`
- `docs/archive/completed/notification-system-concept.md:138` — `Dependency: Parasut + subscription integration`
- `docs/archive/completed/notification-system-architecture.md:583` — `Phase 2 types (Parasut, iyzico) deferred`
- `docs/archive/completed/finance_module_master_spec_v3.md:63` — `... pending verification | Parasut API integration`
- `docs/archive/completed/finance_module_master_spec_v3.md:95` — `No integration — Excel, Parasut, ERP disconnected`
- `docs/archive/completed/finance_module_master_spec_v3.md:363` — `parasut_invoice_id    TEXT,`
- `docs/archive/completed/finance_module_master_spec_v3.md:1096` — `Module 13: Parasut API Integration`
- `docs/archive/completed/finance_module_master_spec_v3.md:1100` — `... push to Parasut`
- `docs/archive/completed/finance_module_master_spec_v3.md:1102` — `... Push to Parasut API ...`
- `docs/archive/completed/finance_module_master_spec_v3.md:1103` — `Parasut status → ERP`
- `docs/archive/completed/finance_module_master_spec_v3.md:1104` — `Parasut expense import`
- `docs/archive/completed/finance_module_master_spec_v3.md:1160` — `Parasut API integrated (auto-invoicing)` (unchecked)
- `docs/archive/completed/finance-module-progress.md:42` — `Module 13 Parasut API | ⬜`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:14` — `official -> Paraşüt’e gidecek (ileride)`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:31` — `official_invoice ... resmi fatura -> Paraşüt`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:55` — `Paraşüt API ... ayrı iş paketi`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:108` — `... official_invoice’a göre ... Parasüt akışı ...`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:130` — `Paraşüt: ... ayrı iş paketi`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:235` — `Paraşüt API ayrı iş paketi`
- `docs/archive/completed/abonelikler-hedefe-donusum-analizi.md:239` — `... Paraşüt akışı ...`
- `docs/archive/completed/abonelikler-guncel-vs-hedef.md:144` — `Resmi ... Paraşüt’e API ile iletilecek`
- `docs/archive/completed/abonelikler-guncel-vs-hedef.md:145` — `Gayri resmi ... Paraşüt’e gönderilmesin`
- `docs/archive/completed/abonelikler-guncel-vs-hedef.md:156` — `... Paraşüt API ... planlanabilir`
- `docs/archive/completed/SUBSCRIPTIONS_ISSUES.md:255` — `Paraşüt accounting integration | Will not be built ...`
- `docs/archive/completed/FINANCE_DASHBOARD_V2_PLAN.md:20` — `Parasut entegrasyonu`
- `docs/ai_context/MODULE_FINANCE.md:55` — `parasut_invoice_id    TEXT,`
- `docs/active/TABBED_LIST_PAGES_IMPLEMENTATION_PLAN.md:392` — `Paraşüt / invoice integration` (out of scope)
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:175` — `Integration Strategy: Paraşüt ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:177` — `Current Paraşüt Status`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:181` — `... integration will not be built ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:183` — `parasut_invoice_id exists ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:184` — `No active development planned for Paraşüt API`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:213` — `Paraşüt / External Accounting`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:215` — `Sync parasut_invoice_id when integration exists`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:220` — `No dependency on Paraşüt for v1.0`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:221` — `... can push invoice IDs to parasut_invoice_id ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:223` — `Build Cashflow now, before Paraşüt`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:264` — `Build Now vs. After Paraşüt`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:269` — `Wait for Paraşüt ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:271` — `... Paraşüt, when added ...`
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md:356` — `Paraşüt / Invoice Automation? Not planned`

---

## 2. Database Schema

### Confirmed Paraşüt-related schema

- `financial_transactions.parasut_invoice_id`
  - Defined in `supabase/migrations/00040_financial_transactions.sql`
  - Type: `TEXT`
  - Purpose: external invoice reference placeholder
- `subscription_payments.parasut_invoice_id`
  - Defined in `supabase/migrations/00016_subscriptions.sql`
  - Type: `TEXT`
  - Purpose: payment-level invoice reference placeholder

### Invoice type columns

- `financial_transactions.invoice_type`
  - `TEXT CHECK (invoice_type IN ('e_fatura', 'e_arsiv', 'kagit'))`
  - Added in `00040`
- `subscription_payments.invoice_type`
  - Initially `CHECK (invoice_type IN ('e_fatura', 'e_arsiv'))` in `00016`
  - Expanded to include `'kagit'` via `00018_invoice_logic.sql`

### Related invoice fields in same entities

- `subscription_payments`: `invoice_no`, `invoice_date`, `invoice_type`, `parasut_invoice_id`
- `financial_transactions`: `invoice_no`, `invoice_type`, `parasut_invoice_id`, plus invoice decision flags:
  - income-side: `should_invoice`
  - expense-side: `has_invoice`

### RPC/migration invoice plumbing (non-Paraşüt API)

- `00098`, `00122`, `00170` update RPC signatures and logic with `p_invoice_type`
- Many later migrations reference invoice workflow flags (`should_invoice`, `has_invoice`) for VAT and reporting logic

### Missing schema for full Paraşüt sync

- No migration creates a Paraşüt OAuth token table or credentials storage table
- No migration creates a `parasut_sync_queue`, webhook table, or sync job table
- No live migration currently creates `parasut_contact_id`, `parasut_error`, `parasut_synced_at` in production tables (these appear only in architecture docs)

---

## 3. Existing Integration Status

### Was there ever a working integration?

Short answer: **No evidence of a working Paraşüt integration in executable code**.

Evidence:
- No `src/lib/parasut.js` (planned in docs, file does not exist)
- No `*parasut*` files under `src/` or `supabase/functions/`
- No runtime code matches for:
  - `api.parasut.com`
  - `parasut-sync`
  - Paraşüt OAuth `client_id/client_secret` usage
- All live references in code are schema placeholders (`parasut_invoice_id`) and one UI label text

### Dead / legacy indicators

- Multiple archived docs describe a future design (OAuth, `parasut-sync`, contact mapping) but not shipped code.
- `docs/archive/completed/SUBSCRIPTIONS_ISSUES.md` explicitly states Paraşüt integration “will not be built” while keeping `parasut_invoice_id` for possible future use.
- `docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md` also states no active Paraşüt development planned.

### TODO/FIXME status for Paraşüt/invoice

- Pattern search for `(TODO|FIXME)` combined with `parasut|paraşüt|invoice|e_fatura|e_arsiv` returned **no matches**.
- There are unrelated TODO mentions in docs, but no Paraşüt/invoice TODO/FIXME in live code paths.

### External API/service files found (non-Paraşüt)

Potential integration/service touchpoints currently in code:
- `supabase/functions/fetch-tcmb-rates/index.ts`
  - External call to `https://www.tcmb.gov.tr/kurlar/today.xml`
  - Supabase client imported from esm.sh
- `supabase/functions/extend-subscription-payments/index.ts`
  - Supabase function-side client usage
- Frontend non-business external URLs:
  - Google Maps link builder in customer UI
  - CDN font URLs in `ProposalPdf.jsx`

No external accounting client/service implementation for Paraşüt detected.

---

## 4. API Credentials

### `.env` / `.env.example` checks

Files reviewed:
- `.env`
- `.env.example`

Findings:
- **No Paraşüt-related environment variables** present (e.g., no `PARASUT_*`, no `VITE_PARASUT_*`, no client id/secret keys).
- `.env` currently contains:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- `.env.example` contains placeholder Supabase keys only.

### Are there secrets configured for Paraşüt?

- **No Paraşüt secrets configured in project env files**.
- Existing env values are Supabase/browser client values; not Paraşüt credentials.

---

## 5. Recommendations

### What must be built for full Paraşüt integration

1. **Integration boundary**
   - Create dedicated service module (`supabase/functions/parasut-sync` or equivalent backend endpoint), not frontend direct calls.
2. **Credential management**
   - Add secure secret storage (Supabase secrets/vault); never expose in `VITE_*`.
3. **OAuth + token lifecycle**
   - Implement token fetch/refresh and retry handling.
4. **Data model completion**
   - Add explicit sync metadata fields where needed (e.g., synced timestamp, error message, status) in live schema, not only docs.
5. **Idempotent sync flow**
   - Queue or dedupe key to prevent duplicate invoice creation on retries.
6. **Mapping layer**
   - Customer/contact mapping (`parasut_contact_id`) and fallback create-contact flow.
7. **Operational controls**
   - Manual retry + audit log + alerting on failed sync.
8. **Tests**
   - Migration tests + function tests with mocked Paraşüt API responses.

### What can be reused immediately

- Existing invoice decision fields and VAT plumbing:
  - `should_invoice`, `has_invoice`, `invoice_type`, `invoice_no`
- Existing external-integration pattern:
  - Supabase Edge Functions style used by TCMB function
- Existing ledger anchor:
  - `financial_transactions` as source of truth for final financial state

### Cleanup opportunities (safe now)

- Keep `parasut_invoice_id` as placeholder if future integration is possible.
- Optionally normalize doc set:
  - Remove contradictions where one doc says “planned” and others say “will not be built.”
- Keep UI text honest:
  - `officialInvoice` label currently says “sent to Paraşüt”; if integration remains unplanned, consider neutral wording.

---

## Final Assessment

The repository contains **schema placeholders and planning documents**, but **no active Paraşüt integration code**. Current state is best described as **prepared-but-unimplemented**, with explicit documentation in multiple places that actual integration is deferred or not planned.

---

## 6. Entegrasyon Stratejisi & Risk Analizi

### Genel Yaklaşım

Ornet ERP ile Paraşüt entegrasyonu, finansal verilerin muhasebe sistemine doğru ve güvenli şekilde aktarılmasını hedefler. En kritik kısıt: **e-Fatura kesildikten sonra iptal edilemez, yalnızca iptal faturası kesilebilir.** Bu nedenle tüm yazma işlemleri dikkatli ve kontrollü yapılmalıdır.

### Yapılacak İşlemler

#### 1. Fatura Kesme (Satış Faturası Oluşturma) — 🟡 Orta Risk
- Sadece **tamamlanmış (completed)** proposal ve work order'lar için
- **Asla otomatik değil** — kullanıcı "Fatura Kes" butonuna basacak
- Fatura Paraşüt'e gönderilmeden ÖNCE **önizleme gösterilecek** (içindeki kalemler, tutarlar, KDV)
- Kullanıcı onayından sonra Paraşüt API'ına gönderilecek
- Başarılı olursa `parasut_invoice_id` kaydedilecek
- Başarısız olursa hata kullanıcıya gösterilecek, log tutulacak
- **Idempotency key** kullanılacak (aynı faturanın iki kere kesilmesini önlemek için)

#### 2. Tahsilat Senkronizasyonu — 🟢 Düşük Risk
- Uygulamada "Tahsilat Edildi" yapıldığında, Paraşüt'teki ilgili faturaya ödeme kaydı düşülecek
- Amount, tarih, ödeme yöntemi Paraşüt'e aktarılacak
- Bu işlem geri alınabilir olduğu için düşük riskli

#### 3. Geçmiş Fatura/Ödeme Sorgulama — 🟢 Düşük Risk
- Müşteri detay sayfasında Paraşüt'teki geçmiş faturaları ve ödeme durumunu gösterme
- Sadece okuma (read-only), veri değişmez
- Kullanıcı geçmiş dönem faturalarını ve ödemelerini tek ekrandan görebilir

### Yapılmayacak İşlemler

| İşlem | Neden |
|-------|-------|
| ❌ Müşteri senkronizasyonu (Ornet → Paraşüt) | Gerek duyulmadı, manuel yönetilecek |
| ❌ Otomatik fatura kesme (proposal tamamlanınca) | e-Fatura iptal edilemez, risk çok yüksek |
| ❌ Toplu/batch fatura kesme | Her fatura ayrı onaylanmalı |
| ❌ Frontend'den direkt API çağrısı | Credentials güvenliği riski |
| ❌ e-Fatura iptal işlemi (cancellation invoice) | Karmaşık, şimdilik manuel yapılacak |

### Teknik Mimari

\`\`\`
[React UI] → [Supabase Edge Function: parasut-sync]
                 → OAuth2 token (client_credentials)
                 → POST /v4/{company_id}/sales_invoices
                 → POST /v4/{company_id}/payments
                 → GET /v4/{company_id}/sales_invoices
\`\`\`

- **Supabase Edge Function** backend'de çalışır, API credentials güvende kalır
- **OAuth2 token** yönetimi (access_token alma + refresh)
- **Idempotency-Key** header'ı ile tekrarlanan istekleri önleme
- **Rate limiting** Paraşüt API sınırlarına uyum

### Çalışma Sırası (Önerilen)

| Adım | İşlem | Tahmini Süre |
|------|-------|-------------|
| 1 | Supabase Edge Function oluşturma + OAuth entegrasyonu | 1 gün |
| 2 | Fatura kesme (önizleme + onay + gönderme) | 2 gün |
| 3 | Tahsilat senkronizasyonu | 1 gün |
| 4 | Geçmiş sorgulama + UI entegrasyonu | 1 gün |

---

## 7. Sonuç

Paraşüt entegrasyonu şu an için planlama aşamasındadır. Veritabanında `parasut_invoice_id` kolonları hazır beklemektedir. Aktif bir API client kod bulunmamaktadır. Entegrasyona başlamadan önce OAuth credentials'ların temin edilmesi ve Supabase Secrets'a eklenmesi gerekmektedir.

---

## 8. Deep Search Analizi — Paraşüt V4 Entegrasyon Detayları

### 8.1 Paraşüt API V4 Entegrasyon Adımları (OAuth, Token, Endpoint, Akış)

#### A. Ön hazırlık
1. Paraşüt'ten `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URL` alın (destek üzerinden).
2. ERP tarafında şirket bazlı ayarlar tablosu oluşturun/kullanın:
   - `parasut_company_id`
   - `oauth_access_token` (şifreli)
   - `oauth_refresh_token` (şifreli)
   - `token_expires_at`
3. Frontend'den doğrudan çağrı yapmayın; tüm çağrılar yalnızca Edge Function üzerinden olsun.

#### B. OAuth akışı
1. İlk yetkilendirme: `authorization_code` veya `password` grant ile token alın.
2. Her API çağrısından önce token süresi kontrolü yapın.
3. Süre dolmuşsa `refresh_token` ile yeni `access_token` + yeni `refresh_token` alın.
4. Token'ı `Authorization: Bearer ...` ile gönderin.

#### C. Fatura akışı (önerilen manuel onaylı)
1. ERP'de iş `completed` olduğunda yalnızca **"faturalamaya hazır"** durumu oluşturun.
2. Kullanıcı "Faturayı Paraşüt'e gönder" dediğinde:
   - `sales_invoices` oluşturun.
   - Alıcının e-Fatura mükellefiyetini `e_invoice_inboxes` ile kontrol edin (`filter[vkn]`).
   - Mükellefse `e_invoices`, değilse `e_archives` oluşturun.
3. e-Belge oluşturma async çalışır: dönen `trackable_job_id`'yi poll edin.
4. `status=done` sonrası `sales_invoices?include=active_e_document,payments` ile doğrulayın.
5. `parasut_invoice_id` + `parasut_e_document_id` + `trackable_job_id` ERP'de saklayın.

#### D. Temel endpoint seti
- OAuth: `/oauth/authorize`, `/oauth/token`
- Fatura: `/{company_id}/sales_invoices`
- e-Fatura: `/{company_id}/e_invoices`
- e-Arşiv: `/{company_id}/e_archives`
- Job durumu: `/{company_id}/trackable_jobs/{id}`
- Tahsilat: `/{company_id}/sales_invoices/{id}/payments`
- Geçmiş sorgu: `/{company_id}/sales_invoices?filter[contact_id]=...&include=payments,active_e_document`

### 8.2 e-Fatura vs e-Arşiv Farkı + Hangi Durumda Hangisi + İptal Süreçleri

| Özellik | e-Fatura | e-Arşiv |
|---------|----------|---------|
| Alıcı | e-Fatura mükellefi | e-Fatura mükellefi OLMAYAN |
| İletim | GİB üzerinden elektronik | E-posta / portal |
| İptal süresi | Alıcı ret süresi ~8 gün | ~7 gün operasyonel pencere |
| Süre geçince | İade faturası | İade faturası |
| Kullanım | Ticari müşteriler | Bireysel / mükellef olmayan |

**Önemli:** Kesmeden önce son insan onayı şart. İptal yerine çoğu durumda iade akışı tasarlayın.

### 8.3 Tahsilat (Payment) Entegrasyonu ve Kısmi Ödeme

**Çalışma modeli:**
1. ERP'de her gelir kaydı için ilgili `parasut_sales_invoice_id` tutulur.
2. ERP'ye ödeme girildiğinde → Paraşüt `sales_invoices/{id}/payments` endpoint'ine ödeme gönderilir.
3. Bir faturaya birden fazla payment gönderilebilir (kısmi ödeme desteklenir).
4. Paraşüt tarafında `remaining` alanı üzerinden kalan borç izlenir.
5. Senkron sonrası ERP'de `total_collected` ve `remaining` yeniden hesaplanmalı.

### 8.4 Idempotency Key ile Çift Fatura Kesimini Önleme

Paraşüt'te resmi `Idempotency-Key` header standardı bulunmamaktadır. Bu nedenle **uygulama katmanında idempotency** şarttır.

**Önerilen desen:**
1. `integration_idempotency` tablosu:
   - `key` (unique), `operation_type`, `erp_record_id`, `status` (`started|succeeded|failed`), `response_snapshot`
2. UI isteği geldiğinde deterministic key üretin (örn: `invoice:{financial_tx_id}:v1`).
3. Edge Function transaction: key insert dene (unique çatışırsa eski sonucu dön), Paraşüt çağrısı yap, başarıda response'u kaydet.

### 8.5 Rate Limit ve Test/Sandbox

- **Rate limit:** 10 saniyede 10 istek. Önerilen: 8/10 sn + exponential backoff + jitter.
- **Sandbox:** Resmi sandbox host belirtilmemiş. Pratik yaklaşım: ayrı bir Paraşüt test şirketi + ayrı OAuth credential kullanın.

### 8.6 Türk Firmalarda Sık Yapılan Hatalar

1. Otomatik kesimle geri dönülmez hata (sizde doğru: manuel onay)
2. Müşteri eşleştirme zayıf (VKN/TCKN ile net eşleşme olmadan fatura kesilmesi)
3. Async job beklemeden başarı sayma (`createEInvoice` 201 dönse bile job `error` olabilir)
4. PDF URL'ini kalıcı link sanma (süreli URL, arşivi kendi sisteminize alın)
5. Token refresh yarış durumu (paralel isteklerde refresh token overwrite bug)
6. Idempotency eksikliği (timeout sonrası çift fatura/çift tahsilat)
7. Yetersiz audit trail (kim, ne zaman, hangi payload ile gönderdi görünmüyor)

### 8.7 Supabase Edge Function için Örnek Mimari

**Klasör yapısı:**
```
supabase/functions/parasut-dispatch/
  index.ts                  # router
  handlers/
    create-sales-invoice.ts
    create-e-document.ts
    sync-payment.ts
    fetch-customer-history.ts
  core/
    parasut-client.ts       # fetch wrapper, retries, rate-limit
    oauth-store.ts          # token read/refresh/write
    idempotency.ts          # key acquire/release/result cache
    job-poller.ts
    mappers.ts              # ERP -> Parasut payload
    errors.ts               # domain error taxonomy
    logger.ts               # JSON structured log
```

**Hata yönetimi:**
- `4xx` → kullanıcıya anlamlı hata, retry yok
- `401` → bir kez refresh + tekrar dene
- `429/5xx/timeouts` → retry (backoff+jitter), limitli deneme
- `job status=error` → business error olarak ERP'ye yaz

**Log standardı:** `correlation_id`, `operation`, `erp_id`, `parasut_id`, `idempotency_key`, `http_status`, `duration_ms`.

### 8.8 Güvenlik, Veri Tutarlılığı, Yedekleme

**Güvenlik:**
1. Paraşüt secret/token sadece Edge Function secrets'da
2. Frontend'de token/secret asla bulunmasın
3. RLS ile yetkili roller kısıtlaması
4. Webhook signature doğrulaması (kullanılırsa)

**Veri tutarlılığı:**
1. Outbox + idempotency olmadan prod'a çıkmayın
2. State machine: `pending_approval -> sending -> sent -> confirmed -> failed`
3. Gün sonu mutabakat job'ı: ERP toplamları vs Paraşüt karşılaştırması

**Yedekleme:**
1. Kritik entegrasyon tabloları için PITR + düzenli snapshot
2. `response_snapshot` tutarak sonradan adli izleme
3. İptal edilemez senaryolar için operasyonel runbook

### Kaynaklar

1. Paraşüt API OpenAPI repo: https://github.com/parasutcom/api-doc
2. Paraşüt Swagger spec (`spec/swagger.yaml`)
3. e-Fatura/e-Arşiv iptal: https://www.parasut.com/blog/e-fatura-e-arsiv-nasil-iptal-edilir
4. Ticari e-Fatura: https://www.parasut.com/blog/ticari-e-fatura-nedir
5. Supabase Edge Functions: https://supabase.com/docs/guides/functions
6. Supabase Secrets: https://supabase.com/docs/guides/functions/secrets

---

## 9. Deep Search Analizi (2) — Paraşüt API V4 Entegrasyon Rehberi

### 9.1 OAuth ve Token Yönetimi

**Gerekli Bilgiler:**
1. Paraşüt'ten `client_id`, `client_secret`, opsiyonel `redirect_url` alın
2. Paraşüt kullanıcı e-posta/şifre + firma `company_id`

**Access Token (Password Grant):**
```
POST https://api.parasut.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
client_id=<client_id>
client_secret=<client_secret>
username=<parasut_email>
password=<parasut_password>
```

- Access token 7200 saniye geçerlidir
- Refresh token ile yenileme yapılır
- Her istekte `Authorization: Bearer <access_token>` başlığı gönderilir

**API Yapısı:**
- Baz URL: `https://api.parasut.com/v4`
- JSON:API formatı kullanılır
- Rate limit: 10 saniyede 10 istek
- 429 hatasında exponential back-off uygulanmalı

### 9.2 e-Fatura vs e-Arşiv (Detaylı)

| Özellik | e-Fatura | e-Arşiv |
|---------|----------|---------|
| Kapsam | Mükellefler arası | Mükellef olmayan / birey (B2C) |
| Gönderim | GİB üzerinden direkt | E-posta / baskı + günlük GİB raporu |
| Basım | Kâğıt çıktı geçersiz | Kâğıt çıktı düzenlenebilir |
| İptal | Ticari: 7 gün alıcı reddi | 7 gün içinde "İptal Et" seçeneği |
| İade | Temel: iade faturası gerekir | İade faturası / gider pusulası |

**Karar akışı:**
1. Alıcının VKN'sini `e_invoice_inboxes` ile sorgula
2. Kayıtlıysa → e-Fatura (basic veya commercial)
3. Değilse → e-Arşiv

### 9.3 Tahsilat Entegrasyonu

**Ödeme Ekleme:**
```
POST /v4/{company_id}/sales_invoices/{invoice_id}/payments

{
  "data": {
    "type": "payments",
    "attributes": {
      "account_id": 12345,
      "date": "YYYY-MM-DD",
      "amount": 1000.00
    }
  }
}
```

- Kısmi ödeme desteklenir (amount az girilir)
- Ödeme sorgulama: `?include=payments`
- Ödeme silme: `DELETE /v4/{company_id}/transactions/{transaction_id}`

**Senkronizasyon akışı:**
1. ERP'de tahsilat kaydedilince Edge Function çağrılır
2. Paraşüt API'sine ödeme gönderilir
3. Başarılı yanıtta `payment_id` ve `transaction_id` ERP'ye kaydedilir

### 9.4 Idempotency Stratejisi

- Paraşüt'te `Idempotency-Key` header'ı yoktur
- ERP'de `erp_invoice_uuid` oluşturulur
- Edge Function'da aynı UUID daha önce kullanılmışsa yeni fatura oluşturulmaz
- Trackable job sonuçlanmadan yeni resmileştirme isteği gönderilmez

### 9.5 Rate Limit ve Test Ortamı

- 10 saniyede 10 istek limiti
- 429 yanıtında gecikmeli tekrar deneyin
- Sandbox yok; test şirketi + deneme VKN kullanın
- Test faturaları GİB'e raporlanacağından resmileştirmeyi devre dışı bırakın

### 9.6 Sık Yapılan Hatalar

1. **company_id yanlış** → 404 firma bulunamadı
2. **Kur/KDV uyumsuzluğu** → resmileştirme hatası
3. **VKN/TCKN hatalı** → e-fatura gönderilemez
4. **Tarih formatı** → YYYY-MM-DD ve Türkiye saati
5. **Token yenileme atlanırsa** → 401 unauthorized
6. **HTTPS/TLS** → TLS 1.2+ zorunlu (Edge Function karşılar)

### 9.7 Edge Function Mimarisi

**Modüller:**
```
supabase/functions/parasut-dispatch/
  ├── auth.ts        — OAuth token yönetimi
  ├── invoices.ts    — Fatura oluşturma + resmileştirme
  ├── payments.ts    — Tahsilat ekleme/silme
  └── webhooks.ts    — (opsiyonel) Paraşüt webhook'ları
```

**Hata yönetimi:**
- Her API çağrısı loglanır (URL, gövde, yanıt, süre)
- 429/5xx → exponential back-off ile retry
- Job failed → kullanıcıya hata, manuel müdahale
- Transaction yönetimi: Paraşüt onayı olmadan ERP'de kesinleştirme yapılmaz

### 9.8 Güvenlik ve Veri Tutarlılığı

1. Gizli bilgiler sadece Edge Function secrets'da (VITE_* asla)
2. TLS/HTTPS zorunlu (Edge Function doğal HTTPS)
3. Paraşüt kullanıcı yetkileri sınırlandırılmalı
4. Manuel onay şart (otomatik asla)
5. VKN/TCKN, KDV, tutar doğrulaması ERP'de yapılmalı
6. NTP ile saat senkronizasyonu
7. Hatalar dashboard'da izlenmeli
8. Veritabanı düzenli yedek + Paraşüt ile periyodik mutabakat

