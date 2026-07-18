# Paraşüt Integration — Implementation Roadmap (PR Blueprint)

Date: 2026-05-14 (updated: 2026-07-17 — three Paraşüt documents merged into this file)  
Status: Codebase written (migrations / edge functions / UI files in scope of PR-1–PR-8 exist in the repo), **NOT ACTIVE in production** — no production OAuth token, live sync has never run. Before go-live, the **mandatory safeguards in Section 10** must be completed.

> **This file is the SINGLE document for Paraşüt integration.** `docs/analysis/parasut-integration-audit.md` and `docs/technical-assessment-parasut-go-live.md` were folded into this file on 2026-07-17 and deleted: technical assessment evidence → **Appendix A**, Paraşüt API reference → **Appendix B**. (Audit document §§1–7 were historically obsolete “no code” findings and were not preserved.) Non-Paraşüt operational topics (backups, OAuth refresh race analysis, system-wide “verified good” list) were moved the same day to `docs/active/operational-reliability-notes.md`.

Related documents:
- `CLAUDE.md` (finance module rules — immutable reference)
- `docs/active/operational-reliability-notes.md` (backups + OAuth analysis + system-wide notes)

---

## 0. Locked assumptions

| Topic | Decision |
|---|---|
| e-Invoice taxpayer status | Yes (we are taxpayers). Primary flow is `e_invoices`; if the buyer is not a taxpayer, fall back automatically to `e_archives`. |
| Invoice decision | Already driven by `subscriptions.official_invoice` + payment-row `should_invoice`. No new rule. |
| Approval model | Two-step: **Prepare (draft)** → **Finalize**. |
| Customer matching | Manual + one-time bulk match. `customers.parasut_contact_id` is the definitive key. |
| Automatic contact creation | **No.** A Paraşüt contact is never created unless the user explicitly confirms via checkbox. |
| Writing to Paraşüt from DB triggers | **No.** Every invoice starts from a user button. |
| Monthly SIM cron | Does not go to Paraşüt (fleet aggregate, not customer-scoped). |
| Credentials in the frontend | **None.** All writes go only through Edge Functions. No `VITE_PARASUT_*`. |
| Cancel / credit invoice | No automation; manual in the Paraşüt UI. |

---

## 1. Architecture summary

```
React UI
   │
   │ supabase.functions.invoke('parasut-dispatch', { action, payload })
   ▼
Supabase Edge Function: parasut-dispatch
   ├── core/
   │   ├── parasut-client.ts     fetch wrapper, rate limit, retry, backoff
   │   ├── oauth-store.ts        read/refresh/write token (FOR UPDATE)
   │   ├── idempotency.ts        deterministic key, response cache
   │   ├── job-poller.ts         trackable_jobs polling
   │   ├── mappers.ts            ERP → Paraşüt payload mapping
   │   ├── errors.ts             domain error taxonomy
   │   └── logger.ts             structured JSON log + audit
   ├── handlers/
   │   ├── bulk-match.ts             P1
   │   ├── create-contact.ts         P1
   │   ├── prepare-invoice.ts        P2  → create draft
   │   ├── finalize-invoice.ts       P2  → e-invoice/e-archive + job poll
   │   ├── cancel-draft.ts           P2  → delete draft only
   │   ├── sync-payment.ts           P3
   │   ├── delete-payment.ts         P3
   │   └── fetch-history.ts          P4
   └── index.ts                  router
```

State machine (per `financial_transactions` income row):

```
not_required  →  ready  →  draft  →  sent  →  confirmed
                   │         │         │         │
                   └─────────┴─────────┴─────────┴───→ failed
```

No rollback from `confirmed`. Cancel from `draft` is allowed (Paraşüt draft deleted; ERP returns to `ready`).

---

## 2. New schema (summary; split across phases)

```sql
-- customers
ADD parasut_contact_id TEXT UNIQUE
ADD identity_type TEXT CHECK (IN 'vkn','tckn')
ADD tax_office TEXT

-- financial_transactions (subscription_payments already has parasut_invoice_id)
ADD parasut_e_document_id TEXT
ADD parasut_sync_status TEXT
  CHECK (IN 'not_required','ready','draft','sent','confirmed','failed')
ADD parasut_synced_at TIMESTAMPTZ
ADD parasut_error TEXT
ADD parasut_trackable_job_id TEXT

-- new tables
parasut_oauth_tokens          (single row, FOR UPDATE)
parasut_idempotency           (unique key, response cache)
parasut_match_candidates      (bulk-match results)
parasut_audit_log             (correlation_id, request/response JSONB)
```

---

## 3. Phases — one PR each

Each phase is **one PR**. The next PR does not start until the previous one is merged. Every PR has explicit **acceptance criteria** (Definition of Done).

---

### PR-1 · Schema foundation + customer matching fields
**Branch:** `feat/parasut-01-schema-customer-matching`  
**Effort:** ½ day  
**Dependency:** none

#### Files
- `supabase/migrations/00215_parasut_customer_matching.sql` (new)
  - `customers` → `parasut_contact_id`, `identity_type`, `tax_office`
  - `parasut_match_candidates` table + RLS (admin SELECT/UPDATE)
  - `idx_customers_parasut_contact` partial index
- `src/features/customers/schema.js` — add `identity_type`, `tax_office` to zod schema
- `src/features/customers/CustomerFormPage.jsx` — two new fields (tax office, identity-type dropdown)
- `src/locales/tr/customers.json` — new labels
- `docs/ai_context/SYSTEM_MAP.md` — schema update

#### Acceptance criteria
- [ ] Migration up/down is idempotent
- [ ] Existing customer rows (NULL `identity_type`) do not break
- [ ] When `tax_number` is entered on the form, `identity_type` becomes required
- [ ] RLS: only `canWrite` can write
- [ ] `make build` green, lint green

---

### PR-2 · OAuth infrastructure + Edge Function skeleton
**Branch:** `feat/parasut-02-oauth-edge-function`  
**Effort:** 1 day  
**Dependency:** PR-1  
**Prerequisite:** `CLIENT_ID`, `CLIENT_SECRET`, user email/password, and `company_id` obtained from Paraşüt.

#### Files
- `supabase/migrations/00216_parasut_oauth_audit.sql` (new)
  - `parasut_oauth_tokens` (single-row PK=1, FOR UPDATE pattern)
  - `parasut_audit_log` + RLS (admin SELECT)
  - `parasut_idempotency` + unique index on `key`
- `supabase/functions/parasut-dispatch/index.ts` — router (action whitelist)
- `supabase/functions/parasut-dispatch/core/parasut-client.ts`
  - `fetch` wrapper, `Authorization: Bearer`, JSON:API content-type
  - Rate limit: 8 requests / 10 s (token bucket)
  - Retry: 429/5xx → exponential backoff + jitter, max 3 attempts
- `supabase/functions/parasut-dispatch/core/oauth-store.ts`
  - `getValidToken()` → SELECT FOR UPDATE, expiry check, refresh
  - Initial setup via `password` grant + store `refresh_token`
- `supabase/functions/parasut-dispatch/core/logger.ts`
  - JSON log + `parasut_audit_log` INSERT
- `supabase/functions/parasut-dispatch/core/errors.ts`
  - `ParasutAuthError`, `ParasutRateLimitError`, `ParasutValidationError`, `ParasutJobError`
- `supabase/functions/parasut-dispatch/handlers/ping.ts`
  - Calls `GET /v4/{company_id}/me`, returns company name
- `.env.example` — new secret list (commented, reference only)
- `docs/active/parasut-integration-roadmap.md` — update this file with PR-2 status

#### Supabase secrets (before deploy)
```
PARASUT_BASE_URL=https://api.parasut.com/v4
PARASUT_OAUTH_URL=https://api.parasut.com/oauth/token
PARASUT_CLIENT_ID=...
PARASUT_CLIENT_SECRET=...
PARASUT_USERNAME=...
PARASUT_PASSWORD=...
PARASUT_COMPANY_ID=...
```

#### Acceptance criteria
- [ ] `supabase functions invoke parasut-dispatch --body '{"action":"ping"}'` returns the company name
- [ ] Token refresh happens once (parallel-request race test passed)
- [ ] Backoff engages under simulated 429
- [ ] Audit log is written on every call
- [ ] No Paraşüt credentials in the frontend (edge function invoke only)

---

### PR-3 · Bulk customer matching + admin UI
**Branch:** `feat/parasut-03-customer-matching`  
**Effort:** 1.5 days  
**Dependency:** PR-2

#### Files
- `supabase/functions/parasut-dispatch/handlers/bulk-match.ts`
  - Paraşüt `GET /contacts` (paginated, page[size]=100)
  - Match against Ornet customers:
    - `exact_vkn` → equal tax_number + identity_type='vkn'
    - `exact_tckn` → equal tax_number + identity_type='tckn'
    - `name_only` → normalized name match
  - Write results to `parasut_match_candidates`
  - **Admin only** may trigger
- `supabase/functions/parasut-dispatch/handlers/create-contact.ts`
  - POST /contacts for a new customer
  - Called only after user confirmation
- `src/features/customers/parasutMatchingApi.js` (new)
- `src/features/customers/parasutMatchingHooks.js` (new)
  - `useMatchCandidates`, `useRunBulkMatch`, `useAcceptMatch`, `useRejectMatch`
- `src/features/customers/ParasutMatchingPage.jsx` (new)
  - Side-by-side list UI (Ornet ↔ Paraşüt candidate)
  - Filters: `pending` / `accepted` / `rejected`
  - “Start bulk match” button (admin)
  - Auto-matches (`exact_vkn`/`exact_tckn`) one-click approve
- `src/App.jsx` — route: `/customers/parasut-matching` (admin guard)
- `src/components/layout/navItems.js` — link under “Settings”
- `src/locales/tr/customers.json` — new strings

#### Acceptance criteria
- [ ] Exact VKN match works for a test customer that exists in Paraşüt
- [ ] `parasut_contact_id` UNIQUE constraint conflicts are handled
- [ ] After “Accept”, `customers.parasut_contact_id` is populated
- [ ] Bulk match is idempotent — running twice does not create duplicate rows
- [ ] Only admin can see and run it

---

### PR-4 · Invoice flow — Subscription payments (highest frequency)
**Branch:** `feat/parasut-04-invoice-subscription`  
**Effort:** 2.5 days  
**Dependency:** PR-3  
**Most critical PR.** Mandatory production test scenarios below.

#### Files
- `supabase/migrations/00217_parasut_sync_status.sql`
  - `financial_transactions` → `parasut_e_document_id`, `parasut_sync_status`, `parasut_synced_at`, `parasut_error`, `parasut_trackable_job_id`
  - Index: `idx_ft_parasut_sync_status` (where status in ('ready','draft','sent'))
  - Trigger: when subscription_payment is paid + official_invoice=true + should_invoice=true → mark related financial_transaction as `parasut_sync_status='ready'`
- `supabase/functions/parasut-dispatch/core/idempotency.ts`
  - Key format: `invoice:financial_tx:{uuid}:v1`
  - `acquire` → INSERT … ON CONFLICT DO NOTHING; on conflict return cached response
- `supabase/functions/parasut-dispatch/core/mappers.ts`
  - `financialTxToSalesInvoicePayload(tx, customer)` — convert to JSON:API
  - VAT, FX rate, line items, description, date (YYYY-MM-DD, Turkey time)
- `supabase/functions/parasut-dispatch/core/job-poller.ts`
  - Trackable job poll: 2s → 5s → 10s → 20s (max 60s)
- `supabase/functions/parasut-dispatch/handlers/prepare-invoice.ts`
  - Input: `financial_transaction_id`
  - Validation: customer.parasut_contact_id present, identity_type/tax_office filled, amount > 0, VAT sensible
  - POST /sales_invoices (no e-document yet = draft)
  - Set `parasut_sync_status='draft'`, write `parasut_invoice_id`
- `supabase/functions/parasut-dispatch/handlers/finalize-invoice.ts`
  - First GET /e_invoice_inboxes?filter[vkn]=... → is taxpayer?
  - If taxpayer POST /e_invoices, else POST /e_archives
  - Store trackable_job_id, poll
  - On success: `parasut_sync_status='confirmed'`, write `parasut_e_document_id`
- `supabase/functions/parasut-dispatch/handlers/cancel-draft.ts`
  - Runs only when status='draft'
  - DELETE /sales_invoices/{id}
  - Reset ERP to `parasut_sync_status='ready'`
- `src/features/finance/parasutApi.js` (new)
- `src/features/finance/parasutHooks.js` (new)
- `src/features/finance/components/ParasutInvoicePanel.jsx` (new)
  - Buttons by state: Prepare / Finalize / Cancel / View
  - Preview modal: lines, VAT, total, buyer, decision (e-invoice/e-archive)
  - `confirmed` badge + Paraşüt link
- `src/features/subscriptions/SubscriptionDetailPage.jsx` — integrate panel into payments section
- `src/locales/tr/finance.json` — new strings

#### Test scenarios (mandatory, manual)
1. ✅ official_invoice=true + e-Invoice taxpayer buyer → e_invoices, confirmed
2. ✅ official_invoice=true + non-taxpayer buyer → e_archives, confirmed
3. ✅ official_invoice=false → ParasutInvoicePanel hidden (sync_status='not_required')
4. ✅ should_invoice=false (cash, no receipt) → panel hidden
5. ✅ Missing `parasut_contact_id` → “Prepare” disabled, matching link shown
6. ✅ Draft created → “Cancel” → deleted in Paraşüt, ERP back to `ready`
7. ✅ Draft → Finalize → trackable_job error → status='failed', error shown in UI
8. ✅ Double-click “Prepare” on same transaction → idempotency (single draft)
9. ✅ Successful finalize → “Cancel” button not shown (no rollback)

#### Acceptance criteria
- [ ] All 9 scenarios green (manual test + screenshots attached to PR)
- [ ] Audit log writes correct rows at every stage
- [ ] `parasut_sync_status` state machine not violated (DB constraint or trigger)
- [ ] Cancel endpoint returns 403 after `confirmed`

---

### PR-5 · Collection / payment sync (including partial payments)
**Branch:** `feat/parasut-05-payment-sync`  
**Effort:** 1.5 days  
**Dependency:** PR-4

#### Files
- `supabase/functions/parasut-dispatch/handlers/sync-payment.ts`
  - Input: `financial_transaction_payment_id`
  - Check parent transaction has `parasut_invoice_id`
  - POST /sales_invoices/{id}/payments
  - Write returned `payment_id` and `transaction_id` onto `financial_transaction_payments`
- `supabase/functions/parasut-dispatch/handlers/delete-payment.ts`
  - Input: `financial_transaction_payment_id`
  - DELETE /transactions/{transaction_id}
- `supabase/migrations/00218_parasut_payment_meta.sql`
  - `financial_transaction_payments` → `parasut_payment_id`, `parasut_transaction_id`, `parasut_synced_at`
- `src/features/finance/CollectionDeskPage.jsx` — auto-invoke after collection if parent has `parasut_invoice_id`
- `src/features/finance/PaymentsList.jsx` (if present) — “Synced to Paraşüt” badge on payment row

#### Acceptance criteria
- [ ] Partial payment: 1000 TRY invoice → 400 + 600 synced separately; Paraşüt `remaining=0`
- [ ] Payment delete: DELETE in ERP → also deleted in Paraşüt
- [ ] If parent has no `parasut_invoice_id`, silently skip (not an error; audit log only)

---

### PR-6 · Proposal & standalone work-order invoice flow
**Branch:** `feat/parasut-06-invoice-proposal-wo`  
**Effort:** 1.5 days  
**Dependency:** PR-4

PR-4’s `ParasutInvoicePanel` is already generic — only integrate into `ProposalDetailPage` and `WorkOrderDetailPage`, plus mapper differences for line items.

#### Files
- `supabase/functions/parasut-dispatch/core/mappers.ts` — `proposalToInvoicePayload`, `workOrderToInvoicePayload`
- `src/features/proposals/ProposalDetailPage.jsx` — add panel (visible when proposal is `completed`)
- `src/features/work-orders/WorkOrderDetailPage.jsx` — add panel (visible when WO is `completed` + `proposal_id IS NULL`)

#### Acceptance criteria
- [ ] Proposal line items appear correctly on the Paraşüt invoice (unit, qty, VAT)
- [ ] Panel hidden for proposal-linked WOs (no double-invoice risk)
- [ ] USD proposals send exchange rate correctly to Paraşüt

---

### PR-7 · Read-only history + customer detail tab
**Branch:** `feat/parasut-07-history-tab`  
**Effort:** 1 day  
**Dependency:** PR-3

#### Files
- `supabase/functions/parasut-dispatch/handlers/fetch-history.ts`
  - Input: `customer_id`
  - GET /sales_invoices?filter[contact_id]=X&include=payments,active_e_document
  - Paginated, last 12 months only
- `src/features/customers/CustomerDetailPage.jsx` — new “Paraşüt Invoices” tab
- `src/features/customers/components/ParasutHistoryTab.jsx` (new)

#### Acceptance criteria
- [ ] Customer detail shows history table (date, number, amount, payment status)
- [ ] If `parasut_contact_id` is missing → empty state + matching link

---

### PR-8 · End-of-day reconciliation + Sentry alerts
**Branch:** `feat/parasut-08-reconciliation`  
**Effort:** ½ day  
**Dependency:** PR-6

#### Files
- `supabase/functions/parasut-reconcile/index.ts` (new cron function)
  - Runs once daily at 02:30 UTC
  - ERP: yesterday’s `parasut_sync_status='confirmed'` count + sum
  - Paraşüt: `?filter[issue_date]=yyyy-mm-dd` count + sum
  - On mismatch → `parasut_audit_log` + Sentry alert
- Sentry tags: `parasut.operation`, `parasut.http_status`, `parasut.job_status`
- `src/features/finance/components/ParasutHealthCard.jsx` — small card on finance dashboard
  - Last 24h: success / failed / pending
  - Red badge if any failed

#### Acceptance criteria
- [ ] Manual mismatch scenario tested (delete a confirmed row in DB → alert)
- [ ] Paraşüt errors filterable separately in Sentry

---

## 4. Total effort & sequencing

| PR | Scope | Effort | Parallel? |
|---|---|---|---|
| PR-1 | Schema foundation | ½ day | — |
| PR-2 | OAuth + edge function | 1 day | — |
| PR-3 | Customer matching | 1.5 days | — |
| PR-4 | Subscription invoice | 2.5 days | — |
| PR-5 | Payment sync | 1.5 days | Can parallel with PR-6 |
| PR-6 | Proposal & WO invoice | 1.5 days | Can parallel with PR-5 |
| PR-7 | Read-only history | 1 day | Can parallel with PR-5/6 |
| PR-8 | Reconciliation + Sentry | ½ day | Last |

**Total:** ~10 developer-days solo; ~7 with parallelization.

Value arrives early: once **PR-1 → PR-4** land, subscription collections can fully go to Paraşüt (= highest-frequency daily flow).

---

## 5. Rollback plan

For every PR:
- Migrations are idempotent + reversible (`DROP COLUMN IF EXISTS`, `DROP TABLE IF EXISTS`).
- Until the edge function is deployed, keep UI hidden behind a feature flag: `VITE_PARASUT_ENABLED=false`.
- On production issues: turn the flag off → data remains in the DB; old flow (manual invoicing) continues.
- Do not drop `parasut_contact_id` / `parasut_invoice_id` columns — keep them for the future.

---

## 6. Open risks

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong finalized invoice needs a credit note | High (ops cost) | Two-step approval + mandatory preview + `parasut_contact_id` validation |
| Double invoice for the same transaction | High | Idempotency table + DB unique constraint |
| Token refresh race | Medium | `SELECT FOR UPDATE` + single refresh point |
| Paraşüt rate-limit breach | Low | 8/10s token bucket + retry |
| Wrong e-invoice / e-archive decision | High | Live `e_invoice_inboxes` query every time; no cache |
| trackable_job timeout | Medium | 60s poll, then mark failed + manual retry button |
| Customer matched incorrectly | High | Only `exact_vkn`/`exact_tckn` auto; name matches need manual approve |

---

## 7. Out of scope (future notes)

Not in this roadmap, but may be considered later:
- Importing Paraşüt expense invoices into Ornet (Module 13 v2)
- Webhook-based payment feedback (Paraşüt → Ornet)
- Multi-company support
- e-Dispatch / e-SMM integrations
- Automated credit-note flow

---

## 8. Prerequisites before coding

- [ ] OAuth credential pack obtained from Paraşüt (`client_id`, `client_secret`, user, password, `company_id`)
- [ ] Paraşüt test/sandbox company created (do not pollute production data)
- [ ] Test e-Invoice taxpayer VKN list ready (at least 1 taxpayer + 1 non-taxpayer)
- [ ] Completeness of existing customer VKN/TCKN and tax office data reviewed (if incomplete, a backfill UI may be needed after PR-1)
- [ ] Sentry project live (`VITE_SENTRY_DSN` set)

---

## 9. Status tracking

As PRs merge, mark the checklist at the top of this file:

```
PR-1  [ ] Schema foundation
PR-2  [ ] OAuth + Edge Function
PR-3  [ ] Customer matching
PR-4  [ ] Subscription invoice
PR-5  [ ] Payment sync
PR-6  [ ] Proposal & WO invoice
PR-7  [ ] History tab
PR-8  [ ] Reconciliation + alerts
```

When PR-8 is green, move this file under `docs/archive/completed/`.

---

## 10. Mandatory safeguards before go-live

> Source: technical assessment Rev. 2 (2026-07-17) — evidence and rationale are in **Appendix A**. These are not production incidents; they are **implementation requirements** that must be completed before the integration is activated against a production account.

### 10.1 `parasut-reconcile` authentication — MANDATORY
- [ ] Because `config.toml` has `verify_jwt = false`, in-function auth is required: add `_shared/cronAuth.ts` → `assertCronAuthorized(req)` at the top of the handler (same pattern as `extend-subscription-payments`).
- [ ] Configure the cron caller to send an `x-cron-secret` header.
- Why: otherwise anyone who knows the function URL can read daily revenue totals and burn Paraşüt API quota.

### 10.2 Retry-safe idempotency — MANDATORY
- [ ] `acquireIdempotency`: if an existing row has `status='failed'` (or `started` older than a few minutes), re-acquire the key (`UPDATE ... SET status='started' WHERE key=... AND status IN (...)`); only `succeeded` rows replay the snapshot.
- [ ] Handlers must never return a non-`succeeded` replay as `ok:true / data:null` — return an error.
- Why: today a first transient failure (Paraşüt 500, network blip) permanently locks that document’s invoicing and reports misleading success to the UI; recovery needs manual SQL.

### 10.3 Server-side invoice eligibility checks — MANDATORY
- [ ] Add `deleted_at IS NULL` to `validateForDraft`.
- [ ] Permanently exclude ~550 imported legacy income rows before cutover: one migration backfills `parasut_sync_status='excluded'` (by cutover date or a reliable legacy marker) + reject `excluded` in the handler. **Legacy rows must never go to Paraşüt under any condition.**
- [ ] Enforce `official_invoice` / `should_invoice` on the server as well (today only frontend queries filter).
- Why: e-invoices are legal documents; a wrong invoice requires formal cancellation. Business rules in this project are enforced in DB/server — this is the one place not yet applied.

### 10.4 Mapper currency fix + invoice currency policy — MANDATORY
- [ ] **Policy decision:** In which currency should USD-sourced documents be invoiced? (Recommendation: always TRY — use `amount_try` + `output_vat`.)
- [ ] Mapper fix: current code sends USD `unit_price` (`amount_original`) with TRY `total_vat` (`output_vat`) → mixed currencies in one payload. Evidence: 00246:219+234 (proposal), 00247:298+ (WO), `mappers.ts:39-42`. Example: $1,000 / rate 40.00 / VAT 20% → payload: USD, unit_price 1,000, total_vat 8,000, total_amount 9,000 (correct: 200 / 1,200 USD).
- [ ] `TRY` vs `TRL` verification: Paraşüt v4 `sales_invoices` currency enum historically uses `TRL`; the mapper sends `"TRY"`. Verify on first controlled test or swagger; one-line fix if needed. Affects **all** TRY invoices.
- Note: TRY-sourced paths (subscription, TRY proposal, TRY work order) are currency-consistent — the defect is only on USD source rows and the currency code.

### 10.5 `finalize-invoice` and `sync-payment` idempotency + recovery action — MANDATORY (before routine use)
- [ ] Both handlers use the §10.2 idempotency pattern (double-click → one e-document / one payment).
- [ ] New small `refresh-status` action: re-query `trackable_jobs` / e-document status; move rows stuck in `sent` to `confirmed`/`failed`. (Allows shortening in-request poll to ~15s — UI escapes the 60s spinner.)
- [ ] Note: `parasut-client.ts` retries POST on 5xx; if Paraşüt created the document but returned 500, duplicate risk exists — refresh-status + idempotency contain it.

### 10.6 OAuth refresh lock — LOW PRIORITY (not a go-live blocker)
- [ ] PR-2’s own acceptance criterion (“token refresh happens once”, FOR UPDATE) is **not met** in current code: `oauth-store.ts` uses no lock; `refresh_lock_until`/`refresh_locked_by` from 00216 are never read. Complete with a conditional-update lock (Small).
- [ ] Operational rule: never remove `PARASUT_USERNAME`/`PARASUT_PASSWORD` secrets — password-grant fallback is the self-heal path for a refresh race.
- Why low priority: with one operator + one daily cron, collision odds are very low; worst case is one failed request and automatic recovery. Full analysis: `docs/active/operational-reliability-notes.md` §2 (summary: Appendix A.7).

### 10.7 Reconcile (PR-8) must NOT be scheduled as currently written
- [ ] Replace aggregate compare with invoice-level matching: pull Paraşüt invoices via a **pagination loop**, match ERP rows on `parasut_invoice_id`; report (a) confirmed ERP rows missing in Paraşüt, (b) amount diffs on matched pairs. Invoices present in Paraşüt but not ERP (including manual credit notes) are informational, not errors.
- [ ] Optional: rolling 7-day window instead of “yesterday only” (catches late finalizations).
- Why: current code does not separate origins (manual credit notes always false-alarm), has no pagination (>1 page silently undercounts), and compares TRY ERP totals to USD invoice totals incorrectly. A control that false-alarms is ignored within a month.

### Suggested go-live order
1. 10.1 → 10.4 (**before** the first controlled test invoice; ~1–2 focused days)
2. First controlled production test: 1 TRY subscription + 1 USD proposal scenario, including `TRL` verification
3. 10.5 (before routine monthly invoicing)
4. 10.6–10.7 (after routine use / when enabling PR-8)

---

## Appendix A — Technical assessment evidence (Rev. 2, 2026-07-17)

> Code/migration evidence for Section 10 items. Source: 2026-07-17 technical assessment (migrations ≤ 00253, `supabase/functions/`, current `src/`). Left in English (original analysis text, to avoid translation drift).

### A.0 Standing context

- The integration code exists in the repo but is **not implemented/activated in production** — no production OAuth tokens, no live dispatch, no synchronization has ever run. All items below are implementation requirements, not incidents.
- ~550 legacy 2026 finance rows were imported directly into `financial_transactions`. They are intentional and **must never be synchronized to Paraşüt** (§10.3).
- Non-Paraşüt operational topics from the same assessment (database backups, the withdrawn finance smoke-test recommendation, system-wide verified-good items) live in `docs/active/operational-reliability-notes.md`.

### A.1 `parasut-reconcile` auth (→ §10.1)

`supabase/config.toml` sets `verify_jwt = false` for `parasut-reconcile`; `parasut-reconcile/index.ts` contains no auth check of any kind — unlike `fetch-tcmb-rates` (`assertCronOrFinanceRole`) and `extend-subscription-payments` (CRON_SECRET). The HTTP response includes `erp: { count, sum }` — daily invoiced revenue totals — and each call triggers authenticated Paraşüt API requests. Once deployed with credentials, anyone who derives the function URL from the public `VITE_SUPABASE_URL` can read revenue aggregates and burn API quota.

### A.2 Idempotency retry lock-out (→ §10.2)

`parasut-dispatch/core/idempotency.ts:11-38`: `acquireIdempotency` inserts on a UNIQUE key; on conflict it returns `{ acquired: false, response: existing.response_snapshot }` **regardless of status**. On failure, `finishIdempotency` sets `status='failed'` with `response_snapshot = null`. The second `prepare-invoice` attempt for the same transaction hits `if (!idem.acquired) return idem.response;` (`prepare-invoice.ts:42`) → returns `null` → `index.ts:97` wraps it as `{ ok: true, data: null }`. No path resets a `failed` (or crashed `started`) key: the first transient failure permanently blocks that document's invoicing while reporting success; recovery requires manual SQL.

### A.3 Server-side eligibility gap (→ §10.3)

`prepare-invoice.ts:18-27` (`validateForDraft`) checks direction, sync status, contact match, tax identity, positive amount — but **not** `deleted_at IS NULL`, **not** any legacy/cutover exclusion, **not** the `official_invoice`/`should_invoice` rule (§0 "Invoice decision"). Those filters exist only client-side (`src/features/finance/parasutApi.js:34-66`). The ~550 legacy rows are plain `income` rows with nothing marking them ineligible. E-invoices are legal documents; an erroneous one requires formal cancellation.

### A.4 Currency flow — complete trace (→ §10.4)

**Field semantics in `financial_transactions`** (from the live posting functions):

| Field | Meaning | Currency |
|---|---|---|
| `amount_original` | Net amount on the source document | **Source currency** (TRY or USD) |
| `original_currency` | `'TRY'` / `'USD'` | — |
| `amount_try` | Net converted to TRY | **Always TRY** |
| `exchange_rate` | USD→TRY rate (NULL for TRY rows) | — |
| `output_vat` | VAT on net | **Always TRY** — computed from `amount_try` in every path |
| `vat_rate` | Percent, e.g. `20` (`DECIMAL(5,2) DEFAULT 20`, 00040:29) | — |

**Path A — Subscriptions (TRY only), `fn_subscription_payment_to_finance` (00201:75-91):** `amount_original = NEW.amount` (TRY), `'TRY'`, `amount_try` identical, `exchange_rate NULL`, `output_vat = NEW.vat_amount` or 0 (TRY). Mapper output all-TRY. **Correct.**

**Path B — TRY proposals (00246:66-131) and TRY work orders (00247: `v_rate := NULL` :289, `v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2)` :298):** all fields TRY, `exchange_rate` omitted by mapper (`|| undefined`). **Correct.**

**Path C — USD proposals (00246:155-240) and USD work orders (00247:268-327): CONFIRMED DEFECT.** `amount_original = total_amount_usd` (**USD**, 00246:234), `exchange_rate = v_rate` (user-confirmed `completion_exchange_rate` preferred, 00246:198-199), `amount_try = ROUND(usd × rate)` (00246:217), `output_vat = ROUND(amount_try × vat_rate/100)` → **TRY** (00246:219). Mapper (`mappers.ts:39-42`):

```ts
const amount    = asNumber(tx.amount_original ?? tx.amount_try); // USD
const outputVat = asNumber(tx.output_vat);                       // TRY
const grossTotal = amount + outputVat;                           // USD + TRY
```

Worked example — $1,000 proposal, confirmed rate 40.00, VAT 20%: ledger row `amount_original=1000`, `amount_try=40000`, `output_vat=8000`, `vat_rate=20`. Payload: currency **USD**, `unit_price=1000`, `vat_rate=20`, `total_vat=8000`, `total_amount=9000`. Correct USD values: `total_vat=200`, `total_amount=1200`.

Caveat: Paraşüt may recompute detail totals server-side from `quantity × unit_price × vat_rate` and ignore client-sent totals — unverifiable without calling the API; an accidentally-correct invoice from an inconsistent payload is still a defect. Include one USD case in the first controlled test regardless.

**Secondary: `TRY` vs `TRL`.** `mappers.ts:51` sends `currency: tx.original_currency || "TRY"`; the Paraşüt v4 `sales_invoices` currency enum historically uses **`TRL`**. If still true, every TRY invoice carries an unknown code. Confidence medium — verify against current swagger (`parasutcom/api-doc` → `spec/swagger.yaml`) or the first draft test; one-line fix.

### A.5 finalize / sync-payment / poller (→ §10.5)

`finalize-invoice.ts` and `sync-payment.ts` use no idempotency records — only read-then-act status checks (`finalize-invoice.ts:49`, `sync-payment.ts:26`), TOCTOU-racy under double-click. `job-poller.ts:16` sleeps up to 60s in-request (60s UI spinner; Edge wall-clock pressure); on timeout it throws, leaving `parasut_sync_status='sent'` with **no recovery handler** (`fetch-history` is display-only). `parasut-client.ts:107-109` retries `POST` on 5xx: if Paraşüt created the e-document but returned 500, the retry can submit twice.

### A.6 Reconcile analysis (→ §10.7)

**What the code does** (`parasut-reconcile/index.ts`): computes **yesterday** (:31-35); ERP side (:64-75) counts/sums (`amount_try + output_vat`) rows with `parasut_sync_status='confirmed'` and `transaction_date = yesterday`; Paraşüt side (:83-91) `GET /sales_invoices?filter[issue_date]=yesterday` counts/sums `gross_total`; match iff counts equal and sums within 0.01 (:96-98).

**Proven noise sources:**
1. **Manual Paraşüt invoices** — §0 keeps cancel/credit notes manual in the Paraşüt UI; the date filter counts *every* invoice in the company, so each manual invoice inflates the Paraşüt side with no ERP counterpart.
2. **Pagination is missing** — `:89` consumes `parasutResponse?.data` once; no `page[number]` loop, no `links.next`. Paraşüt v4 paginates list endpoints (default 15/page — why PR-3 specifies `page[size]=100` for contacts). >1 page/day silently undercounts.
3. **Currency** — ERP sum is TRY; Paraşüt `gross_total` for a USD invoice is in invoice currency. (Disappears if §10.4 policy = always TRY.)
4. **Window** — only "yesterday" is ever checked: a draft finalized days after its `transaction_date` is never re-checked (silent non-coverage, the inverse failure). Amounts themselves are fine (0.01 tolerance).

**Concrete false positive:** 3 Aug: three subscription invoices finalized (each 1,000 net + 200 VAT) → ERP count 3, sum 3,600. Same day one manual **credit note** of 500 TRY in the Paraşüt UI. 4 Aug run: `erp count=3 sum=3600.00; parasut count=4 sum=4100.00` → alarm, nothing wrong. At one manual invoice/week the control alarms weekly on healthy data and gets ignored within a month.

### A.7 OAuth refresh race — summary (→ §10.6)

Full analysis moved to `docs/active/operational-reliability-notes.md` §2. Short version: no single-flight lock in `oauth-store.ts` (the 00216 lock columns are never read; PR-2's own acceptance criterion is unmet), but the password-grant fallback (`oauth-store.ts:90-97`) makes a durable lock-out impossible while `PARASUT_USERNAME`/`PARASUT_PASSWORD` remain configured — worst case is one failed request that succeeds on retry. Low priority; never remove the password-grant secrets.

### A.8 Verified as good (Paraşüt-specific) — do not change

The two-step Prepare → Finalize flow with no trigger-driven Paraşüt writes (the single best safety property of the integration); the Paraşüt table RLS posture (token store deny-all to clients, admin-read-only audit/idempotency tables); the in-memory rate limiter in `parasut-client.ts` (sufficient for one company, one operator). System-wide verified-good items live in `docs/active/operational-reliability-notes.md` §3.

---

## Appendix B — Paraşüt API reference (merged)

> Still-valid API notes filtered from the old `docs/analysis/parasut-integration-audit.md` §§6/8/9. Duplicates merged; historical “no code” sections (§§1–7) were not preserved.

### B.1 Basics

- Base URL: `https://api.parasut.com/v4` — all paths are prefixed with `/{company_id}`.
- Format: **JSON:API** (`application/vnd.api+json`). List endpoints are **paginated** (`page[number]`, `page[size]`; default 15).
- Rate limit: **10 requests / 10 s.** Applied: 8/10 s + exponential backoff + jitter (429/5xx).
- **No sandbox.** Practical approach: separate Paraşüt test company + separate OAuth credentials; keep finalization off for test invoices (they report to GİB).

### B.2 OAuth and tokens

- Credential pack from Paraşüt support: `client_id`, `client_secret`, user email/password, `company_id`.
- First token: `POST https://api.parasut.com/oauth/token` — `grant_type=password` (+ client_id/secret + username/password). Access token valid **7200 s**.
- Refresh: `grant_type=refresh_token` — response includes a **new refresh_token** (rotation) → watch parallel refresh races (Appendix A.7; single-flight lock = §10.6).
- Every request: `Authorization: Bearer <access_token>`.
- Secrets only in Edge Function secrets; never `VITE_*`.

### B.3 Endpoint set

| Job | Endpoint |
|---|---|
| OAuth | `/oauth/token` |
| Invoice (draft) | `POST /{company_id}/sales_invoices` |
| Taxpayer check | `GET /{company_id}/e_invoice_inboxes?filter[vkn]=...` |
| e-Invoice | `POST /{company_id}/e_invoices` |
| e-Archive | `POST /{company_id}/e_archives` |
| Job tracking | `GET /{company_id}/trackable_jobs/{id}` |
| Collection / payment | `POST /{company_id}/sales_invoices/{id}/payments` |
| Delete payment | `DELETE /{company_id}/transactions/{transaction_id}` |
| History | `GET /{company_id}/sales_invoices?filter[contact_id]=...&include=payments,active_e_document` |

### B.4 e-Invoice vs e-Archive

| Feature | e-Invoice | e-Archive |
|---|---|---|
| Buyer | e-Invoice taxpayer (B2B) | Non-taxpayer / individual |
| Delivery | Electronic via GİB | Email / print + daily GİB report |
| Cancel window | Commercial: ~7–8 day buyer rejection window | ~7 day “Cancel” window |
| After window | Credit note | Credit note / expense voucher |

Decision flow: query buyer VKN against `e_invoice_inboxes` **live every time** (no cache) → if registered use `e_invoices`, else `e_archives`. **Once an e-document is issued it cannot be undone; final human approval is required.**

### B.5 Asynchronous e-document flow

`e_invoices`/`e_archives` POST is async: poll returned `trackable_job_id` (`status: running → done | error`). **HTTP 201 is not success** — the job can end in `error`. After `done`, verify with `sales_invoices?include=active_e_document,payments`. PDF URLs are time-limited — persist on your side if you need a durable archive.

### B.6 Collections / payments

- Partial payments supported: multiple `payments` POSTs on the same invoice; remaining balance tracked via Paraşüt `remaining`.
- Payment delete goes through `transactions/{transaction_id}` (not the payment id).
- Response `payment_id` + `transaction_id` are written to ERP (`financial_transaction_payments.parasut_payment_id` / `parasut_transaction_id`, 00218).

### B.7 Idempotency

Paraşüt has **no** standard `Idempotency-Key` header → mandatory at application layer: `parasut_idempotency` table (unique `key`, `status: started|succeeded|failed`, `response_snapshot`), deterministic key (`invoice:financial_tx:{uuid}:v1`), INSERT-on-conflict pattern. Retry-safe requirements: §10.2.

### B.8 Common mistakes (merged list)

1. Automatic invoice issuance → irreversible error (correct in this project: manual two-step approval)
2. Weak customer matching — invoicing without VKN/TCKN (this project: only `exact_vkn`/`exact_tckn` auto)
3. Treating success before async job completes (B.5)
4. Treating PDF URLs as permanent
5. Token refresh race — parallel requests overwrite refresh token (Appendix A.7)
6. Missing idempotency — double invoice/payment after timeout
7. Insufficient audit trail (this project: `parasut_audit_log` with correlation_id + request/response)
8. Wrong `company_id` → 404; bad VKN/TCKN → e-invoice never issues; date format must be `YYYY-MM-DD` Turkey time; FX/VAT mismatch → finalize error

### B.9 Sources

1. Paraşüt API OpenAPI repo: https://github.com/parasutcom/api-doc (`spec/swagger.yaml`)
2. e-Invoice/e-Archive cancellation: https://www.parasut.com/blog/e-fatura-e-arsiv-nasil-iptal-edilir
3. Commercial e-Invoice: https://www.parasut.com/blog/ticari-e-fatura-nedir
4. Supabase Edge Functions / Secrets: https://supabase.com/docs/guides/functions
