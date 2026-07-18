# Supabase — Ornet ERP

Backend for Ornet ERP: **PostgreSQL schema + RLS + RPCs** (migrations) and **Edge Functions** (cron / Paraşüt / TCMB).

For app architecture, finance rules, and routes, see **`CLAUDE.md`** at the repo root. This file covers the Supabase folder only.

---

## Source of truth

| Path | Role |
|------|------|
| `migrations/` | **Canonical schema.** Apply in order. Do not invent schema from older docs. |
| `functions/` | Edge Functions (Deno). Deploy separately from SQL. |
| `config.toml` | Project + per-function `verify_jwt` settings. |
| `complete_schema.sql` | **Deprecated.** Early MVP (profiles / customers / work_orders / tasks only). Do **not** use for new setups or resets. |

Current migration head (as of this update): **`00252`** — **252** `.sql` files under `migrations/`  
(Note: two files share the `00204` prefix.)

---

## Local / remote workflow

Preferred workflow uses the **Supabase CLI** against a linked project (staging first, then production).

```bash
# Link once (use the correct project ref)
supabase link --project-ref <PROJECT_REF>

# See local vs remote migration status
supabase migration list

# Apply pending migrations (after explicit approval for production)
supabase db push

# Deploy one edge function
supabase functions deploy fetch-tcmb-rates
supabase functions deploy extend-subscription-payments
supabase functions deploy parasut-dispatch
supabase functions deploy parasut-reconcile
```

**Do not** paste `complete_schema.sql` into the SQL Editor expecting a full ERP database.

Fresh environments should get schema **only** via the ordered `migrations/` chain (or a maintained dump derived from that chain — not the deprecated MVP file).

---

## App environment

Frontend (`.env.local`):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
# Optional
VITE_SENTRY_DSN=
```

Edge / cron secrets (Dashboard → Edge Functions → Secrets; not in the Vite app):

- `CRON_SECRET` — required for cron-invoked functions that skip JWT (`x-cron-secret` header)
- Paraşüt OAuth / API secrets used by `parasut-dispatch` / `parasut-reconcile` (see Paraşüt docs under `docs/`)

First admin user: create via Auth → Users, then:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

Roles: `admin` | `accountant` | `field_worker` (`canWrite` = admin or accountant).

---

## Schema domains (high level)

Migrations grow domain-by-domain. Major areas:

| Domain | Examples |
|--------|----------|
| Identity | `profiles` (extends `auth.users`) |
| CRM / ops | `customers`, sites, `work_orders`, materials, operations plan/items, tasks |
| Commercial | `subscriptions`, `subscription_payments`, `proposals`, SIM cards |
| Finance ledger | `financial_transactions`, `financial_transaction_payments`, expense categories, exchange rates, recurring templates |
| Collections | Tahsilat views (`v_collection_*`), `service_category_enum` |
| Integrations | Paraşüt columns + `parasut_oauth_tokens` / audit / idempotency |

**Ledger rule:** P&L and finance reporting read **`financial_transactions`** (`deleted_at IS NULL`). Do not use `subscription_payments` as the reporting ledger.

**Accrual / cash:** document recognition vs collection is split (`payment_status` + `financial_transaction_payments`). Details in `CLAUDE.md`.

**SIM auto-ledger:** historical monthly SIM income/expense generation (`generate_monthly_sim_finance`) was **disabled** in **`00238`** (cron unscheduled; function is a no-op). Operator costs go through normal finance / recurring paths.

---

## Edge Functions

Defined under `functions/`. JWT policy is set in `config.toml`.

| Function | Purpose | `verify_jwt` |
|----------|---------|--------------|
| `fetch-tcmb-rates` | Pull TCMB rates → `exchange_rates` | `false` (cron secret or privileged session) |
| `extend-subscription-payments` | Keep subscription payment schedule filled forward | `false` (cron secret) |
| `parasut-dispatch` | Push contacts / invoices / payments to Paraşüt | `true` |
| `parasut-reconcile` | Reconcile Paraşüt sync state back into the ledger | `false` (cron-oriented) |

Shared helpers live in `functions/_shared/` (e.g. cron auth).

---

## Cron (database / scheduled jobs)

Typical jobs (verify live with `SELECT jobname, schedule FROM cron.job ORDER BY jobname;`):

- Recurring expense generation (`fn_generate_recurring_expenses`) — daily
- Subscription payment extension (edge + related DB scheduling)
- TCMB rate fetch (edge + cron secret)

**Not active:** `generate-monthly-sim-finance` (removed in `00238`).

---

## RLS and security notes

- Tables are protected with **RLS**; sensitive finance/subscription/proposal access is role-gated.
- Many business mutations go through **`SECURITY DEFINER` RPCs** with role guards — prefer those over raw client updates for completions, soft deletes, and finance writes.
- Never weaken RLS or RPC guards for convenience. Migrations that change RLS/RPCs need explicit **APPROVE** before apply.

---

## After schema / function changes

1. Confirm migrations applied: `supabase migration list`
2. Deploy any changed edge functions
3. Confirm cron secrets and schedules on the target project
4. Point the app at the project with `.env.local` and run `npm run dev`

---

## Further reading

- `CLAUDE.md` — finance architecture, income paths, routes, anti-patterns
- `docs/CODING-LESSONS.md`
- `docs/active/` — active roadmaps (e.g. cashflow, Paraşüt)
- Supabase CLI docs: https://supabase.com/docs/guides/cli
