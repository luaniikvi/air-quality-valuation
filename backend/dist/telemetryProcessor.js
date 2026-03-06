function clamp100(x) {
    if (!Number.isFinite(x))
        return 0;
    if (x < 0)
        return 0;
    if (x > 100)
        return 100;
    return x;
}
function sanitizeGoodBad(good, bad) {
    const g = Number(good);
    const b = Number(bad);
    if (!Number.isFinite(g) || !Number.isFinite(b))
        return { good: 0, bad: 1 };
    if (g === b)
        return { good: g, bad: g + 1e-6 };
    return g < b ? { good: g, bad: b } : { good: b, bad: g };
}
export function scoreDecreasing1Sided(x, good, bad) {
    const p = sanitizeGoodBad(good, bad);
    const g = p.good;
    const b = p.bad;
    if (x <= g)
        return 100;
    if (x < b)
        return clamp100((100 * (b - x)) / (b - g));
    return 0;
}
function sanitizeTrapezoid(a, b, c, d) {
    const aa = Number(a);
    const bb = Number(b);
    const cc = Number(c);
    const dd = Number(d);
    if ([aa, bb, cc, dd].some((v) => !Number.isFinite(v)))
        return { a: 0, b: 1, c: 1, d: 2 };
    if (!(aa < bb && bb <= cc && cc < dd)) {
        const s = [aa, bb, cc, dd].sort((x, y) => x - y);
        let A = s[0];
        let B = s[1];
        let C = s[2];
        let D = s[3];
        if (A === B)
            B = A + 1e-6;
        if (C === D)
            C = D - 1e-6;
        if (B > C) {
            const mid = (B + C) / 2;
            B = mid;
            C = mid;
        }
        if (C >= D)
            D = C + 1e-6;
        return { a: A, b: B, c: C, d: D };
    }
    return { a: aa, b: bb, c: cc, d: dd };
}
function scoreTrapezoid2Sided(x, a, b, c, d) {
    const p = sanitizeTrapezoid(a, b, c, d);
    const A = p.a;
    const B = p.b;
    const C = p.c;
    const D = p.d;
    if (x <= A)
        return 0;
    if (x < B)
        return clamp100((100 * (x - A)) / (B - A));
    if (x <= C)
        return 100;
    if (x < D)
        return clamp100((100 * (D - x)) / (D - C));
    return 0;
}
export function iaqCalculate(temp, hum, dust, gas, s) {
    if (typeof temp === 'undefined' ||
        typeof hum === 'undefined' ||
        typeof dust === 'undefined' ||
        typeof gas === 'undefined')
        return undefined;
    // Defaults (should normally come from Settings)
    const cfg = s;
    const tempScore = scoreTrapezoid2Sided(temp, cfg?.temp_a ?? 16, cfg?.temp_b ?? 22, cfg?.temp_c ?? 26, cfg?.temp_d ?? 32);
    const humScore = scoreTrapezoid2Sided(hum, cfg?.hum_a ?? 30, cfg?.hum_b ?? 40, cfg?.hum_c ?? 60, cfg?.hum_d ?? 70);
    const dustScore = scoreDecreasing1Sided(dust, cfg?.dust_good ?? 0.03, cfg?.dust_bad ?? 0.15);
    const gasScore = scoreDecreasing1Sided(gas, cfg?.gas_good ?? 200, cfg?.gas_bad ?? 1000);
    const method = cfg?.iaq_method ?? 'MIN';
    if (method === 'MIN') {
        return Math.trunc(Math.min(tempScore, humScore, dustScore, gasScore));
    }
    // Weighted harmonic mean: smoother than MIN, but still punishes low scores strongly.
    const wTemp = Math.max(0, Number(cfg?.w_temp ?? 0.25));
    const wHum = Math.max(0, Number(cfg?.w_hum ?? 0.25));
    const wDust = Math.max(0, Number(cfg?.w_dust ?? 0.25));
    const wGas = Math.max(0, Number(cfg?.w_gas ?? 0.25));
    const sumW = wTemp + wHum + wDust + wGas;
    if (!(sumW > 0)) {
        return Math.trunc(Math.min(tempScore, humScore, dustScore, gasScore));
    }
    const eps = 0.1; // avoid division by 0
    const denom = (wTemp / Math.max(eps, tempScore)) +
        (wHum / Math.max(eps, humScore)) +
        (wDust / Math.max(eps, dustScore)) +
        (wGas / Math.max(eps, gasScore));
    const iaq = sumW / denom;
    return Math.trunc(clamp100(iaq));
}
export function iaqToLevel(IAQ, s) {
    if (IAQ === undefined || IAQ == null)
        return undefined;
    const safeRaw = Number(s?.iaq_safe ?? 80);
    const warnRaw = Number(s?.iaq_warn ?? 60);
    const warn = clamp100(warnRaw);
    const safe = clamp100(Math.max(safeRaw, warnRaw));
    return IAQ >= safe ? "SAFE" : IAQ >= warn ? "WARN" : "DANGER";
}
export class TelemetryProcessor {
    ingest(t, settings) {
        const IAQ = iaqCalculate(t.temp, t.hum, t.dust, t.gas, settings);
        const level = iaqToLevel(IAQ, settings);
        const res = {
            ...t,
            IAQ: IAQ,
            level: level
        };
        return res;
    }
}
export const processor = new TelemetryProcessor();
//# sourceMappingURL=telemetryProcessor.js.map