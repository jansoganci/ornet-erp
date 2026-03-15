-- 00135_add_customer_import_fields.sql
-- Description: Add subscriber_title, alarm_center, connection_date for customer + site bulk import.
--
-- Down migration (comment — run manually if needed):
--   ALTER TABLE customers DROP COLUMN IF EXISTS subscriber_title;
--   ALTER TABLE customer_sites DROP COLUMN IF EXISTS alarm_center;
--   ALTER TABLE customer_sites DROP COLUMN IF EXISTS connection_date;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscriber_title TEXT;

ALTER TABLE customer_sites ADD COLUMN IF NOT EXISTS alarm_center TEXT;
ALTER TABLE customer_sites ADD COLUMN IF NOT EXISTS connection_date DATE;
