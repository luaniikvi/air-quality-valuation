import { useEffect, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getSettings, saveSettings } from '../api/sensorApi';
import type { IaqSettings } from '../types';

function n(v: any): number {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
}

type PresetKey = 'hcmc_outdoor' | 'indoor_comfort' | 'strict_min';

function presetValues(key: PresetKey): Partial<IaqSettings> {
    if (key === 'strict_min') {
        return {
            iaq_method: 'MIN',
            w_temp: 0.25,
            w_hum: 0.25,
            w_dust: 0.25,
            w_gas: 0.25,
            temp_a: 16,
            temp_b: 22,
            temp_c: 26,
            temp_d: 32,
            hum_a: 30,
            hum_b: 40,
            hum_c: 60,
            hum_d: 70,
            dust_good: 0.03,
            dust_bad: 0.15,
            gas_good: 200,
            gas_bad: 1000,
            iaq_safe: 80,
            iaq_warn: 60,
        };
    }

    if (key === 'indoor_comfort') {
        return {
            iaq_method: 'WEIGHTED_HARMONIC',
            w_temp: 0.30,
            w_hum: 0.30,
            w_dust: 0.20,
            w_gas: 0.20,
            temp_a: 16,
            temp_b: 22,
            temp_c: 26,
            temp_d: 32,
            hum_a: 30,
            hum_b: 40,
            hum_c: 60,
            hum_d: 70,
            dust_good: 0.03,
            dust_bad: 0.15,
            gas_good: 200,
            gas_bad: 1000,
            iaq_safe: 80,
            iaq_warn: 60,
        };
    }

    // TP.HCM outdoor (default)
    return {
        iaq_method: 'WEIGHTED_HARMONIC',
        w_temp: 0.10,
        w_hum: 0.10,
        w_dust: 0.45,
        w_gas: 0.35,
        temp_a: 22,
        temp_b: 26,
        temp_c: 32,
        temp_d: 38,
        hum_a: 40,
        hum_b: 55,
        hum_c: 80,
        hum_d: 95,
        dust_good: 0.05,
        dust_bad: 0.20,
        gas_good: 300,
        gas_bad: 1500,
        iaq_safe: 80,
        iaq_warn: 60,
    };
}

export default function Settings() {
    const { deviceId } = useDeviceContext();
    const noDevice = !hasDeviceId(deviceId);

    const [model, setModel] = useState<IaqSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [preset, setPreset] = useState<PresetKey>('hcmc_outdoor');

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
        <PageContainer title="Settings">
            {error ? <ErrorState message={error} /> : null}

            {noDevice ? (
                <NoDeviceState />
            ) : (
                <>
                    <div className="mt-4 text-sm text-slate-600">Tinh chỉnh công thức IAQ theo từng device.</div>

                    {loading && !model ? (
                        <div className="mt-6">
                            <Loading />
                        </div>
                    ) : null}

                    {model ? (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">IAQ Settings</div>
                                    <div className="mt-1 text-xs text-slate-600">
                                        Bạn có thể chỉnh công thức IAQ theo môi trường không khí TP.HCM hoặc theo tiêu chuẩn “thoải mái trong nhà”.
                                    </div>
                                </div>

                                <div className="flex items-end gap-3">
                                    <div>
                                        <div className="text-xs font-semibold text-slate-600">Preset</div>
                                        <select
                                            className="mt-1 w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                            value={preset}
                                            onChange={(e) => {
                                                const k = e.target.value as PresetKey;
                                                setPreset(k);
                                                setModel({ ...model, ...(presetValues(k) as any) });
                                            }}
                                        >
                                            <option value="hcmc_outdoor">TP.HCM (khuyến nghị)</option>
                                            <option value="indoor_comfort">Indoor comfort (trong nhà)</option>
                                            <option value="strict_min">Strict MIN</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <details className="mt-4 rounded-xl border border-slate-200 p-4" open>
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Công thức IAQ</summary>
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <div className="text-xs font-semibold text-slate-600">IAQ method</div>
                                        <select
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                            value={model.iaq_method}
                                            onChange={(e) => setModel({ ...model, iaq_method: e.target.value as any })}
                                        >
                                            <option value="WEIGHTED_HARMONIC">WEIGHTED_HARMONIC (khuyến nghị)</option>
                                            <option value="MIN">MIN (strict)</option>
                                        </select>
                                        <div className="mt-1 text-xs text-slate-500">
                                            MIN: điểm IAQ = chỉ số tệ nhất. WEIGHTED_HARMONIC: mượt hơn nhưng vẫn phạt mạnh khi có chỉ số rất xấu.
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-600">IAQ thresholds (0-100)</div>
                                        <div className="mt-1 grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">SAFE ≥</div>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                                    value={model.iaq_safe}
                                                    onChange={(e) => setModel({ ...model, iaq_safe: n(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">WARN ≥</div>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                                    value={model.iaq_warn}
                                                    onChange={(e) => setModel({ ...model, iaq_warn: n(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="text-xs font-semibold text-slate-600">Weights (w_temp / w_hum / w_dust / w_gas)</div>
                                        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">Temp</div>
                                                <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.w_temp} onChange={(e) => setModel({ ...model, w_temp: n(e.target.value) })} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">Hum</div>
                                                <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.w_hum} onChange={(e) => setModel({ ...model, w_hum: n(e.target.value) })} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">Dust</div>
                                                <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.w_dust} onChange={(e) => setModel({ ...model, w_dust: n(e.target.value) })} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">Gas</div>
                                                <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.w_gas} onChange={(e) => setModel({ ...model, w_gas: n(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Không bắt buộc tổng = 1 (backend sẽ xử lý an toàn), nhưng nên để tổng ~ 1 để dễ hiểu.
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="text-xs font-semibold text-slate-600">Temperature trapezoid (a &lt; b ≤ c &lt; d) với [b, c] là vùng an toàn</div>
                                        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                                            <div><div className="text-[11px] font-semibold text-slate-500">a</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.temp_a} onChange={(e) => setModel({ ...model, temp_a: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">b</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.temp_b} onChange={(e) => setModel({ ...model, temp_b: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">c</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.temp_c} onChange={(e) => setModel({ ...model, temp_c: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">d</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.temp_d} onChange={(e) => setModel({ ...model, temp_d: n(e.target.value) })} /></div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="text-xs font-semibold text-slate-600">Humidity trapezoid (a &lt; b ≤ c &lt; d) với [b, c] là vùng an toàn</div>
                                        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                                            <div><div className="text-[11px] font-semibold text-slate-500">a</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.hum_a} onChange={(e) => setModel({ ...model, hum_a: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">b</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.hum_b} onChange={(e) => setModel({ ...model, hum_b: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">c</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.hum_c} onChange={(e) => setModel({ ...model, hum_c: n(e.target.value) })} /></div>
                                            <div><div className="text-[11px] font-semibold text-slate-500">d</div><input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.hum_d} onChange={(e) => setModel({ ...model, hum_d: n(e.target.value) })} /></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-600">Dust scoring (mg/m³)</div>
                                        <div className="mt-1 grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">good ≤</div>
                                                <input type="number" step="0.001" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.dust_good} onChange={(e) => setModel({ ...model, dust_good: n(e.target.value) })} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">bad ≥</div>
                                                <input type="number" step="0.001" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.dust_bad} onChange={(e) => setModel({ ...model, dust_bad: n(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Gợi ý: 0.05 mg/m³ ≈ 50 µg/m³.
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-600">Gas scoring (ppm)</div>
                                        <div className="mt-1 grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">good ≤</div>
                                                <input type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.gas_good} onChange={(e) => setModel({ ...model, gas_good: n(e.target.value) })} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500">bad ≥</div>
                                                <input type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={model.gas_bad} onChange={(e) => setModel({ ...model, gas_bad: n(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Lưu ý: MQ-2 thường cho “ppm tương đối” (phụ thuộc hiệu chuẩn). Hãy chỉnh theo dữ liệu thực tế của bạn.
                                        </div>
                                    </div>
                                </div>
                            </details>

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
                        </div>
                    ) : null}
                </>
            )}
        </PageContainer>
    );
}
