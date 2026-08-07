-- Migration: 00259_resolve_alarm_acc_site_conflicts
-- Description: Manual per-row resolution of the 14 Merkez/ACC conflicts left by
--   00257 (see docs/active/ALARM_ACC_SITE_CONFLICTS.md for context). Each row
--   below was reviewed and decided by ops in chat on 2026-08-07.
-- Depends on: 00257_site_alarm_acc_backfill_and_import
--
-- Decisions:
--   SITE WINS  (site value kept, legacy subscription copy cleared, no site edit):
--     Bekir Yekeler (ACC), Boga Gida x2 (ACC), Dunya Sehir (ACC),
--     Solmaz Aluminyum (ACC), Semavi Canturk (ACC + Merkez), Tat Ithalat (ACC + Merkez)
--   SUBSCRIPTION WINS (site.alarm_center corrected to subscription's value, then cleared):
--     Cent Sunar, HSC Plastik, Ibakimya, Mert Altiner, Omer Kays Unal (all Merkez only)
--   DEFERRED — left untouched, still blocks 00258 until a follow-up decision:
--     Gurel Yildirim, Yenen Musavirlik (Merkez only)
--
-- Rollback risk: MEDIUM — targeted single-row UPDATEs by subscription id; no bulk logic.
--   To roll back a row, restore from backup or re-enter the value manually.

BEGIN;

-- ============================================================================
-- SITE WINS — clear the legacy subscription copy, site value is untouched
-- ============================================================================

UPDATE subscriptions SET alarm_center_account = NULL
WHERE id = 'bd28651b-b047-4a6c-861f-1aa0d94b4dc8'; -- Bekir Yekeler (ACC)

UPDATE subscriptions SET alarm_center_account = NULL
WHERE id = '8df0f2fb-c61f-421a-8b30-ca6000f1764b'; -- Boga Gida #1 (ACC)

UPDATE subscriptions SET alarm_center_account = NULL
WHERE id = '1a105ac1-b93e-48d3-81bd-f09612978be2'; -- Boga Gida #2 (ACC)

UPDATE subscriptions SET alarm_center_account = NULL
WHERE id = '40bc3f04-90f4-4852-bdda-c4e60b56604f'; -- Dunya Sehir Gayrimenkul (ACC)

UPDATE subscriptions SET alarm_center_account = NULL
WHERE id = 'f6e49314-fd5e-43f2-b222-6b1eccec8986'; -- Solmaz Aluminyum (ACC)

UPDATE subscriptions SET alarm_center_account = NULL, alarm_center = NULL
WHERE id = 'fd4b1ba0-a491-4e37-9a7e-9161fe0c3284'; -- Semavi Canturk (ACC + Merkez)

UPDATE subscriptions SET alarm_center_account = NULL, alarm_center = NULL
WHERE id = 'fd789236-3d98-45d8-a847-e6c88e3026f5'; -- Tat Ithalat Ihracat (ACC + Merkez)

-- ============================================================================
-- SUBSCRIPTION WINS (Merkez) — correct customer_sites.alarm_center, then clear
-- ============================================================================

UPDATE customer_sites SET alarm_center = 'ASM'
WHERE id = 'bb15b427-bad6-44ec-85f8-857d00bfc742'; -- Cent Sunar's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = 'c0e1e64c-b568-4c18-8c20-de5f6bf9da06';

UPDATE customer_sites SET alarm_center = 'ACCOUNT'
WHERE id = 'bc063d83-a3e3-423a-8ebf-1667536b818a'; -- HSC Plastik's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = '68b5873c-a291-4930-aad8-5c383286f925';

UPDATE customer_sites SET alarm_center = 'ACCOUNT'
WHERE id = 'd14824f4-e671-4e90-97b3-b5bebe353b41'; -- Ibakimya's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = 'f61b4268-8f92-446e-9e9f-266b86150cbb';

UPDATE customer_sites SET alarm_center = 'ACCOUNT'
WHERE id = '974a4845-ed6f-4285-be46-1f12735b1375'; -- Mert Altiner - Danamandira's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = 'fe178841-0775-4274-80f0-22139959dc15';

UPDATE customer_sites SET alarm_center = 'ACCOUNT'
WHERE id = 'e3720e74-3f55-4aa7-98b4-387d8fff1e8f'; -- Omer Kays Unal's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = 'bf980582-1974-481c-9a12-0bce16268f16';

-- Gurel Yildirim (bb403b2a-8b6c-4220-a29a-bd30fc04ca30) and Yenen Musavirlik
-- (073d5197-99b5-4160-a3b6-91c7c767abc8) are intentionally left untouched —
-- decision deferred. 00258 will keep failing on these 2 rows until resolved.

COMMIT;
