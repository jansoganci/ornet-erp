# Alarm Merkez / ACC — site vs subscription conflicts

Generated for Phase 2 site-ownership work (`00257_site_alarm_acc_backfill_and_import`).

**Rule:** `customer_sites.account_no` and `customer_sites.alarm_center` are the sole source of truth. `subscriptions.alarm_center` / `alarm_center_account` no longer exist (dropped in `00258`, 2026-08-07).

**Status: COMPLETE — all migrations applied to production 2026-08-07.**

1. `00257_site_alarm_acc_backfill_and_import.sql` — backfill + view + import RPC. ✅ Applied.
2. `00259_resolve_alarm_acc_site_conflicts.sql` — resolved 12 of 14 conflicts per ops decision. ✅ Applied.
3. `00260_resolve_final_alarm_center_conflicts.sql` — resolved the last 2 (Gürel Yıldırım, Yenen Müşavirlik). ✅ Applied.
4. `00258_drop_subscription_alarm_center_fields.sql` — guard passed (0 remaining), legacy columns dropped, view recreated. ✅ Applied.

Verified post-drop: `subscriptions.alarm_center*` columns no longer exist; `subscriptions_detail` view has 424/424 rows matching the base table (no data lost); no new security advisories introduced.

Snapshot date: 2026-08-07, re-verified live against production after the Phase 3 fixes below (data drifts as ops edit sites through the app — re-run the dry-run query before relying on this table to resolve conflicts).

> Note: the original 2026-08-07 snapshot listed FILIZ KUYUMCULUK KAGITHANE as both an ACC and a Merkez conflict. A live re-check found the site and subscription values now match (both `MY3528` / `MY CENTER`) — already resolved through normal app use, removed from both tables below. Two conflicts not in the original snapshot were found live (TAT ITHALAT, SEMAVI CANTURK) and added.

## ACC conflicts (site ACC ≠ subscription ACC) — all resolved ✅

Decision for all 7: **site value kept**, legacy subscription copy cleared (`00259`).

| Company | Site | Site ACC | Sub ACC | Subscription ID |
|---------|------|----------|---------|-----------------|
| BEKIR YEKELER | MERKEZ | MY1960 | MY1960 + MY1949/MY1957/MY1959/MY1958 (multiline) | `bd28651b-b047-4a6c-861f-1aa0d94b4dc8` |
| BOGA GIDA SAN.VE TIC.AS. | PB GENEL MERKEZ … | D0B6 | D0B6 - D0B8 | `8df0f2fb-c61f-421a-8b30-ca6000f1764b` |
| BOGA GIDA SAN.VE TIC.AS. | PB GENEL MERKEZ … | D0B6 | D0B6 - D0B8 | `1a105ac1-b93e-48d3-81bd-f09612978be2` |
| DÜNYA ŞEHİR GAYRİMENKUL … | DEPOLAR … | B66E -1 | B66E -1 + B66E -2 (multiline) | `40bc3f04-90f4-4852-bdda-c4e60b56604f` |
| SEMAVI CANTURK (DENIZKOSKLER) | DENIZKOSKLER | MY3644 | BB95 | `fd4b1ba0-a491-4e37-9a7e-9161fe0c3284` |
| SOLMAZ ALUMINYUM … | DEPO PART 1 … | MY2818-001 VE MY2818-002 | MY2818-001 VE MY2818-02 (typo/truncation) | `f6e49314-fd5e-43f2-b222-6b1eccec8986` |
| TAT ITHALAT IHRACAT IC VE DIS TIC. LTD. STI | MERKEZ | MY1967 | 199F | `fd789236-3d98-45d8-a847-e6c88e3026f5` |

## Merkez (center name) conflicts — all resolved ✅

| Company | Site | Site Merkez | Sub Merkez | Subscription ID | Decision |
|---------|------|-------------|------------|-----------------|----------|
| CENT SUNAR | MERKEZ | ~~ACCOUNT~~ → ASM | ASM | `c0e1e64c-b568-4c18-8c20-de5f6bf9da06` | ✅ subscription won — site corrected to `ASM` |
| GUREL YILDIRIM … | MERKEZ | ~~MY CENTER~~ → ACCOUNT | ACCOUNT | `bb403b2a-8b6c-4220-a29a-bd30fc04ca30` | ✅ subscription won — site corrected to `ACCOUNT` (`00260`) |
| HSC PLASTİK … | MERKEZ | ~~MY CENTER~~ → ACCOUNT | ACCOUNT | `68b5873c-a291-4930-aad8-5c383286f925` | ✅ subscription won — site corrected to `ACCOUNT` |
| IBAKIMYA SAN.VE TIC.AS | CATI | ~~MY CENTER~~ → ACCOUNT | ACCOUNT | `f61b4268-8f92-446e-9e9f-266b86150cbb` | ✅ subscription won — site corrected to `ACCOUNT` |
| MERT ALTINER - DANAMANDIRA | MERKEZ | ~~MY CENTER~~ → ACCOUNT | ACCOUNT | `fe178841-0775-4274-80f0-22139959dc15` | ✅ subscription won — site corrected to `ACCOUNT` |
| OMER KAYS UNAL (AKFIRAT) | AKFIRAT | ~~MY CENTER~~ → ACCOUNT | ACCOUNT | `bf980582-1974-481c-9a12-0bce16268f16` | ✅ subscription won — site corrected to `ACCOUNT` |
| SEMAVI CANTURK (DENIZKOSKLER) | DENIZKOSKLER | MY CENTER | ACCOUNT | `fd4b1ba0-a491-4e37-9a7e-9161fe0c3284` | ✅ site won — subscription copy cleared |
| TAT ITHALAT IHRACAT IC VE DIS TIC. LTD. STI | MERKEZ | MY CENTER | ACCOUNT | `fd789236-3d98-45d8-a847-e6c88e3026f5` | ✅ site won — subscription copy cleared |
| YENEN MUSAVIRLIK | MERKEZ | ~~ACCOUNT~~ → ASM | ASM | `073d5197-99b5-4160-a3b6-91c7c767abc8` | ✅ subscription won — site corrected to `ASM` (`00260`); ACC already matched (`DFB3`) |

## Notes

- Multiline ACC values often mean multiple panels; prefer modeling as separate sites if they are physically distinct.
- `MERKEZ YOK` is a legacy placeholder, not a real monitoring center. `00257` nulls it from subscription copies unconditionally (it carries no information, so no data is lost) — it is **not** listed as a conflict above. This is why HERO'S PIZZA (former Merkez conflict, sub value `MERKEZ YOK`) no longer appears.
- After 00257 is applied remotely, matching subscription copies (and placeholder copies) are nulled; the true conflict rows above keep their subscription legacy values so the UI mismatch hint still surfaces until Phase 3.

## Phase 3 status — complete

All four migrations applied to production on 2026-08-07, in order: `00257` → `00259` → `00260` → `00258`. `00258`'s guard found 0 remaining legacy values and proceeded to drop `subscriptions.alarm_center` / `alarm_center_account` and recreate `subscriptions_detail` with `site_alarm_center` / `account_no` sourced only from `customer_sites`.

Post-drop verification: legacy columns confirmed absent from `information_schema.columns`; `subscriptions_detail` row count (424) matches `subscriptions` row count (424); no new Supabase security/performance advisories introduced by the drop.

**Ensure the deployed frontend bundle is current** (no code path should reference `subscription.alarm_center` / `subscription.alarm_center_account` anymore — only `site_alarm_center` / `account_no` from the view). If any client is suspected to still be running a pre-Phase-1 PWA build, have them hard-refresh; the old fields no longer exist on the API response.

This document remains the historical conflict snapshot / audit trail for how each site's Merkez/ACC was finalized (e.g. Filiz Kağıthane: resolved organically before the migration even ran; the 9 Merkez + 7 ACC conflicts above: resolved via explicit ops decision in `00259`/`00260`).
