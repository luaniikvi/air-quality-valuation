// import { useCallback, useEffect, useMemo, useState } from 'react';
// import PageContainer from '../components/layout/PageContainer';
// import MetricCard from '../components/cards/MetricCard';
// import StatusBadge from '../components/cards/StatusBadge';
// import LineChart, { Point } from '../components/charts/LineChart';
// import ErrorState from '../components/common/ErrorState';
// import NoDeviceState from '../components/common/NoDeviceState';
// import { hasDeviceId } from '../utils/deviceGuard';
// import { useDeviceContext } from '../components/layout/DeviceProvider';
// import { getLatest } from '../api/sensorApi';
// import type { Processed } from '../types';
// import { fmtTimeShort, fmtDateTime } from '../utils/format';
// import { computeIaqIndex, iaqLevelFromIndex } from '../utils/iaq';

// export default function Realtime() {
//   const { deviceId } = useDeviceContext();
//   const noDevice = !hasDeviceId(deviceId);

//   const [latest, setLatest] = useState<Processed | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [iaqSeries, setIaqSeries] = useState<Point[]>([]);
//   const [dustSeries, setDustSeries] = useState<Point[]>([]);

//   const fetcher = useCallback(async () => {
//     if (!hasDeviceId(deviceId)) throw new Error('No device selected');
//     return await getLatest(deviceId);
//   }, [deviceId]);

//   useEffect(() => {
//     if (!hasDeviceId(deviceId)) {
//       setLatest(null);
//       setIaqSeries([]);
//       setDustSeries([]);
//       setError(null);
//       return;
//     }

//     let cancelled = false;

//     async function tick() {
//       try {
//         const r = await fetcher();
//         if (cancelled) return;
//         setLatest(r);
//         setError(null);

//         const label = fmtTimeShort(r.ts);
//         const iaq = typeof r.IAQ === 'number' ? r.IAQ : computeIaqIndex(r);
//         if (typeof iaq === 'number') {
//           setIaqSeries((prev) => [...prev, { label, value: iaq }].slice(-180));
//         }
//         if (typeof r.dust === 'number') {
//           setDustSeries((prev) => [...prev, { label, value: r.dust! }].slice(-180));
//         }
//       } catch (e: any) {
//         if (!cancelled) setError(e?.message || 'Failed to fetch realtime');
//       }
//     }

//     // reset series when device changes
//     setIaqSeries([]);
//     setDustSeries([]);
//     setLatest(null);

//     tick();
//     const t = window.setInterval(tick, 2000);

//     return () => {
//       cancelled = true;
//       window.clearInterval(t);
//     };
//   }, [fetcher, deviceId]);

//   const iaqValue = useMemo(() => {
//     if (!latest) return undefined;
//     return typeof latest.iaq === 'number' ? latest.iaq : computeIaqIndex(latest);
//   }, [latest]);

//   const level = useMemo<'SAFE' | 'WARN' | 'DANGER'>(() => {
//     const raw = latest?.level;
//     if (raw === 'SAFE' || raw === 'WARN' || raw === 'DANGER') return raw;
//     if (typeof iaqValue === 'number') return iaqLevelFromIndex(iaqValue);
//     return 'SAFE';
//   }, [latest?.level, iaqValue]);

//   const sub = useMemo(() => {
//     if (!latest?.ts) return '';
//     return `Last update: ${fmtDateTime(latest.ts)}`;
//   }, [latest?.ts]);

//   return (
//     <PageContainer title="Realtime (Trực tiếp)">
//       {error ? <ErrorState message={error} /> : null}

//       {noDevice ? (
//         <NoDeviceState />
//       ) : (
//         <>
//           <div className="mt-4 flex items-center justify-between">
//             <div className="text-sm text-slate-600">Cập nhật mỗi ~2 giây (polling).</div>
//             <StatusBadge level={level} />
//           </div>

//           <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
//             <MetricCard title="Temperature" value={latest?.temp} unit="°C" sub={sub} />
//             <MetricCard title="Humidity" value={latest?.hum} unit="%" sub={sub} />
//             <MetricCard title="IAQ" value={iaqValue} />
//             <MetricCard title="Gas" value={latest?.gas} unit="ppm" />
//             <MetricCard title="Dust" value={latest?.dust} unit="mg/m³" />
//             <MetricCard title="WiFi RSSI" value={latest?.rssi} unit="dBm" />
//           </div>

//           <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
//             <LineChart title="IAQ (live)" points={iaqSeries} yLabel="IAQ" />
//             <LineChart title="Dust (live)" points={dustSeries} yLabel="mg/m³" />
//           </div>
//         </>
//       )}
//     </PageContainer>
//   );
// }
