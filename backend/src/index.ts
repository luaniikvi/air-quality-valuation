// bakend/src/index.ts
// - REST API at http://localhost:3000/api
// - WebSocket realtime at ws://localhost:8080
// - Optional MQTT ingest (auto update latest + devices)

import mqtt from 'mqtt';
import { WebSocketServer, WebSocket } from 'ws';
import type { Telemetry, Processed } from "../../src/types/index.js";
import { processor } from './telemetryProcessor.js';



// ===================== WebSocket server =====================
const WS_PORT = Number(process.env.WS_PORT ?? 8080);
const wss = new WebSocketServer({ port: 8080 }, () => {
  console.log(`[WS] WebSocket Server đang chạy ở port ${WS_PORT}`);
});

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
    } catch { }
  });
});

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
    const telemetry = JSON.parse(text) as Telemetry;
    if (!telemetry?.deviceId || typeof telemetry.ts !== 'number') return;

    const stringData: string = JSON.stringify(processor.ingest(telemetry))
    wss.clients.forEach((client: WSClient) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.deviceId !== telemetry.deviceId) return;
      client.send(stringData);
    });
  } catch { }
});

mqttClient.on('error', (e) => console.error('[MQTT] Error:', e.message));
mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
