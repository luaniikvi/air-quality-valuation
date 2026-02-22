// backend/src/index.ts
// REST API:     http://localhost:3000/api
// WebSocket:    ws://localhost:8080  (subscribe: {type:'sub', deviceId})
// MQTT ingest:  subscribes TOPIC_SUB and pushes processed frames to WS + stores for REST

import express from 'express';
import cors from 'cors';
import mqtt from 'mqtt';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

import type { AlertItem, Device, Telemetry, Processed, ThresholdSettings, HistoryResponse } from '../../src/types/index.js';
import { processor } from './telemetryProcessor.js';

// ===================== config =====================
const API_PORT = Number(process.env.API_PORT ?? 3000);
const WS_PORT = Number(process.env.WS_PORT ?? 8080);

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883';
const TOPIC_SUB = process.env.TOPIC_SUB ?? 'hluan/aqm/+/telemetry';

// ===================== in-memory store (simple, for demo/dev) =====================
const devices = new Map<string, Device>();
const latestByDevice = new Map<string, Processed>();
const historyByDevice = new Map<string, Processed[]>();
const alertsByDevice = new Map<string, AlertItem[]>();
const settingsByDevice = new Map<string, ThresholdSettings>();

function nowMs() {
  return Date.now();
}

function tsToMs(ts: number) {
  // accept seconds or millis
  return ts < 1e12 ? ts * 1000 : ts;
}

function parseIntervalToMs(interval?: string): number {
  if (!interval) return 60_000;
  const m = interval.trim().match(/^(\d+)(ms|s|m|h)$/i);
  if (!m) return 60_000;
  const value = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (unit === 'ms') return value;
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60_000;
  return value * 3_600_000;
}

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
    hum_high: 75,
  };
}

function getSettingsOrDefault(device_id: string) {
  const s = settingsByDevice.get(device_id);
  if (s) return s;
  const d = defaultSettings(device_id);
  settingsByDevice.set(device_id, d);
  return d;
}

function computeStatus(last_seen?: number): Device['status'] {
  if (!last_seen) return 'offline';
  return nowMs() - last_seen < 30_000 ? 'online' : 'offline';
}

function upsertDeviceFromTelemetry(deviceId: string, ts: number) {
  const prev = devices.get(deviceId);
  const last_seen = tsToMs(ts);
  const next: Device = {
    device_id: deviceId,
    name: prev?.name ?? "",
    location: prev?.location ?? "",
    last_seen,
    status: 'online',
  };
  devices.set(deviceId, next);
}

function storeProcessed(p: Processed) {
  latestByDevice.set(p.deviceId, p);

  const arr = historyByDevice.get(p.deviceId) ?? [];
  arr.push(p);
  // keep last N points to avoid memory blow
  if (arr.length > 5000) arr.splice(0, arr.length - 5000);
  historyByDevice.set(p.deviceId, arr);
}

function pushAlertIfNeeded(p: Processed) {
  if (p.level !== 'WARN' && p.level !== 'DANGER') return;

  const list = alertsByDevice.get(p.deviceId) ?? [];
  const last = list[0];
  // avoid spamming: only push if level changed or 60s passed
  const lastTs = last ? tsToMs(last.ts) : 0;
  const thisTs = tsToMs(p.ts);
  const changed = !last || last.level !== (p.level === 'WARN' ? 'WARN' : 'DANGER');
  const stale = thisTs - lastTs > 60_000;

  if (changed || stale) {
    const level: AlertItem['level'] = p.level === 'WARN' ? 'WARN' : 'DANGER';
    const msg = p.level === 'WARN' ? 'Chất lượng không khí đang ở mức cảnh báo' : 'Chất lượng không khí nguy hiểm!';
    const item: AlertItem = {
      id: randomUUID(),
      device_id: p.deviceId,
      ts: thisTs,
      type: 'iaq',
      value: typeof p.IAQ === 'number' ? p.IAQ : -1,
      level,
      message: msg,
    };
    list.unshift(item);
    if (list.length > 500) list.splice(500);
    alertsByDevice.set(p.deviceId, list);
  }
}

// ===================== WebSocket server =====================
type WSClient = WebSocket & { deviceId?: string };

const wss = new WebSocketServer({ port: WS_PORT }, () => {
  console.log(`[WS] WebSocket Server đang chạy ở port ${WS_PORT}`);
});

wss.on('connection', (ws: WSClient) => {
  ws.send(JSON.stringify({ type: 'hello', msg: 'connected' }));

  ws.on('message', (buf) => {
    try {
      const m = JSON.parse(buf.toString());
      if (m?.type === 'sub' && typeof m.deviceId === 'string') {
        ws.deviceId = m.deviceId;
        ws.send(JSON.stringify({ type: 'sub_ok', deviceId: ws.deviceId }));
      }
    } catch { }
  });
});

function broadcastToDevice(deviceId: string, payload: string) {
  wss.clients.forEach((client: WSClient) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.deviceId !== deviceId) return;
    client.send(payload);
  });
}

// ===================== REST API =====================
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/devices', (_req, res) => {
  const list = Array.from(devices.values()).map((d) => ({
    ...d,
    status: computeStatus(d.last_seen),
  }));
  res.json(list);
});

app.post('/api/devices', (req, res) => {
  const body = (req.body ?? {}) as Partial<Device>;
  const device_id = String(body.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  const prev = devices.get(device_id);
  const next: Device = {
    device_id,
    name: (typeof body.name === 'string' ? body.name : prev?.name) ?? "",
    location: (typeof body.location === 'string' ? body.location : prev?.location ?? ""),
    last_seen: prev?.last_seen ?? nowMs(),
    status: computeStatus(prev?.last_seen ?? nowMs()) ?? 'offline',
  };
  devices.set(device_id, next);
  res.json(next);
});

app.patch('/api/devices/:device_id', (req, res) => {
  const device_id = String(req.params.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  const prev = devices.get(device_id);
  if (!prev) return res.status(404).json({ message: 'Device not found' });

  const patch = (req.body ?? {}) as Partial<Device>;
  const next: Device = {
    ...prev,
    name: (typeof patch.name === 'string' ? patch.name : prev.name) ?? "",
    location: (typeof patch.location === 'string' ? patch.location : prev.location) ?? "",
  };
  devices.set(device_id, next);
  res.json(next);
});

app.delete('/api/devices/:device_id', (req, res) => {
  const device_id = String(req.params.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  devices.delete(device_id);
  latestByDevice.delete(device_id);
  historyByDevice.delete(device_id);
  alertsByDevice.delete(device_id);
  settingsByDevice.delete(device_id);

  res.json({ ok: true });
});

app.get('/api/latest', (req, res) => {
  const device_id = String(req.query.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  const v = latestByDevice.get(device_id);
  if (v) return res.json(v);

  // return a safe placeholder (avoid breaking UI)
  const placeholder: Processed = {
    deviceId: device_id,
    ts: nowMs(),
    temp: undefined,
    hum: undefined,
    gas: undefined,
    dust: undefined,
    IAQ: undefined,
    level: '...',
  };
  return res.json(placeholder);
});

app.get('/api/history', (req, res) => {
  const device_id = String(req.query.device_id ?? '').trim();
  const fromIso = String(req.query.from ?? '').trim();
  const toIso = String(req.query.to ?? '').trim();
  const interval = String(req.query.interval ?? '').trim();

  if (!device_id) return res.status(400).json({ message: 'device_id is required' });
  if (!fromIso || !toIso) return res.status(400).json({ message: 'from/to are required' });

  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return res.status(400).json({ message: 'from/to must be ISO datetime' });
  }

  const raw = historyByDevice.get(device_id) ?? [];
  const filtered = raw.filter((p) => {
    const t = tsToMs(p.ts);
    return t >= fromMs && t <= toMs;
  });

  const step = parseIntervalToMs(interval || '60s');
  // downsample: keep 1 point per interval bucket
  const out: Processed[] = [];
  let bucketStart = -Infinity;
  for (const p of filtered) {
    const t = tsToMs(p.ts);
    if (t - bucketStart >= step) {
      out.push(p);
      bucketStart = t;
    }
  }

  const resp: HistoryResponse = { points: out };
  res.json(resp);
});

app.get('/api/alerts', (req, res) => {
  const device_id = String(req.query.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  const fromIso = String(req.query.from ?? '').trim();
  const toIso = String(req.query.to ?? '').trim();
  const fromMs = fromIso ? Date.parse(fromIso) : 0;
  const toMs = toIso ? Date.parse(toIso) : nowMs();

  const list = alertsByDevice.get(device_id) ?? [];
  const filtered = list.filter((a) => {
    const t = tsToMs(a.ts);
    return (!Number.isFinite(fromMs) || t >= fromMs) && (!Number.isFinite(toMs) || t <= toMs);
  });
  res.json(filtered);
});

app.get('/api/settings', (req, res) => {
  const device_id = String(req.query.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });
  res.json(getSettingsOrDefault(device_id));
});

app.post('/api/settings', (req, res) => {
  const body = (req.body ?? {}) as Partial<ThresholdSettings>;
  const device_id = String(body.device_id ?? '').trim();
  if (!device_id) return res.status(400).json({ message: 'device_id is required' });

  const next: ThresholdSettings = {
    ...getSettingsOrDefault(device_id),
    ...body,
    device_id,
  } as ThresholdSettings;

  settingsByDevice.set(device_id, next);
  res.json({ ok: true });
});

app.listen(API_PORT, () => {
  console.log(`[API] REST API đang chạy ở port ${API_PORT} (base: http://localhost:${API_PORT}/api)`);
});

// ===================== MQTT ingest (optional) =====================
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
    const telemetry = JSON.parse(text) as Telemetry;
    if (!telemetry?.deviceId || typeof telemetry.ts !== 'number') return;

    // update in-memory for REST
    upsertDeviceFromTelemetry(telemetry.deviceId, telemetry.ts);

    const processed = processor.ingest(telemetry);
    storeProcessed(processed);
    pushAlertIfNeeded(processed);

    // push realtime to subscribed WS clients
    // const frame = JSON.stringify(processed);
    // broadcastToDevice(telemetry.deviceId, frame);
    const stringData: string = JSON.stringify(processed)
    wss.clients.forEach((client: WSClient) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.deviceId !== telemetry.deviceId) return;
      client.send(stringData);
    });
  } catch { }
});

mqttClient.on('error', (e) => console.error('[MQTT] Error:', e.message));
mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
