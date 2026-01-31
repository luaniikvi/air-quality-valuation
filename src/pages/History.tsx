import { useEffect, useMemo, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import LineChart, { Point } from '../components/charts/LineChart';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import DataTable from '../components/tables/DataTable';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getHistory } from '../api/sensorApi';
import type { Reading } from '../types';
import { fmtDateTime, fmtTimeShort, isoMinusMs, isoNow } from '../utils/format';

const METRIC_COLORS: Record<string, string> = {
  temp: '#f97316', // orange
  hum: '#3b82f6', // blue
  gas: '#a855f7', // purple
  dust: '#eab308', // yellow
  aqi: '#ef4444' // red
};

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 20H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const METRICS = [
  { key: 'temp', label: 'Temperature (Nhiệt độ)', unit: '°C' },
  { key: 'hum', label: 'Humidity (Độ ẩm)', unit: '%' },
  { key: 'gas', label: 'Gas (Khí)', unit: 'ppm' },
  { key: 'dust', label: 'Dust (Bụi)', unit: 'µg/m³' },
  { key: 'aqi', label: 'AQI', unit: '' }
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(v: string) {
  // treat as local time
  const d = new Date(v);
  return d.toISOString();
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function History() {
  const { deviceId } = useDeviceContext();
  const noDevice = !hasDeviceId(deviceId);

  const [from, setFrom] = useState(() => toLocalInputValue(isoMinusMs(6 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toLocalInputValue(isoNow()));
  const [interval, setIntervalValue] = useState('1m');
  const [metrics, setMetrics] = useState<MetricKey[]>(['aqi']);
  const [showRaw, setShowRaw] = useState(false);

  const [points, setPoints] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!hasDeviceId(deviceId)) return;
    try {
      setLoading(true);
      const res = await getHistory({
        device_id: deviceId,
        from: fromLocalInputValue(from),
        to: fromLocalInputValue(to),
        interval
      });
      setPoints(res.points);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasDeviceId(deviceId)) {
      setPoints([]);
      setError(null);
      setLoading(false);
      return;
    }
    // auto refresh when device changes
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const chartData = useMemo(() => {
    const byMetric: Record<string, Point[]> = {};
    for (const m of metrics) byMetric[m] = [];
    for (const p of points) {
      const label = fmtTimeShort(p.ts);
      for (const m of metrics) {
        const v = (p as any)[m];
        if (typeof v === 'number') byMetric[m].push({ label, value: v });
      }
    }
    return byMetric;
  }, [points, metrics]);

  const selectedMeta = (k: MetricKey) => METRICS.find((m) => m.key === k)!;

  return (
    <PageContainer title="History & Charts">
      {error ? <ErrorState message={error} /> : null}

      {noDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="text-xs font-semibold text-slate-600">From</div>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">To</div>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Interval</div>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={interval}
                onChange={(e) => setIntervalValue(e.target.value)}
              >
                <option value="10s">10s</option>
                <option value="30s">30s</option>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={run}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>

            <div className="md:col-span-4">
              <div className="text-xs font-semibold text-slate-600">Metrics (Chỉ số)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {METRICS.map((m) => {
                  const active = metrics.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
                      }`}
                      onClick={() => {
                        setMetrics((prev) => {
                          if (prev.includes(m.key)) return prev.filter((x) => x !== m.key);
                          return [...prev, m.key];
                        });
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading && points.length === 0 ? (
            <div className="mt-6">
              <Loading />
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4">
            {metrics.map((m) => {
              const meta = selectedMeta(m);
              return (
                <LineChart
                  key={m}
                  title={meta.label}
                  points={chartData[m] || []}
                  yLabel={meta.unit}
                  accent={METRIC_COLORS[m] || '#0ea5e9'}
                />
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-700">Raw data (Dữ liệu thô)</div>
              <button
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  showRaw
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => setShowRaw((v) => !v)}
                title={showRaw ? 'Ẩn dữ liệu thô' : 'Hiện dữ liệu thô'}
              >
                <PencilIcon className="h-4 w-4" />
                {showRaw ? 'ON' : 'OFF'}
              </button>
            </div>
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                const rows: string[][] = [['ts', 'temp', 'hum', 'gas', 'dust', 'aqi', 'level']];
                for (const p of points) {
                  rows.push([
                    p.ts,
                    String(p.temp ?? ''),
                    String(p.hum ?? ''),
                    String(p.gas ?? ''),
                    String(p.dust ?? ''),
                    String(p.aqi ?? ''),
                    String(p.level ?? '')
                  ]);
                }
                downloadCsv(`history_${deviceId}.csv`, rows);
              }}
              disabled={points.length === 0}
            >
              Xuất file CSV
            </button>
          </div>

          {showRaw ? (
            <div className="mt-3">
              {(() => {
                const maxRows = 2000;
                const ordered = points.slice().reverse();
                const rows = ordered.length > maxRows ? ordered.slice(0, maxRows) : ordered;
                return (
                  <>
                    <DataTable
                      rows={rows}
                      empty="No points"
                      columns={[
                        { header: 'Time', cell: (r) => fmtDateTime(r.ts) },
                        { header: 'Temp', cell: (r) => (r.temp ?? ''), className: 'whitespace-nowrap' },
                        { header: 'Hum', cell: (r) => (r.hum ?? ''), className: 'whitespace-nowrap' },
                        { header: 'Gas', cell: (r) => (r.gas ?? ''), className: 'whitespace-nowrap' },
                        { header: 'Dust', cell: (r) => (r.dust ?? ''), className: 'whitespace-nowrap' },
                        { header: 'AQI', cell: (r) => (r.aqi ?? ''), className: 'whitespace-nowrap' },
                        { header: 'Level', cell: (r) => (r.level ?? ''), className: 'whitespace-nowrap' }
                      ]}
                    />
                    <div className="mt-2 text-xs text-slate-500">
                      Đang hiển thị {rows.length} / {ordered.length} điểm trong khoảng From/To.
                      {ordered.length > maxRows ? ' (Giới hạn để tránh lag.)' : ''}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Mặc định đang ẩn dữ liệu thô. Bấm biểu tượng <span className="font-semibold">bút</span> để bật hiển thị.
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
