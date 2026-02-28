import express from 'express';
import * as store from './store.js';
import { nowTs } from './store.js';
import type { Processed, ThresholdSettings } from '../../src/types/index.js';
import { dbPing, dbEnabled } from './db.js';
import * as repo from './repo.js';

const router = express.Router();

// Health
router.get('/health', async (_req, res) => {
    const mysql = dbEnabled() ? await dbPing() : false;
    res.json({ ok: true, mysql });
});

// Devices
router.get('/devices', async (_req, res) => {
    if (dbEnabled()) {
        const list = await repo.listDevices();
        // compute status in the same way as in-memory store
        const out = list.map(d => ({ ...d, status: store.computeStatus(d.last_seen) }));
        return res.json(out);
    }
    return res.json(store.getDevices());
});

router.post('/devices', async (req, res) => {
    const body = (req.body ?? {}) as Partial<{ device_id: string; name: string }>;
    const device_id = String(body.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const device = store.upsertDevice(device_id, body);
    if (dbEnabled()) {
        await repo.upsertDevice({ device_id, name: body.name ?? '', last_seen: device.last_seen ?? nowTs() });
    }
    res.json(device);
});

router.patch('/devices/:device_id', async (req, res) => {
    const device_id = String(req.params.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const patch = (req.body ?? {}) as Partial<{ name: string }>;
    const updated = store.updateDevice(device_id, patch);
    if (dbEnabled()) {
        const dbUpdated = await repo.updateDeviceMeta(device_id, patch);
        if (dbUpdated) return res.json({ ...dbUpdated, status: store.computeStatus(dbUpdated.last_seen) });
    }
    if (!updated) return res.status(404).json({ message: 'Device not found' });
    return res.json(updated);
});

router.delete('/devices/:device_id', async (req, res) => {
    const device_id = String(req.params.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    store.deleteDevice(device_id);
    if (dbEnabled()) await repo.deleteDevice(device_id);
    res.json({ ok: true });
});

// Latest telemetry
router.get('/latest', async (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    if (dbEnabled()) {
        const v = await repo.getLatest(device_id);
        if (v) return res.json(v);
    }
    const v = store.getLatest(device_id);
    if (v) return res.json(v);

    // return a safe placeholder
    const placeholder: Processed = {
        deviceId: device_id,
        ts: nowTs(),
        temp: undefined,
        hum: undefined,
        gas: undefined,
        dust: undefined,
        IAQ: undefined,
        level: undefined,
    };
    return res.json(placeholder);
});

// History
router.get('/history', async (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    const fromIso = String(req.query.from ?? '').trim();
    const toIso = String(req.query.to ?? '').trim();
    const interval = String(req.query.interval ?? '').trim();

    if (!device_id) return res.status(400).json({ message: 'device_id is required' });
    if (!fromIso || !toIso) return res.status(400).json({ message: 'from/to are required' });

    const fromMs = Date.parse(fromIso);
    const toMs = Date.parse(toIso);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        return res.status(400).json({ message: 'from/to must be ISO datetime' });
    }

    const fromSec = Math.trunc(fromMs / 1000);
    const toSec = Math.trunc(toMs / 1000);
    const intervalSec = store.parseIntervalToSec(interval || '60s');

    if (dbEnabled()) {
        const points = await repo.getHistory(device_id, fromSec, toSec, intervalSec);
        return res.json({ points });
    }

    const points = store.getHistory(device_id, fromSec, toSec, interval);
    return res.json({ points });
});

// Alerts
router.get('/alerts', async (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const fromIso = String(req.query.from ?? '').trim();
    const toIso = String(req.query.to ?? '').trim();
    const fromMs = fromIso ? Date.parse(fromIso) : undefined;
    const toMs = toIso ? Date.parse(toIso) : undefined;

    if ((fromIso && !Number.isFinite(fromMs)) || (toIso && !Number.isFinite(toMs))) {
        return res.status(400).json({ message: 'Invalid date format' });
    }

    const fromSec = typeof fromMs === 'number' ? Math.trunc(fromMs / 1000) : undefined;
    const toSec = typeof toMs === 'number' ? Math.trunc(toMs / 1000) : undefined;

    if (dbEnabled()) {
        const alerts = await repo.getAlerts(device_id, fromSec, toSec);
        return res.json(alerts);
    }

    const alerts = store.getAlerts(device_id, fromSec, toSec);
    return res.json(alerts);
});

// Settings
router.get('/settings', async (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    if (dbEnabled()) {
        const s = await repo.getSettings(device_id);
        if (s) return res.json(s);
    }
    return res.json(store.getSettings(device_id));
});

router.post('/settings', async (req, res) => {
    const body = (req.body ?? {}) as Partial<ThresholdSettings>;
    const device_id = String(body.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const updated = store.updateSettings(device_id, body);
    if (dbEnabled()) await repo.upsertSettings(updated);
    return res.json({ ok: true, settings: updated });
});

export default router;