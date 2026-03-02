-- Air Quality Monitor (IAQ) - MySQL schema
-- Timestamps are unix seconds.

-- CREATE DATABASE IF NOT EXISTS icvpounahosting_air_quality
--   CHARACTER SET utf8mb4
--   COLLATE utf8mb4_unicode_ci;
 
USE icvpounahosting_air_quality;

-- Devices list (metadata)
CREATE TABLE IF NOT EXISTS devices (
  device_id     VARCHAR(64)  NOT NULL,
  name          VARCHAR(128) NULL,
  created_ts    INT UNSIGNED NOT NULL,
  last_seen_ts  INT UNSIGNED NOT NULL,
  PRIMARY KEY (device_id),
  KEY idx_devices_last_seen (last_seen_ts)
) ENGINE=InnoDB;

-- Telemetry history
CREATE TABLE IF NOT EXISTS telemetry (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id  VARCHAR(64)     NOT NULL,
  ts         INT UNSIGNED    NOT NULL, -- unix seconds
  temp       FLOAT          NULL,
  hum        FLOAT          NULL,
  gas        FLOAT          NULL,
  dust       FLOAT          NULL,
  iaq        TINYINT UNSIGNED NULL, -- 0..100 (100 is best)
  level      ENUM('SAFE','WARN','DANGER') NULL,
  PRIMARY KEY (id),
  KEY idx_tel_device_ts (device_id, ts),
  CONSTRAINT fk_tel_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Alerts (store minimal info only)
CREATE TABLE IF NOT EXISTS alerts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id  VARCHAR(64)     NOT NULL,
  ts         INT UNSIGNED    NOT NULL, -- unix seconds
  iaq        TINYINT UNSIGNED NULL, -- 0..100 (100 is best)
  level      ENUM('SAFE','WARN','DANGER') NOT NULL,
  PRIMARY KEY (id),
  KEY idx_alert_device_ts (device_id, ts),
  CONSTRAINT fk_alert_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- IAQ formula settings (tunable via Settings page)
CREATE TABLE IF NOT EXISTS settings (
  device_id    VARCHAR(64)     NOT NULL,

  -- ===== IAQ formula config (0..100, 100 is best) =====
  iaq_method   ENUM('MIN','WEIGHTED_HARMONIC') NOT NULL DEFAULT 'WEIGHTED_HARMONIC',
  w_temp       FLOAT           NOT NULL DEFAULT 0.10,
  w_hum        FLOAT           NOT NULL DEFAULT 0.10,
  w_dust       FLOAT           NOT NULL DEFAULT 0.45,
  w_gas        FLOAT           NOT NULL DEFAULT 0.35,

  -- Trapezoid scoring: a < b <= c < d (score=100 inside [b..c])
  temp_a       FLOAT           NOT NULL DEFAULT 22,
  temp_b       FLOAT           NOT NULL DEFAULT 26,
  temp_c       FLOAT           NOT NULL DEFAULT 32,
  temp_d       FLOAT           NOT NULL DEFAULT 38,
  hum_a        FLOAT           NOT NULL DEFAULT 40,
  hum_b        FLOAT           NOT NULL DEFAULT 55,
  hum_c        FLOAT           NOT NULL DEFAULT 80,
  hum_d        FLOAT           NOT NULL DEFAULT 95,

  -- One-sided decreasing scoring: good < bad
  dust_good    FLOAT           NOT NULL DEFAULT 0.05,
  dust_bad     FLOAT           NOT NULL DEFAULT 0.20,
  gas_good     INT             NOT NULL DEFAULT 300,
  gas_bad      INT             NOT NULL DEFAULT 1500,

  -- IAQ -> level thresholds
  iaq_safe     TINYINT UNSIGNED NOT NULL DEFAULT 80,
  iaq_warn     TINYINT UNSIGNED NOT NULL DEFAULT 60,

  updated_ts   INT UNSIGNED    NOT NULL,
  PRIMARY KEY (device_id),
  CONSTRAINT fk_settings_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
