import type { AlertItem, Device, HistoryQuery, HistoryResponse, Processed, ThresholdSettings } from '../types';
import { http, isMockEnabled } from './http';
import * as mock from '../mock/mockApi';

export async function getDevices(): Promise<Device[]> {
  if (isMockEnabled()) return mock.getDevices();
  const res = await http.get<Device[]>('/devices');
  return res.data;
}

export async function addDevice(payload: Device): Promise<Device> {
  if (isMockEnabled()) return mock.addDevice(payload);
  const res = await http.post<Device>('/devices', payload);
  return res.data;
}

// Disconnect (remove) a device from the dashboard.
// Backend suggestion: implement DELETE /devices/:device_id
export async function disconnectDevice(device_id: string): Promise<{ ok: true }> {
  if (isMockEnabled()) return mock.disconnectDevice(device_id);
  const res = await http.delete<{ ok: true }>(`/devices/${encodeURIComponent(device_id)}`);
  return res.data;
}



// Update device metadata (display name / location).
// Backend suggestion: implement PATCH /devices/:device_id
export async function updateDevice(device_id: string, patch: Partial<Device>): Promise<Device> {
  if (isMockEnabled()) return mock.updateDevice(device_id, patch);
  const res = await http.patch<Device>(`/devices/${encodeURIComponent(device_id)}`, patch);
  return res.data;
}

export async function getLatest(device_id: string): Promise<Processed> {
  if (isMockEnabled()) return mock.getLatest(device_id);
  const res = await http.get<Processed>('/latest', { params: { device_id } });
  return res.data;
}

export async function getHistory(q: HistoryQuery): Promise<HistoryResponse> {
  if (isMockEnabled()) return mock.getHistory(q);
  const res = await http.get<HistoryResponse>('/history', { params: q });
  return res.data;
}

export async function getAlerts(device_id: string, from: string, to: string): Promise<AlertItem[]> {
  if (isMockEnabled()) return mock.getAlerts(device_id, from, to);
  const res = await http.get<AlertItem[]>('/alerts', { params: { device_id, from, to } });
  return res.data;
}

export async function getSettings(device_id: string): Promise<ThresholdSettings> {
  if (isMockEnabled()) return mock.getSettings(device_id);
  const res = await http.get<ThresholdSettings>('/settings', { params: { device_id } });
  return res.data;
}

export async function saveSettings(payload: ThresholdSettings): Promise<{ ok: true }> {
  if (isMockEnabled()) return mock.saveSettings(payload);
  const res = await http.post<{ ok: true }>('/settings', payload);
  return res.data;
}
