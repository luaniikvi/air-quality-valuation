import { processor } from "./telemetryProcessor.js";

console.log(processor.ingest({
    deviceId: "test2",
    ts: Date.now(),
    tempC: 24,
    hum: 50,
    dust: 0.25,
    gas: 300
}))