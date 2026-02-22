export type DeviceStatus = 'online' | 'offline';

export interface Device {
  device_id: string;
  name?: string;
  location?: string;
  status?: DeviceStatus;
  last_seen?: string; // ISO
}

export interface Reading {
  device_id: string;
  ts: string; // ISO
  temp?: number;
  hum?: number;
  gas?: number;
  dust?: number;
  iaq?: number;
  level?: 'SAFE' | 'WARN' | 'DANGER';
  rssi?: number;
}
export interface Derived {
  deviceId: string;
  ts: number;
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined;
  IAQ: number;
  level: "SAFE" | "WARN" | "DANGER";
};

export interface Telemetry {
  deviceId: string;
  ts: number;
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined;
};

export interface AlertItem {
  id: string;
  device_id: string;
  ts: string;
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
  from: string; // ISO
  to: string;   // ISO
  interval?: string; // e.g. '10s' | '1m' | '5m'
}

export interface HistoryResponse {
  points: Reading[];
}
