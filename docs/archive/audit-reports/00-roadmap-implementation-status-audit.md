# Roadmap Implementation Status Audit (A1–D9)

> **Date:** 2026-06-09 (updated 2026-06-09 — Batch 4 doc sync)
> **Method:** Static repo audit — actual code + migrations checked, not docs claims.
> **Scope:** [00-final-fix-roadmap.md](./00-final-fix-roadmap.md) items A1–D9.
> **Note:** No remote Supabase state was inspected; everything marked DONE is **local-repo DONE**. Remote apply + staging role-matrix tests remain open for all SQL items.
>
> **Batch 4 (2026-06-09):** **A6 CANCELLED** (Paraşüt not used). **B9 CANCELLED** (Paraşüt not deployed). **R1** fixed locally (`cronAuth.ts`); **R2** fixed locally (`00234`); **B3** remainder fixed locally (`useCustomerSubscriptions(canWrite ? id : null)`) — all still need **deploy / db push / live verification** (Batch 5).

---

## 1. Summary Verdict

**Substantial progress — R1/R2/B3 remediated locally (2026-06-09); NOT production-safe until Batch 5 deploy/db-push/live verification.**

- Phase A/B security items are largely implemented in-repo (migrations `00224`–`00234`, edge auth, app gating).
- **R1 (fixed locally):** `assertCronAuthorized()` now validates `x-cron-secret` via `timingSafeEqual` in `cronAuth.ts` — **deploy + curl smoke still pending**.
- **R2 (fixed locally):** `00234_tahsilat_views_security_invoker_reassert.sql` re-asserts `security_invoker` after `00233` — **db push + `pg_class.reloptions` check still pending**.
- **B3 (fixed locally):** `useCustomerSubscriptions(canWrite ? id : null)` on customer detail — **staging verify still pending**.
- **A6 CANCELLED** — Paraşüt not used. **B9 CANCELLED** — Paraşüt functions not deployed.
- B2, B6, B11, all of Phase C, and all of Phase D remain NOT DONE.

---

## 2. DONE Items (local repo — remote apply/staging verify still pending)

| ID | Item | Evidence |
|----|------|----------|
| **A2** | Finance/subscription read RPC role guards | `00225_finance_rpc_role_guards.sql` — `get_monthly_revenue_expense`, `get_subscription_stats`, `get_overdue_subscription_payments`, `get_overdue_invoices`; NULL-safe guard + `SET search_path = public` |
| **A3** | Recurring generation revoked from `authenticated` | `00225` (REVOKE/GRANT on `fn_generate_recurring_expenses`); follow-up wrapper `00231_recurring_generation_guarded_rpc.sql` (`fn_generate_recurring_expenses_guarded`); app uses it: `src/features/finance/recurringApi.js` `triggerRecurringGeneration()` |
| **A4** | Dashboard finance gating by role | `src/pages/DashboardPage.jsx` (`useRole` → `enabled: canWrite`); `src/features/dashboard/hooks.js` (`useMonthlyRevenue`/`useOverduePayments` accept `enabled`); `RevenueExpenseLineChart.jsx`, `OverduePaymentsList.jsx` (`enabled: canWrite`); `src/features/subscriptions/hooks.js` (`useSubscriptionStats({ enabled })`) |
| **A7** | WO/proposal completion RPC guards | `00230_completion_rpc_role_guards.sql` — `fn_complete_work_order_with_payment` (admin/accountant OR `auth.uid() = ANY(assigned_to)` for field_worker); `complete_proposal_with_rate` (admin/accountant only) |
| **A8** | `fetch-tcmb-rates` cron secret + role auth | `00228_fetch_tcmb_rates_cron_secret.sql` (reschedules `fetch-tcmb-rates-daily` with `x-cron-secret` from Vault); `supabase/functions/_shared/cronAuth.ts` `assertCronOrFinanceRole()` (**correctly implemented**, timing-safe compare + admin/accountant JWT fallback); `fetch-tcmb-rates/index.ts` uses it; `CurrencyWidget.jsx` hides refresh unless `canWrite`; doc `a8-fetch-tcmb-rates-cron-setup.md` |
| **A9** | TRY proposal completion via RPC | `src/features/proposals/ProposalDetailPage.jsx` `handleStatusChange` — non-USD `completed` routed through `completeWithRateMutation` (rate 1); `src/features/proposals/api.js` `completeProposalWithRate` → `complete_proposal_with_rate` (guarded in `00230`) |
| **B1** | Subscription bulk/payment RPC role guards | `00229_subscription_rpc_role_guards.sql` — `generate_subscription_payments`, `ensure_payments_for_year`, `bulk_import_subscriptions`, `fn_update_subscription_price` |
| **B4** | `search_work_history` LIMIT + client `enabled` guard | `00232_search_work_history_limit_offset.sql` (`p_limit` clamped ≤1000, `p_offset`; drops old 7-arg overload from `00221`); `src/features/workHistory/api.js` passes `p_limit`/`p_offset`; `WorkHistoryPage.jsx` `shouldRunSearch` (≥2 chars or filter) → `useSearchWorkHistory(filters, shouldRunSearch)` |
| **B7** | Split collection React Query keys | `src/features/finance/api.js` `collectionKeys.all = ['tahsilatCollection']` vs `src/features/finance/collectionApi.js` `collectionKeys.all = ['subscriptionCollectionDesk']` |
| **B8** | WO debug `console.log` removed | `src/features/workOrders/api.js` — no `console.log` remaining in `updateWorkOrder` |
| **B10** | `soft_delete_transaction` stale roles | `00225` — admin/accountant only, NULL-safe, `ERRCODE 42501` |
| **00227** | `extend_active_subscription_payments` crash fix | `00227_fix_extend_active_subscription_payments.sql` — dead `v_sub.subscription_type` removed (uses `billing_frequency`); REVOKE from PUBLIC/`authenticated`, GRANT `service_role` only |

---

## 3. PARTIAL / NEEDS LIVE VERIFY Items

| ID | Status | Detail / Evidence |
|----|--------|-------------------|
| **A1** | PARTIAL | `00224` + `00234` in repo; apply `00224`–`00234` and verify `security_invoker=true` live |
| **B3** | **DONE** (local) | `CustomerDetailPage.jsx` — `useCustomerSubscriptions(canWrite ? id : null)` + prior gates; deploy verify pending |
| **B5** | **DONE** (local) | `00233` rewrite + pagination; `00234` re-asserts `security_invoker`; totals parity unverified on staging |
| **NEEDS LIVE VERIFY** (all SQL/edge items) | — | Remote apply of `00224`–`00234`; deploy `extend-subscription-payments` (R1 fix); pg_cron jobs; Vault/Edge secrets; duplicate Dashboard cron removal |
| **Old duplicate subscription cron** | NEEDS LIVE VERIFY | `00226` + `a5-extend-subscription-payments-cron-setup.md` §4 instruct disabling any Supabase Dashboard schedule for `extend-subscription-payments` — cannot be confirmed from the repo. Until removed, the function may run twice on the 1st (idempotent via `ON CONFLICT DO NOTHING` in `00227`, but should still be deduplicated). |
| **`complete_proposal_with_rate` GRANT state** | NEEDS LIVE VERIFY | `00230` adds the in-function guard but no explicit `GRANT EXECUTE`; deployed-DB grant state was already a deferred verification item in the roadmap. |

---

## 4. NOT DONE / CANCELLED Items

| ID | Item | Status |
|----|------|--------|
| **A6** | `parasut-reconcile` lockdown | **CANCELLED** — Paraşüt not used |
| **B9** | Paraşüt `ping` guard + response minimization | **CANCELLED** — Paraşüt not deployed |
| **B2** | `operations_items` / `plan_items` SELECT RLS | NOT DONE — no migration after `00174`/`00160` |
| **B6** | Indexes | NOT DONE — no index migration after `00220` |
| **B11** | Lazy-load finance + proposals routes | `src/App.jsx` — only `InvoiceAnalysisPage` is `lazy()` (L66). |
| **C1** | RLS initplan + `work_order_materials` policy rewrite | No migration. |
| **C2** | P&L default period window | `finance/hooks.js` `useProfitAndLoss` L240–245 — no period guard/default. |
| **C3** | `subscriptions_detail` overdue denorm | No migration. |
| **C4** | Dynamic XLSX import | Static `import * as XLSX` in 10+ files (`CustomersListPage.jsx`, `SimCardsListPage.jsx`, `ProposalDetailPage.jsx`, …). |
| **C5** | Lazy operations tabs | No `lazy()`/dynamic `import()` in operations board page. |
| **C6** | Narrow finance invalidation | `finance/hooks.js` L391/L425 still invalidate `collectionKeys.all`; broad `profitAndLossKeys` invalidation unchanged. |
| **C7** | Customer detail tab-lazy queries | `CustomerDetailPage.jsx` L166–180 — queries still fire in parallel on mount (only role-gated per B3, not tab-scoped). |
| **C8** | Drop duplicate indexes | No migration. |
| **C9** | PWA precache tuning | `vite.config.js` unchanged. |
| **C10** | `work_orders_detail` list view split | No migration. |
| **D1–D9** | Product/debt items | No changes: D5 — CORS `*` still on all edge functions; D7 — `chunkSizeWarningLimit: 2000` unchanged; D8 — no `queryClient.clear()` on logout; D9 — `src/main.jsx` Sentry init still synchronous; D1–D4, D6 — no code/migrations. |

---

## 5. RISKY Items (historical — remediated locally 2026-06-09)

### R1 — FIXED locally; deploy verify pending

- **File:** `supabase/functions/_shared/cronAuth.ts` — `assertCronAuthorized()` now compares `x-cron-secret` with `timingSafeEqual`.
- **Still required:** Edge deploy + curl 401/200 smoke (Batch 5).

### R2 — FIXED locally via `00234`; db push verify pending

- **File:** `00234_tahsilat_views_security_invoker_reassert.sql`
- **Still required:** Apply migrations; `SELECT relname, reloptions FROM pg_class WHERE relname LIKE 'v_collection%';`

### R3 — Duplicate monthly cron (MEDIUM — unchanged)

- `00226` schedules `extend-subscription-payments-monthly` (`0 2 1 * *`); a legacy Supabase Dashboard schedule may still exist and is only removable via the Dashboard. Combined with R1, an attacker-or-double-cron path writes billing rows. Idempotency (`ON CONFLICT DO NOTHING`) mitigates duplication but not unauthorized invocation.

---

## 6. Next Recommended Implementation Order

1. **Batch 5** — deploy edge functions (R1), apply `00224`–`00234`, secrets/cron setup, role-matrix staging verify.
2. **B6** — index migration (EXPLAIN first).
3. **B2** — after product confirmation.
4. **B11 → Phase C/D** — post-gate performance.

---

*Static audit only. No code, migrations, deploy state, or remote database were modified. All DONE statuses are local-repo evidence; nothing in this report certifies remote/staging state.*
