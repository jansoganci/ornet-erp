# Supabase Advisors Remediation Plan — Ornet ERP

> **Date:** 2026-07-17  
> **Source export:** [`ornet-supabase-advisors.txt`](../../ornet-supabase-advisors.txt) (Dashboard → Advisors)  
> **Severity in export:** all rows are **WARN** (no CRITICAL in this dump)  
> **Purpose:** Document what the export means, prioritize fixes, and sequence remediation. **Planning only — nothing is implemented by this document.**  
> **Related:** [02-security-definer-rpc-audit.md](./02-security-definer-rpc-audit.md), [01-rls-audit.md](./01-rls-audit.md), [CLAUDE.md](../../CLAUDE.md), [supabase/README.md](../../supabase/README.md)  
> **Gates:** Migrations / RLS / RPC grant changes require exact **APPROVE** per AGENTS.md. Auth dashboard toggles do not.

---

## 1. Executive verdict

The Advisors export is a **security hygiene report** from Supabase’s database/auth linter against the live project. It is **not** a claim that the app is fully compromised, and it is **not** a performance report.

**151 findings**, all `WARN` / `EXTERNAL` / `SECURITY`. Roughly **96%** are the same theme repeated once per function:

> A `SECURITY DEFINER` function in `public` is still executable by `anon` and/or `authenticated` via PostgREST (`/rest/v1/rpc/...`).

That matters because `SECURITY DEFINER` runs with the **owner’s privileges** and can bypass table RLS. If the wrong roles can call finance/trigger helpers as RPCs, advisors are correctly flagging a real attack surface — even when severity is labeled WARN.

**Conclusion:** Treat this as a **prioritized hardening backlog**, not as 151 independent bugs. Fix grants and a few concrete policies first; ignore “noise” only after verifying role guards and intended RPC surface.

---

## 2. What this file is (and is not)

### 2.1 Source

| Field | Meaning in this export |
|-------|------------------------|
| `name` | Lint rule id (e.g. `anon_security_definer_function_executable`) |
| `title` | Human title |
| `level` | Here: always `WARN` |
| `facing` | Here: always `EXTERNAL` (reachable from the API surface) |
| `categories` | Here: always `SECURITY` |
| `detail` / `metadata` | Object name (function, table, extension, Auth entity) |
| `remediation` | Link to Supabase linter docs |

### 2.2 Counts by lint rule

| Lint `name` | Count | Short meaning |
|-------------|------:|---------------|
| `anon_security_definer_function_executable` | 74 | `anon` can `EXECUTE` a `SECURITY DEFINER` function |
| `authenticated_security_definer_function_executable` | 72 | `authenticated` can `EXECUTE` a `SECURITY DEFINER` function |
| `extension_in_public` | 2 | `pg_trgm`, `unaccent` installed in `public` |
| `function_search_path_mutable` | 1 | `public.set_proposal_completed_at` lacks fixed `search_path` |
| `rls_policy_always_true` | 1 | `work_orders_insert` uses `WITH CHECK (true)` |
| `auth_leaked_password_protection` | 1 | HaveIBeenPwned leaked-password check disabled in Auth |
| **Total** | **151** | |

### 2.3 Out of scope for this plan

- Performance advisors / index advice (separate audits already exist under `docs/audit-reports/`).
- Rewriting finance posting logic unless a grant fix requires it.
- Deleting unused Paraşüt code (product decision; not required to clear these lints).
- Re-enabling SIM monthly auto-ledger (`00238` disabled it by design).

---

## 3. Why WARN still matters

| Myth | Reality |
|------|---------|
| “Only WARN → ignore” | WARN still means **external** exposure. Severity is not the same as business impact. |
| “RLS protects us” | RLS protects **table** access. `SECURITY DEFINER` RPCs can write as the function owner. |
| “UI never calls that RPC” | The browser holds the **anon** key. Anyone can call PostgREST RPCs the roles are granted. |
| “We already revoked some functions” | Prior migrations (`00225`, `00227`, …) revoked some `authenticated` grants. Advisors still show **`anon`** execute on cron-only helpers — live grants must be re-checked. |

---

## 4. Priority tiers (solve in this order)

### P0 — Essential (do first)

These reduce real abuse potential with clear, reviewable changes.

#### P0-A — Revoke `anon` (and default `PUBLIC`) execute on non-public RPCs

**Problem:** Dozens of `SECURITY DEFINER` functions remain callable with the publishable/anon key.

**Especially dangerous if still callable by `anon` (trigger / cron / internal — not intentional browser RPCs):**

| Function (examples) | Why |
|---------------------|-----|
| `auto_record_proposal_revenue`, `auto_record_work_order_revenue` | Ledger posting triggers |
| `reverse_proposal_finance_entries`, `reverse_work_order_finance_entries` | Finance reversals |
| `fn_subscription_payment_to_finance`, `fn_sim_card_to_finance` | Ledger side-effects |
| `handle_new_user` | Auth bootstrap |
| Notification / reminder / cleanup helpers (`fn_notify_*`, `fn_process_reminders`, `fn_notification_cleanup`, …) | Side-effecting internals |
| `extend_active_subscription_payments`, `fn_generate_recurring_expenses` | Cron/service only (prior revoke targeted `authenticated`; advisors still flag `anon`) |
| `generate_monthly_sim_finance` | Disabled path (`00238`); must not be publicly executable |

**Target end state:**

- Trigger/cron/internal: `EXECUTE` only for `postgres` / `service_role` (and whatever the trigger owner needs).
- Explicit: `REVOKE EXECUTE … FROM PUBLIC, anon` (and from `authenticated` when the function is not an app RPC).

**Prerequisite before migration:** Live grant audit

```sql
SELECT p.proname AS function_name,
       r.rolname AS grantee,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND r.rolname IN ('anon', 'authenticated', 'public', 'service_role')
ORDER BY 1, 2;
```

(Adjust query as needed; goal is a before/after matrix, not a one-liner cargo-cult.)

#### P0-B — Tighten `work_orders` INSERT RLS

**Finding:** Policy `work_orders_insert` on `public.work_orders` for role `authenticated` uses `WITH CHECK (true)`.

**Impact:** Any signed-in user can insert arbitrary work-order rows (customer, amounts, assignees, etc.), subject only to column defaults/constraints — not to a meaningful row check.

**Historical context:** Introduced as “all authenticated can create” in early rebuild migrations (`00009_rebuild_work_orders.sql`).

**Direction (product decision required before SQL):**

1. Prefer: `WITH CHECK (created_by = auth.uid())` plus any role rules the product needs; and/or  
2. Restrict INSERT to roles that should create jobs (`admin` / `accountant` / `field_worker` as decided).

Do **not** “fix” this blindly without confirming field-worker create flows still work.

#### P0-C — Enable Auth leaked-password protection

**Finding:** `auth_leaked_password_protection` — HaveIBeenPwned check disabled.

**Fix:** Supabase Dashboard → Authentication → Providers / Password security (see remediation URL in export). **No migration.** Low effort, clear win.

---

### P1 — Important (after P0)

#### P1-A — Reconcile intentional app RPCs vs advisor noise

Many `authenticated_security_definer_function_executable` rows are **expected** if the SPA legitimately calls those RPCs, for example:

- Completions: `fn_complete_work_order_with_payment`, `complete_proposal_with_rate`
- Payments / write-off: `fn_record_payment`, `fn_write_off_to_finance`, …
- Soft deletes, proposal package save/revise, bulk helpers, read RPCs (`get_*`, `search_*`)

**For each intentional RPC:**

1. Keep `EXECUTE` for `authenticated` only if the app needs it.  
2. Always `REVOKE` from `anon` / `PUBLIC`.  
3. Confirm **in-function role guards** (migrations such as `00225`–`00231` family). If a mutating RPC is callable by `authenticated` but has **no** role check, that is a **P0 bug**, not noise.

**Deliverable:** A short allowlist table: `function → callers (app feature) → roles allowed → guard location`.

#### P1-B — Fix mutable `search_path` on `set_proposal_completed_at`

**Finding:** `function_search_path_mutable` on `public.set_proposal_completed_at`.

**Fix:** Recreate/alter function with `SET search_path = public` (or a locked path). Small migration; low risk if body unchanged.

---

### P2 — Hygiene (defer)

#### P2-A — Move extensions out of `public`

**Findings:** `pg_trgm`, `unaccent` in `public`.

**Why defer:** Search/normalize code may depend on current schema qualification. Moving extensions is operationally fiddly and easy to break Turkish search.

**When:** Separate migration + staging verification of customer/SIM/work-history search.

---

## 5. Proposed implementation batches

| Batch | Scope | Type | APPROVE? | Clears / reduces |
|-------|--------|------|----------|------------------|
| **A0** | Live grant audit + allowlist of intentional RPCs | Ops / doc | No (read-only) | Planning accuracy |
| **A1** | Revoke `anon`/`PUBLIC` (and cron-only `authenticated`) on internal/trigger/cron DEFINER functions | Migration | **YES** | Bulk of 74 anon + part of 72 auth rows |
| **A2** | Auth leaked-password protection ON | Dashboard | No* | 1 Auth lint |
| **A3** | `work_orders_insert` tighten (after product rule) | Migration | **YES** | 1 RLS lint |
| **A4** | `set_proposal_completed_at` fixed `search_path` | Migration | **YES** | 1 search_path lint |
| **A5** | Intentional RPC pass: missing role guards only | Migration(s) + optional app | **YES** | Residual auth DEFINER risk |
| **A6** | Move `pg_trgm` / `unaccent` out of `public` | Migration | **YES** | 2 extension lints |

\*Dashboard change still needs a human to flip the switch in the correct project (staging then prod).

**Suggested order:** A0 → A1 → A2 → A3 → A4 → A5 → A6.

**Branching:** One branch (or worktree) per batch that touches SQL. Do not combine A1+A3+A6 in a single unreviewed migration unless explicitly requested.

---

## 6. Acceptance criteria

Remediation is “done enough” when:

1. Re-export Advisors (or CLI advisors): **anon DEFINER execute** findings are gone for non-allowlisted functions.  
2. Cron-only functions (`extend_active_subscription_payments`, `fn_generate_recurring_expenses`, …) are **not** executable by `anon` or `authenticated`.  
3. Allowlisted app RPCs: still work for `admin` / `accountant` / `field_worker` as designed; `field_worker` cannot call finance mutators.  
4. `work_orders` create flow still works for approved roles after INSERT policy change.  
5. Leaked-password protection enabled on the target Auth project.  
6. `set_proposal_completed_at` no longer flagged for mutable `search_path`.  
7. Extension move (if done): search RPCs/views still return expected Turkish-normalized results.

---

## 7. Risks and constraints

| Risk | Mitigation |
|------|------------|
| Revoking EXECUTE breaks a real SPA call | A0 allowlist + staging smoke per feature |
| Revoking from `authenticated` breaks triggers | Triggers run as owner/definer; prefer revoking API roles, not dropping functions |
| Tight INSERT policy blocks field workers | Product sign-off before A3 |
| Extension schema move breaks `unaccent`/`similarity` calls | Qualify or `SET search_path` in dependent functions; staging only first |
| Partial apply on production | Staging `supabase db push` first; exact APPROVE for prod |

---

## 8. Explicit non-goals (this wave)

- Silencing advisors by converting everything to `SECURITY INVOKER` without understanding callers.  
- Re-opening SIM auto ledger generation.  
- Broad RLS rewrite beyond `work_orders_insert` unless A0 surfaces more always-true policies.  
- Treating remaining `authenticated` DEFINER warnings on **allowlisted, role-guarded** RPCs as must-fix noise after A1/A5.

---

## 9. Next action

When implementation starts:

1. Confirm this plan (especially **A3 product rule** for work-order insert).  
2. Run **Batch A0** (grant audit + RPC allowlist) and attach results to this folder or a short follow-up note.  
3. Request exact **APPROVE** for **Batch A1** migration only.

Until then, this document is the single planning source for clearing `ornet-supabase-advisors.txt`.
