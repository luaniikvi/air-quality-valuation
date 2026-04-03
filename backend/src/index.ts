import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startWebSocketServer } from './websocket.js';
import { startMqttClient } from './mqtt.js';
import apiRouter from './routes.js';
import { dbEnabled, dbPingDetailed } from './db.js';

dotenv.config();


const API_PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 8080);
const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : undefined;
const WS_PATH = process.env.WS_PATH ?? '/ws';
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883';
const TOPIC_SUB = process.env.TOPIC_SUB ?? 'hluan/aqm/+/telemetry';

const app = express();
const corsOrigin = String(process.env.CORS_ORIGIN ?? '').trim();
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : undefined));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST
    ? path.resolve(process.env.WEB_DIST)
    : path.resolve(__dirname, '../../dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
    console.log(`[WEB] Serving static from ${webDist}`);
    app.use(express.static(webDist));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
} else {
    console.log('[WEB] dist/ not found -> API-only mode');
}

const server = http.createServer(app);
server.listen(API_PORT, '0.0.0.0', () => console.log(`HTTP on ${API_PORT}`));

if (typeof WS_PORT === 'number' && Number.isFinite(WS_PORT)) {
    startWebSocketServer(WS_PORT);
} else {
    startWebSocketServer({ server, path: WS_PATH });
}

startMqttClient(MQTT_URL, TOPIC_SUB);

void (async () => {
    if (!dbEnabled()) {
        console.log('[DB] MYSQL_* env not set -> running without MySQL persistence');
        return;
    }
    const r = await dbPingDetailed();
    if (r.ok) console.log('[DB] Connected');
    else console.error('[DB] Connection failed:', r.error);
})();