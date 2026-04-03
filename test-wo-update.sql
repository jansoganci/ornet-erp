-- Test: Work order update simülasyonu
-- Senin durumunu simüle edelim

-- 1. Mevcut bir work order'ın bilgilerini göster
SELECT id, vat_rate, has_tevkifat, scheduled_date, scheduled_time, updated_at
FROM work_orders
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- 2. Bu work order'ı güncellemeyi dene (DRY RUN - sadece göster)
-- UPDATE work_orders
-- SET 
--   vat_rate = 20,
--   has_tevkifat = true,
--   scheduled_date = '2024-12-25',
--   scheduled_time = '14:00'
-- WHERE id = '<work_order_id>';
