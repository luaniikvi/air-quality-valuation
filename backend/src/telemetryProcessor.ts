// backend/src/processing/telemetryProcessor.ts
import type { Telemetry, Processed } from "../../src/types/index.js";

function clamp100(x: number): number {
    if (x < 0) return 0;
    if (x > 100) return 100;
    return x;
}
export function scoreDecreasing1Sided(x: number, good: number, bad: number): number {
    if (good >= bad) throw new Error("Invalid params: require good < bad");

    if (x <= good) return 100;
    if (x < bad) return clamp100((100 * (bad - x)) / (bad - good));
    return 0;
}
function scoreTrapezoid2Sided(
    x: number,
    a: number,
    b: number,
    c: number,
    d: number
): number {
    if (a >= b || b > c || c >= d) {
        throw new Error("Invalid trapezoid params: require a < b <= c < d");
    }

    if (x <= a) return 0;
    if (x < b) return clamp100((100 * (x - a)) / (b - a));
    if (x <= c) return 100;
    if (x < d) return clamp100((100 * (d - x)) / (d - c));
    return 0;
}
// 1) Nhiệt độ (°C): tốt 22–26, chấp nhận 16–32
export function scoreTempC(tempC: number): number {
    return scoreTrapezoid2Sided(tempC, 16, 22, 26, 32);
}

// 2) Độ ẩm (%RH): tốt 40–60, chấp nhận 30–70
export function scoreHumidityPct(rh: number): number {
    return scoreTrapezoid2Sided(rh, 30, 40, 60, 70);
}

// 3) Bụi (mg/m³): tốt <= 0.03, rất xấu >= 0.15
export function scoreDustMgM3(dust: number): number {
    return scoreDecreasing1Sided(dust, 0.03, 0.15);
}

// 4) Gas (ppm): tốt <= 200, rất xấu >= 1000
export function scoreGasPpm(gas: number): number {
    return scoreDecreasing1Sided(gas, 200, 1000);
}
export function iaqCalculate(temp?: number, hum?: number, dust?: number, gas?: number): number | undefined {
    if (
        typeof temp === 'undefined' ||
        typeof hum === 'undefined' ||
        typeof dust === 'undefined' ||
        typeof gas === 'undefined'
    ) return undefined;

    const scores: number[] = [
        scoreTempC(temp ?? 24),
        scoreHumidityPct(hum ?? 50),
        scoreDustMgM3(dust ?? 0),
        scoreGasPpm(gas ?? 0)
    ];
    return Math.trunc(Math.min(...scores));
}
export function iaqToLevel(IAQ?: number): Processed["level"] {
    if (IAQ === undefined || IAQ == null) undefined;
    return IAQ! >= 80 ? "SAFE" : IAQ! >= 60 ? "WARN" : "DANGER";
}

export class TelemetryProcessor {
    ingest(t: Telemetry): Processed {
        const IAQ = iaqCalculate(t.temp, t.hum, t.dust, t.gas);
        const level: Processed["level"] = iaqToLevel(IAQ);

        const res: Processed = {
            ...t,
            IAQ: IAQ,
            level: level
        };
        return res;
    }
}

export const processor = new TelemetryProcessor();