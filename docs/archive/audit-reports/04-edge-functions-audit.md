# Phase 4 — Edge Function Security Audit Report

> **Date:** 2026-05-31  
> **Scope:** All Supabase Edge Functions under `supabase/functions/` — auth, service role, secrets, CORS, Paraşüt/finance paths  
> **Method:** Static review of function source, `supabase/config.toml`, app `functions.invoke` call sites, related migrations (`00216`, `00110`, `00042`, `00053`)  
> **Prior reports:** [01-rls-audit.md](./01-rls-audit.md), [02-security-definer-rpc-audit.md](./02-security-definer-rpc-audit.md), [03-finance-access-audit.md](./03-finance-access-audit.md)  
> **Status:** Audit only — no code, deploy, migration, or secret rotation

---

## Executive Summary

Four Edge Functions exist: **`parasut-dispatch`**, **`parasut-reconcile`**, **`fetch-tcmb-rates`**, **`extend-subscription-payments`**. All four create a **service-role Supabase client** (`SUPABASE_SERVICE_ROLE_KEY`), bypassing table RLS. In-function authorization is **uneven**: `parasut-dispatch` enforces `requireRole()` on finance/customer mutating handlers, but **`ping` has no role gate**, and **`parasut-reconcile`**, **`fetch-tcmb-rates`**, and **`extend-subscription-payments`** perform **no JWT or role checks** in code.

Repo config (`supabase/config.toml`) explicitly sets **`verify_jwt = false`** for `fetch-tcmb-rates` and `parasut-reconcile`, making them callable with **only the anon key** from any origin (CORS `*`). `parasut-dispatch` has **`verify_jwt = true`**. `extend-subscription-payments` has **no `[functions.*]` entry** — deployed behavior defaults to gateway JWT verification unless overridden in the Dashboard; the function body **never validates role** even when JWT is present.

**Overall verdict:** **FAIL for production** until public/cron functions use shared secrets or service-only invoke paths, `extend-subscription-payments` is locked to cron + role/service auth, and `parasut-reconcile` is not anonymously callable.

---

## Function Inventory

| Function | Files | `verify_jwt` (repo config) | In-function auth | Service role | Primary callers (observed) |
|----------|-------|----------------------------|------------------|--------------|----------------------------|
| `parasut-dispatch` | `supabase/functions/parasut-dispatch/**` | `true` | JWT → `getActorId`; `requireRole` on most handlers | Yes | App: `parasutApi.js`, `parasutMatchingApi.js`, `parasutHistoryApi.js`, `finance/api.js` (`sync-payment`) |
| `parasut-reconcile` | `supabase/functions/parasut-reconcile/index.ts` | **`false`** | **None** | Yes | Not referenced in `src/`; intended cron/ops |
| `fetch-tcmb-rates` | `supabase/functions/fetch-tcmb-rates/index.ts` | **`false`** | **None** | Yes | App: `fetchTcmbRates()` (`finance/api.js`); pg_cron HTTP (`00053`) |
| `extend-subscription-payments` | `supabase/functions/extend-subscription-payments/index.ts` | *Not set* (default `true` unless Dashboard overrides) | **None** (`_req` ignored) | Yes | Scheduled (comment: Dashboard cron `0 2 1 * *`); not in `src/` |

---

## Authentication & Authorization Model

### Gateway JWT (`supabase/config.toml`)

```7:14:supabase/config.toml
[functions.fetch-tcmb-rates]
verify_jwt = false

[functions.parasut-dispatch]
verify_jwt = true

[functions.parasut-reconcile]
verify_jwt = false
```

| Question | Answer |
|----------|--------|
| Callable anonymously (anon key only)? | **`fetch-tcmb-rates`**, **`parasut-reconcile`** (per repo config). **`extend-subscription-payments`** if Dashboard sets `verify_jwt = false`. |
| Requires valid user JWT at gateway? | **`parasut-dispatch`** only (repo). **`extend-subscription-payments`** if default/`verify_jwt = true`. |
| In-function role checks? | Only **`parasut-dispatch`** via `requireRole()` (`core/auth.ts`). |

### `parasut-dispatch` actor resolution

```38:46:supabase/functions/parasut-dispatch/index.ts
async function getActorId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error) return null;
  return data.user?.id ?? null;
}
```

Service-role client is used for `getUser(jwt)` and all DB/API work (`index.ts` L53–57). Gateway `verify_jwt = true` ensures a valid session JWT is present before the handler runs; `requireRole` then loads `profiles.role` (L11–20 in `core/auth.ts`).

### Handler-level `requireRole` matrix

| Action | Handler | Roles allowed | `requireRole`? |
|--------|---------|---------------|----------------|
| `ping` | `handlers/ping.ts` | *Any authenticated user* | **No** |
| `bulk-match` | `handlers/bulk-match.ts` | `admin` | Yes |
| `create-contact` | `handlers/create-contact.ts` | `admin`, `accountant` | Yes |
| `prepare-invoice` | `handlers/prepare-invoice.ts` | `admin`, `accountant` | Yes |
| `finalize-invoice` | `handlers/finalize-invoice.ts` | `admin`, `accountant` | Yes |
| `cancel-draft` | `handlers/cancel-draft.ts` | `admin`, `accountant` | Yes |
| `sync-payment` | `handlers/sync-payment.ts` | `admin`, `accountant` | Yes |
| `delete-payment` | `handlers/delete-payment.ts` | `admin`, `accountant` | Yes |
| `fetch-history` | `handlers/fetch-history.ts` | `admin`, `accountant` | Yes |

**Can `field_worker` trigger finance/customer/Paraşüt mutations via `parasut-dispatch`?**  
**No** for mutating actions above — `requireRole` returns 403. **Yes** for **`ping`** only: any user with a valid JWT can invoke Paraşüt `/me` using company OAuth credentials (token refresh path in `oauth-store.ts`).

---

## Service Role Usage

All functions use:

```typescript
createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
```

| Function | Service role used for | Protected by role check? |
|----------|----------------------|-------------------------|
| `parasut-dispatch` | All ERP + Paraşüt tables, OAuth token row, audit/idempotency writes | Partially — per-handler `requireRole` except `ping` |
| `parasut-reconcile` | Read `financial_transactions` (confirmed, by date); insert `parasut_audit_log`; Paraşüt API | **No** |
| `fetch-tcmb-rates` | Upsert `exchange_rates` | **No** |
| `extend-subscription-payments` | RPC `extend_active_subscription_payments()` | **No** |

RPC `extend_active_subscription_payments` is correctly **revoked from `authenticated`** (`00110` / `00182` — `GRANT EXECUTE TO service_role` only). The risk is the **Edge Function as a public proxy** to that RPC, not direct client RPC.

---

## Secrets & Paraşüt Token Handling

### Environment secrets (Edge only — not in repo)

| Secret | Used in |
|--------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | All four functions |
| `PARASUT_*` (OAuth URL, client id/secret, username/password, company id, base URL) | `parasut-dispatch` core, `parasut-reconcile` (via shared `parasut-client.ts`) |

### OAuth tokens

- Stored in `parasut_oauth_tokens` (service role writes in `oauth-store.ts` L52–61).
- RLS: **no client access** — policy `USING (false)` for `authenticated` (`00216` L79–83).
- **Not returned** in HTTP success payloads from dispatch/reconcile.
- **Not logged** in `console.log` in reviewed paths.
- **Audit sanitization** redacts `access_token`, `refresh_token`, `client_secret`, etc. (`core/logger.ts` L36–48) before `parasut_audit_log` insert.

### Residual exposure

| Risk | Level | Detail |
|------|-------|--------|
| Paraşüt API bodies in audit log | MEDIUM | `parasut-client.ts` L100–101 logs full `requestBody` / `responseBody` (sanitized for token keys only). Contact/invoice payloads can include **tax numbers and customer names**. Readable by **admin** via `parasut_audit_log_select_admin` (`00216`). |
| Idempotency cache | MEDIUM | `finishIdempotency` stores full Paraşüt `result` in `response_snapshot` (`idempotency.ts` L40–54); returned to client on duplicate `prepare-invoice` (`prepare-invoice.ts` L41–42). Admin SELECT only. |
| OAuth failure details in audit | LOW | `dispatch_error` stores `error.details` in audit `response_body` (`index.ts` L108), not in client JSON (client gets `error: message` only, L111). |

---

## Browser vs Cron Invoke Surface

### App-invoked (browser session + anon key)

| Invoke site | Function | Action / effect |
|-------------|----------|-----------------|
| `src/features/finance/parasutApi.js` | `parasut-dispatch` | `prepare-invoice`, `finalize-invoice`, `cancel-draft` |
| `src/features/finance/api.js` L979 | `parasut-dispatch` | `sync-payment` after Tahsilat `recordPayment` |
| `src/features/customers/parasutMatchingApi.js` | `parasut-dispatch` | `bulk-match`, `create-contact` |
| `src/features/customers/parasutHistoryApi.js` | `parasut-dispatch` | `fetch-history` |
| `src/features/finance/api.js` L312 | `fetch-tcmb-rates` | Upsert TCMB USD row |

Finance UI routes use `RoleRoute` (`App.jsx`); Edge auth does not re-check route guards.

### Cron / server-style

| Caller | Function | Auth model |
|--------|----------|--------------|
| pg_cron `fetch-tcmb-rates-daily` (`00053`) | `fetch-tcmb-rates` | HTTP POST with vault URL + likely anon/service key; **`verify_jwt = false`** by design |
| Dashboard cron (documented in `extend-subscription-payments/index.ts`) | `extend-subscription-payments` | **Undocumented** shared secret; function has **no** `Authorization` check |

**Gap:** Cron and browser share the same public function URLs for `fetch-tcmb-rates` and `parasut-reconcile` with no separate “internal only” auth header validation in code.

---

## Per-Function Findings

### F-CRIT-01 — `extend-subscription-payments`: unauthenticated subscription billing writes (conditional on deploy JWT)

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** |
| **Function** | `extend-subscription-payments` |
| **Location** | `supabase/functions/extend-subscription-payments/index.ts` L23–61 |
| **Exposed / allowed** | Any caller that can POST the function URL invokes `extend_active_subscription_payments()` via service role, creating subscription payment rows. Request is ignored (`_req`). Response includes **`rows: created`** (full RPC result). |
| **Why risky** | Bypasses `subscription_payments` RLS and RPC revoke from `authenticated`. Finance-adjacent schedule extension without admin/accountant intent. If Dashboard sets `verify_jwt = false` for cron, **anonymous** abuse is possible. If `verify_jwt = true`, **any logged-in user including `field_worker`** can still invoke. |
| **Proposed fix** | Set `verify_jwt = false` only with mandatory `X-Cron-Secret` / `Authorization: Bearer <deploy secret>` checked in code; reject browser invokes. Alternatively invoke RPC from pg_cron with `service_role` JWT in vault, no public Edge URL. Remove `rows` from public response; log counts only. Document in `config.toml`. |

---

### F-CRIT-02 — `parasut-reconcile`: anonymous finance aggregate + Paraşüt API access

| Field | Value |
|-------|-------|
| **Risk** | **CRITICAL** |
| **Function** | `parasut-reconcile` |
| **Location** | `supabase/config.toml` L13–14; `parasut-reconcile/index.ts` L53–124 |
| **Exposed / allowed** | Unauthenticated POST reads all `financial_transactions` with `parasut_sync_status = 'confirmed'` for **yesterday** (service role), calls Paraşüt `sales_invoices` API, returns `{ erp: { count, sum }, parasut: { count, sum }, match }`. |
| **Why risky** | Leaks **daily confirmed invoice volume** to anyone with project URL + anon key. Consumes Paraşüt OAuth quota; potential reconnaissance before targeted attacks. No rate limit. |
| **Proposed fix** | `verify_jwt = true` **plus** in-function check for cron secret or `admin` role; or move reconcile to pg_cron + service role only with no public CORS. Narrow response body for non-admin callers. |

---

### F-HIGH-01 — `fetch-tcmb-rates`: public service-role write to `exchange_rates`

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Function** | `fetch-tcmb-rates` |
| **Location** | `supabase/config.toml` L7–8; `fetch-tcmb-rates/index.ts` L49–107 |
| **Exposed / allowed** | Anonymous invoke upserts USD `exchange_rates` for TCMB-parsed date (hardcoded row shape — **not** arbitrary body injection). Bypasses `er_manage` RLS (`00042` admin/accountant). |
| **Why risky** | Exchange rates affect USD proposal completion and finance conversion; unauthenticated writers enable DoS, timing attacks, and operational abuse. Intentional `verify_jwt = false` for pg_cron widens blast radius to entire internet if URL/key leak. |
| **Proposed fix** | Require shared cron secret header for all invokes; keep `verify_jwt = false` only on a dedicated internal route or use Supabase **service role** in vault for pg_cron only. Rate-limit at gateway. |

---

### F-HIGH-02 — `parasut-dispatch` `ping`: no role check; Paraşüt OAuth use by any authenticated user

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Function** | `parasut-dispatch` (`action: ping`) |
| **Location** | `handlers/ping.ts` L4–15; `index.ts` L66–68 |
| **Exposed / allowed** | Any user with valid JWT triggers Paraşüt `GET /me` and audit log entry using company tokens. |
| **Why risky** | `field_worker` can probe Paraşüt connectivity and burn rate limits; expands attack surface for OAuth refresh lock contention (`parasut_oauth_tokens`). |
| **Proposed fix** | Add `requireRole(..., ['admin', 'accountant'])` to `ping`, or remove `ping` from production deploy. |

---

### F-HIGH-03 — Success responses return full Paraşüt API payloads (tax/customer/payment data)

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** (data minimization / over-exposure) |
| **Function** | `parasut-dispatch` |
| **Location** | `index.ts` L97 (`data` unfiltered); `prepare-invoice.ts` L75; `fetch-history.ts` L30–36; `sync-payment.ts` L56; `finalize-invoice.ts` L107 |
| **Exposed / allowed** | JSON `data` includes Paraşüt JSON:API bodies (invoices, contacts, payments). Callers are admin/accountant by role, but **any compromised accountant session** receives full payloads; `fetch-history` returns 12 months of invoices per customer. |
| **Why risky** | Tax IDs and payment metadata in browser network tab and client memory; larger than needed for UI state. |
| **Proposed fix** | Map responses to minimal DTOs (ids, status, amounts); never forward raw `attributes.tax_number` unless required on screen. |

---

### F-HIGH-04 — `extend-subscription-payments` logs and returns payment row details

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Function** | `extend-subscription-payments` |
| **Location** | `index.ts` L46–51, L53–60 |
| **Exposed / allowed** | `console.log(JSON.stringify(created))` and HTTP `rows: created` may include subscription ids, amounts, due dates. |
| **Why risky** | Supabase function logs may be visible to project operators; HTTP response leaks billing schedule to unauthorized invokers (see F-CRIT-01). |
| **Proposed fix** | Log `{ count: created.length }` only; return `{ ok, rowsCreated }` without row payloads. |

---

### F-HIGH-05 — Service role reads/writes finance tables without transaction-level authorization

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** |
| **Function** | `parasut-dispatch` (finance handlers) |
| **Location** | e.g. `prepare-invoice.ts` L8–16, L64–71; `sync-payment.ts` L17–53 |
| **Exposed / allowed** | Handlers load/update **any** `financial_transaction_id` / `financial_transaction_payment_id` passed in body if caller is admin/accountant. No check that actor owns module or customer scope. |
| **Why risky** | Compromised accountant credential or stolen JWT can sync/delete payments and invoices across **all** customers (acceptable for small org only by policy). |
| **Proposed fix** | Optional: verify FT visibility via RLS using user-scoped client for read before service-role write; or audit `actor_id` on every mutation with alerting. |

---

### F-HIGH-06 — `fetch-tcmb-rates` verbose logging

| Field | Value |
|-------|-------|
| **Risk** | **HIGH** (operational / low PII) |
| **Function** | `fetch-tcmb-rates` |
| **Location** | `fetch-tcmb-rates/index.ts` L23–30 |
| **Exposed / allowed** | `console.log("USD BLOCK:", usdMatch?.[0])` logs TCMB XML snippet on every run. |
| **Why risky** | Log volume/noise; pattern of leaking external fetch content to centralized logs. |
| **Proposed fix** | Remove debug logs or log only parsed rates + date at `info` level. |

---

### F-MED-01 — CORS `Access-Control-Allow-Origin: *` on all functions

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Function** | All four |
| **Location** | e.g. `parasut-dispatch/index.ts` L14–17; same pattern in reconcile, tcmb, extend |
| **Exposed / allowed** | Any origin may read responses to credentialed browser calls if a user session is tricked into invoking functions. |
| **Why risky** | Classic cross-origin invoke if combined with XSS or stolen tokens. |
| **Proposed fix** | Restrict to production app origin(s) for browser-facing functions; cron functions need no CORS. |

---

### F-MED-02 — `bulk-match` stores full Paraşüt contact snapshot

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Function** | `parasut-dispatch` |
| **Location** | `handlers/bulk-match.ts` L87–95 |
| **Exposed / allowed** | `source_snapshot: contact` written to `parasut_match_candidates` (tax_number in attributes). |
| **Why risky** | Duplicates PII in ERP DB; candidates readable per existing RLS on that table (not re-audited here). |
| **Proposed fix** | Store only `contact.id` + normalized match fields; drop full snapshot. |

---

### F-MED-03 — No application-level rate limiting on Edge handlers

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Function** | All; especially public `fetch-tcmb-rates`, `parasut-reconcile` |
| **Location** | `parasut-client.ts` L17–48 (in-memory limiter per isolate only) |
| **Exposed / allowed** | Unlimited parallel invokes across isolates/users. |
| **Why risky** | DoS on TCMB, Paraşüt, and DB. |
| **Proposed fix** | Gateway rate limits, WAF, or Redis-backed quota per API key / secret. |

---

### F-MED-04 — `extend-subscription-payments` missing `config.toml` documentation

| Field | Value |
|-------|-------|
| **Risk** | **MEDIUM** |
| **Function** | `extend-subscription-payments` |
| **Location** | `supabase/config.toml` (absent entry) |
| **Exposed / allowed** | Deploy JWT setting may drift between environments undocumented. |
| **Why risky** | Accidental `verify_jwt = false` in Dashboard opens F-CRIT-01 anonymously. |
| **Proposed fix** | Add explicit `[functions.extend-subscription-payments]` with `verify_jwt = false` + mandatory secret header documented next to cron job. |

---

### F-LOW-01 — DB/Supabase errors returned verbatim to clients

| Field | Value |
|-------|-------|
| **Risk** | **LOW** |
| **Function** | `fetch-tcmb-rates`, `extend-subscription-payments`, `parasut-reconcile` |
| **Location** | e.g. `fetch-tcmb-rates/index.ts` L94; `parasut-reconcile/index.ts` L70 |
| **Exposed / allowed** | `error.message` from PostgREST in JSON body. |
| **Why risky** | Minor information disclosure. |
| **Proposed fix** | Generic user-facing errors; log details server-side only. |

---

### F-LOW-02 — `fetch-tcmb-rates` cannot inject arbitrary `exchange_rates` rows via body

| Field | Value |
|-------|-------|
| **Risk** | **LOW** (mitigating note) |
| **Function** | `fetch-tcmb-rates` |
| **Location** | `index.ts` L72–88 |
| **Exposed / allowed** | Request body is unused; only TCMB-parsed USD row is upserted. |
| **Why risky** | N/A — reduces severity of F-HIGH-01 vs arbitrary row injection. |
| **Proposed fix** | Still require auth (F-HIGH-01). |

---

## Question Checklist (Phase 4 plan)

| # | Question | Result |
|---|----------|--------|
| 1 | Anonymous vs user JWT? | **Anonymous:** `fetch-tcmb-rates`, `parasut-reconcile`. **User JWT (gateway):** `parasut-dispatch`. **extend:** depends on deploy; code never checks role. |
| 2 | Service role scoped server-only? | **No** — all four use service role in Edge; protection is only gateway + sparse `requireRole`. |
| 3 | `requireRole` on every mutating dispatch handler? | **Yes** except **`ping`**. |
| 4 | `fetch-tcmb-rates` arbitrary `exchange_rates` rows? | **No** arbitrary rows; **yes** unauthenticated upsert of TCMB USD for parsed date. |
| 5 | `extend-subscription-payments` without admin/accountant intent? | **Yes** — any allowed invoker triggers RPC. |
| 6 | OAuth tokens logged/returned? | **Not returned**; **not in console**; audit **sanitizes token fields**; OAuth errors may land in **audit** `response_body` only. |
| 7 | CORS `*` acceptable? | **Not for production** on browser-facing endpoints; cron functions should disable CORS. |
| 8 | Cron separate from browser auth? | **Partially** — TCMB cron relies on `verify_jwt = false` without in-code secret; extend/reconcile not hardened in repo. |
| 9 | Idempotency/audit RLS? | **OAuth:** deny all clients. **Audit/idempotency:** admin SELECT only (`00216`). Edge writes via service role. |

---

## field_worker Summary

| Path | Can mutate finance / Paraşüt / subscriptions? |
|------|--------------------------------------------------|
| `parasut-dispatch` finance actions | **No** (403 from `requireRole`) |
| `parasut-dispatch` `ping` | **Yes** (Paraşüt `/me` only) |
| `fetch-tcmb-rates` | **Yes** (no JWT required — upsert rates) |
| `parasut-reconcile` | **Yes** (no JWT — read aggregates + Paraşüt) |
| `extend-subscription-payments` | **Yes** if invoke allowed (JWT or anon per deploy) |
| Tahsilat `recordPayment` → `sync-payment` | **No** at DB (FT/ftp RLS); Edge would allow if role were accountant |

---

## Positive Controls Observed

- `requireRole` centralization and consistent **admin/accountant** gates on invoice/payment/customer Paraşüt flows.
- `create-contact` requires explicit `confirmed: true` (`create-contact.ts` L17–18).
- OAuth table **denied** to authenticated clients (`00216`).
- Audit logger **redacts** common secret key names (`logger.ts`).
- Client error responses from `parasut-dispatch` expose **message only**, not `details` (`index.ts` L111).
- `extend_active_subscription_payments` **not** granted to `authenticated` at DB layer.

---

## Findings Count

| Severity | Count |
|----------|-------|
| **CRITICAL** | **2** |
| **HIGH** | **6** |
| **MEDIUM** | **4** |
| **LOW** | **2** |

---

## Functions Needing Immediate Review

1. **`extend-subscription-payments`** — auth model + cron secret + response/logging minimization  
2. **`parasut-reconcile`** — remove public anonymous access; restrict response  
3. **`fetch-tcmb-rates`** — replace anonymous open POST with secret/cron-only path  
4. **`parasut-dispatch`** — `ping` role gate; response DTO minimization  

---

## Recommended Next Actions

1. **Hardening PR (after APPROVE):** Add in-function `CRON_SECRET` / `Authorization` checks; align `config.toml` with Dashboard; set `extend-subscription-payments` to non-browser-only.  
2. **Dashboard verification:** Confirm deployed `verify_jwt` for `extend-subscription-payments` and whether `parasut-reconcile` is exposed via scheduled job or public URL.  
3. **Align with Phase 2–3:** Edge fixes do not replace RPC/view fixes (`fn_generate_recurring_expenses`, tahsilat views, dashboard KPI RPCs).  
4. **Phase 5:** Frontend data exposure audit — what Paraşüt/history panels render from full `data` payloads.

---

## Overall Verdict

**FAIL for production**

Edge functions multiply service-role power without equivalent ERP role enforcement on **`parasut-reconcile`**, **`fetch-tcmb-rates`**, and **`extend-subscription-payments`**, and leave a **`ping`** bypass on **`parasut-dispatch`** for any authenticated user. Paraşüt OAuth storage and audit redaction are **sound**, but **public invoke configuration** and **missing cron-only auth in code** are blocking issues for go-live.
