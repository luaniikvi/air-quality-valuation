import express from 'express';
import * as store from './store.js';
import { nowTs } from './store.js';
import type { Processed, ThresholdSettings } from '../../src/types/index.js';

const router = express.Router();

// Health
router.get('/health', (_req, res) => res.json({ ok: true }));

// Devices
router.get('/devices', (_req, res) => {
    res.json(store.getDevices());
});

router.post('/devices', (req, res) => {
    const body = (req.body ?? {}) as Partial<{ device_id: string; name: string; location: string }>;
    const device_id = String(body.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const device = store.upsertDevice(device_id, body);
    res.json(device);
});

router.patch('/devices/:device_id', (req, res) => {
    const device_id = String(req.params.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const patch = (req.body ?? {}) as Partial<{ name: string; location: string }>;
    const updated = store.updateDevice(device_id, patch);
    if (!updated) return res.status(404).json({ message: 'Device not found' });
    res.json(updated);
});

router.delete('/devices/:device_id', (req, res) => {
    const device_id = String(req.params.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    store.deleteDevice(device_id);
    res.json({ ok: true });
});

// Latest telemetry
router.get('/latest', (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

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
router.get('/history', (req, res) => {
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

    const points = store.getHistory(device_id, fromMs, toMs, interval);
    res.json({ points });
});

// Alerts
router.get('/alerts', (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const fromIso = String(req.query.from ?? '').trim();
    const toIso = String(req.query.to ?? '').trim();
    const fromMs = fromIso ? Date.parse(fromIso) : undefined;
    const toMs = toIso ? Date.parse(toIso) : undefined;

    if ((fromIso && !Number.isFinite(fromMs)) || (toIso && !Number.isFinite(toMs))) {
        return res.status(400).json({ message: 'Invalid date format' });
    }

    const alerts = store.getAlerts(device_id, fromMs, toMs);
    res.json(alerts);
});

// Settings
router.get('/settings', (req, res) => {
    const device_id = String(req.query.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });
    res.json(store.getSettings(device_id));
});

router.post('/settings', (req, res) => {
    const body = (req.body ?? {}) as Partial<ThresholdSettings>;
    const device_id = String(body.device_id ?? '').trim();
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });

    const updated = store.updateSettings(device_id, body);
    res.json({ ok: true, settings: updated });
});

export default router;