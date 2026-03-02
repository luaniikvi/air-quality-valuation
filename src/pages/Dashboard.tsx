import type { IaqSettings } from '../types';
import { useEffect, useMemo, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import MetricCard from '../components/cards/MetricCard';
import StatusBadge from '../components/cards/StatusBadge';
import Loading from '../components/common/Loading';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import type { Processed } from '../types';
import { bannerCopy, iaqCardColors } from '../utils/iaq';
import { getLatest, getSettings } from '../api/sensorApi';

export default function Dashboard() {
  const [settings, setSettings] = useState<IaqSettings | null>(null);
  const { deviceId, devices } = useDeviceContext();
  const noDevice = !hasDeviceId(deviceId) || devices.length === 0;

  const [latest, setLatest] = useState<Processed | null>(null);
  const [wsState, setWsState] = useState<'off' | 'connecting' | 'connected' | 'error' | 'closed'>('off');
  if (settings) { };
  useEffect(() => {
    if (!hasDeviceId(deviceId)) {
      setLatest(null);
      setWsState('off');
      return;
    }

    const wsUrl = (() => {
      const envWs = (import.meta as any).env.VITE_WS_URL as string | undefined;
      if (envWs && String(envWs).trim()) return String(envWs).trim();

      // If VITE_API_BASE is an absolute URL (local dev), derive WS from it.
      const apiBase = (import.meta as any).env.VITE_API_BASE as string | undefined;
      if (apiBase && /^https?:\/\//i.test(apiBase)) {
        try {
          const u = new URL(apiBase);
          u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
          u.pathname = '/ws';
          u.search = '';
          u.hash = '';
          return u.toString();
        } catch {
          // ignore
        }
      }

      // Production default: same origin, /ws
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws`;
    })();
    let ws: WebSocket | null = null;
    let cancelled = false;

    // 1) Fetch last known value (so the dashboard isn't empty while waiting for WS)
    (async () => {
      try {
        const [last, s] = await Promise.all([getLatest(deviceId), getSettings(deviceId)]);
        if (!cancelled) {
          setLatest(last);
          setSettings(s);
        }
      } catch { }
    })();

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
          const msg = JSON.parse(ev.data) as Partial<Processed>;

          const ts = msg.ts;
          if (typeof ts !== "number") return;

          if (msg.deviceId !== deviceId) return;

          setLatest((prev) => {
            const prevSafe =
              prev ??
              ({
                deviceId,
                ts: 0,
                temp: undefined,
                hum: undefined,
                gas: undefined,
                dust: undefined,
                IAQ: undefined,
                level: undefined,
              } as Processed);

            if (ts < prevSafe.ts) return prevSafe;

            const merged: Processed = {
              ...prevSafe,
              ...msg,
              deviceId,
              ts,
            };

            return merged;
          });
        } catch (e) {
          console.error(e);
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
      try { ws?.close(); } catch { }
    };
  }, [deviceId]);

  const iaq = useMemo(() => {
    if (typeof latest?.IAQ === 'number') return latest.IAQ;
    if (!latest) return undefined;
  }, [latest]);

  const level: 'SAFE' | 'WARN' | 'DANGER' | '...' = latest?.level ?? "...";


  const iaqColors = useMemo(() => (iaq == null ? null : iaqCardColors(iaq)), [iaq]);
  const iaqTitle = iaq != null ? `IAQ • ${latest?.level}` : 'IAQ';
  const banner = bannerCopy(level);

  return (
    <PageContainer title="Dashboard (Tổng quan)">
      {noDevice ? (
        NoDeviceState()
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Realtime: WebSocket ({wsState})
            </div>
            <StatusBadge level={level} />
          </div>

          {!latest ? (
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
            value={typeof iaq === "number" ? iaq : '...'}
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
