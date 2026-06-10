# Supabase Query Optimization Scan

You are a Supabase/PostgreSQL performance expert. Scan the Ornet ERP codebase for ALL Supabase query patterns and identify optimization opportunities.

## What to Scan

1. **All `src/` files** — especially `src/features/*/api.js` and `src/features/*/hooks.js`
2. **All `supabase/migrations/`** — check for missing indexes, inefficient views
3. **Any edge functions** under `supabase/functions/`

## What to Report (per finding)

For each query found, report:

### LOCATION
- File path, line number
- The actual query (copy the relevant `.from()`, `.select()`, `.eq()`, etc.)

### ANALYSIS
- **What it does** (1 sentence)
- **N+1 risk?** — is it called in a loop (useQuery inside map, forEach)?
- **Over-fetching?** — `select('*')` when only 2-3 columns needed?
- **Missing filter?** — no `.eq('tenant_id', ...)` or `.eq('company_id', ...)`, `.range()`, `.limit()`?
- **Missing index?** — check if the WHERE/ORDER BY columns have indexes in migrations
- **Inefficient join/view?** — could be simplified or materialized?
- **RLS overhead?** — complex RLS policies that scan full tables?

### De-duplication
Group identical or near-identical queries. Flag if the same query exists in multiple files.

### Priority
- HIGH: N+1, full table scan on large tables, missing RLS filters
- MEDIUM: over-fetching, missing limit/pagination, no index
- LOW: cosmetic, single-use small table queries

## Output Format

Return a structured markdown report with:
1. **Summary** — total queries found, by module, HIGH/MEDIUM/LOW count
2. **Per-file findings** — grouped by file path, each finding with line refs
3. **Top 5 priority fixes** — ranked by impact
4. **Quick wins** — 1-line changes that save immediately

Be thorough. Read every api.js and hooks.js file. This is a Turkish security company ERP — tables like `financial_transactions`, `work_orders`, `proposals`, `customers`, `subscriptions`, `sim_cards` are critical and may have heavy usage.
