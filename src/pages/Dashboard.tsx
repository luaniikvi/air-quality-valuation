import { useEffect, useMemo, useState } from 'react';
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
import { fmtDateTime } from '../utils/format';
import { aqiLabel, aqiToCardColors } from '../utils/aqi';

function bannerCopy(level: 'OK' | 'WARN' | 'DANGER') {
  if (level === 'OK') {
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

export default function Dashboard() {
  const { deviceId } = useDeviceContext();
  const noDevice = !hasDeviceId(deviceId);

  const [latest, setLatest] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasDeviceId(deviceId)) {
      setLatest(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function tick() {
      try {
        const r = await getLatest(deviceId);
        if (cancelled) return;
        setLatest(r);
        setError(null);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load');
        setLoading(false);
      }
    }

    setLatest(null);
    setLoading(true);

    tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [deviceId]);

  const level = latest?.level || 'OK';
  const sub = useMemo(() => (latest?.ts ? `Last update: ${fmtDateTime(latest.ts)}` : ''), [latest?.ts]);

  const aqi = typeof latest?.aqi === 'number' ? latest!.aqi! : null;
  const aqiColors = aqi != null ? aqiToCardColors(aqi) : null;
  const aqiTitle = aqi != null ? `AQI • ${aqiLabel(aqi)}` : 'AQI';

  const banner = bannerCopy(level);

  return (
    <PageContainer title="Dashboard (Tổng quan)">
      {error ? <ErrorState message={error} /> : null}

      {noDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">Cập nhật mỗi ~2 giây.</div>
            <StatusBadge level={level} />
          </div>

          {loading && !latest ? (
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
            </div>
          </div>

          <MetricCard
            title={aqiTitle}
            value={aqi ?? '...'}
            className="mt-6 p-6"
            valueClassName="text-6xl"
            accentColor={aqiColors?.accent}
            strongBorder
            style={
              aqiColors
                ? {
                    backgroundColor: aqiColors.bg,
                    borderColor: aqiColors.border
                  }
                : undefined
            }
          />

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Temperature (Nhiệt độ)" value={latest?.temp} unit="°C" />
            <MetricCard title="Humidity (Độ ẩm)" value={latest?.hum} unit="%" />
            <MetricCard title="Gas (Khí)" value={latest?.gas} unit="ppm" />
            <MetricCard title="Dust (Bụi)" value={latest?.dust} unit="µg/m³" />
          </div>
        </>
      )}
    </PageContainer>
  );
}
