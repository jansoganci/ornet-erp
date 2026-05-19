# Ornet ERP Project Rules

## Project Identity

- **Name:** Ornet ERP
- **Type:** Client project — V1 Client Workflow is mandatory
- **Repo:** `/Users/jans/Desktop/nexus/ornet-erp`
- **Classification:** Turkish security company ERP — work order management, finance ledger, proposals, subscriptions, SIM inventory

## Source Of Truth

Before making assumptions, always check:

1. `CLAUDE.md` — Comprehensive project rules, finance architecture, routes, database schema
2. Source files — `src/features/`, `src/lib/`, `src/App.jsx`
3. `supabase/migrations/` — Database schema and migration history
4. `package.json` — Exact dependency versions

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 | SPA (NOT Next.js) — pure Vite build |
| Language | JavaScript (JSX) | **No TypeScript** in main app. video/ subdir has TS for Remotion |
| Build | Vite 7 | |
| Routing | react-router-dom 7 | Routes in `src/App.jsx` |
| Server State | @tanstack/react-query 5 | |
| Forms | react-hook-form 7 + zod 4 | |
| Backend | Supabase (PostgreSQL) | **No ORM** (no Prisma/Drizzle). 220+ numbered SQL migrations |
| Styling | Tailwind CSS 4 | CSS-first — no config file, `@theme` in `index.css` |
| i18n | i18next + react-i18next | 24 namespaces, **Turkish primary** |
| Auth | Supabase Auth | Roles: admin, accountant, field_worker |
| Deployment | Cloudflare Pages + Wrangler | PWA-ready via vite-plugin-pwa |
| Charts | recharts 3 | |
| PDF | @react-pdf/renderer 4 | |
| Testing | **None installed** | No Vitest/Jest/RTL. Manual SQL script testing only |
| Icons | lucide-react | |

## Architecture

```
src/
├── features/{module}/
│   ├── api.js            — Supabase queries + query key factory
│   ├── hooks.js          — React Query hooks (queries + mutations)
│   ├── schema.js         — Zod validation schemas
│   ├── {Name}Page.jsx    — Page components
│   └── components/       — Module-specific components
├── components/ui/        — Shared UI (Button, Modal, Badge, etc.)
├── components/layout/    — Shell (Sidebar, Header, PageContainer)
├── lib/                  — Utilities (supabase client, i18n config, roles)
├── locales/tr/           — 24 Turkish translation JSON files
├── locales/en/           — English translations (partial)
├── App.jsx               — Router config (single source of truth for routes)
├── main.jsx              — Entry point
```

## Feature Modules

21 domain modules under `src/features/`:
auth, customers, workOrders, proposals, finance, subscriptions, materials, operations, dashboard, calendar, tasks, workHistory, simCards, siteAssets, notifications, profile, service, customerSites, technicalGuide, actionBoard

Each follows the api.js / hooks.js / schema.js / components/ pattern.

## Auth Roles

Roles defined in `src/lib/roles.js`:
- `admin` — full access
- `accountant` — finance + canWrite
- `field_worker` — limited (field operations only)

Protected routes use `RoleRoute` which requires `canWrite` (admin OR accountant).

## Database

- Supabase PostgreSQL — **no ORM**
- 220+ sequential SQL migrations in `supabase/migrations/`
- Latest migration: check files in `supabase/migrations/` for current number
- RLS policies enforced at database level
- Finance-sensitive tables: `financial_transactions`, `subscription_payments`, `proposals`, `work_orders`

## i18n

- Turkish primary language
- 24 namespaces in `src/locales/tr/`
- No user-visible Turkish hardcoded in components — use `useTranslation('namespace')` with keys
- New i18n keys go to the appropriate namespace JSON file in `src/locales/tr/`

## Build & Deploy

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server (vite) |
| `npm run build` | Production build (vite build) |
| `npm run lint` | ESLint check |
| `npm run deploy` | Build + Cloudflare Pages deploy via Wrangler |

## Prohibited Actions

- Do NOT add TypeScript to the main app
- Do NOT add Prisma or any ORM
- Do NOT modify `artifacts/` directory (doesn't exist here, but still)
- Do NOT hardcode Turkish strings in components — always use i18n
- Do NOT modify `financial_transactions` structure without finance review
- Do NOT run migrations without checking latest migration number first

## Required Verification

After any implementation:
1. `npm run build` — must pass
2. `npm run lint` — should pass (or document new warnings)
3. `git diff --stat main...HEAD` — report what changed
4. For migrations: check SQL syntax, RLS implications, latest migration number
5. For finance changes: reviewer MUST inspect calculations manually

## External State

Hermes tracks workflow state in `.hermes/hermes-state.json`.

- Created per PLAN_ONLY task.
- Updated on every phase change (PLAN_ONLY → WAITING_FOR_APPROVAL → APPROVED_FOR_IMPLEMENTATION → ...).
- Read at session start to recover in-progress work.
- Runtime file — do not commit to git (already in .gitignore).
- Lock file: `.hermes/hermes-state.lock` (also gitignored).
