-- 00134_make_customer_sites_address_optional.sql
-- Description: Allow customer_sites.address to be NULL/empty for bulk import workflow.
-- Users can create sites with: alarm center name (site_name), account_no, city, district.
-- Address and phone can be added later (from Excel or systems).
--
-- address_search generated column uses normalize_tr_for_search(address) which has
-- coalesce(input, ''), so NULL address is handled correctly.

ALTER TABLE customer_sites ALTER COLUMN address DROP NOT NULL;
