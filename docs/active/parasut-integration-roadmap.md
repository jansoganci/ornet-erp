# Paraşüt Integration — Implementation Roadmap (PR Blueprint)

Date: 2026-05-14 (updated: 2026-07-22 — API facts cross-checked against official Paraşüt docs + third-party SDKs; see **Appendix C**)  
Status: Codebase written (migrations / edge functions / UI files in scope of PR-1–PR-8 exist in the repo), **NOT ACTIVE in production** — no production OAuth token, live sync has never run. Before go-live, the **mandatory safeguards in Section 10** must be completed.

> **This file is the SINGLE document for Paraşüt integration.** `docs/analysis/parasut-integration-audit.md` and `docs/technical-assessment-parasut-go-live.md` were folded into this file on 2026-07-17 and deleted: technical assessment evidence → **Appendix A**, Paraşüt API reference → **Appendix B**. (Audit document §§1–7 were historically obsolete “no code” findings and were not preserved.) Non-Paraşüt operational topics (backups, OAuth refresh race analysis, system-wide “verified good” list) were moved the same day to `docs/active/operational-reliability-notes.md`. On 2026-07-22, Appendix B's assumptions were checked against the official docs site and independent SDKs — corrections and new facts are in **Appendix C**; §10.4 and the PR-3 contact-matching plan below were updated to match.

Related documents:
- `CLAUDE.md` (finance module rules — immutable reference)
- `docs/active/operational-reliability-notes.md` (backups + OAuth analysis + system-wide notes)
- **`docs/active/parasut-implementation-plan.md`** (2026-07-23) — the execution checklist: phase-by-phase, file-and-line-accurate fix/build tasks grounded in a real code audit of the existing `parasut-dispatch`/`parasut-reconcile` implementation. Read this roadmap for *why*; read that document for exactly *what to change and where*.

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
   │   ├── product-resolver.ts   CONDITIONAL — get-or-create generic products, only if §10.8's empirical test shows a product relationship is actually required
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
  - **Note (Appendix C.19, confirmed from swagger `ContactAttributes`):** Paraşüt's own schema has no VKN-vs-TCKN `identity_type` field — only a single `tax_number` string plus `contact_type` (enum: `person`/`company`) and `account_type` (`customer`/`supplier`, required). Ornet's `identity_type` (`vkn`/`tckn`) stays a **local-only** validation/UX concept (10 vs 11 digit tax number); when creating a Paraşüt contact, map `identity_type='tckn'` → `contact_type='person'` and `identity_type='vkn'` → `contact_type='company'` — don't try to send `identity_type` to Paraşüt directly, there's no matching field. `ContactAttributes` required fields overall: `name`, `account_type` only — `tax_number`/`tax_office` are optional at the API level even though this project always wants them filled for invoicing eligibility (§10.3).
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
  - **Corrected 2026-07-22 (Appendix C.17):** calls `GET /me` — **not** company-scoped, no `{company_id}` prefix (confirmed against official docs; the earlier `/v4/{company_id}/me` path in this spec was wrong). Response `type: "users"`, not a company resource. To confirm which company the token is scoped to, call with `?include=companies` and read the company name from `included`, not from `data.attributes` directly.
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
- [ ] `supabase functions invoke parasut-dispatch --body '{"action":"ping"}'` calls `GET /me?include=companies` and returns the matching company's name from `included` (not from `data.attributes` — `/me` is user-scoped, Appendix C.17)
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
  - **Revised 2026-07-22 (Appendix C.5):** `page[size]` max is **25**, not 100 — Paraşüt clamps/rejects above that. Every query (both paths below) should also add `filter[account_type]=customer` — Ornet only matches customer contacts, and this excludes supplier-side false matches on shared VKN/TCKN. Two matching paths:
    - `exact_vkn` / `exact_tckn` → query `GET /contacts?filter[tax_number]=...&filter[account_type]=customer` directly per customer (server-side exact match, no bulk pull needed for this path)
    - `name_only` → still requires a full paginated pull (`page[size]=25` + loop over `links.next` / increment `page[number]`, `filter[account_type]=customer`) + normalized client-side name match, since there's no fuzzy-name filter
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
- `supabase/functions/parasut-dispatch/core/product-resolver.ts` — **conditional on §10.8's empirical test result (2026-07-22: downgraded from "mandatory" — swagger shows `relationships.product` is not in `SalesInvoiceDetailAttributes`' required fields, contradicting the quick-start prose). Do the one-draft-invoice test in §10.8 before writing this file** — skip it entirely if the test succeeds without a product relationship.
- `supabase/functions/parasut-dispatch/core/mappers.ts`
  - `financialTxToSalesInvoicePayload(tx, customer)` — convert to JSON:API
  - Required fields confirmed from swagger (Appendix C.18): `SalesInvoiceAttributes` needs only `item_type`, `issue_date`; each `details[]` entry needs only `quantity`, `unit_price`, `vat_rate` — `currency` must be `TRL` (§10.4), `description` recommended per line even if `product` turns out to be optional (§10.8)
  - VAT, FX rate, line items, description, date (YYYY-MM-DD, Turkey time)
  - Each `details[]` entry calls `product-resolver.ts` for a product id **only if §10.8's test shows it's required**
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
| Invoice date rejected — precedes own e-Fatura activation date, or precedes buyer's e-Fatura inbox registration date (Appendix C.3) | Medium | Read buyer's registration date from the `e_invoice_inboxes` response before finalize; default invoice date to "today", never backdate to `transaction_date` if that predates registration |
| `trackable_job` id polled after its 15-minute TTL (Appendix C.3) | Medium | Keep in-request poll well under 15 min (already 60s ceiling); `refresh-status` recovery action (§10.5) must also run within 15 min of job creation, or fall back to re-querying invoice state via `?include=active_e_document` instead of the stale job id |

---

## 7. Out of scope (future notes)

Not in this roadmap, but may be considered later:
- Importing Paraşüt expense invoices into Ornet (Module 13 v2)
- Pushing Ornet expense-side `financial_transactions` (recurring templates, subscription COGS, etc.) to Paraşüt as supplier bills — the opposite direction from the item above. Confirmed (Appendix C.14, owner-fetched official docs, 2026-07-22): Paraşüt models this as an entirely separate `purchase_bills` resource (`GET/POST /{company_id}/purchase_bills`, own `item_type` enum `purchase_bill`/`refund`/`cancelled`, its own `payments`/`cancel`/`recover`/`archive` action set mirroring `sales_invoices`) — not a flag on `sales_invoices`. Noted for reference only; not scoped, not started.
- Webhook-based payment feedback (Paraşüt → Ornet)
- Multi-company support
- e-Dispatch / e-SMM integrations
- Automated credit-note flow

---

## 8. Prerequisites before coding

- [ ] OAuth credential pack obtained from Paraşüt (`client_id`, `client_secret`, user, password, `company_id`)
- [ ] Paraşüt trial/test company created (no dedicated sandbox exists — confirmed Appendix C.3; the trial company against production API + bulk-delete-test-data is the intended approach)
- [ ] Test e-Invoice taxpayer VKN list ready (at least 1 taxpayer + 1 non-taxpayer)
- [ ] Completeness of existing customer VKN/TCKN and tax office data reviewed (if incomplete, a backfill UI may be needed after PR-1)
- [ ] Identify the Paraşüt `account_id` (Kasa/Banka) that `sync-payment.ts` should post collections against (Appendix C.19 — `PaymentFormAttributes.account_id`, not previously a documented prerequisite)
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
- [ ] **`TRY` vs `TRL` — CONFIRMED DIRECTLY FROM THE PRIMARY SWAGGER SPEC (Appendix C.4/C.18), not just SDK cross-reference.** `mappers.ts:51` sends `"TRY"`. The official `parasutcom/api-doc` swagger's `currency` enum for `SalesInvoiceAttributes` is `[TRL, USD, EUR, GBP]` — **`TRY` is not a valid enum value at all**, so the API almost certainly rejects it outright (400/422) rather than silently misbehaving; four independent third-party SDKs corroborate. Treat as a required one-line fix before the first controlled test, not something to "verify on first test." Affects **all** TRY invoices, not only the USD-mixed-payload rows above.
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
- [ ] Replace aggregate compare with invoice-level matching: pull Paraşüt invoices via a **pagination loop** (`page[size]=25` max, confirmed Appendix C.5/C.12), match ERP rows on `parasut_invoice_id`; report (a) confirmed ERP rows missing in Paraşüt, (b) amount diffs on matched pairs. Invoices present in Paraşüt but not ERP (including manual credit notes) are informational, not errors.
- [ ] **New (Appendix C.12): add `filter[item_type]=invoice` to the Paraşüt-side query.** The index endpoint defaults `item_type` to `'invoice, refund, estimate'` — without this filter, reconcile silently counts credit notes and quotes as if they were invoices, a second false-positive source beyond the manual-invoice issue below.
- [ ] Optional but recommended (Appendix C.12): add `filter[print_status]=e_invoice_sent,e_archive_sent` (verify whether the API accepts a comma-separated value or requires separate calls) to restrict the Paraşüt side to sent e-documents only, tightening the match against ERP's `confirmed` semantics.
- [ ] Optional: rolling 7-day window instead of “yesterday only” (catches late finalizations).
- Why: current code does not separate origins (manual credit notes always false-alarm) or document types (refunds/estimates counted as invoices), has no pagination (>1 page silently undercounts), and compares TRY ERP totals to USD invoice totals incorrectly. A control that false-alarms is ignored within a month.

### 10.8 Product resolution for invoice line items — DOWNGRADED to "verify first" 2026-07-22 (Appendix C.16/C.18, was briefly MANDATORY, schema evidence now contradicts the earlier prose-only finding)
- **What changed:** this item was added earlier the same day as a hard blocker, based only on the quick-start guide's prose ("bir veya birden fazla ürün id'sine ihtiyacınız vardır"). A direct fetch of the primary swagger spec (`raw.githubusercontent.com/parasutcom/api-doc/master/spec/swagger.yaml`) shows `SalesInvoiceDetailAttributes`' required fields are only `quantity`, `unit_price`, `vat_rate` — **`relationships.product` is not in any required list**, at the detail level or the endpoint's relationships schema. Prose and formal schema disagree; do not build engineering around either one alone.
- [ ] **Resolve empirically, cheaply, before writing `product-resolver.ts`:** in the trial/test company (§8, no sandbox exists — see B.1/C.3), send one `POST /sales_invoices` draft with a single detail carrying only `quantity`/`unit_price`/`vat_rate`/`description` and **no** `relationships.product`. Two outcomes:
  - **Succeeds** → the quick-start prose was describing the common case (most Paraşüt users invoice against a product catalog), not a hard requirement. Skip `product-resolver.ts` entirely; `mappers.ts` sends line items with `description` directly (matches accrual-based line items like subscription/proposal/work-order revenue rows, which don't naturally correspond to a physical product SKU anyway).
  - **422s** → the quick-start prose was right despite the schema not marking it `required` (schemas sometimes under-declare `required` when a field is conditionally required by business logic, not by JSON-Schema validation). Build the get-or-create fallback below.
- [ ] **Fallback plan if the test 422s** (kept from the original finding, now explicitly conditional): don't create/match a distinct Paraşüt product per work-order material or proposal line item — that reproduces the contact catalog-bloat/false-match problem for no benefit. Instead define a small fixed set of generic service products (one per income category — `subscription`, `proposal_service`, `work_order_service`, `material_resale`, …; align with `service_category_enum`) and resolve each with get-or-create: `GET /products?filter[code]=ORNET_<CATEGORY>` → if empty, `POST /products` (required: `name` only; also set `inventory_tracking: false` — confirmed field, Appendix C.18/Appendix D — to avoid stock-tracking side effects) → cache the returned id. New file `supabase/functions/parasut-dispatch/core/product-resolver.ts`, called from `mappers.ts`.
- Why this is worth a dedicated empirical test rather than picking a side: building `product-resolver.ts` unnecessarily is wasted PR-4 effort; *not* building it when it's actually required means every invoice 422s in production. One draft-invoice test (never finalized, freely deletable, no GİB reporting risk since drafts aren't e-documents) resolves it for near-zero cost.

### Suggested go-live order
1. **Resolve §10.8 empirically first** (one draft-invoice test, no product relationship) — cheapest possible unblock, determines whether `product-resolver.ts` is in scope at all
2. 10.1 → 10.4 (**before** the first controlled test invoice; ~1–2 focused days)
3. Determine the Paraşüt `account_id` (Kasa/Banka) to post payments against (Appendix C.19) — needed before any `sync-payment.ts` test, not previously a documented prerequisite
4. First controlled production test: 1 TRY subscription + 1 USD proposal scenario, including `TRL` verification and (if needed) the generic-product get-or-create path
5. 10.5 (before routine monthly invoicing)
6. 10.6–10.7 (after routine use / when enabling PR-8)

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
1a. **Refunds and estimates counted as invoices (Appendix C.12, 2026-07-22 finding)** — `GET /sales_invoices` defaults `filter[item_type]` to `'invoice, refund, estimate'`; current reconcile code sets no `item_type` filter at all, so credit notes and quotes silently inflate the Paraşüt-side count/sum on top of the manual-invoice noise in point 1. Fix: explicit `filter[item_type]=invoice`.
2. **Pagination is missing** — `:89` consumes `parasutResponse?.data` once; no `page[number]` loop, no `links.next`. Paraşüt v4 paginates list endpoints (default `page[size]=15`, **max 25** per Appendix C.5 — PR-3's original `page[size]=100` spec was itself wrong and has been corrected below). >1 page/day silently undercounts.
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
- Rate limit: **10 requests / 10 s** (confirmed twice over — official docs prose + independent third-party SDK, Appendix C.2). Applied: 8/10 s + exponential backoff + jitter (429/5xx).
- **No sandbox exists — resolved 2026-07-22 (Appendix C.3), do not ask support, proceed on this basis.** The primary swagger spec defines exactly one host (`api.parasut.com`) and one `basePath` (`/v4`) — no staging/alternate host anywhere in the 19k-line spec, and the strings "sandbox"/"staging" don't appear in it at all. `parasutcom/api-doc`'s GitHub issues return zero hits for "sandbox" or "test". One secondary source (dukkan.io) claimed a staging toggle but was unreachable to verify and contradicts the primary source — treated as likely boilerplate copied from an unrelated payment-gateway integration, not evidence. **Practical approach (the de facto sandbox):** Paraşüt's own free trial company (14 days, real production API, disposable data) — Paraşüt explicitly supports bulk-deleting all test data from a trial company, which is the intended cleanup path. Separate OAuth credentials for the trial company; keep finalization off for test invoices until deliberately testing e-document creation (they report to GİB once finalized).

### B.2 OAuth and tokens

- Credential pack from Paraşüt support (`destek@parasut.com`): `client_id`, `client_secret`, `company_id`; for the password grant also user email/password. Official docs list OAuth2 with an `accessCode` (authorization_code) flow as the formal security scheme (`authorize: https://api.parasut.com/oauth/authorize`, `token: https://api.parasut.com/oauth/token`) — `grant_type=password` is documented as a second, simpler option ("2. grant_type=password") and is what this project uses for the unattended Edge Function. Both are officially supported; no need to switch to authorization_code.
- First token: `POST https://api.parasut.com/oauth/token` — `grant_type=password` (+ client_id/secret + username/password + `redirect_uri=urn:ietf:wg:oauth:2.0:oob`). Access token valid **7200 s** (confirmed, official docs).
- Refresh: `grant_type=refresh_token` — response includes a **new refresh_token** (rotation, confirmed by official docs, not just third-party observation) → watch parallel refresh races (Appendix A.7; single-flight lock = §10.6).
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
| Connectivity check ("ping") | `GET /me` — **not** company-scoped (no `{company_id}` prefix); `type: "users"`; add `?include=companies` to confirm which company the token resolves to (Appendix C.17) |
| Job tracking | `GET /{company_id}/trackable_jobs/{id}` (confirmed exact shape via official docs, Appendix C.17 — no new status-enum detail beyond B.5/C.7) |
| Collection / payment | `POST /{company_id}/sales_invoices/{id}/payments` |
| Delete payment | `DELETE /{company_id}/transactions/{transaction_id}` |
| History | `GET /{company_id}/sales_invoices?filter[contact_id]=...&include=payments,active_e_document` |
| Contact exact-match lookup | `GET /{company_id}/contacts?filter[tax_number]=...` (also supports `filter[name]`, `filter[email]`, `filter[tax_office]`, `filter[city]`, `filter[account_type]`) — confirmed in swagger, Appendix C.5; use this directly for `exact_vkn`/`exact_tckn` matching instead of bulk-pulling contacts |
| PDF (per e-document) | `GET /{company_id}/e_archives/{id}/pdf` (mirror: `/e_invoices/{id}/pdf`) — **note the `{id}` here is the e-document's own id (`e_archives`/`e_invoices` resource id = our `financial_transactions.parasut_e_document_id`), not the `sales_invoice` id** (Appendix C.15); returns type `e_document_pdfs`; **204 until ready** per the official quick-start guide (poll), then a URL valid 1 hour (Appendix C.3) |
| e-Archive detail (backlink to invoice) | `GET /{company_id}/e_archives/{id}?include=sales_invoice` — confirms `e_archives` is an addressable resource distinct from `sales_invoices`, matching the 00217 schema (`parasut_e_document_id` is this id, not the invoice id) (Appendix C.15) |
| e-Invoice detail (backlink to invoice) | `GET /{company_id}/e_invoices/{id}?include=invoice` — mirrors `e_archives`, confirmed via official docs (Appendix C.15). **Note the relationship name differs by resource: `e_archives` backlinks via `sales_invoice`, `e_invoices` backlinks via `invoice`** — the mapper/handler code must use the correct include name per document type, not a shared constant. |
| Draft delete (used by `cancel-draft.ts`) | `DELETE /{company_id}/sales_invoices/{id}` — plain delete, distinct from the `.../cancel` action below (Appendix C.13) |
| Formal cancel (not currently used — §0 keeps this manual) | `DELETE /{company_id}/sales_invoices/{id}/cancel` — API-level equivalent of the Paraşüt UI cancel action; exists but intentionally not wired up (Appendix C.13) |
| Undo a delete | `PATCH /{company_id}/sales_invoices/{id}/recover` — safety net if a delete targets the wrong invoice (Appendix C.13) |

### B.4 e-Invoice vs e-Archive

| Feature | e-Invoice | e-Archive |
|---|---|---|
| Buyer | e-Invoice taxpayer (B2B) | Non-taxpayer / individual |
| Delivery | Electronic via GİB | Email / print + daily GİB report |
| Cancel window | Commercial: **8-day** buyer rejection window (confirmed, parasut.com/blog, Appendix C.9) | ~7 day “Cancel” window |
| After window | Credit note | Credit note / expense voucher |

Decision flow: query buyer VKN against `e_invoice_inboxes` **live every time** (no cache) → if registered use `e_invoices`, else `e_archives`. **Once an e-document is issued it cannot be undone; final human approval is required.** Export invoices (`İhracat Faturaları`) are always issued as `e_invoices` regardless of the inbox check (official docs, Appendix C.3) — not currently a case this project needs, but relevant if export customers are ever added.

**Invoice date constraint (Appendix C.10, field names confirmed Appendix C.18):** the invoice's issue date must be (a) after your own company's e-Fatura/e-Smm activation date, and (b) not before the date the buyer started using their e-Fatura label. Exact response fields on `e_invoice_inboxes` (`EInvoiceInboxAttributes`, confirmed from swagger): **`registered_at`** and **`address_registered_at`** (both date-time) — read one of these (verify which on first test; likely `address_registered_at` = the specific e-Fatura address' registration date) when deciding the invoice date, don't just default to `transaction_date`. A `finalize-invoice` call with a backdated `transaction_date` (e.g. a job completed days before invoicing) can fail this check. See §6 risk table.

### B.5 Asynchronous e-document flow

`e_invoices`/`e_archives` POST is async: poll returned `trackable_job_id`. Status values per the official quick-start prose: `pending` (queued, not started) → `running` (in progress) → `done` (success) | `error` (failed, inspect response for the error message) — our doc previously only listed `running → done|error`, missing the initial `pending` state. **Caveat (Appendix C.18):** the formal swagger `TrackableJobAttributes.status` enum only lists `running`/`done`/`error` — no `pending` — so the prose and schema disagree here too (lower stakes than the C.16 product question; just don't hard-fail if an unexpected status string appears, log and treat unknowns as still-in-progress). **HTTP 201 is not success** — the job can end in `error`. **The `trackable_job_id` is only valid for 15 minutes after creation** (official docs, not previously documented) — polling or recovery logic (§10.5 `refresh-status`) must either finish within that window or fall back to re-querying invoice state via `sales_invoices?include=active_e_document,payments` instead of the stale job id.

After `done`, verify with `sales_invoices?include=active_e_document,payments`. **PDF generation is itself a separate async step**, not previously documented: the PDF endpoint returns **204 with an empty body** until the PDF is ready, so it must be polled at intervals (no fixed interval documented); once ready, response type `e_document_pdfs` with confirmed fields (`EDocumentPdfAttributes`, Appendix C.18) **`url`** and **`expires_at`** — read `expires_at` rather than hardcoding "1 hour" in code, persist the PDF on your side if you need a durable archive, don't hand the URL directly to customers.

### B.6 Collections / payments

- Partial payments supported: multiple `payments` POSTs on the same invoice; remaining balance tracked via Paraşüt `remaining`.
- Payment delete goes through `transactions/{transaction_id}` (not the payment id).
- **`PaymentFormAttributes` has no formally required fields, but practically needs `account_id`** (the Paraşüt Kasa/Banka account the payment lands in — also determines the payment's currency) plus `date`, `amount`, and `exchange_rate` where relevant (Appendix C.18/C.19). **This `account_id` was not a documented prerequisite anywhere in the original roadmap** — it must be decided/looked up (via the accounts UI or an `/accounts`-style endpoint, not yet explored in this research pass) before `sync-payment.ts` can be tested. Added to §8 prerequisites.
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
5. Official Paraşüt API docs site (quick-start / "Sık Kullanılan İşlemler" pages): https://apidocs.parasut.com/ — fetched directly by project owner 2026-07-22 (this SPA is not reachable via automated static fetch; see Appendix C)
6. e-Fatura cancellation window, current: https://www.parasut.com/blog/e-fatura-nasil-iptal-edilir
7. Third-party Paraşüt client SDKs used to cross-check the live API surface: https://github.com/bigoen/parasut (PHP), https://github.com/yigitkonur/mcp-parasut

---

## Appendix C — API verification pass (2026-07-22)

> Purpose: the owner flagged that a wrong e-invoice is costly to unwind (manual credit note, customer call), so before writing any Paraşüt-facing code, Appendix B's claims were checked against real, current sources — the official docs site (fetched directly by the owner, since it's a JS-rendered SPA that automated fetch tools can't reach) plus independent third-party SDKs and the public swagger spec (via a research pass). Findings are folded into Appendix B and §10 above (each patched line links back here); this appendix is the evidence log.

**Sources used:** official `apidocs.parasut.com` quick-start pages (owner-fetched, primary for OAuth/async/date-constraint facts); `github.com/parasutcom/api-doc` swagger spec (primary for `page[size]`, `filter[tax_number]`, `e_invoice_inboxes` params); `github.com/bigoen/parasut` and `github.com/yigitkonur/mcp-parasut` (independent client implementations, used to cross-check currency code and polling behavior since the swagger enum itself was not directly viewable); `parasut.com/blog/e-fatura-nasil-iptal-edilir` (current cancellation-window post).

| # | Item | Verdict | Detail |
|---|---|---|---|
| C.1 | OAuth grants | Confirmed | `authorization_code` (`accessCode`) is the formal documented scheme; `grant_type=password` is an official second option (used by this project). Token `expires_in=7200`, `refresh_token` rotates on every refresh — confirmed by the official docs, not just observed in code. |
| C.2 | Rate limit | Confirmed | 10 requests / 10 s — official docs prose + independent SDK agree. |
| C.3 | Sandbox | **Resolved: no sandbox exists** | Primary swagger spec: single host, no staging/alternate host in 19k lines, "sandbox"/"staging" absent from the spec text. `parasutcom/api-doc` GitHub issues: zero hits for "sandbox"/"test". De facto approach: Paraşüt's free trial company (14 days, real production API) + Paraşüt's own bulk-delete-test-data feature for cleanup. |
| C.4 | `sales_invoices` currency field | **Corrected: `TRL`, not `TRY`** | Four independent third-party SDKs built against the live v4 API all hardcode `TRL`; none use `TRY`. **Now also corroborated by the official docs themselves**: the `sales_invoices` index `sort` parameter lists a `remaining_in_trl` field (Appendix C.12) — Paraşüt's own naming convention uses `trl`, not `try`. `mappers.ts:51` currently sends `"TRY"` — fix before first test invoice, treat as confirmed defect (§10.4), confidence now very high. |
| C.5 | `contacts` pagination + filters | **Corrected + new capability found — double-confirmed** | `page[size]` default 15, **max 25** (PR-3's original `page[size]=100` spec was wrong, now fixed above). Confirmed twice: once via swagger (research pass), once directly against the official `apidocs.parasut.com` contacts index page (owner-fetched 2026-07-22) — both list `filter[tax_number]`, `filter[name]`, `filter[email]`, `filter[tax_office]`, `filter[city]`, `filter[account_type]` (values: `customer`, `supplier`). Exact VKN/TCKN matching can query directly instead of bulk-pulling + client-side matching (PR-3 updated above); **add `filter[account_type]=customer`** to every match/lookup query too — Ornet only matches customers, and without this filter a VKN/TCKN that happens to also exist as a supplier contact could produce a false match. |
| C.6 | `e_invoice_inboxes` | Confirmed | `filter[vkn]` (integer) param, same 15/25 pagination cap. |
| C.7 | Async e-document flow | Confirmed + new facts | Status enum is `pending → running → done \| error` (we previously omitted `pending`). **New: `trackable_job_id` expires 15 minutes after creation** — not previously documented, added to §6 risk table and B.5. **New: PDF generation is a second, separate async step** (204-until-ready, then a 1-hour URL) — not previously documented, added to B.5. |
| C.8 | Payments payload | Confirmed | To read a payment's underlying transaction id for deletion: `GET` the sales invoice with `?include=payments.transaction`, then `DELETE /transactions/{id}` — matches B.6, now sourced from official docs rather than inferred. |
| C.9 | e-Fatura cancellation window | Confirmed, sharpened | **8 days** (owner's blog source, dated 2026), replacing our previous "~7–8 gün" estimate. |
| C.10 | Invoice date constraint | **New finding, not previously documented** | Issue date must be after your own e-Fatura/e-Smm activation date AND not before the buyer's e-Fatura inbox registration date (read from the `e_invoice_inboxes` response). Added as a new risk (§6) — a backdated `transaction_date` used as invoice date could fail finalize. |
| C.11 | Export invoices | New, low relevance today | Always issued as `e_invoices` regardless of the inbox check — not a case this project currently has, noted in B.4 for future reference. |
| C.12 | `sales_invoices` index (`GET /sales_invoices`) full parameter set | New, from official docs — **directly improves §10.7 reconcile fix** | `filter[item_type]` **defaults to `'invoice, refund, estimate'`** — i.e. an index call with no explicit `item_type` filter (which is what `parasut-reconcile` currently does) counts credit notes (`refund`) and quotes (`estimate`) alongside real invoices, a second and previously-undocumented noise source on top of Appendix A.6's "manual invoices" finding. Fix: reconcile must set `filter[item_type]=invoice` explicitly. `filter[print_status]` supports `e_invoice_sent` / `e_archive_sent` / `e_smm_sent` (also `printed`, `not_printed`, `invoices_not_sent`) — reconcile can additionally filter to sent e-documents only, excluding drafts, further tightening the match against ERP's `confirmed` status. `page[size]` cap confirmed at 25 here too (consistent with C.5) — the reconcile pagination fix in §10.7 must use it. Also surfaces `filter[payment_status]` (`overdue`/`not_due`/`unscheduled`/`paid`) — not needed for reconcile today, but useful if a future receivables cross-check is built. |
| C.13 | `sales_invoices` action endpoints: `.../cancel`, `.../recover`, `.../archive`, `.../unarchive` | New — **reconsider a §0 assumption, don't change it yet** | §0 states invoice cancellation is manual-only in the Paraşüt UI. The official docs show `DELETE /sales_invoices/{id}/cancel` exists as a formal API action (distinct from the plain `DELETE /sales_invoices/{id}` used by our `cancel-draft.ts` for drafts) — likely the API path for the legal e-Fatura/e-Arşiv cancellation within the buyer's rejection window (Appendix B.4). We are **not** changing §0's "manual only" decision now — the two-step approval + no-automation stance is a deliberate safety choice, not a gap — but a future PR could offer a "Cancel in Paraşüt" button that calls this endpoint instead of sending the operator to the Paraşüt UI, now that we know it's programmatically reachable. Also noted: `PATCH /sales_invoices/{id}/recover` can undo a delete — a safety net worth knowing about if `cancel-draft.ts` ever deletes the wrong invoice. |
| C.14 | `contacts` sub-resources: `contact_debit_transactions` (labelled "Tahsilat"), `contact_credit_transactions` (labelled "Ödeme") | New, confirmed out of scope | Direct contact-ledger transactions not tied to a specific invoice. Our design always links payments to a specific `sales_invoices/{id}` (matches the project's per-document, accrual-based collection model — see CLAUDE.md's Tahsilat/receivables rules) via `sales_invoices/{id}/payments` (B.6), so these endpoints are intentionally unused. Logged so a future contributor doesn't have to re-discover and re-evaluate them. |
| C.15 | `e_archives` / `e_invoices` as standalone addressable resources | Confirmed, clarifies PDF + backlink implementation | Both `POST /e_archives` and `POST /e_invoices` return a `trackable_jobs` record (id ≠ the eventual e-document id). Once `done`, the e-document itself is independently addressable: `GET /e_archives/{id}` / `GET /e_invoices/{id}` — this `{id}` **is** what belongs in `financial_transactions.parasut_e_document_id` (00217), not the `sales_invoice` id, confirming the schema was already shaped correctly. PDF fetch uses this same id: `GET /e_archives/{id}/pdf` or `GET /e_invoices/{id}/pdf` → type `e_document_pdfs`. Backlink-to-invoice relationship name differs by type: `include=sales_invoice` for `e_archives`, `include=invoice` for `e_invoices` — code must not assume a shared include name. `purchase_bills` (the separate expense-side resource, §7) was also confirmed distinct from `sales_invoices`. |
| C.16 | **`products` resource + whether line items require a product id** | **Downgraded same-day, 2026-07-22 — prose vs. primary schema conflict, now an empirical open question, not a confirmed blocker** | Original finding (this same day, before C.18): quick-start guide states a sales invoice needs a customer id **and one or more product ids** per line, and `/products` is confirmed as a full resource. **Superseded by C.18**: a direct fetch of the primary swagger spec shows `relationships.product` is **not** in `SalesInvoiceDetailAttributes`'s required-fields list at any level. Prose and formal schema disagree — resolved not by picking a source but by deferring to one cheap empirical test (§10.8) before committing to building `product-resolver.ts`. Kept as a table row for the history; §10.8 in the body is now the authoritative, current version of this finding. |
| C.17 | `GET /me` and `GET /trackable_jobs/{id}` | `/me` **corrected**; `trackable_jobs` confirmed, no new detail | PR-2's `ping.ts` spec had the wrong path (`/v4/{company_id}/me`, implying a company-scoped resource returning a company name directly). Official docs: `GET /me` has **no** `{company_id}` prefix, returns `type: "users"` — get the company via `?include=companies`, not from `data.attributes`. Fixed in PR-2's handler spec and acceptance criteria above. `GET /{company_id}/trackable_jobs/{id}` shape matches what B.5/C.7 already documented (`TrackableJobAttributes`, `relationships` present but untyped in the doc) — no correction needed, just confirmed. |
| C.18 | **Full attribute schemas, direct primary-source fetch** (`raw.githubusercontent.com/parasutcom/api-doc/master/spec/swagger.yaml`, 19,206 lines) | Confirmed, supersedes several earlier "verify on first test" notes; full field lists in **Appendix D** | Highlights: `SalesInvoiceAttributes` required = `item_type`, `issue_date` only; `currency` enum = `[TRL, USD, EUR, GBP]` (`TRY` not valid at all — settles C.4 definitively). `SalesInvoiceDetailAttributes` required = `quantity`, `unit_price`, `vat_rate` only — **`relationships.product` not required** (→ C.16/§10.8 downgrade). `ProductAttributes` required = `name` only; has `inventory_tracking: boolean`. `ContactAttributes` required = `name`, `account_type` only; **no `identity_type`/vkn-vs-tckn field** — just `tax_number` + `contact_type` (`person`/`company`) (→ PR-1 note above). `PaymentFormAttributes`: no required list, but `account_id` is practically needed (→ C.19). `EInvoiceInboxAttributes`: `vkn`, `e_invoice_address`, `name`, `inbox_type`, `address_registered_at`, `registered_at` (→ B.4 invoice-date check now has exact field names). `EDocumentPdfAttributes`: `url`, `expires_at` (→ B.5 PDF handling now has exact field names). `TrackableJobAttributes.status` enum in swagger = `running`/`done`/`error` only — no `pending`, a second (low-stakes) prose-vs-schema gap alongside C.16. `POST /e_archives`/`/e_invoices` relationship confirmed as `relationships.sales_invoice.data.id` — matches what was already assumed, no correction needed there. |
| C.19 | Payment `account_id` prerequisite | **New, not previously documented anywhere in the roadmap** | `PaymentFormAttributes` has no formal required-fields list, but every real payment practically needs `account_id` (the Kasa/Banka account it lands in, which also determines currency) — `sync-payment.ts` (PR-5) cannot be tested without first deciding/looking up which Paraşüt account this project should post collections against. Added to §8 prerequisites and B.6. |

**Net effect on the roadmap:** **the single most impactful change this pass is a correction, not a new finding** — the same-day C.16/§10.8 "product resolution mandatory" conclusion was itself based on prose only and is now downgraded to "verify with one cheap test" after a direct primary-source (swagger) fetch showed the opposite of what the quick-start guide implied; treat this as a reminder that prose sources in this API's docs are not always schema-accurate, and that a primary-source fetch is worth doing before hardening a "mandatory" claim into code. Separately, this pass **strengthened** C.4 (currency) to the highest possible confidence (`TRY` isn't even a valid enum value, confirmed directly in swagger) and **fully resolved** C.3 (no sandbox exists, use the trial-company + bulk-delete approach — stop treating this as an open question). One new, previously-undocumented prerequisite surfaced (C.19, payment `account_id`). Full attribute schemas for six resource types are now available (Appendix D), replacing guesswork in `mappers.ts`/`create-contact.ts`/`product-resolver.ts` (if still needed) with confirmed field names.

---

## Appendix D — Confirmed attribute schemas (source: `parasutcom/api-doc` swagger, fetched 2026-07-22)

> Field lists extracted directly from the primary OpenAPI spec (`raw.githubusercontent.com/parasutcom/api-doc/master/spec/swagger.yaml`). **Required** = present in the schema's formal `required` array. Everything else is optional at the JSON-Schema level even if this project always wants it filled (e.g. `tax_number` on a contact) — optionality here is about what the API will accept, not what our own business rules should require before calling it. Where §10.8 (Appendix C.16) showed prose and schema can disagree, treat "not required" as "not required by the validator," not as "definitely works as a free-text field" — verify anything load-bearing with a real test before relying on it in production.

### D.1 `SalesInvoiceAttributes` (base of `SalesInvoiceCreateUpdateAttributes`, used by `POST/PUT /sales_invoices`)

**Required:** `item_type`, `issue_date`

| Field | Notes |
|---|---|
| `item_type` | enum: `invoice`, `export`, `estimate`, `cancelled`, `recurring_invoice`, `recurring_estimate`, `recurring_export`, `refund` — use `invoice` for normal sales |
| `issue_date` | required |
| `due_date` | optional |
| `currency` | enum **`[TRL, USD, EUR, GBP]`** — `TRY` is not a valid value (§10.4) |
| `exchange_rate` | for non-TRL currencies |
| `description` | |
| `invoice_series` / `invoice_id` | Paraşüt-side numbering, don't set unless a specific series is required |
| `withholding_rate` | tevkifat, not currently used by this project's revenue types |
| `invoice_discount_type` / `invoice_discount` | invoice-level discount, distinct from per-line `discount_*` (D.2) |
| `billing_address` / `billing_postal_code` / `phone` / `fax` | |
| `tax_office` / `tax_number` | can override the contact's own values for this specific invoice |
| `country` / `city` / `district` / `is_abroad` | `is_abroad` relevant only for `export` item_type |
| `order_no` / `order_date` | must be set **together** if set at all; required for some special-requirement flows (Amazon, per the earlier "Belirli Firmalar İçin Özel Gereksinimler" note — not relevant to this project's current customers) |
| `shipment_addres` (sic, typo in the API itself — not ours) / `shipment_included` | |
| `cash_sale` | boolean — relevant to `PaymentFormAttributes` inline creation via `payment_account_id`/`payment_date`/`payment_description` on `SalesInvoiceCreateUpdateAttributes` |
| `payer_tax_numbers` | required for public-sector ("kamu") buyers — not currently relevant |
| `invoice_note` | free-text note printed on the invoice |
| `append_contact_balance` | |
| `e_document_accounts` | |

`SalesInvoiceCreateUpdateAttributes` (the `POST`/`PUT` variant) adds only: `payment_account_id`, `payment_date`, `payment_description` — for creating an invoice with an inline cash-sale payment in one call (this project's PR-4/PR-5 split creates the invoice and payment as separate steps, so these three are likely unused unless a future optimization merges them).

### D.2 `SalesInvoiceDetailAttributes` (each entry in `relationships.details[]`)

**Required:** `quantity`, `unit_price`, `vat_rate`

| Field | Notes |
|---|---|
| `quantity` | required |
| `unit_price` | required, in the invoice's `currency` |
| `vat_rate` | required, percent |
| `discount_type` / `discount_value` | line-level discount |
| `vat_withholding_rate` | |
| `excise_duty_type` / `excise_duty_value` | ÖTV, not relevant to this project's services |
| `communications_tax_rate` | ÖİV, not relevant |
| `description` | recommended even though not required — this is what a human sees on the line if no `product` name is shown |
| `delivery_method` / `shipping_method` | |

**`relationships.product` is not in this schema's required list** — see §10.8 for why this doesn't settle the question by itself and what the empirical test plan is.

### D.3 `ProductAttributes` (`POST/PUT /products`)

**Required:** `name`

| Field | Notes |
|---|---|
| `name` | required |
| `code` | maps to `filter[code]` for lookups (used by `product-resolver.ts` if built) |
| `vat_rate` | default VAT for this product on new invoice lines |
| `unit` | e.g. "Adet" |
| `list_price` / `currency` | |
| `barcode` / `gtip` | not relevant to generic service products |
| `inventory_tracking` | **boolean — set `false` for any generic service product** to avoid stock-tracking side effects (relevant if §10.8's test shows products are needed) |

### D.4 `ContactAttributes` (`POST/PUT /contacts`)

**Required:** `name`, `account_type`

| Field | Notes |
|---|---|
| `name` | required |
| `account_type` | required, enum `customer`/`supplier` — always `customer` for this project's matching flow (also usable as a query filter, C.5) |
| `contact_type` | enum `person`/`company` — the closest Paraşüt equivalent to Ornet's `identity_type`; map `tckn`→`person`, `vkn`→`company` (no direct `identity_type` field exists on the Paraşüt side, see PR-1 note above) |
| `tax_number` | optional at the API level; this project always wants it filled for invoicing eligibility (§10.3) |
| `tax_office` | optional at the API level, same note |
| (address/email/phone fields exist but weren't enumerated in this pass — not currently blocking) | |

### D.5 `PaymentFormAttributes` (`POST /sales_invoices/{id}/payments`)

**Required:** none formally declared, but practically:

| Field | Notes |
|---|---|
| `account_id` | the Kasa/Banka account the payment lands in; also determines the payment's currency — **must be decided/looked up before PR-5 can be tested** (C.19, new §8 prerequisite) |
| `date` | |
| `amount` | |
| `exchange_rate` | for non-TRL invoices |
| `description` | |

### D.6 `EInvoiceInboxAttributes` (`GET /e_invoice_inboxes` results)

| Field | Notes |
|---|---|
| `vkn` | |
| `e_invoice_address` | the buyer's e-Fatura routing address ("etiket") |
| `name` | buyer's registered name |
| `inbox_type` | |
| `registered_at` | date-time |
| `address_registered_at` | date-time — **use one of these two for the B.4/C.10 invoice-date-vs-registration-date check; confirm which on the first controlled test**, since the spec doesn't make explicit which governs the "cannot invoice before this date" rule |

### D.7 `EDocumentPdfAttributes` (`GET /e_archives|e_invoices/{id}/pdf` once ready)

| Field | Notes |
|---|---|
| `url` | time-limited PDF URL |
| `expires_at` | **read this instead of hardcoding "1 hour"** in code (B.5) |

### D.8 `TrackableJobAttributes` (`GET /trackable_jobs/{id}`)

| Field | Notes |
|---|---|
| `status` | swagger enum: `running`, `done`, `error` — quick-start prose additionally describes a `pending` state not present in this enum (B.5); handle unknown status strings defensively rather than hard-failing |
