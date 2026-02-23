-- Migration: 00095_add_combo_service_types
-- Description: Add combo service types back to subscriptions table constraint.

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_service_type_check;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_service_type_check
  CHECK (service_type IS NULL OR service_type IN (
    'alarm_only', 
    'camera_only', 
    'internet_only', 
    'alarm_camera', 
    'alarm_camera_internet', 
    'camera_internet'
  ));
