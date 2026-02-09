-- Migration: 00012_seed_materials
-- Description: Seed initial materials data
-- Part of Work Order System Implementation

INSERT INTO materials (code, name, category, unit) VALUES
  ('DK230', 'Optik Duman Dedektörü', 'dedektor', 'adet'),
  ('DK230-T', 'Dedektör Tabanı', 'dedektor', 'adet'),
  ('SR408', 'Flaşörlü Yangın Sireni', 'siren', 'adet'),
  ('CP100', 'Yangın İhbar Paneli (4 Bölge)', 'panel', 'adet'),
  ('BT127', 'Bakımsız Kuru Akü (12V 7Ah)', 'aksesuar', 'adet'),
  ('MC302', 'Manyetik Kontak', 'aksesuar', 'adet'),
  ('DM110', 'Dahili Siren', 'siren', 'adet'),
  ('EX200', 'Harici Siren', 'siren', 'adet'),
  ('KB-J-Y', 'J-Y(St)Y 1x2x0.8+0.8 Yangın Kablosu', 'kablo', 'metre'),
  ('KB-CAT6', 'CAT6 Network Kablosu', 'kablo', 'metre'),
  ('KM-IP2', '2MP IP Dome Kamera', 'kamera', 'adet'),
  ('KM-IP4', '4MP IP Bullet Kamera', 'kamera', 'adet'),
  ('NVR-08', '8 Kanal NVR Kayıt Cihazı', 'panel', 'adet'),
  ('HDD-2TB', '2TB Güvenlik Hard Disk', 'aksesuar', 'adet'),
  ('BT-500', 'Buton (Acil Durdurma)', 'buton', 'adet'),
  ('BT-510', 'Buton (Yangın İhbar)', 'buton', 'adet'),
  ('PS-1205', '12V 5A Güç Kaynağı', 'aksesuar', 'adet'),
  ('RC-100', 'Uzaktan Kumanda', 'aksesuar', 'adet'),
  ('MK-200', 'Mekanik Kilit', 'aksesuar', 'adet'),
  ('TR-100', 'Turnike Sistemi', 'aksesuar', 'adet')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit;
