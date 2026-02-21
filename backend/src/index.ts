// bakend/src/index.ts
// - REST API at http://localhost:3000/api
// - WebSocket realtime at ws://localhost:8080
// - Optional MQTT ingest (auto update latest + devices)

import cors from 'cors';
import express from 'express';
import mqtt from 'mqtt';
import { WebSocketServer, WebSocket } from 'ws';

// ===================== Types (match frontend) =====================
type DeviceStatus = 'online' | 'offline';

type Device = {
  device_id: string;
  // NOTE: exactOptionalPropertyTypes=true -> nếu set field thì không được set "undefined".
  // Vì backend này hay dùng "undefined" để clear field, ta cho phép explicit undefined.
  name?: string | undefined;
  location?: string | undefined;
  status?: DeviceStatus | undefined;
  last_seen?: string | undefined; // ISO
};

type Reading = {
  device_id: string;
  ts: string; // ISO
  temp?: number | undefined;
  hum?: number | undefined;
  gas?: number | undefined;
  dust?: number | undefined; // µg/m³ (PM)
  iaq?: number | undefined; // 0..300 (higher = worse)
  aqi?: number | undefined; // alias for older frontend code
  level?: 'SAFE' | 'WARN' | 'DANGER' | undefined;
  rssi?: number | undefined;
};

type ThresholdSettings = {
  device_id: string;
  gas_warn: number;
  gas_danger: number;
  dust_warn: number;
  dust_danger: number;
  temp_low: number;
  temp_high: number;
  hum_low: number;
  hum_high: number;
};

// Incoming telemetry over MQTT (loose typing, tolerant):
type Telemetry = {
  deviceId: string;
  ts: number; // epoch ms (or seconds)
  tempC?: number;
  hum?: number;
  gas?: number;
  dust?: number;
  rssi?: number;
};

// ===================== Helpers =====================
function nowIso() {
  return new Date().toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function toEpochMs(ts: number): number {
  // Heuristic: if ts looks like seconds, convert to ms.
  return ts < 1e12 ? ts * 1000 : ts;
}

function normalizeDustToUgM3(dust: number | undefined): number | undefined {
  if (typeof dust !== 'number' || Number.isNaN(dust)) return undefined;
  // If value is very small, assume it's mg/m³ (e.g. 0.03) => convert to µg/m³.
  if (dust >= 0 && dust <= 1) return Math.round(dust * 1000);
  return Math.round(dust);
}

function computeIAQ(r: { dust?: number | undefined; gas?: number | undefined }) {
  const dust = typeof r.dust === 'number' ? r.dust : 0; // 0..300
  const gas = typeof r.gas === 'number' ? r.gas : 0;

  const dustIdx = clamp(Math.round(dust), 0, 300);
  // Map 200..2000ppm -> 0..300
  const gasIdx = clamp(Math.round(((gas - 200) / 1800) * 300), 0, 300);
  return Math.max(dustIdx, gasIdx);
}

function iaqLevel(iaq: number): 'SAFE' | 'WARN' | 'DANGER' {
  if (iaq <= 100) return 'SAFE';
  if (iaq <= 200) return 'WARN';
  return 'DANGER';
}

function parseIntervalToMs(interval?: string): number {
  if (!interval) return 60_000;
  const m = String(interval).trim().match(/^(\d+)(ms|s|m|h)$/i);
  if (!m) return 60_000;
  const value = Number(m[1]);
  const unit = (m[2] ?? 'm').toLowerCase();
  if (unit === 'ms') return value;
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60_000;
  return value * 3_600_000;
}

// ===================== In-memory store =====================
const devices = new Map<string, Device>();
const latestByDevice = new Map<string, Reading>();
const historyByDevice = new Map<string, Reading[]>();
const settingsByDevice = new Map<string, ThresholdSettings>();

const DEFAULT_SETTINGS: Omit<ThresholdSettings, 'device_id'> = {
  gas_warn: 800,
  gas_danger: 1200,
  dust_warn: 80,
  dust_danger: 150,
  temp_low: 18,
  temp_high: 32,
  hum_low: 35,
  hum_high: 75,
};

function ensureDevice(device_id: string): Device {
  const id = String(device_id || '').trim();
  if (!id) throw new Error('device_id is required');
  const existing = devices.get(id);
  if (existing) return existing;
  const d: Device = { device_id: id, name: id, status: 'offline', last_seen: nowIso() };
  devices.set(id, d);
  // default settings
  settingsByDevice.set(id, { device_id: id, ...DEFAULT_SETTINGS });
  return d;
}

function upsertLatest(r: Reading) {
  latestByDevice.set(r.device_id, r);
  const arr = historyByDevice.get(r.device_id) ?? [];
  arr.push(r);
  // keep last N
  if (arr.length > 5000) arr.splice(0, arr.length - 5000);
  historyByDevice.set(r.device_id, arr);

  const d = ensureDevice(r.device_id);
  d.status = 'online';
  d.last_seen = r.ts;
  devices.set(r.device_id, d);
}

// ===================== Synthetic mode (for dev without hardware) =====================
const ENABLE_SYNTHETIC = String(process.env.ENABLE_SYNTHETIC ?? 'true').toLowerCase() === 'true';
type SynthState = { temp: number; hum: number; gas: number; dust: number; rssi: number };
const synth = new Map<string, SynthState>();

function step(prev: number, delta: number, min: number, max: number) {
  const v = prev + (Math.random() * 2 - 1) * delta;
  return Math.max(min, Math.min(max, v));
}

function makeSyntheticReading(device_id: string, ts: string): Reading {
  const st = synth.get(device_id) ?? {
    temp: 25 + Math.random() * 3,
    hum: 55 + Math.random() * 10,
    gas: 500 + Math.random() * 300,
    dust: 30 + Math.random() * 20,
    rssi: -45 - Math.round(Math.random() * 20),
  };

  st.temp = step(st.temp, 0.2, 10, 45);
  st.hum = step(st.hum, 0.8, 10, 95);
  st.gas = step(st.gas, 15, 200, 2000);
  st.dust = step(st.dust, 1.5, 0, 300);
  st.rssi = Math.round(step(st.rssi, 1.2, -90, -30));

  synth.set(device_id, st);

  const reading: Reading = {
    device_id,
    ts,
    temp: Math.round(st.temp * 10) / 10,
    hum: Math.round(st.hum * 10) / 10,
    gas: Math.round(st.gas),
    dust: Math.round(st.dust),
    rssi: st.rssi,
  };
  reading.iaq = computeIAQ(reading);
  reading.aqi = reading.iaq;
  reading.level = iaqLevel(reading.iaq);
  return reading;
}

function ensureLatestFor(device_id: string): Reading | undefined {
  const existing = latestByDevice.get(device_id);
  if (existing) return existing;
  if (!ENABLE_SYNTHETIC) return undefined;
  const r = makeSyntheticReading(device_id, nowIso());
  upsertLatest(r);
  return r;
}

// ===================== WebSocket server =====================
const WS_PORT = Number(process.env.WS_PORT ?? 8080);
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[WS] Listening ws://localhost:${WS_PORT}`);

type WSClient = WebSocket & { deviceId?: string };

wss.on('connection', (ws: WSClient) => {
  ws.send(JSON.stringify({ type: 'hello', msg: 'connected' }));

  ws.on('message', (buf) => {
    try {
      const m = JSON.parse(buf.toString());
      if (m?.type === 'sub' && typeof m.deviceId === 'string') {
        ws.deviceId = m.deviceId;
        ws.send(JSON.stringify({ type: 'sub_ok', deviceId: ws.deviceId }));
      }
    } catch {
      // ignore
    }
  });
});

function broadcastLatest(deviceId: string, reading: Reading) {
  const msg = JSON.stringify({ type: 'latest', deviceId, reading });
  for (const c of wss.clients) {
    const ws = c as WSClient;
    if (ws.readyState !== ws.OPEN) continue;
    if (ws.deviceId && ws.deviceId !== deviceId) continue;
    ws.send(msg);
  }
}

// ===================== MQTT ingest (optional) =====================
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883';
const TOPIC_SUB = process.env.TOPIC_SUB ?? 'hluan/aqm/+/telemetry';

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: 'aqm-backend-' + Math.random().toString(16).slice(2),
  clean: true,
  reconnectPeriod: 1000,
});

mqttClient.on('connect', () => {
  console.log(`[MQTT] Connected -> ${MQTT_URL}`);
  mqttClient.subscribe(TOPIC_SUB, { qos: 0 }, (err) => {
    if (err) console.error('[MQTT] Subscribe error:', err.message);
    else console.log(`[MQTT] Subscribed: ${TOPIC_SUB}`);
  });
});

mqttClient.on('message', (_topic, payload) => {
  const text = payload.toString('utf8');
  try {
    const t = JSON.parse(text) as Telemetry;
    if (!t?.deviceId || typeof t.ts !== 'number') return;

    const tsIso = new Date(toEpochMs(t.ts)).toISOString();
    const dustUg = normalizeDustToUgM3(t.dust);

    const reading: Reading = {
      device_id: t.deviceId,
      ts: tsIso,
      temp: typeof t.tempC === 'number' ? t.tempC : undefined,
      hum: typeof t.hum === 'number' ? t.hum : undefined,
      gas: typeof t.gas === 'number' ? t.gas : undefined,
      dust: dustUg,
      rssi: typeof t.rssi === 'number' ? t.rssi : undefined,
    };
    reading.iaq = computeIAQ(reading);
    reading.aqi = reading.iaq;
    reading.level = iaqLevel(reading.iaq);

    upsertLatest(reading);
    broadcastLatest(reading.device_id, reading);
  } catch {
    // ignore non-JSON
  }
});

mqttClient.on('error', (e) => console.error('[MQTT] Error:', e.message));
mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));

// ===================== HTTP REST API =====================
const HTTP_PORT = Number(process.env.PORT ?? process.env.HTTP_PORT ?? 3000);

const app = express();
app.use(cors());
app.use(express.json());

const api = express.Router();

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    time: nowIso(),
    mqtt: mqttClient.connected,
    ws_clients: wss.clients.size,
    devices: devices.size,
    synthetic: ENABLE_SYNTHETIC,
  });
});

// Devices
api.get('/devices', (_req, res) => {
  const list = Array.from(devices.values());
  // Most recently seen first
  list.sort((a, b) => String(b.last_seen ?? '').localeCompare(String(a.last_seen ?? '')));
  res.json(list);
});

api.post('/devices', (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<Device>;
    const id = String(body.device_id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'device_id is required' });
    if (devices.has(id)) return res.status(409).json({ error: 'Device already exists' });

    const d: Device = {
      device_id: id,
      name: (body.name ?? '').toString().trim() || id,
      location: (body.location ?? '').toString().trim() || undefined,
      status: 'offline',
      last_seen: nowIso(),
    };
    devices.set(id, d);
    settingsByDevice.set(id, { device_id: id, ...DEFAULT_SETTINGS });

    res.json(d);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

api.patch('/devices/:device_id', (req, res) => {
  const id = String(req.params.device_id ?? '').trim();
  const d = devices.get(id);
  if (!d) return res.status(404).json({ error: 'Device not found' });

  const body = (req.body ?? {}) as Partial<Device>;
  if (body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    d.name = name || undefined;
  }
  if (body.location !== undefined) {
    const loc = String(body.location ?? '').trim();
    d.location = loc || undefined;
  }
  d.last_seen = nowIso();
  devices.set(id, d);
  res.json(d);
});

api.delete('/devices/:device_id', (req, res) => {
  const id = String(req.params.device_id ?? '').trim();
  if (!devices.has(id)) return res.status(404).json({ error: 'Device not found' });
  devices.delete(id);
  latestByDevice.delete(id);
  historyByDevice.delete(id);
  settingsByDevice.delete(id);
  synth.delete(id);
  res.json({ ok: true });
});

// Latest
api.get('/latest', (req, res) => {
  const id = String(req.query.device_id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'device_id is required' });

  ensureDevice(id);
  const r = ensureLatestFor(id);
  if (!r) return res.status(404).json({ error: 'No data for this device' });
  res.json(r);
});

// History
api.get('/history', (req, res) => {
  const id = String(req.query.device_id ?? '').trim();
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  const interval = req.query.interval ? String(req.query.interval) : undefined;
  if (!id || !from || !to) return res.status(400).json({ error: 'device_id, from, to are required' });

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return res.status(400).json({ error: 'Invalid from/to' });
  }

  // Prefer real stored history
  const stored = historyByDevice.get(id) ?? [];
  const pointsReal = stored.filter((p) => {
    const t = new Date(p.ts).getTime();
    return t >= fromMs && t <= toMs;
  });
  if (pointsReal.length > 0) {
    return res.json({ points: pointsReal });
  }

  // Fallback: synthetic history (dev)
  if (!ENABLE_SYNTHETIC) return res.json({ points: [] });

  let stepMs = parseIntervalToMs(interval);
  const range = Math.max(0, toMs - fromMs);
  const approxPoints = Math.max(1, Math.floor(range / stepMs));
  if (approxPoints > 600) stepMs = Math.ceil(range / 600);

  const points: Reading[] = [];
  ensureDevice(id);
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const ts = new Date(t).toISOString();
    const r = makeSyntheticReading(id, ts);
    points.push(r);
  }
  // Update latest store with the last point
  const last = points.at(-1);
  if (last) upsertLatest(last);
  res.json({ points });
});

// Alerts (simple derived)
api.get('/alerts', (req, res) => {
  const id = String(req.query.device_id ?? '').trim();
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  if (!id || !from || !to) return res.status(400).json({ error: 'device_id, from, to are required' });

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const stored = historyByDevice.get(id) ?? [];
  const items = stored
    .filter((p) => {
      const t = new Date(p.ts).getTime();
      return t >= fromMs && t <= toMs;
    })
    .filter((p) => p.level && p.level !== 'SAFE')
    .slice(-200)
    .reverse()
    .map((p, idx) => ({
      id: `${id}-${p.ts}-${idx}`,
      device_id: id,
      ts: p.ts,
      type: 'iaq',
      value: p.iaq,
      level: p.level === 'DANGER' ? 'DANGER' : 'WARN',
      message: `IAQ ${p.iaq} (${p.level})`,
    }));

  res.json(items);
});

// Settings
api.get('/settings', (req, res) => {
  const id = String(req.query.device_id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'device_id is required' });
  ensureDevice(id);
  res.json(settingsByDevice.get(id) ?? { device_id: id, ...DEFAULT_SETTINGS });
});

api.post('/settings', (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<ThresholdSettings>;
    const id = String(body.device_id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'device_id is required' });
    ensureDevice(id);

    const payload: ThresholdSettings = {
      device_id: id,
      gas_warn: Number(body.gas_warn ?? DEFAULT_SETTINGS.gas_warn),
      gas_danger: Number(body.gas_danger ?? DEFAULT_SETTINGS.gas_danger),
      dust_warn: Number(body.dust_warn ?? DEFAULT_SETTINGS.dust_warn),
      dust_danger: Number(body.dust_danger ?? DEFAULT_SETTINGS.dust_danger),
      temp_low: Number(body.temp_low ?? DEFAULT_SETTINGS.temp_low),
      temp_high: Number(body.temp_high ?? DEFAULT_SETTINGS.temp_high),
      hum_low: Number(body.hum_low ?? DEFAULT_SETTINGS.hum_low),
      hum_high: Number(body.hum_high ?? DEFAULT_SETTINGS.hum_high),
    };
    settingsByDevice.set(id, payload);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

app.use('/api', api);

app.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Listening http://localhost:${HTTP_PORT}/api`);
});
