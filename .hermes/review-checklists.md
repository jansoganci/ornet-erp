# Ornet ERP Review Checklists

## Universal Checklist (Every Change)

- [ ] Does the change follow the existing feature folder pattern (api.js, hooks.js, schema.js, components/)?
- [ ] Does it avoid TypeScript?
- [ ] Does it avoid adding unnecessary dependencies?
- [ ] Does `npm run build` pass?
- [ ] Does `npm run lint` pass?
- [ ] Are i18n keys used instead of hardcoded Turkish strings?

## Frontend UI Change Checklist

- [ ] Is Tailwind v4 CSS-first syntax used? (No separate config file)
- [ ] Is the component responsive? (Mobile + desktop)
- [ ] Are Lucide icons used for icons?
- [ ] Is the change consistent with existing shadcn-like UI patterns?
- [ ] Are React Hook Form + Zod used for forms?
- [ ] Is `useTranslation` used for all user-visible text?
- [ ] Are `<RoleRoute>` / auth guards applied to new routes?

## Supabase Query / API Change Checklist

- [ ] Are queries scoped to the current user / organization?
- [ ] Are mutations protected by RLS?
- [ ] Is `@supabase/supabase-js` used (not raw SQL unless via Edge Function)?
- [ ] Do React Query hooks follow the existing pattern (query key factory + useQuery/useMutation)?
- [ ] Are error states handled gracefully?
- [ ] Is loading state handled (skeleton/spinner)?

## Migration / Database Change Checklist

- [ ] Is the migration file numbered sequentially after the latest existing migration?
- [ ] Is the SQL reversible? (Include a `--- REVERT` section)
- [ ] Are RLS policies applied to new tables?
- [ ] Do new columns have appropriate defaults or NOT NULL constraints?
- [ ] Are finance-sensitive tables flagged and reviewed carefully?
- [ ] Do `schema.js` Zod schemas match the new DB schema?
- [ ] Is `financial_transactions` updated correctly? (direction, income_type, amounts)

## Auth / Role Change Checklist

- [ ] Are changes reflected in `src/lib/roles.js`?
- [ ] Are `<RoleRoute>` / route-level guards updated?
- [ ] Are UI-level guards updated (conditional rendering based on role)?
- [ ] Are Supabase RLS policies updated to match new roles?
- [ ] Is there a database migration for auth changes?

## Finance Logic Checklist

- [ ] Is the calculation deterministic? (Same inputs always produce same output)
- [ ] Are totals double-checked against individual line items?
- [ ] Is VAT (output_vat, input_vat, vat_rate) handled correctly?
- [ ] Are currency conversions (TRY/USD) handled?
- [ ] Is `financial_transactions` the source of truth for all P&L?
- [ ] Are payment status transitions correct (unpaid → partial → paid)?
- [ ] Does the change affect existing financial data? (If yes, backfill plan needed)

## i18n Change Checklist

- [ ] Are new keys added to the correct namespace in `src/locales/tr/*.json`?
- [ ] Are English translations added to `src/locales/en/*.json`? (May be partial)
- [ ] Are keys used via `useTranslation('namespace')` or `t('namespace:key')`?
- [ ] Are no Turkish strings hardcoded in components?
- [ ] Is the key naming convention consistent with existing keys?

## Build / Deploy Checklist

- [ ] Does `npm run build` succeed?
- [ ] Are environment variables correctly set for Cloudflare Pages?
- [ ] Is the PWA manifest and service worker intact?
- [ ] Are Sentry errors reviewed if applicable?

## Final Release Checklist

- [ ] All checklists above completed
- [ ] `git diff --stat main...HEAD` reviewed
- [ ] `git diff --name-status main...HEAD` reviewed
- [ ] No unintended files modified
- [ ] No secrets or credentials exposed in diff
