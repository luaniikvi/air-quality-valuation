-- One-time migration for existing databases.
-- This migration removes user-tunable IAQ parameters from `settings`
-- and keeps only the LED / BUZZER control flags per device.

USE air_quality_monitor;

ALTER TABLE `settings`
  DROP COLUMN `iaq_method`,
  DROP COLUMN `w_temp`,
  DROP COLUMN `w_hum`,
  DROP COLUMN `w_dust`,
  DROP COLUMN `w_gas`,
  DROP COLUMN `temp_a`,
  DROP COLUMN `temp_b`,
  DROP COLUMN `temp_c`,
  DROP COLUMN `temp_d`,
  DROP COLUMN `hum_a`,
  DROP COLUMN `hum_b`,
  DROP COLUMN `hum_c`,
  DROP COLUMN `hum_d`,
  DROP COLUMN `dust_good`,
  DROP COLUMN `dust_bad`,
  DROP COLUMN `gas_good`,
  DROP COLUMN `gas_bad`,
  DROP COLUMN `iaq_safe`,
  DROP COLUMN `iaq_warn`,
  ADD COLUMN `led_enabled` tinyint(1) NOT NULL DEFAULT '0' AFTER `device_id`,
  ADD COLUMN `buzzer_enabled` tinyint(1) NOT NULL DEFAULT '0' AFTER `led_enabled`;
