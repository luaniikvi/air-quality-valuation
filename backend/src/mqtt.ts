import mqtt, { MqttClient, type IClientOptions } from 'mqtt';
import { type Telemetry } from './types.js';
import * as store from './store.js';
import { processor } from './telemetryProcessor.js';
import { broadcastToDevice } from './websocket.js';
import * as repo from './repo.js';
import { dbEnabled } from './db.js';

function publishToEsp32(deviceId: string, payloadObj: any) {
    if (!gClient || gClient.disconnected) return;
    const topicDown = `hluan/aqm/${deviceId}/down`;
    const payload = JSON.stringify(payloadObj);
    gClient.publish(topicDown, payload, { qos: 0, retain: false }, (err) => {
        if (err) console.error('[MQTT] Publish to ESP32 error:', err);
    });
}

function normalizeTelemetry(raw: any): Telemetry | null {
    if (!raw) return null;
    const deviceId = typeof raw.deviceId === 'string' ? raw.deviceId.trim() : '';
    if (!deviceId) return null;

    let ts = Number(raw.ts);
    if (!Number.isFinite(ts)) return null;
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
    if (gClient && !gClient.disconnected) return;

    const opts: IClientOptions = {
        clientId: 'aqm-' + Math.random().toString(16).slice(2, 10),
        clean: true,
        protocolVersion: 4,       // MQTT 3.1.1
        keepalive: 30,
        connectTimeout: 10_000,
        reconnectPeriod: 2000,
        resubscribe: true,
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
                if (!telemetry) return; // wrong format
                console.log(JSON.stringify(telemetry));

                let deviceSettings = store.peekSettings(telemetry.deviceId);
                if (!deviceSettings && dbEnabled()) {
                    try {
                        const dbSettings = await repo.getSettings(telemetry.deviceId);
                        if (dbSettings) {
                            store.setSettings(telemetry.deviceId, dbSettings);
                            deviceSettings = dbSettings;
                        }
                    } catch {
                        // ignore settings lookup errors for realtime path
                    }
                }
                if (!deviceSettings) deviceSettings = store.getSettings(telemetry.deviceId);

                const processed = processor.ingest(telemetry);

                // Reply to ESP32 even if the device has not been registered in the dashboard.
                publishToEsp32(telemetry.deviceId, {
                    ts: telemetry.ts,
                    iaq: processed.IAQ,
                    level: processed.level,
                    led_enabled: deviceSettings.led_enabled,
                    buzzer_enabled: deviceSettings.buzzer_enabled,
                });

                // save into db if has been registered
                const registered = dbEnabled()
                    ? await repo.deviceExists(telemetry.deviceId)
                    : !!store.getDevice(telemetry.deviceId);

                if (!registered) return;

                const seenTs = store.nowTs();
                store.touchDevice(telemetry.deviceId, seenTs);

                store.storeProcessed(processed);
                const alert = store.pushAlertIfNeeded(processed);

                if (dbEnabled()) {
                    await repo.touchDeviceLastSeen(telemetry.deviceId, seenTs);
                    await repo.insertTelemetry(processed);
                    if (alert) await repo.insertAlert(alert);
                }

                broadcastToDevice(telemetry.deviceId, JSON.stringify(processed));
            } catch (err) {
                console.error(
                    '[MQTT] Message handling error:',
                    { error: err instanceof Error ? err.message : String(err), payload: text }
                );
            }
        })();
    });

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
