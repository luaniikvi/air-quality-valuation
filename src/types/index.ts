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
  id: string;
  device_id: string;
  ts: number;
  type: 'temp' | 'hum' | 'gas' | 'dust' | 'iaq' | 'system';
  value?: number;
  level: 'INFO' | 'WARN' | 'DANGER';
  message: string;
}

export interface ThresholdSettings {
  device_id: string;
  gas_warn: number;
  gas_danger: number;
  dust_warn: number;
  dust_danger: number;
  temp_low: number;
  temp_high: number;
  hum_low: number;
  hum_high: number;
}

export interface HistoryQuery {
  device_id: string;
  from: string;
  to: string;
  interval: string; // e.g. '10s' | '1m' | '5m'
}

export interface HistoryResponse {
  points: Processed[];
}
