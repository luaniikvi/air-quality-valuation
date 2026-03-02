import { useMemo } from 'react';

type Props = {
    label: string;
    valueIso: string;
    onChangeIso: (iso: string) => void;
};

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function toPartsFromIso(valueIso: string) {
    const d = new Date(valueIso);
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;

    const yyyy = safe.getFullYear();
    const mm = safe.getMonth() + 1;
    const dd = safe.getDate();
    const hh24 = safe.getHours();
    const mi = safe.getMinutes();
    const ss = safe.getSeconds();

    const ampm: 'AM' | 'PM' = hh24 >= 12 ? 'PM' : 'AM';
    const hh12 = ((hh24 + 11) % 12) + 1; // 1..12

    return { yyyy, mm, dd, hh12, mi, ss, ampm };
}

function buildIsoFromParts(p: {
    yyyy: number;
    mm: number;
    dd: number;
    hh12: number;
    mi: number;
    ss: number;
    ampm: 'AM' | 'PM';
}) {
    const hh12 = Math.min(12, Math.max(1, Math.trunc(p.hh12)));
    const mi = Math.min(59, Math.max(0, Math.trunc(p.mi)));
    const ss = Math.min(59, Math.max(0, Math.trunc(p.ss)));

    let hh24 = hh12 % 12;
    if (p.ampm === 'PM') hh24 += 12;

    // Create Date in LOCAL timezone, then convert to ISO (UTC) for API.
    const d = new Date(p.yyyy, p.mm - 1, p.dd, hh24, mi, ss);
    return d.toISOString();
}

export default function DateTime12hInput({ label, valueIso, onChangeIso }: Props) {
    const parts = useMemo(() => toPartsFromIso(valueIso), [valueIso]);
    const dateValue = `${parts.yyyy}-${pad2(parts.mm)}-${pad2(parts.dd)}`;

    const commit = (next: Partial<typeof parts>) => {
        onChangeIso(
            buildIsoFromParts({
                yyyy: next.yyyy ?? parts.yyyy,
                mm: next.mm ?? parts.mm,
                dd: next.dd ?? parts.dd,
                hh12: next.hh12 ?? parts.hh12,
                mi: next.mi ?? parts.mi,
                ss: next.ss ?? parts.ss,
                ampm: (next.ampm ?? parts.ampm) as 'AM' | 'PM'
            })
        );
    };

    return (
        <div>
            <div className="text-xs font-semibold text-slate-600">{label}</div>

            <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={dateValue}
                    onChange={(e) => {
                        const [y, m, d] = e.target.value.split('-').map((x) => Number(x));
                        if (!y || !m || !d) return;
                        commit({ yyyy: y, mm: m, dd: d });
                    }}
                />

                <div className="grid grid-cols-4 gap-2">
                    <select
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={parts.hh12}
                        onChange={(e) => commit({ hh12: Number(e.target.value) })}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>
                                {pad2(h)}
                            </option>
                        ))}
                    </select>

                    <select
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={parts.mi}
                        onChange={(e) => commit({ mi: Number(e.target.value) })}
                    >
                        {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                            <option key={m} value={m}>
                                {pad2(m)}
                            </option>
                        ))}
                    </select>

                    <select
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={parts.ss}
                        onChange={(e) => commit({ ss: Number(e.target.value) })}
                    >
                        {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                            <option key={s} value={s}>
                                {pad2(s)}
                            </option>
                        ))}
                    </select>

                    <select
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold"
                        value={parts.ampm}
                        onChange={(e) => commit({ ampm: e.target.value as 'AM' | 'PM' })}
                    >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
