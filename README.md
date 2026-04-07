# Ornet ERP

<!-- UPDATED: replaced Vite template; project overview and setup -->

Work order management and lightweight ERP for a Turkish security company: customers, field work, subscriptions, SIM inventory, proposals, and finance on Supabase.

## Who it is for

- Field technicians (`field_worker`): daily work, work orders, customers (read-focused workflows).
- Office staff: scheduling, customers, work history, operations board, equipment.
- Accountants and admins (`accountant`, `admin`): subscriptions, SIMs, proposals, full finance module (`canWrite` in `src/lib/roles.js`).

## Tech stack

Versions follow `package.json`:

| Area | Package | Version (range) |
|------|---------|-------------------|
| UI | React / react-dom | ^19.2.0 |
| Build | Vite | ^7.2.4 |
| Router | react-router-dom | ^7.13.0 |
| Data | @tanstack/react-query | ^5.90.20 |
| Backend | @supabase/supabase-js | ^2.93.3 |
| Forms | react-hook-form, zod, @hookform/resolvers | ^7.x, ^4.x, ^5.x |
| Styling | tailwindcss, @tailwindcss/vite | ^4.1.18 |
| i18n | i18next, react-i18next | ^25.x, ^16.x |
| Charts | recharts | ^3.8.0 |
| Calendar | react-big-calendar | ^1.19.4 |
| PDF | @react-pdf/renderer | ^4.3.2 |
| PDF parse | pdfjs-dist | ^5.x |
| XLSX | xlsx | ^0.18.5 |
| Errors | @sentry/react | ^10.39.0 |
| UX | sonner, lucide-react, clsx, tailwind-merge | per package.json |
| PWA | vite-plugin-pwa (devDependency) | ^1.2.0 |

## Feature modules and routes

<!-- UPDATED: aligned with src/App.jsx -->

Defined in `src/App.jsx`. `RoleRoute` wraps paths that require `canWrite` (admin or accountant).

**Public auth:** `/login`, `/register`, `/forgot-password`  
**Auth utilities:** `/auth/update-password`, `/auth/verify-email`

**Protected (authenticated):**

| Area | Paths | Notes |
|------|--------|--------|
| Core | `/`, `/profile`, `/notifications`, `/action-board` | Action board: admin-oriented |
| Operations | `/operations`, `/operations/import` | `canWrite` |
| Customers | `/customers`, `/customers/import`, `/customers/new`, `/customers/:id`, `/customers/:id/edit` | |
| Work orders | `/work-orders`, `/work-orders/new`, `/work-orders/:id`, `/work-orders/:id/edit` | |
| Daily work | `/daily-work` | |
| Work history | `/work-history` | |
| Materials | `/materials`, `/materials/import` | |
| Technical guide | `/technical-guide`, `/technical-guide/:slug` | |
| Subscriptions | `/subscriptions`, `/subscriptions/collection`, `/subscriptions/price-revision`, `/subscriptions/import`, `/subscriptions/new`, `/subscriptions/:id`, `/subscriptions/:id/edit` | Nested layout; `canWrite` |
| Proposals | `/proposals`, `/proposals/new`, `/proposals/:id`, `/proposals/:id/edit` | `canWrite` |
| Finance | `/finance`, `/finance/expenses`, `/finance/income`, `/finance/vat`, `/finance/exchange`, `/finance/recurring` | `canWrite`; `/finance/reports` redirects to `/finance` |
| Equipment | `/equipment`, `/equipment/import` | Site assets UI |
| SIM cards | `/sim-cards`, `/sim-cards/new`, `/sim-cards/import`, `/sim-cards/invoice-analysis`, `/sim-cards/:id/edit` | `canWrite`; invoice analysis lazy-loaded |

**Other:** unknown paths redirect to `/`.

`src/features/tasks` and `src/features/calendar` provide hooks and UI pieces (e.g. operations calendar, dashboard checklist) but **there are no `/tasks` or `/calendar` entries in `App.jsx`** as of this README—dashboard may still link to `/tasks`; verify before relying on that URL.

Feature folders under `src/features/` include: `actionBoard`, `auth`, `calendar`, `customers`, `customerSites`, `dashboard`, `finance`, `materials`, `notifications`, `operations`, `profile`, `proposals`, `service` (placeholder), `simCards`, `siteAssets`, `subscriptions`, `tasks`, `technicalGuide`, `workHistory`, `workOrders`.

## Getting started

```bash
npm install
cp .env.example .env.local   # add Supabase URL + anon key
npm run dev                   # http://localhost:5173
npm run build
npm run preview
npm run lint
```

Optional deploy scripts: `npm run deploy`, `npm run deploy:prod` (Vite build + `wrangler pages deploy`).

## Project structure (short)

<!-- UPDATED -->

- `src/app/` — layout, providers, `ProtectedRoute`, `AuthRoute`
- `src/features/<domain>/` — typical pattern: `api.js`, `hooks.js`, `schema.js`, pages, `components/` (not every folder has every file)
- `src/components/` — shared `ui/`, `layout/`, `import/`
- `src/lib/` — Supabase client, i18n, roles, utilities
- `src/locales/tr/` — Turkish JSON namespaces (see `src/lib/i18n.js`)
- `src/pages/` — e.g. `DashboardPage.jsx`
- `supabase/migrations/` — SQL migrations

## Database (Supabase)

<!-- UPDATED: migration revision -->

- **Migrations:** 202 SQL files in `supabase/migrations/`; latest numbered migration **`00203_*.sql`**.
- **Primary ledger:** `financial_transactions` — all reporting reads this table; do not aggregate finance from `subscription_payments` alone.
- **Other core tables (illustrative):** `customers`, `customer_sites`, `work_orders`, `work_order_materials`, `materials`, `profiles`, `subscriptions`, `subscription_payments`, `sim_cards`, `sim_static_ips`, `proposals`, `proposal_items`, `proposal_work_orders`, `site_assets`, `expense_categories`, `exchange_rates`, `recurring_expense_templates`, `payment_methods`, `notifications`, `audit_logs` (plus operations/plan-items tables from recent migrations—inspect schema in repo as needed).

Applied behavior for automated finance is defined in Postgres functions/triggers (see `CLAUDE.md`).

## Environment variables

<!-- UPDATED: from .env.example + main.jsx -->

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_SENTRY_DSN` | No | Enables Sentry when set (`src/main.jsx`) |

Use `.env.local` for local development (do not commit secrets).

## Documentation for contributors

- **`CLAUDE.md`** — AI/session context: routing, finance rules, triggers, conventions.
- **`docs/`** — deeper audits and archived notes where present.
