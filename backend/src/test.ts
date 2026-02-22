import { processor } from "./telemetryProcessor.js";

export const cac: number = 0;
console.log(processor.ingest({
    deviceId: "test2",
    ts: Date.now(),
    temp: 24.8,
    hum: 41.5,
    dust: 0,
    gas: 401
}))