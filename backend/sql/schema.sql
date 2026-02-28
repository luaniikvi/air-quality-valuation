-- Air Quality Monitor (IAQ) - MySQL schema
-- Timestamps are unix seconds.

CREATE DATABASE IF NOT EXISTS air_quality_monitor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE air_quality_monitor;

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

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id         CHAR(36)        NOT NULL, -- uuid
  device_id  VARCHAR(64)     NOT NULL,
  ts         INT UNSIGNED    NOT NULL, -- unix seconds
  type       ENUM('temp','hum','gas','dust','iaq','system') NOT NULL,
  value      FLOAT          NULL,
  level      ENUM('INFO','WARN','DANGER') NOT NULL,
  message    VARCHAR(255)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_alert_device_ts (device_id, ts),
  CONSTRAINT fk_alert_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Threshold settings (optional: UI/Settings page can use it later)
CREATE TABLE IF NOT EXISTS settings (
  device_id    VARCHAR(64)     NOT NULL,
  gas_warn     INT             NOT NULL,
  gas_danger   INT             NOT NULL,
  dust_warn    FLOAT           NOT NULL,
  dust_danger  FLOAT           NOT NULL,
  temp_low     FLOAT           NOT NULL,
  temp_high    FLOAT           NOT NULL,
  hum_low      FLOAT           NOT NULL,
  hum_high     FLOAT           NOT NULL,
  updated_ts   INT UNSIGNED    NOT NULL,
  PRIMARY KEY (device_id),
  CONSTRAINT fk_settings_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
