import express from 'express';
import cors from 'cors';
import { startWebSocketServer } from './websocket.js';
import { startMqttClient } from './mqtt.js';
import apiRouter from './routes.js';

// config
const API_PORT = Number(process.env.API_PORT ?? 3000);
const WS_PORT = Number(process.env.WS_PORT ?? 8080);
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883';
const TOPIC_SUB = process.env.TOPIC_SUB ?? 'hluan/aqm/+/telemetry';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

app.listen(API_PORT, '0.0.0.0', () => console.log(`API on ${API_PORT}`));

startWebSocketServer(WS_PORT);
startMqttClient(MQTT_URL, TOPIC_SUB);