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
  // NOTE: stored as BIGINT UNSIGNED in MySQL; keep as string in JS to avoid precision issues.
  id: string;
  device_id: string;
  ts: number; // unix seconds
  iaq: number | null; // 0..100 (100 is best)
  level: 'SAFE' | 'WARN' | 'DANGER';
}

export interface DeviceSettings {
  device_id: string;
  led_enabled: boolean;
  buzzer_enabled: boolean;
}

// Backward-compatible aliases for older imports.
export type IaqSettings = DeviceSettings;
export type ThresholdSettings = DeviceSettings;

export interface HistoryQuery {
  device_id: string;
  from: string;
  to: string;
  interval: string; // e.g. '10s' | '1m' | '5m'
}

export interface HistoryResponse {
  points: Processed[];
}
