# AGENTS.md — Ornet ERP

Read this first before touching the repo. Ornet ERP is a Turkish security company ERP;
this file is the compact entrypoint for AI agents. Do not duplicate rules here: read
the referenced `.hermes/*` and `CLAUDE.md` files before planning or editing.

## Project Identity

- **Project:** Ornet ERP
- **Domain:** Turkish security company ERP
- **Business modules:** work orders, finance ledger, proposals, subscriptions, SIM inventory, customer management
- **Stack:** React 19 + Vite 7.2 + JavaScript JSX
- **Language:** JavaScript only; no TypeScript migration unless explicitly approved
- **Backend:** Supabase, no ORM
- **Styling:** Tailwind CSS v4
- **Hosting:** Cloudflare Pages
- **Deploy tooling:** Wrangler
- **User-facing text:** Turkish
- **Technical names/code/comments:** English unless existing code uses Turkish

## First-Read Order

Before any change, read these files in order:

1. `AGENTS.md`
2. `.hermes/README.md`
3. `.hermes/project-rules.md`
4. `.hermes/agent-rules.md`
5. `.hermes/review-checklists.md`
6. `CLAUDE.md`
7. Relevant source files for the requested task

If any rule conflicts, prefer the more specific/local rule. If still unclear, stop and ask.

## Core Safety Rules

- **Default mode is PLAN_ONLY for all new tasks. Implementation starts only after exact APPROVE.**
- **APPROVE:** Wait for explicit approval before edits.
- **APPROVE MERGE:** Never merge branches without explicit `APPROVE MERGE`.
- No "quick fix" patches that bypass architecture, validation, permissions, or domain rules.
- No unrelated edits, formatting churn, dependency upgrades, route rewrites, or refactors.
- No unapproved database migrations, schema edits, RLS policy changes, or seed changes.
- Do not touch secrets, `.env` values, Supabase keys, or deployment credentials.
- Preserve existing user changes. Never reset, checkout, or overwrite work you did not make.
- Keep changes scoped to the user request and the agent role.

## Git Workflow

- For implementation tasks, always use a separate branch or worktree unless the user explicitly says this is a documentation-only or analysis-only task. Never modify main/master directly.
- Keep branch changes isolated to the requested task.
- Before editing, inspect status/diff enough to avoid overwriting user work.
- After editing, report: changed files, important behavior changes, tests/checks run, tests/checks not run and why.
- For review tasks, inspect diffs first and prioritize bugs, regressions, security, data loss.
- Do not commit, push, merge, rebase, or force-push unless explicitly requested.

## Agent Boundaries

### UI Agent
Owns: React components, page layouts, Tailwind styling, form UX, Turkish copy
Does not own: Supabase schema/RLS, finance calculations, auth/session semantics, deploy config

### API Agent
Owns: Supabase client calls, service modules, data loading/mutation flows, edge functions
Does not own: DB schema changes without approval, RLS policy changes, UI redesigns outside scope

### DB Agent
Owns only with explicit approval: migrations, tables/views/functions, RLS policies, indexes, constraints
Must: explain migration intent, identify rollback risk, preserve production data assumptions

### Auth Agent
Owns: login/logout flows, session handling, route guards, role/permission checks
Does not own: RLS changes without approval, weakening auth checks for convenience

### Reviewer Agent
Owns: code review, risk analysis, checklist-based inspection, regression identification
Must: lead with findings, include file/line references, avoid rewriting unless asked

### Fixer Agent
Owns: targeted fixes for confirmed issues, minimal patches, verification
Must not: broaden scope, redesign unrelated areas, hide debt behind temporary patches

## High-Risk Areas

- **Finance ledger:** balances, transactions, invoices, payments, rounding, reporting
- **Database migrations:** destructive changes, constraints, defaults, backfills
- **RLS/security:** policies, role checks, tenant/customer boundaries
- **Subscriptions:** renewal logic, billing periods, status transitions
- **SIM inventory:** stock state, assignment history
- **i18n/Turkish copy:** user-facing text must be clear Turkish and domain-appropriate
- **Deploy:** Cloudflare Pages, Wrangler config, build output, env binding assumptions

## Existing Rule Files

Use as source of truth instead of duplicating:
- `.hermes/README.md` — directory overview
- `.hermes/project-rules.md` — stack, architecture, forbidden actions, build commands
- `.hermes/agent-rules.md` — agent ownership boundaries
- `.hermes/review-checklists.md` — domain-specific review checklists
- `CLAUDE.md` — comprehensive project rules, finance architecture, routes, DB schema

## External State

Hermes uses `.hermes/hermes-state.json` to persist workflow state across sessions.

- Created per PLAN_ONLY task.
- Updated on every phase change.
- Read at session start if the file exists.
- Runtime file — do not commit to git (already in .gitignore).
- Lock file: `.hermes/hermes-state.lock` (also gitignored).

## Output Expectations

Before edits: summarize understanding, list files likely to change, call out risks, wait if approval required.
After edits: list changed files, summarize what changed, list verification performed, list remaining risks.

## Stop Conditions

Stop and ask before continuing if:
- rules conflict
- required approval is missing
- task requires secrets or production access
- requested change weakens security or accounting integrity
- migrations/RLS/deploy changes are needed but not approved
- user changes make the requested edit unsafe to apply
