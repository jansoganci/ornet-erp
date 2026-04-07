# CLAUDE.md — Ornet ERP context

<!-- UPDATED: 2026-04-07 — condensed + finance/SIM/monthly batch accuracy -->

> AI assistant context: architecture, finance rules, routes. Prefer this file + the repo over assumptions.

---

## Project identity

**Ornet ERP** — Work order management and ERP for a **Turkish security company**: customers and sites, work orders, materials, subscriptions, SIM inventory, proposals/quotes, finance ledger, notifications, site equipment (“Equipment” in UI), operations board, technical guide.

**Roles** (`profiles.role`, `src/lib/roles.js`): `admin`, `accountant`, `field_worker`. **`canWrite`** = admin OR accountant (subscriptions, SIMs, proposals, finance, operations import, etc.).

---

## Tech stack (from `package.json`)

React ^19.2 · Vite ^7.2 · react-router-dom ^7.13 · TanStack Query ^5.90 · Supabase JS ^2.93 · react-hook-form ^7 · zod ^4 · Tailwind ^4 · i18next ^25 / react-i18next ^16 · recharts ^3.8 · react-big-calendar ^1.19 · @react-pdf/renderer ^4.3 · pdfjs-dist ^5 · xlsx ^0.18 · @sentry/react ^10.39 · sonner · lucide-react · clsx · tailwind-merge · vite-plugin-pwa (dev).

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
| Work orders | `/work-orders`, `/new`, `/:id`, `/:id/edit` | auth |
| Daily work | `/daily-work` | auth |
| Work history | `/work-history` | auth |
| Materials | `/materials`, `/materials/import` | auth |
| Technical guide | `/technical-guide`, `/technical-guide/:slug` | auth |
| Subscriptions | `/subscriptions` (+ nested: `collection`, `price-revision`, `import`, `new`, `:id`, `:id/edit`) | `RoleRoute` |
| Proposals | `/proposals`, `/new`, `/:id`, `/:id/edit` | `RoleRoute` |
| Finance | `/finance`, `/expenses`, `/income`, `/vat`, `/exchange`, `/recurring` | `RoleRoute` |
| Finance | `/finance/reports` → redirect `/finance` | |
| Equipment (site assets) | `/equipment`, `/equipment/import` | auth |
| SIM cards | `/sim-cards`, `/new`, `/import`, `/invoice-analysis`, `/:id/edit` | `RoleRoute` |

**`src/features/tasks` & `src/features/calendar`:** shared hooks/logic (dashboard, operations `CalendarTab`, daily work). **No `/tasks` or `/calendar` routes in `App.jsx`** — do not assume those URLs exist unless you add them.

**Navigation hints:** `src/components/layout/navItems.js` (finance VAT/exchange/recurring live under “Ayarlar” group; top bar differs by `canWrite`).

---

## Finance module rules (critical)

<!-- UPDATED: four income paths + SIM batch + subscriptions official_invoice -->

### Single source of truth

**`financial_transactions`** — All P&L, VAT, income/expense UI, and aggregates should read this table. **Do not** use `subscription_payments` as the ledger for reporting totals.

**`direction`:** `'income'` | `'expense'`.

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

## Database snapshot

<!-- UPDATED: migration id -->

- **Migrations:** **`00203`** is the latest numbered file; **202** `.sql` files under `supabase/migrations/`.  
- **Ledger:** `financial_transactions` (+ `expense_categories`, `exchange_rates`, `recurring_expense_templates`, …).  
- **SIM:** `sim_cards`, `sim_static_ips`.  
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
4. Call Supabase directly from large page components — prefer **`api.js` + hooks**.  
5. Skip loading/error/empty UI states.  
6. Add dependencies without project need / discussion.  
7. Hardcode Turkish strings in UI.

**Ambiguous requests:** ask **one** focused clarifying question (data source, scope, role, or module placement).

---

## Recent migrations (latest 10)

<!-- UPDATED -->

| # | File (short) | Purpose |
|---|----------------|---------|
| 00203 | `fix_sim_finance_status_ambiguity` | `generate_monthly_sim_finance` return column renamed to avoid `status` ambiguity |
| 00202 | `monthly_sim_finance_cron` | Monthly SIM aggregate income/expense + pg_cron schedule |
| 00201 | `fix_subscription_payment_trigger_vat_logic` | `official_invoice` → `output_vat`; COGS expense `input_vat` NULL |
| 00200 | `auto_record_work_order_revenue_income_cogs_try` | WO completion income/COGS alignment (`cogs_try` on income) |
| 00199 | `proposal_sections_discount` | Proposal sections discount |
| 00198 | `proposal_sections_rls` | RLS for proposal sections |
| 00197 | `proposal_sections` | Proposal sections schema |
| 00196 | `proposal_items_section_label` | Section labels on items |
| 00195 | `work_orders_detail_status_rank` | View/detail ordering |
| 00194 | `update_work_orders_detail_vat` | Work order detail VAT exposure |

---

## Environment

Required: **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`** (`.env.local`). Optional: **`VITE_SENTRY_DSN`**.

---

## Further reading

- Repo: **`docs/CODING-LESSONS.md`**, **`docs/archive/completed/finance-audit-report.md`** / **`finance-fix-roadmap.md`** (historical audits).  
- Do not treat “planned” roadmap items as shipped unless code/migrations exist.
