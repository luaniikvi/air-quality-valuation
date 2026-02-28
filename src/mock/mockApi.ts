import type { AlertItem, Device, HistoryQuery, HistoryResponse, ThresholdSettings } from '../types';
import { iaqCalculate, iaqToLevel } from '../../backend/src/telemetryProcessor';
import type { Processed } from '../types';

// Start EMPTY: user must add devices manually.
const devices: Device[] = [];

const settingsMap: Record<string, ThresholdSettings> = {};

function defaultSettings(device_id: string): ThresholdSettings {
  return {
    device_id,
    gas_warn: 800,
    gas_danger: 1200,
    dust_warn: 0.08,
    dust_danger: 0.15,
    temp_low: 18,
    temp_high: 32,
    hum_low: 35,
    hum_high: 75
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
      IAQ: iaqCalculate(randomData[0], randomData[1], randomData[3], randomData[2]),
      level: iaqToLevel(iaqCalculate(randomData[0], randomData[1], randomData[3], randomData[2]))
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
    IAQ: iaqCalculate(temp, hum, dust, gas),
    level: iaqToLevel(iaqCalculate(temp, hum, dust, gas))
  };
  const iaq = iaqCalculate(reading.temp, reading.hum, reading.dust, reading.gas);
  reading.IAQ = iaq;
  reading.level = iaqToLevel(reading.IAQ);

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
  const count = 8;
  const items: AlertItem[] = [];

  for (let i = 0; i < count; i++) {
    const t = fromSec + Math.random() * (toSec - fromSec);
    const r = makeReading(device_id);
    const level = r.level === 'DANGER' ? 'DANGER' : r.level === 'WARN' ? 'WARN' : 'INFO';
    items.push({
      id: `${device_id}-${t}-${i}`,
      device_id,
      ts: Math.trunc(t),
      type: r.level === 'SAFE' ? 'system' : 'iaq',
      value: r.IAQ,
      level,
      message: r.level === 'SAFE' ? 'Heartbeat ok' : `iaq ${r.IAQ} (${r.level})`
    });
  }

  return items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export async function getSettings(device_id: string): Promise<ThresholdSettings> {
  const id = String(device_id || '').trim();
  if (!id) throw new Error('device_id is required');
  if (!settingsMap[id]) settingsMap[id] = defaultSettings(id);
  return settingsMap[id];
}

export async function saveSettings(payload: ThresholdSettings): Promise<{ ok: true }> {
  settingsMap[payload.device_id] = payload;
  return { ok: true };
}
