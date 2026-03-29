const SYSTEM_IAQ_DEFAULTS = {
    // Fixed, system-managed IAQ parameters.
    temp_a: 22,
    temp_b: 26,
    temp_c: 32,
    temp_d: 38,
    hum_a: 30,
    hum_b: 40,
    hum_c: 60,
    hum_d: 85,
    dust_good: 0.05,
    dust_bad: 0.20,
    gas_good: 120,
    gas_bad: 1000,
    iaq_safe: 80,
    iaq_warn: 60,
};
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
export function iaqCalculate(temp, hum, dust, gas) {
    if (typeof temp === 'undefined' ||
        typeof hum === 'undefined' ||
        typeof dust === 'undefined' ||
        typeof gas === 'undefined') {
        return undefined;
    }
    const tempScore = scoreTrapezoid2Sided(temp, SYSTEM_IAQ_DEFAULTS.temp_a, SYSTEM_IAQ_DEFAULTS.temp_b, SYSTEM_IAQ_DEFAULTS.temp_c, SYSTEM_IAQ_DEFAULTS.temp_d);
    const humScore = scoreTrapezoid2Sided(hum, SYSTEM_IAQ_DEFAULTS.hum_a, SYSTEM_IAQ_DEFAULTS.hum_b, SYSTEM_IAQ_DEFAULTS.hum_c, SYSTEM_IAQ_DEFAULTS.hum_d);
    const dustScore = scoreDecreasing1Sided(dust, SYSTEM_IAQ_DEFAULTS.dust_good, SYSTEM_IAQ_DEFAULTS.dust_bad);
    const gasScore = scoreDecreasing1Sided(gas, SYSTEM_IAQ_DEFAULTS.gas_good, SYSTEM_IAQ_DEFAULTS.gas_bad);
    return Math.trunc(Math.min(tempScore, humScore, dustScore, gasScore));
}
export function iaqToLevel(IAQ) {
    if (IAQ === undefined || IAQ == null)
        return undefined;
    const warn = clamp100(SYSTEM_IAQ_DEFAULTS.iaq_warn);
    const safe = clamp100(Math.max(SYSTEM_IAQ_DEFAULTS.iaq_safe, SYSTEM_IAQ_DEFAULTS.iaq_warn));
    return IAQ >= safe ? 'SAFE' : IAQ >= warn ? 'WARN' : 'DANGER';
}
export class TelemetryProcessor {
    ingest(t) {
        const IAQ = iaqCalculate(t.temp, t.hum, t.dust, t.gas);
        const level = iaqToLevel(IAQ);
        return {
            ...t,
            IAQ,
            level,
        };
    }
}
export const processor = new TelemetryProcessor();
//# sourceMappingURL=telemetryProcessor.js.map