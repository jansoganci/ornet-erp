# Ornet ERP Agent Rules

## General Rules

- Every implementation starts with a plan — no exceptions
- Code-writing agents and review agents are always separate
- Implementation happens on isolated git branches only (hermes/*)
- Quick Fix bypass is disabled — even 1-line changes require PLAN_ONLY mode

## Agent Ownership

### Frontend / UI Agent
- Owns: `src/features/*/components/`, `src/components/`, `src/features/*/{Name}Page.jsx`, `src/styles/`
- Responsibilities: React components, Tailwind classes, responsive layout, page views, modals, routing
- May modify: Any `.jsx`, `.css` file within owned paths
- Must NOT modify: `api.js`, `hooks.js`, `schema.js`, `supabase/migrations/`, route definitions in `App.jsx` without explicit approval

### API / Service Agent
- Owns: `src/features/*/api.js`, `src/features/*/hooks.js`
- Responsibilities: Supabase queries, React Query hooks, query key factories, data fetching patterns
- Must check auth context and RLS assumptions when writing queries
- Must NOT modify: UI components, migrations, route definitions

### Schema / Database Agent
- Owns: `supabase/migrations/`, `src/features/*/schema.js`
- Responsibilities: SQL migrations, Zod schemas, RLS policies, trigger functions
- Must check latest migration number before creating new migration
- Must NOT modify: Application code, UI components
- Database changes always require extra review

### Auth Agent
- Owns: `src/features/auth/`, `src/lib/roles.js`, protected route configurations
- Responsibilities: Auth flows, role checks, session management, permission-sensitive components
- All auth changes require explicit approval before implementation

### Finance Calculator / Reviewer
- Finance logic changes (financial_transactions, payment calculations, VAT) require:
  - Separate implementation and review agents
  - Manual inspection of calculations
  - Approval before merge

### i18n Agent
- Owns: `src/locales/tr/*.json`, `src/locales/en/*.json`
- Responsibilities: Translation JSON files, adding new keys, ensuring Turkish primary
- Must NEVER hardcode Turkish strings in components

## Parallel Work Rules

- Max 3 agents running concurrently
- No two agents may write the same file in the same batch
- Use git worktrees for truly independent parallel work
- Shared files (App.jsx, i18n index) require single-owner coordination

## Review Requirements

- Reviewer agents are READ_ONLY by default
- Reviewer may run: `git diff`, `npm run build`, `npm run lint`, file inspection
- Reviewer must NOT: edit any file, create new files, run destructive commands
- Reviewer returns findings with severity, file paths, and reproduction steps

## Handoff Requirements

1. Implementation agent completes assigned changes
2. Orchestrator checks `git diff --stat`
3. Reviewer inspects diff + relevant source files
4. Reviewer returns findings
5. Orchestrator creates fix packet if needed
6. Fixer agent applies targeted fixes (not original agent for simple bugs)
7. Max 2 fix rounds before escalation

## External State

Hermes workflow state is stored in `.hermes/hermes-state.json`. This file is runtime-only and must not be modified by sub-agents. Only the Orchestrator writes to it. Sub-agents should not read or write this file.
