import { useEffect, useMemo, useState } from 'react';

const KEY = 'aqm_device_id';

export function useDevice(defaultDeviceId = 'esp32-001') {
  const [deviceId, setDeviceId] = useState<string>(() => {
    return localStorage.getItem(KEY) || defaultDeviceId;
  });

  useEffect(() => {
    localStorage.setItem(KEY, deviceId);
  }, [deviceId]);

  return useMemo(() => ({ deviceId, setDeviceId }), [deviceId]);
}