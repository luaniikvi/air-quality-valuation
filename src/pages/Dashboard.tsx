import { useCallback, useEffect, useMemo, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import MetricCard from '../components/cards/MetricCard';
import StatusBadge from '../components/cards/StatusBadge';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getLatest } from '../api/sensorApi';
import type { Reading } from '../types';
// import { computeIaqIndex, iaqLabel, iaqLevelFromIndex, iaqToCardColors } from '../utils/iaq';
import { usePolling } from '../hooks/usePolling';

function bannerCopy(level: 'SAFE' | 'WARN' | 'DANGER') {
  if (level === 'SAFE') {
    return {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      title: 'Trạng thái: Tốt',
      desc: 'Các chỉ số đang trong ngưỡng an toàn.'
    };
  }
  if (level === 'WARN') {
    return {
      cls: 'border-amber-200 bg-amber-50 text-amber-950',
      title: 'CẢNH BÁO',
      desc: 'Chỉ số đang vượt ngưỡng cảnh báo. Nên mở cửa sổ/quạt thông gió hoặc giảm nguồn gây ô nhiễm.'
    };
  }
  return {
    cls: 'border-rose-200 bg-rose-50 text-rose-950 animate-pulse',
    title: 'NGUY HIỂM',
    desc: 'Chất lượng không khí đang rất xấu. Hãy thông gió ngay và tránh ở lâu trong khu vực này.'
  };
}

function isNewer(a?: string, b?: string) {
  // returns true if a > b
  if (!a) return false;
  if (!b) return true;
  return new Date(a).getTime() > new Date(b).getTime();
}

export default function Dashboard() {
  const { deviceId } = useDeviceContext();
  const noDevice = !hasDeviceId(deviceId);

  const [latest, setLatest] = useState<Reading | null>(null);
  const [wsState, setWsState] = useState<'off' | 'connecting' | 'connected' | 'error' | 'closed'>('off');

  const fetcher = useCallback(async () => {
    if (!hasDeviceId(deviceId)) throw new Error('No device selected');
    return await getLatest(deviceId);
  }, [deviceId]);

  const { data: polled, error: pollError, loading: pollLoading } = usePolling(fetcher, 2000, !noDevice);

  // Apply polling updates (but don’t overwrite newer WS data)
  useEffect(() => {
    if (!polled) return;
    setLatest((prev) => (isNewer(polled.ts, prev?.ts) ? polled : prev));
  }, [polled]);

  // WS subscription (optional). If it fails, polling still works.
  useEffect(() => {
    if (!hasDeviceId(deviceId)) {
      setLatest(null);
      setWsState('off');
      return;
    }

    const wsUrl = (import.meta as any).env.VITE_WS_URL || 'ws://localhost:8080';
    let ws: WebSocket | null = null;
    let cancelled = false;

    try {
      setWsState('connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (cancelled) return;
        setWsState('connected');
        ws!.send(JSON.stringify({ type: 'sub', deviceId }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'latest' && msg.deviceId === deviceId && msg.reading) {
            const r = msg.reading as Reading;
            setLatest((prev) => (isNewer(r.ts, prev?.ts) ? r : prev));
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        if (!cancelled) setWsState('error');
      };

      ws.onclose = () => {
        if (!cancelled) setWsState('closed');
      };
    } catch {
      setWsState('error');
    }

    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [deviceId]);

  const iaq = useMemo(() => {
    if (typeof latest?.iaq === 'number') return latest.iaq;
    if (!latest) return null;
  }, [latest]);

  const rawLevel = latest?.level;
  const level: 'SAFE' | 'WARN' | 'DANGER' = rawLevel === undefined ? 'SAFE' : rawLevel;

  const iaqColors = useMemo(() => {
    if (iaq == null) return null;
    const lv: 'SAFE' | 'WARN' | 'DANGER' = level;

    if (lv === 'SAFE') {
      return {
        bg: '#ECFDF5',      // emerald-50
        border: '#A7F3D0',  // emerald-200
        accent: 'emerald' as const
      };
    }
    if (lv === 'WARN') {
      return {
        bg: '#FFFBEB',      // amber-50
        border: '#FDE68A',  // amber-200
        accent: 'amber' as const
      };
    }
    return {
      bg: '#FFF1F2',      // rose-50
      border: '#FECDD3',  // rose-200
      accent: 'rose' as const
    };
  }, [iaq, level]);
  const iaqTitle = iaq != null ? `IAQ • ${latest?.level}` : 'IAQ';
  const banner = bannerCopy(level);

  const showError = !noDevice && !latest && !!pollError;

  return (
    <PageContainer title="Dashboard (Tổng quan)">
      {showError ? <ErrorState message={pollError || 'Network error'} /> : null}

      {noDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              {wsState === 'connected' ? 'Realtime: WebSocket + polling' : 'Realtime: polling (WS không sẵn sàng)'}
            </div>
            <StatusBadge level={level} />
          </div>

          {pollLoading && !latest ? (
            <div className="mt-6">
              <Loading />
            </div>
          ) : null}

          <div className={`mt-6 rounded-2xl border p-5 shadow-sm ${banner.cls}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-extrabold tracking-tight">{banner.title}</div>
                <div className="mt-1 text-sm opacity-90">{banner.desc}</div>
              </div>
              <div className="text-xs opacity-70">
                WS: {wsState}
              </div>
            </div>
          </div>

          <MetricCard
            title={iaqTitle}
            value={iaq ?? '...'}
            className="mt-6 p-6"
            valueClassName="text-6xl"
            accentColor={iaqColors?.accent}
            strongBorder
            style={
              iaqColors
                ? {
                  backgroundColor: iaqColors.bg,
                  borderColor: iaqColors.border
                }
                : undefined
            }
          />

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Temperature (Nhiệt độ)" value={latest?.temp} unit="°C" />
            <MetricCard title="Humidity (Độ ẩm)" value={latest?.hum} unit="%" />
            <MetricCard title="Gas (Khí)" value={latest?.gas} unit="ppm" />
            <MetricCard title="Dust (Bụi)" value={latest?.dust} unit="mg/m³" />
          </div>
        </>
      )}
    </PageContainer>
  );
}
