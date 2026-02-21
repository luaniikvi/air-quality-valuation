import { useEffect, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getSettings, saveSettings } from '../api/sensorApi';
import type { ThresholdSettings } from '../types';

function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function Settings() {
  const { deviceId } = useDeviceContext();
  const noDevice = !hasDeviceId(deviceId);

  const [model, setModel] = useState<ThresholdSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!hasDeviceId(deviceId)) {
      setModel(null);
      setError(null);
      setOk(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const s = await getSettings(deviceId);
        if (!cancelled) {
          setModel(s);
          setError(null);
          setOk(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  async function onSave() {
    if (!model) return;
    try {
      setSaving(true);
      await saveSettings(model);
      setOk('Đã lưu!');
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setOk(null), 2000);
    }
  }

  return (
    <PageContainer title="Settings (Cài đặt)">
      {error ? <ErrorState message={error} /> : null}

      {noDevice ? (
        <NoDeviceState />
      ) : (
        <>
          <div className="mt-4 text-sm text-slate-600">Cấu hình ngưỡng cảnh báo cho từng chỉ số (theo device).</div>

          {loading && !model ? (
            <div className="mt-6">
              <Loading />
            </div>
          ) : null}

          {model ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Gas warn (ppm)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.gas_warn}
                    onChange={(e) => setModel({ ...model, gas_warn: n(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Gas danger (ppm)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.gas_danger}
                    onChange={(e) => setModel({ ...model, gas_danger: n(e.target.value) })}
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Dust warn (mg/m³)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.dust_warn}
                    onChange={(e) => setModel({ ...model, dust_warn: n(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Dust danger (mg/m³)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.dust_danger}
                    onChange={(e) => setModel({ ...model, dust_danger: n(e.target.value) })}
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Temp low (°C)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.temp_low}
                    onChange={(e) => setModel({ ...model, temp_low: n(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Temp high (°C)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.temp_high}
                    onChange={(e) => setModel({ ...model, temp_high: n(e.target.value) })}
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Humidity low (%)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.hum_low}
                    onChange={(e) => setModel({ ...model, hum_low: n(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Humidity high (%)</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={model.hum_high}
                    onChange={(e) => setModel({ ...model, hum_high: n(e.target.value) })}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save (Lưu)'}
                </button>
                {ok ? <div className="text-sm text-emerald-700">{ok}</div> : null}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Backend nên lưu settings theo device_id, và ESP32 có thể pull settings hoặc backend dùng để phân loại cảnh báo.
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
