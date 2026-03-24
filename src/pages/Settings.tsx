import { useEffect, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import NoDeviceState from '../components/common/NoDeviceState';
import { hasDeviceId } from '../utils/deviceGuard';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import { getSettings, saveSettings } from '../api/sensorApi';
import type { DeviceSettings } from '../types';

function ToggleRow(props: {
    label: string;
    description: string;
    value: boolean;
    onChange: (next: boolean) => void;
}) {
    const { label, description, value, onChange } = props;

    return (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
                <div className="text-sm font-semibold text-slate-900">{label}</div>
                <div className="mt-1 text-xs text-slate-600">{description}</div>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => onChange(!value)}
                className={`relative inline-flex h-10 w-20 items-center rounded-full border transition ${value
                    ? 'border-emerald-300 bg-emerald-500'
                    : 'border-slate-300 bg-slate-300'
                    }`}
            >
                <span
                    className={`absolute left-1 inline-block h-8 w-8 rounded-full bg-white shadow transition ${value ? 'translate-x-10' : 'translate-x-0'
                        }`}
                />
                <span className="sr-only">{label}</span>
                <span className={`absolute text-xs font-bold text-white ${value ? 'left-3' : 'right-3'}`}>
                    {value ? 'ON' : 'OFF'}
                </span>
            </button>
        </div>
    );
}

export default function Settings() {
    const { deviceId } = useDeviceContext();
    const noDevice = !hasDeviceId(deviceId);

    const [model, setModel] = useState<DeviceSettings | null>(null);
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
            setOk('Đã lưu trạng thái LED / BUZZER.');
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
                    {loading && !model ? (
                        <div className="mt-6">
                            <Loading />
                        </div>
                    ) : null}

                    {model ? (
                        <div className="mt-6 space-y-4">
                            <ToggleRow
                                label="LED"
                                description="Bật hoặc tắt đèn LED khi thiết bị nhận kết quả IAQ từ server qua MQTT."
                                value={model.led_enabled}
                                onChange={(next) => setModel({ ...model, led_enabled: next })}
                            />

                            <ToggleRow
                                label="BUZZER"
                                description="Bật hoặc tắt còi BUZZER khi thiết bị nhận kết quả IAQ từ server qua MQTT."
                                value={model.buzzer_enabled}
                                onChange={(next) => setModel({ ...model, buzzer_enabled: next })}
                            />

                            <div className="flex items-center gap-3">
                                <button
                                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    onClick={onSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save'}
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
