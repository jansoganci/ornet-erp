# CLAUDE.md — Ornet ERP context

<!-- UPDATED: 2026-05-31 — hybrid payment/accrual, receivables, tahsilat, Paraşüt integration, edge functions -->

> AI assistant context: architecture, finance rules, routes. Prefer this file + the repo over assumptions.

---

## Project identity

**Ornet ERP** — Work order management and ERP for a **Turkish security company**: customers and sites, work orders, materials, subscriptions, SIM inventory, proposals/quotes, finance ledger (with accrual receivables + collections/“Tahsilat”), notifications, site equipment (“Equipment” in UI), operations board, technical guide, and an in-progress **Paraşüt** (e-invoice/accounting) integration.

**Roles** (`profiles.role`, `src/lib/roles.js`): `admin`, `accountant`, `field_worker`. **`canWrite`** = admin OR accountant (subscriptions, SIMs, proposals, finance, operations import, etc.).

---

## Tech stack (from `package.json`)

React ^19.2 · Vite ^7.2 · react-router-dom ^7.13 · TanStack Query ^5.90 · Supabase JS ^2.93 · react-hook-form ^7 · @hookform/resolvers ^5 · zod ^4 · Tailwind ^4 (@tailwindcss/vite) · i18next ^25 / react-i18next ^16 · recharts ^3.8 · react-big-calendar ^1.19 · @react-pdf/renderer ^4.3 · pdfjs-dist ^5 · xlsx ^0.18 · date-fns ^4 · framer-motion ^12 · @sentry/react ^10.39 · sonner · lucide-react · clsx · tailwind-merge · vite-plugin-pwa / autoprefixer / postcss (dev).

**Hosting/deploy:** Cloudflare Pages via Wrangler (`npm run deploy` / `deploy:prod`). **Backend:** Supabase (no ORM) + **Supabase Edge Functions** (see “Edge functions & cron”).

---

## Routes & features

<!-- UPDATED: matches src/App.jsx; notes tasks/calendar -->

Single source: **`src/App.jsx`**. **`RoleRoute`** = requires `canWrite`.

| Module | Paths | Guard |
|--------|--------|--------|
| Auth | `/login`, `/register`, `/forgot-password` | `AuthRoute` |
| Auth | `/auth/update-password`, `/auth/verify-email` | public |
| Dashboard | `/` | auth |
| Profile / notifications | `/profile`, `/notifications` | auth |
| Action board | `/action-board` | auth |
| Operations | `/operations`, `/operations/import` | `RoleRoute` |
| Customers | `/customers`, `/import`, `/new`, `/:id`, `/:id/edit` | auth |
| Customers · Paraşüt | `/customers/parasut-matching` | `RoleRoute` (nav: admin only) |
| Work orders | `/work-orders`, `/new`, `/:id`, `/:id/edit` | auth |
| Daily work | `/daily-work` | auth |
| Work history | `/work-history` | auth |
| Materials | `/materials`, `/materials/import` | auth |
| Technical guide | `/technical-guide`, `/technical-guide/:slug` | auth |
| Subscriptions | `/subscriptions` (+ nested: `collection`, `price-revision`, `import`, `new`, `:id`, `:id/edit`) | `RoleRoute` |
| Proposals | `/proposals`, `/new`, `/:id`, `/:id/edit` | `RoleRoute` |
| Finance | `/finance`, `/expenses`, `/income`, `/vat`, `/exchange`, `/recurring` | `RoleRoute` |
| Finance | `/finance/receivables` (unpaid income docs), `/finance/collections` (Tahsilat) | `RoleRoute` |
| Finance | `/finance/tahsilat` → redirect `/finance/collections`; `/finance/reports` → redirect `/finance` | |
| Subscriptions · Collection desk | `/subscriptions/collection` (CollectionDeskPage) | `RoleRoute` |
| Equipment (site assets) | `/equipment`, `/equipment/import` | auth |
| SIM cards | `/sim-cards`, `/new`, `/import`, `/invoice-analysis`, `/:id/edit` | `RoleRoute` |

**`src/features/tasks` & `src/features/calendar`:** shared hooks/logic (dashboard, operations `CalendarTab`, daily work). **No `/tasks` or `/calendar` routes in `App.jsx`** — do not assume those URLs exist unless you add them.

**Navigation hints:** `src/components/layout/navItems.js` (finance VAT/exchange/recurring live under “Ayarlar” group; top bar differs by `canWrite`).

---

## Finance module rules (critical)

<!-- UPDATED: accrual/hybrid payment, receivables, tahsilat + four income paths + SIM batch + official_invoice -->

### Single source of truth

**`financial_transactions`** — All P&L, VAT, income/expense UI, and aggregates should read this table. **Do not** use `subscription_payments` as the ledger for reporting totals.

**`direction`:** `'income'` | `'expense'`. Always filter **`deleted_at IS NULL`** (soft delete).

**P&L view (`v_profit_and_loss`):** reads **only** `financial_transactions` (with `deleted_at IS NULL`). The old `subscription_payments` UNION was removed in **`00207`** because it double-counted subscription revenue (already captured by the subscription trigger).

### Accrual / hybrid payment model (00207+)

Finance is **accrual-based**: revenue is recognized when the document is created (period/P&L), and **cash collection is tracked separately**.

- **`financial_transactions.payment_status`** — `'paid'` | `'unpaid'` | (partial). Default `'paid'` for backward compat.
- **`financial_transaction_payments`** — 1:many payment events per document (cash receipts). A trigger **recalculates `payment_status`** on the parent whenever a payment row changes.
- **Receivables (`/finance/receivables`):** income documents with `payment_status = 'unpaid'` awaiting collection.
- **Completion RPCs (don’t set status directly from the app):**
  - **`fn_complete_work_order_with_payment`** (`00208`): cash/card → income row + payment row → `paid`; bank_transfer → income row, no payment → `unpaid` (shows on receivables). Proposal-linked WOs are still completed but return `completed_proposal_linked` (trigger skips revenue).
  - **`complete_proposal_with_rate`** (`00210`, fix `00211`): atomically completes a proposal and stores a **user-confirmed USD→TRY rate** (`completion_exchange_rate`) so `auto_record_proposal_revenue` uses it instead of auto-querying. `00211` recomputes `total_amount_usd` from items when stale/zero so the income row is not silently skipped.
- **Proposal revenue** rows now default to **`payment_status = 'unpaid'`** (`00209`); COGS expense rows stay `paid`.

### Tahsilat / Collections (`/finance/collections`)

Per-customer + per-document collection screen (`features/finance` → `collectionApi.js`/`TahsilatPage`). Backed by views **`v_collection_customer_summary`** (document_count, total_billed, total_vat, total_cost, collected, **`total_profit`** = Σ net − Σ COGS TRY; `00213`/`00214`) and per-document rows. Documents carry a **`service_category_enum`**: `kira`, `merkez`, `montaj`, `servis`, `satis`, `mal_gonderme`, `diger` (`00212`). Distinct from the subscription-only **CollectionDeskPage** at `/subscriptions/collection`.

### Four automated income paths (to `financial_transactions`)

1. **Subscriptions** — On `subscription_payments` transition to `paid`, trigger **`fn_subscription_payment_to_finance`** (`trg_subscription_payment_to_finance` from early migrations; function body latest in **`00201_fix_subscription_payment_trigger_vat_logic.sql`**).  
   - Inserts **income** row: `income_type = 'subscription'`, links `subscription_payment_id`, NET amounts in TRY, `output_vat` / `vat_rate` per rules below, optional COGS on income via `cogs_try`.  
   - May insert **expense** row (COGS): category **`subscription_cogs`**, `input_vat` **NULL** (internal cost, not supplier invoice).

2. **Proposals** — On `proposals` → `completed`, **`auto_record_proposal_revenue`** (`trg_auto_record_proposal_revenue`). Latest logic includes TRY/USD branches and COGS (see **`00191`**, **`00200`** family predecessors).  
   - **Income** row linked to `proposal_id`.  
   - **COGS** as **expense** when applicable.

3. **Work orders (standalone)** — On `work_orders` → `completed`, **`auto_record_work_order_revenue`** (`trg_auto_record_work_order_revenue`). **Skips rows with `proposal_id IS NOT NULL`** — revenue for those jobs is only via proposal completion.  
   - **Income** + optional **COGS expense**; **`00200`** aligns income row `cogs_try` / COGS handling with proposal-style margin reporting.

4. **SIM rental (aggregated monthly)** — **`generate_monthly_sim_finance()`** ( **`00202_monthly_sim_finance_cron.sql`**, return column fix **`00203_fix_sim_finance_status_ambiguity.sql`** ):  
   - **Previous calendar month**, idempotent per period.  
   - **Income:** sum of `sim_cards.sale_price` where `status = 'active'`, `income_type = 'sim_rental'`, aggregated row (`sim_card_id` NULL), description pattern “SIM Kart Kiralama Geliri”.  
   - **Expense:** sum of `cost_price` where `status IN ('active','available')`, category **`sim_operator`**, “SIM Kart Operatör Gideri”.  
   - Scheduled **pg_cron** job name **`generate-monthly-sim-finance`**, `0 2 1 * *` UTC (1st of month 02:00). Not row-level SIM triggers for this bulk path.

**Plus:** manual UI entries, **`fn_generate_recurring_expenses`** (recurring templates → `financial_transactions`), and **write-off** path **`fn_write_off_to_finance`** on payment updates (`00180_write_off_to_finance.sql`). **Reversals:** `reverse_work_order_finance_entries` / `reverse_proposal_finance_entries` on status regressions (`00190_financial_reversal_on_status_change.sql`).

### VAT and `official_invoice`

- **General:** use **dynamic `vat_rate`** from the business row (`subscriptions`, `work_orders`, `proposals` where present); store on `financial_transactions` as needed. Avoid magic `0.20` in app code.  
- **Subscription payments (`00201`):** If **`subscriptions.official_invoice`** is **false** (treat missing as **true** in that trigger), **`output_vat := 0`** on the income row; else use payment’s VAT (`NEW.vat_amount`). Subscription COGS expense row: **`has_invoice` false**, **`input_vat` NULL**, **`vat_rate` NULL**.  
- **Proposal TRY branch (`00191`):** computes `output_vat` on revenue; COGS side uses `input_vat` where applicable for TRY detail — follow DB function, not duplicated app rules.

### SIM vs subscription SIM amounts

Subscription monthly pricing and SIM line items live on **`subscriptions`** (NET components, `vat_rate`, etc.). **Monthly SIM card rental income/expense in the ledger** for operator inventory is the **batch** above, not per-card trigger inserts (large fleet).

---

## Paraşüt integration (in progress)

> Historical audit docs say Paraşüt “will not be built”. That is **outdated** — an integration is actively being added (migrations `00215`–`00218`, edge functions, `features/customers` + `features/finance` `parasut*` modules).

- **Customers:** `parasut_contact_id`, `identity_type`, `tax_office` (`00215`). Matching UI at **`/customers/parasut-matching`** (`ParasutMatchingPage`, `parasutMatchingApi.js`).
- **OAuth/audit (`00216`):** `parasut_oauth_tokens` (single-row token store + refresh lock), audit log, idempotency cache.
- **Invoice sync (`00217`):** `financial_transactions.parasut_e_document_id`, `parasut_sync_status`, `parasut_synced_at`, `parasut_error`, `parasut_trackable_job_id`.
- **Payment sync (`00218`):** `financial_transaction_payments.parasut_payment_id`, `parasut_transaction_id`, `parasut_synced_at`.
- **Edge functions:** `parasut-dispatch`, `parasut-reconcile` (see below).

---

## Edge functions & cron

**Supabase Edge Functions** (`supabase/functions/`):

| Function | Purpose |
|----------|---------|
| `fetch-tcmb-rates` | Pull TCMB exchange rates → `exchange_rates` |
| `extend-subscription-payments` | Keep `subscription_payments` schedule populated forward |
| `parasut-dispatch` | Push invoices/payments to Paraşüt |
| `parasut-reconcile` | Reconcile Paraşüt sync state back into the ledger |

**pg_cron jobs** still include `generate-monthly-sim-finance` (`0 2 1 * *` UTC) and the recurring-expense generator (`fn_generate_recurring_expenses`, daily).

---

## Database snapshot

<!-- UPDATED: migration id -->

- **Migrations:** **`00220`** is the latest number; **220** `.sql` files under `supabase/migrations/` (note: two files share the `00204` prefix — `materials_prices_with_currency` and `security_invoker_detail_views`). 
- **Ledger:** `financial_transactions` (+ `financial_transaction_payments`, `expense_categories`, `exchange_rates`, `recurring_expense_templates`, …). 
- **Collections/Paraşüt:** `v_collection_customer_summary`, `service_category_enum`, `parasut_oauth_tokens`, plus `parasut_*` columns on customers / financial tables. 
- **SIM:** `sim_cards`, `sim_static_ips`, view `sim_cards_list` (Turkish-normalized search). 
- **Ops:** plan/items evolved through **`00173+`** migrations (check DB for current table names).

---

## i18n

<!-- UPDATED: 24 namespaces in src/lib/i18n.js -->

**Namespaces:** `common`, `auth`, `errors`, `customers`, `workOrders`, `dailyWork`, `workHistory`, `materials`, `tasks`, `dashboard`, `profile`, `calendar`, `subscriptions`, `simCards`, `proposals`, `finance`, `notifications`, `recurring`, `siteAssets`, `invoiceAnalysis`, `actionBoard`, `collection`, `operations`, `technicalGuide`.

**Rule:** no user-visible Turkish hardcoded in components — use `useTranslation('namespace')` and keys in `src/locales/tr/*.json`.

---

## Code layout & patterns

- **Features:** `src/features/<name>/` — commonly **`api.js`** (Supabase), **`hooks.js`** (React Query), **`schema.js`** (zod); some modules split **`paymentsApi.js`**, **`collectionApi.js`**, **`recurringApi.js`**, etc.  
- **Queries:** stable **`queryKey` factories**, invalidate related keys on mutations.  
- **Forms:** `react-hook-form` + `zodResolver`.  
- **UI:** reuse `src/components/ui/*` and layout from `src/components/layout/*`; Tailwind only (no new CSS files).  
- **Search:** Turkish normalization via **`normalizeForSearch`** where applicable.  
- **Charts:** colors from **`src/lib/chartTheme.js`**.

**Global hooks:** `useAuth`, `useTheme`, `useDebouncedValue`, `useSearchInput`, `useUnsavedChanges` under `src/hooks/`; **`useRole`** in **`src/lib/roles.js`**.

---

## Anti-patterns (do not)

1. Bypass **`financial_transactions`** for finance KPIs or CSV export sources.  
2. Hardcode VAT rates or assume all subscriptions issue official invoices — respect **`official_invoice`**.  
3. Record revenue twice for **proposal-linked work orders** (DB skips WO trigger when `proposal_id` set). 
4. Re-add `subscription_payments` to P&L/aggregates, or read totals without `deleted_at IS NULL`. 
5. Set `financial_transactions.payment_status` / complete WOs/proposals by raw status UPDATE — use the **completion RPCs** (`fn_complete_work_order_with_payment`, `complete_proposal_with_rate`) and `financial_transaction_payments` for collection. 
6. Call Supabase directly from large page components — prefer **`api.js` + hooks**. 
7. Skip loading/error/empty UI states.  
8. Add dependencies without project need / discussion.  
9. Hardcode Turkish strings in UI.

**Ambiguous requests:** ask **one** focused clarifying question (data source, scope, role, or module placement).

---

## Recent migrations (latest 10)

<!-- UPDATED -->

| # | File (short) | Purpose |
|---|----------------|---------|
| 00220 | `materials_description_search` | Turkish-normalized generated search column on `materials.description` |
| 00219 | `sim_cards_list_view` | `sim_cards_list` view with normalized phone/customer search |
| 00218 | `parasut_payment_meta` | Paraşüt payment sync columns on `financial_transaction_payments` |
| 00217 | `parasut_sync_status` | Paraşüt invoice sync columns on `financial_transactions` |
| 00216 | `parasut_oauth_audit` | Paraşüt OAuth token store, audit log, idempotency cache |
| 00215 | `parasut_customer_matching` | `parasut_contact_id`/`identity_type`/`tax_office` on customers |
| 00214 | `collection_customer_summary_profit` | `total_profit` on `v_collection_customer_summary` |
| 00213 | `tahsilat_views` | Per-customer + per-document collection views |
| 00212 | `tahsilat_core` | `service_category_enum`, payment tracking, categorization trigger |
| 00211 | `fix_complete_proposal_with_rate_recalc` | Recompute `total_amount_usd` so proposal income isn’t skipped |
| 00210 | `complete_proposal_with_rate_rpc` | User-confirmed USD rate on proposal completion |
| 00209 | `update_proposal_trigger_unpaid` | Proposal income rows default `payment_status = 'unpaid'` (receivables) |
| 00208 | `complete_work_order_with_payment_rpc` | WO completion + payment method → paid/unpaid |
| 00207 | `fix_pl_view_and_hybrid_payment_schema` | Drop subscription UNION from P&L; add `payment_status` + `financial_transaction_payments` |

---

## Environment

Required: **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`** (`.env.local`). Optional: **`VITE_SENTRY_DSN`**.

---

## Further reading

- Repo: **`docs/CODING-LESSONS.md`**, **`docs/archive/completed/finance-audit-report.md`** / **`finance-fix-roadmap.md`** (historical audits).  
- **`docs/active/CASHFLOW_MANAGEMENT_AUDIT_AND_ROADMAP.md`** — cashflow/forecast roadmap (Cashflow v1.0 = **planned**, not yet shipped).  
- Do not treat “planned” roadmap items as shipped unless code/migrations exist.
