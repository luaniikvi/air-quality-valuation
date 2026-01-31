export function hasDeviceId(deviceId: string | null | undefined): deviceId is string {
  return typeof deviceId === 'string' && deviceId.trim().length > 0;
}
