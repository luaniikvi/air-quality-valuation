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
};

export interface Processed {
  deviceId: string;
  ts: number; // unix seconds
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined;
  IAQ: number | undefined; // 0..100, 100 is best
  level: 'SAFE' | 'WARN' | 'DANGER' | undefined;
};

export interface AlertItem {
  // NOTE: stored as BIGINT UNSIGNED in MySQL; keep as string in JS to avoid precision issues.
  id: string;
  device_id: string;
  ts: number; // unix seconds
  iaq: number | null; // 0..100 (100 is best)
  level: 'SAFE' | 'WARN' | 'DANGER';
}

export interface IaqSettings {
  device_id: string;

  // ===== IAQ formula (0..100, 100 is best) =====
  // MIN = strict (worst-metric wins). WEIGHTED_HARMONIC = still penalizes the worst metric,
  // but smoother/more realistic for outdoor city environments.
  iaq_method: 'MIN' | 'WEIGHTED_HARMONIC';

  // Weights (any non-negative numbers; the backend will handle normalization safely)
  w_temp: number;
  w_hum: number;
  w_dust: number;
  w_gas: number;

  // Trapezoid scoring for temp/humidity: a < b <= c < d
  // score = 0..100 (best in [b..c])
  temp_a: number;
  temp_b: number;
  temp_c: number;
  temp_d: number;
  hum_a: number;
  hum_b: number;
  hum_c: number;
  hum_d: number;

  // One-sided decreasing scoring for dust/gas: good < bad
  dust_good: number; // mg/m3
  dust_bad: number;  // mg/m3
  gas_good: number;  // ppm (relative, depends on sensor calibration)
  gas_bad: number;   // ppm

  // IAQ -> level thresholds
  iaq_safe: number; // >= iaq_safe => SAFE
  iaq_warn: number; // >= iaq_warn => WARN, else DANGER
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
