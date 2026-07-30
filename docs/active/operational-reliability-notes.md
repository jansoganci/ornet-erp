# Operational Reliability Notes — Backup & OAuth

**Date:** 2026-07-17
**Origin:** Split out of the consolidated Paraşüt document (`docs/active/parasut-integration-roadmap.md`) at owner request — these topics are operational/system-wide rather than Paraşüt implementation work. The Paraşüt doc keeps only the roadmap, the go-live safeguard checklist (§10), the Paraşüt-specific evidence (Ek A), and the API reference (Ek B).

---

## 1. Database backups — active gap (owner-confirmed)

### What exists today

- **Supabase platform backups only**, and their existence depends on the plan tier: Pro plan = automated daily backups with ~7-day retention (restore = whole-project rollback, not table-level); point-in-time recovery (PITR) is a separate paid add-on; Free plan = no automated backups. The tier is **not verifiable from the repo** → first action is a one-minute dashboard check.
- **Owner decision (2026-07-30):** Do not build a custom GitHub Actions / `pg_dump` / Cloudflare R2 backup pipeline. Ornet will rely on Supabase-managed backups for now. Revisit this decision only if the production project has no managed daily backups or the recovery requirement changes.

### Do files/assets need backup too?

**No.** `supabase.storage` is not referenced anywhere in `src/` and no migration creates storage buckets — the app stores no user files in Supabase Storage. Proposal PDFs are generated client-side on demand; static assets live in git (`public/`). **The Postgres database is the only stateful store.** Edge Function secrets and `config.toml` are re-settable configuration, not data — keep a secrets inventory in a password manager (they are not captured by a DB dump).

### Required checks

1. **Now (minutes):** check the Supabase dashboard — confirm plan tier, that daily platform backups are present, and whether PITR is worth enabling (best RPO, zero maintenance).
2. **One restore drill** into a scratch Supabase project to prove the managed backup restores; repeat quarterly if the process remains practical.

**Priority:** confirm that Supabase-managed daily backups exist before relying on them. No custom backup automation is planned.

---

## 2. OAuth refresh race (Paraşüt token store) — low priority, self-healing

> Action checklist lives in the Paraşüt doc, roadmap §10.6. This section is the full analysis.

**What "two requests refresh at the same time" means.** Edge function invocations share no memory; the Paraşüt token lives in the single-row `parasut_oauth_tokens` table. When a request finds the access token expired (`isValid`, `oauth-store.ts:23–26`), it calls Paraşüt's OAuth endpoint with the stored `refresh_token` and writes the new pair back. If two invocations hit this window simultaneously — e.g. a user clicking *Hazırla* while a cron run is in flight — both read the **same** refresh token and both call the OAuth endpoint with it.

**Does Paraşüt rotate refresh tokens?** Paraşüt's OAuth returns a new `refresh_token` with each refresh response, and the project's own research already treated rotation as fact: the (now-merged) integration audit listed "token refresh yarış durumu (paralel isteklerde refresh token overwrite bug)" among common integration mistakes, and roadmap PR-2's acceptance criteria explicitly require single-flight refresh ("Token refresh tek seferde olur (paralel istek race testi yapıldı)") with `oauth-store.ts` specified as "token oku/refresh/yaz (**FOR UPDATE**)". The shipped `oauth-store.ts:67–98` implements no lock; the `refresh_lock_until` / `refresh_locked_by` columns created for this purpose (migration 00216) are written on persist but never read.

**Can the current code realistically lose a valid token?** The bad interleaving: A refreshes successfully and persists the new pair; B's refresh with the now-consumed old token is rejected (`invalid_grant`) → B's request fails with an auth error. If B's write lands after A's, a stale refresh token can end up persisted. **Recovery is automatic:** on the next call, the refresh fails and the code falls through to the **password grant** (`oauth-store.ts:90–97`; `PARASUT_USERNAME`/`PARASUT_PASSWORD` are required secrets), minting a fresh pair. The integration cannot be durably locked out while those credentials remain configured and valid.

**Real impact at this project's scale:** one operator plus one daily cron means a collision requires two calls inside the same few-second expiry window — rare; the worst outcome is one failed user action (click again) and an extra OAuth round trip.

**Verdict:** not a standalone finding. Two residual actions (tracked in roadmap §10.6):
1. Low priority: complete the roadmap's own PR-2 lock criterion using the existing columns (small, conditional-update lock).
2. Operational rule: **never remove the password-grant secrets** — they are the self-heal path this analysis relies on.

---

## 3. System-wide items verified as good — do not change

From the 2026-07-17 assessment; listed here so they aren't re-litigated in future reviews:

- **The DB-enforced single-ledger architecture** (triggers, completion RPCs, reversal functions, role-guarded SECURITY DEFINER functions). No service layer, queue, or event bus is needed at this scale.
- **RLS posture.** `financial_transactions` role-scoped with admin-only hard delete (00040/00081); `security_invoker` views maintained; 00253 revokes anon EXECUTE on SECURITY DEFINER functions — the hardening direction is already right.
- **JavaScript-only, no CI pipeline, manual Wrangler deploys** — proportionate for a solo developer shipping weekly.
- **Performance** — the 00233 aggregate rewrite shows performance gets fixed when it is real; no speculative index/query work warranted.
- **No general test framework** — the constraint/trigger/manual-scenario safety model is a deliberate, reasonable trade-off.

---

## 4. Withdrawn recommendation — finance posting smoke test

The 2026-07-17 assessment initially recommended a plain-SQL golden-scenario regression script for the finance posting functions. **Withdrawn:** the owner manually tested the posting functions across the required scenarios and verified them working as intended. Retained only as an *optional future safeguard*: if a future migration batch rewrites the posting functions again, a single idempotent SQL script (subscription payment → ledger row; TRY and USD proposal completion; standalone WO cash and bank-transfer; payment settlement) remains the cheapest regression net — to be considered then, not now.
