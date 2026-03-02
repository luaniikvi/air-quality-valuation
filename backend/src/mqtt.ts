import mqtt, { MqttClient, type IClientOptions } from 'mqtt';
import { type Telemetry } from './types.js';
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
let gClient: MqttClient | null = null;

export function startMqttClient(mqttUrl: string, topicSub: string): void {
    // tránh tạo nhiều client nếu hàm bị gọi lại
    if (gClient && !gClient.disconnected) return;

    const opts: IClientOptions = {
        clientId: 'aqm-' + Math.random().toString(16).slice(2, 10),
        clean: true,
        protocolVersion: 4,       // MQTT 3.1.1
        keepalive: 30,
        connectTimeout: 10_000,
        reconnectPeriod: 2000,
        resubscribe: true,
        // nếu broker cần auth thì mở 2 dòng dưới:
        // username: process.env.MQTT_USER,
        // password: process.env.MQTT_PASS,
    };

    const mqttClient = mqtt.connect(mqttUrl, opts);
    gClient = mqttClient;

    mqttClient.on('connect', () => {
        console.log(`[MQTT] Connected -> ${mqttUrl}`);
        mqttClient.subscribe(topicSub, { qos: 0 }, (err) => {
            if (err) console.error('[MQTT] Subscribe error:', err);
            else console.log(`[MQTT] Subscribed: ${topicSub}`);
        });
    });

    mqttClient.on('message', (_topic, payload) => {
        const text = payload.toString('utf8');
        void (async () => {
            try {
                const telemetry = normalizeTelemetry(JSON.parse(text)) as Telemetry;
                if (!telemetry) return;

                const registered = dbEnabled()
                    ? await repo.deviceExists(telemetry.deviceId)
                    : !!store.getDevice(telemetry.deviceId);

                if (!registered) return;

                let settings = store.peekSettings(telemetry.deviceId);
                if (!settings && dbEnabled()) {
                    try {
                        const dbS = await repo.getSettings(telemetry.deviceId);
                        if (dbS) {
                            store.setSettings(telemetry.deviceId, dbS);
                            settings = dbS;
                        }
                    } catch { }
                }
                if (!settings) settings = store.getSettings(telemetry.deviceId);

                const seenTs = store.nowTs();
                store.touchDevice(telemetry.deviceId, seenTs);

                const processed = processor.ingest(telemetry, settings);
                store.storeProcessed(processed);
                const alert = store.pushAlertIfNeeded(processed);

                if (dbEnabled()) {
                    await repo.touchDeviceLastSeen(telemetry.deviceId, seenTs);
                    await repo.insertTelemetry(processed);
                    if (alert) await repo.insertAlert(alert);
                }

                broadcastToDevice(telemetry.deviceId, JSON.stringify(processed));
            } catch {
                // ignore malformed payloads
            }
        })();
    });

    // log lỗi đầy đủ để biết chính xác bị gì trên host
    mqttClient.on('error', (e: any) => {
        console.error('[MQTT] Error:', {
            message: e?.message,
            code: e?.code,
            name: e?.name,
        });
    });
    mqttClient.on('close', () => console.warn('[MQTT] Close'));
    mqttClient.on('offline', () => console.warn('[MQTT] Offline'));
    mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
}