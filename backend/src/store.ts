// store.ts
import type { AlertItem, Device, Processed, IaqSettings } from './types.js';

// In-memory maps
let nextAlertId = 1;
const devices = new Map<string, Device>();
const latestByDevice = new Map<string, Processed>();
const historyByDevice = new Map<string, Processed[]>();
const alertsByDevice = new Map<string, AlertItem[]>();
const settingsByDevice = new Map<string, IaqSettings>();

// Utility functions
export function nowTs(): number {
    return Math.trunc(Date.now() / 1000);
}

// NOTE: project uses unix seconds everywhere.
export function parseIntervalToSec(interval?: string): number {
    if (!interval) return 60;
    const m = interval.trim().match(/^(\d+)(ms|s|m|h)$/i);
    if (!m) return 60;
    const value = Number(m[1]);
    const unit = m[2]!.toLowerCase();
    if (unit === 'ms') return Math.max(1, Math.trunc(value / 1000));
    if (unit === 's') return value;
    if (unit === 'm') return value * 60;
    return value * 3600;
}

function defaultSettings(device_id: string): IaqSettings {
    return {
        device_id,

        // ===== IAQ formula defaults (tuned for outdoor TP.HCM by default) =====
        iaq_method: 'WEIGHTED_HARMONIC',

        // Make dust/gas more important for outdoor city air.
        w_temp: 0.10,
        w_hum: 0.10,
        w_dust: 0.45,
        w_gas: 0.35,

        // Temperature in TP.HCM is commonly higher than "indoor comfort".
        // We keep a broad good band and low weight.
        temp_a: 22,
        temp_b: 26,
        temp_c: 32,
        temp_d: 38,

        // Humidity is often high in TP.HCM; again, low weight.
        hum_a: 40,
        hum_b: 55,
        hum_c: 80,
        hum_d: 95,

        // Dust is stored as mg/m3. 0.05 mg/m3 = 50 ug/m3.
        dust_good: 0.05,
        dust_bad: 0.20,

        // MQ-2 ppm is relative; defaults are a practical starting point.
        gas_good: 300,
        gas_bad: 1500,

        iaq_safe: 80,
        iaq_warn: 60,
    };
}

// Device functions
export function getDevices(): Device[] {
    return Array.from(devices.values()).map(d => ({
        ...d,
        status: computeStatus(d.last_seen)!,
    }));
}

export function getDevice(deviceId: string): Device | undefined {
    return devices.get(deviceId);
}

// Update last_seen for an existing device (does NOT create a new device).
export function touchDevice(deviceId: string, last_seen?: number): Device | null {
    const prev = devices.get(deviceId);
    if (!prev) return null;
    const next: Device = {
        ...prev,
        last_seen: last_seen ?? nowTs(),
        // status will be recomputed on read
        status: prev.status ?? 'offline',
    };
    devices.set(deviceId, next);
    return next;
}

export function upsertDevice(deviceId: string, data?: Partial<Device>): Device {
    const prev = devices.get(deviceId);
    const last_seen = nowTs();
    const next: Device = {
        device_id: deviceId,
        name: data?.name ?? prev?.name ?? "",
        last_seen,
        status: 'online', // will be recomputed later
    };
    devices.set(deviceId, next);
    return next;
}

export function updateDevice(deviceId: string, patch: Partial<Device>): Device | null {
    const prev = devices.get(deviceId);
    if (!prev) return null;
    const next: Device = {
        ...prev,
        name: patch.name ?? prev.name ?? "",
    };
    devices.set(deviceId, next);
    return next;
}

export function deleteDevice(deviceId: string): boolean {
    const existed = devices.delete(deviceId);
    latestByDevice.delete(deviceId);
    historyByDevice.delete(deviceId);
    alertsByDevice.delete(deviceId);
    settingsByDevice.delete(deviceId);
    return existed;
}

export function computeStatus(last_seen?: number): Device['status'] {
    if (!last_seen) return 'offline';
    const raw = Number(process.env.OFFLINE_AFTER_SEC ?? 30);
    const offlineAfter = Number.isFinite(raw) && raw > 0 ? raw : 30;
    return (nowTs() - last_seen < offlineAfter ? 'online' : 'offline')!;
}

// Telemetry store
export function getLatest(deviceId: string): Processed | undefined {
    return latestByDevice.get(deviceId);
}

export function storeProcessed(p: Processed): void {
    latestByDevice.set(p.deviceId, p);
    const arr = historyByDevice.get(p.deviceId) ?? [];
    arr.push(p);
    if (arr.length > 5000) arr.splice(0, arr.length - 5000);
    historyByDevice.set(p.deviceId, arr);
}

export function getHistory(deviceId: string, fromSec: number, toSec: number, interval?: string): Processed[] {
    const raw = historyByDevice.get(deviceId) ?? [];
    const filtered = raw.filter(p => p.ts >= fromSec && p.ts <= toSec);
    const step = parseIntervalToSec(interval || '60s');
    const out: Processed[] = [];
    let bucketStart = -Infinity;
    for (const p of filtered) {
        if (p.ts - bucketStart >= step) {
            out.push(p);
            bucketStart = p.ts;
        }
    }
    return out;
}

// Alerts
export function pushAlertIfNeeded(p: Processed): AlertItem | null {
    // Only store alerts when IAQ is not safe
    if (p.level !== 'WARN' && p.level !== 'DANGER') return null;

    const list = alertsByDevice.get(p.deviceId) ?? [];
    const last = list[0];
    const lastTs = last ? last.ts : 0;
    const thisTs = p.ts;

    // Create a new alert if level changed, or if the last alert is too old (keep UI "alive")
    const changed = !last || last.level !== p.level;
    const stale = thisTs - lastTs > 60;

    if (!changed && !stale) return null;

    const item: AlertItem = {
        id: String(nextAlertId++),
        device_id: p.deviceId,
        ts: thisTs,
        iaq: typeof p.IAQ === 'number' ? p.IAQ : null,
        level: p.level,
    };

    list.unshift(item);
    if (list.length > 500) list.splice(500);
    alertsByDevice.set(p.deviceId, list);
    return item;
}

export function getAlerts(deviceId: string, fromSec?: number, toSec?: number): AlertItem[] {
    const list = alertsByDevice.get(deviceId) ?? [];
    return list.filter(a => {
        const t = a.ts;
        return (fromSec === undefined || t >= fromSec) && (toSec === undefined || t <= toSec);
    });
}

// Settings
export function getSettings(deviceId: string): IaqSettings {
    const s = settingsByDevice.get(deviceId);
    if (s) return s;
    const d = defaultSettings(deviceId);
    settingsByDevice.set(deviceId, d);
    return d;
}

// Return cached settings without creating defaults.
export function peekSettings(deviceId: string): IaqSettings | undefined {
    return settingsByDevice.get(deviceId);
}

export function setSettings(deviceId: string, s: IaqSettings): void {
    settingsByDevice.set(deviceId, { ...s, device_id: deviceId });
}

export function updateSettings(deviceId: string, patch: Partial<IaqSettings>): IaqSettings {
    const current = getSettings(deviceId);
    const next = { ...current, ...patch, device_id: deviceId };
    settingsByDevice.set(deviceId, next);
    return next;
}