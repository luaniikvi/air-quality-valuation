import { dbEnabled, getDbPool } from './db.js';
// NOTE:
// - All timestamps (ts / last_seen) are unix seconds.
// - This repo is optional: if MySQL is not configured, callers can fall back to in-memory store.
export async function upsertDevice(device) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    await p.query(`INSERT INTO devices (device_id, name, created_ts, last_seen_ts)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = COALESCE(VALUES(name), name),
       last_seen_ts = VALUES(last_seen_ts)`, [device.device_id, device.name ?? null, device.last_seen, device.last_seen]);
}
export async function deviceExists(device_id) {
    if (!dbEnabled())
        return false;
    const p = getDbPool();
    const [rows] = await p.query(`SELECT device_id FROM devices WHERE device_id = ? LIMIT 1`, [device_id]);
    return !!rows[0];
}
// Update last_seen_ts for an existing device. Does NOT create the device.
export async function touchDeviceLastSeen(device_id, last_seen) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    await p.query(`UPDATE devices SET last_seen_ts = ? WHERE device_id = ?`, [last_seen, device_id]);
}
export async function listDevices() {
    if (!dbEnabled())
        return [];
    const p = getDbPool();
    const [rows] = await p.query(`SELECT device_id, name, last_seen_ts AS last_seen
     FROM devices
     ORDER BY last_seen_ts DESC`);
    return rows;
}
export async function updateDeviceMeta(device_id, patch) {
    if (!dbEnabled())
        return null;
    const p = getDbPool();
    await p.query(`UPDATE devices
     SET name = COALESCE(?, name)
     WHERE device_id = ?`, [patch.name ?? null, device_id]);
    const [rows] = await p.query(`SELECT device_id, name, last_seen_ts AS last_seen
     FROM devices WHERE device_id = ? LIMIT 1`, [device_id]);
    return rows[0] ? rows[0] : null;
}
export async function deleteDevice(device_id) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    // Keep it simple: delete child rows too.
    await p.query('DELETE FROM alerts WHERE device_id = ?', [device_id]);
    await p.query('DELETE FROM telemetry WHERE device_id = ?', [device_id]);
    await p.query('DELETE FROM settings WHERE device_id = ?', [device_id]);
    await p.query('DELETE FROM devices WHERE device_id = ?', [device_id]);
}
export async function insertTelemetry(t) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    await p.query(`INSERT INTO telemetry (device_id, ts, temp, hum, gas, dust, iaq, level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        t.deviceId,
        t.ts,
        t.temp ?? null,
        t.hum ?? null,
        t.gas ?? null,
        t.dust ?? null,
        typeof t.IAQ === 'number' ? t.IAQ : null,
        t.level ?? null,
    ]);
}
export async function getLatest(device_id) {
    if (!dbEnabled())
        return null;
    const p = getDbPool();
    const [rows] = await p.query(`SELECT device_id AS deviceId, ts, temp, hum, gas, dust, iaq AS IAQ, level
     FROM telemetry
     WHERE device_id = ?
     ORDER BY ts DESC
     LIMIT 1`, [device_id]);
    return rows[0] ? rows[0] : null;
}
/**
 * History sampling by intervalSec.
 * Returns 1 representative row per bucket (latest ts in the bucket).
 */
export async function getHistory(device_id, fromSec, toSec, intervalSec) {
    if (!dbEnabled())
        return [];
    const p = getDbPool();
    // Subquery picks the latest ts per bucket, then join back to get full row.
    // Works on MySQL 8+.
    const [rows] = await p.query(`SELECT t.device_id AS deviceId, t.ts, t.temp, t.hum, t.gas, t.dust, t.iaq AS IAQ, t.level
     FROM telemetry t
     INNER JOIN (
        SELECT MAX(ts) AS ts
        FROM telemetry
        WHERE device_id = ? AND ts BETWEEN ? AND ?
        GROUP BY FLOOR(ts / ?)
     ) b ON b.ts = t.ts
     WHERE t.device_id = ?
     ORDER BY t.ts ASC`, [device_id, fromSec, toSec, intervalSec, device_id]);
    return rows;
}
export async function insertAlert(a) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    await p.query(`INSERT INTO alerts (device_id, ts, iaq, level)
     VALUES (?, ?, ?, ?)`, [a.device_id, a.ts, a.iaq, a.level]);
}
export async function getAlerts(device_id, fromSec, toSec) {
    if (!dbEnabled())
        return [];
    const p = getDbPool();
    const from = typeof fromSec === 'number' ? fromSec : 0;
    const to = typeof toSec === 'number' ? toSec : 2147483647; // year 2038-ish
    const [rows] = await p.query(`SELECT id, device_id, ts, iaq, level
     FROM alerts
     WHERE device_id = ? AND ts BETWEEN ? AND ?
     ORDER BY ts DESC
     LIMIT 2000`, [device_id, from, to]);
    // Ensure JS-safe types
    return (rows ?? []).map((r) => ({
        id: String(r.id),
        device_id: String(r.device_id),
        ts: Number(r.ts),
        iaq: r.iaq === null || r.iaq === undefined ? null : Number(r.iaq),
        level: r.level,
    }));
}
function toBool(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return v === '1' || v === 'true' || v === 'on' || v === 'yes';
    }
    return false;
}
function rowToDeviceSettings(row) {
    return {
        device_id: String(row.device_id),
        led_enabled: toBool(row.led_enabled),
        buzzer_enabled: toBool(row.buzzer_enabled),
    };
}
export async function getSettings(device_id) {
    if (!dbEnabled())
        return null;
    const p = getDbPool();
    try {
        const [rows] = await p.query(`SELECT device_id, led_enabled, buzzer_enabled
       FROM settings
       WHERE device_id = ?
       LIMIT 1`, [device_id]);
        return rows[0] ? rowToDeviceSettings(rows[0]) : null;
    }
    catch (e) {
        // If DB schema is outdated (missing columns), don't crash the whole server.
        console.warn('[DB] getSettings failed. Did you run migrations in backend/sql? ->', e?.message ?? e);
        return null;
    }
}
export async function upsertSettings(s) {
    if (!dbEnabled())
        return;
    const p = getDbPool();
    try {
        await p.query(`INSERT INTO settings (
          device_id,
          led_enabled,
          buzzer_enabled,
          updated_ts
       )
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        led_enabled = VALUES(led_enabled),
        buzzer_enabled = VALUES(buzzer_enabled),
        updated_ts = VALUES(updated_ts)`, [
            s.device_id,
            s.led_enabled ? 1 : 0,
            s.buzzer_enabled ? 1 : 0,
            Math.trunc(Date.now() / 1000),
        ]);
    }
    catch (e) {
        console.warn('[DB] upsertSettings failed. Did you run migrations in backend/sql? ->', e?.message ?? e);
    }
}
//# sourceMappingURL=repo.js.map