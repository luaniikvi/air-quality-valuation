export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Map AQI to a hue (green -> red). 0..300 -> 120..0
 */
export function aqiToHue(aqi: number) {
  const a = clamp(aqi, 0, 300);
  const t = a / 300; // 0 good -> 1 bad
  return 120 * (1 - t);
}

/**
 * Returns a CSS color pair for a card background and border.
 */
export function aqiToCardColors(aqi: number) {
  const hue = aqiToHue(aqi);
  const bg = `hsl(${hue} 90% 95%)`;
  const border = `hsl(${hue} 80% 55%)`;
  const accent = `hsl(${hue} 85% 40%)`;
  return { bg, border, accent, hue };
}

export function aqiLabel(aqi: number) {
  // Basic labels (not strictly EPA categories, just friendly)
  if (aqi <= 50) return 'Tốt';
  if (aqi <= 100) return 'Trung bình';
  if (aqi <= 150) return 'Kém';
  if (aqi <= 200) return 'Xấu';
  return 'Rất xấu';
}

/**
 * Demo AQI calculation for the UI (mainly for mock mode).
 * We derive AQI from the "worst" of dust and gas.
 */
export function computeAqi(reading: { dust?: number; gas?: number }) {
  const dust = typeof reading.dust === 'number' ? reading.dust : 0;
  const gas = typeof reading.gas === 'number' ? reading.gas : 0;

  // 0..300-ish
  const dustIdx = clamp(Math.round(dust), 0, 300);
  // Map 200..2000ppm -> 0..300
  const gasIdx = clamp(Math.round(((gas - 200) / 1800) * 300), 0, 300);

  return Math.max(dustIdx, gasIdx);
}

export function aqiLevel(aqi: number): 'OK' | 'WARN' | 'DANGER' {
  if (aqi <= 100) return 'OK';
  if (aqi <= 200) return 'WARN';
  return 'DANGER';
}
