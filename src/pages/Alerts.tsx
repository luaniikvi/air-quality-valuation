import { useEffect, useMemo, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import DataTable from '../components/tables/DataTable';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getAlerts } from '../api/sensorApi';
import type { AlertItem } from '../types';
import { isoMinusMs, isoNow } from '../utils/format';

type Level = 'ALL' | 'WARN' | 'DANGER';

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
function formatLocalDateTime(tsSec: number) {
    const pad2 = (n: number) => { return String(n).padStart(2, '0') };
    const d = new Date(tsSec * 1000);
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());

    return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss}`;
    ;
}

export default function Alerts() {
    const { deviceId, devices } = useDeviceContext();
    const noDevice = !hasDeviceId(deviceId) || devices.length === 0;

    const [from, setFrom] = useState(() => toLocalInputValue(isoMinusMs(24 * 60 * 60 * 1000)));
    const [to, setTo] = useState(() => toLocalInputValue(isoNow()));
    const [level, setLevel] = useState<Level>('ALL');
    const [items, setItems] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function run() {
        if (!hasDeviceId(deviceId)) return;
        try {
            setLoading(true);
            const res = await getAlerts(deviceId, fromLocalInputValue(from), fromLocalInputValue(to));
            setItems(res);
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to load alerts');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!hasDeviceId(deviceId)) {
            setItems([]);
            setError(null);
            setLoading(false);
            return;
        }
        run();
    }, [deviceId]);

    const filtered = useMemo(() => {
        if (level === 'ALL') return items;
        return items.filter((i) => i.level === level);
    }, [items, level]);

    return (
        <PageContainer title="Alerts (Cảnh báo)">
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
                                lang="en-US"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-600">To</div>
                            <input
                                type="datetime-local"
                                lang="en-US"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-600">Level (Mức)</div>
                            <select
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                value={level}
                                onChange={(e) => setLevel(e.target.value as Level)}
                            >
                                <option value="ALL">ALL</option>
                                <option value="WARN">WARN</option>
                                <option value="DANGER">DANGER</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                onClick={run}
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Load (Tải)'}
                            </button>
                        </div>
                    </div>

                    {loading && items.length === 0 ? (
                        <div className="mt-6">
                            <Loading />
                        </div>
                    ) : null}

                    <div className="mt-6">
                        <DataTable
                            rows={filtered}
                            empty="No alerts"
                            columns={[
                                { header: 'Time (MM/dd/yyyy HH:mm:ss)', cell: (a) => formatLocalDateTime(a.ts), className: 'whitespace-nowrap' },
                                { header: 'IAQ', cell: (a) => (a.iaq ?? ''), className: 'whitespace-nowrap' },
                                {
                                    header: 'Level',
                                    cell: (a) => (
                                        <span
                                            className={`rounded-full border px-2 py-1 text-xs font-semibold ${a.level === 'DANGER'
                                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                                : a.level === 'WARN'
                                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                }`}
                                        >
                                            {a.level}
                                        </span>
                                    ),
                                    className: 'whitespace-nowrap'
                                },
                            ]}
                        />
                    </div>
                </>
            )}
        </PageContainer>
    );
}
