-- 013_building_ads.sql
-- Expand sky_ads vehicle column to support building ad formats

-- Drop existing CHECK constraint and recreate with new vehicle types
ALTER TABLE sky_ads DROP CONSTRAINT IF EXISTS sky_ads_vehicle_check;
ALTER TABLE sky_ads ADD CONSTRAINT sky_ads_vehicle_check
  CHECK (vehicle IN ('plane', 'blimp', 'billboard', 'rooftop_sign', 'led_wrap'));
