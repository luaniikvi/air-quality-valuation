// backend/src/index.ts
import mqtt from "mqtt";
import { processor, type Telemetry } from "./telemetryProcessor.js";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://broker.emqx.io:1883";
const TOPIC_SUB = process.env.TOPIC_SUB ?? "hluan/aqm/+/telemetry";

const client = mqtt.connect(MQTT_URL, {
    clientId: "backend-ts-" + Math.random().toString(16).slice(2),
    clean: true,
    reconnectPeriod: 1000,
});

client.on("connect", () => {
    console.log(`[MQTT] Connected -> ${MQTT_URL}`);
    client.subscribe(TOPIC_SUB, { qos: 0 }, (err) => {
        if (err) console.error("[MQTT] Subscribe error:", err.message);
        else console.log(`[MQTT] Subscribed: ${TOPIC_SUB}`);
    });
});

client.on("message", (topic, payload) => {
    const text = payload.toString("utf8");

    try {
        const t = JSON.parse(text) as Telemetry;

        if (!t.deviceId || typeof t.ts !== "number") return;

        const derived = processor.ingest(t);

        // In ra terminal realtime
        console.log(
            `[${/*new Date().toISOString()*/t.ts}] ${derived.deviceId} | score=${derived.IAQ} | ${derived.level}` +
            ` | gasEma=${t.gas} | dustEma=${t.dust}`
        );
    } catch {
        // payload không phải JSON thì bỏ qua hoặc log raw
        console.log("[MQTT] Non-JSON:", topic, text);
    }
});

client.on("error", (e) => console.error("[MQTT] Error:", e.message));
client.on("reconnect", () => console.log("[MQTT] Reconnecting..."));
