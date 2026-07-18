# Supabase Advisors — Per-Object Usage Analysis

> **Date:** 2026-07-17  
> **Source:** [`ornet-supabase-advisors.txt`](../../ornet-supabase-advisors.txt)  
> **Companion plan:** [11-supabase-advisors-remediation-plan.md](./11-supabase-advisors-remediation-plan.md)  
> **Method:** Cross-check each flagged object against `src/**` (`supabase.rpc` / `.from`), `supabase/migrations/**` (triggers, cron, grants), and `supabase/functions/**`.  
> **Status:** Analysis only — no schema changes in this document.

---

## 0. How to read this report

Each finding uses:

| Field | Meaning |
|-------|---------|
| **Object** | Function / policy / extension / Auth setting |
| **Usages found** | File paths + lines (repo evidence) |
| **Context** | Frontend RPC · Trigger · Cron · Edge · RLS helper · Dead |
| **Intentional?** | Yes / No / Unclear |
| **Recommendation** | Keep / revoke / tighten / drop / dashboard |

**Global fact:** Postgres grants `EXECUTE` to `PUBLIC` by default on new functions. Advisors flag that surface. Trigger/cron functions do **not** need `anon` or `authenticated` execute — the trigger owner / `postgres` / `service_role` still runs them after revoke.

---

## 1. Executive verdict (after code search)

| Bucket | Count (approx.) | Meaning |
|--------|----------------:|---------|
| **A — Trigger / internal only** | ~28 | Designed as side-effect helpers; **anon+authenticated EXECUTE is a grant leak**, not product intent |
| **B — Cron / scheduled** | ~6 | Same: must not be browser-callable |
| **C — Edge (`service_role`)** | 1 | `extend_active_subscription_payments` — keep for service_role only |
| **D — Intentional SPA RPCs** | ~39 | Called from `src/features/**/api.js`; keep `authenticated` if role-guarded; **always revoke `anon`** |
| **E — Dead / unused / broken** | 3 | `get_customer_work_history`, `fn_upsert_site_asset` (singular), possibly unused `ensure_payments_for_year` from UI |
| **F — Special keep** | 1 | `get_my_role` — RLS/helper; revoke **anon only** |
| **Non-RPC** | 4 lint types | INSERT policy, Auth toggle, search_path regression, extensions |

**Bottom line:** Most WARN rows are the same root cause (`SECURITY DEFINER` + over-broad EXECUTE). The dangerous ones are **finance/trigger/cron functions still executable as HTTP RPCs**. Frontend RPCs are mostly intentional design with later role guards — still revoke `anon`.

---

## 2. Bucket A — Trigger / internal (revoke `anon` + `authenticated`)

These are **not** called via `supabase.rpc` from `src/`. They run from triggers (or as helpers of triggers).

### 2.1 Finance posting / reversal

#### Object: `auto_record_proposal_revenue`
- **Usages found:** Trigger `trg_auto_record_proposal_revenue` — `supabase/migrations/00045_auto_revenue_proposal_wo.sql` (~L117–120). Body later updated through `00246_proposal_material_only_cogs_guard.sql`.
- **Context:** Trigger on `proposals` (AFTER UPDATE → completed).
- **Intentional?** Yes (ledger design).
- **Recommendation:** **Fix grant.** `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. Keep function for trigger. Do not call from app.

#### Object: `auto_record_work_order_revenue`
- **Usages found:** Trigger `trg_auto_record_work_order_revenue` — `00046_auto_revenue_work_order.sql` (~L102–105); body latest family includes `00247_work_order_revenue_type_alignment.sql`.
- **Context:** Trigger on `work_orders` (standalone complete).
- **Intentional?** Yes.
- **Recommendation:** Same revoke as above.

#### Object: `reverse_proposal_finance_entries`
- **Usages found:** Trigger `proposal_finance_reversal` — `00190_financial_reversal_on_status_change.sql` (~L462–545); WHEN clause refreshed in `00251_proposal_revised_status_and_revision_finalize.sql` (~L129–132).
- **Context:** Trigger on `proposals` status leave-completed.
- **Intentional?** Yes.
- **Recommendation:** Revoke `anon` + `authenticated`.

#### Object: `reverse_work_order_finance_entries`
- **Usages found:** Trigger `work_order_finance_reversal` — `00190_financial_reversal_on_status_change.sql` (~L370–456).
- **Context:** Trigger on `work_orders`.
- **Intentional?** Yes.
- **Recommendation:** Revoke `anon` + `authenticated`.

#### Object: `fn_subscription_payment_to_finance`
- **Usages found:** Trigger `trg_subscription_payment_to_finance` — `00050_subscription_payment_to_finance.sql` (~L134–137); body latest `00201_fix_subscription_payment_trigger_vat_logic.sql`.
- **Context:** Trigger on `subscription_payments` UPDATE → paid.
- **Intentional?** Yes (core income path).
- **Recommendation:** Revoke `anon` + `authenticated`. **High priority** if still anon-callable.

#### Object: `fn_sim_card_to_finance`
- **Usages found:** Trigger `trg_sim_card_to_finance` — `00058_sim_card_to_finance.sql` (~L152–155); body latest `00182_fix_sim_vat_logic_comprehensive.sql`. **No DROP TRIGGER** in later migrations.
- **Context:** Per-row SIM status/finance trigger (distinct from disabled monthly batch).
- **Intentional?** Yes historically; **not** disabled by `00238` (only `generate_monthly_sim_finance` was). Product should confirm this per-row path is still wanted.
- **Recommendation:** Revoke API roles. Separately decide whether trigger itself should stay (product).

#### Object: `fn_write_off_to_finance`
- **Usages found:** Trigger `trg_write_off_to_finance` — `00180_write_off_to_finance.sql` (~L119–122).
- **Context:** Trigger on `subscription_payments`.
- **Intentional?** Yes.
- **Recommendation:** Revoke `anon` + `authenticated`.

#### Object: `fn_update_payment_status`
- **Usages found:** Trigger on `financial_transaction_payments` — `00212_tahsilat_core.sql` (~L141–143).
- **Context:** Trigger (payment-status recalc).
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_update_transaction_payment_status`
- **Usages found:** Trigger — `00207_fix_pl_view_and_hybrid_payment_schema.sql` (~L181–183). Note: related naming overlap with `fn_update_payment_status` from `00212` — verify live DB has intended single/dual triggers.
- **Context:** Trigger.
- **Intentional?** Yes (hybrid payment model).
- **Recommendation:** Revoke API roles; optionally audit duplicate triggers in staging.

#### Object: `site_has_active_subscription`
- **Usages found:** Helper inside `fn_sim_card_to_finance` body — `00058_sim_card_to_finance.sql` (~L19–22, L113); later rewrites `00061`, `00062`, `00063`, `00154`, `00155`, `00182`.
- **Context:** Internal SQL helper (not frontend).
- **Intentional?** Yes.
- **Recommendation:** Revoke `anon` + `authenticated`.

---

### 2.2 Auth / audit / ops sync triggers

#### Object: `handle_new_user`
- **Usages found:** Trigger `on_auth_user_created` AFTER INSERT ON `auth.users` — `00001_profiles.sql` (~L47–49).
- **Context:** Auth bootstrap → `profiles` row.
- **Intentional?** Yes.
- **Recommendation:** Revoke `anon` + `authenticated`. **Must never be a public RPC.**

#### Object: `log_work_order_audit`
- **Usages found:** Trigger `trg_audit_work_orders` — `00162_work_orders_audit_logs.sql` (~L85–88).
- **Context:** Trigger on `work_orders`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_sync_work_order_to_operations`
- **Usages found:** Trigger `trg_sync_work_order_to_operations` — `00184_sync_work_order_to_operations.sql` (~L77–80).
- **Context:** Trigger on `work_orders`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_subscription_sim_status_on_insert` / `fn_subscription_sim_status_on_update`
- **Usages found:** Triggers `trg_subscription_sim_insert` / `trg_subscription_sim_update` — `00055_subscription_sim_card_link.sql` (~L40–42, L74–76); update path also `00153_auto_update_sim_status.sql`.
- **Context:** Triggers on `subscriptions`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_set_subscription_parasut_ready`
- **Usages found:** Trigger `trg_set_subscription_parasut_ready` — `00217_parasut_sync_status.sql` (~L80–84).
- **Context:** Trigger on `financial_transactions`.
- **Intentional?** Yes (Paraşüt prep).
- **Recommendation:** Revoke API roles.

#### Object: `fn_upsert_site_assets_from_rental_proposal`
- **Usages found:** Trigger `trg_upsert_site_assets_from_rental_proposal` — `00158_phase3_rental_proposal_site_assets_trigger.sql` (~L77–80).
- **Context:** Trigger on `work_orders`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

---

### 2.3 Notification triggers (`fn_notify_*` and resolve-on-close)

#### Object: `fn_notify_subscription_status_change`
- **Usages found:** Trigger — `00065_notification_triggers.sql` (~L72–74).
- **Context:** Trigger on `subscriptions`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_notify_work_order_assigned`
- **Usages found:** Trigger AFTER INSERT ON `work_orders` — `00065_notification_triggers.sql` (~L114–116).
- **Context:** Trigger.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_notify_work_order_completed`
- **Usages found:** Trigger — `00166_notify_work_order_completed.sql` (~L88–95).
- **Context:** Trigger on `work_orders`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_notify_sim_card_cancelled`
- **Usages found:** Trigger — `00069_sim_card_cancel_notification.sql` (~L80–82).
- **Context:** Trigger on `sim_cards`.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_resolve_notification_on_entity_close`
- **Usages found:** Three triggers (work_orders, tasks, subscription_payments) — `00065_notification_triggers.sql` (~L160–172).
- **Context:** Triggers.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.  
  *(Distinct from SPA RPC `fn_resolve_notification` — see Bucket D.)*

---

## 3. Bucket B — Cron / scheduled (revoke `anon` + `authenticated`)

#### Object: `fn_create_scheduled_notifications`
- **Usages found:** pg_cron `notification-daily-check` — `00067_notification_cron.sql` (~L196–200).
- **Context:** Cron.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles; cron runs as postgres.

#### Object: `fn_process_reminders`
- **Usages found:** pg_cron `notification-reminder-check` — `00067_notification_cron.sql` (~L202–206).
- **Context:** Cron (hourly).
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_notification_cleanup`
- **Usages found:** pg_cron `notification-cleanup-monthly` — `00067_notification_cron.sql` (~L208–212).
- **Context:** Cron.
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_create_pending_payments_summary_notification`
- **Usages found:** pg_cron `pending-payments-summary` — `00149_pending_payments_summary_notification.sql` (~L84–88).
- **Context:** Cron (25th of month).
- **Intentional?** Yes.
- **Recommendation:** Revoke API roles.

#### Object: `fn_generate_recurring_expenses`
- **Usages found:** Cron `recurring-expenses-daily` — `00070_recurring_expenses.sql` (~L302–306). **Already** `REVOKE` from `PUBLIC`/`authenticated`, grant `postgres`/`service_role` — `00225_finance_rpc_role_guards.sql` (~L270–274), reasserted `00244`. SPA uses **`fn_generate_recurring_expenses_guarded`** instead — `src/features/finance/recurringApi.js` (~L141).
- **Context:** Cron (+ guarded wrapper for UI).
- **Intentional?** Yes; partial hardening already done.
- **Recommendation:** Verify live grants still match (advisors may still show stale `anon`). If `anon` remains, explicit `REVOKE … FROM anon`.

#### Object: `generate_monthly_sim_finance`
- **Usages found:** Originally cron `generate-monthly-sim-finance` — `00202_monthly_sim_finance_cron.sql`; **unscheduled + no-op** — `00238_disable_sim_finance_ledger_generation.sql` (~L15–46). No `src/` RPC.
- **Context:** Disabled cron / no-op function.
- **Intentional?** Yes (disabled on purpose).
- **Recommendation:** Revoke API roles anyway. Do not re-enable without product + APPROVE.

---

## 4. Bucket C — Edge function + `service_role`

#### Object: `extend_active_subscription_payments`
- **Usages found:**
  - Edge: `supabase/functions/extend-subscription-payments/index.ts` **L38–40** (`supabase.rpc("extend_active_subscription_payments")` with **service role** client).
  - pg_cron HTTP → edge: `00226_extend_subscription_payments_cron.sql`.
  - Prior revoke from `authenticated`: `00227_fix_extend_active_subscription_payments.sql` (~L109–111).
- **Context:** Edge + cron (not SPA).
- **Intentional?** Yes.
- **Recommendation:** Confirm `anon` also revoked. Keep `service_role` / postgres only. Advisors listing this under anon is a **must-fix if live grant confirms**.

---

## 5. Bucket D — Intentional frontend RPCs (keep `authenticated` if guarded; revoke `anon`)

All rows below are **conscious product design**: the SPA calls them. Advisors still correctly warn that `SECURITY DEFINER` + broad grants are risky — mitigation is **role guards inside the function** + **no anon execute**.

### 5.1 Completions / finance mutations

| Object | Usages found | Intentional? | Recommendation |
|--------|--------------|--------------|----------------|
| `fn_complete_work_order_with_payment` | `src/features/workOrders/api.js` ~L532; guards `00230` | Yes | Revoke anon; keep authenticated + role guard |
| `complete_proposal_with_rate` | `src/features/proposals/api.js` ~L513; guards `00230` | Yes | Same |
| `fn_record_payment` | `src/features/subscriptions/paymentsApi.js` ~L57; guards `00122`/`00229` | Yes | Same |
| `fn_revert_write_off` | `paymentsApi.js` ~L93 | Yes | Same |
| `soft_delete_transaction` | `src/features/finance/api.js` ~L217; guard `00225` | Yes | Same |
| `fn_generate_recurring_expenses_guarded` | `recurringApi.js` ~L141; `00231` | Yes | Same (wrapper is the public API) |
| `soft_delete_recurring_template` | `recurringApi.js` ~L101 | Yes | Same |

### 5.2 Proposals / packages

| Object | Usages found | Intentional? | Recommendation |
|--------|--------------|--------------|----------------|
| `fn_save_proposal_package` | `proposals/api.js` ~L180; `00237+` | Yes | Revoke anon; keep authenticated + guard |
| `revise_proposal_package` | `proposals/api.js` ~L484; `00251` | Yes | Same |
| `soft_delete_proposal` | `proposals/api.js` ~L526 | Yes | Same |
| `get_selectable_linked_work_order_proposals` | `proposals/api.js` ~L711; `00249` | Yes | Same |
| `get_linked_work_order_proposal_scope` | `proposals/api.js` ~L718; `00249` | Yes | Same |

### 5.3 Subscriptions / materials / customers / SIM / ops

| Object | Usages found | Intentional? | Recommendation |
|--------|--------------|--------------|----------------|
| `generate_subscription_payments` | `subscriptions/api.js` ~L299, ~L483 | Yes | Revoke anon; keep auth + guard (`00229`) |
| `fn_update_subscription_price` | `subscriptions/api.js` ~L378 | Yes | Same |
| `fn_cancel_subscription` | `subscriptions/api.js` ~L448 | Yes | Same |
| `bulk_update_subscription_prices` | `subscriptions/api.js` ~L500 | Yes | Same |
| `bulk_import_subscriptions` | `subscriptions/importApi.js` ~L133 | Yes | Same |
| `bulk_upsert_materials` | `materials/api.js` ~L199; admin guard `00222` | Yes | Same |
| `soft_delete_customer` | `customers/api.js` ~L120 | Yes | Same |
| `soft_delete_sim_card` | `simCards/api.js` ~L183 | Yes | Same |
| `fn_upsert_site_assets_batch` | `siteAssets/api.js` ~L110 | Yes | Same |
| `soft_delete_operations_item` | `operations/api.js` ~L139 | Yes | Same |
| `fn_convert_item_to_work_order` | `operations/api.js` ~L188 | Yes | Same |
| `fn_boomerang_failed_item` | `operations/api.js` ~L207 | Yes | Same |
| `fn_get_operations_stats` | `operations/api.js` ~L220 | Yes | Same |
| `soft_delete_work_order` | `workOrders/api.js` ~L463 | Yes | Same |

### 5.4 Reads / dashboard / search / notifications UI

| Object | Usages found | Intentional? | Recommendation |
|--------|--------------|--------------|----------------|
| `get_dashboard_stats` | `dashboard/api.js` ~L84 | Yes | Revoke anon; keep authenticated (role-aware inside) |
| `get_today_schedule` | `dashboard/api.js` ~L92 | Yes | Same |
| `get_my_pending_tasks` | `dashboard/api.js` ~L100 | Yes | Same |
| `get_monthly_revenue_expense` | `dashboard/api.js` ~L118; guard `00225` | Yes | Same — finance sensitive |
| `get_overdue_subscription_payments` | `dashboard/api.js` ~L126; guard `00225` | Yes | Same |
| `get_subscription_stats` | `paymentsApi.js` ~L128; `finance/api.js` ~L482 | Yes | Same |
| `get_subscription_year_schedule` | `paymentsApi.js` ~L14 | Yes | Same |
| `get_overdue_invoices` | `paymentsApi.js` ~L119 | Yes | Same |
| `get_daily_work_list` | `workOrders/api.js` ~L472 | Yes | Same |
| `search_work_history` | `workHistory/api.js` ~L17 | Yes | Same |
| `search_customer_sites` | `customerSites/api.js` ~L90 | Yes | Same |
| `get_notification_badge_count` | `notifications/api.js` ~L62 | Yes | Same |
| `fn_resolve_notification` | `notifications/api.js` ~L69 | Yes | Same |

**Pattern for Bucket D:** Advisor noise ≠ “delete the RPC”. It means: **close the anon door**, keep SPA path, trust (and verify) `get_my_role()` guards from migrations `00225`–`00231` / earlier `00122` family.

---

## 6. Bucket E — Dead / unused / unclear

#### Object: `get_customer_work_history`
- **Usages found:** Defined/granted in `00005_dashboard_functions.sql` (~L193–230). **Zero** `src/` callers. References legacy `work_orders` columns dropped in `00009_rebuild_work_orders.sql` — likely **broken if invoked**.
- **Context:** Dead / legacy.
- **Intentional?** No (leftover).
- **Recommendation:** `REVOKE` immediately; prefer `DROP FUNCTION` in a later cleanup migration after APPROVE.

#### Object: `fn_upsert_site_asset` (singular)
- **Usages found:** Defined + `GRANT` in `00159_fn_upsert_site_asset.sql`. SPA uses **`fn_upsert_site_assets_batch`** only (`siteAssets/api.js` ~L110). No other SQL callers found.
- **Context:** Dead RPC grant.
- **Intentional?** No (superseded by batch).
- **Recommendation:** Revoke; optionally drop later.

#### Object: `ensure_payments_for_year`
- **Usages found:** Defined/`GRANT authenticated` in `00145_extend_and_ensure_payments_for_year.sql`; role guard `00229` (~L109+). One-time backfill loop in `00146_fix_ensure_payments_for_year_gap.sql` (~L117–119). **No `src/` RPC caller found.**
- **Context:** Intended frontend/year helper per migration comments; UI call missing or removed.
- **Intentional?** Unclear (grant says yes; app says unused).
- **Recommendation:** Confirm with product. If unused → revoke `authenticated` too or drop. If still needed soon → revoke `anon` only and wire UI later.

---

## 7. Bucket F — Special keep

#### Object: `get_my_role`
- **Usages found:** Defined `00001_profiles.sql` (~L117–128). Used inside **dozens of RLS policies and SECURITY DEFINER bodies** across migrations (e.g. `00104`, `00116`, `00126`, `00225`, …). Frontend typically reads `profiles.role` via `src/lib/roles.js` rather than RPC.
- **Context:** RLS / SQL helper (not a business mutation RPC).
- **Intentional?** Yes.
- **Recommendation:** **Revoke `anon` only.** Keep `authenticated` execute — required for RLS expressions that call it. Low risk (returns caller’s own role).

---

## 8. Non-function advisor items

### 8.1 `rls_policy_always_true` — `work_orders_insert`

- **Object:** Policy `work_orders_insert` on `public.work_orders` (`INSERT`, `TO authenticated`, `WITH CHECK (true)`).
- **Usages found:**
  - Policy created/recreated: `00003_work_orders.sql` (~L135–138), `00009_rebuild_work_orders.sql` (~L69–72). **No later migration tightens it.**
  - Frontend inserts: `src/features/workOrders/api.js` ~L290–294 (sets `created_by = user.id` in app code ~L284–288), and second insert path ~L362+; also proposal-linked flows in `src/features/proposals/api.js` (~L731+).
- **Context:** Table RLS — intentional early “any authenticated can create”.
- **Intentional?** Yes as MVP convenience; **security-weak by today’s standards**.
- **Recommendation:** Tighten after product rule, e.g. `WITH CHECK (created_by = auth.uid())` and/or role allowlist. Must keep `field_worker` create flows working. Requires **APPROVE** migration.

### 8.2 `auth_leaked_password_protection`

- **Object:** Supabase Auth project setting (HaveIBeenPwned).
- **Usages found:** N/A in repo (Dashboard config).
- **Context:** Auth.
- **Intentional?** Likely oversight / default-off — not a code decision.
- **Recommendation:** Enable in Dashboard (staging → prod). No migration.

### 8.3 `function_search_path_mutable` — `set_proposal_completed_at`

- **Object:** `public.set_proposal_completed_at()`
- **Usages found:**
  - Trigger `proposal_status_change` — `00189_add_proposal_completed_at.sql` (~L48–51).
  - `00206_fix_function_search_paths.sql` (~L23–24) set `search_path = public`.
  - **Regression:** `00251_proposal_revised_status_and_revision_finalize.sql` (~L19–32) `CREATE OR REPLACE` **without** `SET search_path`, wiping the fix.
- **Context:** Trigger helper.
- **Intentional?** Trigger yes; missing search_path = **accidental regression**.
- **Recommendation:** Small migration restoring `SET search_path = public` (and revoke API execute if currently granted). P1 in plan 11.

### 8.4 `extension_in_public` — `pg_trgm` / `unaccent`

#### Object: `pg_trgm`
- **Usages found:** Enabled `00099_sim_cards_pagination_indexes.sql`; GIN ops on SIM phone + search columns in `00100_optimize_work_orders_view.sql` (form_no / company_name / account_no search indexes).
- **Context:** Active search infrastructure.
- **Intentional?** Yes.
- **Recommendation:** Defer move out of `public` until staging plan for operator-class qualification (P2).

#### Object: `unaccent`
- **Usages found:** Enabled in `00092_turkish_search_normalization.sql` with comment that custom `translate` is used instead; **zero** `unaccent(` call sites in migrations/`src`.
- **Context:** Installed but unused.
- **Intentional?** Partial (prepared, unused).
- **Recommendation:** Safer to relocate or leave; low urgency. Prefer leave until `pg_trgm` move is planned together.

---

## 9. Decision matrix (what to do next)

| Action | Objects |
|--------|---------|
| **REVOKE `anon` + `authenticated` (Batch A1)** | All Bucket A + B + C internals; dead helpers that must not be RPCs |
| **REVOKE `anon` only; keep `authenticated`** | Bucket D SPA RPCs + `get_my_role` |
| **Verify live grants** | Especially `fn_generate_recurring_expenses`, `extend_active_subscription_payments` (migrations claim fix; advisors still warn) |
| **Product decision** | `work_orders_insert` tighten; whether `fn_sim_card_to_finance` trigger should remain; fate of `ensure_payments_for_year` |
| **Cleanup DROP (later)** | `get_customer_work_history`, unused `fn_upsert_site_asset` |
| **Dashboard** | Leaked password protection |
| **Tiny migration** | Restore `search_path` on `set_proposal_completed_at` |
| **Defer** | Extension schema move |

---

## 10. Mapping back to plan 11 batches

| Plan batch | This analysis supports |
|------------|------------------------|
| **A0** | Allowlist = Bucket D (+ `get_my_role`). Everything else = revoke candidates. |
| **A1** | Buckets A, B, C + dead E |
| **A2** | Auth leaked password |
| **A3** | `work_orders_insert` |
| **A4** | `set_proposal_completed_at` search_path regression from `00251` |
| **A5** | Spot-check Bucket D guards only where missing |
| **A6** | Extensions P2 |

---

## 11. Gaps / limits of this analysis

- Did **not** query live `pg_proc` / `information_schema.role_routine_grants` — advisors dump may lag migrations applied locally but not remotely (or vice versa).
- Did **not** dynamically construct RPC names in JS (static `.rpc('name')` search only).
- Dual payment-status triggers (`00207` vs `00212`) need a live `\df` / trigger list check.
- `fn_sim_card_to_finance` still active vs CLAUDE “SIM auto-ledger disabled” — easy to confuse; call out in product review.

When implementation starts: run live grant audit (plan **A0**), then request **APPROVE** for revoke migration **A1** only.
