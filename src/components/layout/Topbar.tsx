import { useEffect, useMemo, useState } from 'react';
import { useDeviceContext } from './DeviceProvider';
import { isMockEnabled } from '../../api/http';

function formatClock(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
}

export default function Topbar() {
  const { deviceId, setDeviceId, devices, loading, error, refresh } = useDeviceContext();
  const current = devices.find((d) => d.device_id === deviceId);
  const noDevices = devices.length === 0;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const clockText = useMemo(() => formatClock(now), [now]);

  const [datePart, timePart] = useMemo(() => {
    const parts = clockText.split(' ');
    return [parts[0] || clockText, parts[1] || ''];
  }, [clockText]);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-slate-900">
            {noDevices ? 'Chưa có thiết bị' : (current?.name || deviceId)}
          </div>

          {!noDevices && current?.status ? (
            <span
              className={`rounded-full border px-2 py-1 text-xs ${current.status === 'online'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
            >
              {current.status}
            </span>
          ) : null}

          {isMockEnabled() ? (
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-800">
              MOCK
            </span>
          ) : null}
        </div>

        <div className="flex justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-5 py-2 shadow-sm ring-1 ring-slate-200/50 backdrop-blur">
            <div className="flex flex-col items-center leading-none">
              <div className="text-[11px] font-semibold tracking-wide text-slate-500">{datePart}</div>
              <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                {timePart || clockText}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <label className="text-xs text-slate-500">Device</label>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={loading || noDevices}
          >
            {noDevices ? <option value="">— Chưa có —</option> : null}
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id}
              </option>
            ))}
          </select>

          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => refresh()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-auto max-w-6xl px-6 pb-3 text-sm text-rose-700">{error}</div>
      ) : null}
    </header>
  );
}
