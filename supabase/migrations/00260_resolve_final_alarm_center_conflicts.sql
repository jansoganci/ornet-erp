-- Migration: 00260_resolve_final_alarm_center_conflicts
-- Description: Final 2 Merkez conflicts deferred by 00259, resolved by ops on 2026-08-07.
--   ACC (account_no) already matched on both sites — no ACC change needed.
--   Both decided as SUBSCRIPTION WINS for Merkez: site.alarm_center corrected,
--   then the legacy subscription copy is cleared.
-- Depends on: 00259_resolve_alarm_acc_site_conflicts
--
-- Decisions:
--   Gurel Yildirim (Bursa Adnan Turkay Musterisi): Merkez -> ACCOUNT (was MY CENTER)
--   Yenen Musavirlik: Merkez -> ASM (was ACCOUNT)
--
-- After this migration, 0 subscriptions should hold non-null alarm_center /
-- alarm_center_account — 00258 (column drop) can be applied next.

BEGIN;

UPDATE customer_sites SET alarm_center = 'ACCOUNT'
WHERE id = 'e86932b1-1583-47de-b9ea-5918a100c464'; -- Gurel Yildirim's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = 'bb403b2a-8b6c-4220-a29a-bd30fc04ca30';

UPDATE customer_sites SET alarm_center = 'ASM'
WHERE id = '88d6be44-d28e-4fa9-8ae0-e8bd0ce938ca'; -- Yenen Musavirlik's site
UPDATE subscriptions SET alarm_center = NULL
WHERE id = '073d5197-99b5-4160-a3b6-91c7c767abc8';

COMMIT;
