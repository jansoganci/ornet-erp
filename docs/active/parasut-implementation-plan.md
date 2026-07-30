# Paraşüt Integration — Implementation Plan (Execution Checklist)

Date: 2026-07-23
Companion to `docs/active/parasut-integration-roadmap.md` (the "why" — evidence, risk analysis, API reference, Appendix D schemas). **This document is the "how"** — a phase-by-phase, file-and-line-accurate checklist meant to be handed directly to an implementing agent (Claude Code, Cursor, or a human) with no further research needed to start. Read the roadmap first if you need rationale for *why* a task exists; this document assumes that context and just tells you what to change.

**Grounding:** every code-state claim below comes from a read-only audit of the actual current repo on 2026-07-23 (not from the roadmap's older Appendix A citations, which may have drifted). File:line references are accurate as of that audit — if the file has changed since, re-verify before trusting the line number.

## Legend

- 🧍 **Human-only** — requires a Paraşüt account, credentials, or a business decision. No coding agent can do this step.
- 🤖 **Code-only** — safe for an AI coding agent to execute from this document alone.
- ⚠️ **Hard dependency** — do not start/merge/deploy until the referenced item is done.
- **`[x]` / ✅ means "code written and reviewed," NOT "verified against the real Paraşüt API."** An independent audit (2026-07-23) flagged that earlier revisions of this document let `[x]` read as production-ready when several marked items still had real bugs (see the "Outstanding" section below, most now fixed) — this file has no code-signing authority, it just tracks intent. **Nothing in this document is actually verified until Phase 6's test matrix passes against a real Paraşüt company.** Treat every `[x]` as "ready to test," not "ready to trust."

---

## Phase 0 — Prerequisites (🧍, start immediately, run in parallel with Phase 1–3 coding)

Nothing in Phase 1–3 needs Phase 0 to be *finished*, but Phase 4–6 do (⚠️ marked below). Start Phase 0 now; don't block coding on it.

- [ ] **0.1** 🧍 Email `destek@parasut.com` requesting an OAuth credential pack: `client_id`, `client_secret`, a user email/password for the `password` grant, and the `company_id` this project will use.
- [ ] **0.2** 🧍 Sign up for Paraşüt's free trial company (14 days). This is the de-facto sandbox — no dedicated staging environment exists (confirmed, roadmap Appendix C.3). Use this company_id for all testing in Phases 1–6; never point any of this at a real production company_id until Phase 7.
- [ ] **0.3** 🧍⚠️ **The single empirical test that resolves §10.8.** Once 0.1–0.2 are done, obtain an access token (see roadmap B.2 for the exact `curl` for `grant_type=password`) and send:
  ```
  POST https://api.parasut.com/v4/{company_id}/sales_invoices
  {
    "data": {
      "type": "sales_invoices",
      "attributes": { "item_type": "invoice", "issue_date": "2026-07-23" },
      "relationships": {
        "contact": { "data": { "id": "<any existing trial-company contact id, or create one first via POST /contacts with {name, account_type: 'customer'}>", "type": "contacts" } },
        "details": { "data": [ { "type": "sales_invoice_details", "attributes": { "quantity": 1, "unit_price": 100, "vat_rate": 20, "description": "Test kalemi" } } ] }
      }
    }
  }
  ```
  No `relationships.product` anywhere in this payload. Record the result:
  - **201 Created → product NOT required.** Phase 4 becomes a no-op (mappers.ts already doesn't set a product relationship — confirmed by the code audit). Delete this draft invoice afterward (`DELETE /sales_invoices/{id}`) to keep the trial company clean.
  - **422 Unprocessable Entity → product IS required.** Phase 4.2 (product-resolver.ts) is in scope; read the 422 response body's `errors[].detail` for the exact validation message and paste it into this doc's Phase 4 section for whoever implements it.
  - Report the outcome back before Phase 4 starts.
- [ ] **0.4** 🧍 Decide which Paraşüt account (Kasa/Banka) collections should post against. Check the trial company's "Kasa ve Bankalar" screen in the Paraşüt web UI, pick one (or create a simple "Ornet Tahsilat Hesabı"), note its numeric id. (No `/accounts`-style endpoint was confirmed reachable in this research pass — get the id from the UI, or from a `GET /sales_invoices/{id}/payments?include=payable` response after creating one manual test payment in the UI, whichever is faster.)
- [ ] **0.5** 🧍 Prepare a short test-VKN list: at least 1 known e-Fatura taxpayer VKN and 1 known non-taxpayer VKN/TCKN, for the Phase 6 test matrix.
- [ ] **0.6** 🧍 Confirm `VITE_SENTRY_DSN` is set in the deploy environment (already a roadmap prerequisite, unrelated to today's findings — just re-confirm it's still true).
- [ ] **0.7** 🧍⚠️ Once 0.1/0.2/0.4 have real values, set them as **Supabase Edge Function secrets** (not `.env.local`, not `VITE_*`): `PARASUT_BASE_URL=https://api.parasut.com/v4`, `PARASUT_OAUTH_URL=https://api.parasut.com/oauth/token`, `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`, `PARASUT_USERNAME`, `PARASUT_PASSWORD`, `PARASUT_COMPANY_ID`. (`.env.example` already lists exactly these 7 keys correctly — confirmed by the code audit, no drift to fix there.) Add an 8th, new one for Phase 5: `PARASUT_DEFAULT_ACCOUNT_ID` = the value from 0.4.

---

## Phase 1 — Currency + contact payload fixes (🤖, no code dependencies; needs Phase 0.1–0.2 to *test*)

These are the two highest-value fixes: without them, every invoice and every contact creation is broken today, confirmed by the audit.

- [x] **1.1** ✅ 2026-07-23 Fixed `supabase/functions/parasut-dispatch/core/mappers.ts`.
  **Was:** `currency: tx.original_currency || "TRY"` — `"TRY"` is not a valid Paraşüt enum value at all (roadmap Appendix D.1); this line was the root cause of every invoice failing.
  **Now:** owner confirmed the policy (always invoice in TRY terms, regardless of source currency — this also eliminates the separate USD-mixed-payload bug, Appendix A.4, in one move):
  - `currency: "TRL"` hardcoded unconditionally.
  - `unit_price` built from `tx.amount_try` (already-converted net TRY, correct on every path per Appendix A.4), not `tx.amount_original`.
  - `exchange_rate` dropped from the payload entirely.
  - **Still open:** run 6.6 (USD-sourced proposal test) in Phase 6 to confirm this in practice.
- [x] **1.2** ✅ 2026-07-23 Same file: removed `total_vat`/`total_amount` from the outgoing detail payload (not part of the confirmed `SalesInvoiceDetailAttributes` schema, Appendix D.2). Defensive check added in `prepare-invoice.ts`: after creating the draft, compares `result.data.attributes.net_total` (Paraşüt's server-computed total) against `tx.amount_try`; logs a `console.warn` (not a hard failure) if they differ by more than 0.01. **Note:** `net_total` as the response field name is inferred from the confirmed sortable-params list (Appendix C.12), not from a directly-confirmed response schema — verify it's the right field during Phase 6 testing; if it's wrong the check just silently never fires (safe failure mode, doesn't block invoicing).
- [ ] **1.3** Same file, `customerToContactPayload` (~lines 16-28). Two confirmed bugs:
  - **Missing `account_type` entirely** — this is a *required* field per the confirmed `ContactAttributes` schema (Appendix D.4). Add `account_type: "customer"` unconditionally (this project only ever creates customer contacts, never suppliers).
  - **`contact_type` hardcoded to `"company"` always**, never varies. Fix: map from Ornet's own `identity_type` column (`customers.identity_type`, migration 00215) — `identity_type === 'tckn'` → `contact_type: "person"`; `identity_type === 'vkn'` (or anything else / null) → `contact_type: "company"`. (Paraşüt has no `identity_type` field of its own — `contact_type` is the closest equivalent; `tax_number` stays a plain string either way.)
  - [x] ✅ 2026-07-23 Both fixed in `mappers.ts`. **Bonus fix found while implementing:** `handlers/create-contact.ts`'s own Supabase `.select()` didn't include `identity_type` at all — the new `contact_type` logic would have silently always fallen through to `"company"` there regardless of the mapper fix. Added `identity_type` to that select list.
- [x] **1.4** ✅ 2026-07-23 Restructured `supabase/functions/parasut-dispatch/handlers/bulk-match.ts`. Was: `fetchContacts` used `page[size]=100` (invalid — Paraşüt max is 25), full bulk-pull-then-client-side-match, no `filter[tax_number]`/`filter[account_type]` anywhere. Now:
  - `exact_vkn`/`exact_tckn` path: direct per-customer query `GET /contacts?filter[tax_number]={tax_number}&filter[account_type]=customer`; exactly-one-result is treated as the match, zero or multiple results fall through to the name-based pass instead of guessing.
  - `name_only` fallback (customers with no tax number, or an ambiguous exact-match result): bulk pull with `page[size]=25`, `filter[account_type]=customer`, and a real `page[number]` pagination loop against `meta.total_pages`.
  - **Not yet tested against the real API** (needs Phase 0 credentials) — the rate-limiter in `parasut-client.ts` will now throttle this handler to ~8 req/10s if there are many exact-match lookups (one request per customer with a tax number), which is correct/safe but means a large customer base will make `bulk-match` slower than before; no code change needed for that, just noting it for Phase 6 timing expectations.
- [x] **1.5** ✅ 2026-07-23 Fixed `supabase/functions/parasut-dispatch/core/parasut-client.ts`. Confirmed root cause of the `ping.ts` bug: `expandPath()` unconditionally prepended `/${companyId()}` to every path — so even though `ping.ts` already passed the string `"/me"` (already correct on its own), the shared client turned it into `/{company_id}/me`, which 404s. Fixed: `RequestOptions` gained a `companyScoped` option (default `true`, preserving every other call site's existing behavior); `ping.ts` now passes `companyScoped: false` and also requests `?include=companies`.

---

## Phase 2 — Idempotency + OAuth lock hardening (🤖, §10.2/§10.6)

- [x] **2.1** ✅ 2026-07-23 Fixed `supabase/functions/parasut-dispatch/core/idempotency.ts`. Was: on a unique-key conflict, `acquireIdempotency` returned the existing row's cached response regardless of status — a `failed` row's null `response_snapshot` was returned forever as a fake success. Now:
  - `IdempotencyResult` is a 3-way discriminated union: `{acquired:true}` / `{acquired:false, outcome:"replay", response}` (only for `succeeded` rows) / `{acquired:false, outcome:"in_progress"}` (no response payload at all — callers can no longer accidentally treat this as data).
  - Re-acquisition for `failed` rows and stale (>5 min) `started` rows happens via a single conditional `UPDATE ... WHERE key=$1 AND (status='failed' OR (status='started' AND created_at < stale_threshold))` — eligibility check and write are one atomic query, so two concurrent callers can't both believe they re-acquired the same key.
  - New `ParasutInProgressError` (409) added to `errors.ts`; `prepare-invoice.ts` updated to throw it on `outcome:"in_progress"` instead of returning `idem.response` blindly (the exact bug pattern this closes).
  - Added `finalizeKey()`/`paymentKey()` helpers alongside the existing `invoiceKey()`, ready for Phase 3.2's `finalize-invoice.ts` idempotency wrapping.
- [x] **2.2** ✅ 2026-07-23 Implemented sooner than the plan's original sequencing suggested (was scheduled after Phase 1–3, done now since it was small and already understood). `supabase/functions/parasut-dispatch/core/oauth-store.ts`: added a single-flight lock using the existing (previously-unused) `refresh_lock_until`/`refresh_locked_by` columns — a conditional `UPDATE ... WHERE refresh_lock_until IS NULL OR refresh_lock_until < now()` acquires a 30-second lock before refreshing; a caller that doesn't acquire it polls the token row (6× 500ms) for the lock-holder to finish, then falls through to refresh anyway if the holder didn't finish in time (self-healing, doesn't deadlock on a crashed holder). `persistToken()` already cleared both columns on success (pre-existing code) — that half of the design was already correct, only the acquisition side was missing.
- [ ] **2.3** Note only, no action required: `parasut-client.ts`'s retry logic (3 attempts, backoff on 429/5xx) retries `POST` requests blindly with no idempotency-awareness at that layer (confirmed, matches roadmap Appendix A.5). This is fine *once* 2.1 (done) and the Phase 3 idempotency-wrapping of `finalize-invoice.ts`/`sync-payment.ts` are done — the idempotency layer above it is what actually prevents duplicates; the client-level retry doesn't need its own fix.

---

## Phase 3 — Server-side eligibility, reconcile, and date-constraint fixes (🤖, §10.1/§10.3/§10.5/§10.7)

- [x] **3.1** ✅ 2026-07-23 `supabase/functions/parasut-dispatch/handlers/prepare-invoice.ts` (`validateForDraft`). **Discovery that changed this task's shape**: migration `00217` already ships a trigger (`trg_set_subscription_parasut_ready` / `fn_set_subscription_parasut_ready`) that computes `financial_transactions.parasut_sync_status = 'ready' | 'not_required'` from `should_invoice` + (for subscription rows) `subscriptions.official_invoice` — this DB logic already exists and wasn't previously credited in the roadmap's Appendix A.3. Its `not_required` branch requires `proposal_id IS NOT NULL OR work_order_id IS NOT NULL` (for non-subscription rows) — since the ~550 legacy imported rows have none of those FKs set, migration 00217's own backfill (bottom of that file) should have already classified them `not_required` too, via the same trigger logic, with no new migration needed.
  - Added `deleted_at IS NULL` check (`if (tx.deleted_at) throw ...`).
  - Added a single `parasut_sync_status !== 'ready'` gate — this one check now covers official_invoice=false, should_invoice=false, **and** (per the reasoning above) the legacy rows, all through the same DB-computed field, instead of re-deriving the logic in the edge function.
  - **⚠️ Not yet verified against real data** — the legacy-row claim is reasoning from migration SQL, not a query against the live table. Before relying on this in production: `SELECT parasut_sync_status, count(*) FROM financial_transactions WHERE proposal_id IS NULL AND work_order_id IS NULL AND subscription_payment_id IS NULL AND direction = 'income' GROUP BY parasut_sync_status;` — confirm the legacy rows show up as `not_required`, not `ready` or `NULL`. If any show `NULL` or `ready`, stop and fix data before testing prepare-invoice against them.
- [x] **3.2** ✅ 2026-07-23 `supabase/functions/parasut-dispatch/handlers/finalize-invoice.ts`. All three fixed:
  - Wrapped in idempotency using the new `finalizeKey()` (distinct from `prepare-invoice.ts`'s `invoiceKey()`) and the same acquire/try/finish pattern.
  - Added `deleted_at IS NULL` check.
  - `isEInvoicePayer` replaced with `checkEInvoiceInbox()`, which also returns `registered_at`/`address_registered_at` from the inbox response; finalize now rejects (before calling Paraşüt) if the draft's fixed issue date (`tx.transaction_date`, set at prepare time) predates that registration date. **Still unconfirmed which of the two date fields actually governs** — code prefers `address_registered_at`, verify on the first real finalize (Phase 6.9) and swap if wrong.
- [x] **3.3** ✅ 2026-07-23 `supabase/functions/parasut-reconcile/index.ts`. Auth + filter + pagination done (the mechanical fixes); the bigger aggregate-vs-invoice-level rewrite is **deliberately deferred**, not done in this pass:
  - Added `assertCronAuthorized(req)` from `_shared/cronAuth.ts` — the exact same helper/pattern `extend-subscription-payments` uses, confirmed by reading that file first rather than inventing a new check.
  - Added `filter[item_type]=invoice` and real `page[size]=25` pagination (`fetchAllInvoicesForDate`, loops on `meta.total_pages`).
  - `filter[print_status]` intentionally **not** added — its comma-separated-value syntax was never confirmed against the swagger spec; adding it with guessed syntax risked silently breaking the query. Left as a TODO for whoever runs Phase 6.14.
  - The full invoice-level matching rewrite (§10.7's larger recommendation) is still open — current reconcile is meaningfully less wrong than before (no longer double-counts refunds/estimates, no longer silently undercounts past 15/day) but still compares aggregates, so manual-invoice false positives (Appendix A.6) remain until that follow-up lands.
- [x] **3.4** ✅ 2026-07-23 `supabase/functions/parasut-dispatch/handlers/fetch-history.ts`. Both fixed:
  - Added `page[size]=25` + real pagination (`fetchAllInvoicesSince`, same `meta.total_pages` loop pattern as 1.4/3.3) — a customer with 15+ invoices in the trailing 12 months no longer silently truncates.
  - Also added `filter[item_type]=invoice` for consistency with the reconcile fix (a history tab showing credit notes/quotes as if they were invoices would be confusing, even though it's not a financial-correctness risk the way reconcile was).
  - `filter[issue_date][gteq]=...` range-operator syntax **left as-is, still unverified against the swagger spec** — marked with a `TODO(Phase 6 test)` comment in the code itself; if it 400s during real-API testing, fall back to a client-side date cutoff after an unfiltered pull.

---

## Phase 4 — Product resolution (🤖 or 🧍-gated, conditional on Phase 0.3's result) ⚠️ depends on 0.3

- [ ] **4.1** **If 0.3 returned 201 (product not required):** no code change needed. `mappers.ts`'s current detail-construction already never sets `relationships.product` (confirmed by the 2026-07-23 audit) — this phase is complete by inspection. Just record the confirmation in this doc and move on.
- [ ] **4.2** **If 0.3 returned 422 (product required):** build `supabase/functions/parasut-dispatch/core/product-resolver.ts`:
  - `getOrCreateGenericProduct(categoryCode: string): Promise<string>` — `GET /products?filter[code]=ORNET_${categoryCode}&filter[account_type]=customer` (drop the account_type filter here, that's contacts-only — just `filter[code]`), and if the result is empty, `POST /products` with `{name: "Ornet ${categoryCode} Hizmeti", code: "ORNET_${categoryCode}", inventory_tracking: false}` (required field is only `name`, per Appendix D.3 — `code`/`inventory_tracking` are recommended, not required, but both matter here: `code` for the next lookup, `inventory_tracking: false` to avoid stock-tracking side effects on a service product).
  - Category codes: align with `service_category_enum` (`kira`, `merkez`, `montaj`, `servis`, `satis`, `mal_gonderme`, `diger` — CLAUDE.md) or a simpler income-type split (`subscription`, `proposal`, `work_order`) — pick whichever the existing `income_type`/`service_category_enum` data on `financial_transactions` makes easiest to derive without a new mapping table.
  - Cache resolved ids in-memory per invocation at minimum; consider a small `parasut_product_cache` table (key: category code, value: Paraşüt product id) if repeated `GET` lookups per invoice become a rate-limit concern (unlikely at this project's volume — 8 req/10s is a lot of headroom for a handful of category lookups).
  - Wire into `mappers.ts`: each `details[]` entry gets `relationships: { product: { data: { id: await getOrCreateGenericProduct(category), type: "products" } } }`.

---

## Phase 5 — Payment `account_id` (🤖, needs Phase 0.4's value) ⚠️ depends on 0.4/0.7

- [ ] **5.1** `supabase/functions/parasut-dispatch/handlers/sync-payment.ts`. Confirmed: current payload sends only `date` and `amount` — `account_id` is entirely absent (not hardcoded, not env-sourced, not looked up — just missing). Add `account_id: Deno.env.get("PARASUT_DEFAULT_ACCOUNT_ID")` (the secret set in Phase 0.7) to the payment payload. If this project ever needs per-payment-method accounts (cash vs. bank transfer routed to different Paraşüt accounts), that's a future enhancement — start with the single default account, since that's what 0.4 decided.

---

## Phase 6 — Test matrix (manual, in the Phase 0.2 trial company)

Run in this order; each depends on the previous ones passing.

- [ ] **6.1** `ping` action returns success with the Phase 1.5 path fix (confirms OAuth + client wiring end to end).
- [ ] **6.2** Create one contact (`create-contact.ts`) for a TCKN-holder Ornet customer → confirm `account_type: "customer"` and `contact_type: "person"` both land correctly in Paraşüt (Phase 1.3).
- [ ] **6.3** Create one contact for a VKN-holder (company) customer → confirm `contact_type: "company"`.
- [ ] **6.4** Run `bulk-match` against a customer with a known-matching VKN in the trial company → confirm the `filter[tax_number]` exact-match path works and writes `parasut_contact_id` correctly (Phase 1.4).
- [ ] **6.5** Prepare (draft) one TRY subscription invoice → confirm `currency: "TRL"` lands, confirm amounts match `amount_try`/`output_vat` (Phase 1.1/1.2).
- [ ] **6.6** Prepare (draft) one USD-sourced proposal invoice → confirm it also lands as a clean TRY/TRL invoice with no mixed-currency artifacts (Phase 1.1).
- [ ] **6.7** Finalize the TRY subscription draft against the 6.5's non-taxpayer test VKN (0.5) → e-Arşiv path, confirm `trackable_job` resolves to `done`, confirm idempotency (double-click, Phase 3.2) doesn't create a second e-document.
- [ ] **6.8** Finalize a draft against the taxpayer test VKN (0.5) → e-Fatura path.
- [ ] **6.9** Attempt to finalize with a deliberately-backdated `transaction_date` (before the buyer's `e_invoice_inboxes` registration date) → confirm Phase 3.2's new date check catches it *before* calling Paraşüt, not after a confusing API error.
- [ ] **6.10** Cancel one draft (`cancel-draft.ts`) → confirm `DELETE /sales_invoices/{id}` (not `/cancel`) and status resets to `ready`.
- [ ] **6.11** Sync one payment (`sync-payment.ts`) against a finalized invoice → confirm `account_id` (Phase 5.1) is accepted, confirm partial-payment remaining-balance tracking.
- [ ] **6.12** Delete that payment (`delete-payment.ts`) → confirm it removes the underlying transaction.
- [ ] **6.13** Run `fetch-history` for a customer with 15+ trial invoices (create filler drafts if needed) → confirm pagination (Phase 3.4) doesn't truncate.
- [ ] **6.14** Run `parasut-reconcile` manually (with the new `x-cron-secret` header, Phase 3.3) against a day with a mix of the test invoices above plus one manually-created credit note in the Paraşüt UI → confirm the credit note doesn't get counted as an invoice (`filter[item_type]=invoice`) and confirm the reconcile call is rejected without the header.
- [ ] **6.15** Repeat a `POST /prepare-invoice` double-click test → confirm idempotency (Phase 2.1) returns the same draft both times, not a null/fake-success response.
- [ ] **6.16** Delete/archive all trial-company test data afterward (Paraşüt's bulk-delete feature, per roadmap C.3) before this trial account is reused or discarded.

---

## Phase 7 — Go-live (after Phase 6 is fully green)

- [ ] **7.1** Point the 7+1 `PARASUT_*` secrets at the real production `company_id`/credentials (obtained separately from the trial ones in 0.1 — email `destek@parasut.com` again if the trial credentials aren't swappable to production).
- [ ] **7.2** Flip `VITE_PARASUT_ENABLED=true` in the production deploy environment. **Note:** the code audit confirmed this flag is already correctly wired at every relevant call site (`ParasutMatchingPage`, `ParasutInvoicePanel`, `ParasutHealthCard`, `parasutHistoryHooks.js`, `finance/api.js`) — this phase is a config flip, not a code change, contrary to what you might assume from the roadmap's §5 rollback plan reading like unfinished work.
- [ ] **7.3** First real invoice: pick one low-value, low-risk subscription customer, walk through Prepare → (human review of the preview modal) → Finalize manually, watch Sentry for the first hour.
- [ ] **7.4** Only after several days of clean manual use: consider scheduling `parasut-reconcile` as a cron job (§10.7's remaining aggregate-vs-invoice-level rewrite should land before this, per Phase 3.3).

---

## Open items this plan deliberately does not resolve

- Whether to eventually offer a "Cancel in Paraşüt" button using the confirmed `DELETE /sales_invoices/{id}/cancel` action (roadmap Appendix C.13) — §0's manual-only decision stays as-is unless the owner revisits it.
- OAuth refresh lock (Phase 2.2) is explicitly sequenced *after* Phases 1–3 — don't let it block higher-value fixes.
- The aggregate-vs-invoice-level reconcile rewrite (Phase 3.3's "bigger task") can ship as a smaller auth+filter+pagination fix first and get the full rewrite in a later pass — don't let perfect be the enemy of "no longer silently wrong."

---

## Phase 1.6 — Itemized invoice lines (🤖, done 2026-07-23, owner-confirmed requirement)

**Business context (owner, 2026-07-23):** invoicing is never bulk — each invoice is triggered one at a time from a redesigned Tahsilat/Collection screen ("Fatura Kes" button per transaction, active only when KDV/VAT is selected). Invoices must show real itemized lines, not one aggregate line — "tüm kalemleri tek tek yazdıracağız faturada."

- [x] `core/mappers.ts`: `financialTxToSalesInvoicePayload` now takes a third param `lineItems: InvoiceLineItem[]` and emits one Paraşüt detail per item (falls back to a single aggregate line if the array is empty). `vat_rate` still applied uniformly from `tx.vat_rate` to every line — this project sets VAT at the document level, not per-line (confirmed: no `vat_rate` column exists on `proposal_items`/`work_order_materials`).
- [x] `handlers/prepare-invoice.ts`: new `loadLineItems(supabase, tx)`, three source paths:
  - **`proposal_id` set** → `proposal_items` rows (`description`, `quantity`, `unit_price` or `unit_price_usd × tx.exchange_rate` if the TRY column is null), ordered by `sort_order`. All rows included regardless of `revenue_type` — confirmed via migration `00239`'s CHECK constraint (`material`/`labor_service`/`other`) that `revenue_type` is a COGS/ledger classification, not a customer-visibility flag.
  - **`work_order_id` set** → `work_order_materials` rows, same pattern, `description` falls back to the joined `materials.name` if null.
  - **`subscription_payment_id` set** → **safety-net itemization**: `subscriptions.base_price`/`sms_fee`/`line_fee` are *current* config, not a frozen historical breakdown (`subscription_payments` only stores one aggregate `amount`). Only split into up to 3 lines (base/SMS/hat) **if** `base_price + sms_fee + line_fee` still equals the frozen `subscription_payments.amount` for that specific payment (±0.01) — if a price revision happened since, silently falls back to one aggregate line using the frozen amount rather than show a wrong breakdown. **Owner explicitly chose this "itemize with current prices" option knowing the risk**; the equality check is this plan's own mitigation, not an owner requirement — flag if that trade-off should be reconsidered.
  - No source FK set (shouldn't happen for a `ready` row, but defensive) → one aggregate line from `tx.amount_try`.
- [ ] **Not yet verified against real data**: whether `unit_price`/`unit_price_usd` are reliably populated on every historical `proposal_items`/`work_order_materials` row (older rows predating migration `00051` might have neither) — Phase 6 testing should include at least one older proposal/work-order to confirm `lineUnitPriceTry()`'s fallback chain doesn't silently produce a zero-price line.

## Phase 1.7 — `bulk-match` batching (🤖, done 2026-07-23, owner-confirmed: 300-500 customers)

Independent-audit finding (CONFIRMED, high severity): with 300-500 customers and an 8 req/10s Paraşüt rate limit, one unbatched `bulk-match` call could take 130-160+ seconds, risking a timeout against Supabase Edge Functions' sync response limit. Owner chose the **manual "next batch" button** UX (not an auto-looping progress bar).

- [x] `handlers/bulk-match.ts` split into two actions:
  - `bulkMatch({offset})` — exact VKN/TCKN match only, batched (`EXACT_MATCH_BATCH_SIZE = 60` customers/call, ordered by `id`, `.range(offset, offset+59)`), returns `{inserted, candidates, processed, totalUnmatched, nextOffset, done}`. Call repeatedly with `nextOffset` until `done: true`.
  - `bulkMatchNameFallback()` — separate action, no batching (different cost profile: one full Paraşüt contact pull vs. many small per-customer lookups) — run once, after exact-match batches finish, against whatever customers are still unmatched.
  - Incidental fix (independent-audit finding, SUSPECTED→now fixed): `upsertCandidates` no longer uses `ignoreDuplicates: true`, which silently froze a `rejected` candidate's stale snapshot on re-run. Now updates `source_snapshot`/`parasut_contact_name`/`parasut_tax_number`/`score` on conflict, but never touches `status`/`decided_at`/`decided_by` — a human's prior accept/reject decision is preserved.
- [x] `index.ts` router: added `bulk-match-name-fallback` action.
- [x] Frontend (`parasutMatchingApi.js`/`parasutMatchingHooks.js`/`ParasutMatchingPage.jsx`): `runParasutBulkMatch(offset)` + `runParasutBulkMatchNameFallback()`; page tracks batch progress in local state, main button becomes "Sonraki Batch (150/420)" mid-run, second button triggers the name-fallback pass. New `tr/customers.json` keys added; **no `en` locale entry** — matches this feature's pre-existing pattern (the original `parasutMatching` section was never localized to English either, not a new gap introduced here).

## Independent-audit findings — status (2026-07-23)

A separate independent audit (run by another LLM against Phases 1-3, 2026-07-23) found 9 CONFIRMED + 4 SUSPECTED issues. All 4 SUSPECTED were verified accurate. **All 9 CONFIRMED are now fixed**, same day:

1. ✅ Fixed — `finalize-invoice.ts` rewritten: `POST /e_invoices|/e_archives`'s response `data.id` is now correctly treated as the trackable_job id (not an e-document id, and not read from a nonexistent `attributes.trackable_job_id` field). New `completeFinalization()` always polls the job to `done` and reads the real e-document id via `GET /sales_invoices/{id}?include=active_e_document` before ever marking `confirmed`.
2. ✅ Fixed — `idempotency.ts`'s stale-`started` re-acquisition now checks `updated_at` (bumped by the table's trigger on every write) instead of `created_at` (never changes) — closes the race where two concurrent callers could both re-acquire the same stale key.
3. ✅ Fixed — `parasut-client.ts` only auto-retries 5xx for `GET` (side-effect-free); `POST`/`PATCH`/`DELETE` on 5xx now throw immediately instead of blindly retrying a possibly-already-applied mutation. 429 stays retryable for all methods (rejected before any work happens).
4. ✅ Fixed — both `prepare-invoice.ts` and `sync-payment.ts` (and `finalize-invoice.ts`, structurally) now mark the idempotency key `succeeded` **immediately after the Paraşüt call succeeds**, before attempting the local DB update. If that local update fails, the thrown error says so explicitly ("retry is safe"); the replay path on the next call re-applies the local update using the cached response instead of re-calling Paraşüt.
5. ✅ Fixed — `sync-payment.ts` rewritten with full idempotency wrapping using the previously-unused `paymentKey()`.
6. ✅ Fixed — `oauth-store.ts`'s lock-poll window extended to roughly match the lock's own duration (`REFRESH_LOCK_MS + 5s`, was ~3s against a 30s lock), and a non-holder now actively retries acquiring the lock during that window (takes over from a crashed holder) instead of just waiting out a fixed short timer and proceeding unlocked.
7. ✅ Fixed — bulk-match timeout (Phase 1.7, batched).
8. ✅ Fixed — `create-contact.ts` now requires `identity_type` to be `vkn`/`tckn` before creating a Paraşüt contact (throws otherwise); `bulk-match.ts`'s exact-match loop skips customers with a tax number but unknown `identity_type` instead of defaulting to `exact_vkn`.
9. ✅ Addressed — Legend section above now states explicitly that `[x]`/✅ means "code written," not "verified" — Phase 6 is the only real verification gate.

The 2 lower-priority SUSPECTED items remain deliberate, documented trade-offs (not bugs to fix blindly): #10 (DATE-vs-timestamp comparison in the invoice-date check, Phase 3.2 — the underlying business rule, day-based vs moment-based, is genuinely unconfirmed until a real test) and #12 (`net_total` defensive check has an unverified field name and doesn't hard-block on mismatch, by design — a human reviews every draft before finalize).

**None of this has been tested against the real Paraşüt API yet** — all fixes above are code-reasoning-verified (re-read after editing), not integration-tested. Phase 6 remains the actual verification gate.
