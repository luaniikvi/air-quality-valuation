import mqtt from 'mqtt';
import { type Telemetry } from '../../src/types/index.js';
import * as store from './store.js';
import { processor } from './telemetryProcessor.js';
import { broadcastToDevice } from './websocket.js';

export function startMqttClient(mqttUrl: string, topicSub: string): void {
    const mqttClient = mqtt.connect(mqttUrl, {
        clientId: 'aqm-backend-' + Math.random().toString(16).slice(2),
        clean: true,
        reconnectPeriod: 1000,
    });

    mqttClient.on('connect', () => {
        console.log(`[MQTT] Connected -> ${mqttUrl}`);
        mqttClient.subscribe(topicSub, { qos: 0 }, (err) => {
            if (err) console.error('[MQTT] Subscribe error:', err.message);
            else console.log(`[MQTT] Subscribed: ${topicSub}`);
        });
    });

    mqttClient.on('message', (_topic, payload) => {
        const text = payload.toString('utf8');
        try {
            const telemetry = JSON.parse(text) as Telemetry;
            if (!telemetry?.deviceId || typeof telemetry.ts !== 'number') return;

            store.upsertDevice(telemetry.deviceId);

            const processed = processor.ingest(telemetry);
            store.storeProcessed(processed);
            store.pushAlertIfNeeded(processed);

            const stringData = JSON.stringify(processed);
            broadcastToDevice(telemetry.deviceId, stringData);
        } catch { }
    });

    mqttClient.on('error', (e) => console.error('[MQTT] Error:', e.message));
    mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
}