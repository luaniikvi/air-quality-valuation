// backend/src/types.ts
// Local copy of shared types (keep backend build independent from frontend files)

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  // NOTE: REST API uses snake_case for devices.
  device_id: string;
  name?: string | undefined;
  status?: DeviceStatus;
  last_seen?: number; // unix seconds
}

export interface Telemetry {
  deviceId: string;
  ts: number; // unix seconds
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined;
}

export interface Processed {
  deviceId: string;
  ts: number; // unix seconds
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined;
  IAQ: number | undefined; // 0..100, 100 is best
  level: 'SAFE' | 'WARN' | 'DANGER' | undefined;
}

export interface AlertItem {
  // Stored as BIGINT UNSIGNED in MySQL; keep as string in JS to avoid precision issues.
  id: string;
  device_id: string;
  ts: number; // unix seconds
  iaq: number | null; // 0..100 (100 is best)
  level: 'SAFE' | 'WARN' | 'DANGER';
}

export interface IaqSettings {
  device_id: string;

  // ===== IAQ formula (0..100, 100 is best) =====
  iaq_method: 'MIN' | 'WEIGHTED_HARMONIC';

  // Weights
  w_temp: number;
  w_hum: number;
  w_dust: number;
  w_gas: number;

  // Trapezoid scoring for temp/humidity: a < b <= c < d
  temp_a: number;
  temp_b: number;
  temp_c: number;
  temp_d: number;
  hum_a: number;
  hum_b: number;
  hum_c: number;
  hum_d: number;

  // One-sided decreasing scoring for dust/gas: good < bad
  dust_good: number;
  dust_bad: number;
  gas_good: number;
  gas_bad: number;

  // IAQ -> level thresholds
  iaq_safe: number;
  iaq_warn: number;
}

export type ThresholdSettings = IaqSettings;

export interface HistoryQuery {
  device_id: string;
  from: string;
  to: string;
  interval: string; // e.g. '10s' | '1m' | '5m'
}

export interface HistoryResponse {
  points: Processed[];
}
