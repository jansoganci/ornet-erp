# Skill: /audit — Code Audit (18 Rules)

## Description
Systematically audits code against all 18 audit-derived coding rules from CODING-LESSONS.md, plus the 4 finance architecture rules. Produces a pass/fail checklist with exact file:line references for every violation found.

## Triggers
- User says "audit this", "review this code", "check for bugs", "run the rules"
- User asks to review a file, feature, or PR before merging

## Inputs
- **Target**: A file path, feature name, or "all changed files" (uses git diff)
- (Optional) **Scope**: "full" (all 18 rules) or specific rule numbers

## Workflow

### Step 1 — Determine scope
- If a single file: audit that file
- If a feature name: audit all files in `src/features/{name}/`
- If "changed" or no target: run `git diff --name-only` to get modified files
- Read ALL target files before starting the checklist

### Step 2 — Run the 18-rule checklist

For EACH target file, check every applicable rule. Mark as PASS, FAIL (with file:line), or N/A.

#### Rule 1: React Query — Invalidate scoped keys
- [ ] Every `useMutation.onSuccess` invalidates ALL query keys that depend on the mutated data
- [ ] Both `lists()` and `detail(id)` keys invalidated on update/delete
- [ ] No stale cache after create/update/delete operations
- Look in: `hooks.js`

#### Rule 2: Dates — UTC-safe construction
- [ ] No `new Date('YYYY-MM-DD')` without `T00:00:00Z` suffix
- [ ] No timezone-dependent date arithmetic
- [ ] `date-fns` used for formatting/manipulation
- Look in: any file with date logic

#### Rule 3: Navigation — No window.location
- [ ] All navigation uses `useNavigate()` from React Router
- [ ] No `window.location.href`, `window.location.assign`, `window.location.replace`
- Look in: page components, form submit handlers

#### Rule 4: Errors — No raw error messages
- [ ] Error toasts use `t('common:errors.*')` keys
- [ ] No `err?.message`, `error.message`, or raw string in `toast.error()`
- Look in: mutation `onError`, catch blocks

#### Rule 5: Null guards — ?. and ?? on nullable fields
- [ ] String methods (`.trim()`, `.toLowerCase()`, `.split()`) guarded with `?.`
- [ ] Array methods (`.map()`, `.filter()`, `.length`) guarded with `?.`
- [ ] No bare property access on DB query results without `?.`
- Look in: components rendering DB data

#### Rule 6: isNaN — Use global isNaN, not Number.isNaN
- [ ] Date validity checks use `isNaN(date.getTime())`, not `Number.isNaN(date)`
- [ ] `Number.isNaN` is only used for actual number checks, never dates
- Look in: date validation logic

#### Rule 7: Form submit — handleSubmit on form OR button, not both
- [ ] `onSubmit={handleSubmit(onSubmit)}` is on the `<form>` element only
- [ ] Submit `<Button>` has `type="submit"` but NO `onClick={handleSubmit(...)}`
- [ ] OR: no `<form>`, and `onClick={handleSubmit(onSubmit)}` on button only
- Look in: form page components

#### Rule 8: Auth guards — Check isLoading, then !profile, then role
- [ ] Auth-protected logic checks `isLoading` first (show spinner)
- [ ] Then checks `!profile` (redirect to login)
- [ ] Then checks `profile.role` (show forbidden or redirect)
- [ ] Never assumes profile is non-null without the loading check
- Look in: protected routes, role-gated components

#### Rule 9: RHF setValue — Call for all external field updates
- [ ] When setting form values from external data (fetch, modal callback, etc.), `setValue()` is called
- [ ] Not relying on `defaultValues` alone when data arrives async
- [ ] `reset()` is used when the entire form needs to be repopulated
- Look in: form pages with async data loading

#### Rule 10: API layer — No Supabase in components or hooks
- [ ] `supabase` is never imported in page components
- [ ] `supabase` is never imported in hooks.js
- [ ] All Supabase calls are in `api.js` files only
- Look in: imports at top of every file

#### Rule 11: Month display — getMonth() + 1
- [ ] `getMonth()` result is never used directly as a display month
- [ ] Either `+ 1` is applied or `date-fns format()` is used
- Look in: date display logic

#### Rule 12: useEffect — No racing effects
- [ ] Multiple related `useEffect` hooks are merged into one with branching
- [ ] No two effects that write to the same state
- [ ] Cleanup functions present where needed (subscriptions, timers)
- Look in: components with multiple useEffect calls

#### Rule 13: Multi-step writes — Inform user of partial failure
- [ ] Operations that make multiple API calls handle partial failure
- [ ] User is informed which steps succeeded and which failed
- [ ] Not a silent catch-all that hides partial success
- Look in: mutation handlers with multiple sequential calls

#### Rule 14: Role-gated queries — Use enabled option
- [ ] Queries for admin/accountant data use `enabled: isAdmin` or equivalent
- [ ] Sensitive data is never fetched for unauthorized roles
- [ ] `useRole()` is imported from `@/lib/roles.js`
- Look in: hooks.js with role-dependent data

#### Rule 15: Realtime — Channels in api.js only
- [ ] `supabase.channel()` calls are in api.js, not in components
- [ ] Channel setup/teardown is properly exported as functions
- Look in: any realtime subscription code

#### Rule 16: Page components — Never import supabase directly
- [ ] Same as Rule 10 but specifically for page-level components
- [ ] Pages only import from hooks.js, not api.js or supabase.js
- Look in: page component imports

#### Rule 17: Dead imports — Remove immediately
- [ ] No unused imports at the top of any file
- [ ] No commented-out imports
- Look in: all files

#### Rule 18: Proposal/WO finance trigger guard
- [ ] `auto_record_work_order_revenue` has the `IF NEW.proposal_id IS NOT NULL THEN RETURN NEW` guard
- [ ] This guard is never removed, commented out, or bypassed
- [ ] Proposal-linked WO revenue goes through `auto_record_proposal_revenue` only
- Look in: SQL migrations, trigger functions

### Step 3 — Check finance architecture rules (if applicable)

Only check these if the target files touch finance, subscriptions, proposals, or work orders:

#### Finance Rule A: financial_transactions is single source of truth
- [ ] No direct queries to `subscription_payments` for financial aggregation
- [ ] All financial reporting reads from `financial_transactions`

#### Finance Rule B: Dynamic vat_rate
- [ ] No hardcoded `0.20`, `20`, or `0.18` for VAT
- [ ] `vat_rate` read from the record (subscription, transaction, etc.)

#### Finance Rule C: Amounts are NET
- [ ] `base_price`, `sms_fee`, `line_fee` treated as NET (KDV haric)
- [ ] VAT calculated as `ROUND(subtotal * vat_rate / 100, 2)`

#### Finance Rule D: Proposal/WO guard clause
- [ ] Same as Rule 18 — guard clause intact in trigger

### Step 4 — Check general quality

- [ ] i18n: No hardcoded Turkish strings
- [ ] Dark mode: Every visual element has `dark:` variant
- [ ] Mobile: Responsive breakpoints applied (not desktop-only layouts)
- [ ] Loading state: Spinner or Skeleton shown while fetching
- [ ] Error state: ErrorState component used on fetch failure
- [ ] Empty state: EmptyState component used when no data
- [ ] Search: Turkish text search uses `normalizeForSearch`

### Step 5 — Output the report

```
## Audit Report: {target}

### Summary
- Rules checked: X/18
- Passed: X
- Failed: X
- N/A: X

### Failures

#### Rule {N}: {Rule Name} — FAIL
- **File**: `src/features/x/hooks.js:42`
- **Issue**: [description]
- **Fix**: [specific fix]

### Warnings
[Non-critical issues, style suggestions]

### Passed Rules
[List of passed rules — brief, one line each]
```

## Rules
- NEVER skip a rule — check all 18 systematically
- ALWAYS provide file:line references for failures
- ALWAYS suggest the specific fix, not just "fix this"
- If a rule is not applicable to the target file, mark N/A with a reason
- Read the FULL file before auditing — don't audit based on assumptions
