import type { AlertItem, Device, Processed, ThresholdSettings } from '../../src/types/index.js';
import { dbEnabled, getDbPool } from './db.js';

// NOTE:
// - All timestamps (ts / last_seen) are unix seconds.
// - This repo is optional: if MySQL is not configured, callers can fall back to in-memory store.

export async function upsertDevice(device: { device_id: string; name?: string; last_seen: number }): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  await p.query(
    `INSERT INTO devices (device_id, name, created_ts, last_seen_ts)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = COALESCE(VALUES(name), name),
       last_seen_ts = VALUES(last_seen_ts)`,
    [device.device_id, device.name ?? null, device.last_seen, device.last_seen]
  );
}

export async function deviceExists(device_id: string): Promise<boolean> {
  if (!dbEnabled()) return false;
  const p = getDbPool();
  const [rows] = await p.query<any[]>(
    `SELECT device_id FROM devices WHERE device_id = ? LIMIT 1`,
    [device_id]
  );
  return !!rows[0];
}

// Update last_seen_ts for an existing device. Does NOT create the device.
export async function touchDeviceLastSeen(device_id: string, last_seen: number): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  await p.query(
    `UPDATE devices SET last_seen_ts = ? WHERE device_id = ?`,
    [last_seen, device_id]
  );
}

export async function listDevices(): Promise<Device[]> {
  if (!dbEnabled()) return [];
  const p = getDbPool();
  const [rows] = await p.query<any[]>(
    `SELECT device_id, name, last_seen_ts AS last_seen
     FROM devices
     ORDER BY last_seen_ts DESC`);
  return rows as Device[];
}

export async function updateDeviceMeta(device_id: string, patch: { name?: string }): Promise<Device | null> {
  if (!dbEnabled()) return null;
  const p = getDbPool();
  await p.query(
    `UPDATE devices
     SET name = COALESCE(?, name)
     WHERE device_id = ?`,
    [patch.name ?? null, device_id]
  );
  const [rows] = await p.query<any[]>(
    `SELECT device_id, name, last_seen_ts AS last_seen
     FROM devices WHERE device_id = ? LIMIT 1`,
    [device_id]
  );
  return rows[0] ? (rows[0] as Device) : null;
}

export async function deleteDevice(device_id: string): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  // Keep it simple: delete child rows too.
  await p.query('DELETE FROM alerts WHERE device_id = ?', [device_id]);
  await p.query('DELETE FROM telemetry WHERE device_id = ?', [device_id]);
  await p.query('DELETE FROM settings WHERE device_id = ?', [device_id]);
  await p.query('DELETE FROM devices WHERE device_id = ?', [device_id]);
}

export async function insertTelemetry(t: Processed): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  await p.query(
    `INSERT INTO telemetry (device_id, ts, temp, hum, gas, dust, iaq, level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.deviceId,
      t.ts,
      t.temp ?? null,
      t.hum ?? null,
      t.gas ?? null,
      t.dust ?? null,
      typeof t.IAQ === 'number' ? t.IAQ : null,
      t.level ?? null,
    ]
  );
}

export async function getLatest(device_id: string): Promise<Processed | null> {
  if (!dbEnabled()) return null;
  const p = getDbPool();
  const [rows] = await p.query<any[]>(
    `SELECT device_id AS deviceId, ts, temp, hum, gas, dust, iaq AS IAQ, level
     FROM telemetry
     WHERE device_id = ?
     ORDER BY ts DESC
     LIMIT 1`,
    [device_id]
  );
  return rows[0] ? (rows[0] as Processed) : null;
}

/**
 * History sampling by intervalSec.
 * Returns 1 representative row per bucket (latest ts in the bucket).
 */
export async function getHistory(device_id: string, fromSec: number, toSec: number, intervalSec: number): Promise<Processed[]> {
  if (!dbEnabled()) return [];
  const p = getDbPool();

  // Subquery picks the latest ts per bucket, then join back to get full row.
  // Works on MySQL 8+.
  const [rows] = await p.query<any[]>(
    `SELECT t.device_id AS deviceId, t.ts, t.temp, t.hum, t.gas, t.dust, t.iaq AS IAQ, t.level
     FROM telemetry t
     INNER JOIN (
        SELECT MAX(ts) AS ts
        FROM telemetry
        WHERE device_id = ? AND ts BETWEEN ? AND ?
        GROUP BY FLOOR(ts / ?)
     ) b ON b.ts = t.ts
     WHERE t.device_id = ?
     ORDER BY t.ts ASC`,
    [device_id, fromSec, toSec, intervalSec, device_id]
  );
  return rows as Processed[];
}

export async function insertAlert(a: AlertItem): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  await p.query(
    `INSERT INTO alerts (id, device_id, ts, type, value, level, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE ts = VALUES(ts)`,
    [a.id, a.device_id, a.ts, a.type, a.value ?? null, a.level, a.message]
  );
}

export async function getAlerts(device_id: string, fromSec?: number, toSec?: number): Promise<AlertItem[]> {
  if (!dbEnabled()) return [];
  const p = getDbPool();
  const from = typeof fromSec === 'number' ? fromSec : 0;
  const to = typeof toSec === 'number' ? toSec : 2147483647; // year 2038-ish
  const [rows] = await p.query<any[]>(
    `SELECT id, device_id, ts, type, value, level, message
     FROM alerts
     WHERE device_id = ? AND ts BETWEEN ? AND ?
     ORDER BY ts DESC
     LIMIT 2000`,
    [device_id, from, to]
  );
  return rows as AlertItem[];
}

export async function getSettings(device_id: string): Promise<ThresholdSettings | null> {
  if (!dbEnabled()) return null;
  const p = getDbPool();
  const [rows] = await p.query<any[]>(
    `SELECT device_id, gas_warn, gas_danger, dust_warn, dust_danger, temp_low, temp_high, hum_low, hum_high
     FROM settings
     WHERE device_id = ?
     LIMIT 1`,
    [device_id]
  );
  return rows[0] ? (rows[0] as ThresholdSettings) : null;
}

export async function upsertSettings(s: ThresholdSettings): Promise<void> {
  if (!dbEnabled()) return;
  const p = getDbPool();
  await p.query(
    `INSERT INTO settings (device_id, gas_warn, gas_danger, dust_warn, dust_danger, temp_low, temp_high, hum_low, hum_high, updated_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      gas_warn = VALUES(gas_warn),
      gas_danger = VALUES(gas_danger),
      dust_warn = VALUES(dust_warn),
      dust_danger = VALUES(dust_danger),
      temp_low = VALUES(temp_low),
      temp_high = VALUES(temp_high),
      hum_low = VALUES(hum_low),
      hum_high = VALUES(hum_high),
      updated_ts = VALUES(updated_ts)`,
    [
      s.device_id,
      s.gas_warn,
      s.gas_danger,
      s.dust_warn,
      s.dust_danger,
      s.temp_low,
      s.temp_high,
      s.hum_low,
      s.hum_high,
      Math.trunc(Date.now() / 1000),
    ]
  );
}
