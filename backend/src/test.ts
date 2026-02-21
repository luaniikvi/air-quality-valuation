import { processor } from "./telemetryProcessor.js";

console.log(processor.ingest({
    deviceId: "test2",
    ts: Date.now(),
    temp: 24,
    hum: 50,
    dust: 0.05,
    gas: 0
}))