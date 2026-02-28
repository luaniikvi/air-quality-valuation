// store.ts
import { randomUUID } from 'crypto';
import type { AlertItem, Device, Processed, ThresholdSettings } from '../../src/types/index.js';

// In-memory maps
const devices = new Map<string, Device>();
const latestByDevice = new Map<string, Processed>();
const historyByDevice = new Map<string, Processed[]>();
const alertsByDevice = new Map<string, AlertItem[]>();
const settingsByDevice = new Map<string, ThresholdSettings>();

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

function defaultSettings(device_id: string): ThresholdSettings {
    return {
        device_id,
        gas_warn: 800,
        gas_danger: 1200,
        dust_warn: 0.08,
        dust_danger: 0.15,
        temp_low: 18,
        temp_high: 32,
        hum_low: 35,
        hum_high: 75,
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
    return (nowTs() - last_seen < 10 ? 'online' : 'offline')!;
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
    if (p.level !== 'WARN' && p.level !== 'DANGER') return null;
    const list = alertsByDevice.get(p.deviceId) ?? [];
    const last = list[0];
    const lastTs = last ? last.ts : 0;
    const thisTs = p.ts;
    const changed = !last || last.level !== (p.level === 'WARN' ? 'WARN' : 'DANGER');
    const stale = thisTs - lastTs > 60;

    if (changed || stale) {
        const level: AlertItem['level'] = p.level === 'WARN' ? 'WARN' : 'DANGER';
        const msg = p.level === 'WARN' ? 'Chất lượng không khí đang ở mức cảnh báo' : 'Chất lượng không khí nguy hiểm!';
        const item: AlertItem = {
            id: randomUUID(),
            device_id: p.deviceId,
            ts: thisTs,
            type: 'iaq',
            value: typeof p.IAQ === 'number' ? p.IAQ : -1,
            level,
            message: msg,
        };
        list.unshift(item);
        if (list.length > 500) list.splice(500);
        alertsByDevice.set(p.deviceId, list);
        return item;
    }
    return null;
}

export function getAlerts(deviceId: string, fromSec?: number, toSec?: number): AlertItem[] {
    const list = alertsByDevice.get(deviceId) ?? [];
    return list.filter(a => {
        const t = a.ts;
        return (fromSec === undefined || t >= fromSec) && (toSec === undefined || t <= toSec);
    });
}

// Settings
export function getSettings(deviceId: string): ThresholdSettings {
    const s = settingsByDevice.get(deviceId);
    if (s) return s;
    const d = defaultSettings(deviceId);
    settingsByDevice.set(deviceId, d);
    return d;
}

export function updateSettings(deviceId: string, patch: Partial<ThresholdSettings>): ThresholdSettings {
    const current = getSettings(deviceId);
    const next = { ...current, ...patch, device_id: deviceId };
    settingsByDevice.set(deviceId, next);
    return next;
}