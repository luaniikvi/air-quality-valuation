import type { AlertItem, Device, HistoryQuery, HistoryResponse, IaqSettings, Processed } from '../types';
// Pure functions (no Node-only APIs) -> safe to reuse for mock generation
import { iaqCalculate, iaqToLevel } from '../../backend/src/telemetryProcessor';

// Start EMPTY: user must add devices manually.
const devices: Device[] = [];

const settingsMap: Record<string, IaqSettings> = {};

function defaultSettings(device_id: string): IaqSettings {
  return {
    device_id,

    iaq_method: 'WEIGHTED_HARMONIC',
    w_temp: 0.10,
    w_hum: 0.10,
    w_dust: 0.45,
    w_gas: 0.35,
    temp_a: 22,
    temp_b: 26,
    temp_c: 32,
    temp_d: 38,
    hum_a: 40,
    hum_b: 55,
    hum_c: 80,
    hum_d: 95,
    dust_good: 0.05,
    dust_bad: 0.20,
    gas_good: 300,
    gas_bad: 1500,
    iaq_safe: 80,
    iaq_warn: 60,
  };
}

const lastByDevice: Record<string, Processed> = {};

function rand(n: number) {
  return Math.random() * n;
}

function step(prev: number, delta: number, min: number, max: number) {
  const v = prev + (Math.random() * 2 - 1) * delta;
  return Math.max(min, Math.min(max, v));
}

function parseIntervalToSec(interval?: string): number {
  if (!interval) return 60;
  const m = interval.trim().match(/^(\d+)(ms|s|m|h)$/i);
  if (!m) return 60;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'ms') return Math.max(1, Math.trunc(value / 1000));
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  return value * 3600;
}

function makeReading(device_id: string, ts = Math.trunc(Date.now() / 1000)): Processed {
  const s = settingsMap[device_id] ?? (settingsMap[device_id] = defaultSettings(device_id));
  const prev = lastByDevice[device_id];
  const randomData: number[] = [
    25 + rand(3),
    55 + rand(10),
    500 + rand(300),
    0.03 + rand(0.03),
  ];
  const base: Processed = prev
    ? { ...prev, ts }
    : {
      deviceId: device_id,
      ts,
      temp: randomData[0],
      hum: randomData[1],
      gas: randomData[2],
      dust: randomData[3],
      IAQ: iaqCalculate(randomData[0], randomData[1], randomData[3], randomData[2], s),
      level: iaqToLevel(iaqCalculate(randomData[0], randomData[1], randomData[3], randomData[2], s), s)
    };

  const temp = step(base.temp ?? 25, 0.2, 10, 45);
  const hum = step(base.hum ?? 55, 0.8, 10, 95);
  const gas = step(base.gas ?? 600, 15, 200, 2000);
  const dust = step(base.dust ?? 0.04, 0.002, 0, 0.3);


  const reading: Processed = {
    deviceId: device_id,
    ts: ts,
    temp: Math.round(temp * 10) / 10,
    hum: Math.round(hum * 10) / 10,
    gas: Math.round(gas),
    dust: Math.round(dust * 1000) / 1000,
    IAQ: iaqCalculate(temp, hum, dust, gas, s),
    level: iaqToLevel(iaqCalculate(temp, hum, dust, gas, s), s)
  };
  const iaq = iaqCalculate(reading.temp, reading.hum, reading.dust, reading.gas, s);
  reading.IAQ = iaq;
  reading.level = iaqToLevel(reading.IAQ, s);

  lastByDevice[device_id] = reading;
  return reading;
}

export async function getDevices(): Promise<Device[]> {
  return devices.map((d) => ({ ...d, last_seen: Math.trunc(Date.now() / 1000) }));
}

export async function addDevice(payload: Device): Promise<Device> {
  const id = String(payload.device_id || '').trim();
  if (!id) throw new Error('device_id is required');

  const exists = devices.find((d) => d.device_id === id);
  if (exists) throw new Error('Device already exists');

  const dev: Device = {
    device_id: id,
    name: (payload.name || '').trim() || id,
    status: 'online',
    last_seen: Math.trunc(Date.now() / 1000)
  };

  devices.unshift(dev);

  // Default settings for the new device
  settingsMap[id] = defaultSettings(id);

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

  // Apply only known fields
  if (patch.name !== undefined) dev.name = name || undefined;

  dev.last_seen = Math.trunc(Date.now() / 1000);
  return { ...dev };
}

export async function getLatest(device_id: string): Promise<Processed> {
  return makeReading(device_id);
}

export async function getHistory(q: HistoryQuery): Promise<HistoryResponse> {
  const fromSec = Math.trunc(new Date(q.from).getTime() / 1000);
  const toSec = Math.trunc(new Date(q.to).getTime() / 1000);
  const rangeSec = Math.max(0, toSec - fromSec);

  let stepSec = parseIntervalToSec(q.interval);
  // auto step if range too large
  const approxPoints = Math.max(1, Math.floor(rangeSec / stepSec));
  if (approxPoints > 600) stepSec = Math.ceil(rangeSec / 600);

  const points: Processed[] = [];
  for (let t = fromSec; t <= toSec; t += stepSec) {
    points.push(makeReading(q.device_id, t));
  }

  return { points };
}

export async function getAlerts(device_id: string, from: string, to: string): Promise<AlertItem[]> {
  const fromSec = Math.trunc(new Date(from).getTime() / 1000);
  const toSec = Math.trunc(new Date(to).getTime() / 1000);
  const count = 12;
  const items: AlertItem[] = [];

  for (let i = 0; i < count; i++) {
    const ts = Math.trunc(fromSec + Math.random() * Math.max(1, toSec - fromSec));

    // Generate a plausible IAQ + level distribution
    const roll = Math.random();
    const level: AlertItem['level'] = roll < 0.2 ? 'DANGER' : roll < 0.6 ? 'WARN' : 'SAFE';
    const iaq = level === 'DANGER' ? 35 + Math.random() * 20 : level === 'WARN' ? 60 + Math.random() * 15 : 85 + Math.random() * 10;

    items.push({
      id: `${device_id}-${ts}-${i}`,
      device_id,
      ts,
      iaq: Math.trunc(iaq),
      level,
    });
  }

  return items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export async function getSettings(device_id: string): Promise<IaqSettings> {
  const id = String(device_id || '').trim();
  if (!id) throw new Error('device_id is required');
  if (!settingsMap[id]) settingsMap[id] = defaultSettings(id);
  return settingsMap[id];
}

export async function saveSettings(payload: IaqSettings): Promise<{ ok: true }> {
  settingsMap[payload.device_id] = payload;
  return { ok: true };
}