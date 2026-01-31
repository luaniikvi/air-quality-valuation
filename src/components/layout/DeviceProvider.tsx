import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Device } from '../../types';
import { getDevices } from '../../api/sensorApi';
import { useDevice } from '../../hooks/useDevice';

type Ctx = {
  deviceId: string;
  setDeviceId: (id: string) => void;
  devices: Device[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DeviceContext = createContext<Ctx | null>(null);

export function useDeviceContext() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDeviceContext must be used within DeviceProvider');
  return ctx;
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  // Default blank so real mode can start with an empty device list.
  const { deviceId, setDeviceId } = useDevice('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const list = await getDevices();
      setDevices(list);
      setError(null);

      if (list.length === 0) {
        // No devices yet
        if (deviceId !== '') setDeviceId('');
      } else {
        // Keep current selection if possible; otherwise select first device
        const found = list.find((d) => d.device_id === deviceId);
        if (!found) setDeviceId(list[0].device_id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load devices');
      // If devices can't load, keep current state.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // refresh devices every minute
    const t = window.setInterval(() => refresh(), 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ deviceId, setDeviceId, devices, loading, error, refresh }),
    [deviceId, devices, loading, error]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}
