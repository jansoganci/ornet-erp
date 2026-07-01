AGENTS.md — Ornet ERP

Read this first before touching the repo. Ornet ERP is a Turkish security company ERP.
This file is the compact entrypoint for AI agents. Do not duplicate rules here: read
the referenced .hermes/* and CLAUDE.md files before planning or editing.

Project Identity

* Project: Ornet ERP
* Domain: Turkish security company ERP
* Business modules: work orders, finance ledger, proposals, subscriptions, SIM inventory, customer management
* Stack: React 19 + Vite 7 + JavaScript JSX
* Language: JavaScript only; no TypeScript migration unless explicitly approved
* Backend: Supabase, no ORM
* Styling: Tailwind CSS v4
* Hosting: Cloudflare Pages
* Deploy tooling: Wrangler
* User-facing text: Turkish
* Technical names/code/comments: English unless existing code uses Turkish

First-Read Order

Before any change, read these files in order:

1. AGENTS.md
2. .hermes/README.md
3. .hermes/project-rules.md
4. .hermes/agent-rules.md
5. .hermes/review-checklists.md
6. CLAUDE.md
7. Relevant source files for the requested task

If any rule conflicts, prefer the more specific/local rule. If still unclear, stop and ask.

Operating Mode

Agents must not waste tokens by giving a full written answer in chat and then writing the same content into a file.

There are two modes:

PLAN_ONLY Mode

Use PLAN_ONLY only when the user asks for:

* analysis
* audit
* review
* investigation
* explanation
* planning
* risk assessment
* comparison
* recommendation

In PLAN_ONLY mode:

* Read and inspect the repo.
* Summarize findings in chat.
* Do not edit files unless the user asks for an edit.
* If the user later asks to write the findings into a file, write the file directly instead of repeating the full findings in chat.

EXECUTE Mode

Use EXECUTE mode when the user explicitly asks to do the work, for example:

* yap
* başla
* uygula
* düzenle
* değiştir
* dosyayı değiştir
* dokümana yaz
* dosya oluştur
* write the file
* create the document
* apply the change
* implement this
* similar natural-language instructions

For normal, non-destructive code or documentation edits, these natural-language commands are valid approval.

Do not stop and ask for exact APPROVE again when the user has already clearly requested the edit.

Approval Rules

Natural-Language Approval Is Enough For Normal Edits

The user’s clear instruction to perform a normal edit is enough approval.

Examples of normal edits:

* creating or updating documentation under docs/
* updating markdown notes
* adding an analysis document
* fixing UI copy
* making a scoped React/component change
* making a scoped service/API change that does not alter schema, RLS, secrets, deploy, or production data
* applying a targeted bug fix inside the requested scope

For these tasks, proceed after the user says to do it. Do not require exact APPROVE.

Exact APPROVE Is Required Only For High-Risk Actions

Require exact APPROVE before:

* database migrations
* schema changes
* table/view/function/RPC changes
* RLS/security policy changes
* destructive edits
* data backfills
* seed changes
* dependency upgrades
* route rewrites
* broad refactors
* deploy configuration changes
* production-impacting changes
* changes involving secrets, .env, Supabase keys, or credentials

If the task requires any of these, explain the risk briefly and wait for exact APPROVE.

Exact APPROVE MERGE Is Required For Merge

Never merge branches without explicit:

APPROVE MERGE

This is separate from normal edit approval.

Git Actions Need Explicit Request

Do not commit, push, merge, rebase, or force-push unless the user explicitly asks for that exact git action.

Core Safety Rules

* No “quick fix” patches that bypass architecture, validation, permissions, or domain rules.
* No unrelated edits, formatting churn, dependency upgrades, route rewrites, or refactors.
* No unapproved database migrations, schema edits, RLS policy changes, or seed changes.
* Do not touch secrets, .env values, Supabase keys, or deployment credentials.
* Preserve existing user changes. Never reset, checkout, or overwrite work you did not make.
* Keep changes scoped to the user request and the agent role.
* If the user asks for a document/file to be written, write the detailed content into the file and keep the chat response short.
* Do not paste the full document into chat before writing it unless the user explicitly requests that.
* Do not duplicate the same long content in both chat and a file unless explicitly requested.

Git Workflow

* For implementation tasks, use a separate branch or worktree unless the user explicitly says this is a documentation-only, analysis-only, or small scoped change.
* Never modify main/master directly for risky implementation work unless the user explicitly requests it.
* Keep branch changes isolated to the requested task.
* Before editing, inspect status/diff enough to avoid overwriting user work.
* After editing, report:
    * changed files
    * important behavior changes
    * tests/checks run
    * tests/checks not run and why
* For review tasks, inspect diffs first and prioritize bugs, regressions, security, and data loss.
* Do not commit, push, merge, rebase, or force-push unless explicitly requested.

Agent Boundaries

UI Agent

Owns:

* React components
* page layouts
* Tailwind styling
* form UX
* Turkish copy

Does not own:

* Supabase schema/RLS
* finance calculations
* auth/session semantics
* deploy config

API Agent

Owns:

* Supabase client calls
* service modules
* data loading/mutation flows
* edge functions

Does not own:

* DB schema changes without approval
* RLS policy changes
* UI redesigns outside scope

DB Agent

Owns only with exact approval:

* migrations
* tables/views/functions
* RLS policies
* indexes
* constraints

Must:

* explain migration intent
* identify rollback risk
* preserve production data assumptions

Auth Agent

Owns:

* login/logout flows
* session handling
* route guards
* role/permission checks

Does not own:

* RLS changes without approval
* weakening auth checks for convenience

Reviewer Agent

Owns:

* code review
* risk analysis
* checklist-based inspection
* regression identification

Must:

* lead with findings
* include file/line references
* avoid rewriting unless asked

Fixer Agent

Owns:

* targeted fixes for confirmed issues
* minimal patches
* verification

Must not:

* broaden scope
* redesign unrelated areas
* hide debt behind temporary patches

High-Risk Areas

Treat these areas carefully and require exact APPROVE when the change can affect data, security, accounting integrity, or production behavior:

* Finance ledger: balances, transactions, invoices, payments, rounding, reporting
* Database migrations: destructive changes, constraints, defaults, backfills
* RLS/security: policies, role checks, tenant/customer boundaries
* Subscriptions: renewal logic, billing periods, status transitions
* SIM inventory: stock state, assignment history
* i18n/Turkish copy: user-facing text must be clear Turkish and domain-appropriate
* Deploy: Cloudflare Pages, Wrangler config, build output, env binding assumptions

Documentation and Audit Output Rules

When the user asks for an audit, analysis, or investigation:

* If no file output is requested, provide the findings in chat.
* If a file output is requested, write the findings into the requested file.
* If the user says dokümana yaz, dosya oluştur, write this into docs, or similar, do not ask for exact APPROVE for documentation-only work.
* Do not first dump the full audit in chat and then write the same audit into a file.
* In chat, give only:
    * where the file was written
    * short summary of major findings
    * any unresolved gaps
    * checks performed/not performed

Existing Rule Files

Use as source of truth instead of duplicating:

* .hermes/README.md — directory overview
* .hermes/project-rules.md — stack, architecture, forbidden actions, build commands
* .hermes/agent-rules.md — agent ownership boundaries
* .hermes/review-checklists.md — domain-specific review checklists
* CLAUDE.md — comprehensive project rules, finance architecture, routes, DB schema

External State

Hermes uses .hermes/hermes-state.json to persist workflow state across sessions.

* Created per PLAN_ONLY task.
* Updated on every phase change.
* Read at session start if the file exists.
* Runtime file — do not commit to git.
* Lock file: .hermes/hermes-state.lock.
* Both files should remain gitignored.

Output Expectations

Before Edits

If the task is high-risk:

* summarize understanding
* list files likely to change
* call out risks
* wait for exact APPROVE

If the task is a normal documentation/code edit and the user already clearly said to do it:

* do not stop for approval
* proceed with the scoped change
* keep progress updates short

During Long Tasks

* Give short progress updates only when useful.
* Do not paste large intermediate reports unless requested.
* Prefer writing detailed findings to the requested document/file.

After Edits

Report:

* changed files
* concise summary of what changed
* verification performed
* checks not run and why
* remaining risks or gaps

Do not duplicate the full changed document in chat unless explicitly requested.

Stop Conditions

Stop and ask before continuing only if:

* rules conflict
* exact approval is missing for a high-risk action
* task requires secrets or production access
* requested change weakens security or accounting integrity
* migrations/RLS/deploy changes are needed but not explicitly approved
* user changes make the requested edit unsafe to apply
* the requested scope is unclear enough that proceeding risks unrelated edits