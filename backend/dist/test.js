import mqtt from "mqtt";
import { performance } from "node:perf_hooks";
const client = mqtt.connect("mqtt://broker.emqx.io:1883");
const PUB_TOPIC = "hluan/aqm/esp32-test/telemetry";
const SUB_TOPIC = "hluan/aqm/esp32-test/down";
let sendTime = 0;
client.on("connect", () => {
    console.log("Connected");
    client.subscribe(SUB_TOPIC, () => {
        console.log("Subscribed");
        // bắt đầu đo
        sendTime = performance.now();
        client.publish(PUB_TOPIC, JSON.stringify({ "deviceId": "esp32-test", "ts": 0, "temp": 33.1, "hum": 65.8, "gas": 5.736369, "dust": 0 }), { qos: 0 });
    });
});
client.on("message", (topic, message) => {
    console.log(performance.now() - sendTime);
});
//# sourceMappingURL=test.js.map