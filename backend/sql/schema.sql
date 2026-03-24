create database if not exists air_quality_monitor;
USE air_quality_monitor;

CREATE TABLE `devices` (
  `device_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_ts` int unsigned NOT NULL,
  `last_seen_ts` int unsigned NOT NULL,
  PRIMARY KEY (`device_id`),
  KEY `idx_devices_last_seen` (`last_seen_ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telemetry` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ts` int unsigned NOT NULL,
  `temp` float DEFAULT NULL,
  `hum` float DEFAULT NULL,
  `gas` float DEFAULT NULL,
  `dust` float DEFAULT NULL,
  `iaq` tinyint unsigned DEFAULT NULL,
  `level` enum('SAFE','WARN','DANGER') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tel_device_ts` (`device_id`,`ts`),
  CONSTRAINT `fk_tel_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=506 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `alerts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ts` int unsigned NOT NULL,
  `iaq` tinyint unsigned DEFAULT NULL,
  `level` enum('SAFE','WARN','DANGER') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_alert_device_ts` (`device_id`,`ts`),
  CONSTRAINT `fk_alert_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `settings` (
  `device_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `led_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `buzzer_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `updated_ts` int unsigned NOT NULL,
  PRIMARY KEY (`device_id`),
  CONSTRAINT `fk_settings_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
