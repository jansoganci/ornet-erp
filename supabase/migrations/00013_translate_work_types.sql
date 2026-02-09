-- Migration: Translate work_type values to English
-- From: 'kesif', 'montaj', 'servis', 'bakim', 'diger'
-- To: 'survey', 'installation', 'service', 'maintenance', 'other'

-- 1. Update existing data
UPDATE work_orders SET work_type = 'survey' WHERE work_type = 'kesif';
UPDATE work_orders SET work_type = 'installation' WHERE work_type = 'montaj';
UPDATE work_orders SET work_type = 'service' WHERE work_type = 'servis';
UPDATE work_orders SET work_type = 'maintenance' WHERE work_type = 'bakim';
UPDATE work_orders SET work_type = 'other' WHERE work_type = 'diger';

-- 2. Update CHECK constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_work_type_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_work_type_check 
CHECK (work_type IN ('survey', 'installation', 'service', 'maintenance', 'other'));
