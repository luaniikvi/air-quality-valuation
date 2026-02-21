import type { AlertItem, Device, HistoryQuery, HistoryResponse, Reading, ThresholdSettings } from '../types';
import { isoNow } from '../utils/format';
import { computeIaqIndex, iaqLevelFromIndex } from '../utils/iaq';

const devices: Device[] = [
  { device_id: 'esp32-001', name: 'ESP32 Phòng khách', location: 'Livingroom', status: 'online', last_seen: isoNow() },
  { device_id: 'esp32-002', name: 'ESP32 Phòng ngủ', location: 'Bedroom', status: 'online', last_seen: isoNow() }
];

const settingsMap: Record<string, ThresholdSettings> = {
  'esp32-001': {
    device_id: 'esp32-001',
    gas_warn: 800,
    gas_danger: 1200,
    dust_warn: 0.08,
    dust_danger: 0.15,
    temp_low: 18,
    temp_high: 32,
    hum_low: 35,
    hum_high: 75
  },
  'esp32-002': {
    device_id: 'esp32-002',
    gas_warn: 800,
    gas_danger: 1200,
    dust_warn: 0.08,
    dust_danger: 0.15,
    temp_low: 18,
    temp_high: 32,
    hum_low: 35,
    hum_high: 75
  }
};

const lastByDevice: Record<string, Reading> = {};

function rand(n: number) {
  return Math.random() * n;
}

function step(prev: number, delta: number, min: number, max: number) {
  const v = prev + (Math.random() * 2 - 1) * delta;
  return Math.max(min, Math.min(max, v));
}

function parseIntervalToMs(interval?: string): number {
  if (!interval) return 60_000;
  const m = interval.trim().match(/^(\d+)(ms|s|m|h)$/i);
  if (!m) return 60_000;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'ms') return value;
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60_000;
  return value * 3_600_000;
}

function makeReading(device_id: string, ts = isoNow()): Reading {
  const prev = lastByDevice[device_id];
  const base: Reading = prev
    ? { ...prev, ts }
    : {
      device_id,
      ts,
      temp: 25 + rand(3),
      hum: 55 + rand(10),
      gas: 500 + rand(300),
      dust: 0.03 + rand(0.03)
    };

  const temp = step(base.temp ?? 25, 0.2, 10, 45);
  const hum = step(base.hum ?? 55, 0.8, 10, 95);
  const gas = step(base.gas ?? 600, 15, 200, 2000);
  const dust = step(base.dust ?? 0.04, 0.002, 0, 0.3);

  const reading: Reading = {
    device_id,
    ts,
    temp: Math.round(temp * 10) / 10,
    hum: Math.round(hum * 10) / 10,
    gas: Math.round(gas),
    dust: Math.round(dust * 1000) / 1000,
    rssi: -45 - Math.round(rand(20))
  };
  const iaq = computeIaqIndex(reading);
  reading.iaq = iaq;
  reading.level = iaqLevelFromIndex(iaq);

  lastByDevice[device_id] = reading;
  return reading;
}

export async function getDevices(): Promise<Device[]> {
  return devices.map((d) => ({ ...d, last_seen: isoNow() }));
}

export async function addDevice(payload: Device): Promise<Device> {
  const id = String(payload.device_id || '').trim();
  if (!id) throw new Error('device_id is required');

  const exists = devices.find((d) => d.device_id === id);
  if (exists) throw new Error('Device already exists');

  const dev: Device = {
    device_id: id,
    name: (payload.name || '').trim() || id,
    location: (payload.location || '').trim() || undefined,
    status: 'online',
    last_seen: isoNow()
  };

  devices.unshift(dev);

  // Clone settings from first device as defaults
  const base = settingsMap[devices[1]?.device_id] || settingsMap['esp32-001'];
  settingsMap[id] = { ...base, device_id: id };

  return dev;
}

export async function disconnectDevice(device_id: string): Promise<{ ok: true }> {
  const id = String(device_id || '').trim();
  const idx = devices.findIndex((d) => d.device_id === id);
  if (idx === -1) throw new Error('Device not found');

  devices.splice(idx, 1);
  delete settingsMap[id];
  delete lastByDevice[id];

  return { ok: true };
}



export async function updateDevice(device_id: string, patch: Partial<Device>): Promise<Device> {
  const id = String(device_id || '').trim();
  const dev = devices.find((d) => d.device_id === id);
  if (!dev) throw new Error('Device not found');

  const name = typeof patch.name === 'string' ? patch.name.trim() : undefined;
  const location = typeof patch.location === 'string' ? patch.location.trim() : undefined;

  // Apply only known fields
  if (patch.name !== undefined) dev.name = name || undefined;
  if (patch.location !== undefined) dev.location = location || undefined;

  dev.last_seen = isoNow();
  return { ...dev };
}

export async function getLatest(device_id: string): Promise<Reading> {
  return makeReading(device_id, isoNow());
}

export async function getHistory(q: HistoryQuery): Promise<HistoryResponse> {
  const fromMs = new Date(q.from).getTime();
  const toMs = new Date(q.to).getTime();
  const range = Math.max(0, toMs - fromMs);

  let stepMs = parseIntervalToMs(q.interval);
  // auto step if range too large
  const approxPoints = Math.max(1, Math.floor(range / stepMs));
  if (approxPoints > 600) stepMs = Math.ceil(range / 600);

  const points: Reading[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const ts = new Date(t).toISOString();
    points.push(makeReading(q.device_id, ts));
  }

  return { points };
}

export async function getAlerts(device_id: string, from: string, to: string): Promise<AlertItem[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const count = 8;
  const items: AlertItem[] = [];

  for (let i = 0; i < count; i++) {
    const t = fromMs + Math.random() * (toMs - fromMs);
    const ts = new Date(t).toISOString();
    const r = makeReading(device_id, ts);
    const level = r.level === 'DANGER' ? 'DANGER' : r.level === 'WARN' ? 'WARN' : 'INFO';
    items.push({
      id: `${device_id}-${t}-${i}`,
      device_id,
      ts,
      type: r.level === 'SAFE' ? 'system' : 'iaq',
      value: r.iaq,
      level,
      message: r.level === 'SAFE' ? 'Heartbeat ok' : `iaq ${r.iaq} (${r.level})`
    });
  }

  return items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export async function getSettings(device_id: string): Promise<ThresholdSettings> {
  return settingsMap[device_id] || settingsMap['esp32-001'];
}

export async function saveSettings(payload: ThresholdSettings): Promise<{ ok: true }> {
  settingsMap[payload.device_id] = payload;
  return { ok: true };
}
