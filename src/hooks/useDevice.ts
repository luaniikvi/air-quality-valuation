import { useEffect, useMemo, useState } from 'react';

const KEY = 'aqm_device_id';

// Default is empty: user chooses/adds devices.
export function useDevice(defaultDeviceId = '') {
  const [deviceId, setDeviceId] = useState<string>(() => {
    const saved = localStorage.getItem(KEY);
    // Remove legacy default that some older builds used.
    if (saved === 'esp32-001') return defaultDeviceId;
    return saved || defaultDeviceId;
  });

  useEffect(() => {
    localStorage.setItem(KEY, deviceId);
  }, [deviceId]);

  return useMemo(() => ({ deviceId, setDeviceId }), [deviceId]);
}