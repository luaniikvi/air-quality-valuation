import mqtt from 'mqtt';
import { type Telemetry } from '../../src/types/index.js';
import * as store from './store.js';
import { processor } from './telemetryProcessor.js';
import { broadcastToDevice } from './websocket.js';
import * as repo from './repo.js';
import { dbEnabled } from './db.js';

function normalizeTelemetry(raw: any): Telemetry | null {
    if (!raw) return null;
    const deviceId = typeof raw.deviceId === 'string' ? raw.deviceId.trim() : '';
    if (!deviceId) return null;

    let ts = Number(raw.ts);
    if (!Number.isFinite(ts)) return null;
    // If firmware accidentally sends milliseconds, normalize to seconds.
    if (ts > 20_000_000_000) ts = Math.trunc(ts / 1000);

    const n = (v: any): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const x = Number(v);
        return Number.isFinite(x) ? x : undefined;
    };

    return {
        deviceId,
        ts,
        temp: n(raw.temp),
        hum: n(raw.hum),
        gas: n(raw.gas),
        dust: n(raw.dust),
    };
}

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
        void (async () => {
            try {
                const telemetry = normalizeTelemetry(JSON.parse(text)) as Telemetry;
                console.log('Telemetry:', JSON.stringify(telemetry));
                if (!telemetry) return;

                const registered = dbEnabled()
                    ? await repo.deviceExists(telemetry.deviceId)
                    : !!store.getDevice(telemetry.deviceId);

                if (!registered) {
                    return;
                }

                store.touchDevice(telemetry.deviceId, telemetry.ts);

                const processed = processor.ingest(telemetry);
                store.storeProcessed(processed);
                const alert = store.pushAlertIfNeeded(processed);

                if (dbEnabled()) {
                    await repo.touchDeviceLastSeen(telemetry.deviceId, telemetry.ts);
                    await repo.insertTelemetry(processed);
                    if (alert) await repo.insertAlert(alert);
                }

                // realtime
                broadcastToDevice(telemetry.deviceId, JSON.stringify(processed));
            } catch {
                // ignore malformed payloads
            }
        })();
    });

    mqttClient.on('error', (e) => console.error('[MQTT] Error:', e.message));
    mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
}